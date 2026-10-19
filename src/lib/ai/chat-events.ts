export async function consumeChatEvents(
  stream: ReadableStream<Uint8Array>,
  onToken: (token: string) => void,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let pending = "";
  let completed = false;
  let receivedToken = false;
  try {
    while (!completed) {
      const chunk = await reader.read();
      pending += chunk.done ? decoder.decode() : decoder.decode(chunk.value, { stream: true });
      pending = pending.replace(/\r\n/g, "\n");
      if (pending.length > 262144) throw new Error("INVALID_CHAT_STREAM");
      let boundary = pending.indexOf("\n\n");
      while (boundary !== -1 && !completed) {
        const frame = pending.slice(0, boundary);
        pending = pending.slice(boundary + 2);
        const data = frame.split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        if (data === "[DONE]") {
          completed = true;
        } else if (data) {
          const event: unknown = JSON.parse(data);
          if (!event || typeof event !== "object") throw new Error("INVALID_CHAT_STREAM");
          if ("error" in event) {
            completed = true;
            throw new Error("CHAT_UNAVAILABLE");
          }
          if (!("token" in event) || typeof event.token !== "string") {
            throw new Error("INVALID_CHAT_STREAM");
          }
          receivedToken = true;
          onToken(event.token);
        }
        boundary = pending.indexOf("\n\n");
      }
      if (chunk.done && !completed) {
        if (receivedToken) {
          completed = true;
        } else {
          throw new Error("INCOMPLETE_CHAT_STREAM");
        }
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
