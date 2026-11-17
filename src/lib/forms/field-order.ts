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
    /\b(name|company|bidder|trading as|csd|tax|vat|b-?bb+ee|contact|e-?mail|phone|cell|telephone|address|registration|identity|id number)\b/i.test(
      t,
    )
  ) {
    return 0;
  }
  return 4;
}

function questionSubrank(field: StoredFormField): number {
  const bucket = questionBucket(field);
  const label = field.label;
  if (bucket === 3) {
    if (/\bwitness\b/i.test(label)) return 2;
    if (/\bdate\b/i.test(label)) return 1;
    return 0;
  }
  if (bucket !== 0) return 0;
  if (/\b(bidder|company|trading)\b/i.test(label) || /^full name$/i.test(label) || /^name$/i.test(label)) {
    return 0;
  }
  if (/\b(contact person|surname|first name|initials)\b/i.test(label)) return 1;
  if (/\b(csd|maaa)\b/i.test(label)) return 2;
  if (/\btax\b/i.test(label)) return 3;
  if (/\bvat\b/i.test(label)) return 4;
  if (/\b(b-?bb+ee|cidb)\b/i.test(label)) return 5;
  if (/\b(identity|id number)\b/i.test(label)) return 6;
  if (/\b(registration|cipc|ck number)\b/i.test(label)) return 7;
  if (/\baddress\b/i.test(label)) return 8;
  if (/\b(e-?mail|phone|cell|telephone|fax)\b/i.test(label)) return 9;
  return 10;
}

/**
 * Identity / company first, then returnables, then pricing, then signatures.
 * AcroForm widgets keep this order too so Start filling matches the pack.
 */
export function sortFieldsForQuestionFlow(
  fields: StoredFormField[],
): StoredFormField[] {
  return fields
    .map((field, index) => ({ field, index }))
    .sort((a, b) => {
      const bucket = questionBucket(a.field) - questionBucket(b.field);
      if (bucket !== 0) return bucket;
      const sub = questionSubrank(a.field) - questionSubrank(b.field);
      if (sub !== 0) return sub;
      if (a.field.required !== b.field.required) return a.field.required ? -1 : 1;
      return a.index - b.index;
    })
    .map((entry) => entry.field);
}
