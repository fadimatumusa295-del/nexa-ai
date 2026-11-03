// Runs a phone command (open an app, call, message, alarm, torch, volume ...).
//
// Honesty rule: a command is reported as done ONLY if Android accepted it.
// Otherwise the result says it failed. (Android does not tell us whether the Clock app
// really saved an alarm, or whether a message was sent, so those messages say
// "asked your Clock app" or "press send".)
//
// A result is { ok, level?, passToAi?, key, params }:
//   level 'info'  -> a neutral note (for example "which of these two did you mean?")
//   passToAi true -> this was not really a phone command, so the message goes to the AI

import { Capacitor } from '@capacitor/core';
import { AppLauncher } from '@capacitor/app-launcher';
import { NexaDevice } from './device.js'; // the Android helper in scripts/NexaDevicePlugin.java
import { findContacts, whatsappNumber } from './contacts.js';
import { findInstalledApps } from './installed.js';
import { formatDate, formatDuration, formatTime } from './time.js';

const reason = (e) => String(e?.message ?? e ?? '').toLowerCase();

async function tryOpen(url) {
  try {
    const result = await AppLauncher.openUrl({ url });
    return Boolean(result && result.completed);
  } catch {
    return false;
  }
}

async function tryNative(kind) {
  try {
    await NexaDevice.openSpecial({ kind });
    return true;
  } catch {
    return false;
  }
}

const tryAttempt = (a) => (a.startsWith('native:') ? tryNative(a.slice(7)) : tryOpen(a));

/* ------------------------- apps installed on the phone ------------------------- */

// Looks for an installed app by name and opens it.
// The list is read fresh every time, so an app installed a moment ago is found too.
// Returns { status: 'opened', label } | { status: 'many', names } | { status: 'none' }
async function openInstalled(names) {
  try {
    const res = await NexaDevice.listApps();
    const apps = res?.apps ?? [];
    for (const name of names) {
      const found = findInstalledApps(name, apps);
      if (found.status === 'one') {
        const app = found.matches[0];
        await NexaDevice.openApp({ packageName: app.packageName });
        return { status: 'opened', label: app.label };
      }
      if (found.status === 'many') {
        return { status: 'many', names: found.matches.slice(0, 4).map((m) => m.label).join(', ') };
      }
    }
  } catch {
    /* the phone could not list or open apps: treat as "not found" */
  }
  return { status: 'none' };
}

/* ------------------------------- contacts ------------------------------- */

// Finds the saved contact. Returns { person } or { fail: <result to show> }.
async function pickContact(name) {
  let contacts;
  try {
    const res = await NexaDevice.getContacts();
    contacts = res?.contacts ?? [];
  } catch (e) {
    return {
      fail: reason(e).includes('permission')
        ? { ok: false, key: 'contactsDenied', params: {} }
        : { ok: false, key: 'contactsFailed', params: {} },
    };
  }

  const found = findContacts(name, contacts);
  if (found.status === 'none') {
    return { fail: { ok: false, key: 'contactNotFound', params: { name } } };
  }
  if (found.status === 'many') {
    const names = found.matches.slice(0, 4).map((m) => m.name).join(', ');
    return { fail: { ok: false, level: 'info', key: 'contactMany', params: { names } } };
  }
  return { person: found.matches[0] };
}

async function callContact(cmd) {
  const picked = await pickContact(cmd.name);
  if (picked.fail) return picked.fail;
  const { person } = picked;
  const number = person.numbers[0];
  try {
    const res = await NexaDevice.callNumber({ number });
    return res?.mode === 'dial'
      ? { ok: true, key: 'callingDialer', params: { name: person.name } }
      : { ok: true, key: 'calling', params: { name: person.name, number } };
  } catch {
    return { ok: false, key: 'callFailed', params: { name: person.name } };
  }
}

async function callPlainNumber(number) {
  try {
    const res = await NexaDevice.callNumber({ number });
    return res?.mode === 'dial'
      ? { ok: true, key: 'dialOpened', params: { number } }
      : { ok: true, key: 'callingNumber', params: { number } };
  } catch {
    return { ok: false, key: 'callFailed', params: { name: number } };
  }
}

// WhatsApp and text messages are opened with the words already typed in. Android does not
// let an app press "send" for you, so the person always presses it.
async function messageContact(cmd) {
  const picked = await pickContact(cmd.name);
  if (picked.fail) return picked.fail;
  const { person } = picked;
  const number = person.numbers[0];
  const text = cmd.text || '';
  const enc = encodeURIComponent(text);

  if (cmd.kind === 'whatsapp') {
    const n = whatsappNumber(number);
    const ok =
      (await tryOpen(`whatsapp://send?phone=${n}${text ? `&text=${enc}` : ''}`)) ||
      (await tryOpen(`https://wa.me/${n}${text ? `?text=${enc}` : ''}`));
    return ok
      ? { ok: true, key: text ? 'whatsappOpened' : 'whatsappOpenedNoText', params: { name: person.name } }
      : { ok: false, key: 'messageFailed', params: { app: 'WhatsApp', name: person.name } };
  }

  const ok = await tryOpen(`sms:${number}${text ? `?body=${enc}` : ''}`);
  return ok
    ? { ok: true, key: text ? 'smsOpened' : 'smsOpenedNoText', params: { name: person.name } }
    : { ok: false, key: 'messageFailed', params: { app: 'Messages', name: person.name } };
}

/* ------------------------------- main entry ------------------------------- */

// ctx: { lang, now } (now is only for tests)
export async function runCommand(cmd, ctx = {}) {
  const lang = ctx.lang === 'ha' ? 'ha' : 'en';
  const now = ctx.now ?? new Date();

  // These need no phone service, so they also work in a browser preview.
  if (cmd.kind === 'time') {
    return { ok: true, key: 'timeNow', params: { time: formatTime(now.getHours(), now.getMinutes()) } };
  }
  if (cmd.kind === 'date') {
    return { ok: true, key: 'dateNow', params: { date: formatDate(now, lang) } };
  }

  if (!Capacitor.isNativePlatform()) {
    // In a browser preview "open <something>" may just be a normal question.
    if (cmd.kind === 'open-installed') return { ok: false, passToAi: true, key: '', params: {} };
    return { ok: false, key: 'previewNoApps', params: {} };
  }

  if (cmd.kind === 'dial') return callPlainNumber(cmd.number);

  if (cmd.kind === 'call-contact') return callContact(cmd);

  if (cmd.kind === 'whatsapp' || cmd.kind === 'sms') return messageContact(cmd);

  if (cmd.kind === 'alarm-help') {
    return { ok: false, level: 'info', key: 'askAlarmTime', params: {} };
  }

  if (cmd.kind === 'alarm') {
    try {
      await NexaDevice.setAlarm({ hour: cmd.hour, minutes: cmd.minutes });
      return { ok: true, key: 'alarmSent', params: { time: formatTime(cmd.hour, cmd.minutes) } };
    } catch {
      return { ok: false, key: 'alarmFailed', params: {} };
    }
  }

  if (cmd.kind === 'timer') {
    try {
      await NexaDevice.setTimer({ seconds: cmd.seconds });
      return { ok: true, key: 'timerSent', params: { duration: formatDuration(cmd.seconds) } };
    } catch {
      return { ok: false, key: 'timerFailed', params: {} };
    }
  }

  if (cmd.kind === 'torch') {
    try {
      await NexaDevice.setTorch({ on: cmd.on });
      return { ok: true, key: cmd.on ? 'torchOn' : 'torchOff', params: {} };
    } catch {
      return { ok: false, key: 'torchFailed', params: {} };
    }
  }

  if (cmd.kind === 'volume') {
    try {
      const res = await NexaDevice.changeVolume({ action: cmd.action });
      const key = { up: 'volumeUp', down: 'volumeDown', max: 'volumeMax', mute: 'volumeMute' }[cmd.action];
      return { ok: true, key, params: { level: res?.level ?? '?', max: res?.max ?? '?' } };
    } catch {
      return { ok: false, key: 'volumeFailed', params: {} };
    }
  }

  if (cmd.kind === 'battery') {
    try {
      const res = await NexaDevice.getBattery();
      const percent = Number(res?.percent);
      if (!Number.isFinite(percent) || percent < 0) throw new Error('no-battery');
      return { ok: true, key: res?.charging ? 'batteryCharging' : 'battery', params: { percent: Math.round(percent) } };
    } catch {
      return { ok: false, key: 'batteryFailed', params: {} };
    }
  }

  if (cmd.kind === 'read-sms' || cmd.kind === 'missed-calls') {
    const sms = cmd.kind === 'read-sms';
    let res;
    try {
      res = sms ? await NexaDevice.readSms({ count: 3 }) : await NexaDevice.getMissedCalls({ count: 5 });
    } catch (e) {
      const denied = /permission/i.test(String(e?.message ?? e));
      const base = sms ? 'sms' : 'calls';
      return { ok: false, key: denied ? `${base}Denied` : `${base}Failed`, params: {} };
    }
    const items = Array.isArray(res?.items) ? res.items : [];
    if (!items.length) return { ok: true, level: 'info', speak: true, key: sms ? 'smsNone' : 'callsNone', params: {} };
    const list = items
      .map((it) => {
        const when = formatWhen(it.date, ctx?.lang);
        const who = String(it.from || '?');
        return sms
          ? `${who}${when ? ` (${when})` : ''}: ${String(it.body || '').trim().slice(0, 300)}`
          : `${who}${when ? ` (${when})` : ''}`;
      })
      .join('\n');
    return { ok: true, level: 'info', speak: true, key: sms ? 'smsList' : 'callsList', params: { list } };
  }

  if (cmd.kind === 'settings-page') {
    const ok = await tryNative(cmd.page);
    if (!ok) return { ok: false, key: 'settingsFailed', params: { page: cmd.label } };
    return { ok: true, key: cmd.on === null ? 'settingsOpened' : 'settingsNoToggle', params: { page: cmd.label } };
  }

  if (cmd.kind === 'navigate') {
    const enc = encodeURIComponent(cmd.place);
    const ok =
      (await tryOpen(`google.navigation:q=${enc}`)) ||
      (await tryOpen(`https://www.google.com/maps/dir/?api=1&destination=${enc}`));
    return ok
      ? { ok: true, key: 'navigating', params: { place: cmd.place } }
      : { ok: false, key: 'navigateFailed', params: { place: cmd.place } };
  }

  if (cmd.kind === 'web-search') {
    const ok = await tryOpen(`https://www.google.com/search?q=${encodeURIComponent(cmd.query)}`);
    return ok
      ? { ok: true, key: 'searchOpened', params: { query: cmd.query } }
      : { ok: false, key: 'searchFailed', params: {} };
  }

  if (cmd.kind === 'youtube-search') {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(cmd.query)}`;
    const ok = await tryOpen(url);
    return ok
      ? { ok: true, key: 'youtubeSearch', params: { query: cmd.query } }
      : { ok: false, key: 'openFailed', params: { app: 'YouTube' } };
  }

  if (cmd.kind === 'open-app') {
    const { app } = cmd;
    for (const attempt of app.attempts) {
      if (await tryAttempt(attempt)) return { ok: true, key: 'opened', params: { app: app.label } };
    }
    // Known package names differ between phone brands, so also look the app up by name.
    const byName = await openInstalled(app.find ?? [app.label]);
    if (byName.status === 'opened') return { ok: true, key: 'opened', params: { app: byName.label } };
    if (byName.status === 'many') return { ok: false, level: 'info', key: 'appMany', params: { names: byName.names } };

    if (app.web && (await tryOpen(app.web))) {
      return { ok: true, key: 'openedBrowser', params: { app: app.label } };
    }
    return { ok: false, key: 'openFailed', params: { app: app.label } };
  }

  if (cmd.kind === 'open-installed') {
    const byName = await openInstalled([cmd.name]);
    if (byName.status === 'opened') return { ok: true, key: 'opened', params: { app: byName.label } };
    if (byName.status === 'many') return { ok: false, level: 'info', key: 'appMany', params: { names: byName.names } };
    // No installed app has that name: it was probably a normal question.
    return { ok: false, passToAi: true, key: '', params: {} };
  }

  return { ok: false, key: 'openFailed', params: { app: '?' } };
}

// "14:05" for today, otherwise "3 Nov". Empty when the date is unknown.
function formatWhen(ms, lang) {
  const d = new Date(Number(ms));
  if (!Number.isFinite(d.getTime())) return '';
  const now = new Date();
  const locale = lang === 'ha' ? 'ha-NG' : 'en-NG';
  const sameDay = d.toDateString() === now.toDateString();
  try {
    return sameDay
      ? d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}
