import './style.css';
import { DEFAULT_LANGUAGE, LANGUAGES, MEMORY_STORED_MAX, MAX_MESSAGE_CHARS } from './config.js';
import { t } from './i18n.js';
import { parseCommand } from './commands.js';
import { runCommand } from './launcher.js';
import { askBackend, buildPersonalMemory, ApiError } from './api.js';
import { addFact, parseFacts } from './facts.js';
import { cleanReply } from './text.js';
import { listen, stopListening, speak, stopSpeaking, VoiceError } from './voice.js';
import {
  handsFreeStatus,
  startHandsFree,
  stopHandsFree,
  openOverlaySettings,
  onHandsFreeCommand,
  setAppVisible,
} from './handsfree.js';

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

/* ------------------------- "remember that ..." facts ------------------------- */

const FACTS_KEY = 'nexa.facts';
let facts = parseFacts(store.get(FACTS_KEY, '[]'));

function saveFacts() {
  store.set(FACTS_KEY, JSON.stringify(facts));
}

// remember / recall / forget are handled here because the facts live in this file.
function runFactCommand(command) {
  if (command.kind === 'remember') {
    const before = facts;
    facts = addFact(facts, command.fact);
    if (facts === before) return { ok: false, key: 'rememberWhat', params: {} };
    saveFacts();
    return { ok: true, key: 'remembered', params: { fact: facts[facts.length - 1] } };
  }
  if (command.kind === 'recall') {
    return facts.length
      ? { ok: true, level: 'info', key: 'recallList', params: { facts: facts.join('; ') } }
      : { ok: true, level: 'info', key: 'recallNone', params: {} };
  }
  facts = [];
  saveFacts();
  return { ok: true, key: 'forgotFacts', params: {} };
}

const FACT_COMMANDS = new Set(['remember', 'recall', 'forget-facts']);

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
  $('handsFreeLabel').textContent = say('handsFree');
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
      return say('micFailed') + (e?.detail ? `\n(${e.detail})` : '');
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

function showResult(result) {
  const info = result.level === 'info';
  addMessage(result.ok || info ? 'note' : 'error', say(result.key, result.params), result.ok && !info ? 'ok' : '');
}

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
      const result = FACT_COMMANDS.has(command.kind)
        ? runFactCommand(command)
        : await runCommand(command, { lang });
      if (!result.passToAi) {
        showResult(result);
        if (result.speak && voiceReplies) speakReply(say(result.key, result.params));
        return;
      }
      // Not a phone command after all (for example "open a bank account"): ask the AI.
    }

    if (text.length > MAX_MESSAGE_CHARS) {
      addMessage('error', say('tooLong', { max: MAX_MESSAGE_CHARS }));
      return;
    }

    const pending = addMessage('note', say('thinking'), 'typing');
    try {
      const { reply: raw } = await askBackend(text, lang, {
        history: memory,
        personalMemory: buildPersonalMemory({ facts }),
      });
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
  await setAppVisible(true); // make sure hands-free has let go of the microphone
  await new Promise((r) => setTimeout(r, 300));
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
    if (handsFreeToggle.checked) startHandsFree(lang, handsFreeTexts()); // listen in the new language
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

/* ------------------------------ hands-free ------------------------------ */
// A background service listens for "Nexa, <command>" while the app is closed (see handsfree.js).

const handsFreeToggle = $('handsFree');

const handsFreeTexts = () => ({
  title: say('handsFreeTitle'),
  text: say('handsFreeText'),
  stop: say('handsFreeStop'),
});

handsFreeToggle.addEventListener('change', async () => {
  if (!handsFreeToggle.checked) {
    await stopHandsFree();
    addMessage('note', say('handsFreeOff'));
    return;
  }

  const status = await handsFreeStatus();
  if (!status.supported) {
    handsFreeToggle.checked = false;
    addMessage('error', say('handsFreePreview'));
    return;
  }

  const result = await startHandsFree(lang, handsFreeTexts());
  if (result.ok) {
    addMessage('note', say('handsFreeOn'), 'ok');
    addMessage('note', say('handsFreeTip'));
    return;
  }

  handsFreeToggle.checked = false;
  if (result.reason === 'overlay') {
    addMessage('note', say('handsFreeNeedOverlay'));
    await openOverlaySettings();
  } else if (result.reason === 'mic') {
    addMessage('error', say('micDenied'));
  } else if (result.reason === 'recognizer') {
    addMessage('error', say('micUnavailable'));
  } else {
    addMessage('error', say('handsFreeFailed'));
  }
});

// A command heard while NEXA was closed (or in the background). Runs like a typed message;
// if NEXA is busy with something else it waits its turn.
async function runHeardCommand(text) {
  for (let i = 0; i < 100 && busy; i++) await new Promise((r) => setTimeout(r, 300));
  await handleSend(text);
}
onHandsFreeCommand(runHeardCommand);

document.addEventListener('visibilitychange', () => setAppVisible(!document.hidden));
setAppVisible(true);

// The service may have stopped since last time (phone restarted, "Stop" in the notification).
handsFreeStatus().then((status) => {
  handsFreeToggle.checked = status.supported && status.running;
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
