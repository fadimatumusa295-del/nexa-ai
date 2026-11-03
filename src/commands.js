// Turns what the user said or typed into a phone command, or null if it is
// just a normal question (null => the message goes to the AI backend).
//
// English and Hausa both work in either language mode. Examples:
//   open <app>                    bude <app>
//   search YouTube for X          nemi X a YouTube
//   call 08012345678 / call Musa  kira Musa
//   set alarm for 6:30 am         saita alarm karfe 6 na safe          set a timer for 10 minutes
//   turn on the torch             kunna fitila                         turn up the volume / kara sauti
//   battery level                 what time is it / what is the date   karfe nawa
//   send WhatsApp to Musa saying I am coming        text Musa saying I am coming
//   navigate to Kano market       search Google for exchange rate
//   turn on Wi-Fi (opens its screen)
//   remember that my name is Amadu / what do you remember about me / forget everything

import { APPS } from './apps.js';
import { fold, lightClean } from './text.js';
import { parseAlarm, parseTimer } from './time.js';

const FILLERS = new Set([
  'hey', 'hi', 'hello', 'ok', 'okay', 'nexa', 'please', 'pls', 'kindly',
  'can', 'could', 'would', 'will', 'you', 'i', 'want', 'wanna', 'need', 'like',
  'to', 'let', 'me', 'just', 'now', 'and', 'then',
  // Hausa
  'ka', 'ki', 'za', 'iya', 'don', 'allah', 'ina', 'so', 'son', 'yanzu',
]);

const OPEN_VERBS = new Set([
  'open', 'launch', 'start', 'run',
  'bude', 'bida', 'bidi', 'kaddamar', 'shiga', 'kunna',
]);

const CALL_VERBS = new Set(['call', 'dial', 'ring', 'kira', 'buga']);

const LEAD_STRIP = new Set(['the', 'a', 'my', 'me', 'up', 'app', 'application', 'manhajar', 'manhaja', 'min', 'mana']);
const TRAIL_STRIP = new Set([
  'app', 'application', 'please', 'pls', 'now', 'yanzu', 'mana', 'min', 'din',
  'don', 'allah', 'for', 'me', 'manhaja',
]);

// Words that can start a contact name request but are not part of the name.
const NAME_LEAD_STRIP = new Set([
  'to', 'my', 'the', 'up', 'mr', 'mrs', 'miss', 'sir', 'madam', 'me', 'a', 'an', 'min', 'mini', 'mana',
]);
// "call of duty", "call it a day": not a request to phone someone.
const NOT_A_NAME = new Set([
  'of', 'it', 'out', 'off', 'back', 'on', 'that', 'this', 'for', 'about', 'them', 'you', 'in', 'at', 'by', 'with', 'is',
]);

const LEAD = '(?:(?:please|pls|hey|ok|okay|nexa|kindly|can you|could you|don allah|ka|ki)\\s+)*';

/* ------------------------------- YouTube ------------------------------- */

const YT_VERBS = '(?:search|find|play|watch|look up|look for|nemi|nemo|kunna|saka|kalli)';
const YT_A = new RegExp(
  `^${LEAD}${YT_VERBS}\\s+(?:for\\s+|me\\s+)?(.+?)\\s+(?:on|in|at|a|akan|cikin|kan)\\s+youtube(?:\\s+(?:please|pls|yanzu|min|mana))?$`,
  'u',
);
const YT_B = new RegExp(`^${LEAD}${YT_VERBS}\\s+youtube\\s+(?:for\\s+|don\\s+)?(.+)$`, 'u');

function parseYoutubeSearch(light) {
  const m = light.match(YT_A) || light.match(YT_B);
  if (!m) return null;
  const query = m[1].trim();
  return query ? { kind: 'youtube-search', query } : null;
}

/* --------------------------- remembering facts --------------------------- */

const REMEMBER_EN = new RegExp(
  `^${LEAD}remember\\s+(?:that\\s+)?((?:my|i|i'm|im|i am|we|our)\\s+.+|that\\s+.+)$`,
  'iu',
);
const REMEMBER_THAT = new RegExp(`^${LEAD}remember\\s+that\\s+(.+)$`, 'iu');
const REMEMBER_HA = /^(?:(?:ka|ki|don allah)\s+)*tuna(?:\s+min)?\s+cewa\s+(.+)$/iu;

const RECALL = new Set([
  'what do you remember about me', 'what do you know about me', 'what have you saved about me',
  'what did i ask you to remember', 'what do you remember', 'what have you remembered',
  'me ka sani game da ni', 'me ka tuna game da ni', 'me ka adana game da ni',
]);
const FORGET = new Set([
  'forget everything', 'forget everything about me', 'forget everything you know about me',
  'forget what you know about me', 'forget what you remember', 'forget all', 'forget it all',
  'clear my memory', 'delete my memory', 'erase my memory',
  'manta da komai', 'manta da komai game da ni', 'manta da abin da ka sani game da ni',
]);

function parseFacts(text) {
  const t = String(text).trim();
  let m = t.match(REMEMBER_HA);
  if (m) return { kind: 'remember', fact: m[1].trim() };
  m = t.match(REMEMBER_THAT);
  if (m) return { kind: 'remember', fact: m[1].trim() };
  m = t.match(REMEMBER_EN);
  if (m) return { kind: 'remember', fact: m[1].trim() };

  const phrase = fold(t).split(' ').filter((w) => !['please', 'pls', 'hey', 'nexa', 'kindly'].includes(w)).join(' ');
  if (RECALL.has(phrase)) return { kind: 'recall' };
  if (FORGET.has(phrase)) return { kind: 'forget-facts' };
  return null;
}

/* ----------------------------- time and date ----------------------------- */

const NOISE = new Set(['hey', 'hi', 'nexa', 'please', 'pls', 'kindly', 'now', 'yanzu', 'ne', 'din', 'tell', 'me', 'can', 'you', 'could']);
const TIME_Q = new Set([
  'what time is it', 'what time', 'whats the time', 'what is the time', 'the time', 'current time',
  'karfe nawa', 'lokaci nawa', 'wane lokaci',
]);
const DATE_Q = new Set([
  'what is the date', 'whats the date', 'what is todays date', 'whats todays date', 'todays date', 'the date',
  'what day is it', 'what day is today', 'what is today', 'whats today', 'what is the date today',
  'whats the date today', 'what date is it',
  'wace rana ce yau', 'wace rana yau', 'yau wace rana ce', 'ranar yau',
]);

function parseClock(tokens) {
  const phrase = tokens.filter((t) => !NOISE.has(t)).join(' ');
  if (TIME_Q.has(phrase)) return { kind: 'time' };
  if (DATE_Q.has(phrase)) return { kind: 'date' };
  return null;
}

/* ---------------------- torch, volume and battery ---------------------- */

const TORCH_WORDS = new Set(['torch', 'flashlight', 'torchlight', 'fitila', 'tocila']);
const TORCH_OFF = new Set(['off', 'kashe', 'disable', 'stop', 'close']);
const TORCH_ON = new Set(['on', 'kunna', 'enable', 'start', 'light', 'use', 'open', 'turn', 'switch']);

function parseTorch(tokens) {
  const named = tokens.some((t) => TORCH_WORDS.has(t)) || (tokens.includes('flash') && tokens.includes('light'));
  if (!named || tokens.length > 6) return null;
  if (tokens.some((t) => TORCH_OFF.has(t))) return { kind: 'torch', on: false };
  if (tokens.some((t) => TORCH_ON.has(t))) return { kind: 'torch', on: true };
  return null;
}

const VOLUME_WORDS = new Set(['volume', 'sound', 'sauti']);
const VOL_MUTE = new Set(['mute', 'silent', 'silence', 'kashe', 'off']);
const VOL_MAX = new Set(['max', 'maximum', 'full', 'highest']);
const VOL_UP = new Set(['up', 'raise', 'increase', 'louder', 'higher', 'kara', 'more', 'high']);
const VOL_DOWN = new Set(['down', 'lower', 'decrease', 'reduce', 'quieter', 'rage', 'less', 'low', 'softer']);

function parseVolume(tokens) {
  if (!tokens.some((t) => VOLUME_WORDS.has(t)) || tokens.length > 6) return null;
  if (tokens.some((t) => VOL_MUTE.has(t))) return { kind: 'volume', action: 'mute' };
  if (tokens.some((t) => VOL_MAX.has(t))) return { kind: 'volume', action: 'max' };
  if (tokens.some((t) => VOL_UP.has(t))) return { kind: 'volume', action: 'up' };
  if (tokens.some((t) => VOL_DOWN.has(t))) return { kind: 'volume', action: 'down' };
  return null;
}

const BATTERY_ASK = new Set(['level', 'percent', 'percentage', 'left', 'much', 'check', 'status', 'remaining', 'life', 'nawa', 'yaya']);

function parseBattery(tokens) {
  if (tokens.length > 7) return null;
  const named = tokens.includes('battery') || (tokens.includes('cajin') && tokens.includes('waya'));
  if (!named || tokens.includes('saver') || tokens.includes('settings') || tokens.includes('setting')) return null;
  return tokens.some((t) => BATTERY_ASK.has(t)) ? { kind: 'battery' } : null;
}

/* ---------------------- read messages / missed calls ---------------------- */

const READ_VERBS = new Set(['read', 'check', 'karanta', 'duba', 'any', 'new', 'latest', 'last', 'unread']);
const SMS_NOUNS = new Set(['messages', 'message', 'sms', 'texts', 'text', 'sakonni', 'sakonnina', 'sakona', 'sakon']);

function parseInbox(tokens) {
  if (tokens.length > 8) return null;
  const phrase = tokens.join(' ');
  // missed calls: "missed calls", "who called me", "wanda ya kira ni", "kiran da ban dauka"
  if (
    (tokens.includes('missed') && (tokens.includes('calls') || tokens.includes('call'))) ||
    /\bwho (called|rang|phoned)\b/.test(phrase) ||
    /\bwanda ya kira\b/.test(phrase) ||
    /\bkiran da ban dauka\b/.test(phrase) ||
    /\bkirana da ban dauka\b/.test(phrase)
  ) {
    return { kind: 'missed-calls' };
  }
  const reading = tokens.some((t) => READ_VERBS.has(t));
  const noun = tokens.some((t) => SMS_NOUNS.has(t));
  const sending = tokens.some((t) => ['send', 'tura', 'whatsapp', 'to', 'zuwa'].includes(t));
  if (reading && noun && !sending && !tokens.includes('open') && !tokens.includes('bude')) {
    return { kind: 'read-sms' };
  }
  return null;
}

/* ------------------- WhatsApp and text messages ------------------- */

const NAME = '(.+?)';
// what comes between the name and the words to send: "saying ...", "cewa ..." or "Musa: ..."
const MARK = '(?:\\s*:\\s*|\\s+(?:saying|that says|and say|with (?:the )?message|cewa)\\s*[:,]?\\s*)';
const SAYING = `(?:${MARK}(.+))?`;
const TO = '(?:to|for|zuwa|ga|ma|wa)';
const SEND = '(?:send|write|compose|type|aika|rubuta)';
const ARTICLES = '(?:(?:a|an|sakon|sa[kƙ]o|sa[kƙ]on)\\s+)*';

const WA_SEND = new RegExp(
  `^${LEAD}${SEND}\\s+${ARTICLES}(?:whatsapp|whats app)(?:\\s+(?:message|msg|text|sa[kƙ]o))?\\s+${TO}\\s+${NAME}${SAYING}$`,
  'iu',
);
const WA_ON = new RegExp(
  `^${LEAD}(?:send\\s+)?(?:a\\s+)?(?:message|text|msg)\\s+(?:to\\s+)?${NAME}\\s+(?:on|via)\\s+(?:whatsapp|whats app)${SAYING}$`,
  'iu',
);
const WA_SHORT = new RegExp(
  `^${LEAD}(?:whatsapp|whats app)\\s+${NAME}${MARK}(.+)$`,
  'iu',
);
const SMS_SEND = new RegExp(
  `^${LEAD}${SEND}\\s+${ARTICLES}(?:text message|sms message|text|sms|sms sako)\\s+${TO}\\s+${NAME}${SAYING}$`,
  'iu',
);
const SMS_SHORT = new RegExp(
  `^${LEAD}(?:text|sms)\\s+${NAME}${MARK}(.+)$`,
  'iu',
);

const cleanName = (s) => s.trim().replace(/^(?:my|the)\s+/i, '').trim();
const cleanBody = (s) => String(s ?? '').trim().replace(/^["“”']+|["“”']+$/g, '').trim();

function parseMessage(text) {
  const t = String(text).trim().replace(/\s+/g, ' ');
  for (const [re, kind] of [
    [WA_SEND, 'whatsapp'], [WA_ON, 'whatsapp'], [WA_SHORT, 'whatsapp'],
    [SMS_SEND, 'sms'], [SMS_SHORT, 'sms'],
  ]) {
    const m = t.match(re);
    if (m) {
      const name = cleanName(m[1]);
      if (name) return { kind, name, text: cleanBody(m[2]) };
    }
  }
  return null;
}

/* ----------------------- directions and web search ----------------------- */

const NAV = new RegExp(
  `^${LEAD}(?:navigate(?:\\s+me)?|take me|drive me|show me the way|show me directions|get directions|give me directions|directions|nuna min hanyar|nuna hanyar|kai ni)\\s+(?:to|for|zuwa|ga)\\s+(.+)$`,
  'iu',
);
const GS_A = new RegExp(
  `^${LEAD}(?:search|look up|find)\\s+(?:on\\s+)?(?:google|the web|the internet|online)\\s+(?:for\\s+)?(.+)$`,
  'iu',
);
const GS_B = new RegExp(
  `^${LEAD}(?:search|look up|find|nemi|nemo)\\s+(?:for\\s+)?(.+?)\\s+(?:on|in|a|akan|cikin|kan)\\s+(?:google|the web|the internet|online|intanet)$`,
  'iu',
);
const GS_C = new RegExp(`^${LEAD}google\\s+(.+)$`, 'iu');

function parseNavigate(text) {
  const m = String(text).trim().replace(/\s+/g, ' ').match(NAV);
  const place = m ? m[1].trim() : '';
  return place ? { kind: 'navigate', place } : null;
}

function parseWebSearch(text) {
  const t = String(text).trim().replace(/\s+/g, ' ');
  for (const re of [GS_A, GS_B, GS_C]) {
    const m = t.match(re);
    if (!m) continue;
    const query = m[1].trim();
    if (!query) continue;
    // "google maps" is an app, not a search
    if (re === GS_C && APPS.some((a) => a.aliases.includes(fold(query)))) continue;
    return { kind: 'web-search', query };
  }
  return null;
}

/* ------------------------ phone settings screens ------------------------ */

// Android no longer lets an app switch these on or off by itself, so the command opens
// the right settings screen (and says so).
const SETTINGS_PAGES = [
  { key: 'wifi', label: 'Wi-Fi', aliases: ['wifi', 'wi fi', 'wireless internet'] },
  { key: 'bluetooth', label: 'Bluetooth', aliases: ['bluetooth', 'blue tooth'] },
  { key: 'airplane', label: 'Airplane mode', aliases: ['airplane', 'aeroplane', 'flight', 'airplane mode', 'flight mode'] },
  { key: 'location', label: 'Location', aliases: ['location', 'gps', 'location services'] },
  { key: 'mobiledata', label: 'Mobile data', aliases: ['mobile data', 'data', 'cellular data', 'cellular', 'mobile network'] },
  { key: 'battery', label: 'Battery saver', aliases: ['battery saver', 'battery', 'power saver', 'power saving'] },
  { key: 'display', label: 'Display', aliases: ['display', 'brightness', 'screen brightness'] },
  { key: 'sound', label: 'Sound', aliases: ['sound', 'sounds', 'ringtone', 'ringtones'] },
];
const SETTINGS_VERBS = new Set(['turn', 'switch', 'enable', 'disable', 'toggle', 'open', 'show', 'go', 'kunna', 'kashe', 'bude', 'shiga']);
const SETTINGS_NOISE = new Set([
  'the', 'my', 'to', 'settings', 'setting', 'mode', 'page', 'screen', 'a', 'phone', 'up',
  'saiti', 'saitin', 'waya', 'na', 'don', 'allah', 'please', 'pls',
]);

function parseSettingsPage(tokens) {
  if (!SETTINGS_VERBS.has(tokens[0])) return null;
  let on = null;
  if (tokens[0] === 'kashe' || tokens[0] === 'disable') on = false;
  if (tokens[0] === 'kunna' || tokens[0] === 'enable') on = true;
  const rest = [];
  for (const tk of tokens.slice(1)) {
    if (tk === 'on') on = true;
    else if (tk === 'off') on = false;
    else if (!SETTINGS_NOISE.has(tk)) rest.push(tk);
  }
  if (!rest.length || rest.length > 3) return null;
  const phrase = rest.join(' ');
  const page = SETTINGS_PAGES.find((p) => p.aliases.includes(phrase));
  return page ? { kind: 'settings-page', page: page.key, label: page.label, on } : null;
}

/* ------------------------------- calling ------------------------------- */

function parseCall(restTokens) {
  const joined = restTokens.join('');
  if (/^\+?\d{5,15}$/.test(joined)) return { kind: 'dial', number: joined };

  const rest = [...restTokens];
  while (rest.length && NAME_LEAD_STRIP.has(rest[0])) rest.shift();
  while (rest.length && TRAIL_STRIP.has(rest[rest.length - 1])) rest.pop();
  if (!rest.length || rest.length > 4) return null;
  if (NOT_A_NAME.has(rest[0])) return null;
  if (rest.every((t) => /^\d+$/.test(t))) return null; // a too-short number, not a name
  return { kind: 'call-contact', name: rest.join(' ') };
}

/* ------------------------------- main entry ------------------------------- */

export function parseCommand(text, now = new Date()) {
  const light = lightClean(text);
  if (!light) return null;

  const yt = parseYoutubeSearch(light);
  if (yt) return yt;

  const alarm = parseAlarm(text, now);
  if (alarm) return alarm;
  const timer = parseTimer(text);
  if (timer) return timer;

  const facts = parseFacts(text);
  if (facts) return facts;
  const message = parseMessage(text);
  if (message) return message;
  const nav = parseNavigate(text);
  if (nav) return nav;
  const web = parseWebSearch(text);
  if (web) return web;

  let tokens = fold(text).split(' ').filter(Boolean);
  const clock = parseClock(tokens);
  if (clock) return clock;

  let i = 0;
  while (i < tokens.length && FILLERS.has(tokens[i])) i++;
  tokens = tokens.slice(i);
  if (tokens.length < 2) return null;

  const device = parseInbox(tokens) || parseTorch(tokens) || parseVolume(tokens) || parseBattery(tokens) || parseSettingsPage(tokens);
  if (device) return device;

  let verb = tokens[0];
  let start = 1;
  if (verb === 'go' && tokens[1] === 'to') {
    verb = 'open';
    start = 2;
  }

  if (CALL_VERBS.has(verb)) return parseCall(tokens.slice(start));
  if (!OPEN_VERBS.has(verb)) return null;

  let rest = tokens.slice(start);
  while (rest.length && LEAD_STRIP.has(rest[0])) rest = rest.slice(1);
  while (rest.length && TRAIL_STRIP.has(rest[rest.length - 1])) rest = rest.slice(0, -1);
  if (!rest.length || rest.length > 4) return null;

  const phrase = rest.join(' ');
  const app = APPS.find((a) => a.aliases.includes(phrase));
  if (app) return { kind: 'open-app', app };

  // Not one of the apps we know by name. It may still be an app installed on the phone
  // ("open Notes", "open Palmpay"); the launcher checks, and if nothing matches the
  // message simply goes to the AI.
  return rest.length <= 3 ? { kind: 'open-installed', name: phrase } : null;
}
