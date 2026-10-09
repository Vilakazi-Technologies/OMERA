import { cn } from "@/lib/cn";

/** Anthropic-style formal section intro — VILATECH palette */
export function LandingSectionHeader({
  eyebrow,
  title,
  children,
  className,
  align = "left",
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
  className?: string;
  align?: "left" | "center";
}) {
  return (
    <header
      className={cn(
        align === "center" && "mx-auto max-w-3xl text-center",
        className,
      )}
    >
      <p className="text-[10px] font-medium tracking-[0.28em] text-white/40 uppercase">
        {eyebrow}
      </p>
      <h2
        className={cn(
          "mt-4 font-serif text-3xl font-medium leading-[1.1] tracking-tight text-white sm:text-4xl",
          align === "center" && "text-balance",
        )}
      >
        {title}
      </h2>
      {children && (
        <div
          className={cn(
            "mt-5 max-w-2xl text-sm leading-[1.75] text-white/50 sm:text-base",
            align === "center" && "mx-auto",
            align === "left" && "border-l border-white/12 pl-5",
          )}
        >
          {children}
        </div>
      )}
    </header>
  );
}
