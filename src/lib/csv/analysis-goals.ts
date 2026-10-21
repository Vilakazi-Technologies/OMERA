export type CsvAnalysisGoal =
  | "overview"
  | "revenue"
  | "costs_profit"
  | "trends"
  | "top_items"
  | "cash_flow";

export const CSV_ANALYSIS_GOALS: {
  id: CsvAnalysisGoal;
  label: string;
  description: string;
}[] = [
  {
    id: "overview",
    label: "Overview",
    description: "Row counts, column types, and a balanced summary",
  },
  {
    id: "revenue",
    label: "Revenue & sales",
    description: "Totals and patterns in sales or income columns",
  },
  {
    id: "costs_profit",
    label: "Costs & profit",
    description: "Margin view when cost and revenue columns exist",
  },
  {
    id: "trends",
    label: "Trends over time",
    description: "Changes by date or period when dates are present",
  },
  {
    id: "top_items",
    label: "Top products / lines",
    description: "Best performers by category or SKU",
  },
  {
    id: "cash_flow",
    label: "Cash & payments",
    description: "Inflows, outflows, and net movement if columns match",
  },
];

export function goalPromptFocus(goal: CsvAnalysisGoal): string {
  switch (goal) {
    case "revenue":
      return "Focus on revenue, sales, and income columns. Quantify totals and highlight outliers.";
    case "costs_profit":
      return "Focus on costs, expenses, and profit or margin. State clearly if profit cannot be computed.";
    case "trends":
      return "Focus on time-based trends. Describe direction and notable periods.";
    case "top_items":
      return "Focus on ranking top categories, products, or customers by value.";
    case "cash_flow":
      return "Focus on cash in, cash out, and net position when columns support it.";
    default:
      return "Give a balanced executive overview of the spreadsheet.";
  }
}
