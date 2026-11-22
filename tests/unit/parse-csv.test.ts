import { describe, expect, it } from "vitest";
import {
  columnStatistics,
  formatMoney,
  parseCsvNumber,
  parseCsvText,
} from "@/lib/csv/parse-csv";

describe("parseCsvText", () => {
  it("parses headers and rows", () => {
    const table = parseCsvText("date,amount\n2026-01-01,100\n2026-01-02,250");
    expect(table.headers).toEqual(["date", "amount"]);
    expect(table.rows).toHaveLength(2);
    expect(table.rows[1][1]).toBe("250");
  });

  it("handles quoted commas", () => {
    const table = parseCsvText('item,note\n"Widget, large",ok');
    expect(table.rows[0][0]).toBe("Widget, large");
  });

  it("splits semicolon files and keeps comma decimals", () => {
    const table = parseCsvText("item;amount\nWidget;1200,50");
    expect(table.headers).toEqual(["item", "amount"]);
    expect(table.rows[0]).toEqual(["Widget", "1200,50"]);
  });
});

describe("columnStatistics", () => {
  it("sums numeric amount columns", () => {
    const table = parseCsvText(
      "product,sales,cost\nA,1000,400\nB,500,200",
    );
    const stats = columnStatistics(table);
    const sales = stats.find((s) => s.header === "sales");
    expect(sales?.sum).toBe(1500);
  });
});

describe("parseCsvNumber", () => {
  it("reads thousands separators and comma decimals", () => {
    expect(parseCsvNumber("1,234.50")).toBe(1234.5);
    expect(parseCsvNumber("1,234")).toBe(1234);
    expect(parseCsvNumber("1200,50")).toBe(1200.5);
    expect(parseCsvNumber("R 1 200")).toBe(1200);
  });
});

describe("formatMoney", () => {
  it("formats ZAR", () => {
    expect(formatMoney(1234.5)).toContain("1");
  });
});
