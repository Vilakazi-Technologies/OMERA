import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createAuthContext: vi.fn(),
}));
vi.mock("@/lib/auth/require-identity", () => ({
  requireIdentity: vi.fn(),
}));
vi.mock("@/lib/auth/request-origin", () => ({
  requireRequestOrigin: vi.fn(),
}));
import { createAuthContext } from "@/lib/supabase/server";
import { requireIdentity } from "@/lib/auth/require-identity";
import { requireRequestOrigin } from "@/lib/auth/request-origin";
import { POST } from "@/app/api/transcribe/route";

const NATIVE_TEXT = "Igama lami nguThabo.";
const VALID_BASE64 = Buffer.from([1, 2, 3, 4]).toString("base64");

function completed(languageId = "zul", text = NATIVE_TEXT) {
  return {
    transcription_status: "COMPLETED",
    transcription_text: text,
    language_code: languageId,
  };
}

function post(body: unknown): Request {
  return new Request("https://omera.example/api/transcribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    audioBase64: VALID_BASE64,
    mimeType: "audio/wav",
    languageId: "zul",
    ...overrides,
  };
}

beforeEach(() => {
  const env = process.env as Record<string, string | undefined>;
  env["LELAPA_API_KEY"] = "test-key";
  vi.mocked(createAuthContext).mockResolvedValue({
    applyCookies: (response: Response) => response,
  } as never);
  vi.mocked(requireIdentity).mockResolvedValue({
    userId: "omera-1",
    authUserId: "auth-1",
  } as never);
  vi.mocked(requireRequestOrigin).mockReturnValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("invalid_base64_returns_400", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const response = await POST(post(validBody({ audioBase64: "!!!not-base64!!!" })));
  expect(response.status).toBe(400);
  expect(fetchMock).not.toHaveBeenCalled();
});

it("an_unknown_language_returns_400", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const response = await POST(post(validBody({ languageId: "klingon" })));
  expect(response.status).toBe(400);
  expect(fetchMock).not.toHaveBeenCalled();
});

it("a_missing_key_returns_503", async () => {
  delete (process.env as Record<string, string | undefined>)["LELAPA_API_KEY"];
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const response = await POST(post(validBody()));
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "VOICE_UNAVAILABLE" });
  expect(fetchMock).not.toHaveBeenCalled();
});

it("a_provider_timeout_returns_504", async () => {
  const deadline = new AbortController();
  const timeout = vi
    .spyOn(AbortSignal, "timeout")
    .mockReturnValue(deadline.signal);
  const fetchMock = vi.fn(
    (_url: unknown, init: { signal: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(init.signal.reason), {
          once: true,
        });
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  const pending = POST(post(validBody()));
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  deadline.abort(new DOMException("provider timeout", "TimeoutError"));
  const response = await pending;
  expect(timeout).toHaveBeenCalledWith(45000);
  expect(response.status).toBe(504);
  expect(await response.json()).toEqual({ error: "VOICE_TIMEOUT" });
});

it("a_valid_clip_returns_native_text", async () => {
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(JSON.stringify(completed())));
  vi.stubGlobal("fetch", fetchMock);
  const response = await POST(post(validBody()));
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body).toEqual({ text: NATIVE_TEXT, languageId: "zul" });
  expect("answer" in body).toBe(false);
  expect(String(fetchMock.mock.calls[0][0])).toContain("lang_code=zul");
  expect(
    vi.mocked(requireIdentity).mock.invocationCallOrder[0],
  ).toBeLessThan(vi.mocked(requireRequestOrigin).mock.invocationCallOrder[0]);
});

it("an_unsupported_language_never_calls_english_routing", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const response = await POST(post(validBody({ languageId: "ven" })));
  expect(response.status).toBe(422);
  expect(await response.json()).toEqual({ error: "UNSUPPORTED_LANGUAGE" });
  expect(fetchMock).not.toHaveBeenCalled();
});
