/** Shared rules: only ask what a person must answer or attach. */

export const FILL_BLANK_RUN =
  /(?:_{2,}|\.{3,}|\u2026{1,}|\u22ef{1,}|[·.]{5,}|\[[\s_xX.]{0,8}\])/;

const FILL_HINT =
  /\b(name of bidder|bidder'?s name|bidder name|company name|trading as|full name|surname|initials( and surname)?|identity number|id number|csd|maaa|tcs pin|tax( reference| pin| number)?|vat( registration)?( number)?|b-?bb+ee|cidb|contact person|e-?mail|telephone|cell( ?phone)?|fax|facsimile|postal address|physical address|street address|registration number|ck number|cipc|signature|signatory|name of( the)? signatory|capacity|date of|birth|price|amount|ceiling price|bid price|director|shareholder|witness)\b/i;

const YES_NO = /\b(?:yes|y)\s*\/\s*(?:no|n)\b/i;

const RETURNABLE_HINT =
  /\b((sbd|mbd)\s*\d|returnable|pricing schedule|bidders disclosure|preference point|central supplier database|tax compliance|company registration documents)\b/i;

const BOILERPLATE =
  /\b(disqualif|non-?compulsory briefing|failure to (submit|comply)|late submissions?|shall\b|must submit|will be|may be disqualified|evaluation criteria|scope of work|please note)\b/i;

const WARNING_SCRAP =
  /\b(disqualif|automatically|non-?compulsory|what is your paid)\b/i;

const JUNK_LABEL =
  /^(the|a|an|and|or|paid|bid|will|be|item|yes|no|page|note|section)$/i;

const PAGE_MARKER =
  /^(?:page\s*)?\d{1,4}(?:\s*(?:of|\/)\s*\d{1,4})?$|^page\s+\d+\b(?:\s+of\s+\d+)?$|^[-–—]\s*\d{1,4}\s*[-–—]$/i;

const SENTENCE_STARTER =
  /^(the|a|an|and|or|if|should|failure|these|this|that|which|please|kindly|note|see|bidders? must|the bidder|late submissions?)\b/i;

const CANONICAL: Array<[RegExp, string]> = [
  [/^(name of( the)? bidder|bidder'?s name|bidder name)$/i, "Bidder name"],
  [/^(company name|name of( the)? (company|firm|supplier))$/i, "Company name"],
  [/^(trading as|trading name)$/i, "Trading name"],
  [/^(full name|name and surname|initials( and surname)?)$/i, "Full name"],
  [/^(tcs pin)$/i, "TCS PIN"],
  [/^(street address)$/i, "Street address"],
  [/^(name of( the)? signatory)$/i, "Name of signatory"],
  [/^(vat registration( number)?)$/i, "VAT number"],
  [/^(signature of( the)? (bidder|applicant|signatory))$/i, "Signature"],
  [/^(contact person)$/i, "Contact person"],
  [
    /^(csd( (number|no\.?|registration))?|maaa( number)?|central supplier database( (number|registration))?)$/i,
    "CSD number",
  ],
  [/^(tax reference( number)?|tax pin|income tax reference)$/i, "Tax reference"],
  [/^(vat( (number|no\.?))?)$/i, "VAT number"],
  [/^(id(entity)? (number|no\.?))$/i, "ID number"],
  [/^(e-?mail( address)?)$/i, "Email address"],
  [/^(cell( ?phone)?( number)?|mobile( number)?)$/i, "Cell number"],
  [/^(telephone( number)?|tel(ephone)? no\.?|phone( number)?)$/i, "Telephone"],
  [/^(physical address)$/i, "Physical address"],
  [/^(postal address)$/i, "Postal address"],
  [/^(b-?bb+ee( (level|status|certificate|affidavit))?)$/i, "B-BBEE level"],
  [
    /^(registration number|company registration( number)?|ck( number)?|cipc( (number|registration))?)$/i,
    "Company registration",
  ],
  [
    /^(signature|sign(ed| here)?|authorised signature|authorized signature)$/i,
    "Signature",
  ],
  [/^(witness( signature)?)$/i, "Witness"],
  [/^(bid price|ceiling price|tender(ed)? price|total price)$/i, "Bid price"],
  [/^(capacity( of signatory)?)$/i, "Capacity"],
];

const SBD_TITLES: Record<string, string> = {
  "1": "Invitation to bid",
  "3": "Pricing schedule",
  "3.1": "Pricing schedule",
  "3.2": "Pricing schedule",
  "3.3": "Pricing schedule",
  "4": "Bidders disclosure",
  "6.1": "Preference points",
  "6.2": "Preference points",
  "8": "Declaration of past practice",
  "9": "Independent bid determination",
};

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function normalizeRawLabel(label: string): string {
  return label
    .replace(/\u00a0/g, " ")
    .replace(/[.…·_]{2,}/g, " ")
    .replace(/^\d+(?:\.\d+)*[.)]\s+/, "")
    .replace(/^[\u2022\-–—]\s+/, "")
    .replace(/[:.?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isJunkFragment(label: string): boolean {
  const raw = label.replace(/\u00a0/g, " ").replace(/[:.?]+$/g, "").trim();
  if (PAGE_MARKER.test(raw) || /\bpage\s+\d+\b/i.test(raw)) return true;
  const trimmed = normalizeRawLabel(label);
  if (!trimmed) return true;
  if (JUNK_LABEL.test(trimmed)) return true;
  if (/^\d{1,4}(?:\s*[-–—])?$/.test(trimmed)) return true;
  if (PAGE_MARKER.test(trimmed) || /\bpage\s+\d+\b/i.test(trimmed)) return true;
  if (trimmed.length < 3 && !/^(id|vat)$/i.test(trimmed)) return true;
  if (WARNING_SCRAP.test(trimmed)) return true;
  if (SENTENCE_STARTER.test(trimmed) && !RETURNABLE_HINT.test(trimmed)) return true;
  if (
    /^[a-z]/.test(trimmed) &&
    wordCount(trimmed) >= 4 &&
    !FILL_HINT.test(trimmed) &&
    !RETURNABLE_HINT.test(trimmed)
  ) {
    return true;
  }
  return false;
}

function formatReturnable(series: string, num: string): string {
  const title = SBD_TITLES[num];
  const head = `${series.toUpperCase()} ${num}`;
  return title ? `${head} — ${title}` : head;
}

/**
 * A bidder yes/no declaration, not a warning that happens to mention yes or no.
 * Returns null unless the line is a real question the person must answer.
 */
export function declarationQuestionLabel(line: string): string | null {
  const cleaned = line.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned.length > 280 || !YES_NO.test(cleaned)) return null;
  if (WARNING_SCRAP.test(cleaned)) return null;
  let label = cleaned
    .replace(YES_NO, " ")
    .replace(/\[[\sxX_.]*\]/g, " ")
    .replace(/\(\s*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[:\s]+$/g, "")
    .trim();
  if (isBoilerplateInstruction(label, label, cleaned)) return null;
  if (WARNING_SCRAP.test(label)) return null;
  const words = wordCount(label.replace(/\?/g, ""));
  if (words < 3 || words > 32) return null;
  if (!label.endsWith("?")) label = `${label.replace(/[?.\s]+$/g, "")}?`;
  return label;
}

/** Exact bidder label (Name of bidder, CSD number, SBD 4), not a sentence that mentions one. */
export function canonicalFillLabel(label: string): string | null {
  const trimmed = normalizeRawLabel(label);
  if (!trimmed || wordCount(trimmed) > 8) return null;
  if (
    /\b(shall|must|will|should|submit|disqualif|please|note|failure)\b/i.test(
      trimmed,
    )
  ) {
    return null;
  }
  for (const [pattern, human] of CANONICAL) {
    if (pattern.test(trimmed)) return human;
  }
  const sbd = /^(sbd|mbd)\s*(\d+(?:\.\d+)?)$/i.exec(trimmed);
  if (sbd) return formatReturnable(sbd[1], sbd[2]);
  return null;
}

/** Bidder-facing label, or null when the text is a scrap we must not ask. */
export function humanQuestionLabel(label: string): string | null {
  const declared = declarationQuestionLabel(label);
  if (declared) return declared;
  const asked = label.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  if (
    /\?\s*$/.test(asked) &&
    !WARNING_SCRAP.test(asked) &&
    !isBoilerplateInstruction(asked, asked, "")
  ) {
    const body = normalizeRawLabel(asked);
    const words = wordCount(body);
    if (words >= 3 && words <= 32 && body && !isJunkFragment(body)) {
      return body.endsWith("?") ? body : `${body}?`;
    }
  }
  const trimmed = normalizeRawLabel(label);
  if (!trimmed || isJunkFragment(trimmed)) return null;
  if (isBoilerplateInstruction(trimmed, trimmed, "")) return null;
  for (const [pattern, human] of CANONICAL) {
    if (pattern.test(trimmed)) return human;
  }
  const sbd = /\b(sbd|mbd)\s*(\d+(?:\.\d+)?)\b/i.exec(trimmed);
  if (sbd && wordCount(trimmed) <= 10) {
    return formatReturnable(sbd[1], sbd[2]);
  }
  if (!isPlausibleFieldLabel(trimmed)) return null;
  if (
    trimmed === trimmed.toUpperCase() &&
    /[A-Z]/.test(trimmed) &&
    trimmed.length <= 48
  ) {
    return trimmed
      .toLowerCase()
      .replace(/\b([a-z])/g, (letter) => letter.toUpperCase());
  }
  return trimmed;
}

export function isPlausibleFieldLabel(label: string): boolean {
  const trimmed = normalizeRawLabel(label);
  if (isJunkFragment(trimmed)) return false;
  const words = wordCount(trimmed);
  if (words < 1 || words > 8) return false;
  if (
    SENTENCE_STARTER.test(trimmed) &&
    !FILL_HINT.test(trimmed) &&
    !RETURNABLE_HINT.test(trimmed)
  ) {
    return false;
  }
  if (/\b(will|shall|must|automatically)\b/i.test(trimmed) && words > 4) return false;
  return true;
}

/**
 * True when a line is a warning / instruction, not a blank the user fills.
 * A trailing blank does not turn a disqualification sentence into a question.
 */
export function isBoilerplateInstruction(
  text: string,
  label = "",
  sourceLine = "",
): boolean {
  const blob = `${text} ${label} ${sourceLine}`;
  const labelIsField = FILL_HINT.test(label) || RETURNABLE_HINT.test(label);
  if (WARNING_SCRAP.test(label) || (WARNING_SCRAP.test(blob) && wordCount(label) > 4)) {
    if (!labelIsField || wordCount(label) > 4) return true;
  }
  if (/\bnon-?compulsory briefing\b/i.test(blob) && !labelIsField) return true;
  const hasBlank = FILL_BLANK_RUN.test(sourceLine) || FILL_BLANK_RUN.test(text);
  const hasReturnable =
    RETURNABLE_HINT.test(label) ||
    RETURNABLE_HINT.test(sourceLine) ||
    RETURNABLE_HINT.test(text);
  const hasFieldName = FILL_HINT.test(label) || FILL_HINT.test(sourceLine);
  if (
    /\b(shall|must submit)\b/i.test(blob) &&
    !hasBlank &&
    !hasReturnable &&
    !hasFieldName
  ) {
    return true;
  }
  if (BOILERPLATE.test(blob) && !hasBlank && !hasReturnable && !hasFieldName) {
    return true;
  }
  return false;
}

export function isAnswerOrAttachItem(label: string, sourceLine = ""): boolean {
  const human = humanQuestionLabel(label);
  if (!human) return false;
  if (isBoilerplateInstruction(human, human, sourceLine)) return false;
  if (
    /\?\s*$/.test(human) &&
    wordCount(human) <= 32 &&
    !isBoilerplateInstruction(human, human, sourceLine)
  ) {
    return true;
  }
  if (FILL_HINT.test(human) || FILL_HINT.test(sourceLine)) return true;
  if (RETURNABLE_HINT.test(human) || RETURNABLE_HINT.test(sourceLine)) return true;
  if (/\byes\s*\/\s*no\b/i.test(sourceLine) && isPlausibleFieldLabel(human)) {
    return true;
  }
  if (FILL_BLANK_RUN.test(sourceLine) && isPlausibleFieldLabel(human)) return true;
  if (
    isPlausibleFieldLabel(human) &&
    wordCount(human) <= 8 &&
    /[:?]\s*$/.test(sourceLine.trim())
  ) {
    return true;
  }
  return false;
}

/** Drop model rows that turned warnings into questions. A bad prompt does not rescue a junk label. */
export function isModelFillItem(label: string, prompt: string): boolean {
  const human = humanQuestionLabel(label);
  if (!human) return false;
  if (isBoilerplateInstruction(`${human} ${prompt}`, human, "")) return false;
  if (WARNING_SCRAP.test(prompt) && !FILL_HINT.test(human) && !RETURNABLE_HINT.test(human)) {
    return false;
  }
  return true;
}

export function promptForFillItem(
  label: string,
  _kind: "text" | "checkbox" | "choice" | "signature" = "text",
): string {
  return humanQuestionLabel(label) ?? "";
}

/** Question shown on the form screen. Warning prompts are never reused. */
export function askForFillItem(
  label: string,
  kind: "text" | "checkbox" | "choice" | "signature" = "text",
): string {
  const human = humanQuestionLabel(label) ?? "";
  if (!human) return "";
  if (kind === "signature" || /^signature$/i.test(human)) {
    return `Say or type the name to sign for ${human}.`;
  }
  if (kind === "checkbox" || human.endsWith("?")) {
    return human.endsWith("?") ? human : `${human}?`;
  }
  if (/^(SBD|MBD)\b/.test(human)) {
    return `Confirm you will attach the completed ${human}.`;
  }
  return `What should I enter for ${human}?`;
}
