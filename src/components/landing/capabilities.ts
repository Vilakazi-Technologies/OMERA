export type CapabilityId = "chat" | "forms" | "voice" | "languages" | "teams";

export type Capability = {
  id: CapabilityId;
  word: string;
  title: string;
  description: string;
  hue: string;
};

/**
 * Measured product claims only.
 *
 * Language voice routes follow the documented support matrix; measured
 * speech quality is unrecorded until consented product recordings are
 * evaluated. Form support covers fillable AcroForm PDFs; flat or scanned
 * documents need an approved template. No enterprise, privacy, or
 * persistence promises are made here.
 */
export const CAPABILITIES: Capability[] = [
  {
    id: "chat",
    word: "chat",
    title: "Everyday conversation",
    description:
      "Ask questions in plain language and get thoughtful answers — tuned for South African context.",
    hue: "from-indigo-500/30 via-violet-500/10 to-transparent",
  },
  {
    id: "forms",
    word: "forms",
    title: "Voice-supported paperwork",
    description:
      "Upload a fillable PDF form. Omera reads the fields and asks one question at a time — answer by typing or speaking, then review before export. Scanned documents need an approved template.",
    hue: "from-emerald-500/35 via-teal-500/10 to-transparent",
  },
  {
    id: "voice",
    word: "voice",
    title: "Quiet for the office",
    description:
      "Questions appear as text; answers can be typed or spoken where a voice route exists. No loud prompts in open-plan workspaces.",
    hue: "from-cyan-500/25 via-emerald-500/15 to-transparent",
  },
  {
    id: "languages",
    word: "languages",
    title: "11 spoken languages",
    description:
      "Typed input works in all eleven official languages. Voice input follows the documented support status, and measured speech quality is unrecorded until product recordings are evaluated.",
    hue: "from-sky-500/25 via-indigo-500/10 to-transparent",
  },
  {
    id: "teams",
    word: "teams",
    title: "Pilots with VILATECH",
    description:
      "Teams that process the same forms every month can run a pilot with Omera through VILATECH. Scope and support terms are agreed per pilot.",
    hue: "from-amber-500/15 via-white/5 to-transparent",
  },
];
