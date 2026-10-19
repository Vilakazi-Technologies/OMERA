/** BCP-47 tags for browser SpeechRecognition and Whisper language hints. */
const BCP47: Record<string, string> = {
  eng: "en-ZA",
  afr: "af-ZA",
  zul: "zu-ZA",
  xho: "xh-ZA",
  nso: "nso-ZA",
  sot: "st-ZA",
  tsn: "tn-ZA",
  ssw: "ss-ZA",
  ven: "ve-ZA",
  tso: "ts-ZA",
  nbl: "nr-ZA",
};

/** ISO-639-1 hint for Whisper (OpenRouter). */
const ISO639: Record<string, string> = {
  eng: "en",
  afr: "af",
  zul: "zu",
  xho: "xh",
  nso: "nso",
  sot: "st",
  tsn: "tn",
  ssw: "ss",
  ven: "ve",
  tso: "ts",
  nbl: "nr",
};

export function speechRecognitionLang(languageId: string): string {
  return BCP47[languageId] ?? "en-ZA";
}

export function whisperLanguageHint(languageId: string): string | undefined {
  return ISO639[languageId];
}
