// All settings you might want to change live in this one file.

// Your Cloudflare Worker. No API keys are stored in the app: the Worker holds them.
export const BACKEND_URL = 'https://nexa-ai-brain-d61a.danbaiwa5050.workers.dev/';

// How long to wait for the AI before showing a "took too long" message.
export const REQUEST_TIMEOUT_MS = 30000;

export const DEFAULT_LANGUAGE = 'en';

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
