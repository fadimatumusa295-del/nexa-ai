// Finds an app that is really installed on the phone from the name the user said.
// This is how "open Opay", "open Moniepoint" or "open Notes" work for ANY app without
// us having to know its package name: the phone tells us its apps and their names.

import { fold } from './text.js';

function score(qTokens, qCompact, label) {
  const folded = fold(label);
  const lTokens = folded.split(' ').filter(Boolean);
  const lCompact = folded.replace(/ /g, '');
  if (!lCompact) return 0;
  if (lCompact === qCompact) return 4; // "o pay" -> OPay
  if (qTokens.every((q) => lTokens.includes(q))) return 3; // "moniepoint" -> Moniepoint Personal
  if (qCompact.length >= 4 && lCompact.startsWith(qCompact)) return 2; // "monie" -> Moniepoint
  return 0;
}

// apps: [{ label, packageName }]
// Returns { status: 'none' | 'one' | 'many', matches: [{ label, packageName }] }
export function findInstalledApps(query, apps) {
  const qFolded = fold(query);
  const qTokens = qFolded.split(' ').filter(Boolean);
  const qCompact = qFolded.replace(/ /g, '');
  if (!qCompact) return { status: 'none', matches: [] };

  const seen = new Set();
  const scored = [];
  let best = 0;
  for (const app of apps || []) {
    const label = String(app?.label ?? '').trim();
    const packageName = String(app?.packageName ?? '').trim();
    if (!label || !packageName || seen.has(packageName)) continue;
    seen.add(packageName);
    const s = score(qTokens, qCompact, label);
    if (s > 0) scored.push([s, { label, packageName }]);
    if (s > best) best = s;
  }
  if (!best) return { status: 'none', matches: [] };

  const matches = scored
    .filter(([s]) => s === best)
    .map(([, app]) => app)
    .sort((a, b) => a.label.localeCompare(b.label));
  return { status: matches.length === 1 ? 'one' : 'many', matches };
}
