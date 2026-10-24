import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  clearXavaniBreaker,
  clearXavaniCapabilityCache,
  completeXavaniJson,
  createXavaniChatStream,
  getXavaniConfig,
  xavaniIsDown,
  xavaniReachable,
  xavaniResearchAvailable,
} from "@/lib/ai/xavani-client";

const config = { baseUrl: "https://xavani.example.test", apiKey: "test-...ey", model: "omera" };
afterEach(() => {
  vi.unstubAllGlobals();
  clearXavaniCapabilityCache();
});
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

const done = "data: [DONE]\n\n";
const unavailable = 'data: {"error":"CHAT_UNAVAILABLE"}\n\n';
const encoder = new TextEncoder();
function frame(payload: unknown) {
  return `data: ${JSON.stringify(payload)}\n\n`;
}
function chunkedResponse(chunks: Uint8Array[], contentType = "text/event-stream") {
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  }), { headers: { "Content-Type": contentType } });
}
async function chatText(response: Response) {
  vi.stubGlobal("fetch", ready(response));
  return new Response(createXavaniChatStream(config, [{ role: "user", content: "Help." }])).text();
}
function expectUnavailable(text: string) {
  expect(text).toContain(unavailable);
  expect(text).not.toContain(done);
  expect(text).not.toContain("private upstream detail");
  expect(text).not.toContain("XAVANI_");
}

describe("C05-B stream envelope characterization", () => {
  it("accepts message events, comments, empty data and null/empty content before Unicode", async () => {
    const text = await chatText(streamResponse(
      ': keepalive\r\n\r\ndata:\r\n\r\n' +
      frame({ choices: [{ delta: { content: null }, finish_reason: null }] }) +
      event("") + 'event: message\r\n' + event("Ṱhendo 🌍").replace(/\n/g, "\r\n") +
      event(null, "stop") + done,
    ));
    expect(text).toBe('data: {"token":"Ṱhendo 🌍"}\n\n' + done);
  });

  it.each([
    ["wrong content type", () => new Response(event("private upstream detail") + event(null, "stop") + done)],
    ["missing body", () => new Response(null, { headers: { "Content-Type": "text/event-stream" } })],
    ["malformed JSON", () => streamResponse('data: {private upstream detail\n\n')],
    ["invalid UTF-8", () => chunkedResponse([new Uint8Array([0xc3, 0x28])])],
    ["truncated UTF-8 at EOF", () => chunkedResponse([new Uint8Array([0xc3])])],
    ...[
      ["primitive payload", "private upstream detail"],
      ["array payload", []],
      ["null payload", null],
      ["missing choices", {}],
      ["empty choices", { choices: [] }],
      ["multiple choices", { choices: [{ delta: {} }, { delta: {} }] }],
      ["primitive choice", { choices: [1] }],
      ["missing delta", { choices: [{}] }],
      ["null delta", { choices: [{ delta: null }] }],
      ["array delta", { choices: [{ delta: [] }] }],
      ["primitive delta", { choices: [{ delta: "private upstream detail" }] }],
      ["non-string content", { choices: [{ delta: { content: 7 } }] }],
      ["tool calls", { choices: [{ delta: { tool_calls: [{ name: "private upstream detail" }] } }] }],
      ["upstream error", { error: { message: "private upstream detail" } }],
      ["failed metadata", { choices: [{ delta: {} }], xavani: { failed: true } }],
      ["partial metadata", { choices: [{ delta: {} }], xavani: { partial: true } }],
      ["incomplete metadata", { choices: [{ delta: {} }], xavani: { completed: false } }],
    ].map(([name, payload]) => [name, () => streamResponse(frame(payload) + done)] as const),
    ["named tool event", () => streamResponse('event: tool\ndata: {"private upstream detail":true}\n\n')],
    ["content after stop", () => streamResponse(event("first") + event(null, "stop") + event("private upstream detail") + done)],
    ["whitespace-only output", () => streamResponse(event(" \t\n") + event(null, "stop") + done)],
    ["EOF without DONE", () => streamResponse(event("first") + event(null, "stop"))],
    ["DONE before stop", () => streamResponse(event("first") + done)],
    ["DONE without visible output", () => streamResponse(event(null, "stop") + done)],
  ] as const)("rejects %s without success or private details", async (_name, response) => {
    expectUnavailable(await chatText(response()));
  });

  it("accepts exactly 262144 pending characters with completion in a separate chunk", async () => {
    const content = "Ṱ".repeat(262144 - event("").length);
    const first = event(content);
    expect(first.length).toBe(262144);
    expect(encoder.encode(first).byteLength).toBeGreaterThan(262144);
    const text = await chatText(chunkedResponse([encoder.encode(first), encoder.encode(event(null, "stop") + done)]));
    expect(text).toBe(`data: ${JSON.stringify({ token: content })}\n\n` + done);
  });

  it("rejects 262145 pending characters even when a later chunk would complete", async () => {
    const first = event("x".repeat(262145 - event("").length));
    expect(first.length).toBe(262145);
    expect(await chatText(chunkedResponse([encoder.encode(first), encoder.encode(event(null, "stop") + done)])))
      .toBe(unavailable);
  });
});

function jsonEnvelope(content = '{"ok":true}') {
  return { choices: [{ message: { content }, finish_reason: "stop" }] };
}
function complete(parse: (value: unknown) => unknown, signal?: AbortSignal) {
  return completeXavaniJson(config, "Return JSON only.", "Check.", parse, signal);
}

describe("C05-B JSON envelope and byte-boundary characterization", () => {
  it("preserves byte-split Unicode and returns the callback's actual value", async () => {
    const value = { greeting: "Ṱhendo 🌍" };
    const raw = encoder.encode(JSON.stringify({ ...jsonEnvelope(JSON.stringify(value)), xavani: { completed: true } }));
    const mock = ready(chunkedResponse(Array.from(raw, (byte) => new Uint8Array([byte])), "application/json"));
    vi.stubGlobal("fetch", mock);
    const returned = { validated: value.greeting };
    const parse = vi.fn().mockReturnValue(returned);
    expect(await complete(parse)).toBe(returned);
    expect(parse).toHaveBeenCalledExactlyOnceWith(value);
    expect(JSON.parse(mock.mock.calls[1][1].body)).toMatchObject({
      stream: false,
      messages: [{ role: "system", content: "Return JSON only." }, { role: "user", content: "Check." }],
    });
  });

  it("propagates the supplied parser's rejection rather than returning unvalidated JSON", async () => {
    vi.stubGlobal("fetch", ready(new Response(JSON.stringify(jsonEnvelope()))));
    const failure = new Error("schema rejected");
    const parse = vi.fn(() => { throw failure; });
    await expect(complete(parse)).rejects.toBe(failure);
    expect(parse).toHaveBeenCalledExactlyOnceWith({ ok: true });
  });

  it.each([
    ["top-level error", { ...jsonEnvelope(), error: { message: "private upstream detail" } }],
    ["primitive envelope", 1],
    ["array envelope", []],
    ["null envelope", null],
    ["missing choices", {}],
    ["non-array choices", { choices: {} }],
    ["empty choices", { choices: [] }],
    ["multiple choices", { choices: [...jsonEnvelope().choices, ...jsonEnvelope().choices] }],
    ["null choice", { choices: [null] }],
    ["array choice", { choices: [[]] }],
    ["missing finish", { choices: [{ message: { content: '{"ok":true}' } }] }],
    ["null finish", { choices: [{ ...jsonEnvelope().choices[0], finish_reason: null }] }],
    ["partial finish", { choices: [{ ...jsonEnvelope().choices[0], finish_reason: "length" }] }],
    ["missing message", { choices: [{ finish_reason: "stop" }] }],
    ["null message", { choices: [{ finish_reason: "stop", message: null }] }],
    ["array message", { choices: [{ finish_reason: "stop", message: [] }] }],
    ["primitive message", { choices: [{ finish_reason: "stop", message: "private upstream detail" }] }],
    ["missing content", { choices: [{ finish_reason: "stop", message: {} }] }],
    ["null content", { choices: [{ finish_reason: "stop", message: { content: null } }] }],
    ["object content", { choices: [{ finish_reason: "stop", message: { content: { ok: true } } }] }],
    ["number content", { choices: [{ finish_reason: "stop", message: { content: 7 } }] }],
    ["malformed JSON content", jsonEnvelope("{private upstream detail")],
    ["failed metadata", { ...jsonEnvelope(), xavani: { failed: true } }],
    ["partial metadata", { ...jsonEnvelope(), xavani: { partial: true } }],
    ["completed=false metadata", { ...jsonEnvelope(), xavani: { completed: false } }],
    ["invalid metadata", { ...jsonEnvelope(), xavani: [] }],
  ])("rejects %s before calling the parser", async (_name, envelope) => {
    vi.stubGlobal("fetch", ready(new Response(JSON.stringify(envelope))));
    const parse = vi.fn();
    await expect(complete(parse)).rejects.toThrow();
    expect(parse).not.toHaveBeenCalled();
  });

  it.each([
    ["missing body", () => new Response(null)],
    ["malformed outer JSON", () => new Response("{private upstream detail")],
    ["invalid UTF-8", () => chunkedResponse([new Uint8Array([0xc3, 0x28])], "application/json")],
    ["truncated UTF-8", () => chunkedResponse([new Uint8Array([0xc3])], "application/json")],
  ] as const)("rejects %s before calling the parser", async (_name, response) => {
    vi.stubGlobal("fetch", ready(response()));
    const parse = vi.fn();
    await expect(complete(parse)).rejects.toThrow();
    expect(parse).not.toHaveBeenCalled();
  });

  it.each([262144, 262145])("enforces the raw JSON byte cap at %i bytes, not characters", async (size) => {
    const value = { greeting: "Ṱ🌍" };
    const raw = JSON.stringify(jsonEnvelope(JSON.stringify(value)));
    const bytes = encoder.encode(raw);
    const padding = " ".repeat(size - bytes.byteLength);
    expect(bytes.byteLength + encoder.encode(padding).byteLength).toBe(size);
    expect(raw.length + padding.length).toBeLessThan(262144);
    vi.stubGlobal("fetch", ready(chunkedResponse([bytes, encoder.encode(padding)], "application/json")));
    const returned = { validated: true };
    const parse = vi.fn().mockReturnValue(returned);
    if (size === 262144) {
      expect(await complete(parse)).toBe(returned);
      expect(parse).toHaveBeenCalledExactlyOnceWith(value);
    } else {
      await expect(complete(parse)).rejects.toThrow("XAVANI_RESPONSE_TOO_LARGE");
      expect(parse).not.toHaveBeenCalled();
    }
  });
});

describe.each(["chat", "JSON"] as const)("C05-B %s capability and HTTP characterization", (operation) => {
  it.each([
    ["non-OK status", () => new Response("private upstream detail", { status: 503 })],
    ["malformed JSON", () => new Response("{private upstream detail")],
    ["missing body", () => new Response(null)],
    ["primitive payload", () => new Response('"private upstream detail"')],
    ["null payload", () => new Response("null")],
    ["array payload", () => new Response("[]")],
    ["missing authentication", () => new Response(JSON.stringify({ ...capabilities, auth: undefined }))],
    ["non-object authentication", () => new Response(JSON.stringify({ ...capabilities, auth: [] }))],
    ["non-object service", () => new Response(JSON.stringify({ ...capabilities, service: null }))],
  ] as const)("rejects %s with one capability fetch and no customer body", async (_name, response) => {
    const mock = vi.fn().mockResolvedValue(response());
    vi.stubGlobal("fetch", mock);
    const parse = vi.fn();
    if (operation === "chat") {
      expect(await new Response(createXavaniChatStream(config, [{ role: "user", content: "private customer data" }])).text())
        .toBe(unavailable);
    } else {
      await expect(complete(parse)).rejects.toThrow();
      expect(parse).not.toHaveBeenCalled();
    }
    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock.mock.calls[0][0]).toBe(`${config.baseUrl}/v1/capabilities`);
    expect(mock.mock.calls[0][1]).not.toHaveProperty("body");
  });

  it("rejects non-OK chat HTTP responses without direct fallback", async () => {
    const mock = ready(new Response("private upstream detail", { status: 502 }));
    vi.stubGlobal("fetch", mock);
    const parse = vi.fn();
    if (operation === "chat") {
      expect(await new Response(createXavaniChatStream(config, [])).text()).toBe(unavailable);
    } else {
      await expect(complete(parse)).rejects.toThrow("XAVANI_UNAVAILABLE");
      expect(parse).not.toHaveBeenCalled();
    }
    expect(mock).toHaveBeenCalledTimes(2);
    expect(mock.mock.calls.map(([url]) => url)).toEqual([
      `${config.baseUrl}/v1/capabilities`, `${config.baseUrl}/v1/chat/completions`,
    ]);
  });
});

function openResponse(chunks: Uint8Array[], rejectCancel = false, contentType = "text/event-stream") {
  let producer!: ReadableStreamDefaultController<Uint8Array>;
  const cancel = vi.fn(() => rejectCancel ? Promise.reject(new Error("private upstream detail")) : Promise.resolve());
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      producer = controller;
      for (const chunk of chunks) controller.enqueue(chunk);
      // Stay open: cleanup must cancel the producer, not merely observe EOF.
    },
    cancel,
  });
  return { body, producer, cancel, response: new Response(body, { headers: { "Content-Type": contentType } }) };
}

describe("C05-B upstream reader cleanup characterization", () => {
  it.each([
    ["DONE", false], ["DONE", true], ["rejection", false], ["rejection", true],
  ] as const)("cancels an open stream after %s, preserving the result when cancel rejects=%s", async (outcome, rejectCancel) => {
    const upstream = openResponse([encoder.encode(outcome === "DONE"
      ? event("Ṱhendo") + event(null, "stop") + done
      : 'data: {private upstream detail\n\n')], rejectCancel);
    const text = await chatText(upstream.response);
    expect(text).toBe(outcome === "DONE" ? 'data: {"token":"Ṱhendo"}\n\n' + done : unavailable);
    await vi.waitFor(() => {
      expect(upstream.cancel).toHaveBeenCalledTimes(1);
      expect(upstream.body.locked).toBe(false);
    });
  });

  it.each([false, true])("cancels an oversized open JSON body and unlocks when cancel rejects=%s", async (rejectCancel) => {
    const upstream = openResponse([encoder.encode("Ṱ".repeat(87382))], rejectCancel, "application/json");
    vi.stubGlobal("fetch", ready(upstream.response));
    const parse = vi.fn();
    await expect(complete(parse)).rejects.toThrow("XAVANI_RESPONSE_TOO_LARGE");
    expect(parse).not.toHaveBeenCalled();
    await vi.waitFor(() => {
      expect(upstream.cancel).toHaveBeenCalledTimes(1);
      expect(upstream.body.locked).toBe(false);
    });
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
function abortableService(chunks: Uint8Array[] = [], holdFetch = false) {
  const signals: AbortSignal[] = [];
  const started = deferred<AbortSignal>();
  const aborted = deferred<void>();
  const upstream = openResponse(chunks);
  const mock = vi.fn(async (url: string, init: RequestInit) => {
    const signal = init.signal;
    if (!signal) throw new Error("test fetch requires a signal");
    signals.push(signal);
    signal.throwIfAborted();
    if (url.endsWith("/v1/capabilities")) return new Response(JSON.stringify(capabilities));
    started.resolve(signal);
    if (holdFetch) {
      return new Promise<Response>((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          aborted.resolve();
          reject(signal.reason);
        }, { once: true });
      });
    }
    signal.addEventListener("abort", () => {
      upstream.producer.error(signal.reason);
      aborted.resolve();
    }, { once: true });
    return upstream.response;
  });
  vi.stubGlobal("fetch", mock);
  return { mock, signals, started, aborted, upstream };
}

describe("C05-B abort, consumer cancellation and timeout characterization", () => {
  it("aborts an active chat through the captured fetch signal without DONE", async () => {
    const service = abortableService([encoder.encode(event("first"))]);
    const request = new AbortController();
    const reader = createXavaniChatStream(config, [], null, request.signal).getReader();
    const first = await reader.read();
    expect(new TextDecoder().decode(first.value)).toBe('data: {"token":"first"}\n\n');
    const signal = await service.started.promise;
    expect(signal.aborted).toBe(false);
    request.abort(new Error("private upstream detail"));
    await service.aborted.promise;
    const failure = await reader.read();
    expect(new TextDecoder().decode(failure.value)).toBe(unavailable);
    expect(await reader.read()).toEqual({ done: true, value: undefined });
    expect(signal.aborted).toBe(true);
    expect(service.signals).toEqual([signal, signal]);
    expect(service.mock).toHaveBeenCalledTimes(2);
    await vi.waitFor(() => expect(service.upstream.body.locked).toBe(false));
    reader.releaseLock();
  });

  it("aborts active JSON reading without calling the supplied parser", async () => {
    const service = abortableService([encoder.encode(JSON.stringify(jsonEnvelope()))]);
    const request = new AbortController();
    const parse = vi.fn();
    const result = complete(parse, request.signal);
    const signal = await service.started.promise;
    await vi.waitFor(() => expect(service.upstream.body.locked).toBe(true));
    const reason = new Error("request cancelled");
    const rejected = expect(result).rejects.toBe(reason);
    request.abort(reason);
    await rejected;
    await service.aborted.promise;
    expect(signal.aborted).toBe(true);
    expect(service.signals).toEqual([signal, signal]);
    expect(parse).not.toHaveBeenCalled();
    expect(service.mock).toHaveBeenCalledTimes(2);
    await vi.waitFor(() => expect(service.upstream.body.locked).toBe(false));
  });

  it.each([false, true])("consumer cancellation aborts fetch with no completion, in-flight fetch=%s", async (holdFetch) => {
    const service = abortableService([encoder.encode(event("first"))], holdFetch);
    const reader = createXavaniChatStream(config, []).getReader();
    const signal = await service.started.promise;
    if (!holdFetch) {
      const first = await reader.read();
      expect(new TextDecoder().decode(first.value)).toBe('data: {"token":"first"}\n\n');
    }
    const pending = reader.read();
    expect(signal.aborted).toBe(false);
    await reader.cancel("consumer stopped");
    await service.aborted.promise;
    expect(signal.aborted).toBe(true);
    expect(service.signals).toEqual([signal, signal]);
    expect(await pending).toEqual({ done: true, value: undefined });
    expect(await reader.read()).toEqual({ done: true, value: undefined });
    expect(service.mock).toHaveBeenCalledTimes(2);
    await vi.waitFor(() => expect(service.upstream.body.locked).toBe(false));
    reader.releaseLock();
  });

  it.each(["chat", "JSON"] as const)("uses and honors the 120000ms %s timeout without waiting for it", async (operation) => {
    const expiry = new AbortController();
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(expiry.signal);
    const service = abortableService([], true);
    const parse = vi.fn();
    const result = operation === "chat"
      ? new Response(createXavaniChatStream(config, [])).text()
      : complete(parse);
    const signal = await service.started.promise;
    expect(timeout).toHaveBeenCalledExactlyOnceWith(120000);
    expect(signal.aborted).toBe(false);
    const reason = new DOMException("deadline expired", "TimeoutError");
    const checked = operation === "chat" ? expect(result).resolves.toBe(unavailable) : expect(result).rejects.toBe(reason);
    expiry.abort(reason);
    await checked;
    await service.aborted.promise;
    expect(signal.aborted).toBe(true);
    expect(service.signals).toEqual([signal, signal]);
    expect(parse).not.toHaveBeenCalled();
    expect(service.mock).toHaveBeenCalledTimes(2);
  });
});

it.each([false, true])("cancels an incorrectly typed upstream response when cancel rejects=%s", async (rejectCancel) => {
  const upstream = openResponse([encoder.encode("private upstream detail")], rejectCancel, "application/json");
  expect(await chatText(upstream.response)).toBe(unavailable);
  expect(upstream.cancel).toHaveBeenCalledTimes(1);
  expect(upstream.body.locked).toBe(false);
  const reader = upstream.body.getReader();
  await expect(reader.read()).resolves.toEqual({ done: true, value: undefined });
  reader.releaseLock();
});

it("forwards the research flag only when asked", async () => {
  const mock = ready(streamResponse(event("Hi") + event(null, "stop") + "data: [DONE]\n\n"));
  vi.stubGlobal("fetch", mock);
  await new Response(createXavaniChatStream(
    config,
    [{ role: "user", content: "Help." }],
    "ven",
    undefined,
    null,
    true,
  )).text();
  const body = JSON.parse(mock.mock.calls[1][1].body);
  expect(body.xavani_research).toBe(true);
});

it("does not send the research flag by default", async () => {
  const mock = ready(streamResponse(event("Hi") + event(null, "stop") + "data: [DONE]\n\n"));
  vi.stubGlobal("fetch", mock);
  await new Response(createXavaniChatStream(
    config, [{ role: "user", content: "Help." }], "ven",
  )).text();
  const body = JSON.parse(mock.mock.calls[1][1].body);
  expect(body).not.toHaveProperty("xavani_research");
});

it("reads the research capability and tolerates its absence", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(
    new Response(JSON.stringify(capabilities)),
  ));
  await expect(xavaniResearchAvailable(undefined, config)).resolves.toBe(false);

  clearXavaniCapabilityCache();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
    ...capabilities,
    service: { ...capabilities.service, research: { enabled: true, server_side: true } },
  }))));
  await expect(xavaniResearchAvailable(undefined, config)).resolves.toBe(true);
});

it("marks the service down after a failed probe", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
  await expect(xavaniReachable(undefined, config)).resolves.toBe(false);
  expect(xavaniIsDown()).toBe(true);

  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  await expect(xavaniReachable(undefined, config)).resolves.toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
});

it("clears the breaker after a successful probe", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
  await xavaniReachable(undefined, config);
  expect(xavaniIsDown()).toBe(true);

  clearXavaniBreaker();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(
    new Response(JSON.stringify(capabilities)),
  ));
  await expect(xavaniReachable(undefined, config)).resolves.toBe(true);
  expect(xavaniIsDown()).toBe(false);
});
