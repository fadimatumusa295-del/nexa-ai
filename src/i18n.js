// All text shown in the app, in English (en) and Hausa (ha).
// {name} parts are filled in by t(). Hausa wording is a first draft: please correct
// anything that does not sound natural.

export const STRINGS = {
  en: {
    tagline: 'Your voice assistant',
    voiceReplies: 'Voice replies',
    placeholder: 'Type a message…',
    send: 'Send',
    micLabel: 'Speak',
    micStopLabel: 'Stop listening',
    speakLabel: 'Repeat last reply',
    speakStopLabel: 'Stop speaking',
    greeting:
      'Hello! I’m NEXA AI. Type a message or tap the microphone and ask me anything. You can also say “open YouTube” or “open WhatsApp”.',
    listening: 'Listening… speak now',
    thinking: 'Thinking…',
    micUnavailable: 'Speech recognition isn’t available on this device.',
    micDenied:
      'Microphone permission was denied. Allow it in Settings > Apps > NEXA AI > Permissions.',
    noSpeech: 'I didn’t hear anything. Tap the microphone and try again.',
    micFailed: 'Speech recognition failed. Please try again.',
    networkError: 'I couldn’t reach the AI. Check your internet connection and try again.',
    timeout: 'The AI took too long to answer. Please try again.',
    backendError: 'The AI service returned an error (code {code}).',
    badFormat: 'The AI replied in a format I couldn’t read.',
    emptyReply: 'The AI returned an empty answer.',
    ttsUnsupported:
      'This phone has no {language} voice installed, so I can’t read replies aloud in this language.',
    ttsFailed: 'I couldn’t read the reply aloud.',
    nothingToRepeat: 'There is no reply to repeat yet.',
    opened: 'Opened {app}.',
    openedBrowser: '{app} isn’t installed or couldn’t be opened, so I opened its website instead.',
    openFailed: 'I couldn’t open {app} on this phone.',
    dialOpened: 'Opened the phone dialer with {number}. Press call to dial.',
    youtubeSearch: 'Opened YouTube search for “{query}”.',
    previewNoApps:
      'Opening phone apps only works in the installed Android app, not in the browser preview.',
  },
  ha: {
    tagline: 'Mataimakinka na murya',
    voiceReplies: 'Amsa da murya',
    placeholder: 'Rubuta saƙo…',
    send: 'Aika',
    micLabel: 'Yi magana',
    micStopLabel: 'Daina sauraro',
    speakLabel: 'Maimaita amsar ƙarshe',
    speakStopLabel: 'Daina magana',
    greeting:
      'Sannu! Ni ce NEXA AI. Rubuta saƙo ko ka danna makirufo ka tambaye ni kowace tambaya. Kana iya cewa “bude YouTube” ko “bude WhatsApp”.',
    listening: 'Ina sauraro… yi magana yanzu',
    thinking: 'Ina tunani…',
    micUnavailable: 'Gane murya ba ya samuwa a wannan wayar.',
    micDenied:
      'An hana izinin makirufo. Ka ba da izini a Settings > Apps > NEXA AI > Permissions.',
    noSpeech: 'Ban ji komai ba. Danna makirufo ka sake gwadawa.',
    micFailed: 'Gane murya ya gaza. Ka sake gwadawa.',
    networkError: 'Ban iya haɗuwa da AI ba. Duba intanet ɗinka ka sake gwadawa.',
    timeout: 'AI ya ɗauki lokaci mai tsawo kafin ya amsa. Ka sake gwadawa.',
    backendError: 'Sabis ɗin AI ya dawo da kuskure (lamba {code}).',
    badFormat: 'AI ya amsa ta wata hanya da ban iya karantawa ba.',
    emptyReply: 'AI ya dawo da amsa mara komai.',
    ttsUnsupported:
      'Wannan wayar ba ta da muryar {language}, don haka ba zan iya karanta amsoshi da murya a wannan harshen ba.',
    ttsFailed: 'Ban iya karanta amsar da murya ba.',
    nothingToRepeat: 'Babu amsar da za a maimaita tukuna.',
    opened: 'An buɗe {app}.',
    openedBrowser: '{app} ba a sanya shi ba ko kuma ban iya buɗe shi ba, don haka na buɗe shafinsa.',
    openFailed: 'Ban iya buɗe {app} a wannan wayar ba.',
    dialOpened: 'An buɗe wayar da lamba {number}. Danna kira don yin kiran.',
    youtubeSearch: 'An buɗe binciken YouTube na “{query}”.',
    previewNoApps:
      'Buɗe manhajojin waya yana aiki ne kawai a manhajar Android da aka sanya, ba a samfurin burauza ba.',
  },
};

export function t(lang, key, params = {}) {
  const table = STRINGS[lang] || STRINGS.en;
  const template = table[key] ?? STRINGS.en[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name) => (name in params ? String(params[name]) : `{${name}}`));
}
