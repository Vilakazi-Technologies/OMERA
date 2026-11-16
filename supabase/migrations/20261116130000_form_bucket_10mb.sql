-- Tender packs often exceed 4 MB. Raise the private forms bucket to 10 MB.
-- Application limit is FORM_PDF_FILE_LIMIT (10_000_000). Vercel request bodies
-- may still reject near 4.5 MB at the platform edge; that is FILE_TOO_LARGE.
update storage.buckets
set file_size_limit = 10000000,
    allowed_mime_types = array['application/pdf']
where id = 'omera-forms';
