export type CsvChartSeries = {
  id: string;
  title: string;
  labels: string[];
  values: number[];
  valueFormat?: "currency" | "number";
};

export type CsvAnalysis = {
  headline: string;
  metrics: {
    name: string;
    value: string;
    detail?: string;
  }[];
  insights: string[];
  nextSteps: string[];
  caveats?: string[];
};

export type CsvAnalyzeResponse = {
  fileName: string;
  rowCount: number;
  columnCount: number;
  goal: string;
  previewHeaders: string[];
  previewRows: string[][];
  charts: CsvChartSeries[];
  analysis: CsvAnalysis;
};
