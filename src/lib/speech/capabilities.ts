/**
 * Speech capability model.
 *
 * Each of the eleven product languages keeps a row, including languages
 * with no voice route. Unsupported languages are recorded as
 * "unavailable" and are never removed, so callers can distinguish
 * "no route" from "unknown language" without rerouting to English.
 *
 * Fields:
 * - text: typed input is always available.
 * - speech: "supported" (production voice route), "beta" (beta voice
 *   route), or "unavailable" (no voice route; never reroute).
 * - measured: measured speech quality; null until product recordings
 *   are evaluated.
 */

export type SpeechRoute = "supported" | "beta" | "unavailable";

export type LanguageCapability = {
  id: string;
  label: string;
  text: true;
  speech: SpeechRoute;
  measured: null;
};

const ROWS: Array<[id: string, label: string, speech: SpeechRoute]> = [
  ["eng", "English", "supported"],
  ["afr", "Afrikaans", "beta"],
  ["zul", "isiZulu", "supported"],
  ["xho", "isiXhosa", "unavailable"],
  ["nso", "Sepedi", "unavailable"],
  ["sot", "Sesotho", "beta"],
  ["tsn", "Setswana", "unavailable"],
  ["ssw", "siSwati", "unavailable"],
  ["ven", "Tshivenda", "unavailable"],
  ["tso", "Xitsonga", "unavailable"],
  ["nbl", "isiNdebele", "unavailable"],
];

export const LANGUAGE_CAPABILITIES: LanguageCapability[] = ROWS.map(
  ([id, label, speech]) => ({ id, label, text: true as const, speech, measured: null }),
);

export function getCapability(id: string): LanguageCapability | undefined {
  return LANGUAGE_CAPABILITIES.find((row) => row.id === id);
}

export function isKnownLanguage(id: string): boolean {
  return getCapability(id) !== undefined;
}

export function hasSpeechRoute(id: string): boolean {
  const row = getCapability(id);
  return row !== undefined && row.speech !== "unavailable";
}
