import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";

export function VilatechLogo({
  className,
  size = 36,
  showText = false,
}: {
  className?: string;
  size?: number;
  showText?: boolean;
}) {
  if (showText) {
    return (
      <Link href="/" className={cn("inline-flex items-center group", className)}>
        <Image
          src="/vilatech-logo-full.svg"
          alt="VILATECH"
          width={size * 3.2}
          height={size}
          className="h-auto w-auto max-h-9 brightness-0 invert"
          priority
        />
      </Link>
    );
  }

  return (
    <Link href="/" className={cn("inline-flex shrink-0 items-center", className)}>
      <Image
        src="/vilatech-icon.svg"
        alt="VILATECH"
        width={size}
        height={size}
        className="brightness-0 invert"
        priority
      />
    </Link>
  );
}
