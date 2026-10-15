# Form support (I4)

Completed PDF forms: upload a fillable PDF, answer one question at a time,
review every answer, then download the completed PDF. No demo fields, no
text summary as the success output, no automatic speech output.

## Supported document classes

| Class | Path | Limits |
|---|---|---|
| AcroForm PDF with fillable fields | C10 codec inspect (`inspectPdfFields`) → Xavani labels/prompts (`extractFormFields`) → C10 fill (`fillPdfFields`) on export | ≤ 4 000 000 byte upload; ≤ 20 pages; ≤ 100 fillable fields; approved font `assets/fonts/NotoSans-Regular.ttf`; export response ≤ 8 000 000 bytes |
| Flat / scanned PDF | Rejected until gate G4 supplies owner-approved templates | Template registry starts empty; unknown fingerprints return `UNKNOWN_TEMPLATE` |

## Rejected documents

- XFA forms (`UNSUPPORTED_XFA`, 422) — the C10 codec inspects the AcroForm
  before the library can strip the XFA marker.
- Encrypted documents (422) — never decrypted server-side.
- Signature fields (`SIGNATURE_REQUIRES_REVIEW`, 422) — need human review.
- Unsupported MIME types (415) — only `application/pdf` is analyzed.
- Files over 4 000 000 bytes (413); multipart bodies over 4 100 000 bytes (413).
- Malformed PDFs and bad magic bytes (422); scans with no fillable fields
  (422, `NO_FILLABLE_FIELDS`).
- Text that exceeds an approved rectangle (422, `VALUE_TOO_LONG`); choices
  outside the stored options (400/422, `INVALID_CHOICE`); missing required
  values (400/422, `MISSING_REQUIRED_VALUE` / `REQUIRED_FIELD`).

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
  codec (page order, labels, and page sizes preserved), and returns
  `application/pdf` as a safe attachment with `Cache-Control: private,
  no-store`. A failed export keeps the session in `review`.
- Deletion removes the owned session row plus its private objects, retrying
  transient object failures.
