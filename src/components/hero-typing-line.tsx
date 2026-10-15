"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

const PREFIX = "South African AI ";
const PHRASES = [
  "built for your voice.",
  "built for everyday chat.",
  "built to finish forms.",
  "built to lead Africa.",
  "built for eleven languages.",
];
const TYPE_MS = 64;
const DELETE_MS = 34;
const PAUSE_MS = 2400;

export function HeroTypingLine({ className }: { className?: string }) {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [text, setText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const phrase = PHRASES[phraseIndex];

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    if (!deleting && text === phrase) {
      timeout = setTimeout(() => setDeleting(true), PAUSE_MS);
    } else if (deleting && text === "") {
      timeout = setTimeout(() => {
        setPhraseIndex((i) => (i + 1) % PHRASES.length);
        setDeleting(false);
      }, DELETE_MS);
    } else if (deleting) {
      timeout = setTimeout(
        () => setText(phrase.slice(0, text.length - 1)),
        DELETE_MS,
      );
    } else {
      timeout = setTimeout(
        () => setText(phrase.slice(0, text.length + 1)),
        TYPE_MS,
      );
    }

    return () => clearTimeout(timeout);
  }, [text, deleting, phrase, phraseIndex]);

  const ghost = `${PREFIX}${PHRASES.reduce((a, b) => (a.length > b.length ? a : b), "")}`;

  return (
    <div
      className={cn(
        "relative mt-6 max-w-2xl font-serif text-[clamp(1.35rem,4.5vw,2.25rem)] leading-snug font-medium tracking-tight text-white/45",
        className,
      )}
    >
      <span className="invisible block text-balance" aria-hidden="true">
        {ghost}
      </span>
      <span
        className="absolute inset-x-0 top-0 block text-balance"
        aria-live="polite"
      >
        {PREFIX}
        <span className="text-white/60">{text}</span>
        <span
          className="ml-0.5 inline-block h-[0.85em] w-[2px] translate-y-[0.06em] animate-pulse bg-white/45 align-middle"
          aria-hidden="true"
        />
      </span>
    </div>
  );
}
