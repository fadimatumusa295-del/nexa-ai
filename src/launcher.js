// Runs a phone command (open an app, call, alarm, timer, YouTube search).
//
// Honesty rule: a command is reported as done ONLY if Android accepted it.
// Otherwise the result says it failed. (Android does not tell us whether the Clock app
// really saved an alarm, so alarm/timer messages say "asked your Clock app".)
//
// A result is { ok, level?, passToAi?, key, params }:
//   level 'info'  -> a neutral note (for example "which of these two did you mean?")
//   passToAi true -> this was not really a phone command, so the message goes to the AI

import { Capacitor, registerPlugin } from '@capacitor/core';
import { AppLauncher } from '@capacitor/app-launcher';
import { findContacts } from './contacts.js';
import { findInstalledApps } from './installed.js';
import { formatDuration, formatTime } from './time.js';

// Small Android helper written in scripts/NexaDevicePlugin.java
const NexaDevice = registerPlugin('NexaDevice');

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

/* ------------------------------- calling ------------------------------- */

async function callContact(cmd) {
  let contacts;
  try {
    const res = await NexaDevice.getContacts();
    contacts = res?.contacts ?? [];
  } catch (e) {
    return reason(e).includes('permission')
      ? { ok: false, key: 'contactsDenied', params: {} }
      : { ok: false, key: 'contactsFailed', params: {} };
  }

  const found = findContacts(cmd.name, contacts);
  if (found.status === 'none') {
    return { ok: false, key: 'contactNotFound', params: { name: cmd.name } };
  }
  if (found.status === 'many') {
    const names = found.matches.slice(0, 4).map((m) => m.name).join(', ');
    return { ok: false, level: 'info', key: 'contactMany', params: { names } };
  }

  const person = found.matches[0];
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

/* ------------------------------- main entry ------------------------------- */

export async function runCommand(cmd) {
  if (!Capacitor.isNativePlatform()) {
    // In a browser preview "open <something>" may just be a normal question.
    if (cmd.kind === 'open-installed') return { ok: false, passToAi: true, key: '', params: {} };
    return { ok: false, key: 'previewNoApps', params: {} };
  }

  if (cmd.kind === 'dial') return callPlainNumber(cmd.number);

  if (cmd.kind === 'call-contact') return callContact(cmd);

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
