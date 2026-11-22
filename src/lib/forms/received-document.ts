/**
 * What people actually send: PDF, legacy Word (.doc), and Word (.docx).
 * Classification uses the name, the MIME type, and the file header.
 * A PDF or Word name is never treated as an unsupported format.
 */

export type ReceivedKind = "pdf" | "docx" | "doc";

export type ReceivedDocument = {
  kind: ReceivedKind;
  /** True only when the bytes start with %PDF-. */
  trustedPdf: boolean;
};

const PDF_MIMES = new Set([
  "application/pdf",
  "application/x-pdf",
  "application/acrobat",
  "application/vnd.pdf",
  "application/octet-stream",
]);

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DOC_MIME = "application/msword";

function baseMime(contentType: string): string {
  return contentType.split(";")[0].trim().toLowerCase();
}

function extension(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot === -1 ? "" : base.slice(dot).toLowerCase();
}

function isZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function isOle(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0
  );
}

function looksLikeDocx(bytes: Uint8Array): boolean {
  if (!isZip(bytes)) return false;
  const slice = bytes.subarray(0, Math.min(bytes.length, 80_000));
  return Buffer.from(slice).toString("latin1").includes("word/document.xml");
}

export function isPdfMagic(bytes: Uint8Array): boolean {
  if (bytes.length < 5) return false;
  return new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
}

/**
 * PDF and Word are always accepted. Other types return null so the route
 * can ask for a PDF or Word file without calling the upload a rejected format.
 */
export function classifyReceivedFile(input: {
  fileName: string;
  contentType: string;
  bytes: Uint8Array;
}): ReceivedDocument | null {
  const ext = extension(input.fileName);
  const mime = baseMime(input.contentType);
  const pdfMagic = isPdfMagic(input.bytes);

  if (pdfMagic) return { kind: "pdf", trustedPdf: true };

  const namedDocx = ext === ".docx" || mime === DOCX_MIME;
  const namedDoc = ext === ".doc" || mime === DOC_MIME;
  if (namedDocx || looksLikeDocx(input.bytes)) {
    return { kind: "docx", trustedPdf: false };
  }
  if (namedDoc || isOle(input.bytes)) {
    return { kind: "doc", trustedPdf: false };
  }
  const pdfMime = PDF_MIMES.has(mime) && mime !== "application/octet-stream";
  if (ext === ".pdf" || pdfMime) {
    return { kind: "pdf", trustedPdf: false };
  }
  return null;
}
