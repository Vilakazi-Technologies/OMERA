import { describe, expect, it } from "vitest";
import {
  columnStatistics,
  formatMoney,
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

describe("formatMoney", () => {
  it("formats ZAR", () => {
    expect(formatMoney(1234.5)).toContain("1");
  });
});
