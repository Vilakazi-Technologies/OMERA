import { cn } from "@/lib/cn";

export function OmeraBrand({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-2xl sm:text-3xl",
  };

  return (
    <div className={cn("leading-tight", className)}>
      <span
        className={cn(
          "font-serif font-medium tracking-tight text-white",
          sizes[size],
        )}
      >
        Omera
      </span>
      <p className="text-[10px] tracking-[0.2em] text-white/45 uppercase sm:text-[11px]">
        A product of VILATECH
      </p>
    </div>
  );
}
