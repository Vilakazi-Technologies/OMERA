import Link from "next/link";
import { OmeraWordmark } from "@/components/omera-wordmark";
import { OMERA_TERMS } from "@/lib/omera-legal";

export const metadata = {
  title: "Terms of Use",
};

export default function TermsPage() {
  return (
    <div className="relative z-10 min-h-dvh">
      <header className="border-b border-white/8 px-5 py-5 sm:px-10">
        <OmeraWordmark />
      </header>
      <article className="mx-auto max-w-3xl px-5 py-12 sm:px-10 sm:py-16">
        <h1 className="font-serif text-3xl font-medium text-white">
          {OMERA_TERMS.title}
        </h1>
        <p className="mt-2 text-sm text-white/45">
          Last updated {OMERA_TERMS.lastUpdated}
        </p>
        <div className="mt-10 space-y-8">
          {OMERA_TERMS.sections.map((s) => (
            <section key={s.heading}>
              <h2 className="text-lg font-medium text-white">{s.heading}</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-white/50">
                {s.body}
              </p>
            </section>
          ))}
        </div>
        <Link
          href="/"
          className="mt-12 inline-block text-sm text-white/50 hover:text-white"
        >
          ← Back to home
        </Link>
      </article>
    </div>
  );
}
