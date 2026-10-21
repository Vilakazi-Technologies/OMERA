import "server-only";
import { z } from "zod";
import { completeConfiguredJson } from "@/lib/ai/chat-runtime";
import type { CsvAnalysis } from "@/lib/csv/analysis-types";
import {
  columnStatistics,
  formatMoney,
  parseCsvText,
  type CsvTable,
} from "@/lib/csv/parse-csv";

export const csvAnalysisSchema = z.object({
  headline: z.string().min(1).max(400),
  metrics: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        value: z.string().min(1).max(120),
        detail: z.string().max(400).optional(),
      }),
    )
    .min(1)
    .max(12),
  insights: z.array(z.string().min(1).max(800)).min(1).max(8),
  nextSteps: z.array(z.string().min(1).max(400)).min(1).max(8),
  caveats: z.array(z.string().max(400)).max(6).optional(),
});

export type CsvAnalyzeResult = {
  fileName: string;
  rowCount: number;
  columnCount: number;
  previewHeaders: string[];
  previewRows: string[][];
  analysis: CsvAnalysis;
};

const SYSTEM_PROMPT = `You are Omera, a South African business analyst helping owners understand sales spreadsheets.
You receive CSV column statistics and sample rows (not full books).
Infer revenue, sales, cost, profit, or margin only when the data supports it.
Use ZAR unless another currency is obvious from the headers.
Return JSON only matching the schema: headline, metrics (name, value, optional detail), insights, nextSteps, optional caveats.
Be specific and actionable. Flag missing columns (e.g. no cost column means profit cannot be exact).
Do not invent rows or numbers not supported by the statistics.`;

function buildInput(
  fileName: string,
  table: CsvTable,
  stats: ReturnType<typeof columnStatistics>,
): string {
  const sampleRows = table.rows.slice(0, 8);
  const statLines = stats
    .filter((s) => s.numeric && s.sum !== null)
    .map(
      (s) =>
        `${s.header}: sum=${s.sum}, count=${s.count}, min=${s.min}, max=${s.max}`,
    );
  return JSON.stringify({
    fileName,
    rowCount: table.rows.length,
    columns: table.headers,
    numericSummaries: statLines,
    sampleRows,
  });
}

function heuristicAnalysis(
  fileName: string,
  table: CsvTable,
  stats: ReturnType<typeof columnStatistics>,
): CsvAnalysis {
  const numeric = stats.filter((s) => s.numeric && s.sum !== null);
  const metrics = numeric.slice(0, 6).map((s) => ({
    name: `Total ${s.header}`,
    value: formatMoney(s.sum!),
    detail: `${s.count} numeric values`,
  }));
  if (metrics.length === 0) {
    metrics.push({
      name: "Rows",
      value: String(table.rows.length),
      detail: "No numeric columns detected",
    });
  }
  return {
    headline: `Summary for ${fileName}`,
    metrics,
    insights: [
      `Found ${table.rows.length} data rows and ${table.headers.length} columns.`,
      numeric.length
        ? `Numeric columns: ${numeric.map((s) => s.header).join(", ")}.`
        : "Could not detect numeric sales or amount columns — check formatting (use plain numbers).",
    ],
    nextSteps: [
      "Add columns named Revenue, Cost, and Date if missing so profit can be calculated automatically.",
      "Re-upload after cleaning blank rows and consistent currency formatting.",
      "Speak to a qualified accountant before tax or statutory decisions.",
    ],
    caveats: ["AI service was unavailable; this is a numeric rollup only."],
  };
}

function parseAnalysis(value: unknown): CsvAnalysis {
  const parsed = csvAnalysisSchema.safeParse(value);
  if (!parsed.success) throw new Error("INVALID_CSV_ANALYSIS");
  return parsed.data;
}

export async function analyzeSalesCsv(
  csvText: string,
  fileName: string,
  signal?: AbortSignal,
): Promise<CsvAnalyzeResult> {
  const table = parseCsvText(csvText);
  if (table.headers.length === 0 || table.rows.length === 0) {
    throw new Error("EMPTY_CSV");
  }

  const stats = columnStatistics(table);
  const input = buildInput(fileName, table, stats);

  let analysis: CsvAnalysis;
  try {
    analysis = await completeConfiguredJson(
      SYSTEM_PROMPT,
      input,
      parseAnalysis,
      signal,
    );
  } catch {
    analysis = heuristicAnalysis(fileName, table, stats);
  }

  return {
    fileName,
    rowCount: table.rows.length,
    columnCount: table.headers.length,
    previewHeaders: table.headers,
    previewRows: table.rows.slice(0, 5),
    analysis,
  };
}
