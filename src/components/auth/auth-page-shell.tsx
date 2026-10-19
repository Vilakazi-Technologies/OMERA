import Link from "next/link";
import { OmeraWordmark } from "@/components/omera-wordmark";

type AuthPageShellProps = {
  subtitle: string;
  children: React.ReactNode;
};

export function AuthPageShell({ subtitle, children }: AuthPageShellProps) {
  return (
    <div className="relative z-10 flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-x-hidden px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6 flex w-full max-w-md flex-col items-center text-center sm:mb-8">
        <OmeraWordmark iconSize={40} textClassName="text-3xl" href="/" />
        <p className="mt-4 text-balance text-sm text-white/50">{subtitle}</p>
      </div>
      <div className="omera-clerk mx-auto w-full max-w-md">
        <div className="liquid-card w-full overflow-hidden rounded-2xl p-3 sm:p-5">
          {children}
        </div>
      </div>
      <Link
        href="/"
        className="mt-6 text-sm text-white/45 hover:text-white/70 sm:mt-8"
      >
        ← Back to home
      </Link>
    </div>
  );
}
