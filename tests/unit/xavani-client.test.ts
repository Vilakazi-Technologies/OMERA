import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { completeXavaniJson, createXavaniChatStream, getXavaniConfig } from "@/lib/ai/xavani-client";

const config = { baseUrl: "https://xavani.example.test", apiKey: "test-...ey", model: "omera" };
afterEach(() => vi.unstubAllGlobals());
const capabilities = {
  model: "omera", auth: { required: true },
  service: { name: "omera", contract: 1, stateless_requests: true, tools_enabled: false,
    memory_enabled: false, context_files_enabled: false, transcript_persistence: false },
};
function ready(response: Response) {
  return vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(capabilities)))
    .mockResolvedValueOnce(response);
}

function event(content: string | null, finish: string | null = null) {
  return `data: ${JSON.stringify({ choices: [{ delta: content === null ? {} : { content }, finish_reason: finish }] })}\n\n`;
}
function streamResponse(text: string) {
  const bytes = new TextEncoder().encode(text);
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
      controller.close();
    },
  }), { headers: { "Content-Type": "text/event-stream" } });
}

it("requires an explicit Xavani destination", () => {
  expect(() => getXavaniConfig({ NODE_ENV: "test" })).toThrow("XAVANI_UNAVAILABLE");
  expect(() => getXavaniConfig({ NODE_ENV: "test", XAVANI_API_KEY: "test", XAVANI_BASE_URL: "http://remote.example.test" }))
    .toThrow("INVALID_XAVANI_URL");
  expect(getXavaniConfig({ NODE_ENV: "test", XAVANI_API_KEY: "test", XAVANI_BASE_URL: "http://127.0.0.1:8642" }).model)
    .toBe("omera");
});

it("sends chat only to Xavani and preserves fragmented Unicode", async () => {
  const mock = ready(streamResponse(
    ': keepalive\n\n' + event("Ṱhendo") + event(null, "stop") + 'data: [DONE]\n\n',
  ));
  vi.stubGlobal("fetch", mock);
  const text = await new Response(createXavaniChatStream(
    config, [{ role: "user", content: "Help." }], "ven",
  )).text();
  expect(mock).toHaveBeenCalledTimes(2);
  expect(mock.mock.calls[1][0]).toBe("https://xavani.example.test/v1/chat/completions");
  const request = mock.mock.calls[1][1];
  const body = JSON.parse(request.body);
  expect(request.headers.Authorization).toBe("Bearer " + config.apiKey);
  expect(request.headers["X-Xavani-Session-Id"]).toBeUndefined();
  expect(body.messages[0].content).toContain("reply in Tshivenda");
  expect(body).not.toHaveProperty("tools");
  expect(body).not.toHaveProperty("response_format");
  expect(text).toContain('data: {"token":"Ṱhendo"}');
  expect(text).toContain("data: [DONE]");
});

it.each([
  event("partial") + event(null, "error") + 'data: [DONE]\n\n',
  event("partial") + event(null, "length") + 'data: [DONE]\n\n',
  event("partial") + 'data: [DONE]\n\n',
  event("partial"),
  'event: xavani.tool.progress\ndata: {"tool":"terminal"}\n\n',
])("rejects an incomplete or tool-enabled stream", async (payload) => {
  vi.stubGlobal("fetch", ready(streamResponse(payload)));
  const text = await new Response(createXavaniChatStream(config, [{ role: "user", content: "Help." }])).text();
  expect(text).toContain('data: {"error":"CHAT_UNAVAILABLE"}');
  expect(text).not.toContain("data: [DONE]");
});

it("does not expose upstream errors or use a direct fallback", async () => {
  const mock = ready(new Response("private upstream detail", { status: 503 }));
  vi.stubGlobal("fetch", mock);
  const text = await new Response(createXavaniChatStream(config, [{ role: "user", content: "Help." }])).text();
  expect(text).toBe('data: {"error":"CHAT_UNAVAILABLE"}\n\n');
  expect(mock).toHaveBeenCalledTimes(2);
});

it("parses JSON only after complete Xavani output", async () => {
  const mock = ready(new Response(JSON.stringify({
    choices: [{ message: { content: '{"ok":true}' }, finish_reason: "stop" }],
  })));
  vi.stubGlobal("fetch", mock);
  const result = await completeXavaniJson(config, "Return JSON only.", "Check the schema.", (value) => value);
  expect(result).toEqual({ ok: true });
  expect(JSON.parse(mock.mock.calls[1][1].body).stream).toBe(false);
});

it("rejects partial JSON results", async () => {
  vi.stubGlobal("fetch", ready(new Response(JSON.stringify({
    choices: [{ message: { content: '{"ok":true}' }, finish_reason: "stop" }],
    xavani: { completed: false, partial: true, failed: false },
  }))));
  await expect(completeXavaniJson(config, "Return JSON.", "Check.", (value) => value))
    .rejects.toThrow("INCOMPLETE_XAVANI_RESPONSE");
});

it("blocks unsafe Xavani services before sending customer text", async () => {
  const mock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    ...capabilities, service: { ...capabilities.service, tools_enabled: true },
  })));
  vi.stubGlobal("fetch", mock);
  const text = await new Response(createXavaniChatStream(config, [{ role: "user", content: "private business data" }])).text();
  expect(text).toBe('data: {"error":"CHAT_UNAVAILABLE"}\n\n');
  expect(mock).toHaveBeenCalledTimes(1);
  expect(mock.mock.calls[0][0]).toBe("https://xavani.example.test/v1/capabilities");
  expect(mock.mock.calls[0][1]).not.toHaveProperty("body");
});


it.each([
  ["https://xavani.example.test", "https://xavani.example.test"],
  ["https://xavani.example.test/", "https://xavani.example.test"],
  ["https://xavani.example.test:8642/", "https://xavani.example.test:8642"],
  ["http://localhost:8642", "http://localhost:8642"],
  ["http://127.0.0.1:8642/", "http://127.0.0.1:8642"],
  ["http://[::1]:8642/", "http://[::1]:8642"],
])("accepts the configured origin %s", (baseUrl, origin) => {
  expect(getXavaniConfig({ NODE_ENV: "test", XAVANI_API_KEY: config.apiKey, XAVANI_BASE_URL: baseUrl }))
    .toEqual({ baseUrl: origin, apiKey: config.apiKey, model: "omera" });
});

it.each([
  [undefined, "omera"],
  ["", "omera"],
  ["   ", "omera"],
  ["custom-alias", "custom-alias"],
  ["  custom-alias  ", "custom-alias"],
])("uses the default or explicit model alias %s", (model, expected) => {
  expect(getXavaniConfig({
    NODE_ENV: "test",
    XAVANI_API_KEY: config.apiKey,
    XAVANI_BASE_URL: config.baseUrl,
    XAVANI_MODEL: model,
  }).model).toBe(expected);
});

it("trims surrounding configuration whitespace", () => {
  expect(getXavaniConfig({
    NODE_ENV: "test",
    XAVANI_API_KEY: `  ${config.apiKey}  `,
    XAVANI_BASE_URL: `  ${config.baseUrl}/  `,
  })).toEqual(config);
});

it.each([
  { XAVANI_BASE_URL: config.baseUrl },
  { XAVANI_API_KEY: config.apiKey },
  { XAVANI_API_KEY: "", XAVANI_BASE_URL: config.baseUrl },
  { XAVANI_API_KEY: "   ", XAVANI_BASE_URL: config.baseUrl },
  { XAVANI_API_KEY: config.apiKey, XAVANI_BASE_URL: "" },
  { XAVANI_API_KEY: config.apiKey, XAVANI_BASE_URL: "   " },
])("rejects absent or empty required configuration: %j", (env) => {
  expect(() => getXavaniConfig({ NODE_ENV: "test", ...env })).toThrow("XAVANI_UNAVAILABLE");
});

it.each([
  "http://remote.example.test",
  "http://localhost.example.test",
  "http://127.0.0.2",
  "ftp://localhost",
  "https://customer@xavani.example.test",
  "https://customer:password@xavani.example.test",
  "https://:password@xavani.example.test",
  "https://xavani.example.test?customer=private",
  "https://xavani.example.test#private",
  "https://xavani.example.test/v1",
])("rejects an unsafe origin %s", (baseUrl) => {
  expect(() => getXavaniConfig({ NODE_ENV: "test", XAVANI_API_KEY: config.apiKey, XAVANI_BASE_URL: baseUrl }))
    .toThrow("INVALID_XAVANI_URL");
});

it.each(["not a URL", "https://", "https://[::1", "/relative"])(
  "rejects malformed URL input %s without requiring a normalized error code", (baseUrl) => {
    expect(() => getXavaniConfig({ NODE_ENV: "test", XAVANI_API_KEY: config.apiKey, XAVANI_BASE_URL: baseUrl }))
      .toThrow();
  },
);

it.each([
  `\r${config.apiKey}`,
  `\n${config.apiKey}`,
  `${config.apiKey}\r`,
  `${config.apiKey}\n`,
  `${config.apiKey}\rinside`,
  `${config.apiKey}\ninside`,
])("rejects raw CR or LF in a nonempty key, including its edges: %j", (apiKey) => {
  expect(() => getXavaniConfig({ NODE_ENV: "test", XAVANI_API_KEY: apiKey, XAVANI_BASE_URL: config.baseUrl }))
    .toThrow("INVALID_XAVANI_KEY");
});

it.each([
  ["wrong model", { ...capabilities, model: "wrong-model" }],
  ["authentication disabled", { ...capabilities, auth: { required: false } }],
  ["wrong service name", { ...capabilities, service: { ...capabilities.service, name: "other" } }],
  ["wrong contract number", { ...capabilities, service: { ...capabilities.service, contract: 2 } }],
  ["wrong contract type", { ...capabilities, service: { ...capabilities.service, contract: "1" } }],
  ["stateful requests", { ...capabilities, service: { ...capabilities.service, stateless_requests: false } }],
  ["tools enabled", { ...capabilities, service: { ...capabilities.service, tools_enabled: true } }],
  ["memory enabled", { ...capabilities, service: { ...capabilities.service, memory_enabled: true } }],
  ["context files enabled", { ...capabilities, service: { ...capabilities.service, context_files_enabled: true } }],
  ["transcript persistence", { ...capabilities, service: { ...capabilities.service, transcript_persistence: true } }],
  ["missing service metadata", { model: capabilities.model, auth: capabilities.auth }],
])("fails closed before sending customer text for %s", async (_name, unsafeCapabilities) => {
  const mock = vi.fn().mockResolvedValue(new Response(JSON.stringify(unsafeCapabilities)));
  vi.stubGlobal("fetch", mock);
  const text = await new Response(createXavaniChatStream(
    config, [{ role: "user", content: "private business data" }],
  )).text();
  expect(text).toBe('data: {"error":"CHAT_UNAVAILABLE"}\n\n');
  expect(mock).toHaveBeenCalledTimes(1);
  expect(mock.mock.calls[0][0]).toBe(`${config.baseUrl}/v1/capabilities`);
  const request = mock.mock.calls[0][1];
  expect(request.headers.Authorization).toBe(`Bearer ${config.apiKey}`);
  expect(request).not.toHaveProperty("body");
});
