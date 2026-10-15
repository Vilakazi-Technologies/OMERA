import { describe, expect, it } from "vitest";
import { readBody, readJsonBody } from "@/lib/http/read-body";

function request(body: BodyInit) {
  const init = { method: "POST", body, duplex: "half" };
  return new Request("http://127.0.0.1:3100/api/chat", init);
}

describe("request byte limits", () => {
  it("accepts the exact byte limit", async () => {
    const input = new TextEncoder().encode("éé");
    expect(await readBody(request(input), input.byteLength)).toEqual(input);
  });

  it("rejects an oversized open producer without Content-Length", async () => {
    let cancelled = 0;
    const body = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new Uint8Array(5)); },
      cancel() { cancelled += 1; },
    });
    const input = request(body);
    expect(input.headers.has("Content-Length")).toBe(false);
    await expect(readBody(input, 4)).rejects.toMatchObject({
      code: "REQUEST_TOO_LARGE", status: 413,
    });
    expect(cancelled).toBe(1);
    expect(input.body?.locked).toBe(false);
  });

  it("preserves a size error through JSON parsing", async () => {
    await expect(readJsonBody(request('{"name":"value"}'), 1)).rejects.toMatchObject({
      code: "REQUEST_TOO_LARGE", status: 413,
    });
  });

  it("parses a valid JSON body", async () => {
    expect(await readJsonBody(request('{"name":"Thandi"}'))).toEqual({ name: "Thandi" });
  });

  it("rejects invalid JSON", async () => {
    await expect(readJsonBody(request("{"))).rejects.toMatchObject({
      code: "INVALID_JSON", status: 400,
    });
  });

  it("rejects invalid UTF-8", async () => {
    await expect(readJsonBody(request(new Uint8Array([195])))).rejects.toMatchObject({
      code: "INVALID_JSON", status: 400,
    });
  });
});
