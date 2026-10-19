import "server-only";
import { whisperLanguageHint } from "@/lib/speech/language-bcp47";
import { SpeechError } from "@/lib/speech/transcribe";

const TRANSCRIBE_URL = "https://openrouter.ai/api/v1/audio/transcriptions";

const FORMAT: Record<string, string> = {
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/webm": "webm",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "audio/flac": "flac",
};

export function isOpenRouterTranscribeConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(env.OPENROUTER_API_KEY?.trim());
}

function transcribeModel(env: NodeJS.ProcessEnv): string {
  return (
    env.OPENROUTER_TRANSCRIBE_MODEL?.trim() ||
    "openai/whisper-large-v3-turbo"
  );
}

export async function transcribeOpenRouter(input: {
  audio: Uint8Array;
  mimeType: string;
  languageId: string;
  apiKey: string;
  signal?: AbortSignal;
}): Promise<{ text: string; languageId: string }> {
  const apiKey = input.apiKey.trim();
  if (!apiKey || /[\r\n]/.test(apiKey)) {
    throw new SpeechError("VOICE_UNAVAILABLE", 503);
  }
  if (!input.audio.length || input.audio.length > 2000000) {
    throw new SpeechError("INVALID_AUDIO_SIZE", input.audio.length ? 413 : 400);
  }
  const mime = input.mimeType.split(";")[0].trim().toLowerCase();
  const format = FORMAT[mime];
  if (!format) throw new SpeechError("UNSUPPORTED_AUDIO", 415);

  const language = whisperLanguageHint(input.languageId);
  const body = JSON.stringify({
    model: transcribeModel(process.env),
    input_audio: {
      data: Buffer.from(input.audio).toString("base64"),
      format,
    },
    ...(language ? { language } : {}),
  });

  const timeout = AbortSignal.timeout(60000);
  const signal = input.signal ? AbortSignal.any([input.signal, timeout]) : timeout;

  let response: Response;
  try {
    response = await fetch(TRANSCRIBE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer":
          process.env.APP_ORIGIN?.trim() || "https://vilatech-ai.vercel.app",
        "X-Title": "Omera by VILATECH",
      },
      body,
      signal,
      redirect: "error",
      cache: "no-store",
    });
  } catch {
    throw new SpeechError(signal.aborted ? "VOICE_TIMEOUT" : "VOICE_UNAVAILABLE", signal.aborted ? 504 : 502);
  }

  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new SpeechError("VOICE_UNAVAILABLE", 502);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new SpeechError("INVALID_TRANSCRIPT", 502);
  }

  const text =
    data && typeof data === "object" && "text" in data && typeof (data as { text: unknown }).text === "string"
      ? (data as { text: string }).text.trim()
      : "";
  if (!text) throw new SpeechError("EMPTY_TRANSCRIPT", 422);
  return { text, languageId: input.languageId };
}
