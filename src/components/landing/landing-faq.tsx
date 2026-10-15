"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { LandingSectionHeader } from "@/components/landing/landing-section-header";
import { ScrollReveal } from "@/components/scroll-reveal";
import { cn } from "@/lib/cn";

const FAQ_ITEMS = [
  {
    q: "What is Omera?",
    a: "Omera is an AI assistant built in South Africa. You can chat about everyday tasks, and you can upload forms and complete them by answering questions — often by voice — while Omera keeps questions on screen for quiet offices.",
  },
  {
    q: "Which languages are supported?",
    a: "Typed input works in all eleven official South African languages. Voice input follows the documented support status, and measured speech quality is unrecorded until product recordings are evaluated.",
  },
  {
    q: "How does form filling work?",
    a: "Upload your fillable PDF. Omera analyses the fields, then asks you one question at a time in text. You respond by typing or speaking where a voice route exists. Scanned documents need an approved template. You review answers before anything is finalised.",
  },
  {
    q: "Is my data safe?",
    a: "Omera asks only for the answers your form needs, and you review every answer before anything is finalised. The privacy policy and terms describe what is stored and how to request deletion.",
  },
  {
    q: "Can my company use Omera for internal forms?",
    a: "Teams in insurance, financial services, HR, and operations can run a pilot of the form workflow to reduce typing load. Contact VILATECH for pilots and custom integrations.",
  },
  {
    q: "Do I need to install an app?",
    a: "Omera runs in your browser and can be added to your home screen on mobile.",
  },
];

export function LandingFaq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="scroll-mt-24 border-t border-white/5 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-5 sm:px-10">
        <ScrollReveal>
          <LandingSectionHeader eyebrow="FAQ" title="Questions, answered" />
        </ScrollReveal>
        <ul className="mt-10 space-y-2">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = open === i;
            return (
              <ScrollReveal key={item.q} delay={0.05 * i}>
              <li className="liquid-card overflow-hidden rounded-2xl list-none">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="text-sm font-medium text-white sm:text-base">
                    {item.q}
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-5 shrink-0 text-white/50 transition-transform",
                      isOpen && "rotate-180",
                    )}
                  />
                </button>
                {isOpen && (
                  <p className="border-t border-white/8 px-5 pb-5 pt-2 text-sm leading-relaxed text-white/50">
                    {item.a}
                  </p>
                )}
              </li>
              </ScrollReveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
