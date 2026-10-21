import type { CsvTable } from "@/lib/csv/parse-csv";
import { columnStatistics } from "@/lib/csv/parse-csv";
import type { CsvChartSeries } from "@/lib/csv/analysis-types";

function parseNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const cleaned = trimmed
    .replace(/\s/g, "")
    .replace(/^R\s*/i, "")
    .replace(/,/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function categoryColumn(table: CsvTable): number {
  const stats = columnStatistics(table);
  let best = -1;
  let bestScore = Infinity;
  for (let col = 0; col < table.headers.length; col += 1) {
    if (stats[col]?.numeric) continue;
    const values = table.rows
      .map((row) => row[col]?.trim() ?? "")
      .filter(Boolean);
    const unique = new Set(values).size;
    if (unique >= 2 && unique <= 24 && values.length > unique) {
      if (unique < bestScore) {
        bestScore = unique;
        best = col;
      }
    }
  }
  return best;
}

function valueColumn(table: CsvTable): number {
  const stats = columnStatistics(table);
  return stats.findIndex((s) => s.numeric && (s.sum ?? 0) !== 0);
}

export function buildSpreadsheetCharts(table: CsvTable): CsvChartSeries[] {
  const charts: CsvChartSeries[] = [];
  const catCol = categoryColumn(table);
  const valCol = valueColumn(table);
  if (catCol >= 0 && valCol >= 0 && catCol !== valCol) {
    const totals = new Map<string, number>();
    for (const row of table.rows) {
      const label = row[catCol]?.trim() || "Other";
      const n = parseNumber(row[valCol] ?? "");
      if (n === null) continue;
      totals.set(label, (totals.get(label) ?? 0) + n);
    }
    const ranked = [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    if (ranked.length > 0) {
      charts.push({
        id: "top-categories",
        title: `Top ${table.headers[catCol]} by ${table.headers[valCol]}`,
        labels: ranked.map(([label]) => label),
        values: ranked.map(([, value]) => value),
        valueFormat: "currency",
      });
    }
  }

  const stats = columnStatistics(table).filter((s) => s.numeric && s.sum !== null);
  if (stats.length > 0 && charts.length === 0) {
    charts.push({
      id: "column-totals",
      title: "Numeric column totals",
      labels: stats.slice(0, 8).map((s) => s.header),
      values: stats.slice(0, 8).map((s) => s.sum ?? 0),
      valueFormat: "currency",
    });
  }

  return charts;
}
