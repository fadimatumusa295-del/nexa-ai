// Microphone (speech recognition) and speaker (text-to-speech).
// On the installed Android app this uses the phone's own speech services.
// In a desktop browser preview it falls back to the browser's built-in versions.

import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { LANGUAGES } from './config.js';

export class VoiceError extends Error {
  // code: 'unavailable' | 'permission' | 'no-speech' | 'failed'
  constructor(code) {
    super(code);
    this.name = 'VoiceError';
    this.code = code;
  }
}

function mapNativeError(e) {
  const msg = String(e?.message ?? e ?? '').toLowerCase();
  if (/permission|denied|not.?allowed/.test(msg)) return new VoiceError('permission');
  if (/no match|no speech|speech timeout|timeout|nothing/.test(msg)) return new VoiceError('no-speech');
  if (/not available|unavailable|not supported/.test(msg)) return new VoiceError('unavailable');
  return new VoiceError('failed');
}

/* ---------------------------- Listening ---------------------------- */

let webRecognizer = null;

function webListen(lang) {
  return new Promise((resolve, reject) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return reject(new VoiceError('unavailable'));
    const rec = new SR();
    webRecognizer = rec;
    rec.lang = LANGUAGES[lang].speech;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => resolve(e.results?.[0]?.[0]?.transcript ?? '');
    rec.onerror = (e) => {
      const err = e.error;
      if (err === 'not-allowed' || err === 'service-not-allowed') reject(new VoiceError('permission'));
      else if (err === 'no-speech') reject(new VoiceError('no-speech'));
      else if (err === 'audio-capture') reject(new VoiceError('unavailable'));
      else reject(new VoiceError('failed'));
    };
    rec.onend = () => reject(new VoiceError('no-speech')); // ignored if a result already arrived
    try {
      rec.start();
    } catch {
      reject(new VoiceError('failed'));
    }
  });
}

// Listens once and returns the recognised text. Throws VoiceError.
export async function listen(lang) {
  if (!Capacitor.isNativePlatform()) {
    const text = (await webListen(lang)).trim();
    if (!text) throw new VoiceError('no-speech');
    return text;
  }

  let availability;
  try {
    availability = await SpeechRecognition.available();
  } catch {
    throw new VoiceError('unavailable');
  }
  if (!availability?.available) throw new VoiceError('unavailable');

  try {
    let perm = await SpeechRecognition.checkPermissions();
    if (perm.speechRecognition !== 'granted') {
      perm = await SpeechRecognition.requestPermissions();
    }
    if (perm.speechRecognition !== 'granted') throw new VoiceError('permission');
  } catch (e) {
    if (e instanceof VoiceError) throw e;
    throw new VoiceError('permission');
  }

  let result;
  try {
    result = await SpeechRecognition.start({
      language: LANGUAGES[lang].speech,
      maxResults: 1,
      prompt: '',
      partialResults: false,
      popup: false,
    });
  } catch (e) {
    throw mapNativeError(e);
  }
  const text = String(result?.matches?.[0] ?? '').trim();
  if (!text) throw new VoiceError('no-speech');
  return text;
}

export async function stopListening() {
  try {
    if (Capacitor.isNativePlatform()) await SpeechRecognition.stop();
    else if (webRecognizer) webRecognizer.stop();
  } catch {
    /* nothing to stop */
  }
}

/* ---------------------------- Speaking ---------------------------- */

// Returns { ok: true } or { ok: false, reason: 'unsupported' | 'failed' }.
export async function speak(text, lang) {
  const candidates = LANGUAGES[lang].tts;
  let chosen = null;
  for (const tag of candidates) {
    try {
      const { supported } = await TextToSpeech.isLanguageSupported({ lang: tag });
      if (supported) {
        chosen = tag;
        break;
      }
    } catch {
      /* try the next tag */
    }
  }
  if (!chosen) return { ok: false, reason: 'unsupported' };

  try {
    await TextToSpeech.stop();
  } catch {
    /* nothing was playing */
  }
  try {
    await TextToSpeech.speak({
      text,
      lang: chosen,
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0,
      category: 'ambient',
    });
    return { ok: true };
  } catch {
    // stop() also lands here: treat it as a normal end, not an error.
    return { ok: true };
  }
}

export async function stopSpeaking() {
  try {
    await TextToSpeech.stop();
  } catch {
    /* nothing to stop */
  }
}
