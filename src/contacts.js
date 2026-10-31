// Finds a saved contact from a spoken or typed name.

import { fold } from './text.js';

export function cleanNumber(raw) {
  const s = String(raw ?? '').trim();
  const digits = s.replace(/\D/g, '');
  if (!digits) return '';
  return (s.startsWith('+') ? '+' : '') + digits;
}

// true if a and b differ by at most one letter (typo tolerance for spoken names)
function withinOne(a, b) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else {
      i++;
      j++;
    }
  }
  if (i < a.length || j < b.length) edits++;
  return edits <= 1;
}

function score(qTokens, qFolded, nameTokens, nameFolded) {
  if (nameFolded === qFolded) return 5;
  if (qTokens.every((q) => nameTokens.includes(q))) return 4;
  if (qTokens.every((q) => nameTokens.some((n) => n.startsWith(q)))) return 3;
  if (qTokens.every((q) => (q.length >= 4 ? nameTokens.some((n) => withinOne(n, q)) : nameTokens.includes(q)))) {
    return 2;
  }
  return 0;
}

// contacts: [{ name, number }]  (one row per phone number)
// Returns { status: 'none' | 'one' | 'many', matches: [{ name, numbers: [..] }] }
export function findContacts(query, contacts) {
  const qFolded = fold(query);
  const qTokens = qFolded.split(' ').filter(Boolean);
  if (!qTokens.length) return { status: 'none', matches: [] };

  const groups = new Map();
  for (const row of contacts || []) {
    const name = String(row?.name ?? '').trim();
    const number = cleanNumber(row?.number);
    if (!name || !number) continue;
    const key = fold(name);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, { name, folded: key, numbers: [] });
    const g = groups.get(key);
    const tail = number.replace(/\D/g, '').slice(-9);
    if (!g.numbers.some((n) => n.replace(/\D/g, '').slice(-9) === tail)) g.numbers.push(number);
  }

  let best = 0;
  const scored = [];
  for (const g of groups.values()) {
    const s = score(qTokens, qFolded, g.folded.split(' ').filter(Boolean), g.folded);
    if (s > 0) scored.push([s, g]);
    if (s > best) best = s;
  }
  if (!best) return { status: 'none', matches: [] };

  const matches = scored
    .filter(([s]) => s === best)
    .map(([, g]) => ({ name: g.name, numbers: g.numbers }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { status: matches.length === 1 ? 'one' : 'many', matches };
}
