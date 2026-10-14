import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { transcribeNative } from "@/lib/speech/transcribe";

afterEach(() => vi.unstubAllGlobals());

it("preserves the transcript and sends the documented request", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    transcription_status: "COMPLETED",
    transcription_text: "Igama lami nguThabo.",
    language_code: "zul",
  })));
  vi.stubGlobal("fetch", fetchMock);
  const result = await transcribeNative({
    audio: new Uint8Array([1, 2]), mimeType: "audio/wav", languageId: "zul", apiKey: "test-key",
  });
  expect(result).toEqual({ text: "Igama lami nguThabo.", languageId: "zul" });
  expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.lelapa.ai/v1/transcribe/sync?lang_code=zul");
  const request = fetchMock.mock.calls[0][1];
  expect(request.headers["X-CLIENT-TOKEN"]).toBe("test-key");
  expect(request.body.get("file").name).toBe("recording.wav");
});

it("rejects unsupported routing before a provider call", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  await expect(transcribeNative({
    audio: new Uint8Array([1]), mimeType: "audio/wav", languageId: "ven", apiKey: "test-key",
  })).rejects.toMatchObject({ code: "UNSUPPORTED_LANGUAGE", status: 422 });
  await expect(transcribeNative({
    audio: new Uint8Array([1]), mimeType: "audio/webm", languageId: "eng", apiKey: "test-key",
  })).rejects.toMatchObject({ code: "UNSUPPORTED_AUDIO", status: 415 });
  expect(fetchMock).not.toHaveBeenCalled();
});


// Contract fixtures verify HTTP structure, not valid audio or live speech quality.
import { SpeechError } from "@/lib/speech/transcribe";

type SpeechInput = Parameters<typeof transcribeNative>[0];
const validInput: SpeechInput = {
  audio: new Uint8Array([1, 2]),
  mimeType: "audio/wav",
  languageId: "zul",
  apiKey: "test-key",
};
const completed = (languageId = "zul", text = "Igama lami nguThabo.") => ({
  transcription_status: "COMPLETED",
  transcription_text: text,
  language_code: languageId,
});
const jsonResponse = (data: unknown) => new Response(JSON.stringify(data));

async function expectSpeechError(promise: Promise<unknown>, code: string, status: number) {
  const error = await promise.catch((reason: unknown) => reason);
  expect(error).toBeInstanceOf(SpeechError);
  expect(error).toMatchObject({ code, status, message: code });
  expect(String(error)).not.toContain("private-provider-detail");
}

const mimeCases = [
  ["audio/wav", "wav"],
  ["audio/x-wav", "wav"],
  ["audio/mpeg", "mp3"],
  ["audio/flac", "flac"],
  ["audio/aac", "aac"],
  ["audio/ogg", "ogg"],
  ["audio/mp4", "mp4"],
  ["audio/aiff", "aiff"],
  ["audio/opus", "opus"],
] as const;
const transportCases = ["eng", "afr", "zul", "sot"].flatMap(languageId =>
  mimeCases.map(([mimeType, extension]) => ({ languageId, mimeType, extension })),
);

it.each(transportCases)("sends exact safe transport for $languageId $mimeType", async ({ languageId, mimeType, extension }) => {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(completed(languageId)));
  vi.stubGlobal("fetch", fetchMock);
  const audio = new Uint8Array([0, 127, 128, 255]);
  await expect(transcribeNative({ ...validInput, audio, languageId, mimeType, apiKey: "  test-key  " }))
    .resolves.toEqual({ text: "Igama lami nguThabo.", languageId });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, request] = fetchMock.mock.calls[0];
  expect(String(url)).toBe(`https://api.lelapa.ai/v1/transcribe/sync?lang_code=${languageId}`);
  expect(request).toMatchObject({
    method: "POST",
    headers: { "X-CLIENT-TOKEN": "test-key" },
    redirect: "error",
    cache: "no-store",
  });
  expect(request?.signal).toBeInstanceOf(AbortSignal);
  expect(request?.body).toBeInstanceOf(FormData);
  const form = request?.body as FormData;
  expect([...form.keys()]).toEqual(["file"]);
  const file = form.get("file");
  expect(file).toBeInstanceOf(File);
  if (!(file instanceof File)) throw new Error("Expected a multipart file");
  expect(file.name).toBe(`recording.${extension}`);
  expect(file.type).toBe(mimeType);
  expect(new Uint8Array(await file.arrayBuffer())).toEqual(audio);
});

it("normalizes MIME case and parameters but copies only the visible audio subview", async () => {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(completed()));
  vi.stubGlobal("fetch", fetchMock);
  const backing = new Uint8Array([99, 1, 128, 2, 88]);
  await transcribeNative({ ...validInput, audio: backing.subarray(1, 4), mimeType: "  AuDiO/WaV ; codecs=pcm" });
  const body = fetchMock.mock.calls[0][1]?.body;
  expect(body).toBeInstanceOf(FormData);
  if (!(body instanceof FormData)) throw new Error("Expected FormData");
  const file = body.get("file");
  if (!(file instanceof File)) throw new Error("Expected File");
  expect(file.name).toBe("recording.wav");
  expect(file.type).toBe("audio/wav");
  expect(new Uint8Array(await file.arrayBuffer())).toEqual(new Uint8Array([1, 128, 2]));
});

it.each(["  Ngiyabonga.\n\tSawubona!  ", "e\u0301 é — isiZulu 🗣️\n中文\u00a0 "])(
  "preserves spacing and Unicode exactly: %j", async text => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(completed("zul", text))));
    await expect(transcribeNative(validInput)).resolves.toEqual({ text, languageId: "zul" });
  },
);

const invalidInputs: { label: string; change: Partial<SpeechInput>; code: string; status: number }[] = [
  ...["ven", "ENG", " eng", "eng ", "", "__proto__"].map(languageId => ({
    label: `language ${JSON.stringify(languageId)}`, change: { languageId }, code: "UNSUPPORTED_LANGUAGE", status: 422,
  })),
  ...["audio/webm", "", "constructor", "__proto__", "toString"].map(mimeType => ({
    label: `MIME ${JSON.stringify(mimeType)}`, change: { mimeType }, code: "UNSUPPORTED_AUDIO", status: 415,
  })),
  ...["", " \t ", "test-key\r", "\ntest-key", "test\r\nkey"].map(apiKey => ({
    label: `key ${JSON.stringify(apiKey)}`, change: { apiKey }, code: "VOICE_UNAVAILABLE", status: 503,
  })),
  { label: "empty audio", change: { audio: new Uint8Array() }, code: "INVALID_AUDIO_SIZE", status: 400 },
  { label: "2000001-byte audio", change: { audio: new Uint8Array(2000001) }, code: "INVALID_AUDIO_SIZE", status: 413 },
];
it.each(invalidInputs)("rejects $label before fetch", async ({ change, code, status }) => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  await expectSpeechError(transcribeNative({ ...validInput, ...change }), code, status);
  expect(fetchMock).not.toHaveBeenCalled();
});

it("accepts exactly 2000000 audio bytes", async () => {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(completed()));
  vi.stubGlobal("fetch", fetchMock);
  const audio = new Uint8Array(2000000);
  audio[0] = 128;
  audio[audio.length - 1] = 255;
  await expect(transcribeNative({ ...validInput, audio })).resolves.toEqual({ text: "Igama lami nguThabo.", languageId: "zul" });
  const body = fetchMock.mock.calls[0][1]?.body;
  if (!(body instanceof FormData)) throw new Error("Expected FormData");
  const file = body.get("file");
  if (!(file instanceof File)) throw new Error("Expected File");
  expect(file.size).toBe(2000000);
  expect(Buffer.compare(Buffer.from(await file.arrayBuffer()), Buffer.from(audio))).toBe(0);
});

const invalidResponses: { label: string; data: unknown }[] = [
  { label: "null", data: null },
  { label: "boolean", data: true },
  { label: "string", data: "private-provider-detail" },
  { label: "array", data: [] },
  { label: "missing fields", data: {} },
  { label: "missing status", data: { transcription_text: "hello", language_code: "zul" } },
  { label: "missing text", data: { transcription_status: "COMPLETED", language_code: "zul" } },
  { label: "missing language", data: { transcription_status: "COMPLETED", transcription_text: "hello" } },
  ...["PENDING", "FAILED", "completed", null, 1, false].map(transcription_status => ({
    label: `status ${JSON.stringify(transcription_status)}`, data: { ...completed(), transcription_status },
  })),
  ...[null, 123, false, {}, []].map(transcription_text => ({
    label: `text ${JSON.stringify(transcription_text)}`, data: { ...completed(), transcription_text },
  })),
  ...["eng", "ZUL", "zul ", null, 123, false].map(language_code => ({
    label: `language ${JSON.stringify(language_code)}`, data: { ...completed(), language_code },
  })),
];
it.each(invalidResponses)("rejects invalid response $label without private details", async ({ data }) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(data)));
  await expectSpeechError(transcribeNative(validInput), "INVALID_TRANSCRIPT", 502);
});

it.each(["", " \t\r\n\u00a0"])("rejects an empty or whitespace-only transcript %j", async text => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(completed("zul", text))));
  await expectSpeechError(transcribeNative(validInput), "EMPTY_TRANSCRIPT", 422);
});

it("maps malformed JSON without exposing private provider details", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("private-provider-detail {")));
  await expectSpeechError(transcribeNative(validInput), "INVALID_TRANSCRIPT", 502);
});

it("maps network errors without exposing private provider details", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("private-provider-detail")));
  await expectSpeechError(transcribeNative(validInput), "VOICE_UNAVAILABLE", 502);
});

it.each([false, true])("cancels an open non-OK body once and unlocks it (reject=%s)", async rejects => {
  const cancel = vi.fn(() => rejects ? Promise.reject(new Error("private-provider-detail")) : Promise.resolve());
  const stream = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new TextEncoder().encode("private-provider-detail")); },
    cancel,
  });
  const response = new Response(stream, { status: 503, statusText: "private-provider-detail" });
  const json = vi.spyOn(response, "json");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
  await expectSpeechError(transcribeNative(validInput), "VOICE_UNAVAILABLE", 502);
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(json).not.toHaveBeenCalled();
  expect(stream.locked).toBe(false);
});

it("handles a non-OK response without a body", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
  await expectSpeechError(transcribeNative(validInput), "VOICE_UNAVAILABLE", 502);
});

function installAbortAwareFetch() {
  const fetchMock = vi.fn<typeof fetch>((_url, request) => new Promise((_resolve, reject) => {
    const signal = request?.signal;
    if (!signal) throw new Error("Expected request signal");
    const onAbort = () => reject(signal.reason);
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

it("maps caller abort during fetch to VOICE_TIMEOUT 504", async () => {
  const fetchMock = installAbortAwareFetch();
  const controller = new AbortController();
  const result = expectSpeechError(transcribeNative({ ...validInput, signal: controller.signal }), "VOICE_TIMEOUT", 504);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  controller.abort(new Error("private-provider-detail"));
  await result;
});

it("maps an already-aborted caller signal to VOICE_TIMEOUT 504", async () => {
  installAbortAwareFetch();
  const controller = new AbortController();
  controller.abort(new Error("private-provider-detail"));
  await expectSpeechError(transcribeNative({ ...validInput, signal: controller.signal }), "VOICE_TIMEOUT", 504);
});

it("enforces the 45000ms deadline during fetch without waiting", async () => {
  vi.useFakeTimers();
  try {
    const deadline = new AbortController();
    const timeout = vi.spyOn(AbortSignal, "timeout").mockImplementation(milliseconds => {
      setTimeout(() => deadline.abort(new DOMException("private-provider-detail", "TimeoutError")), milliseconds);
      return deadline.signal;
    });
    const fetchMock = installAbortAwareFetch();
    const result = expectSpeechError(transcribeNative(validInput), "VOICE_TIMEOUT", 504);
    expect(timeout).toHaveBeenCalledExactlyOnceWith(45000);
    await vi.advanceTimersByTimeAsync(44999);
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await result;
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
  } finally {
    vi.useRealTimers();
  }
});

it.each(["caller", "deadline"] as const)("maps %s abort during response JSON reading to VOICE_TIMEOUT 504", async mode => {
  const caller = new AbortController();
  const deadline = new AbortController();
  const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(deadline.signal);
  let streamController: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller;
      controller.enqueue(new TextEncoder().encode('{"transcription_status":'));
    },
  });
  const response = new Response(stream);
  const fetchMock = vi.fn<typeof fetch>(async (_url, request) => {
    request?.signal?.addEventListener("abort", () => streamController.error(request.signal?.reason), { once: true });
    return response;
  });
  vi.stubGlobal("fetch", fetchMock);
  const result = expectSpeechError(transcribeNative({ ...validInput, signal: caller.signal }), "VOICE_TIMEOUT", 504);
  await vi.waitFor(() => expect(stream.locked).toBe(true));
  expect(timeout).toHaveBeenCalledExactlyOnceWith(45000);
  (mode === "caller" ? caller : deadline).abort(new Error("private-provider-detail"));
  await result;
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
