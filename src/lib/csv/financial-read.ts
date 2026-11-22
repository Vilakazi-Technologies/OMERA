import {
  detectCsvDelimiter,
  formatMoney,
  parseCsvNumber,
  parseCsvText,
  type CsvDelimiter,
} from "@/lib/csv/parse-csv";

export type FinancialKey =
  | "costOfSales"
  | "grossProfit"
  | "operatingExpenses"
  | "tax"
  | "netProfit";

type FieldDef = {
  key: FinancialKey;
  label: string;
  aliases: string[];
};

const FIELDS: FieldDef[] = [
  {
    key: "costOfSales",
    label: "Cost of sales",
    aliases: [
      "cost of sales",
      "cost of sale",
      "cost of goods sold",
      "cost of goods",
      "cogs",
      "cos",
    ],
  },
  {
    key: "grossProfit",
    label: "Gross profit",
    aliases: ["gross profit", "gp"],
  },
  {
    key: "operatingExpenses",
    label: "Operating expenses",
    aliases: [
      "operating expenses",
      "operating expense",
      "operating costs",
      "operating cost",
      "op ex",
      "opex",
    ],
  },
  {
    key: "tax",
    label: "Tax",
    aliases: ["income tax", "tax expense", "taxation", "taxes", "tax"],
  },
  {
    key: "netProfit",
    label: "Net profit",
    aliases: [
      "net profit after tax",
      "profit after tax",
      "net profit",
      "net income",
      "pat",
    ],
  },
];

const SALES_ALIASES = [
  "net sales",
  "total sales",
  "turnover",
  "revenue",
  "sales",
  "income",
];

const PERIOD_ALIASES = ["month", "period", "date", "quarter", "week", "year"];

export type FinancialFigure = {
  key: FinancialKey;
  label: string;
  present: boolean;
  header: string | null;
  total: number | null;
  formatted: string | null;
  earliest: number | null;
  latest: number | null;
  earliestLabel: string | null;
  latestLabel: string | null;
  count: number;
};

export type FinancialRead = {
  delimiter: CsvDelimiter;
  rowCount: number;
  headline: string;
  figures: FinancialFigure[];
  missing: string[];
  steps: string[];
  previewHeaders: string[];
  previewRows: string[][];
};

type AmountSeries = {
  header: string;
  total: number;
  count: number;
  earliest: number;
  latest: number;
  earliestLabel: string | null;
  latestLabel: string | null;
};

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[_/]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(zar|usd|rand)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesPhrase(header: string, alias: string): boolean {
  return ` ${header} `.includes(` ${alias} `);
}

function columnForAliases(headers: string[], aliases: string[]): number {
  let bestCol = -1;
  let bestLen = -1;
  headers.forEach((header, col) => {
    const norm = normalizeHeader(header);
    for (const alias of aliases) {
      if (!includesPhrase(norm, alias)) continue;
      if (alias.length > bestLen) {
        bestLen = alias.length;
        bestCol = col;
      }
    }
  });
  return bestCol;
}

function mapFinancialColumns(headers: string[]): Map<FinancialKey, number> {
  const candidates: { key: FinancialKey; col: number; len: number }[] = [];
  headers.forEach((header, col) => {
    const norm = normalizeHeader(header);
    for (const field of FIELDS) {
      for (const alias of field.aliases) {
        if (!includesPhrase(norm, alias)) continue;
        candidates.push({ key: field.key, col, len: alias.length });
      }
    }
  });
  candidates.sort((a, b) => b.len - a.len || a.col - b.col);
  const assigned = new Map<FinancialKey, number>();
  const usedCols = new Set<number>();
  for (const candidate of candidates) {
    if (assigned.has(candidate.key) || usedCols.has(candidate.col)) continue;
    assigned.set(candidate.key, candidate.col);
    usedCols.add(candidate.col);
  }
  return assigned;
}

function seriesFor(
  rows: string[][],
  col: number,
  periodCol: number,
): AmountSeries | null {
  const points: { value: number; label: string | null }[] = [];
  for (const row of rows) {
    const value = parseCsvNumber(row[col] ?? "");
    if (value === null) continue;
    const rawLabel = periodCol >= 0 ? (row[periodCol] ?? "").trim() : "";
    points.push({ value, label: rawLabel || null });
  }
  if (points.length === 0) return null;
  const earliest = points[0];
  const latest = points[points.length - 1];
  return {
    header: "",
    total: points.reduce((sum, point) => sum + point.value, 0),
    count: points.length,
    earliest: earliest.value,
    latest: latest.value,
    earliestLabel: earliest.label,
    latestLabel: latest.label,
  };
}

function money(amount: number): string {
  return formatMoney(amount);
}

function percent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

function periodName(label: string | null, fallback: string): string {
  return label ?? fallback;
}

function direction(
  series: AmountSeries | null,
): "up" | "down" | "flat" | "single" {
  if (!series || series.count < 2) return "single";
  const delta = series.latest - series.earliest;
  const band = Math.max(1, Math.abs(series.earliest) * 0.02);
  if (Math.abs(delta) <= band) return "flat";
  return delta > 0 ? "up" : "down";
}

function cap(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function joinClauses(parts: string[]): string {
  if (parts.length === 0) return "Here is what these results say to do next";
  if (parts.length === 1) return cap(parts[0]);
  if (parts.length === 2) return `${cap(parts[0])}, and ${parts[1]}`;
  return `${cap(parts[0])}, ${parts.slice(1, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function figureFrom(
  field: FieldDef,
  header: string | null,
  series: AmountSeries | null,
): FinancialFigure {
  if (!series) {
    return {
      key: field.key,
      label: field.label,
      present: false,
      header,
      total: null,
      formatted: null,
      earliest: null,
      latest: null,
      earliestLabel: null,
      latestLabel: null,
      count: 0,
    };
  }
  return {
    key: field.key,
    label: field.label,
    present: true,
    header,
    total: series.total,
    formatted: money(series.total),
    earliest: series.earliest,
    latest: series.latest,
    earliestLabel: series.earliestLabel,
    latestLabel: series.latestLabel,
    count: series.count,
  };
}

export function buildFinancialRead(csvText: string): FinancialRead {
  const delimiter = detectCsvDelimiter(csvText);
  const table = parseCsvText(csvText, delimiter);
  if (table.headers.length === 0 || table.rows.length === 0) {
    throw new Error("EMPTY_CSV");
  }

  const mapped = mapFinancialColumns(table.headers);
  const used = new Set(mapped.values());
  let periodCol = columnForAliases(table.headers, PERIOD_ALIASES);
  if (periodCol >= 0 && used.has(periodCol)) periodCol = -1;
  let salesCol = columnForAliases(table.headers, SALES_ALIASES);
  if (salesCol >= 0 && (used.has(salesCol) || salesCol === periodCol)) {
    salesCol = -1;
  }

  const figures = FIELDS.map((field) => {
    const col = mapped.get(field.key);
    const header = col === undefined ? null : table.headers[col];
    const series =
      col === undefined ? null : seriesFor(table.rows, col, periodCol);
    return figureFrom(field, header, series);
  });

  const byKey = new Map(figures.map((figure) => [figure.key, figure]));
  const sales =
    salesCol >= 0 ? seriesFor(table.rows, salesCol, periodCol) : null;
  const missing = figures.filter((figure) => !figure.present).map((figure) => figure.label);

  const cost = byKey.get("costOfSales")!;
  const gross = byKey.get("grossProfit")!;
  const opex = byKey.get("operatingExpenses")!;
  const tax = byKey.get("tax")!;
  const net = byKey.get("netProfit")!;

  const salesTotal = sales?.total ?? null;
  const estimatedSales =
    salesTotal !== null
      ? salesTotal
      : cost.present && gross.present
        ? cost.total! + gross.total!
        : null;
  const margin =
    estimatedSales && gross.present && estimatedSales !== 0
      ? gross.total! / estimatedSales
      : null;

  const headline = buildHeadline({
    margin,
    gross,
    opex,
    net,
    recognized: figures.some((figure) => figure.present),
  });

  const steps = buildSteps({
    headers: table.headers,
    figures,
    missing,
    cost,
    gross,
    opex,
    tax,
    net,
    salesTotal,
    salesHeader: salesCol >= 0 ? table.headers[salesCol] : null,
    estimatedSales,
    margin,
    salesIsEstimated: salesTotal === null && estimatedSales !== null,
  });

  return {
    delimiter,
    rowCount: table.rows.length,
    headline,
    figures,
    missing,
    steps,
    previewHeaders: table.headers,
    previewRows: table.rows.slice(0, 5),
  };
}

function buildHeadline(input: {
  margin: number | null;
  gross: FinancialFigure;
  opex: FinancialFigure;
  net: FinancialFigure;
  recognized: boolean;
}): string {
  if (!input.recognized) {
    return "This file is not a profit statement yet";
  }
  const parts: string[] = [];
  if (input.margin !== null && input.margin < 0.35) {
    parts.push("gross margin is thin");
  } else if (input.margin !== null && input.margin >= 0.5) {
    parts.push("gross margin is healthy");
  }
  if (
    input.opex.present &&
    input.gross.present &&
    input.opex.total! > input.gross.total!
  ) {
    parts.push("expenses are higher than gross profit");
  } else if (
    input.opex.present &&
    input.gross.present &&
    input.gross.total! > 0 &&
    input.opex.total! / input.gross.total! > 0.6
  ) {
    parts.push("operating expenses are high");
  }
  const netMove = direction(
    input.net.present
      ? {
          header: "",
          total: input.net.total!,
          count: input.net.count,
          earliest: input.net.earliest!,
          latest: input.net.latest!,
          earliestLabel: input.net.earliestLabel,
          latestLabel: input.net.latestLabel,
        }
      : null,
  );
  if (netMove === "down") parts.push("net profit is down");
  else if (netMove === "up") parts.push("net profit is up");
  else if (input.net.present && input.net.total! < 0) {
    parts.push("net profit is a loss");
  }
  return joinClauses(parts);
}

function buildSteps(input: {
  headers: string[];
  figures: FinancialFigure[];
  missing: string[];
  cost: FinancialFigure;
  gross: FinancialFigure;
  opex: FinancialFigure;
  tax: FinancialFigure;
  net: FinancialFigure;
  salesTotal: number | null;
  salesHeader: string | null;
  estimatedSales: number | null;
  margin: number | null;
  salesIsEstimated: boolean;
}): string[] {
  const steps: string[] = [];
  const push = (step: string) => {
    if (steps.length >= 5) return;
    if (!steps.includes(step)) steps.push(step);
  };

  const recognized = input.figures.filter((figure) => figure.present);
  if (recognized.length === 0) {
    push(
      `The headers in this file are ${input.headers.join(", ")}. None of them are cost of sales, gross profit, operating expenses, tax, or net profit, so there is no profit figure to act on yet.`,
    );
    push(
      "Export the profit statement again with those column names. COS, Opex, Tax, and Net Profit are fine if the longer names do not fit.",
    );
    push(
      "Upload that file next. Omera will not invent profit from columns it cannot recognise.",
    );
    return steps;
  }

  push(netStep(input.net));
  push(marginStep(input));
  push(opexStep(input.opex, input.gross));
  push(taxStep(input.tax, input.net));

  if (
    input.salesTotal !== null &&
    input.cost.present &&
    input.gross.present
  ) {
    const implied = input.salesTotal - input.cost.total!;
    const gap = Math.abs(implied - input.gross.total!);
    if (gap > Math.max(50, Math.abs(input.gross.total!) * 0.05)) {
      push(
        `Sales (${money(input.salesTotal)}) minus cost of sales (${input.cost.formatted}) is ${money(implied)}, but gross profit is ${input.gross.formatted}. Those three columns do not agree. Correct the sheet before you change prices off this file.`,
      );
    }
  }

  if (input.missing.length > 0) {
    push(
      `This file has no ${input.missing.join(", ")} column${input.missing.length === 1 ? "" : "s"}. The steps above use only the figures that are here. Add the missing column${input.missing.length === 1 ? "" : "s"} before the next upload if you want that part judged too.`,
    );
  }

  const quoted = recognized
    .map((figure) => `${figure.label} ${figure.formatted}`)
    .join(", ");
  let guard = 0;
  while (steps.length < 3 && guard < 4) {
    guard += 1;
    push(
      `Take ${quoted} to the next management conversation and name one change you will make before the following period.`,
    );
    if (steps.length < 3) {
      push(
        "Keep the next period in the same columns and upload it again so you can see whether the change moved net profit.",
      );
    }
  }

  return steps.slice(0, 5);
}

function netStep(net: FinancialFigure): string {
  if (!net.present || net.total === null || net.formatted === null) {
    return "Net profit is not in this file, so you cannot tell whether the business kept any money. Add a Net Profit column before you decide what can be spent.";
  }
  const move = direction({
    header: "",
    total: net.total,
    count: net.count,
    earliest: net.earliest!,
    latest: net.latest!,
    earliestLabel: net.earliestLabel,
    latestLabel: net.latestLabel,
  });
  if (move === "single") {
    const loss =
      net.total < 0
        ? " That is a loss. Stop drawings and discretionary spend until a later period shows a positive net profit."
        : " This is one snapshot, so it does not show whether profit is rising or falling. Put the next period in the same columns and upload it again.";
    return `Net profit in this file is ${net.formatted}.${loss}`;
  }
  const from = periodName(net.earliestLabel, "the first row");
  const to = periodName(net.latestLabel, "the latest row");
  const delta = net.latest! - net.earliest!;
  if (move === "down") {
    const loss =
      net.latest! < 0
        ? " The latest period is a loss."
        : "";
    return `Net profit fell from ${money(net.earliest!)} (${from}) to ${money(net.latest!)} (${to}), down ${money(Math.abs(delta))}.${loss} Treat that drop as the job for this month: find which cost or expense moved and reverse it before you add anything new.`;
  }
  if (move === "up") {
    return `Net profit rose from ${money(net.earliest!)} (${from}) to ${money(net.latest!)} (${to}), up ${money(delta)}. Protect that gain. Do not add spending that gives it back, and check that cost of sales is not rising faster than gross profit.`;
  }
  return `Net profit is roughly flat, from ${money(net.earliest!)} (${from}) to ${money(net.latest!)} (${to}), and the periods add up to ${net.formatted}. A flat result will not improve on its own. The next change has to come from margin or from expenses.`;
}

function marginStep(input: {
  cost: FinancialFigure;
  gross: FinancialFigure;
  salesTotal: number | null;
  salesHeader: string | null;
  estimatedSales: number | null;
  margin: number | null;
  salesIsEstimated: boolean;
}): string {
  const { cost, gross, estimatedSales, margin, salesIsEstimated, salesHeader } =
    input;
  if (margin !== null && gross.present && estimatedSales !== null) {
    const salesWords = salesIsEstimated
      ? `estimated sales of ${money(estimatedSales)} (gross profit plus cost of sales)`
      : `sales of ${money(estimatedSales)} from "${salesHeader}"`;
    const costWords = cost.present
      ? ` Cost of sales totals ${cost.formatted}.`
      : "";
    if (margin < 0.35) {
      return `Gross profit is ${gross.formatted} on ${salesWords}, a ${percent(margin)} gross margin. That margin is thin.${costWords} Raise prices on the work you sell most, or cut what it costs to deliver, before you take on more overhead.`;
    }
    if (margin < 0.5) {
      return `Gross profit is ${gross.formatted} on ${salesWords}, a ${percent(margin)} gross margin.${costWords} That is workable, but a small rise in cost of sales will erase it. Lock the next quote’s price, or the supplier price, before you discount.`;
    }
    return `Gross profit is ${gross.formatted} on ${salesWords}, a ${percent(margin)} gross margin.${costWords} The margin is healthy. Keep it by refusing discounts that are not matched by a lower cost of sales.`;
  }
  if (gross.present && !cost.present) {
    return `Gross profit totals ${gross.formatted}. Cost of sales is missing, so this read cannot say whether that profit is thin or comfortable. Add Cost of Sales (or COS) next to it.`;
  }
  if (cost.present && !gross.present) {
    return `Cost of sales totals ${cost.formatted}. Gross profit is missing, so margin cannot be judged. Add a Gross Profit column before you decide the pricing is fine.`;
  }
  return "Cost of sales and gross profit are both missing, so there is no margin to manage. Add those two columns. They are the first numbers a manager needs.";
}

function opexStep(opex: FinancialFigure, gross: FinancialFigure): string {
  if (!opex.present) {
    return "Operating expenses are not in this file. Add Opex or Operating Expenses so you can see whether running the business costs more than the gross profit.";
  }
  if (!gross.present || !gross.total) {
    return `Operating expenses total ${opex.formatted}. Gross profit is not available beside them, so you cannot tell if that spend is too high. Compare this ${opex.formatted} with gross profit as soon as that column is in the file.`;
  }
  const ratio = opex.total! / gross.total;
  if (opex.total! > gross.total) {
    return `Operating expenses of ${opex.formatted} are higher than gross profit of ${gross.formatted}. The business spends more to operate than it keeps after cost of sales. Cut the largest operating expense this month until expenses sit below gross profit.`;
  }
  if (ratio > 0.6) {
    return `Operating expenses of ${opex.formatted} take ${percent(ratio)} of gross profit (${gross.formatted}). That is high. List every operating expense and pause anything that does not keep sales coming in.`;
  }
  return `Operating expenses of ${opex.formatted} are ${percent(ratio)} of gross profit (${gross.formatted}). They are not swallowing the margin. Check them again next period so they do not creep up.`;
}

function taxStep(tax: FinancialFigure, net: FinancialFigure): string {
  if (!tax.present) {
    return "There is no tax column. This read cannot say what you owe. Do not spend the full profit figure until the person who does the accounts has confirmed the tax.";
  }
  if (net.present && net.total !== null && tax.total !== null) {
    const beforeTax = net.total + tax.total;
    if (beforeTax > 0) {
      return `Tax totals ${tax.formatted}. Set that cash aside. On net profit of ${net.formatted}, tax is ${percent(tax.total / beforeTax)} of the ${money(beforeTax)} profit before tax. Confirm the amount with your accountant before you treat net profit as money you can spend.`;
    }
  }
  return `Tax in this file totals ${tax.formatted}. Confirm it with your accountant, and do not spend cash you still have to pay over.`;
}
