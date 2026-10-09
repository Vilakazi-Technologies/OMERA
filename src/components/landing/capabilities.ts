export type CapabilityId = "chat" | "forms" | "voice" | "languages" | "teams";

export type Capability = {
  id: CapabilityId;
  word: string;
  title: string;
  description: string;
  hue: string;
};

export const CAPABILITIES: Capability[] = [
  {
    id: "chat",
    word: "chat",
    title: "Everyday conversation",
    description:
      "The same rhythm you know from leading assistants — threads, history, and a composer at the bottom.",
    hue: "from-indigo-500/30 via-violet-500/10 to-transparent",
  },
  {
    id: "forms",
    word: "forms",
    title: "Voice-powered paperwork",
    description:
      "Upload a PDF. Omera reads the fields and asks you questions — you answer by typing or speaking.",
    hue: "from-emerald-500/35 via-teal-500/10 to-transparent",
  },
  {
    id: "voice",
    word: "voice",
    title: "Quiet for the office",
    description:
      "Questions appear as text; answers can be spoken. No loud prompts in open-plan workspaces.",
    hue: "from-cyan-500/25 via-emerald-500/15 to-transparent",
  },
  {
    id: "languages",
    word: "languages",
    title: "Eleven official languages",
    description:
      "Built for multilingual South Africa so more people can participate without switching to English first.",
    hue: "from-sky-500/25 via-indigo-500/10 to-transparent",
  },
  {
    id: "teams",
    word: "teams",
    title: "Enterprise-ready",
    description:
      "Insurance, HR, and operations teams processing the same forms every month — with POPIA-conscious design.",
    hue: "from-amber-500/15 via-white/5 to-transparent",
  },
];
