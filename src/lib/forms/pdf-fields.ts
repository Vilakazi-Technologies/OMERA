import fontkit from "@pdf-lib/fontkit";
import {
  PDFButton, PDFCheckBox, PDFDocument, PDFDropdown, PDFField, PDFName,
  PDFPage, PDFRadioGroup, PDFSignature, PDFTextField, PDFFont, rgb,
} from "pdf-lib";

export type PdfFieldInfo = {
  id: string;
  kind: "text" | "checkbox" | "choice" | "signature";
  required: boolean;
  initialValue: string | boolean;
  options?: string[];
  maxLength?: number;
};

function pageForWidget(pdf: PDFDocument, widget: { P?: () => unknown }): PDFPage {
  const pageRef = widget.P?.();
  const pages = pdf.getPages();
  if (!pageRef) return pages[0];
  for (const page of pages) {
    if (page.ref === pageRef) return page;
  }
  return pages[0];
}

function drawSignatureLabel(
  pdf: PDFDocument,
  field: PDFSignature,
  text: string,
  font: PDFFont,
) {
  const widgets = field.acroField.getWidgets();
  for (const widget of widgets) {
    const rect = widget.getRectangle();
    const page = pageForWidget(pdf, widget);
    const size = Math.min(12, Math.max(8, rect.height * 0.55));
    const signed = text.trim();
    page.drawText(signed, {
      x: rect.x + 2,
      y: rect.y + (rect.height - size) / 2,
      size,
      font,
      color: rgb(0, 0, 0.35),
      maxWidth: Math.max(4, rect.width - 4),
    });
  }
}

function describe(field: PDFField): PdfFieldInfo | null {
  if (field instanceof PDFSignature) {
    return {
      id: field.getName(),
      kind: "signature",
      required: field.isRequired(),
      initialValue: "",
    };
  }
  if (field instanceof PDFButton || field.isReadOnly()) return null;
  const base = { id: field.getName(), required: field.isRequired() };
  if (field instanceof PDFTextField) {
    if (field.isRichFormatted()) throw new Error("UNSUPPORTED_FIELD_TYPE");
    return { ...base, kind: "text", initialValue: field.getText() ?? "", maxLength: field.getMaxLength() };
  }
  if (field instanceof PDFCheckBox) {
    return { ...base, kind: "checkbox", initialValue: field.isChecked() };
  }
  if (field instanceof PDFDropdown) {
    if (field.isMultiselect() || field.isEditable()) throw new Error("UNSUPPORTED_FIELD_TYPE");
    return { ...base, kind: "choice", options: field.getOptions(), initialValue: field.getSelected()[0] ?? "" };
  }
  if (field instanceof PDFRadioGroup) {
    return { ...base, kind: "choice", options: field.getOptions(), initialValue: field.getSelected() ?? "" };
  }
  throw new Error("UNSUPPORTED_FIELD_TYPE");
}

async function load(bytes: Uint8Array) {
  if (!bytes.length || bytes.length > 4000000) throw new Error("INVALID_PDF_SIZE");
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") throw new Error("INVALID_PDF");
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
  if (pdf.getPageCount() > 20) throw new Error("PDF_PAGE_LIMIT");
  if (pdf.catalog.getAcroForm()?.dict.has(PDFName.of("XFA"))) throw new Error("UNSUPPORTED_XFA");
  const form = pdf.getForm();
  const fields = form.getFields().map(describe).filter((field): field is PdfFieldInfo => field !== null);
  if (!fields.length) throw new Error("NO_FILLABLE_FIELDS");
  if (fields.length > 100) throw new Error("PDF_FIELD_LIMIT");
  return { pdf, form, fields };
}

export async function inspectPdfFields(bytes: Uint8Array): Promise<PdfFieldInfo[]> {
  return (await load(bytes)).fields;
}

export async function fillPdfFields(
  bytes: Uint8Array,
  answers: Record<string, string | boolean>,
  fontBytes: Uint8Array,
): Promise<Uint8Array> {
  const { pdf, form, fields } = await load(bytes);
  const names = new Set(fields.map((field) => field.id));
  for (const name of Object.keys(answers)) {
    if (!names.has(name)) throw new Error("UNKNOWN_FIELD");
  }
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(fontBytes, { subset: true });
  const supportedCodepoints = new Set(font.getCharacterSet());
  function validateGlyphs(value: string) {
    for (const character of value) {
      if (character === "\r" || character === "\n" || character === "\t") continue;
      if (!supportedCodepoints.has(character.codePointAt(0)!)) throw new Error("UNSUPPORTED_CHARACTER");
    }
  }
  for (const info of fields) {
    const supplied = Object.prototype.hasOwnProperty.call(answers, info.id);
    const value = supplied ? answers[info.id] : info.initialValue;
    const field = form.getField(info.id);
    if (info.kind === "checkbox") {
      if (typeof value !== "boolean") throw new Error("INVALID_CHECKBOX");
      if (info.required && !value) throw new Error("REQUIRED_FIELD");
      if (!(field instanceof PDFCheckBox)) throw new Error("FIELD_TYPE_MISMATCH");
      if (value) field.check();
      else field.uncheck();
      continue;
    }
    if (typeof value !== "string") throw new Error("INVALID_TEXT");
    if (info.required && !value.trim()) throw new Error("REQUIRED_FIELD");
    if (info.maxLength !== undefined && value.length > info.maxLength) throw new Error("VALUE_TOO_LONG");
    if (info.kind === "signature") {
      if (!(field instanceof PDFSignature)) throw new Error("FIELD_TYPE_MISMATCH");
      if (typeof value !== "string") throw new Error("INVALID_TEXT");
      if (info.required && !value.trim()) throw new Error("REQUIRED_FIELD");
      if (value.trim()) {
        validateGlyphs(value);
        drawSignatureLabel(pdf, field, value, font);
      }
      continue;
    }
    if (info.kind === "text") {
      if (!(field instanceof PDFTextField)) throw new Error("FIELD_TYPE_MISMATCH");
      validateGlyphs(value);
      field.setText(value);
    } else {
      if (value && !info.options?.includes(value)) throw new Error("INVALID_CHOICE");
      validateGlyphs(value);
      if (field instanceof PDFDropdown || field instanceof PDFRadioGroup) {
        if (value) field.select(value);
        else field.clear();
      } else {
        throw new Error("FIELD_TYPE_MISMATCH");
      }
    }
  }
  form.updateFieldAppearances(font);
  return pdf.save({ updateFieldAppearances: false });
}
