export type NumberedPageText = {
  pageNumber: number;
  text: string;
};

const FORM_HINT =
  /\b(name|surname|initials|address|signature|date of birth|id number|company name|trading as|csd|vat number|tax reference)\s*:/i;
const RETURNABLE =
  /\b(sbd\s*\d|returnable|bid form|pricing schedule|annexure [a-z]|declaration of interest|preference points)\b/i;

/** Higher scores are more likely to contain blanks the user must complete. */
export function scoreFormLikePage(text: string): number {
  const t = text.replace(/\u00a0/g, " ");
  let score = 0;
  if (/_{3,}|\.{5,}|\u2026/.test(t)) score += 4;
  if (/\[_?\]|\(\s*\)/.test(t)) score += 2;
  if (FORM_HINT.test(t)) score += 3;
  if (/\bsign(ature)?\b|\bsign here\b/i.test(t)) score += 3;
  if (RETURNABLE.test(t)) score += 4;
  if (/\t/.test(t)) score += 1;
  if (/\?/.test(t) && t.length < 800) score += 1;
  if (t.trim().length < 30) score -= 1;
  return score;
}

/**
 * Pick a small set of pages to rasterize: cover page plus the strongest
 * form-like pages (tables, blanks, SBD returnables).
 */
export function selectFormLikePageNumbers(
  pages: NumberedPageText[],
  maxPages: number,
): number[] {
  if (!pages.length || maxPages <= 0) return [];
  const ranked = pages
    .map((page) => ({
      n: page.pageNumber,
      s: scoreFormLikePage(page.text),
    }))
    .sort((a, b) => b.s - a.s || a.n - b.n);
  const picked = new Set<number>();
  picked.add(pages[0].pageNumber);
  for (const row of ranked) {
    if (picked.size >= maxPages) break;
    if (row.s > 0 || picked.size < Math.min(2, maxPages)) {
      picked.add(row.n);
    }
  }
  return [...picked].sort((a, b) => a - b);
}
