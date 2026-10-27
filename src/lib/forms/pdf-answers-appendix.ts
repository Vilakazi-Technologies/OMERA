import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";
import type { StoredFormField } from "@/lib/db/form-sessions";

function displayValue(
  field: StoredFormField,
  answers: Record<string, string | boolean>,
): string {
  const raw = answers[field.id];
  if (field.kind === "checkbox") {
    return raw === true || raw === "true" ? "Yes" : "No";
  }
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return "—";
}

function drawWrapped(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  font: PDFFont,
  size: number,
): number {
  const words = text.split(/\s+/);
  let line = "";
  let cursorY = y;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      page.drawText(line, { x, y: cursorY, size, font, color: rgb(0.1, 0.1, 0.1) });
      cursorY -= size * 1.35;
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) {
    page.drawText(line, { x, y: cursorY, size, font, color: rgb(0.1, 0.1, 0.1) });
    cursorY -= size * 1.35;
  }
  return cursorY;
}

/**
 * Append a summary page to the original PDF when AcroForm fill is not possible.
 * The original pages are unchanged; answers appear on new "Completed answers" pages.
 */
export async function appendAnswersSummaryPdf(
  originalBytes: Uint8Array,
  fields: StoredFormField[],
  answers: Record<string, string | boolean>,
  fontBytes: Uint8Array,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(originalBytes, {
    ignoreEncryption: false,
    updateMetadata: false,
  });
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(fontBytes, { subset: true });
  const margin = 48;
  const pageWidth = 612;
  const pageHeight = 792;
  const contentWidth = pageWidth - margin * 2;

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  page.drawText("Completed answers (Omera)", {
    x: margin,
    y,
    size: 16,
    font,
    color: rgb(0, 0, 0),
  });
  y -= 28;
  y = drawWrapped(
    page,
    "This PDF had no fillable fields. Your answers are listed below; print and attach if needed.",
    margin,
    y,
    contentWidth,
    font,
    10,
  );
  y -= 12;

  for (const field of fields) {
    if (y < margin + 48) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    const label = `${field.label}${field.required ? " *" : ""}`;
    page.drawText(label, { x: margin, y, size: 11, font, color: rgb(0.15, 0.15, 0.15) });
    y -= 16;
    y = drawWrapped(
      page,
      displayValue(field, answers),
      margin,
      y,
      contentWidth,
      font,
      11,
    );
    y -= 8;
  }

  return pdf.save({ updateFieldAppearances: false });
}
