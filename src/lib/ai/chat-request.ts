import { z } from "zod";
import { SA_LANGUAGES } from "@/lib/languages";

export const languageIdSchema = z.string().refine(
  (id) => SA_LANGUAGES.some((language) => language.id === id),
  "INVALID_LANGUAGE",
);

export const chatRequestSchema = z.object({
  conversationId: z.uuid().optional(),
  replyLanguageId: languageIdSchema.nullable().default(null),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(8000).refine((text) => text.trim().length > 0),
  }).strict()).min(1).max(40),
}).strict().refine(
  (body) => body.messages.at(-1)?.role === "user",
  "LAST_MESSAGE_MUST_BE_USER",
).refine(
  (body) => body.messages.reduce((total, message) => total + message.content.length, 0) <= 32000,
  "CONVERSATION_TOO_LARGE",
);

export type ChatRequest = z.infer<typeof chatRequestSchema>;
