// Text clean-up helpers.

// Lower-case, remove accents, turn Hausa hooked letters into plain ones
// (ɗ->d, ɓ->b, ƙ->k, ƴ->y) and strip punctuation. "Buɗe WhatsApp!" -> "bude whatsapp".
// keepColon: keep ":" so times like 6:30 survive.
export function fold(input, { keepColon = false } = {}) {
  return String(input ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ɗ/g, 'd')
    .replace(/ɓ/g, 'b')
    .replace(/ƙ/g, 'k')
    .replace(/ƴ/g, 'y')
    .replace(/['’‘ʼ`´]/g, '')
    .replace(keepColon ? /[^a-z0-9+:\s]/g : /[^a-z0-9+\s]/g, ' ')
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

// Removes markdown marks (**bold**, # headings, `code`, [links](url)) so replies look
// clean and are not read aloud as "asterisk asterisk".
export function stripMarkdown(text) {
  return String(text ?? '')
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```\w*\n?/g, ''))
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    // *italic* / _italic_ : the text inside must touch the marks, so "2 * 3 = 6 and 4 * 5"
    // (maths) is left alone.
    .replace(/(^|[\s(])\*(?!\s)([^*\n]*?[^*\s])\*(?=[\s).,!?:;]|$)/g, '$1$2')
    .replace(/(^|[\s(])_(?!\s)([^_\n]*?[^_\s])_(?=[\s).,!?:;]|$)/g, '$1$2')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// The AI sometimes starts with "NEXA:" because of the conversation format. Remove that.
export function cleanReply(text) {
  return stripMarkdown(text)
    .replace(/^\s*(?:nexa(?: ai)?|assistant)\s*:\s*/i, '')
    .trim();
}
