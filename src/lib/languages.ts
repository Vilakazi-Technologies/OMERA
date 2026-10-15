/** South Africa's eleven official languages — UI registry. */
import type { SpeechRoute } from "@/lib/speech/capabilities";

export type SaLanguage = {
  id: string;
  name: string;
  nativeName: string;
  /** Typed input is available for every language. */
  text: true;
  /**
   * Voice route: "supported" (production), "beta" (beta route), or
   * "unavailable" (no voice route — never reroute to another language).
   */
  speech: SpeechRoute;
  /** Measured speech quality; none until product recordings are evaluated. */
  measured: null;
};

export const SA_LANGUAGES: SaLanguage[] = [
  { id: "eng", name: "English", nativeName: "English", text: true, speech: "supported", measured: null },
  { id: "afr", name: "Afrikaans", nativeName: "Afrikaans", text: true, speech: "beta", measured: null },
  { id: "zul", name: "isiZulu", nativeName: "isiZulu", text: true, speech: "supported", measured: null },
  { id: "xho", name: "isiXhosa", nativeName: "isiXhosa", text: true, speech: "unavailable", measured: null },
  { id: "nso", name: "Sepedi", nativeName: "Sepedi", text: true, speech: "unavailable", measured: null },
  { id: "sot", name: "Sesotho", nativeName: "Sesotho", text: true, speech: "beta", measured: null },
  { id: "tsn", name: "Setswana", nativeName: "Setswana", text: true, speech: "unavailable", measured: null },
  { id: "ssw", name: "siSwati", nativeName: "siSwati", text: true, speech: "unavailable", measured: null },
  { id: "ven", name: "Tshivenda", nativeName: "Tshivenda", text: true, speech: "unavailable", measured: null },
  { id: "tso", name: "Xitsonga", nativeName: "Xitsonga", text: true, speech: "unavailable", measured: null },
  { id: "nbl", name: "isiNdebele", nativeName: "isiNdebele", text: true, speech: "unavailable", measured: null },
];

export function getLanguage(id: string): SaLanguage {
  return SA_LANGUAGES.find((l) => l.id === id) ?? SA_LANGUAGES[0];
}
