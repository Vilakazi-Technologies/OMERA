import { PDFDocument, StandardFonts } from "pdf-lib";
import { expect, it } from "vitest";
import { inferFieldsFromExtractedText } from "@/lib/forms/infer-from-text";
import { extractTextFromPdf } from "@/lib/forms/pdf-text";

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
