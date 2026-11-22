/**
 * Company registration answers may include the registered name.
 * "Vilakazi Technologies" is the legal name already recorded in the advisor
 * prompt. Pair it only when a registration number is also supplied.
 * Do not invent a number, and do not place this name on the public site.
 */

export const RECORDED_LEGAL_NAME = "Vilakazi Technologies";

const CIPC_NUMBER = /\b(\d{4}\/\d{5,7}\/\d{2})\b/;

const REGISTRATION_LABEL =
  /\b(registration number|company registration|ck number|cipc)\b/i;

export function isCompanyRegistrationLabel(label: string): boolean {
  return REGISTRATION_LABEL.test(label);
}

/**
 * Returns "number, legal name" only when both parts already exist.
 * A name alone, or a number we do not have, stays unset.
 */
export function pairRegistrationIdentity(
  registrationNumber: string | null | undefined,
  legalName: string | null | undefined,
): string | null {
  const number = registrationNumber?.trim() ?? "";
  const name = legalName?.trim() ?? "";
  const match = CIPC_NUMBER.exec(number);
  if (!match || !name) return null;
  if (number.toLowerCase().includes(name.toLowerCase())) {
    return number;
  }
  return `${match[1]}, ${name}`;
}

/** Shown on the registration question. Does not guess a number or a company. */
export function withRegistrationGuidance(label: string, prompt: string): string {
  if (!isCompanyRegistrationLabel(label)) return prompt;
  const guidance =
    `You can write the registration number and the registered name together in this answer. When the registered name is ${RECORDED_LEGAL_NAME}, include that name with the number.`;
  if (prompt.toLowerCase().includes("registered name")) return prompt;
  const trimmed = prompt.trim().replace(/[.]+$/, "");
  return `${trimmed}. ${guidance}`;
}
