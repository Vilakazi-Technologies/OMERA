import { PDFDocument, StandardFonts } from "pdf-lib";
import { expect, it } from "vitest";
import { inferFieldsFromExtractedText } from "@/lib/forms/infer-from-text";
import { extractTextFromPdf } from "@/lib/forms/pdf-text";

/** Fixture lines from GPL RFP PR10069056 — not the real PDF. */
const GAUTENG_RFP_FIXTURE = [
  "REQUEST FOR PROPOSAL",
  "APPOINTMENT OF A SERVICE PROVIDER TO REDEVELOP THE WEBSITE FOR THE GPL",
  "RFQ NO :PR10069056",
  "NON-COMPULSORY : 14 OCTOBER 2026 BRIEFING SESSION VENUE: MICROSOFT TEAMS",
  "These are documents required for this bidding. Should the bidder fail to submit the following documents, the bid will be disqualified automatically:",
  "the bid will be disqualified automatically:",
  "the paid will be disqualified automatically:",
  "Bidders must submit relevant signed reference letters for",
  "The bidder shall submit:",
  "2. Pricing Schedule (Firm Pricing) SBD 3.3 Yes",
  "3. Bidders Disclosure (SBD 4) Original completed and signed.",
  "NAME OF BIDDER: …………………………………………………",
  "CSD number: ______",
  "Tax reference: ______",
  "Signature: …………………………………………………",
].join("\n");

it("does not turn RFP disqualification scraps into questions", () => {
  const fields = inferFieldsFromExtractedText(GAUTENG_RFP_FIXTURE);
  const blob = fields.map((field) => `${field.label} ${field.prompt}`).join(" | ");
  expect(blob).not.toMatch(/disqualif/i);
  expect(blob).not.toMatch(/what is your paid/i);
  expect(blob).not.toMatch(/non-?compulsory briefing/i);
  expect(fields.map((field) => field.label).join(" ")).toMatch(/NAME OF BIDDER/i);
  expect(fields.some((field) => /SBD 4/i.test(field.label))).toBe(true);
  expect(fields[0]?.label).toMatch(/NAME OF BIDDER|CSD|Tax|company/i);
});

it("reads a blank on the line under a short label", () => {
  const fields = inferFieldsFromExtractedText(
    ["Staff details", "Surname", "________________", "Signature", "________________"].join(
      "\n",
    ),
  );
  expect(fields.map((field) => field.label)).toEqual(
    expect.arrayContaining(["Surname", "Signature"]),
  );
});

it("reads a box after a colon as a fill-in", () => {
  const fields = inferFieldsFromExtractedText("Yes / No answer: [ ]");
  expect(fields.map((field) => field.label).join(" ")).toMatch(/Yes \/ No answer/i);
});

it("turns labeled blanks into a question list", () => {
  const fields = inferFieldsFromExtractedText(
    [
      "Application for leave",
      "Full name: ______",
      "ID number: ______",
      "Date: ______",
      "Signature: ______",
    ].join("\n"),
  );
  expect(fields.map((field) => field.label)).toEqual(
    expect.arrayContaining(["Full name", "ID number", "Date", "Signature"]),
  );
  expect(fields.find((field) => field.label === "Signature")?.kind).toBe(
    "signature",
  );
});

it("ignores empty or instruction-only text", () => {
  expect(inferFieldsFromExtractedText("Please complete this form.")).toEqual([]);
});

it("skips a brochure-style narrative with no blanks", () => {
  expect(
    inferFieldsFromExtractedText(
      [
        "VILATECH company brochure",
        "We build Omera for South African municipalities.",
        "Contact our office for a demo of the platform.",
      ].join("\n"),
    ),
  ).toEqual([]);
});

it("skips narrative paragraphs that are not fill-in lines", () => {
  const fields = inferFieldsFromExtractedText(
    [
      "The appointed firm must produce annual financial statements for three years without asking the user to type that paragraph.",
      "Company name: ______",
    ].join("\n"),
  );
  expect(fields.map((field) => field.label)).toEqual(["Company name"]);
});

it("infers RFPO blanks without turning warnings into questions", () => {
  const fields = inferFieldsFromExtractedText(
    [
      "RFPO appointment of a service provider",
      "These documents are required. Failure to submit means the bid will be disqualified automatically:",
      "the paid will be disqualified automatically:",
      "NAME OF BIDDER: ______",
      "SBD 4",
      "Signature: ______",
    ].join("\n"),
  );
  const blob = fields.map((field) => `${field.label} ${field.prompt}`).join(" | ");
  expect(blob).not.toMatch(/disqualif/i);
  expect(blob).not.toMatch(/what is your paid/i);
  expect(fields.map((field) => field.label).join(" ")).toMatch(/NAME OF BIDDER/i);
  expect(fields.some((field) => /SBD 4/i.test(field.label))).toBe(true);
});

it("infers a simple fillable form without dropping labeled blanks", () => {
  const fields = inferFieldsFromExtractedText(
    [
      "Staff details form",
      "First name: ______",
      "Department: ______",
      "Employee number: ______",
      "Signature: ______",
    ].join("\n"),
  );
  expect(fields.map((field) => field.label)).toEqual(
    expect.arrayContaining([
      "First name",
      "Department",
      "Employee number",
      "Signature",
    ]),
  );
});

it("infers RFQ returnables including MBD forms", () => {
  const fields = inferFieldsFromExtractedText(
    [
      "REQUEST FOR QUOTATION",
      "RFQ NO: Q-2026-11",
      "Company name: ______",
      "CSD number: ______",
      "Returnable: MBD 4",
      "Pricing schedule: ______",
    ].join("\n"),
  );
  const labels = fields.map((field) => field.label).join(" | ");
  expect(labels).toMatch(/Company name/i);
  expect(labels).toMatch(/CSD/i);
  expect(labels).toMatch(/MBD 4/i);
  expect(labels).not.toMatch(/disqualif/i);
});

it("infers SBD returnables and ellipsis blanks without AcroForm", () => {
  const fields = inferFieldsFromExtractedText(
    [
      "REQUEST FOR PROPOSAL website for the GPL RFQ NO :PR10069056",
      "CLOSING DATE: :19 OCTOBER 2026",
      "Pricing Schedule SBD 3.3",
      "Bidders Disclosure (SBD 4)",
      "NAME OF BIDDER: …………………………………………………",
      "Signature: …………………………………………………",
    ].join("\n"),
  );
  const labels = fields.map((field) => field.label).join(" | ");
  expect(labels).toMatch(/NAME OF BIDDER/i);
  expect(labels).toMatch(/SBD 3\.3/i);
  expect(labels).toMatch(/SBD 4/i);
  expect(fields.some((field) => field.kind === "signature")).toBe(true);
});

it("reads a generated flat PDF and lists the blanks", async () => {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText("Leave application", { x: 40, y: 720, size: 14, font });
  page.drawText("Full name: ______", { x: 40, y: 690, size: 12, font });
  page.drawText("Date: ______", { x: 40, y: 670, size: 12, font });
  const text = await extractTextFromPdf(Buffer.from(await pdf.save()));
  const fields = inferFieldsFromExtractedText(text);
  expect(fields.map((field) => field.label)).toEqual(
    expect.arrayContaining(["Full name", "Date"]),
  );
});
