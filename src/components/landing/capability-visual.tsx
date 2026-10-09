"use client";

import { AnimatePresence, motion } from "framer-motion";
import { SA_LANGUAGES } from "@/lib/languages";
import type { CapabilityId } from "@/components/landing/capabilities";
import { cn } from "@/lib/cn";

function ChatPreview() {
  return (
    <div className="flex h-full flex-col justify-end gap-3 p-6">
      <div className="ml-auto max-w-[85%] rounded-2xl bg-white/12 px-4 py-3 text-sm text-white/90">
        Draft a client email for our Johannesburg branch.
      </div>
      <div className="max-w-[90%] rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-relaxed text-white/75">
        Here is a concise, professional draft you can send today…
      </div>
    </div>
  );
}

function FormsPreview() {
  return (
    <div className="flex h-full flex-col justify-center gap-4 p-6">
      <div className="rounded-xl border border-dashed border-white/20 bg-white/5 p-4 text-center text-xs text-white/50">
        onboarding-form.pdf
      </div>
      <div className="rounded-xl bg-white/8 p-4 text-sm text-white/85">
        <p className="text-[10px] uppercase tracking-wider text-white/40">
          Omera
        </p>
        <p className="mt-2">What is your surname as on your ID?</p>
      </div>
      <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-3 text-sm text-emerald-100/90">
        Voice answer captured → field filled
      </div>
    </div>
  );
}

function VoicePreview() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-6">
      <div className="flex h-16 items-end justify-center gap-1">
        {Array.from({ length: 24 }).map((_, i) => (
          <motion.span
            key={i}
            className="w-1 rounded-full bg-emerald-400/80"
            animate={{ height: [8, 12 + (i % 5) * 8, 10] }}
            transition={{
              duration: 0.9,
              repeat: Infinity,
              delay: i * 0.04,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
      <p className="max-w-xs text-center text-sm text-white/60">
        Speak in the language you prefer. Questions stay on screen.
      </p>
    </div>
  );
}

function LanguagesPreview() {
  return (
    <div className="flex h-full flex-wrap content-center gap-2 p-6">
      {SA_LANGUAGES.slice(0, 8).map((lang) => (
        <span
          key={lang.id}
          className="rounded-full border border-white/12 bg-white/6 px-3 py-1.5 text-xs text-white/70"
        >
          {lang.nativeName}
        </span>
      ))}
      <span className="rounded-full border border-white/12 px-3 py-1.5 text-xs text-white/40">
        +3 more
      </span>
    </div>
  );
}

function TeamsPreview() {
  return (
    <div className="flex h-full flex-col justify-center gap-4 p-6">
      {["Metropolitan", "HR onboarding", "Claims intake"].map((row) => (
        <div
          key={row}
          className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3"
        >
          <span className="text-sm text-white/80">{row}</span>
          <span className="text-[10px] tracking-wider text-emerald-400/90 uppercase">
            Live
          </span>
        </div>
      ))}
    </div>
  );
}

const PREVIEWS: Record<CapabilityId, () => React.ReactNode> = {
  chat: ChatPreview,
  forms: FormsPreview,
  voice: VoicePreview,
  languages: LanguagesPreview,
  teams: TeamsPreview,
};

export function CapabilityVisual({
  active,
  hueClass,
}: {
  active: CapabilityId;
  hueClass: string;
}) {
  const Preview = PREVIEWS[active];
  return (
    <div className="relative aspect-[4/5] w-full max-h-[min(72vh,520px)] overflow-hidden rounded-3xl border border-white/10 shadow-2xl shadow-black/50">
      <div
        className={cn("absolute inset-0 bg-gradient-to-br", hueClass)}
        aria-hidden
      />
      <div className="absolute inset-0 capability-visual-bg" aria-hidden />
      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="relative h-full"
        >
          <Preview />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
