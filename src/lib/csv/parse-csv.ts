export type CsvTable = {
  headers: string[];
  rows: string[][];
};

const MAX_ROWS = 5000;
const MAX_COLS = 64;

export type CsvDelimiter = "," | ";";

/** Header-row sniff: semicolon wins only when it is more common than comma. */
export function detectCsvDelimiter(raw: string): CsvDelimiter {
  const text = raw.replace(/^\uFEFF/, "");
  let commas = 0;
  let semis = 0;
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === "\n" || ch === "\r") break;
    if (ch === ",") commas += 1;
    if (ch === ";") semis += 1;
  }
  return semis > commas ? ";" : ",";
}

/** Parse a simple RFC-style CSV (comma or semicolon, optional quotes). */
export function parseCsvText(raw: string, delimiter?: CsvDelimiter): CsvTable {
  const text = raw.replace(/^\uFEFF/, "").trim();
  if (!text) return { headers: [], rows: [] };
  const separator = delimiter ?? detectCsvDelimiter(text);

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
    if (ch === separator) {
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

/** Plain amounts, ZAR prefixes, thousands separators, and comma decimals. */
export function parseCsvNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("%")) return null;
  let cleaned = trimmed.replace(/[\s\u00A0]/g, "").replace(/^R/i, "");
  if (!cleaned) return null;

  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    if (lastComma > lastDot) {
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if (lastComma >= 0) {
    if (/^-?\d{1,3}(,\d{3})+$/.test(cleaned)) {
      cleaned = cleaned.replace(/,/g, "");
    } else if (/^-?\d+,\d+$/.test(cleaned)) {
      cleaned = cleaned.replace(",", ".");
    } else {
      return null;
    }
  }

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
      .map(parseCsvNumber)
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
