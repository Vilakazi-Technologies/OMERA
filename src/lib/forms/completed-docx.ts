import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import type { StoredFormField } from "@/lib/db/form-sessions";

function answerText(
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

/**
 * A completed Word file. This is the best download when the original
 * Word document cannot be rewritten in place.
 */
export async function buildCompletedDocx(input: {
  fileName: string;
  fields: StoredFormField[];
  answers: Record<string, string | boolean>;
}): Promise<Uint8Array> {
  const children: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun("Completed form")],
    }),
    new Paragraph({
      children: [new TextRun(input.fileName || "Uploaded form")],
    }),
    new Paragraph({
      children: [
        new TextRun(
          "These are the answers from your conversation with Omera.",
        ),
      ],
    }),
  ];

  if (input.fields.length === 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun(
            "The text in the file was thin, so there were no blanks to fill. You can replace it with a clearer copy.",
          ),
        ],
      }),
    );
  }

  for (const field of input.fields) {
    children.push(
      new Paragraph({
        spacing: { before: 240 },
        children: [new TextRun({ text: field.label, bold: true })],
      }),
    );
    children.push(
      new Paragraph({
        children: [new TextRun(answerText(field, input.answers))],
      }),
    );
  }

  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(doc);
  return new Uint8Array(buffer);
}
