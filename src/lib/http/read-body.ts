import { ApiError } from "@/lib/http/api-error";

export async function readBody(request: Request, limit: number): Promise<Uint8Array> {
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error("INVALID_BODY_LIMIT");
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      length += item.value.byteLength;
      if (length > limit) throw new ApiError("REQUEST_TOO_LARGE", 413);
      chunks.push(item.value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function readJsonBody(request: Request, limit = 256000): Promise<unknown> {
  const bytes = await readBody(request, limit);
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new ApiError("INVALID_JSON", 400);
  }
}
