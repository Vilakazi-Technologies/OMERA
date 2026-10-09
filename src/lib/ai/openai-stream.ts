import OpenAI from "openai";
import { OMERA_SYSTEM_PROMPT } from "@/lib/ai/omera-system-prompt";

type ChatMessage = { role: string; content: string };

export function createOpenAIChatStream(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
): ReadableStream<Uint8Array> {
  const openai = new OpenAI({ apiKey });
  const encoder = new TextEncoder();

  const apiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: OMERA_SYSTEM_PROMPT },
    ...messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
  ];

  return new ReadableStream({
    async start(controller) {
      try {
        const completion = await openai.chat.completions.create({
          model,
          messages: apiMessages,
          stream: true,
          temperature: 0.7,
          max_tokens: 2048,
        });

        for await (const part of completion) {
          const token = part.choices[0]?.delta?.content ?? "";
          if (token) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ token })}\n\n`),
            );
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Omera could not reach the AI service.";
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ token: `Sorry — ${message}` })}\n\n`,
          ),
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });
}
