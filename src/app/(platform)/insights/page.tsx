"use client";

import { useState } from "react";
import { FileUp, Loader2, Sparkles } from "lucide-react";
import type { CsvAnalysis } from "@/lib/csv/analysis-types";

type AnalyzeResponse = {
  fileName: string;
  rowCount: number;
  columnCount: number;
  previewHeaders: string[];
  previewRows: string[][];
  analysis: CsvAnalysis;
};

const MAX_BYTES = 400_000;

export default function InsightsPage() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);

  async function uploadCsv(file: File) {
    setError(null);
    setResult(null);

    const name = file.name.toLowerCase();
    if (!name.endsWith(".csv")) {
      setError("Please upload a .csv file. Excel (.xlsx) is not supported yet — export as CSV first.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("File is too large. Keep the CSV under about 400 KB for this demo.");
      return;
    }

    setUploading(true);
    try {
      const csv = await file.text();
      const res = await fetch("/api/csv/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, csv }),
      });
      const data = (await res.json()) as AnalyzeResponse & { error?: string };
      if (!res.ok) {
        if (data.error === "QUOTA_EXCEEDED") {
          setError("You have reached the analysis limit for now. Try again later.");
        } else if (data.error === "SERVICE_UNAVAILABLE") {
          setError("Omera could not reach the AI service. Try again in a moment.");
        } else {
          setError("Could not analyse this file. Check that it is a valid CSV with headers.");
        }
        return;
      }
      setResult(data);
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <header className="border-b border-white/8 px-4 py-3">
        <div className="mx-auto flex max-w-3xl flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-sm font-medium text-white">Sales insights</h1>
            <p className="text-xs text-slate-500">
              Upload a CSV · Omera reads totals and suggests next steps
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        {error && (
          <p
            role="alert"
            className="mx-auto mb-4 max-w-2xl rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300"
          >
            {error}
          </p>
        )}

        {!result && (
          <div className="mx-auto flex max-w-lg flex-col items-center pt-[6vh] text-center">
            <div className="flex w-full flex-col items-center rounded-2xl border border-dashed border-white/20 bg-white/5 px-6 py-12">
              <FileUp className="size-10 text-white/80" />
              <h2 className="mt-4 text-lg font-semibold text-white">
                Upload sales CSV
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Rows with amounts, dates, or product names work best. Omera
                estimates revenue, costs, and profit when your columns support
                it, then lists actionable next steps.
              </p>
              <label className="mt-6 cursor-pointer rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black hover:bg-white/90">
                {uploading ? "Analysing…" : "Choose CSV file"}
                <input
                  type="file"
                  className="hidden"
                  accept=".csv,text/csv"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadCsv(f);
                  }}
                />
              </label>
              {uploading && (
                <Loader2 className="mt-4 size-6 animate-spin text-slate-400" />
              )}
            </div>
          </div>
        )}

        {result && (
          <div className="mx-auto max-w-3xl space-y-6">
            <div className="liquid-card rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 size-5 shrink-0 text-sky-300" />
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500">
                    {result.fileName} · {result.rowCount} rows ·{" "}
                    {result.columnCount} columns
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-white">
                    {result.analysis.headline}
                  </h2>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {result.analysis.metrics.map((metric) => (
                  <div
                    key={metric.name}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                  >
                    <p className="text-xs text-slate-400">{metric.name}</p>
                    <p className="mt-1 text-lg font-semibold text-white">
                      {metric.value}
                    </p>
                    {metric.detail ? (
                      <p className="mt-1 text-xs text-slate-500">
                        {metric.detail}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <section className="liquid-card rounded-2xl p-5">
              <h3 className="text-sm font-medium text-white">Insights</h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
                {result.analysis.insights.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>

            <section className="liquid-card rounded-2xl p-5">
              <h3 className="text-sm font-medium text-white">Next steps</h3>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-300">
                {result.analysis.nextSteps.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </section>

            {result.analysis.caveats && result.analysis.caveats.length > 0 && (
              <p className="text-center text-xs text-slate-500">
                {result.analysis.caveats.join(" ")}
              </p>
            )}

            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="min-w-full text-left text-xs text-slate-300">
                <thead className="bg-white/5 text-slate-400">
                  <tr>
                    {result.previewHeaders.map((h) => (
                      <th key={h} className="px-3 py-2 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.previewRows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-t border-white/5">
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="px-3 py-2">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-3 py-2 text-[11px] text-slate-500">
                Preview of first rows — full file is not stored on this device
                after analysis.
              </p>
            </div>

            <div className="flex justify-center pb-8">
              <label className="cursor-pointer rounded-full border border-white/20 px-5 py-2.5 text-sm text-white/80 hover:bg-white/5">
                Analyse another file
                <input
                  type="file"
                  className="hidden"
                  accept=".csv,text/csv"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadCsv(f);
                  }}
                />
              </label>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
