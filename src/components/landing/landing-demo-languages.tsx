"use client";

import Link from "next/link";
import { ArrowRight, Mic, Type } from "lucide-react";
import { LandingSectionHeader } from "@/components/landing/landing-section-header";
import { ScrollReveal } from "@/components/scroll-reveal";
import { cn } from "@/lib/cn";

export type DemoLanguage = {
  id: string;
  nativeName: string;
  englishName: string;
  /** Short line for investors in English */
  pitch: string;
  samplePrompt: string;
  voice: "supported" | "type-only";
};

export const DEMO_LANGUAGES: DemoLanguage[] = [
  {
    id: "eng",
    nativeName: "English",
    englishName: "English",
    pitch: "Business coach — $0 to $100k USD growth plan",
    samplePrompt:
      "Help me turn a side hustle into my first R50k/month in revenue. What should I do this week?",
    voice: "supported",
  },
  {
    id: "zul",
    nativeName: "isiZulu",
    englishName: "isiZulu",
    pitch: "Same expert — in the language your customer speaks",
    samplePrompt:
      "Ngicela usitshe izinyathelo zokuqala ukuze ngisebenzele ibhizinisi lami elincane eThekwini.",
    voice: "supported",
  },
  {
    id: "ssw",
    nativeName: "siSwati",
    englishName: "siSwati",
    pitch: "Inclusive AI for Eswatini and Mpumalanga markets",
    samplePrompt:
      "Ngicela umlandvo wetindlela tekucala ibhizinisi lelicinile: kutsi ngenti njani leli viki?",
    voice: "type-only",
  },
];

type Props = {
  className?: string;
};

export function LandingDemoLanguages({ className }: Props) {
  return (
    <section
      id="demo-languages"
      className={cn(
        "scroll-mt-24 border-t border-white/5 py-20 sm:py-28",
        className,
      )}
      aria-labelledby="demo-languages-title"
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-10">
        <ScrollReveal>
          <LandingSectionHeader
            eyebrow="Investor demo"
            title="Try Omera in three languages"
          >
            Open chat with the language pre-selected. Use the sample prompt or
            ask your own question — powered by{" "}
            <span className="text-white/70">Xavani</span>, VILATECH&apos;s AI.
          </LandingSectionHeader>
        </ScrollReveal>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {DEMO_LANGUAGES.map((lang, i) => (
            <ScrollReveal key={lang.id} delay={0.08 * i}>
              <article className="liquid-card flex h-full flex-col rounded-2xl p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-serif text-xl text-white">
                      {lang.nativeName}
                    </p>
                    <p className="mt-1 text-[11px] text-white/40">
                      {lang.pitch}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide",
                      lang.voice === "supported"
                        ? "bg-emerald-500/15 text-emerald-300/90"
                        : "bg-white/8 text-white/45",
                    )}
                  >
                    {lang.voice === "supported" ? (
                      <span className="inline-flex items-center gap-1">
                        <Mic className="size-3" aria-hidden />
                        Voice
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <Type className="size-3" aria-hidden />
                        Type
                      </span>
                    )}
                  </span>
                </div>

                <blockquote
                  className="mt-5 flex-1 rounded-xl border border-white/8 bg-black/30 px-4 py-3 text-sm leading-relaxed text-white/55"
                  lang={lang.id === "eng" ? "en" : lang.id === "zul" ? "zu" : "ss"}
                >
                  &ldquo;{lang.samplePrompt}&rdquo;
                </blockquote>

                <Link
                  href={`/chat?lang=${lang.id}`}
                  className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-white/90"
                >
                  Open in Omera
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </article>
            </ScrollReveal>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-white/35">
          Sign in required. All eleven official languages are available in chat;
          these three are tuned for live demos.
        </p>
      </div>
    </section>
  );
}
