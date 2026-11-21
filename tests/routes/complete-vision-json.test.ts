import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/store-gateway/authorize", () => ({
  authorizeStoreGateway: vi.fn(() => null),
}));
vi.mock("@/lib/ai/openrouter-client", () => ({
  isOpenRouterConfigured: vi.fn(() => true),
  getOpenRouterVisionConfig: vi.fn(() => ({ model: "gemini-2.5-flash" })),
  completeOpenRouterVisionJsonString: vi.fn(),
}));
import { completeOpenRouterVisionJsonString } from "@/lib/ai/openrouter-client";
import { POST } from "@/app/api/store/complete-vision-json/route";

const MARKER = "SECRET_MARKER_vision_9f3a";

function post(): Request {
  return new Request("https://omera.example/api/store/complete-vision-json", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system: "system prompt",
      user: "user prompt",
      imageDataUrl: "data:image/png;base64,AA",
    }),
  });
}

it("vision_failure_keeps_provider_detail_out_of_the_response_and_log", async () => {
  vi.mocked(completeOpenRouterVisionJsonString).mockRejectedValueOnce(
    new Error(MARKER),
  );
  const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const response = await POST(post());
  expect(response.status).toBe(502);
  const body = (await response.json()) as { error: string };
  expect(JSON.stringify(body)).not.toContain(MARKER);
  expect(spy.mock.calls.flat().map(String).join(" ")).not.toContain(MARKER);
  spy.mockRestore();
});

it("vision_success_still_returns_the_raw_json_and_model", async () => {
  vi.mocked(completeOpenRouterVisionJsonString).mockResolvedValueOnce(
    '{"ok":true}' as never,
  );
  const response = await POST(post());
  expect(response.status).toBe(200);
  const body = (await response.json()) as { raw: string; model: string };
  expect(body.raw).toBe('{"ok":true}');
  expect(body.model).toBe("gemini-2.5-flash");
});
