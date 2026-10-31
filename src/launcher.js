// Runs a phone command (open an app, dial, YouTube search).
//
// Honesty rule: a command is reported as done ONLY if Android confirmed it started.
// Otherwise the result says it failed.

import { Capacitor } from '@capacitor/core';
import { AppLauncher } from '@capacitor/app-launcher';

async function tryOpen(url) {
  try {
    const result = await AppLauncher.openUrl({ url });
    return Boolean(result && result.completed);
  } catch {
    return false;
  }
}

// Returns { ok: boolean, key: <text key in i18n.js>, params: {...} }
export async function runCommand(cmd) {
  if (!Capacitor.isNativePlatform()) {
    return { ok: false, key: 'previewNoApps', params: {} };
  }

  if (cmd.kind === 'dial') {
    const ok = await tryOpen(`tel:${cmd.number}`);
    return ok
      ? { ok: true, key: 'dialOpened', params: { number: cmd.number } }
      : { ok: false, key: 'openFailed', params: { app: 'Phone' } };
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
      if (await tryOpen(attempt)) return { ok: true, key: 'opened', params: { app: app.label } };
    }
    if (app.web && (await tryOpen(app.web))) {
      return { ok: true, key: 'openedBrowser', params: { app: app.label } };
    }
    return { ok: false, key: 'openFailed', params: { app: app.label } };
  }

  return { ok: false, key: 'openFailed', params: { app: '?' } };
}
