import OpenAI from "openai";
import { analyzeFormDemo } from "@/lib/form-demo";
import type { FormField } from "@/lib/types";
import { getOpenAIConfig } from "@/lib/ai/config";

const FIELD_SCHEMA = `Return JSON only: { "fields": [ { "id": "snake_case", "label": "Human label", "type": "text|email|phone|date|id", "required": true, "prompt": "Question to ask the user" } ] }`;

export async function extractFormFields(
  fileName: string,
  documentText: string,
): Promise<FormField[]> {
  const { apiKey, enabled } = getOpenAIConfig();
  if (!enabled || !apiKey || documentText.length < 20) {
    return analyzeFormDemo(fileName);
  }

  const openai = new OpenAI({ apiKey });
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You analyse South African forms (PDFs, applications, HR, insurance). " +
          FIELD_SCHEMA,
      },
      {
        role: "user",
        content: `File: ${fileName}\n\nDocument text:\n${documentText.slice(0, 12000)}`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(raw) as { fields?: FormField[] };
    if (parsed.fields?.length) return parsed.fields;
  } catch {
    /* fallback */
  }
  return analyzeFormDemo(fileName);
}
