import type { StoredFormField } from "@/lib/db/form-sessions";

function questionBucket(field: StoredFormField): number {
  const t = `${field.label} ${field.prompt ?? ""}`;
  if (/\bsign(ature|ed|here)?\b|\bsign\s+here\b|\bwitness\b/i.test(t)) return 3;
  if (/\b(price|pricing|amount|rate per|ceiling price|bid price)\b|\bsbd\s*3/i.test(t)) {
    return 2;
  }
  if (
    /\b((sbd|mbd)\s*\d|returnable|attach|disclosure|preference point|declaration)\b/i.test(
      t,
    )
  ) {
    return 1;
  }
  if (
    /\b(name|company|bidder|trading as|csd|tax|vat|b-?bb+ee|contact|e-?mail|phone|address|registration|identity|id number)\b/i.test(
      t,
    )
  ) {
    return 0;
  }
  return 4;
}

/**
 * Identity / company first, then returnables, then pricing, then signatures.
 * AcroForm widgets keep this order too so Start filling matches the pack.
 */
export function sortFieldsForQuestionFlow(
  fields: StoredFormField[],
): StoredFormField[] {
  return [...fields].sort((a, b) => {
    const bucket = questionBucket(a) - questionBucket(b);
    if (bucket !== 0) return bucket;
    if (a.required !== b.required) return a.required ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
}
