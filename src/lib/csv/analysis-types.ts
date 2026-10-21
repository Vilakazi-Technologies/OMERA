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
