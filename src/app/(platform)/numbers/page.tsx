"use client";

import { useState } from "react";
import { FileUp } from "lucide-react";
import { PlatformPageHeader } from "@/components/platform-page-header";
import {
  buildFinancialRead,
  type FinancialRead,
} from "@/lib/csv/financial-read";

const MAX_BYTES = 400_000;

export default function NumbersPage() {
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [read, setRead] = useState<FinancialRead | null>(null);

  async function onFilePicked(file: File) {
    setError(null);
    setRead(null);
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Upload a .csv file. If this is Excel, export it as CSV first.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("That file is too large. Keep the CSV under about 400 KB.");
      return;
    }
    try {
      const csv = await file.text();
      setFileName(file.name);
      setRead(buildFinancialRead(csv));
    } catch (caught) {
      if (caught instanceof Error && caught.message === "EMPTY_CSV") {
        setError("That CSV has no data rows. Include a header row and at least one period.");
        return;
      }
      setError("Could not read that file. Check that it is a CSV with a header row.");
    }
  }

  function reset() {
    setRead(null);
    setFileName("");
    setError(null);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PlatformPageHeader
        title="Numbers"
        description="Upload a results CSV. Omera reads the profit figures and says what to do next."
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

        {!read && (
          <div className="mx-auto flex max-w-lg flex-col items-center pt-[6vh] text-center">
            <div className="flex w-full flex-col items-center rounded-2xl border border-dashed border-white/20 bg-white/5 px-6 py-12">
              <FileUp className="size-10 text-white/80" />
              <h2 className="mt-4 text-lg font-semibold text-white">
                Upload your results
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                A CSV of business results is enough. Cost of sales, gross profit,
                operating expenses, tax, and net profit can use those names or
                short ones such as COS, Opex, and Net Profit. Comma or semicolon
                files both work.
              </p>
              <label className="mt-6 cursor-pointer rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black hover:bg-white/90">
                Choose CSV file
                <input
                  type="file"
                  className="hidden"
                  accept=".csv,text/csv"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void onFilePicked(file);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>
        )}

        {read && (
          <div className="mx-auto max-w-3xl space-y-6 pb-8">
            <div className="liquid-card rounded-2xl p-5">
              <p className="text-xs uppercase tracking-wider text-slate-500">
                {fileName} · {read.rowCount} {read.rowCount === 1 ? "row" : "rows"}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-white">{read.headline}</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {read.figures.map((figure) => (
                  <div
                    key={figure.key}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                  >
                    <p className="text-xs text-slate-400">
                      {figure.label}
                      {figure.header && figure.header !== figure.label
                        ? ` · ${figure.header}`
                        : ""}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-white">
                      {figure.present ? figure.formatted : "Not in this file"}
                    </p>
                    {figure.present && figure.count > 1 ? (
                      <p className="mt-1 text-xs text-slate-500">
                        {figure.count} periods added together
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
              {read.missing.length > 0 ? (
                <p className="mt-4 text-sm text-slate-400">
                  Missing: {read.missing.join(", ")}. Advice below uses only the
                  columns that are present.
                </p>
              ) : null}
            </div>

            <section className="liquid-card rounded-2xl p-5">
              <h3 className="text-sm font-medium text-white">What to do next</h3>
              <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm leading-6 text-slate-300">
                {read.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </section>

            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="min-w-full text-left text-xs text-slate-300">
                <thead className="bg-white/5 text-slate-400">
                  <tr>
                    {read.previewHeaders.map((header) => (
                      <th key={header} className="px-3 py-2 font-medium">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {read.previewRows.map((row, rowIndex) => (
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

            <div className="flex justify-center">
              <button
                type="button"
                onClick={reset}
                className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black hover:bg-white/90"
              >
                Upload another file
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
