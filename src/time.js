// Understands alarm and timer requests in English and Hausa.
//   "set alarm for 6:30 am"   "wake me up at 5"   "saita alarm karfe 6 na safe"
//   "wake me in 30 minutes"   "set a timer for 10 minutes"

import { fold } from './text.js';

const NUMBER_WORDS = [
  [/\bhalf an hour\b/g, '30 minutes'],
  [/\ban hour\b/g, '1 hour'],
  [/\bsha daya\b/g, '11'],
  [/\bsha biyu\b/g, '12'],
  [/\bforty five\b/g, '45'],
  [/\bone\b/g, '1'], [/\btwo\b/g, '2'], [/\bthree\b/g, '3'], [/\bfour\b/g, '4'],
  [/\bfive\b/g, '5'], [/\bsix\b/g, '6'], [/\bseven\b/g, '7'], [/\beight\b/g, '8'],
  [/\bnine\b/g, '9'], [/\bten\b/g, '10'], [/\beleven\b/g, '11'], [/\btwelve\b/g, '12'],
  [/\bfifteen\b/g, '15'], [/\btwenty\b/g, '20'], [/\bthirty\b/g, '30'],
  [/\bforty\b/g, '40'], [/\bfifty\b/g, '50'],
  // Hausa
  [/\bdaya\b/g, '1'], [/\bbiyu\b/g, '2'], [/\buku\b/g, '3'], [/\bhudu\b/g, '4'],
  [/\bbiyar\b/g, '5'], [/\bshida\b/g, '6'], [/\bbakwai\b/g, '7'], [/\btakwas\b/g, '8'],
  [/\btara\b/g, '9'], [/\bgoma\b/g, '10'],
];

function prep(text) {
  let s = String(text ?? '').toLowerCase().replace(/\b([ap])\.\s?m\.?/g, '$1m');
  s = fold(s, { keepColon: true });
  for (const [re, rep] of NUMBER_WORDS) s = s.replace(re, rep);
  s = s
    .replace(/\bhalf past (\d{1,2})\b/g, '$1:30')
    .replace(/\bquarter past (\d{1,2})\b/g, '$1:15')
    .replace(/\boclock\b/g, '');
  return s.replace(/\s+/g, ' ').trim();
}

const ALARM_WORDS = new Set(['alarm', 'alarms', 'alaram', 'kararrawa']);
const ALARM_VERBS = new Set(['set', 'create', 'add', 'make', 'put', 'schedule', 'saita', 'kafa', 'sa']);
const TIMER_WORDS = new Set(['timer', 'countdown', 'kidaya']);
const TIMER_VERBS = new Set(['set', 'start', 'create', 'make', 'begin', 'saita', 'fara', 'kafa', 'sa']);

function unitSeconds(word) {
  if (/^(?:h|hr|hrs|hour|hours|saa|awa|awanni)$/.test(word)) return 3600;
  if (/^(?:m|min|mins|minute|minutes|minti|mintuna|mintina)$/.test(word)) return 60;
  if (/^(?:s|sec|secs|second|seconds|dakika|dakiku|sakan|sakanni)$/.test(word)) return 1;
  return 0;
}

export function parseDurationSeconds(s) {
  let total = 0;
  for (const m of String(s).matchAll(/(\d+(?:\.\d+)?)\s*([a-z]+)/g)) {
    total += Number(m[1]) * unitSeconds(m[2]);
  }
  // Hausa often puts the unit first: "minti 10"
  for (const m of String(s).matchAll(/\b(minti|mintuna|mintina|awa|awanni|saa|dakika|sakan)\s+(\d+(?:\.\d+)?)/g)) {
    total += Number(m[2]) * unitSeconds(m[1]);
  }
  return Math.round(total);
}

function periodFromWords(s) {
  if (/\b(?:night|tonight|dare)\b/.test(s)) return 'night';
  if (/\b(?:morning|safe|asuba|dawn)\b/.test(s)) return 'am';
  if (/\b(?:afternoon|evening|yamma|rana|magariba|laasar)\b/.test(s)) return 'pm';
  return null;
}

// Works out the 24-hour hour. With no am/pm it picks whichever of the two options
// (e.g. 6 am or 6 pm) comes next from now.
function resolveHour(h, minutes, period, now) {
  if (h === 24) return 0;
  if (h > 12 || h === 0) return h;
  if (period === 'am') return h % 12;
  if (period === 'pm') return h === 12 ? 12 : h + 12;
  if (period === 'night') {
    if (h === 12) return 0;
    return h <= 5 ? h : h + 12;
  }
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const away = (hour) => {
    const d = (hour * 60 + minutes - nowMin + 1440) % 1440;
    return d === 0 ? 1440 : d;
  };
  const a = h % 12;
  const b = a + 12;
  return away(a) <= away(b) ? a : b;
}

// Returns { kind: 'alarm', hour, minutes } | { kind: 'alarm-help' } | null
export function parseAlarm(text, now = new Date()) {
  const s = prep(text);
  const tokens = s.split(' ');
  const hasAlarmWord = tokens.some((t) => ALARM_WORDS.has(t));
  const wake = /\b(?:wake me|tashe ni|tada ni|tashi ni)\b/.test(s);
  if (!hasAlarmWord && !wake) return null;
  if (!wake && !tokens.some((t) => ALARM_VERBS.has(t)) && !ALARM_WORDS.has(tokens[0])) return null;

  const rel = s.match(/\b(?:in|nan da|bayan)\s+((?:\d+(?:\.\d+)?\s*[a-z]+\s*)+)/);
  if (rel) {
    const secs = parseDurationSeconds(rel[1]);
    if (secs > 0) {
      const t = new Date(now.getTime() + secs * 1000);
      return { kind: 'alarm', hour: t.getHours(), minutes: t.getMinutes() };
    }
  }

  const m = s.match(/(?:^|\s)(\d{1,2})(?::(\d{2})|\s(\d{2})(?=\s|$))?(?:\s*(am|pm))?(?=\s|$)/);
  if (!m) return { kind: 'alarm-help' };
  const h = Number(m[1]);
  const minutes = Number(m[2] ?? m[3] ?? 0);
  if (h > 24 || minutes > 59) return { kind: 'alarm-help' };
  const period = m[4] || periodFromWords(s);
  return { kind: 'alarm', hour: resolveHour(h, minutes, period, now), minutes };
}

// Returns { kind: 'timer', seconds } or null
export function parseTimer(text) {
  const s = prep(text);
  const tokens = s.split(' ');
  if (!tokens.some((t) => TIMER_WORDS.has(t))) return null;
  if (!tokens.some((t) => TIMER_VERBS.has(t))) return null;
  const seconds = parseDurationSeconds(s);
  if (seconds <= 0) return null;
  return { kind: 'timer', seconds: Math.min(seconds, 86400) };
}

export function formatTime(hour, minutes) {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minutes).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}

export function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts = [];
  if (h) parts.push(`${h} hour${h === 1 ? '' : 's'}`);
  if (m) parts.push(`${m} minute${m === 1 ? '' : 's'}`);
  if (s) parts.push(`${s} second${s === 1 ? '' : 's'}`);
  return parts.join(' ') || '0 seconds';
}
