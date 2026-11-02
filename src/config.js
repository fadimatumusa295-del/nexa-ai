// All settings you might want to change live in this one file.

// Your Cloudflare Worker. No API keys are stored in the app: the Worker holds them.
export const BACKEND_URL = 'https://nexa-ai-brain-d61a.danbaiwa5050.workers.dev/';

// How long to wait for the AI before showing a "took too long" message.
export const REQUEST_TIMEOUT_MS = 45000;

export const DEFAULT_LANGUAGE = 'en';

// The Worker refuses a message longer than this.
export const MAX_MESSAGE_CHARS = 3000;

// How many recent chat messages are sent along with each question (the Worker keeps 12).
export const MEMORY_MESSAGES = 12;

// How many messages are kept on the phone between app restarts.
export const MEMORY_STORED_MAX = 60;

// "Remember that ..." facts kept on the phone and sent along with each question.
export const MAX_FACTS = 30;
export const FACT_MAX_CHARS = 200;

export const LANGUAGES = {
  en: {
    name: 'English',
    worker: 'en-NG', // what the Worker is told (it answers in English for anything but Hausa)
    speech: 'en-NG', // language used by the microphone (speech recognition)
    tts: ['en-US', 'en-GB', 'en'], // voices tried, in order, for reading replies aloud
  },
  ha: {
    name: 'Hausa',
    worker: 'ha-NG', // the Worker only answers in Hausa when it receives exactly "ha-NG" or "Hausa"
    speech: 'ha-NG',
    tts: ['ha-NG', 'ha'],
  },
};
