// Talks to the NEXA AI Cloudflare Worker.
//
// What the Worker expects (read from its code):
//   POST  { message, language, history, personalMemory }
//     message         the question, at most 3000 characters
//     language        "ha-NG" or "Hausa" for Hausa; anything else means English
//     history         [{ role: "user" | "model", text }]  (the Worker keeps the latest 12)
//     personalMemory  an object; the Worker tells the AI to use it when relevant
//   Answer:  { reply }   or on a problem   { error }  with a status code.

import { BACKEND_URL, REQUEST_TIMEOUT_MS, MEMORY_MESSAGES, MAX_MESSAGE_CHARS, LANGUAGES } from './config.js';

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

/* ------------------------- date, history and memory ------------------------- */

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

// The app stores { role: 'user' | 'assistant', content }. The Worker wants
// { role: 'user' | 'model', text }. Keeps the latest messages (each shortened) and makes
// sure the list starts with the user, as the AI service requires.
export function toWorkerHistory(history, max = MEMORY_MESSAGES, maxChars = 1500) {
  const list = (history || [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-max)
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      text: m.content.length > maxChars ? `${m.content.slice(0, maxChars)}…` : m.content,
    }));
  while (list.length && list[0].role !== 'user') list.shift();
  return list;
}

// Extra facts the Worker passes to the AI: the date and time, how to word answers, and
// whatever the user asked NEXA to remember.
export function buildPersonalMemory({ facts = [], now = new Date() } = {}) {
  const memory = {
    current_local_date_and_time: describeNow(now),
    how_to_answer:
      'Answers may be read aloud: use plain text, no markdown, no asterisks, no emojis, no tables. Be accurate and keep it short unless more detail is needed.',
  };
  const list = (facts || []).filter((f) => typeof f === 'string' && f.trim());
  if (list.length) memory.things_the_user_asked_you_to_remember = list;
  return memory;
}

export function buildRequestBody(message, lang, { history = [], personalMemory = {} } = {}) {
  return {
    message: String(message ?? '').slice(0, MAX_MESSAGE_CHARS),
    language: LANGUAGES[lang]?.worker ?? 'en-NG',
    history: toWorkerHistory(history),
    personalMemory,
  };
}

/* ------------------------------ reading the answer ------------------------------ */

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

// options: history, personalMemory (see buildRequestBody); fetchImpl, url, timeoutMs (for tests)
export async function askBackend(
  message,
  lang,
  {
    history = [],
    personalMemory = {},
    fetchImpl = globalThis.fetch,
    url = BACKEND_URL,
    timeoutMs = REQUEST_TIMEOUT_MS,
  } = {},
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
        body: JSON.stringify(buildRequestBody(message, lang, { history, personalMemory })),
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
