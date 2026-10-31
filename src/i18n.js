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
      'Hello! I’m NEXA AI. Type a message or tap the microphone and ask me anything. You can also say “open YouTube”, “call Musa” or “set alarm for 6:30 am”.',
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
    openedBrowser: '{app} isn’t installed or couldn’t be opened, so I opened a web page for it instead.',
    openFailed: 'I couldn’t open {app} on this phone.',
    dialOpened: 'Opened the phone dialer with {number}. Press call to dial.',
    youtubeSearch: 'Opened YouTube search for “{query}”.',
    previewNoApps:
      'Opening phone apps only works in the installed Android app, not in the browser preview.',
    newChat: 'New chat',
    askAlarmTime: 'What time? For example: “set alarm for 6:30 am”.',
    alarmSent: 'Asked your Clock app to set an alarm for {time}.',
    alarmFailed: 'I couldn’t reach a Clock app to set the alarm.',
    timerSent: 'Asked your Clock app to start a {duration} timer.',
    timerFailed: 'I couldn’t reach a Clock app to start the timer.',
    contactsDenied:
      'I need permission to read your contacts. Allow it and try again (Settings > Apps > NEXA AI > Permissions).',
    contactsFailed: 'I couldn’t read your contacts.',
    contactNotFound: 'I couldn’t find a contact named “{name}”.',
    contactMany: 'I found more than one match: {names}. Say the full name.',
    calling: 'Calling {name} ({number})…',
    callingDialer: 'Phone-call permission is off, so I opened the dialer with {name}’s number. Press call.',
    callFailed: 'I couldn’t start the call to {name}.',
    callingNumber: 'Calling {number}…',
    appMany: 'I found more than one app: {names}. Say the full name.',
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
      'Sannu! Ni ce NEXA AI. Rubuta saƙo ko ka danna makirufo ka tambaye ni kowace tambaya. Kana iya cewa “bude YouTube”, “kira Musa” ko “saita alarm karfe 6:30 na safe”.',
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
    openedBrowser: '{app} ba a sanya shi ba ko kuma ban iya buɗe shi ba, don haka na buɗe wani shafi maimakon haka.',
    openFailed: 'Ban iya buɗe {app} a wannan wayar ba.',
    dialOpened: 'An buɗe wayar da lamba {number}. Danna kira don yin kiran.',
    youtubeSearch: 'An buɗe binciken YouTube na “{query}”.',
    previewNoApps:
      'Buɗe manhajojin waya yana aiki ne kawai a manhajar Android da aka sanya, ba a samfurin burauza ba.',
    newChat: 'Sabuwar tattaunawa',
    askAlarmTime: 'Karfe nawa? Misali: “saita alarm karfe 6:30 na safe”.',
    alarmSent: 'Na nemi manhajar agogo ta saita alarm na {time}.',
    alarmFailed: 'Ban iya samun manhajar agogo don saita alarm ba.',
    timerSent: 'Na nemi manhajar agogo ta fara ƙidayar {duration}.',
    timerFailed: 'Ban iya samun manhajar agogo don fara ƙidayar lokaci ba.',
    contactsDenied:
      'Ina buƙatar izinin karanta lambobinka. Ka ba da izini ka sake gwadawa (Settings > Apps > NEXA AI > Permissions).',
    contactsFailed: 'Ban iya karanta lambobinka ba.',
    contactNotFound: 'Ban sami lamba mai suna “{name}” ba.',
    contactMany: 'Na sami fiye da ɗaya: {names}. Ka faɗi cikakken suna.',
    calling: 'Ina kiran {name} ({number})…',
    callingDialer: 'Izinin kira a waya a kashe yake, don haka na buɗe wayar da lambar {name}. Danna kira.',
    callFailed: 'Ban iya fara kira zuwa {name} ba.',
    callingNumber: 'Ina kiran {number}…',
    appMany: 'Na sami manhaja fiye da ɗaya: {names}. Ka faɗi cikakken suna.',
  },
};

export function t(lang, key, params = {}) {
  const table = STRINGS[lang] || STRINGS.en;
  const template = table[key] ?? STRINGS.en[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name) => (name in params ? String(params[name]) : `{${name}}`));
}
