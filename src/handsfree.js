// Hands-free mode. A small Android service (scripts/NexaListenService.java) keeps listening
// for "Nexa ..." while the app is closed. When it hears a command it brings NEXA to the front
// and the words arrive here, to run exactly like a typed message.

import { Capacitor } from '@capacitor/core';
import { NexaDevice } from './device.js';
import { LANGUAGES } from './config.js';

const reason = (e) => String(e?.message ?? e ?? '').toLowerCase();

// { supported, running, overlay }
// supported is false in a browser preview, or on an older build without the helper.
// overlay says whether "Display over other apps" is allowed (Android needs it so that the
// service may open apps while NEXA is closed).
export async function handsFreeStatus() {
  if (!Capacitor.isNativePlatform()) return { supported: false, running: false, overlay: false };
  try {
    const res = await NexaDevice.handsFreeStatus();
    return { supported: true, running: Boolean(res?.running), overlay: Boolean(res?.overlay) };
  } catch {
    return { supported: false, running: false, overlay: false };
  }
}

// Starts the listening service (or restarts it, to change the language).
// texts: { title, text, stop } for the notification.
// Returns { ok: true } or { ok: false, reason: 'mic' | 'overlay' | 'recognizer' | 'failed' }.
export async function startHandsFree(lang, texts) {
  try {
    await NexaDevice.startHandsFree({
      language: LANGUAGES[lang]?.speech ?? 'en-NG',
      title: texts.title,
      text: texts.text,
      stop: texts.stop,
    });
    return { ok: true };
  } catch (e) {
    const why = reason(e);
    if (why.includes('mic')) return { ok: false, reason: 'mic' };
    if (why.includes('overlay')) return { ok: false, reason: 'overlay' };
    if (why.includes('recognizer')) return { ok: false, reason: 'recognizer' };
    return { ok: false, reason: 'failed' };
  }
}

export async function stopHandsFree() {
  try {
    await NexaDevice.stopHandsFree();
    return true;
  } catch {
    return false;
  }
}

export async function openOverlaySettings() {
  try {
    await NexaDevice.openOverlaySettings();
    return true;
  } catch {
    return false;
  }
}

export async function openBatterySettings() {
  try {
    await NexaDevice.openBatterySettings();
    return true;
  } catch {
    return false;
  }
}

// callback(text) runs for every command the service heard. It also runs for the command that
// started NEXA when the app was fully closed.
export async function onHandsFreeCommand(callback) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await NexaDevice.addListener('handsFreeCommand', (event) => {
      const text = String(event?.text ?? '').trim();
      if (text) callback(text);
    });
  } catch {
    /* an older build without the helper: nothing to listen to */
  }
}
