const LELAPA_TRANSLATE_URL = "https://api.lelapa.ai/v1/translate/process";

type TranscribeResult = {
  text: string;
  provider: "lelapa" | "demo";
  detectedLanguage?: string;
};

/** Demo transcript snippets for stakeholder demos when no API key is set. */
const DEMO_BY_LANG: Record<string, string> = {
  eng: "My first name is Thabo and my surname is Mokoena.",
  afr: "My naam is Thabo en my van is Mokoena.",
  zul: "Igama lami nguThabo futhi isibongo sami nguMokoena.",
  xho: "Igama lam nguThabo kunye nesibongo sam nguMokoena.",
  sot: "Lebitso la ka ke Thabo mme fane la ka ke Mokoena.",
};

export async function transcribeAudio(
  audioBase64: string,
  languageId: string,
  mimeType: string,
): Promise<TranscribeResult> {
  const token = process.env.LELAPA_API_KEY;

  if (!token) {
    return {
      text: DEMO_BY_LANG[languageId] ?? DEMO_BY_LANG.eng,
      provider: "demo",
      detectedLanguage: languageId,
    };
  }

  const buffer = Buffer.from(audioBase64, "base64");
  const blob = new Blob([buffer], { type: mimeType || "audio/webm" });

  const form = new FormData();
  form.append("file", blob, "recording.webm");
  form.append("language", mapTranscribeLang(languageId));

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

function mapTranscribeLang(languageId: string): string {
  const map: Record<string, string> = {
    eng: "eng",
    afr: "afr",
    zul: "zul",
    sot: "sot",
  };
  return map[languageId] ?? "eng";
}
