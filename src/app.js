import './style.css';
import { DEFAULT_LANGUAGE, LANGUAGES, MEMORY_STORED_MAX } from './config.js';
import { t } from './i18n.js';
import { parseCommand } from './commands.js';
import { runCommand } from './launcher.js';
import { askBackend, buildPrompt, trimHistory, ApiError } from './api.js';
import { cleanReply } from './text.js';
import { listen, stopListening, speak, stopSpeaking, VoiceError } from './voice.js';

const $ = (id) => document.getElementById(id);
const chat = $('chat');
const statusEl = $('status');
const input = $('input');
const micBtn = $('micBtn');
const speakBtn = $('speakBtn');
const sendBtn = $('sendBtn');
const composer = $('composer');
const voiceToggle = $('voiceReplies');
const newChatBtn = $('newChat');

const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : v;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* storage not available: settings just won't be remembered */
    }
  },
};

let lang = store.get('nexa.lang', DEFAULT_LANGUAGE);
if (!LANGUAGES[lang]) lang = DEFAULT_LANGUAGE;
let voiceReplies = store.get('nexa.voice', '1') === '1';

let busy = false;
let listening = false;
let cancelledListen = false;
let speaking = false;
let speakToken = 0;
let lastReply = '';
const ttsWarned = {};

const say = (key, params) => t(lang, key, params);

/* ------------------------------ chat memory ------------------------------ */
// The conversation is saved on the phone, so NEXA remembers it between messages and
// after the app is closed. "New chat" clears it.

const MEMORY_KEY = 'nexa.memory';

function loadMemory() {
  try {
    const list = JSON.parse(store.get(MEMORY_KEY, '[]'));
    if (!Array.isArray(list)) return [];
    return list
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-MEMORY_STORED_MAX);
  } catch {
    return [];
  }
}

let memory = loadMemory();

function remember(role, content) {
  memory.push({ role, content: String(content).slice(0, 2000) });
  memory = memory.slice(-MEMORY_STORED_MAX);
  store.set(MEMORY_KEY, JSON.stringify(memory));
}

function forgetAll() {
  memory = [];
  store.set(MEMORY_KEY, '[]');
}

/* ------------------------------ UI helpers ------------------------------ */

function addMessage(kind, text, extraClass = '') {
  const el = document.createElement('div');
  el.className = `msg ${kind} ${extraClass}`.trim();
  el.textContent = text;
  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;
  return el;
}

function setStatus(text) {
  statusEl.textContent = text || '';
}

function updateButtons() {
  sendBtn.disabled = busy;
  micBtn.disabled = busy && !listening;
  micBtn.classList.toggle('active', listening);
  micBtn.setAttribute('aria-pressed', String(listening));
  micBtn.setAttribute('aria-label', say(listening ? 'micStopLabel' : 'micLabel'));
  speakBtn.classList.toggle('active', speaking);
  speakBtn.setAttribute('aria-pressed', String(speaking));
  speakBtn.setAttribute('aria-label', say(speaking ? 'speakStopLabel' : 'speakLabel'));
}

function applyLanguage() {
  document.documentElement.lang = lang;
  $('tagline').textContent = say('tagline');
  $('voiceRepliesLabel').textContent = say('voiceReplies');
  newChatBtn.textContent = say('newChat');
  input.placeholder = say('placeholder');
  sendBtn.textContent = say('send');
  document.querySelectorAll('.lang-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.lang === lang);
    b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
  });
  updateButtons();
}

/* ------------------------------ error text ------------------------------ */

function describeApiError(e) {
  if (!(e instanceof ApiError)) return say('networkError');
  switch (e.code) {
    case 'timeout':
      return say('timeout');
    case 'http':
      return say('backendError', { code: e.status || '?' }) + (e.detail ? `\n${e.detail}` : '');
    case 'format':
      return say('badFormat') + (e.detail ? `\n${e.detail}` : '');
    case 'empty':
      return say('emptyReply');
    default:
      // Show the phone's own reason (e.g. "Failed to fetch") so the real cause can be found.
      return say('networkError') + (e.detail ? `\n(${e.detail})` : '');
  }
}

function describeVoiceError(e) {
  switch (e instanceof VoiceError ? e.code : 'failed') {
    case 'unavailable':
      return say('micUnavailable');
    case 'permission':
      return say('micDenied');
    case 'no-speech':
      return say('noSpeech');
    default:
      return say('micFailed');
  }
}

/* ------------------------------ speaking ------------------------------ */

async function speakReply(text, { explicit = false } = {}) {
  if (!text) return;
  const token = ++speakToken;
  speaking = true;
  updateButtons();
  const result = await speak(text, lang);
  if (token === speakToken) {
    speaking = false;
    updateButtons();
  }
  if (!result.ok) {
    if (result.reason === 'unsupported') {
      if (explicit || !ttsWarned[lang]) {
        ttsWarned[lang] = true;
        addMessage('note', say('ttsUnsupported', { language: LANGUAGES[lang].name }));
      }
    } else {
      addMessage('note', say('ttsFailed'));
    }
  }
}

/* ------------------------------ sending ------------------------------ */

async function handleSend(raw) {
  const text = String(raw ?? '').trim();
  if (!text || busy) return;

  busy = true;
  updateButtons();
  input.value = '';
  addMessage('user', text);

  try {
    const command = parseCommand(text);
    if (command) {
      const result = await runCommand(command);
      if (!result.passToAi) {
        const info = result.level === 'info';
        addMessage(result.ok || info ? 'note' : 'error', say(result.key, result.params), result.ok && !info ? 'ok' : '');
        return;
      }
      // Not a phone command after all (for example "open a bank account"): ask the AI.
    }

    const pending = addMessage('note', say('thinking'), 'typing');
    try {
      const history = trimHistory(memory);
      const prompt = buildPrompt(text, lang, history);
      const { reply: raw } = await askBackend(prompt, lang, { extra: { history, question: text } });
      const reply = cleanReply(raw) || raw;
      pending.remove();
      lastReply = reply;
      remember('user', text);
      remember('assistant', reply);
      addMessage('bot', reply);
      if (voiceReplies) speakReply(reply); // not awaited: speaking continues in the background
    } catch (e) {
      pending.remove();
      addMessage('error', describeApiError(e));
    }
  } finally {
    busy = false;
    updateButtons();
  }
}

/* ------------------------------ events ------------------------------ */

composer.addEventListener('submit', (e) => {
  e.preventDefault();
  handleSend(input.value);
});

micBtn.addEventListener('click', async () => {
  if (listening) {
    cancelledListen = true;
    await stopListening();
    return;
  }
  if (busy) return;

  cancelledListen = false;
  await stopSpeaking();
  listening = true;
  setStatus(say('listening'));
  updateButtons();

  let heard = '';
  let failure = null;
  try {
    heard = await listen(lang);
  } catch (e) {
    failure = e;
  }

  listening = false;
  setStatus('');
  updateButtons();

  if (cancelledListen) return;
  if (failure) {
    addMessage('error', describeVoiceError(failure));
    return;
  }
  handleSend(heard);
});

speakBtn.addEventListener('click', async () => {
  if (speaking) {
    speakToken++;
    speaking = false;
    updateButtons();
    await stopSpeaking();
    return;
  }
  if (!lastReply) {
    addMessage('note', say('nothingToRepeat'));
    return;
  }
  speakReply(lastReply, { explicit: true });
});

newChatBtn.addEventListener('click', async () => {
  if (busy) return;
  speakToken++;
  speaking = false;
  await stopSpeaking();
  forgetAll();
  lastReply = '';
  Array.from(chat.children).forEach((c) => c.remove());
  addMessage('bot', say('greeting'));
  updateButtons();
});

document.querySelectorAll('.lang-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const next = btn.dataset.lang;
    if (!LANGUAGES[next] || next === lang) return;
    lang = next;
    store.set('nexa.lang', lang);
    applyLanguage();
  });
});

voiceToggle.checked = voiceReplies;
voiceToggle.addEventListener('change', () => {
  voiceReplies = voiceToggle.checked;
  store.set('nexa.voice', voiceReplies ? '1' : '0');
  if (!voiceReplies) {
    speakToken++;
    speaking = false;
    updateButtons();
    stopSpeaking();
  }
});

/* ------------------------------ start ------------------------------ */

applyLanguage();
if (memory.length) {
  // Show the saved conversation again so the chat looks the way it was left.
  for (const m of memory.slice(-30)) addMessage(m.role === 'user' ? 'user' : 'bot', m.content);
  const lastBot = [...memory].reverse().find((m) => m.role === 'assistant');
  if (lastBot) lastReply = lastBot.content;
} else {
  addMessage('bot', say('greeting'));
}
