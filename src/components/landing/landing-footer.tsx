import Link from "next/link";
import { VilatechLogo } from "@/components/vilatech-logo";

const FOOTER_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#languages", label: "Languages" },
  { href: "#faq", label: "FAQ" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "https://vilatech.co", label: "VILATECH", external: true },
  { href: "mailto:hello@vilatech.co", label: "Contact", external: true },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-white/5 bg-[#050505]">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-10">
        <div className="flex flex-col gap-12 lg:flex-row lg:justify-between">
          <div className="max-w-sm">
            <VilatechLogo size={40} />
            <p className="mt-5 font-serif text-lg text-white">Omera</p>
            <p className="mt-2 text-sm text-white/45">
              A product of VILATECH
            </p>
            <p className="mt-4 text-xs leading-relaxed text-white/35">
              South African AI for conversation and voice-powered forms —
              designed for people who would rather speak than type.
            </p>
          </div>

          <nav
            className="flex flex-wrap gap-x-8 gap-y-3 text-xs tracking-wide text-white/45 uppercase"
            aria-label="Footer"
          >
            {FOOTER_LINKS.map((link) =>
              link.external ? (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-white"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.label}
                  href={link.href}
                  className="transition-colors hover:text-white"
                >
                  {link.label}
                </Link>
              ),
            )}
          </nav>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/5 pt-8 text-xs text-white/30 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} VILATECH (Pty) Ltd. All rights reserved.</p>
          <p>Johannesburg, South Africa</p>
        </div>
      </div>
    </footer>
  );
}
