export type CsvTable = {
  headers: string[];
  rows: string[][];
};

const MAX_ROWS = 5000;
const MAX_COLS = 64;

/** Parse a simple RFC-style CSV (comma-separated, optional quotes). */
export function parseCsvText(raw: string): CsvTable {
  const text = raw.replace(/^\uFEFF/, "").trim();
  if (!text) return { headers: [], rows: [] };

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if (ch === "\n" || (ch === "\r" && next === "\n")) {
      row.push(cell.trim());
      cell = "";
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      if (ch === "\r") i += 1;
      if (rows.length > MAX_ROWS) break;
      continue;
    }
    if (ch === "\r") continue;
    cell += ch;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    if (row.some((value) => value.length > 0)) rows.push(row);
  }

  if (rows.length === 0) return { headers: [], rows: [] };

  const width = Math.min(
    MAX_COLS,
    rows.reduce((max, r) => Math.max(max, r.length), 0),
  );
  const normalized = rows.map((r) => {
    const copy = r.slice(0, width);
    while (copy.length < width) copy.push("");
    return copy;
  });

  const headers = normalized[0].map((h, index) => h || `Column ${index + 1}`);
  const dataRows = normalized.slice(1);
  return { headers, rows: dataRows };
}

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

export type ColumnStats = {
  header: string;
  numeric: boolean;
  sum: number | null;
  count: number;
  min: number | null;
  max: number | null;
};

export function columnStatistics(table: CsvTable): ColumnStats[] {
  return table.headers.map((header, colIndex) => {
    const values = table.rows.map((row) => row[colIndex] ?? "");
    const numbers = values
      .map(parseNumber)
      .filter((n): n is number => n !== null);
    const numeric = numbers.length >= Math.max(1, Math.floor(values.length * 0.4));
    if (!numeric || numbers.length === 0) {
      return {
        header,
        numeric: false,
        sum: null,
        count: values.filter((v) => v.trim()).length,
        min: null,
        max: null,
      };
    }
    let sum = 0;
    let min = numbers[0];
    let max = numbers[0];
    for (const n of numbers) {
      sum += n;
      if (n < min) min = n;
      if (n > max) max = n;
    }
    return {
      header,
      numeric: true,
      sum,
      count: numbers.length,
      min,
      max,
    };
  });
}

export function formatMoney(amount: number, currency = "ZAR"): string {
  try {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return amount.toFixed(2);
  }
}
