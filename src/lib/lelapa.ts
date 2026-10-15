const LELAPA_TRANSLATE_URL = "https://api.lelapa.ai/v1/translate/process";

/** Documented transcription routes. Every other language has no route. */
const TRANSCRIBE_ROUTES = new Set(["eng", "afr", "zul", "sot"]);

type TranscribeResult = {
  text: string;
  provider: "lelapa";
  detectedLanguage?: string;
};

/**
 * Voice route for a product language ID, or undefined when the
 * language has no documented route. Unknown languages never fall
 * back to English.
 */
export function transcribeRoute(languageId: string): string | undefined {
  return TRANSCRIBE_ROUTES.has(languageId) ? languageId : undefined;
}

export async function transcribeAudio(
  audioBase64: string,
  languageId: string,
  mimeType: string,
): Promise<TranscribeResult> {
  const route = transcribeRoute(languageId);
  if (!route) {
    throw new Error("UNSUPPORTED_LANGUAGE");
  }
  const token = process.env.LELAPA_API_KEY;
  if (!token) {
    throw new Error("VOICE_UNAVAILABLE");
  }

  const buffer = Buffer.from(audioBase64, "base64");
  const blob = new Blob([buffer], { type: mimeType || "audio/webm" });

  const form = new FormData();
  form.append("file", blob, "recording.webm");
  form.append("language", route);

  const res = await fetch("https://api.lelapa.ai/v1/transcribe/process", {
    method: "POST",
    headers: {
      "X-CLIENT-TOKEN": token,
    },
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Lelapa transcribe failed: ${res.status} ${err}`);
  }

  const data = (await res.json()) as {
    transcription?: string;
    text?: string;
    language?: string;
  };

  return {
    text: (data.transcription ?? data.text ?? "").trim(),
    provider: "lelapa",
    detectedLanguage: data.language,
  };
}

export async function translateToEnglish(
  text: string,
  sourceLangCode: string,
): Promise<string> {
  const token = process.env.LELAPA_API_KEY;
  if (!token || sourceLangCode === "eng_Latn") return text;

  const res = await fetch(LELAPA_TRANSLATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CLIENT-TOKEN": token,
    },
    body: JSON.stringify({
      input_text: text,
      source_lang: sourceLangCode,
      target_lang: "eng_Latn",
    }),
  });

  if (!res.ok) {
    return text;
  }

  const data = (await res.json()) as {
    translation?: { translated_text: string }[];
  };
  return data.translation?.[0]?.translated_text ?? text;
}
