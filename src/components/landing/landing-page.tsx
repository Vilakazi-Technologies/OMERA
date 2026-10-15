"use client";

import Link from "next/link";
import {
  ArrowRight,
  Building2,
  FileText,
  Globe2,
  MessageSquare,
  Mic,
  Shield,
  Upload,
  CheckCircle2,
} from "lucide-react";
import { LandingFaq } from "@/components/landing/landing-faq";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingInteractiveHero } from "@/components/landing/landing-interactive-hero";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingSectionHeader } from "@/components/landing/landing-section-header";
import { LandingScrollCapabilities } from "@/components/landing/landing-scroll-capabilities";
import { LandingStatement } from "@/components/landing/landing-statement";
import { ScrollReveal } from "@/components/scroll-reveal";
import { SA_LANGUAGES } from "@/lib/languages";

const FEATURES = [
  {
    icon: MessageSquare,
    title: "Everyday chat",
    body:
      "Plan, write, explain, and solve problems in natural language — tuned for South African context.",
  },
  {
    icon: FileText,
    title: "Voice-supported forms",
    body:
      "Upload a fillable PDF form. Omera reads the fields and walks you through each answer.",
  },
  {
    icon: Mic,
    title: "Speak your answers",
    body:
      "Answer by voice where a voice route exists for your language. Questions stay on screen for quiet offices.",
  },
  {
    icon: Globe2,
    title: "11 spoken languages",
    body:
      "Typed input in all eleven official languages; voice input where a documented voice route exists.",
  },
  {
    icon: Shield,
    title: "Review before anything is final",
    body:
      "Clear privacy terms and terms of use; you confirm every answer before export.",
  },
  {
    icon: Building2,
    title: "Pilots for teams",
    body:
      "For insurance, HR, and operations teams that process the same forms every month — scoped per pilot through VILATECH.",
  },
];

const STEPS = [
  {
    step: "01",
    title: "Upload your form",
    body: "A fillable PDF form. Omera maps the fields it needs to complete.",
    icon: Upload,
  },
  {
    step: "02",
    title: "Answer in conversation",
    body: "Each question appears as text. No loud prompts — ideal for open-plan workplaces.",
    icon: MessageSquare,
  },
  {
    step: "03",
    title: "Use your voice",
    body: "Tap the microphone and speak. Omera transcribes and places text in the right field.",
    icon: Mic,
  },
  {
    step: "04",
    title: "Review and export",
    body: "Confirm sensitive fields like ID numbers, then download or share the completed record.",
    icon: CheckCircle2,
  },
];

const USE_CASES = [
  {
    title: "Financial services",
    body: "Client onboarding, policy updates, and claims paperwork with less keyboard time.",
  },
  {
    title: "Human resources",
    body: "Employee forms, leave applications, and compliance documents completed faster.",
  },
  {
    title: "Public sector",
    body: "Accessible intake for citizens who prefer speaking over filling dense PDFs.",
  },
  {
    title: "Education",
    body: "Applications and admin forms for students, parents, and campus offices.",
  },
];

export function LandingPage() {
  return (
    <div className="relative z-10">
      <div className="grain" aria-hidden />
      <LandingNav />

      <LandingInteractiveHero />

      <LandingStatement />

      <LandingScrollCapabilities />

      <section
        id="features"
        className="scroll-mt-24 border-t border-white/5 py-20 sm:py-28"
      >
        <div className="mx-auto max-w-6xl px-5 sm:px-10">
          <ScrollReveal>
            <LandingSectionHeader
              eyebrow="Capabilities"
              title="One assistant. Chat when you want. Voice when forms demand it."
            >
              Omera combines the familiarity of global AI products with a
              workflow South African teams ask for every day: completing forms
              without retyping the same answers.
            </LandingSectionHeader>
          </ScrollReveal>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }, i) => (
              <ScrollReveal key={title} delay={0.05 * (i % 3)}>
                <article className="liquid-card h-full rounded-2xl p-6">
                  <Icon className="size-5 text-white/70" strokeWidth={1.5} />
                  <h3 className="mt-4 text-base font-medium text-white">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/45">
                    {body}
                  </p>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="scroll-mt-24 border-t border-white/5 py-20 sm:py-28"
      >
        <div className="mx-auto max-w-6xl px-5 sm:px-10">
          <ScrollReveal>
            <LandingSectionHeader
              eyebrow="Process"
              title="From upload to done in four steps"
            >
              Minimal effort for the user: the system reads the document, asks
              each question in order, and records answers by text or voice.
            </LandingSectionHeader>
          </ScrollReveal>
          <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ step, title, body, icon: Icon }, i) => (
              <ScrollReveal key={step} delay={0.08 * i}>
                <li className="liquid-card relative h-full list-none rounded-2xl p-6">
                  <span className="font-serif text-3xl text-white/15">{step}</span>
                  <Icon className="mt-4 size-5 text-white/60" />
                  <h3 className="mt-3 text-sm font-medium text-white">{title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-white/45">
                    {body}
                  </p>
                </li>
              </ScrollReveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t border-white/5 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-10">
          <ScrollReveal>
            <LandingSectionHeader
              eyebrow="Use cases"
              title="Where Omera saves the most time"
            />
          </ScrollReveal>
          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {USE_CASES.map((item, i) => (
              <ScrollReveal key={item.title} delay={0.1 * i}>
                <div className="h-full rounded-2xl border border-white/8 bg-white/[0.03] p-6">
                  <h3 className="text-base font-medium text-white">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/45">
                    {item.body}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section
        id="languages"
        className="scroll-mt-24 border-t border-white/5 py-20 sm:py-28"
      >
        <div className="mx-auto max-w-6xl px-5 sm:px-10">
          <ScrollReveal>
            <LandingSectionHeader
              eyebrow="Languages"
              title="Eleven official languages, typed everywhere"
            >
              Typed input works in every language; voice input follows the
              documented support status.
            </LandingSectionHeader>
          </ScrollReveal>
          <ScrollReveal className="mt-10" delay={0.12}>
            <ul className="flex flex-wrap gap-2">
              {SA_LANGUAGES.map((lang) => (
                <li
                  key={lang.id}
                  className="liquid rounded-full px-3 py-2 text-xs text-white/70 sm:px-4 sm:text-sm"
                >
                  {lang.nativeName}
                </li>
              ))}
            </ul>
          </ScrollReveal>
        </div>
      </section>

      <section className="border-t border-white/5 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-10">
          <ScrollReveal>
            <div className="liquid-card rounded-3xl p-8 sm:p-12 lg:flex lg:items-center lg:justify-between lg:gap-12">
              <div className="max-w-xl">
                <p className="text-[10px] tracking-[0.25em] text-white/40 uppercase">
                  Trust
                </p>
                <h2 className="mt-3 font-serif text-2xl font-medium text-white sm:text-3xl">
                  From VILATECH in Johannesburg
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-white/45 sm:text-base">
                  Omera is developed by VILATECH, a Johannesburg software studio.
                </p>
              </div>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:mt-0 lg:shrink-0">
                <Link
                  href="/privacy"
                  className="rounded-full border border-white/15 px-6 py-3 text-center text-sm text-white/80 hover:border-white/30"
                >
                  Privacy policy
                </Link>
                <Link
                  href="/terms"
                  className="rounded-full border border-white/15 px-6 py-3 text-center text-sm text-white/80 hover:border-white/30"
                >
                  Terms of use
                </Link>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <LandingFaq />

      <section className="border-t border-white/5 py-20 sm:py-28">
        <ScrollReveal className="mx-auto max-w-3xl px-5 text-center sm:px-10">
          <h2 className="font-serif text-3xl font-medium text-white sm:text-4xl">
            Let&apos;s work together
          </h2>
          <p className="mt-4 text-white/45">
            Start in your browser today. Add Omera to your home screen for an
            app-like experience on mobile.
          </p>
          <Link
            href="/login"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-medium text-black hover:bg-white/90"
          >
            Create your workspace
            <ArrowRight className="size-4" />
          </Link>
        </ScrollReveal>
      </section>

      <LandingFooter />
    </div>
  );
}
