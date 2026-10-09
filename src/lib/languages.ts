/** South Africa's eleven official languages — UI + speech routing. */
export type SaLanguage = {
  id: string;
  name: string;
  nativeName: string;
  /** Lelapa Vulavula transcribe code when supported; null = Whisper fallback via API */
  lelapaTranscribe?: string;
  lelapaTranslate?: string;
  speechStatus: "live" | "beta" | "planned";
};

export const SA_LANGUAGES: SaLanguage[] = [
  {
    id: "eng",
    name: "English",
    nativeName: "English",
    lelapaTranscribe: "eng",
    lelapaTranslate: "eng_Latn",
    speechStatus: "live",
  },
  {
    id: "afr",
    name: "Afrikaans",
    nativeName: "Afrikaans",
    lelapaTranscribe: "afr",
    lelapaTranslate: "afr_Latn",
    speechStatus: "live",
  },
  {
    id: "zul",
    name: "isiZulu",
    nativeName: "isiZulu",
    lelapaTranscribe: "zul",
    lelapaTranslate: "zul_Latn",
    speechStatus: "live",
  },
  {
    id: "xho",
    name: "isiXhosa",
    nativeName: "isiXhosa",
    lelapaTranslate: "xho_Latn",
    speechStatus: "beta",
  },
  {
    id: "nso",
    name: "Sepedi",
    nativeName: "Sepedi",
    lelapaTranslate: "nso_Latn",
    speechStatus: "beta",
  },
  {
    id: "sot",
    name: "Sesotho",
    nativeName: "Sesotho",
    lelapaTranscribe: "sot",
    lelapaTranslate: "sot_Latn",
    speechStatus: "live",
  },
  {
    id: "tsn",
    name: "Setswana",
    nativeName: "Setswana",
    lelapaTranslate: "tsn_Latn",
    speechStatus: "beta",
  },
  {
    id: "ssw",
    name: "siSwati",
    nativeName: "siSwati",
    lelapaTranslate: "ssw_Latn",
    speechStatus: "planned",
  },
  {
    id: "ven",
    name: "Tshivenda",
    nativeName: "Tshivenda",
    speechStatus: "planned",
  },
  {
    id: "tso",
    name: "Xitsonga",
    nativeName: "Xitsonga",
    lelapaTranslate: "tso_Latn",
    speechStatus: "beta",
  },
  {
    id: "nbl",
    name: "isiNdebele",
    nativeName: "isiNdebele",
    speechStatus: "planned",
  },
];

export function getLanguage(id: string): SaLanguage {
  return SA_LANGUAGES.find((l) => l.id === id) ?? SA_LANGUAGES[0];
}
