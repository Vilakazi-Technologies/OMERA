"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { HeroTypingLine } from "@/components/hero-typing-line";
import { CapabilityVisual } from "@/components/landing/capability-visual";
import { CAPABILITIES, type CapabilityId } from "@/components/landing/capabilities";
import { ScrollReveal } from "@/components/scroll-reveal";
import { cn } from "@/lib/cn";

export function LandingInteractiveHero() {
  const [active, setActive] = useState<CapabilityId>("forms");
  const activeMeta = CAPABILITIES.find((c) => c.id === active)!;

  return (
    <section className="relative overflow-hidden pt-28 pb-16 sm:pt-32 sm:pb-24">
      <div className="pointer-events-none absolute inset-0 chatgpt-hero-glow" aria-hidden />

      <div className="relative mx-auto max-w-6xl px-5 sm:px-10">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <ScrollReveal className="text-left">
            <div className="liquid mb-6 inline-flex items-center gap-3 rounded-full px-4 py-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <p className="text-[10px] tracking-[0.2em] text-white/60 uppercase sm:text-xs">
                Currently taking new signups
              </p>
            </div>

            <h1 className="font-serif text-[clamp(3rem,9vw,4.75rem)] font-medium leading-[0.95] tracking-tight text-white">
              Omera
            </h1>

            <HeroTypingLine className="!mx-0 !max-w-none !text-left" />

            <p className="mt-8 max-w-xl text-base font-medium leading-snug text-white/80 sm:text-lg">
              South Africa&apos;s AI for{" "}
              {CAPABILITIES.map((cap, i) => (
                <span key={cap.id}>
                  <button
                    type="button"
                    className={cn(
                      "interactive-word",
                      active === cap.id && "interactive-word-active",
                    )}
                    onMouseEnter={() => setActive(cap.id)}
                    onFocus={() => setActive(cap.id)}
                    onClick={() => setActive(cap.id)}
                  >
                    {cap.word}
                  </button>
                  {i < CAPABILITIES.length - 1 ? ", " : "."}
                </span>
              ))}
            </p>

            <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/45 sm:text-base">
              Omera is your everyday assistant in the browser — familiar like
              global chat products, with form completion by voice when paperwork
              gets in the way.
            </p>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/45 sm:text-base">
              It is built in Johannesburg to help you move faster at work, at
              home, and across the continent.
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-medium text-black transition hover:bg-white/90"
              >
                <Sparkles className="size-4" />
                Get started
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-8 py-3.5 text-sm text-white/80 transition hover:border-white/30"
              >
                See how it works
                <ArrowRight className="size-4" />
              </a>
            </div>

            <div className="mt-10 border-l border-white/15 pl-5">
              <p className="text-[10px] tracking-[0.22em] text-white/40 uppercase">
                {activeMeta.title}
              </p>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-white/55">
                {activeMeta.description}
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.1} className="lg:justify-self-end">
            <CapabilityVisual active={active} hueClass={activeMeta.hue} />
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
