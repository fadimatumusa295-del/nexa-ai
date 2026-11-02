// "Remember that ..." facts. They stay on the phone and are sent to the AI (through the
// Worker's personalMemory) with each question, so NEXA can use them.

import { MAX_FACTS, FACT_MAX_CHARS } from './config.js';

export function cleanFact(raw, maxChars = FACT_MAX_CHARS) {
  return String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["“”'‘’]+|["“”'‘’]+$/g, '')
    .trim()
    .slice(0, maxChars)
    .trim();
}

// Adds a fact (newest last, no duplicates, oldest dropped when the list is full).
export function addFact(facts, raw, { maxFacts = MAX_FACTS } = {}) {
  const fact = cleanFact(raw);
  if (!fact) return facts;
  const rest = (facts || []).filter((f) => f.toLowerCase() !== fact.toLowerCase());
  return [...rest, fact].slice(-maxFacts);
}

export function parseFacts(json) {
  try {
    const list = JSON.parse(json);
    if (!Array.isArray(list)) return [];
    return list.filter((f) => typeof f === 'string' && f.trim()).map((f) => cleanFact(f)).slice(-MAX_FACTS);
  } catch {
    return [];
  }
}
