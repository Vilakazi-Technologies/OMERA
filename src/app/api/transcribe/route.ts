import { NextResponse } from "next/server";
import { ApiError, apiErrorResponse } from "@/lib/http/api-error";
import { readBody } from "@/lib/http/read-body";
import { requireRequestOrigin } from "@/lib/auth/request-origin";
import { requireIdentity } from "@/lib/auth/require-identity";
import { isKnownLanguage } from "@/lib/speech/capabilities";
import { SpeechError, transcribeAudio } from "@/lib/speech/transcribe";

export const runtime = "nodejs";

/** Raw JSON body limit: base64 audio plus metadata. */
const TRANSCRIBE_BODY_LIMIT = 2800000;
/** Decoded audio limit: 60 s of 16 kHz 16-bit mono plus WAV header. */
const TRANSCRIBE_AUDIO_LIMIT = 2000000;

const SUPPORTED_MIME_TYPES = new Set([
  "audio/wav",
  "audio/x-wav",
  "audio/mpeg",
  "audio/flac",
  "audio/aac",
  "audio/ogg",
  "audio/mp4",
  "audio/aiff",
  "audio/opus",
]);

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

function decodeCanonicalBase64(value: unknown): Uint8Array {
  if (typeof value !== "string" || value.length === 0) {
    throw new ApiError("INVALID_AUDIO", 400);
  }
  if (
    value.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(value)
  ) {
    throw new ApiError("INVALID_AUDIO", 400);
  }
  const decoded = Buffer.from(value, "base64");
  if (decoded.toString("base64") !== value) {
    throw new ApiError("INVALID_AUDIO", 400);
  }
  return new Uint8Array(decoded);
}

export async function POST(request: Request) {
  try {
    await requireIdentity();
    requireRequestOrigin(request);

    const raw = await readBody(request, TRANSCRIBE_BODY_LIMIT);
    let parsed: unknown;
    try {
      parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw));
    } catch {
      throw new ApiError("INVALID_JSON", 400);
    }
    if (!parsed || typeof parsed !== "object") {
      throw new ApiError("INVALID_REQUEST", 400);
    }
    const { audioBase64, mimeType, languageId } = parsed as Record<string, unknown>;

    if (typeof languageId !== "string" || !isKnownLanguage(languageId)) {
      throw new ApiError("INVALID_LANGUAGE", 400);
    }
    if (typeof mimeType !== "string") {
      throw new ApiError("INVALID_AUDIO", 400);
    }
    const mime = mimeType.split(";")[0].trim().toLowerCase();
    if (!SUPPORTED_MIME_TYPES.has(mime)) {
      throw new ApiError("UNSUPPORTED_AUDIO", 415);
    }
    const audio = decodeCanonicalBase64(audioBase64);
    if (!audio.length || audio.length > TRANSCRIBE_AUDIO_LIMIT) {
      throw new SpeechError("INVALID_AUDIO_SIZE", audio.length ? 413 : 400);
    }

    const result = await transcribeAudio({
      audio,
      mimeType: mime,
      languageId,
      lelapaKey: process.env.LELAPA_API_KEY ?? "",
      openRouterKey: process.env.OPENROUTER_API_KEY ?? "",
    });

    return NextResponse.json(
      { text: result.text, languageId: result.languageId },
      { headers: NO_STORE },
    );
  } catch (error) {
    if (error instanceof SpeechError) {
      return NextResponse.json(
        { error: error.code },
        { status: error.status, headers: NO_STORE },
      );
    }
    return apiErrorResponse(error);
  }
}
