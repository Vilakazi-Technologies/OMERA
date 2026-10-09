import type { FormField } from "./types";

/** Stakeholder demo: inferred fields from any uploaded PDF/image name. */
export function analyzeFormDemo(fileName: string): FormField[] {
  const base = fileName.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ");

  return [
    {
      id: "first_name",
      label: "First name",
      type: "text",
      required: true,
      prompt: `What is your first name? (Form: ${base || "uploaded document"})`,
    },
    {
      id: "last_name",
      label: "Last name",
      type: "text",
      required: true,
      prompt: "What is your surname or family name?",
    },
    {
      id: "id_number",
      label: "South African ID number",
      type: "id",
      required: true,
      prompt: "Please say your 13-digit South African ID number slowly.",
    },
    {
      id: "email",
      label: "Email address",
      type: "email",
      required: true,
      prompt: "What email address should we use on this form?",
    },
    {
      id: "phone",
      label: "Cellphone number",
      type: "phone",
      required: true,
      prompt: "What is your cellphone number, including area code?",
    },
    {
      id: "employer",
      label: "Employer / company",
      type: "text",
      required: false,
      prompt: "Which company or employer is this form for?",
    },
  ];
}

export function extractFieldFromSpeech(
  field: FormField,
  transcript: string,
): string {
  const t = transcript.trim();
  if (!t) return "";

  const lower = t.toLowerCase();

  if (field.id === "first_name") {
    const m = lower.match(
      /(?:first name is|igama lami ngu|my name is|naam is)\s+([a-z]+)/i,
    );
    if (m) return capitalize(m[1]);
    const words = t.split(/\s+/);
    return capitalize(words[words.length - 1] ?? t);
  }

  if (field.id === "last_name") {
    const m = lower.match(
      /(?:surname is|last name is|isibongo|van is|family name is)\s+([a-z]+)/i,
    );
    if (m) return capitalize(m[1]);
    const words = t.split(/\s+/);
    return capitalize(words[words.length - 1] ?? t);
  }

  if (field.type === "email") {
    const m = t.match(/[\w.+-]+@[\w.-]+\.\w+/);
    return m?.[0] ?? t;
  }

  if (field.type === "phone" || field.type === "id") {
    const digits = t.replace(/\D/g, "");
    return digits || t;
  }

  return t;
}

function capitalize(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
