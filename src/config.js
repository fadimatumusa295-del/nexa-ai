// All settings you might want to change live in this one file.

// Your Cloudflare Worker. No API keys are stored in the app: the Worker holds them.
export const BACKEND_URL = 'https://nexa-ai-brain-d61a.danbaiwa5050.workers.dev/';

// How long to wait for the AI before showing a "took too long" message.
export const REQUEST_TIMEOUT_MS = 45000;

export const DEFAULT_LANGUAGE = 'en';

// Smart mode: every question is sent together with short instructions (be accurate,
// answer in the chosen language, keep it short for voice) and the recent conversation,
// so the AI can remember what was said. Set to false to send only the bare question.
export const SMART_PROMPT = true;

// How many recent chat messages are sent along with each question.
export const MEMORY_MESSAGES = 12;

// How many messages are kept on the phone between app restarts.
export const MEMORY_STORED_MAX = 60;

export const LANGUAGES = {
  en: {
    name: 'English',
    speech: 'en-NG', // language used by the microphone (speech recognition)
    tts: ['en-US', 'en-GB', 'en'], // voices tried, in order, for reading replies aloud
  },
  ha: {
    name: 'Hausa',
    speech: 'ha-NG',
    tts: ['ha-NG', 'ha'],
  },
};
