// Phone apps the assistant can open.
//
// aliases : names people say (already "folded": lower-case, no special letters)
// attempts: tried in order. A package name (com.whatsapp) launches that app;
//           something with a colon (tel:, market://) is an Android link;
//           "native:xxx" asks Android itself for the phone's default app of that kind
//           (works whatever brand the phone is).
// find    : optional names to look for among the apps installed on the phone when none of
//           the attempts worked (default: the label).
// web     : optional page opened ONLY if no installed app could be opened.
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
    key: 'clock',
    label: 'Clock',
    aliases: [
      'clock', 'alarm', 'alarms', 'alarm clock', 'clock app', 'alarm app', 'watch', 'agogo', 'kararrawa',
    ],
    attempts: [
      'native:alarms',
      'com.google.android.deskclock',
      'com.android.deskclock',
      'com.sec.android.app.clockpackage',
      'com.transsion.deskclock',
    ],
  },
  {
    key: 'calculator',
    label: 'Calculator',
    aliases: ['calculator', 'calc', 'calculater', 'kalkuleta', 'lissafi'],
    attempts: [
      'native:calculator',
      'com.google.android.calculator',
      'com.android.calculator2',
      'com.sec.android.app.popupcalculator',
      'com.miui.calculator',
      'com.transsion.calculator',
    ],
  },
  {
    key: 'files',
    label: 'Files',
    find: ['files', 'file manager', 'my files'],
    aliases: [
      'files', 'file manager', 'file manager app', 'my files', 'files app', 'file explorer',
      'file', 'fayil', 'fayiloli', 'manajan fayil',
    ],
    attempts: [
      'com.google.android.apps.nbu.files',
      'com.android.documentsui',
      'com.google.android.documentsui',
      'com.sec.android.app.myfiles',
      'com.mi.android.globalFileexplorer',
      'com.transsion.filemanager',
      'native:files',
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
    key: 'opay',
    label: 'OPay',
    aliases: ['opay', 'o pay', 'opay app', 'opei', 'opey'],
    attempts: ['team.opay.pay'],
    // If the package above is wrong for this phone, the app is found by its name instead.
    web: 'https://play.google.com/store/search?q=opay&c=apps',
  },
  {
    key: 'moniepoint',
    label: 'Moniepoint',
    aliases: ['moniepoint', 'monie point', 'money point', 'moniepoint app', 'monipoint'],
    attempts: ['com.moniepoint.personal'],
    web: 'https://play.google.com/store/search?q=moniepoint&c=apps',
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
    key: 'music',
    label: 'Music',
    find: ['music', 'boomplay', 'spotify', 'audiomack'],
    aliases: ['music', 'music app', 'songs', 'song app', 'kiɗa', 'kida', 'waka', 'player', 'music player'],
    attempts: ['com.spotify.music', 'com.afmobi.boomplayer', 'com.audiomack', 'com.google.android.apps.youtube.music'],
  },
  {
    key: 'spotify',
    label: 'Spotify',
    aliases: ['spotify', 'spotifai'],
    attempts: ['com.spotify.music'],
    web: 'https://open.spotify.com',
  },
  {
    key: 'boomplay',
    label: 'Boomplay',
    aliases: ['boomplay', 'boom play', 'boomplei'],
    attempts: ['com.afmobi.boomplayer'],
    web: 'https://www.boomplay.com',
  },
  {
    key: 'audiomack',
    label: 'Audiomack',
    aliases: ['audiomack', 'audio mack'],
    attempts: ['com.audiomack'],
    web: 'https://audiomack.com',
  },
  {
    key: 'ytmusic',
    label: 'YouTube Music',
    aliases: ['youtube music', 'you tube music', 'yt music'],
    attempts: ['com.google.android.apps.youtube.music'],
    web: 'https://music.youtube.com',
  },
  {
    key: 'gallery',
    label: 'Gallery',
    find: ['gallery', 'photos'],
    aliases: ['gallery', 'photos', 'photo', 'pictures', 'images', 'google photos', 'hotuna', 'gallery app'],
    attempts: [
      'com.google.android.apps.photos',
      'com.gallery20',
      'com.transsion.gallery',
      'com.android.gallery3d',
      'com.sec.android.gallery3d',
    ],
  },
  {
    key: 'calendar',
    label: 'Calendar',
    aliases: ['calendar', 'kalanda', 'kalandar', 'calendar app'],
    attempts: ['com.google.android.calendar', 'com.android.calendar', 'com.samsung.android.calendar'],
  },
  {
    key: 'palmpay',
    label: 'PalmPay',
    aliases: ['palmpay', 'palm pay', 'palmpei'],
    attempts: ['com.transsnet.palmpay'],
    web: 'https://play.google.com/store/search?q=palmpay&c=apps',
  },
  {
    key: 'kuda',
    label: 'Kuda',
    aliases: ['kuda', 'kuda bank', 'kuda app'],
    attempts: ['com.kudabank.app'],
    web: 'https://play.google.com/store/search?q=kuda&c=apps',
  },
  {
    key: 'twitter',
    label: 'X (Twitter)',
    aliases: ['twitter', 'x', 'tweeter', 'x app'],
    attempts: ['com.twitter.android'],
    web: 'https://x.com',
  },
  {
    key: 'messenger',
    label: 'Messenger',
    aliases: ['messenger', 'facebook messenger', 'fb messenger'],
    attempts: ['com.facebook.orca'],
    web: 'https://www.messenger.com',
  },
  {
    key: 'snapchat',
    label: 'Snapchat',
    aliases: ['snapchat', 'snap chat', 'snap'],
    attempts: ['com.snapchat.android'],
    web: 'https://www.snapchat.com',
  },
  {
    key: 'netflix',
    label: 'Netflix',
    aliases: ['netflix', 'net flix'],
    attempts: ['com.netflix.mediaclient'],
    web: 'https://www.netflix.com',
  },
  {
    key: 'truecaller',
    label: 'Truecaller',
    aliases: ['truecaller', 'true caller'],
    attempts: ['com.truecaller'],
    web: 'https://www.truecaller.com',
  },
  {
    key: 'drive',
    label: 'Google Drive',
    aliases: ['drive', 'google drive'],
    attempts: ['com.google.android.apps.docs'],
    web: 'https://drive.google.com',
  },
  {
    key: 'translate',
    label: 'Google Translate',
    aliases: ['translate', 'google translate', 'translator'],
    attempts: ['com.google.android.apps.translate'],
    web: 'https://translate.google.com',
  },
  {
    key: 'zoom',
    label: 'Zoom',
    aliases: ['zoom'],
    attempts: ['us.zoom.videomeetings'],
    web: 'https://zoom.us',
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
