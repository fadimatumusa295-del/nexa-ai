// Run after `npx cap add android` (the GitHub build does this for you).
// It adds what the generated Android project needs:
//  1. permissions: microphone, contacts, phone calls, alarms
//  2. a <queries> block so Android 11+ lets the app see the speech service, the
//     text-to-speech service and the other apps it is asked to open
//  3. the NexaDevice helper (scripts/NexaDevicePlugin.java) and its registration
//  4. the NEXA AI launcher icon (scripts/nexa_foreground.png)
//
// Usage: node scripts/patch-android.mjs [path/to/android]      (default: android)
// Safe to run more than once.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { packageNames } from '../src/apps.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const MARKER = '<!-- NEXA-PATCH -->';

/* ------------------------------ 1 + 2: manifest ------------------------------ */

export function patchManifest(xml) {
  if (xml.includes(MARKER)) return xml; // already patched

  const packages = packageNames()
    .map((p) => `        <package android:name="${p}" />`)
    .join('\n');

  const block = `    ${MARKER}
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.READ_CONTACTS" />
    <uses-permission android:name="android.permission.CALL_PHONE" />
    <uses-permission android:name="com.android.alarm.permission.SET_ALARM" />
    <queries>
        <intent>
            <action android:name="android.speech.RecognitionService" />
        </intent>
        <intent>
            <action android:name="android.intent.action.TTS_SERVICE" />
        </intent>
        <intent>
            <action android:name="android.intent.action.MAIN" />
            <category android:name="android.intent.category.LAUNCHER" />
        </intent>
${packages}
    </queries>
`;

  const idx = xml.indexOf('<application');
  if (idx === -1) throw new Error('No <application> tag found in AndroidManifest.xml');
  const lineStart = xml.lastIndexOf('\n', idx) + 1;
  return xml.slice(0, lineStart) + block + '\n' + xml.slice(lineStart);
}

/* ------------------------------ 3: helper plugin ------------------------------ */

// Makes MainActivity register the NexaDevice helper before the app starts.
export function patchMainActivity(src) {
  if (src.includes('registerPlugin(NexaDevicePlugin.class)')) return src;

  if (/onCreate\s*\(/.test(src)) {
    const out = src.replace(
      /super\.onCreate\s*\(\s*(\w+)\s*\)\s*;/,
      'registerPlugin(NexaDevicePlugin.class);\n        super.onCreate($1);',
    );
    if (out === src) throw new Error('Could not find super.onCreate(...) in MainActivity.java');
    return out;
  }

  const empty = /public\s+class\s+MainActivity\s+extends\s+BridgeActivity\s*\{\s*\}/;
  if (!empty.test(src)) throw new Error('MainActivity.java has an unexpected layout');

  let out = src.replace(
    empty,
    `public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NexaDevicePlugin.class);
        super.onCreate(savedInstanceState);
    }
}`,
  );
  if (!/import\s+android\.os\.Bundle;/.test(out)) {
    out = out.replace(/(package\s+[\w.]+;[ \t]*\r?\n)/, '$1\nimport android.os.Bundle;\n');
  }
  return out;
}

// Gives the Java helper the same package name as the app.
export function withPackage(javaSource, appId) {
  return javaSource.replace(/^\s*package\s+[\w.]+;/m, `package ${appId};`);
}

function installPlugin(androidDir, appId) {
  const javaDir = path.join(androidDir, 'app/src/main/java', ...appId.split('.'));
  fs.mkdirSync(javaDir, { recursive: true });

  const source = fs.readFileSync(path.join(here, 'NexaDevicePlugin.java'), 'utf8');
  fs.writeFileSync(path.join(javaDir, 'NexaDevicePlugin.java'), withPackage(source, appId));

  const mainPath = path.join(javaDir, 'MainActivity.java');
  if (!fs.existsSync(mainPath)) throw new Error(`MainActivity.java not found at ${mainPath}`);
  const before = fs.readFileSync(mainPath, 'utf8');
  fs.writeFileSync(mainPath, patchMainActivity(before));
}

/* ------------------------------ 4: launcher icon ------------------------------ */

const ADAPTIVE_ICON = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/nexa_icon_background"/>
    <foreground android:drawable="@drawable/nexa_foreground"/>
</adaptive-icon>
`;

const ICON_COLORS = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="nexa_icon_background">#0A0E17</color>
</resources>
`;

export function installIcon(androidDir, pngPath) {
  if (!fs.existsSync(pngPath)) {
    console.log(`Icon not found (${pngPath}); keeping the default icon.`);
    return false;
  }
  const res = path.join(androidDir, 'app/src/main/res');
  const put = (rel, data) => {
    const file = path.join(res, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, data);
  };
  put('drawable-nodpi/nexa_foreground.png', fs.readFileSync(pngPath));
  put('values/nexa_icon_colors.xml', ICON_COLORS);
  put('mipmap-anydpi-v26/ic_launcher.xml', ADAPTIVE_ICON);
  put('mipmap-anydpi-v26/ic_launcher_round.xml', ADAPTIVE_ICON);
  return true;
}

/* ------------------------------ run ------------------------------ */

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const androidDir = process.argv[2] || 'android';
  const appId = JSON.parse(fs.readFileSync(path.join(here, '..', 'capacitor.config.json'), 'utf8')).appId;

  const manifestPath = path.join(androidDir, 'app/src/main/AndroidManifest.xml');
  const original = fs.readFileSync(manifestPath, 'utf8');
  const patched = patchManifest(original);
  fs.writeFileSync(manifestPath, patched);
  console.log(patched === original ? 'Manifest already patched.' : `Patched ${manifestPath}`);

  installPlugin(androidDir, appId);
  console.log('Installed the NexaDevice helper.');

  if (installIcon(androidDir, path.join(here, 'nexa_foreground.png'))) console.log('Installed the NEXA AI icon.');
}
