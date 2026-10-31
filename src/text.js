// Text clean-up helpers used by the voice command parser.

// Lower-case, remove accents, turn Hausa hooked letters into plain ones
// (ɗ->d, ɓ->b, ƙ->k, ƴ->y) and strip punctuation. "Buɗe WhatsApp!" -> "bude whatsapp".
export function fold(input) {
  return String(input ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ɗ/g, 'd')
    .replace(/ɓ/g, 'b')
    .replace(/ƙ/g, 'k')
    .replace(/ƴ/g, 'y')
    .replace(/['’‘ʼ`´]/g, '')
    .replace(/[^a-z0-9+\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Lower-case and strip punctuation but KEEP all letters (so Hausa letters survive).
export function lightClean(input) {
  return String(input ?? '')
    .toLowerCase()
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}+\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
