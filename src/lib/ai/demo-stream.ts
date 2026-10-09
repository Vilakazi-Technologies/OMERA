const DEMO_REPLIES: Record<string, string> = {
  default:
    "I'm **Omera**, a **VILATECH** product built in South Africa. I can help with everyday questions, work, and — our specialty — **filling in forms by voice**. Open **Form fill** in the sidebar to upload a PDF and answer by speaking.",
  form:
    "Open **Form fill** from the sidebar, upload your document, and I'll walk you through each field. Questions appear as text so it's office-friendly; you answer by voice in any of our supported languages.",
  languages:
    "Omera supports **all eleven official South African languages**. Choose your language in the composer before you speak — answers can be typed or voiced.",
  metropolitan:
    "For teams like **Metropolitan**, Form fill means staff upload recurring templates once, then complete them by voice at their desk — quiet for the floor, fast for operations.",
};

function pickReply(prompt: string): string {
  const p = prompt.toLowerCase();
  if (p.includes("form") || p.includes("upload")) return DEMO_REPLIES.form;
  if (p.includes("language") || p.includes("zulu") || p.includes("afrikaans"))
    return DEMO_REPLIES.languages;
  if (p.includes("metropolitan") || p.includes("office"))
    return DEMO_REPLIES.metropolitan;
  return DEMO_REPLIES.default;
}

/** SSE stream matching the web client (`{ token }` chunks). */
export function createDemoChatStream(lastUserMessage: string): ReadableStream<Uint8Array> {
  const content = pickReply(lastUserMessage);
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      const words = content.split(/(\s+)/);
      let i = 0;
      const tick = () => {
        if (i >= words.length) {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }
        const chunk = words.slice(i, i + 3).join("");
        i += 3;
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ token: chunk })}\n\n`),
        );
        setTimeout(tick, 28);
      };
      tick();
    },
  });
}
