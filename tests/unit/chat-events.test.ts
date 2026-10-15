import { expect, it } from "vitest";
import { consumeChatEvents } from "@/lib/ai/chat-events";

function bytesStream(bytes: Uint8Array, split: number) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes.slice(0, split));
      controller.enqueue(bytes.slice(split));
      controller.close();
    },
  });
}

it("preserves tokens at every byte boundary", async () => {
  const text = "Ndaa, ṱhank you.";
  const bytes = new TextEncoder().encode(`data: ${JSON.stringify({ token: text })}\r\n\r\ndata: [DONE]\r\n\r\n`);
  for (let split = 1; split < bytes.length; split++) {
    let result = "";
    await consumeChatEvents(bytesStream(bytes, split), (token) => { result += token; });
    expect(result).toBe(text);
  }
});

it("rejects an incomplete or failed stream", async () => {
  for (const text of [
    'data: {"token":"partial"}\n\n',
    'data: {"error":"private provider detail"}\n\n',
    'data: {"unexpected":true}\n\ndata: [DONE]\n\n',
    'data: broken\n\ndata: [DONE]\n\n',
  ]) {
    const bytes = new TextEncoder().encode(text);
    await expect(consumeChatEvents(bytesStream(bytes, 1), () => undefined)).rejects.toThrow();
  }
});

it.each([
  "null",
  "42",
  '{"token":null}',
  '{"token":42}',
  '{"token":true}',
  '{"token":{}}',
  '{"token":[]}',
])("rejects invalid payload %s with the exact public error", async (payload) => {
  const bytes = new TextEncoder().encode(`data: ${payload}\n\ndata: [DONE]\n\n`);
  const tokens: string[] = [];
  await expect(consumeChatEvents(bytesStream(bytes, 1), (token) => tokens.push(token)))
    .rejects.toMatchObject({ message: "INVALID_CHAT_STREAM" });
  expect(tokens).toEqual([]);
});

it("replaces private provider details with the exact public error", async () => {
  const bytes = new TextEncoder().encode('data: {"error":"private provider detail"}\n\n');
  const tokens: string[] = [];
  await expect(consumeChatEvents(bytesStream(bytes, 1), (token) => tokens.push(token)))
    .rejects.toMatchObject({ message: "CHAT_UNAVAILABLE" });
  expect(tokens).toEqual([]);
});

it("rejects EOF without DONE with the exact incomplete-stream error", async () => {
  const bytes = new TextEncoder().encode('data: {"token":"partial"}\n\n');
  const tokens: string[] = [];
  await expect(consumeChatEvents(bytesStream(bytes, 1), (token) => tokens.push(token)))
    .rejects.toMatchObject({ message: "INCOMPLETE_CHAT_STREAM" });
  expect(tokens).toEqual(["partial"]);
});

it.each([262144, 262145])("enforces the decoded-character buffer boundary at %i", async (length) => {
  const prefix = 'data: {"token":"';
  const suffix = '"}\n\n';
  const token = "ṹ".repeat(length - prefix.length - suffix.length);
  const frame = new TextEncoder().encode(`${prefix}${token}${suffix}`);
  const done = new TextEncoder().encode("data: [DONE]\n\n");
  const bytes = new Uint8Array([...frame, ...done]);
  const tokens: string[] = [];
  const result = consumeChatEvents(bytesStream(bytes, frame.length), (value) => tokens.push(value));
  if (length === 262144) {
    await expect(result).resolves.toBeUndefined();
    expect(tokens).toEqual([token]);
  } else {
    await expect(result).rejects.toMatchObject({ message: "INVALID_CHAT_STREAM" });
    expect(tokens).toEqual([]);
  }
});

it("ignores comments and empty SSE frames without emitting tokens", async () => {
  const bytes = new TextEncoder().encode(
    ': comment\n\n\n\ndata:\n\ndata: {"token":"first"}\n\n: another comment\n\ndata: {"token":"second"}\n\ndata: [DONE]\n\n',
  );
  const tokens: string[] = [];
  await consumeChatEvents(bytesStream(bytes, 1), (token) => tokens.push(token));
  expect(tokens).toEqual(["first", "second"]);
});

it("rejects invalid UTF-8 inside an otherwise valid token frame and releases the lock", async () => {
  const prefix = new TextEncoder().encode('data: {"token":"valid');
  const suffix = new TextEncoder().encode('"}\n\ndata: [DONE]\n\n');
  const bytes = new Uint8Array([...prefix, 0xff, ...suffix]);
  const stream = bytesStream(bytes, 1);
  const tokens: string[] = [];
  await expect(consumeChatEvents(stream, (token) => tokens.push(token))).rejects.toBeInstanceOf(TypeError);
  expect(tokens).toEqual([]);
  expect(stream.locked).toBe(false);
});

it.each([
  ["success", 'data: {"token":"ok"}\n\ndata: [DONE]\n\n', undefined],
  ["provider rejection", 'data: {"error":"private"}\n\n', "CHAT_UNAVAILABLE"],
  ["payload rejection", 'data: null\n\n', "INVALID_CHAT_STREAM"],
  ["JSON rejection", 'data: broken\n\n', undefined],
  ["incomplete rejection", 'data: {"token":"partial"}\n\n', "INCOMPLETE_CHAT_STREAM"],
])("releases the stream reader lock after %s", async (outcome, text, message) => {
  const bytes = new TextEncoder().encode(text);
  const stream = bytesStream(bytes, 1);
  const result = consumeChatEvents(stream, () => undefined);
  if (outcome === "success") {
    await expect(result).resolves.toBeUndefined();
  } else if (message) {
    await expect(result).rejects.toMatchObject({ message });
  } else {
    await expect(result).rejects.toBeInstanceOf(SyntaxError);
  }
  expect(stream.locked).toBe(false);
  const nextReader = stream.getReader();
  await expect(nextReader.read()).resolves.toEqual({ done: true, value: undefined });
  nextReader.releaseLock();
});

function openBytesStream(text: string, rejectCancel: boolean, cancellations: string[]) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
    },
    cancel() {
      cancellations.push("cancel");
      if (rejectCancel) return Promise.reject(new Error("CANCEL_FAILURE"));
    },
  });
}

it.each([
  ["success", false],
  ["success", true],
  ["rejection", false],
  ["rejection", true],
] as const)("cancels an open producer after %s with rejectCancel=%s", async (outcome, rejectCancel) => {
  const cancellations: string[] = [];
  const text = outcome === "success"
    ? 'data: {"token":"ok"}\n\ndata: [DONE]\n\n'
    : 'data: {"error":"private provider detail"}\n\n';
  const stream = openBytesStream(text, rejectCancel, cancellations);
  const tokens: string[] = [];
  const result = consumeChatEvents(stream, (token) => tokens.push(token));
  if (outcome === "success") {
    await expect(result).resolves.toBeUndefined();
    expect(tokens).toEqual(["ok"]);
  } else {
    await expect(result).rejects.toMatchObject({ message: "CHAT_UNAVAILABLE" });
    expect(tokens).toEqual([]);
  }
  expect(cancellations).toEqual(["cancel"]);
  expect(stream.locked).toBe(false);
  const nextReader = stream.getReader();
  await expect(nextReader.read()).resolves.toEqual({ done: true, value: undefined });
  nextReader.releaseLock();
});
