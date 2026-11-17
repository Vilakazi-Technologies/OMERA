/** Shared rules: only ask what a person must answer or attach. */

export const FILL_BLANK_RUN =
  /(?:_{2,}|\.{3,}|\u2026{1,}|\u22ef{1,}|[·.]{5,}|\[[\s_xX.]{0,8}\])/;

const FILL_HINT =
  /\b(name of bidder|bidder'?s name|company name|trading as|full name|surname|initials|identity number|id number|csd|maaa|tax( reference| pin)?|vat number|b-?bb+ee|cidb|contact person|e-?mail|telephone|cell(phone)?|fax|postal address|physical address|registration number|ck number|cipc|signature|signatory|capacity|date of|birth|price|amount|ceiling price|bid price|director|shareholder|witness)\b/i;

const RETURNABLE_HINT =
  /\b((sbd|mbd)\s*\d|returnable|pricing schedule|bidders disclosure|preference point|central supplier database|tax compliance|company registration documents)\b/i;

const BOILERPLATE =
  /\b(disqualif|non-?compulsory briefing|failure to (submit|comply)|late submissions?|shall\b|must submit|will be|may be disqualified|evaluation criteria|scope of work|please note)\b/i;

const JUNK_LABEL =
  /^(the|a|an|and|or|paid|bid|will|be|item|yes|no|page|note|section)$/i;

const SENTENCE_STARTER =
  /^(the|if|should|failure|these|this|bidders? must|the bidder|late submissions?)\b/i;

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function isJunkFragment(label: string): boolean {
  const trimmed = label.replace(/[:.?]+$/g, "").trim();
  if (!trimmed) return true;
  if (JUNK_LABEL.test(trimmed)) return true;
  if (trimmed.length < 3 && !/^(id|vat)$/i.test(trimmed)) return true;
  return false;
}

export function isPlausibleFieldLabel(label: string): boolean {
  const trimmed = label.replace(/[:.?]+$/g, "").replace(/\s+/g, " ").trim();
  if (isJunkFragment(trimmed)) return false;
  const words = wordCount(trimmed);
  if (words < 1 || words > 14) return false;
  if (SENTENCE_STARTER.test(trimmed) && !FILL_HINT.test(trimmed)) return false;
  return true;
}

/**
 * True when a line is a warning / instruction, not a blank the user fills.
 * Lines with a blank, SBD/MBD number, or a known field name still pass.
 */
export function isBoilerplateInstruction(
  text: string,
  label = "",
  sourceLine = "",
): boolean {
  const blob = `${text} ${label} ${sourceLine}`;
  if (/\bdisqualif/i.test(blob) && !FILL_HINT.test(label) && !FILL_BLANK_RUN.test(sourceLine)) {
    return true;
  }
  if (/\bnon-?compulsory briefing\b/i.test(blob)) return true;
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
  const trimmed = label.replace(/\s+/g, " ").trim();
  if (!trimmed || isJunkFragment(trimmed)) return false;
  if (isBoilerplateInstruction(trimmed, trimmed, sourceLine)) return false;
  if (FILL_HINT.test(trimmed) || FILL_HINT.test(sourceLine)) return true;
  if (RETURNABLE_HINT.test(trimmed) || RETURNABLE_HINT.test(sourceLine)) {
    return true;
  }
  if (/\byes\s*\/\s*no\b/i.test(sourceLine) && isPlausibleFieldLabel(trimmed)) {
    return true;
  }
  if (FILL_BLANK_RUN.test(sourceLine) && isPlausibleFieldLabel(trimmed)) {
    return true;
  }
  if (
    isPlausibleFieldLabel(trimmed) &&
    wordCount(trimmed) <= 8 &&
    /[:?]\s*$/.test(sourceLine.trim())
  ) {
    return true;
  }
  return false;
}

/** Drop model rows that turned warnings into questions. */
export function isModelFillItem(label: string, prompt: string): boolean {
  if (isJunkFragment(label)) return false;
  if (isBoilerplateInstruction(`${label} ${prompt}`, label, prompt)) return false;
  if (FILL_HINT.test(label) || RETURNABLE_HINT.test(label)) return true;
  return isPlausibleFieldLabel(label);
}

export function promptForFillItem(
  label: string,
  kind: "text" | "checkbox" | "choice" | "signature",
): string {
  if (kind === "signature") {
    return `Type your full name to sign "${label}" (printed signature — not a digital certificate).`;
  }
  if (kind === "checkbox") {
    return `Is this true: ${label}? (yes or no)`;
  }
  if (/^(sbd|mbd)\s*\d/i.test(label) || RETURNABLE_HINT.test(label)) {
    return `Attach or confirm the completed ${label}.`;
  }
  if (FILL_HINT.test(label) || isPlausibleFieldLabel(label)) {
    return `What is the ${label.replace(/[:?]+$/g, "").trim().toLowerCase()}?`;
  }
  return `Please provide: ${label}`;
}
