import "server-only";

const SUPPORTED = new Set(["eng", "afr", "zul", "sot"]);
const EXTENSIONS: Record<string, string> = {
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/mpeg": "mp3",
  "audio/flac": "flac",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
  "audio/mp4": "mp4",
  "audio/aiff": "aiff",
  "audio/opus": "opus",
};

export class SpeechError extends Error {
  constructor(public code: string, public status: number) {
    super(code);
  }
}

export async function transcribeNative(input: {
  audio: Uint8Array;
  mimeType: string;
  languageId: string;
  apiKey: string;
  signal?: AbortSignal;
}): Promise<{ text: string; languageId: string }> {
  if (!SUPPORTED.has(input.languageId)) throw new SpeechError("UNSUPPORTED_LANGUAGE", 422);
  if (!input.apiKey.trim() || /[\r\n]/.test(input.apiKey)) throw new SpeechError("VOICE_UNAVAILABLE", 503);
  if (!input.audio.length || input.audio.length > 2000000) {
    throw new SpeechError("INVALID_AUDIO_SIZE", input.audio.length ? 413 : 400);
  }
  const mime = input.mimeType.split(";")[0].trim().toLowerCase();
  const extension = Object.hasOwn(EXTENSIONS, mime) ? EXTENSIONS[mime] : undefined;
  if (!extension) throw new SpeechError("UNSUPPORTED_AUDIO", 415);
  const body = new FormData();
  body.append("file", new Blob([new Uint8Array(input.audio)], { type: mime }), `recording.${extension}`);
  const url = new URL("https://api.lelapa.ai/v1/transcribe/sync");
  url.searchParams.set("lang_code", input.languageId);
  const timeout = AbortSignal.timeout(45000);
  const signal = input.signal ? AbortSignal.any([input.signal, timeout]) : timeout;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "X-CLIENT-TOKEN": input.apiKey.trim() },
      redirect: "error",
      cache: "no-store",
      body,
      signal,
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
    throw new SpeechError(signal.aborted ? "VOICE_TIMEOUT" : "INVALID_TRANSCRIPT", signal.aborted ? 504 : 502);
  }
  if (!data || typeof data !== "object" ||
      !("transcription_status" in data) || data.transcription_status !== "COMPLETED" ||
      !("transcription_text" in data) || typeof data.transcription_text !== "string" ||
      !("language_code" in data) || data.language_code !== input.languageId) {
    throw new SpeechError("INVALID_TRANSCRIPT", 502);
  }
  if (!data.transcription_text.trim()) throw new SpeechError("EMPTY_TRANSCRIPT", 422);
  return { text: data.transcription_text, languageId: input.languageId };
}
