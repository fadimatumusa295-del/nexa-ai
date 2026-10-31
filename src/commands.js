// Turns what the user said or typed into a phone command, or null if it is
// just a normal question (null => the message goes to the AI backend).
//
// Understood (English and Hausa, either language works in either mode):
//   open <app>                 bude <app>          buɗe <app>
//   search YouTube for X       nemi X a YouTube
//   call 08012345678           kira 08012345678    (a number)
//   call Musa                  kira Musa           (a saved contact)
//   set alarm for 6:30 am      saita alarm karfe 6 na safe     wake me up at 5
//   set a timer for 10 minutes

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

function parseCall(restTokens) {
  const joined = restTokens.join('');
  if (/^\+?\d{5,15}$/.test(joined)) return { kind: 'dial', number: joined };

  let rest = [...restTokens];
  while (rest.length && NAME_LEAD_STRIP.has(rest[0])) rest.shift();
  while (rest.length && TRAIL_STRIP.has(rest[rest.length - 1])) rest.pop();
  if (!rest.length || rest.length > 4) return null;
  if (NOT_A_NAME.has(rest[0])) return null;
  if (rest.every((t) => /^\d+$/.test(t))) return null; // a too-short number, not a name
  return { kind: 'call-contact', name: rest.join(' ') };
}

export function parseCommand(text, now = new Date()) {
  const light = lightClean(text);
  if (!light) return null;

  const yt = parseYoutubeSearch(light);
  if (yt) return yt;

  const alarm = parseAlarm(text, now);
  if (alarm) return alarm;
  const timer = parseTimer(text);
  if (timer) return timer;

  let tokens = fold(text).split(' ').filter(Boolean);
  let i = 0;
  while (i < tokens.length && FILLERS.has(tokens[i])) i++;
  tokens = tokens.slice(i);
  if (tokens.length < 2) return null;

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
