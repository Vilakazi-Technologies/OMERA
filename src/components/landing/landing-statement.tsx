import { ScrollReveal } from "@/components/scroll-reveal";

/** Formal manifesto block — Anthropic tone, VILATECH visual */
export function LandingStatement() {
  return (
    <section className="border-y border-white/6 bg-white/[0.02] py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-5 sm:px-10">
        <ScrollReveal>
          <p className="text-center font-serif text-2xl leading-snug font-medium text-white/90 sm:text-3xl">
            AI should feel effortless, trustworthy, and local.
          </p>
          <div className="mt-8 space-y-5 text-sm leading-[1.85] text-white/50 sm:text-base">
            <p>
              Omera is designed with the same interaction model as the world&apos;s
              leading assistants: you open a thread, you ask a question, you receive
              a thoughtful answer. No retraining required for your team.
            </p>
            <p>
              Where Omera diverges — deliberately — is paperwork. South Africans
              spend too much time on forms that were never designed for how we
              actually work. Omera reads your document, asks each field in plain
              language, and accepts your answers by keyboard or voice.
            </p>
            <p>
              The product is built by VILATECH in Johannesburg, for organisations
              that require clarity, compliance, and dignity in every digital
              interaction.
            </p>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
