import Link from "next/link";
import { cn } from "@/lib/cn";
import { VilatechLogo } from "@/components/vilatech-logo";

export function OmeraWordmark({
  className,
  iconSize = 32,
  textClassName,
  href = "/",
}: {
  className?: string;
  iconSize?: number;
  textClassName?: string;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2.5 group", className)}
    >
      <VilatechLogo size={iconSize} />
      <span
        className={cn(
          "font-serif text-xl font-medium tracking-tight text-white sm:text-2xl",
          textClassName,
        )}
      >
        Omera
      </span>
    </Link>
  );
}
