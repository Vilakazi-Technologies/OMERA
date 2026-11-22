import { detectCsvDelimiter, parseCsvText } from "@/lib/csv/parse-csv";

export type PersonFieldKey =
  | "fullName"
  | "idNumber"
  | "phone"
  | "email"
  | "address"
  | "postalAddress"
  | "employer"
  | "csd"
  | "tax"
  | "vat";

export type PersonFromCsv = {
  sourceRow: number;
  dataRowCount: number;
  note: string;
  values: Partial<Record<PersonFieldKey, string>>;
  display: { label: string; value: string }[];
};

const DISPLAY_LABEL: Record<PersonFieldKey, string> = {
  fullName: "Full name",
  idNumber: "ID number",
  phone: "Phone",
  email: "Email",
  address: "Address",
  postalAddress: "Postal address",
  employer: "Employer",
  csd: "CSD",
  tax: "Tax",
  vat: "VAT",
};

const ALIASES: Record<PersonFieldKey | "firstName" | "surname", string[]> = {
  fullName: ["full name", "fullname", "name and surname", "applicant name", "person name", "employee name", "member name", "client name", "name"],
  firstName: ["first name", "firstname", "given name", "forename"],
  surname: ["surname", "last name", "lastname", "family name"],
  idNumber: ["identity number", "id number", "id no", "sa id number", "sa id", "national id", "national identity number"],
  phone: ["cell phone", "cellphone", "mobile number", "phone number", "contact number", "telephone number", "telephone", "mobile", "cell", "phone", "tel"],
  email: ["email address", "e mail", "email"],
  address: ["physical address", "residential address", "street address", "home address", "address"],
  postalAddress: ["postal address", "po box"],
  employer: ["employer name", "company name", "organisation name", "organization name", "employer", "company", "organisation", "organization", "workplace"],
  csd: ["csd number", "csd no", "maaa number", "supplier number", "central supplier database", "csd", "maaa"],
  tax: ["income tax number", "tax reference number", "tax reference", "tax number", "tax pin", "income tax", "tax no", "tax"],
  vat: ["vat number", "vat no", "vat"],
};

const MATCH_KEYS: PersonFieldKey[] = ["fullName", "idNumber", "phone", "email", "address", "postalAddress", "employer", "csd", "tax", "vat"];

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[_./]+/g, " ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function aliasScore(header: string, alias: string): number {
  if (header === alias) return 100 + alias.length;
  if (` ${header} `.includes(` ${alias} `)) return 40 + alias.length;
  return 0;
}

function columnKey(header: string): PersonFieldKey | "firstName" | "surname" | null {
  const normalized = normalizeHeader(header);
  if (!normalized) return null;
  if (normalized === "id") return "idNumber";
  let best: { key: PersonFieldKey | "firstName" | "surname"; score: number } | null = null;
  for (const [key, aliases] of Object.entries(ALIASES) as Array<[PersonFieldKey | "firstName" | "surname", string[]]>) {
    for (const alias of aliases) {
      const score = aliasScore(normalized, alias);
      if (!best || score > best.score) best = { key, score };
    }
  }
  if (!best || best.score < 40) return null;
  if (best.key === "employer" && /\b(registration|reg no|ck|cipc)\b/.test(normalized)) return null;
  return best.key;
}

type MappedRow = {
  values: Partial<Record<PersonFieldKey | "firstName" | "surname", string>>;
  extras: { label: string; value: string }[];
};

function mapRow(headers: string[], row: string[], columns: Array<PersonFieldKey | "firstName" | "surname" | null>): MappedRow {
  const values: MappedRow["values"] = {};
  const extras: MappedRow["extras"] = [];
  headers.forEach((header, index) => {
    const value = (row[index] ?? "").trim();
    if (!value) return;
    const key = columns[index];
    if (!key) {
      extras.push({ label: header.trim() || `Column ${index + 1}`, value });
      return;
    }
    if (!values[key]) values[key] = value;
  });
  if (!values.fullName) {
    const joined = [values.firstName, values.surname].filter(Boolean).join(" ");
    if (joined) values.fullName = joined;
  }
  return { values, extras };
}

export function extractPersonFromCsv(raw: string): PersonFromCsv {
  const table = parseCsvText(raw, detectCsvDelimiter(raw));
  if (!table.headers.length || table.rows.length === 0) throw new Error("NO_PERSON_ROW");
  const columns = table.headers.map(columnKey);
  const mapped = table.rows.map((row) => mapRow(table.headers, row, columns));
  let index = mapped.findIndex((row) => Boolean(row.values.fullName?.trim() && (row.values.idNumber || row.values.phone || row.values.email)));
  const complete = index >= 0;
  if (!complete) {
    index = mapped.findIndex((row) => Boolean(row.values.fullName?.trim() || row.values.idNumber || row.values.phone || row.values.email));
  }
  if (index < 0) throw new Error("NO_PERSON_ROW");
  const chosen = mapped[index]!;
  const values: Partial<Record<PersonFieldKey, string>> = {};
  for (const key of MATCH_KEYS) {
    const value = chosen.values[key]?.trim();
    if (value) values[key] = value;
  }
  const display = MATCH_KEYS.flatMap((key) => (values[key] ? [{ label: DISPLAY_LABEL[key], value: values[key]! }] : []));
  for (const extra of chosen.extras) display.push(extra);
  const sourceRow = index + 2;
  const dataRowCount = table.rows.length;
  const note = dataRowCount === 1
    ? `Using row ${sourceRow}.`
    : complete
      ? `Using row ${sourceRow} (first complete person of ${dataRowCount} data rows).`
      : `Using row ${sourceRow} (first person row of ${dataRowCount} data rows).`;
  return { sourceRow, dataRowCount, note, values, display };
}

export function prefillForLabel(person: PersonFromCsv, label: string): string | undefined {
  if (/\bsign(ature|ed| here|atory)?\b|\bsign\s+here\b/i.test(label)) return undefined;
  const normalized = normalizeHeader(label);
  if (!normalized) return undefined;
  let best: { key: PersonFieldKey; score: number } | null = null;
  for (const key of MATCH_KEYS) {
    if (!person.values[key]) continue;
    for (const alias of ALIASES[key]) {
      const score = aliasScore(normalized, alias);
      if (!best || score > best.score) best = { key, score };
    }
  }
  if (best && best.score >= 40) return person.values[best.key];
  return person.display.find((row) => normalizeHeader(row.label) === normalized)?.value;
}
