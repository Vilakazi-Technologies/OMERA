import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildFinancialRead } from "@/lib/csv/financial-read";
import { formatMoney } from "@/lib/csv/parse-csv";

const fixture = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../fixtures/results-sample.csv"),
  "utf8",
);

describe("buildFinancialRead", () => {
  it("quotes the sample totals and tells a manager what to do", () => {
    const read = buildFinancialRead(fixture);
    const cost = 84210 + 90110 + 97330;
    const gross = 31840 + 29440 + 27120;
    const opex = 22150 + 24880 + 25640;
    const tax = 2460 + 1810 + 980;
    const net = 7230 + 2750 + 500;

    expect(read.rowCount).toBe(3);
    expect(read.missing).toEqual([]);
    expect(read.steps.length).toBeGreaterThanOrEqual(3);
    expect(read.steps.length).toBeLessThanOrEqual(5);
    expect(read.figures.find((figure) => figure.key === "costOfSales")?.total).toBe(cost);
    expect(read.figures.find((figure) => figure.key === "grossProfit")?.total).toBe(gross);
    expect(read.figures.find((figure) => figure.key === "operatingExpenses")?.total).toBe(opex);
    expect(read.figures.find((figure) => figure.key === "tax")?.total).toBe(tax);
    expect(read.figures.find((figure) => figure.key === "netProfit")?.total).toBe(net);

    const text = read.steps.join(" ");
    expect(text).toContain(formatMoney(gross));
    expect(text).toContain(formatMoney(opex));
    expect(text).toContain(formatMoney(7230));
    expect(text).toContain(formatMoney(500));
    expect(text.toLowerCase()).toContain("thin");
    expect(text.toLowerCase()).toContain("fell");
    expect(read.headline.toLowerCase()).toContain("net profit is down");
  });

  it("reads semicolon headers and still advises when tax is missing", () => {
    const read = buildFinancialRead(
      [
        "Period;COS;Gross Profit;Opex;Net Profit",
        "Q1;12000;8000;9000;1500",
        "Q2;15000;7000;11000;-500",
      ].join("\n"),
    );

    expect(read.delimiter).toBe(";");
    expect(read.missing).toEqual(["Tax"]);
    expect(read.figures.find((figure) => figure.key === "costOfSales")?.total).toBe(27000);
    expect(read.figures.find((figure) => figure.key === "operatingExpenses")?.total).toBe(20000);
    expect(read.steps.length).toBeGreaterThanOrEqual(3);
    expect(read.steps.length).toBeLessThanOrEqual(5);
    const text = read.steps.join(" ");
    expect(text).toContain(formatMoney(27000));
    expect(text.toLowerCase()).toContain("tax");
    expect(text).toContain(formatMoney(1500));
    expect(text).toContain(formatMoney(-500));
  });

  it("accepts comma decimals in a semicolon file", () => {
    const read = buildFinancialRead(
      "Month;Cost of Sales;Gross Profit\nJan;1200,50;800,25\nFeb;1100,00;900,75\n",
    );
    expect(read.figures.find((figure) => figure.key === "costOfSales")?.total).toBeCloseTo(2300.5);
    expect(read.figures.find((figure) => figure.key === "grossProfit")?.total).toBeCloseTo(1701);
    expect(read.missing).toContain("Tax");
    expect(read.missing).toContain("Net profit");
  });
});
