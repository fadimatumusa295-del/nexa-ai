// Run after `npx cap add android`.
// Adds what the generated Android project needs so that:
//  - the microphone permission exists,
//  - Android 11+ lets the app see the speech service, the text-to-speech service
//    and the other apps it is asked to open (the <queries> block).
//
// Usage: node scripts/patch-android.mjs [path/to/AndroidManifest.xml]
// Safe to run more than once.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { packageNames } from '../src/apps.js';

const MARKER = '<!-- NEXA-PATCH -->';

export function patchManifest(xml) {
  if (xml.includes(MARKER)) return xml; // already patched

  const packages = packageNames()
    .map((p) => `        <package android:name="${p}" />`)
    .join('\n');

  const block = `    ${MARKER}
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <queries>
        <intent>
            <action android:name="android.speech.RecognitionService" />
        </intent>
        <intent>
            <action android:name="android.intent.action.TTS_SERVICE" />
        </intent>
${packages}
    </queries>
`;

  const idx = xml.indexOf('<application');
  if (idx === -1) throw new Error('No <application> tag found in AndroidManifest.xml');
  // Insert on the line before <application> (keeps the existing indentation tidy).
  const lineStart = xml.lastIndexOf('\n', idx) + 1;
  return xml.slice(0, lineStart) + block + '\n' + xml.slice(lineStart);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const manifestPath = process.argv[2] || 'android/app/src/main/AndroidManifest.xml';
  const original = fs.readFileSync(manifestPath, 'utf8');
  const patched = patchManifest(original);
  fs.writeFileSync(manifestPath, patched);
  console.log(patched === original ? 'Manifest already patched.' : `Patched ${manifestPath}`);
}
