"use client";

import type { CsvChartSeries } from "@/lib/csv/analysis-types";

function formatValue(value: number, format?: CsvChartSeries["valueFormat"]): string {
  if (format === "currency") {
    try {
      return new Intl.NumberFormat("en-ZA", {
        style: "currency",
        currency: "ZAR",
        maximumFractionDigits: 0,
      }).format(value);
    } catch {
      return value.toFixed(0);
    }
  }
  return value.toLocaleString("en-ZA");
}

export function CsvBarChart({ chart }: { chart: CsvChartSeries }) {
  const max = Math.max(...chart.values, 1);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <h4 className="text-sm font-medium text-white">{chart.title}</h4>
      <ul className="mt-4 space-y-3" aria-label={chart.title}>
        {chart.labels.map((label, index) => {
          const value = chart.values[index] ?? 0;
          const width = Math.max(4, Math.round((value / max) * 100));
          return (
            <li key={`${label}-${index}`}>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-slate-300">{label}</span>
                <span className="shrink-0 tabular-nums text-slate-400">
                  {formatValue(value, chart.valueFormat)}
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-400/90 to-indigo-400/90"
                  style={{ width: `${width}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
