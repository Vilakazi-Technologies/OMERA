# Form support (I4)

Completed PDF forms: upload a PDF, answer one question at a time, review
every answer, then download a completed PDF. No demo fields, no text-only chat
as the success output, no automatic speech output.

## Supported document classes

| Class | Path | Limits |
|---|---|---|
| AcroForm PDF with fillable fields | C10 codec inspect (`inspectPdfFields`) → Xavani labels/prompts (`extractFormFields`) → C10 fill (`fillPdfFields`) on export | ≤ 4 000 000 byte upload; ≤ 20 pages; ≤ 100 fillable fields; approved font `assets/fonts/NotoSans-Regular.ttf`; export response ≤ 8 000 000 bytes |
| Flat / text PDF (no AcroForm) | Text extract (`extractTextFromPdf`) → AI field inference (`inferFormFieldsFromDocument`) → answers appendix page on export (`appendAnswersSummaryPdf`) | Needs enough extractable text (not a blank scan); ≤ 50 inferred fields; download adds a **Completed answers** page — original pages are not overlaid |
| Owner flat templates (optional) | Approved fingerprint in `templates.ts` → rectangle overlay (gate G4) | Registry starts empty; unknown fingerprints are not used for inference |

### Signatures

AcroForm **signature widgets** are supported as **typed printed names**: Omera asks
for the signer's name and draws it in the signature box on export. This is not a
PKI digital signature and does not use certificate signing.

## Upload MIME types

Analyzed uploads must be PDF bytes (magic `%PDF-`). Accepted `Content-Type`
values include `application/pdf`, common PDF aliases, and
`application/octet-stream` when the bytes are still a PDF. The Supabase
`omera-forms` bucket remains **PDF-only** at 4 MB (see migration
`20261024090000_tighten_form_bucket.sql`). DOCX/images are not analyzed on the
form route in this MVP.

## Rejected documents

- XFA forms (`UNSUPPORTED_XFA`, 422).
- Encrypted documents (422) — never decrypted server-side.
- Unsupported MIME types (415) — non-PDF on the analyze route.
- Files over 4 000 000 bytes (413); multipart bodies over 4 100 000 bytes (413).
- Malformed PDFs and bad magic bytes (422); scans with no text and no AcroForm
  (422, `NO_FILLABLE_FIELDS`).
- Text that exceeds an approved rectangle (422, `VALUE_TOO_LONG`); choices
  outside the stored options (400/422, `INVALID_CHOICE`); missing required
  values (400/422, `MISSING_REQUIRED_VALUE` / `REQUIRED_FIELD`).

## Export modes

- **`acroform`** (default): fields filled in place; response header
  `X-Form-Export-Mode: acroform`.
- **`appendix`**: original PDF plus appended answer summary; header
  `X-Form-Export-Mode: appendix`. Used for `documentKind: flat` and as a
  fallback when in-place fill cannot run.

## Session integrity

- Private storage paths derive from trusted server IDs only
  (`<userId>/<sessionId>/<file>`); client-supplied paths are rejected
  (`CLIENT_PATH_REJECTED`).
- The original bytes are stored before a usable session exists; a failed
  session write removes the orphaned object.
- Answer patches only: stored definitions and document metadata are never
  client-writable (`CLIENT_METADATA_REJECTED`).
- Every patch carries the current revision; stale revisions get HTTP 409
  (`REVISION_CONFLICT`).
- Export verifies the SHA-256 of the stored bytes, fills through the C10
  codec when possible, and returns `application/pdf` as a safe attachment with
  `Cache-Control: private, no-store`. A failed export keeps the session in
  `review`.
- Deletion removes the owned session row plus its private objects, retrying
  transient object failures.

## Storage bucket

The `omera-forms` bucket matches the application boundary: 4 MB maximum and
`application/pdf` only. Larger or other types are rejected before upload.
