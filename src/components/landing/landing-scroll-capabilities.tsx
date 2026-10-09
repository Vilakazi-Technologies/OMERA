"use client";

import { useEffect, useRef, useState } from "react";
import { CapabilityVisual } from "@/components/landing/capability-visual";
import { CAPABILITIES, type CapabilityId } from "@/components/landing/capabilities";
import { LandingSectionHeader } from "@/components/landing/landing-section-header";
import { cn } from "@/lib/cn";

export function LandingScrollCapabilities() {
  const [active, setActive] = useState<CapabilityId>("chat");
  const sectionRef = useRef<HTMLElement>(null);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const nodes = stepRefs.current.filter(Boolean) as HTMLDivElement[];
    if (!nodes.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0];
        if (!top) return;
        const id = top.target.getAttribute("data-capability") as CapabilityId;
        if (id) setActive(id);
      },
      {
        root: null,
        rootMargin: "-35% 0px -35% 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  const activeMeta = CAPABILITIES.find((c) => c.id === active)!;

  return (
    <section
      ref={sectionRef}
      id="product"
      className="scroll-mt-24 border-t border-white/5 py-16 sm:py-24"
      aria-label="Omera capabilities"
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-10">
        <LandingSectionHeader
          eyebrow="Product"
          title="See how each part of Omera works"
        >
          Scroll through the capabilities below. The preview updates as you
          move — the same pattern you know from modern AI product pages, tuned
          for VILATECH.
        </LandingSectionHeader>

        <div className="mt-14 lg:grid lg:grid-cols-2 lg:gap-16">
          <div className="relative hidden lg:block">
            <div className="sticky top-28">
              <CapabilityVisual active={active} hueClass={activeMeta.hue} />
            </div>
          </div>

          <div className="flex flex-col gap-[min(28vh,220px)] py-4 lg:py-8">
            {CAPABILITIES.map((cap, i) => (
              <div
                key={cap.id}
                ref={(el) => {
                  stepRefs.current[i] = el;
                }}
                data-capability={cap.id}
                className={cn(
                  "scroll-mt-28 rounded-2xl border p-6 transition-colors duration-500 sm:p-8",
                  active === cap.id
                    ? "border-white/15 bg-white/[0.04]"
                    : "border-transparent bg-transparent",
                )}
              >
                <p className="text-[10px] font-medium tracking-[0.28em] text-white/35 uppercase">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-3 font-serif text-2xl font-medium text-white sm:text-3xl">
                  {cap.title}
                </h3>
                <p className="mt-4 text-sm leading-[1.75] text-white/50 sm:text-base">
                  {cap.description}
                </p>

                <div className="mt-8 lg:hidden">
                  <CapabilityVisual active={cap.id} hueClass={cap.hue} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
