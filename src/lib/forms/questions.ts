/**
 * One-question-at-a-time form flow (I4). Exactly one field is active per
 * screen. Translated prompts are display text only — field identity always
 * stays the canonical server ID. Raw input is preserved verbatim through
 * `preserveAnswer` (never the demo speech parser). Optional blanks are kept
 * with an explicit Skip; Back and Edit never erase later answers.
 */

import { preserveAnswer } from "@/lib/forms/answers";

export type QuestionField = {
  id: string;
  label: string;
  prompt: string;
  required: boolean;
  value?: string | boolean;
};

export type QuestionFlow = {
  fields: QuestionField[];
  currentIndex: number;
  languageId: string;
};

export type ActiveQuestion = {
  field: QuestionField;
  index: number;
  total: number;
  languageId: string;
};

/** The single active question, or null when every field is answered. */
export function activeQuestion(flow: QuestionFlow): ActiveQuestion | null {
  const field = flow.fields[flow.currentIndex];
  if (!field) return null;
  return {
    field,
    index: flow.currentIndex,
    total: flow.fields.length,
    languageId: flow.languageId,
  };
}

/** Record an answer and advance. The value is preserved, never inferred. */
export function answerQuestion(
  flow: QuestionFlow,
  rawValue: string | boolean,
): QuestionFlow {
  const field = flow.fields[flow.currentIndex];
  if (!field) throw new Error("NO_ACTIVE_QUESTION");
  const value = typeof rawValue === "boolean" ? rawValue : preserveAnswer(rawValue);
  return {
    ...flow,
    fields: flow.fields.map((entry, index) =>
      index === flow.currentIndex ? { ...entry, value } : entry,
    ),
    currentIndex: flow.currentIndex + 1,
  };
}

/** Skip an optional field, keeping its blank value explicit. */
export function skipQuestion(flow: QuestionFlow): QuestionFlow {
  const field = flow.fields[flow.currentIndex];
  if (!field) throw new Error("NO_ACTIVE_QUESTION");
  if (field.required) throw new Error("SKIP_REQUIRED_FIELD");
  return {
    ...flow,
    fields: flow.fields.map((entry, index) =>
      index === flow.currentIndex ? { ...entry, value: undefined } : entry,
    ),
    currentIndex: flow.currentIndex + 1,
  };
}

/** Edit any earlier answer. Later answers are kept untouched. */
export function editAnswer(
  flow: QuestionFlow,
  index: number,
  rawValue: string | boolean,
): QuestionFlow {
  const field = flow.fields[index];
  if (!field) throw new Error("UNKNOWN_QUESTION_INDEX");
  const value = typeof rawValue === "boolean" ? rawValue : preserveAnswer(rawValue);
  return {
    ...flow,
    fields: flow.fields.map((entry, position) =>
      position === index ? { ...entry, value } : entry,
    ),
  };
}

/** Step back one question without erasing anything. */
export function goBack(flow: QuestionFlow): QuestionFlow {
  return { ...flow, currentIndex: Math.max(0, flow.currentIndex - 1) };
}
