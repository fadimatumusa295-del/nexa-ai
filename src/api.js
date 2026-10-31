// Talks to the NEXA AI Cloudflare Worker.
//
// NOTE: the exact request/response format of the Worker could not be checked while
// building this app, so this file is deliberately tolerant:
//  - the question is sent under several common field names (message, prompt, text, query)
//  - the answer is looked for under many common names (reply, response, answer, ...)
// Once the real format is confirmed, buildRequestBody() and REPLY_KEYS can be tightened.

import { BACKEND_URL, REQUEST_TIMEOUT_MS, SMART_PROMPT, MEMORY_MESSAGES } from './config.js';

export class ApiError extends Error {
  // code: 'network' | 'timeout' | 'http' | 'format' | 'empty'
  constructor(code, detail = '', status = 0) {
    super(code);
    this.name = 'ApiError';
    this.code = code;
    this.detail = detail;
    this.status = status;
  }
}

// extra: more fields sent along (the chat history and the plain question).
export function buildRequestBody(message, lang, extra = {}) {
  return { message, prompt: message, text: message, query: message, language: lang, lang, ...extra };
}

/* ------------------------- chat memory and smart prompt ------------------------- */

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function describeNow(now = new Date()) {
  const h = now.getHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${DAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}, ${h12}:${mm} ${h < 12 ? 'AM' : 'PM'}`;
}

// history: [{ role: 'user' | 'assistant', content }]. Keeps the latest messages, each shortened.
export function trimHistory(history, maxMessages = MEMORY_MESSAGES, maxChars = 600) {
  return (history || [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-maxMessages)
    .map((m) => ({
      role: m.role,
      content: m.content.length > maxChars ? `${m.content.slice(0, maxChars)}…` : m.content,
    }));
}

// Wraps the user's question with short instructions and the recent conversation, so any
// AI model behind the Worker answers well and remembers the chat.
export function buildPrompt(text, lang, history = [], now = new Date(), { smart = SMART_PROMPT } = {}) {
  if (!smart) return text;
  const language = lang === 'ha' ? 'Hausa' : 'English';
  const lines = [
    `[Instructions for NEXA AI: You are NEXA AI, a smart, warm and knowledgeable voice assistant for people in Northern Nigeria. ` +
      `Reply in ${language}, unless the user clearly writes in another language. ` +
      `Be accurate and genuinely helpful. Think carefully before you answer, give practical details, and if you are not sure of something, say so instead of guessing. ` +
      `Keep answers short and clear because they may be read aloud: plain text only, no markdown, no asterisks, no emojis, no tables. ` +
      `Use the conversation below for context. Local date and time: ${describeNow(now)}.]`,
  ];
  const turns = trimHistory(history);
  if (turns.length) {
    lines.push('[Conversation so far]');
    for (const t of turns) lines.push(`${t.role === 'user' ? 'User' : 'NEXA'}: ${t.content}`);
  }
  lines.push('[New message from the user]', text);
  return lines.join('\n');
}

const REPLY_KEYS = [
  'reply', 'response', 'answer', 'message', 'text', 'output',
  'result', 'content', 'completion', 'generated_text',
];
const WRAPPER_KEYS = ['data', 'body', 'payload'];

export function extractReply(data, depth = 0) {
  if (data == null || depth > 5) return null;
  if (typeof data === 'string') return data.trim() ? data : null;
  if (typeof data !== 'object') return null;

  if (Array.isArray(data)) {
    for (const item of data) {
      const r = extractReply(item, depth + 1);
      if (r) return r;
    }
    return null;
  }

  // OpenAI-style: { choices: [{ message: { content } }] }
  if (Array.isArray(data.choices) && data.choices.length) {
    const c = data.choices[0];
    const r = extractReply(c?.message ?? c?.text ?? c, depth + 1);
    if (r) return r;
  }
  // Gemini-style: { candidates: [{ content: { parts: [{ text }] } }] }
  const parts = data.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    const s = parts.map((p) => p?.text).filter(Boolean).join('');
    if (s.trim()) return s;
  }

  for (const key of REPLY_KEYS) {
    if (key in data) {
      const r = extractReply(data[key], depth + 1);
      if (r) return r;
    }
  }
  for (const key of WRAPPER_KEYS) {
    if (key in data) {
      const r = extractReply(data[key], depth + 1);
      if (r) return r;
    }
  }
  return null;
}

function snippet(text, max = 160) {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function serverMessage(data, raw) {
  if (data && typeof data === 'object') {
    const e = data.error;
    if (typeof e === 'string' && e) return snippet(e);
    if (e && typeof e === 'object' && typeof e.message === 'string') return snippet(e.message);
    if (typeof data.message === 'string' && data.message) return snippet(data.message);
  }
  return snippet(raw);
}

export async function askBackend(
  message,
  lang,
  { fetchImpl = globalThis.fetch, url = BACKEND_URL, timeoutMs = REQUEST_TIMEOUT_MS, extra = {} } = {},
) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller?.abort();
      reject(new ApiError('timeout'));
    }, timeoutMs);
  });

  const request = (async () => {
    let res;
    try {
      res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(buildRequestBody(message, lang, extra)),
        signal: controller?.signal,
      });
    } catch (e) {
      if (e?.name === 'AbortError') throw new ApiError('timeout');
      throw new ApiError('network', snippet(e?.message ?? e));
    }

    let raw;
    try {
      raw = await res.text();
    } catch (e) {
      throw new ApiError('network', snippet(e?.message ?? e));
    }

    let data = null;
    let isJson = false;
    try {
      data = JSON.parse(raw);
      isJson = true;
    } catch {
      /* not JSON */
    }

    if (!res.ok) throw new ApiError('http', serverMessage(isJson ? data : null, raw), res.status);

    if (!isJson) {
      const plain = raw.trim();
      if (!plain) throw new ApiError('empty');
      if (plain.startsWith('<')) throw new ApiError('format', snippet(plain));
      return { reply: plain, raw };
    }

    const reply = extractReply(data);
    if (reply == null) {
      if (data && typeof data === 'object' && data.error) {
        throw new ApiError('http', serverMessage(data, raw), res.status);
      }
      throw new ApiError('format', snippet(raw));
    }
    const trimmed = reply.trim();
    if (!trimmed) throw new ApiError('empty');
    return { reply: trimmed, raw };
  })();

  request.catch(() => {}); // avoid an unhandled rejection if the timeout wins the race

  try {
    return await Promise.race([request, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
