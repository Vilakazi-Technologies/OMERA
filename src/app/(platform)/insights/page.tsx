"use client";

import { useState } from "react";
import { FileUp, Loader2, Sparkles } from "lucide-react";
import { CsvBarChart } from "@/components/csv-bar-chart";
import { PlatformPageHeader } from "@/components/platform-page-header";
import type { CsvAnalyzeResponse } from "@/lib/csv/analysis-types";
import {
  CSV_ANALYSIS_GOALS,
  type CsvAnalysisGoal,
} from "@/lib/csv/analysis-goals";

const MAX_BYTES = 400_000;

type Step = "upload" | "configure" | "results";

export default function InsightsPage() {
  const [step, setStep] = useState<Step>("upload");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFileName, setPendingFileName] = useState("");
  const [pendingCsv, setPendingCsv] = useState("");
  const [selectedGoal, setSelectedGoal] = useState<CsvAnalysisGoal>("overview");
  const [result, setResult] = useState<CsvAnalyzeResponse | null>(null);

  async function onFilePicked(file: File) {
    setError(null);
    setResult(null);
    const name = file.name.toLowerCase();
    if (!name.endsWith(".csv")) {
      setError(
        "Please upload a .csv file. Excel (.xlsx) is not supported yet — export as CSV first.",
      );
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("File is too large. Keep the CSV under about 400 KB for this demo.");
      return;
    }
    const csv = await file.text();
    setPendingCsv(csv);
    setPendingFileName(file.name);
    setStep("configure");
  }

  async function runAnalysis() {
    if (!pendingCsv) return;
    setUploading(true);
    setError(null);
    try {
      const res = await fetch("/api/csv/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: pendingFileName,
          csv: pendingCsv,
          goal: selectedGoal,
        }),
      });
      const data = (await res.json()) as CsvAnalyzeResponse & { error?: string };
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
      setStep("results");
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  function reset() {
    setStep("upload");
    setPendingCsv("");
    setPendingFileName("");
    setResult(null);
    setError(null);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PlatformPageHeader
        title="Spreadsheet analyser"
        description="Upload CSV · choose an analysis · charts and next steps"
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        {error && (
          <p
            role="alert"
            className="mx-auto mb-4 max-w-2xl rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300"
          >
            {error}
          </p>
        )}

        {step === "upload" && (
          <div className="mx-auto flex max-w-lg flex-col items-center pt-[6vh] text-center">
            <div className="flex w-full flex-col items-center rounded-2xl border border-dashed border-white/20 bg-white/5 px-6 py-12">
              <FileUp className="size-10 text-white/80" />
              <h2 className="mt-4 text-lg font-semibold text-white">
                Upload your CSV
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Export from Excel or Google Sheets as CSV. You will choose what
                kind of analysis you want next — revenue, profit, trends, and
                more.
              </p>
              <label className="mt-6 cursor-pointer rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black hover:bg-white/90">
                Choose CSV file
                <input
                  type="file"
                  className="hidden"
                  accept=".csv,text/csv"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onFilePicked(f);
                  }}
                />
              </label>
            </div>
          </div>
        )}

        {step === "configure" && (
          <div className="mx-auto max-w-2xl space-y-6">
            <div className="liquid-card rounded-2xl p-5">
              <p className="text-xs uppercase tracking-wider text-slate-500">
                File ready
              </p>
              <p className="mt-1 font-medium text-white">{pendingFileName}</p>
              <p className="mt-3 text-sm text-slate-400">
                What should Omera focus on? Pick one — you can run another
                analysis anytime.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {CSV_ANALYSIS_GOALS.map((goal) => (
                  <button
                    key={goal.id}
                    type="button"
                    onClick={() => setSelectedGoal(goal.id)}
                    className={`rounded-xl border px-3 py-3 text-left text-sm transition ${
                      selectedGoal === goal.id
                        ? "border-sky-400/40 bg-sky-500/15 text-white"
                        : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20"
                    }`}
                  >
                    <span className="font-medium">{goal.label}</span>
                    <span className="mt-1 block text-xs text-slate-400">
                      {goal.description}
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => void runAnalysis()}
                  className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black hover:bg-white/90 disabled:opacity-50"
                >
                  {uploading ? "Analysing…" : "Run analysis"}
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-full border border-white/20 px-5 py-2.5 text-sm text-white/70 hover:bg-white/5"
                >
                  Choose another file
                </button>
              </div>
              {uploading && (
                <Loader2 className="mt-4 size-6 animate-spin text-slate-400" />
              )}
            </div>
          </div>
        )}

        {step === "results" && result && (
          <div className="mx-auto max-w-3xl space-y-6 pb-8">
            <div className="liquid-card rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 size-5 shrink-0 text-sky-300" />
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500">
                    {result.fileName} · {result.rowCount} rows · goal:{" "}
                    {CSV_ANALYSIS_GOALS.find((g) => g.id === result.goal)?.label ??
                      result.goal}
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

            {result.charts.length > 0 && (
              <section className="grid gap-4 lg:grid-cols-2">
                {result.charts.map((chart) => (
                  <CsvBarChart key={chart.id} chart={chart} />
                ))}
              </section>
            )}

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
            </div>

            <div className="flex justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setStep("configure");
                  setResult(null);
                }}
                className="rounded-full border border-white/20 px-5 py-2.5 text-sm text-white/80 hover:bg-white/5"
              >
                Run another analysis
              </button>
              <button
                type="button"
                onClick={reset}
                className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black hover:bg-white/90"
              >
                New file
              </button>
            </div>
          </div>
        )}
      </div>

      <footer className="shrink-0 border-t border-white/8 px-4 py-2 text-center text-[11px] text-slate-500">
        Pro plans (more analyses & faster AI) — see docs/MONETIZATION.md
      </footer>
    </div>
  );
}
