// Talks to the NEXA AI Cloudflare Worker.
//
// NOTE: the exact request/response format of the Worker could not be checked while
// building this app, so this file is deliberately tolerant:
//  - the question is sent under several common field names (message, prompt, text, query)
//  - the answer is looked for under many common names (reply, response, answer, ...)
// Once the real format is confirmed, buildRequestBody() and REPLY_KEYS can be tightened.

import { BACKEND_URL, REQUEST_TIMEOUT_MS } from './config.js';

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

export function buildRequestBody(message, lang) {
  return { message, prompt: message, text: message, query: message, language: lang, lang };
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
  { fetchImpl = globalThis.fetch, url = BACKEND_URL, timeoutMs = REQUEST_TIMEOUT_MS } = {},
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
        body: JSON.stringify(buildRequestBody(message, lang)),
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
