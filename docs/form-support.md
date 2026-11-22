# Form support (I4)

Completed PDF forms: upload a PDF, answer one question at a time, review
every answer, then download a completed PDF. No demo fields, no text-only chat
as the success output, no automatic speech output.

## Supported document classes

| Class | Path | Limits |
|---|---|---|
| AcroForm PDF with fillable fields | C10 codec inspect (`inspectPdfFields`) → Xavani labels/prompts (`extractFormFields`) → C10 fill (`fillPdfFields`) on export | ≤ 10 000 000 byte upload (Vercel may still 413 near 4.5 MB); ≤ **40 pages** for in-place fill; ≤ 100 fillable fields; approved font `assets/fonts/NotoSans-Regular.ttf`; export response ≤ 8 000 000 bytes |
| Mixed / flat PDF (tender, RFP, RFQ, no AcroForm, or over 40 pages) | Text extract (first **80 pages**, 80 000 characters) → document briefing → field inference (heuristic + AI; vision only when text is sparse) → answers appendix on export | Missing AcroForm is not a failure. A valid unencrypted PDF always starts a session. If there are no fill-in questions, Omera still saves the file and briefing and asks for a form that needs completing (it does not invent identity questions). ≤ 100 inferred fields; download adds a **Completed answers** page |
| Owner flat templates (optional) | Approved fingerprint in `templates.ts` → rectangle overlay (gate G4) | Registry starts empty; unknown fingerprints are not used for inference |

### Signatures

AcroForm **signature widgets** are supported as **typed printed names**: Omera asks
for the signer's name and draws it in the signature box on export. This is not a
PKI digital signature and does not use certificate signing.

## Upload MIME types

Analyzed uploads must be PDF bytes (magic `%PDF-`). Accepted `Content-Type`
values include `application/pdf`, common PDF aliases, and
`application/octet-stream` when the bytes are still a PDF. The Supabase
`omera-forms` bucket is **PDF-only** at 10 MB (see
`20261116130000_form_bucket_10mb.sql` and
`20261116220000_ensure_form_bucket.sql`). Uploads always send
`Content-Type: application/pdf`. Apply the ensure migration on production
Supabase (`lpnlyethmoilqwoekvmc`); until then a 4 MB bucket rejects after
the PDF is read (`STORAGE_UPLOAD_FAILED` or `FILE_TOO_LARGE`). DOCX/images
are not analyzed on the form route in this MVP.

## Rejected documents

- XFA forms (`UNSUPPORTED_XFA`, 422).
- Encrypted documents (422) — never decrypted server-side.
- Unsupported MIME types (415) — non-PDF on the analyze route.
- Files over 10 000 000 bytes (413 `FILE_TOO_LARGE`); multipart bodies over 10 200 000 bytes (413 `REQUEST_TOO_LARGE`). A non-JSON 413 from the platform is shown as `FILE_TOO_LARGE`.
- Malformed PDFs and bad magic bytes (422). Passworded files are `ENCRYPTED_PDF`. Long packs without AcroForm are inferred, not rejected. A valid PDF with no blanks still gets a briefing and is not treated as `UNREADABLE_DOCUMENT` or `STORAGE_UPLOAD_FAILED`.
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

The `omera-forms` bucket matches the application boundary: 10 MB maximum and
`application/pdf` only. Larger or other types are rejected before upload. If
the live bucket is missing or still 4 MB, run this in the Supabase SQL editor
for project `lpnlyethmoilqwoekvmc`:

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'omera-forms',
  'omera-forms',
  false,
  10000000,
  array['application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
```

Confirm with:

```sql
select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'omera-forms';
```

`file_size_limit` must be `10000000` (not `4000000`). The service-role JWT
must belong to the same project as `SUPABASE_URL`.
