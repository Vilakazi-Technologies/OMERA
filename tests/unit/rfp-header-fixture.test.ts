import { PDFDocument, StandardFonts } from "pdf-lib";
import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { heuristicDocumentBrief } from "@/lib/forms/document-brief";
import { inferFieldsFromExtractedText } from "@/lib/forms/infer-from-text";
import { extractPdfDocument } from "@/lib/forms/pdf-text";

/** Small stand-in for the Gauteng GPL RFP header — not the real tender pack. */
const RFP_LINES = [
  "REQUEST FOR PROPOSAL",
  "APPOINTMENT OF A SERVICE PROVIDER TO REDEVELOP THE WEBSITE FOR THE GPL",
  "RFQ NO :PR10069056",
  "CLOSING DATE: 19 OCTOBER 2026",
  "Returnable: SBD 3.3 SBD 4",
  "NAME OF BIDDER: __________",
  "Signature: __________",
];

it("extracts a generated GPL RFP header and offers Start filling questions", async () => {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  let y = 720;
  for (const line of RFP_LINES) {
    page.drawText(line, { x: 40, y, size: 11, font });
    y -= 18;
  }
  const extracted = await extractPdfDocument(Buffer.from(await pdf.save()));
  expect(extracted.text.length).toBeGreaterThan(200);
  expect(extracted.text).toMatch(/REQUEST FOR PROPOSAL/);
  expect(extracted.text).toMatch(/PR10069056/);

  const brief = heuristicDocumentBrief(extracted.text, "gauteng-rfp-fixture.pdf");
  expect(brief.summary).not.toMatch(/very little text|pages look faint/i);
  expect(brief.documentKind).toBe("rfp");
  expect(brief.parties.some((party) => /GPL/i.test(party.name))).toBe(true);
  expect(brief.keyFacts.join(" ")).toMatch(/PR10069056/);
  expect(brief.deadlines.join(" ")).toMatch(/19 OCTOBER 2026/i);
  expect(brief.fillableSections.join(" ")).toMatch(/SBD 3\.3/);
  expect(brief.fillableSections.join(" ")).toMatch(/SBD 4/);

  const fields = inferFieldsFromExtractedText(extracted.text);
  expect(fields.map((field) => field.label).join(" ")).toMatch(/NAME OF BIDDER/i);
  expect(fields.some((field) => /SBD 3\.3/i.test(field.label))).toBe(true);
  expect(fields.some((field) => /SBD 4/i.test(field.label))).toBe(true);
  expect(fields.length).toBeGreaterThan(0);
});
