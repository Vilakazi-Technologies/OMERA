"use client";

import { useEffect, useState } from "react";
import type { ModelCatalogEntry } from "@/lib/ai/model-catalog-client";
import { cn } from "@/lib/cn";

type Props = {
  value: string;
  onChange: (modelId: string) => void;
  className?: string;
  /** Compact dropdown for the message composer row. */
  variant?: "pills" | "compact";
};

type CatalogResponse = {
  provider: string;
  models: ModelCatalogEntry[];
};

export function ChatModelSelect({
  value,
  onChange,
  className,
  variant = "pills",
}: Props) {
  const [models, setModels] = useState<ModelCatalogEntry[]>([]);
  const [provider, setProvider] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ai/models", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: CatalogResponse | null) => {
        if (cancelled || !data?.models?.length) return;
        setModels(data.models);
        setProvider(data.provider);
        const primary = data.models.find((m) => m.kind === "primary" && m.available);
        if (primary && value !== primary.id && !data.models.some((m) => m.id === value)) {
          onChange(primary.id);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [onChange, value]);

  if (!models.length) {
    return (
      <p className={cn("text-[11px] text-white/40", className)}>
        Loading models…
      </p>
    );
  }

  const available = models.filter((m) => m.available);

  if (variant === "compact") {
    return (
      <label
        className={cn(
          "flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] text-slate-200",
          className,
        )}
      >
        <span className="sr-only">Chat model</span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="max-w-[11rem] cursor-pointer bg-transparent outline-none sm:max-w-[14rem]"
        >
          {available.map((model) => (
            <option key={model.id} value={model.id} className="bg-[#050505]">
              {model.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {provider === "xavani" ? (
        <p className="text-[10px] text-emerald-400/80">
          Xavani connected · Omera is your business adviser
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {models.map((model) => {
          const selected = value === model.id;
          return (
            <button
              key={model.id}
              type="button"
              disabled={!model.available}
              title={model.description ?? model.label}
              onClick={() => {
                if (model.available) onChange(model.id);
              }}
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-medium transition",
                model.available
                  ? selected
                    ? "bg-white text-black"
                    : "border border-white/15 text-white/70 hover:border-white/30 hover:text-white"
                  : "cursor-not-allowed border border-white/8 text-white/30",
              )}
            >
              {model.label}
              {!model.available && model.kind === "extension" ? (
                <span className="ml-1 text-[9px] uppercase tracking-wide text-amber-400/90">
                  soon
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
