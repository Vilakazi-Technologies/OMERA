import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { SpeechError, transcribeAudio } from "@/lib/speech/transcribe";

beforeEach(() => {
  (process.env as Record<string, string>).OPENROUTER_API_KEY = "or-test-key";
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete (process.env as Record<string, string | undefined>).OPENROUTER_API_KEY;
});

it("prefers_openrouter_for_english_demo", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ text: "Hello from Whisper." })),
    );
  vi.stubGlobal("fetch", fetchMock);
  const result = await transcribeAudio({
    audio: new Uint8Array([1, 2, 3]),
    mimeType: "audio/wav",
    languageId: "eng",
    lelapaKey: "lelapa-key",
    openRouterKey: "or-key",
  });
  expect(result.text).toBe("Hello from Whisper.");
  expect(String(fetchMock.mock.calls[0][0])).toContain(
    "openrouter.ai/api/v1/audio/transcriptions",
  );
});

it("falls_back_to_whisper_when_lelapa_fails_for_zulu", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(new Response("fail", { status: 502 }))
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ text: "Sawubona." })),
    );
  vi.stubGlobal("fetch", fetchMock);
  const result = await transcribeAudio({
    audio: new Uint8Array([1, 2, 3]),
    mimeType: "audio/wav",
    languageId: "zul",
    lelapaKey: "lelapa-key",
    openRouterKey: "or-key",
  });
  expect(result.text).toBe("Sawubona.");
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("uses_whisper_for_xhosa_when_only_openrouter_is_set", async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ text: "Molo." })),
  );
  vi.stubGlobal("fetch", fetchMock);
  const result = await transcribeAudio({
    audio: new Uint8Array([1, 2]),
    mimeType: "audio/webm",
    languageId: "xho",
    lelapaKey: "",
    openRouterKey: "or-key",
  });
  expect(result.text).toBe("Molo.");
});

it("returns_503_when_no_providers", async () => {
  await expect(
    transcribeAudio({
      audio: new Uint8Array([1]),
      mimeType: "audio/wav",
      languageId: "ven",
      lelapaKey: "",
      openRouterKey: "",
    }),
  ).rejects.toBeInstanceOf(SpeechError);
});
