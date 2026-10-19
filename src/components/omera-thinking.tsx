"use client";

import { motion } from "framer-motion";

const dot = {
  animate: {
    y: [0, -5, 0],
    opacity: [0.35, 1, 0.35],
  },
  transition: (i: number) => ({
    duration: 0.9,
    repeat: Infinity,
    ease: "easeInOut" as const,
    delay: i * 0.14,
  }),
};

type Props = {
  label?: string;
  hint?: string;
};

export function OmeraThinking({
  label = "Omera is thinking",
  hint = "Usually 10–30 seconds for the first words on the demo model.",
}: Props) {
  return (
    <div
      className="flex w-full justify-start"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="liquid flex max-w-[min(100%,42rem)] items-center gap-3 rounded-2xl border border-white/10 px-4 py-3.5">
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400/25 to-white/10 ring-1 ring-white/15"
          aria-hidden
        >
          <span className="font-serif text-sm font-medium text-amber-100/90">O</span>
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-xs font-medium tracking-wide text-white/55">{label}</p>
          {hint ? (
            <p className="text-[10px] leading-snug text-white/35">{hint}</p>
          ) : null}
          <div className="flex items-center gap-1.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="size-1.5 rounded-full bg-amber-300/90"
                animate={dot.animate}
                transition={dot.transition(i)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
