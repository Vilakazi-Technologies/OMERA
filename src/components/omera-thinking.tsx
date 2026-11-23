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
      className="flex w-full flex-col items-start gap-1.5"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <p className="text-xs font-medium tracking-wide text-white/35">Omera</p>
      <p className="text-[15px] leading-relaxed text-white/55">{label}</p>
      {hint ? (
        <p className="max-w-md text-xs leading-snug text-white/35">{hint}</p>
      ) : null}
      <div className="flex items-center gap-1.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="size-1.5 rounded-full bg-amber-300/80"
            animate={dot.animate}
            transition={dot.transition(i)}
          />
        ))}
      </div>
    </div>
  );
}
