// Phone apps the assistant can open.
//
// aliases : names people say (already "folded": lower-case, no special letters)
// attempts: tried in order. A package name (com.whatsapp) launches that app;
//           something with a colon (tel:, market://) is an Android link.
// web     : optional website opened ONLY if no installed app could be opened.
//
// Package names differ between phone brands, so several are listed for some apps.

export const APPS = [
  {
    key: 'youtube',
    label: 'YouTube',
    aliases: ['youtube', 'you tube', 'yutub', 'yutube', 'yu tub'],
    attempts: ['com.google.android.youtube', 'vnd.youtube://'],
    web: 'https://www.youtube.com',
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    aliases: ['whatsapp', 'whats app', 'watsap', 'watsapp', 'wasap', 'wattsap'],
    attempts: ['com.whatsapp'],
    web: 'https://web.whatsapp.com',
  },
  {
    key: 'contacts',
    label: 'Contacts',
    aliases: [
      'contacts', 'contact', 'my contacts', 'phonebook', 'phone book', 'address book',
      'lambobi', 'lambobin waya', 'littafin waya', 'littafin lambobi', 'jerin lambobi',
    ],
    attempts: ['com.google.android.contacts', 'com.android.contacts', 'content://contacts/people/'],
  },
  {
    key: 'phone',
    label: 'Phone',
    aliases: ['phone', 'dialer', 'dial pad', 'dialpad', 'keypad', 'phone app'],
    attempts: ['com.google.android.dialer', 'com.android.dialer', 'tel:'],
  },
  {
    key: 'messages',
    label: 'Messages',
    aliases: ['messages', 'message', 'sms', 'text messages', 'texts', 'sakonni', 'sakon'],
    attempts: [
      'com.google.android.apps.messaging',
      'com.android.mms',
      'com.samsung.android.messaging',
      'sms:',
    ],
  },
  {
    key: 'camera',
    label: 'Camera',
    aliases: ['camera', 'kyamara', 'camara'],
    attempts: [
      'com.mediatek.camera',
      'com.android.camera',
      'com.android.camera2',
      'com.google.android.GoogleCamera',
      'com.sec.android.app.camera',
    ],
  },
  {
    key: 'settings',
    label: 'Settings',
    aliases: ['settings', 'setting', 'saiti', 'saitunan waya'],
    attempts: ['com.android.settings'],
  },
  {
    key: 'facebook',
    label: 'Facebook',
    aliases: ['facebook', 'face book', 'fb'],
    attempts: ['com.facebook.katana', 'fb://'],
    web: 'https://www.facebook.com',
  },
  {
    key: 'instagram',
    label: 'Instagram',
    aliases: ['instagram', 'insta', 'ig'],
    attempts: ['com.instagram.android'],
    web: 'https://www.instagram.com',
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    aliases: ['tiktok', 'tik tok', 'tictoc'],
    attempts: ['com.zhiliaoapp.musically', 'com.ss.android.ugc.trill'],
    web: 'https://www.tiktok.com',
  },
  {
    key: 'telegram',
    label: 'Telegram',
    aliases: ['telegram', 'telegraph'],
    attempts: ['org.telegram.messenger', 'tg://'],
    web: 'https://web.telegram.org',
  },
  {
    key: 'chrome',
    label: 'Chrome',
    aliases: ['chrome', 'google chrome', 'browser', 'burauza'],
    attempts: ['com.android.chrome'],
    web: 'https://www.google.com',
  },
  {
    key: 'gmail',
    label: 'Gmail',
    aliases: ['gmail', 'email', 'mail', 'e mail', 'g mail'],
    attempts: ['com.google.android.gm'],
    web: 'https://mail.google.com',
  },
  {
    key: 'maps',
    label: 'Google Maps',
    aliases: ['maps', 'google maps', 'map', 'taswira'],
    attempts: ['com.google.android.apps.maps', 'geo:0,0'],
    web: 'https://maps.google.com',
  },
  {
    key: 'playstore',
    label: 'Play Store',
    aliases: ['play store', 'playstore', 'google play', 'app store'],
    attempts: ['com.android.vending', 'market://'],
    web: 'https://play.google.com/store',
  },
];

// Only the package-style entries (used to build the Android "queries" list).
export function packageNames() {
  const re = /^[a-z][a-z0-9_]*(\.[A-Za-z0-9_]+)+$/;
  const set = new Set();
  for (const app of APPS) {
    for (const a of app.attempts) if (re.test(a)) set.add(a);
  }
  return [...set];
}
