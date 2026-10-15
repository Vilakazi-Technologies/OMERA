"use client";

import { SA_LANGUAGES } from "@/lib/languages";
import { cn } from "@/lib/cn";
import { Globe } from "lucide-react";

type Props = {
  value: string;
  onChange: (id: string) => void;
  compact?: boolean;
};

export function LanguageSelect({ value, onChange, compact }: Props) {
  const selected = SA_LANGUAGES.find((lang) => lang.id === value);
  const voiceNote =
    selected?.speech === "unavailable"
      ? "Voice unavailable"
      : selected?.speech === "beta"
        ? "Voice beta"
        : null;
  return (
    <span className="flex items-center gap-2">
      <label
        className={cn(
          "flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 text-sm text-slate-200",
          compact ? "px-2 py-1.5" : "px-3 py-2",
        )}
      >
        <Globe className="size-4 shrink-0 text-white/60" aria-hidden />
        <span className="sr-only">Speaking language</span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="max-w-[9rem] cursor-pointer bg-transparent text-sm outline-none sm:max-w-none"
        >
          {SA_LANGUAGES.map((lang) => (
            <option key={lang.id} value={lang.id} className="bg-[#050505]">
              {lang.nativeName}
            </option>
          ))}
        </select>
      </label>
      {voiceNote && (
        <span className="text-[11px] text-slate-400">{voiceNote}</span>
      )}
    </span>
  );
}
