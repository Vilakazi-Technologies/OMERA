-- The application accepts PDFs up to 4 MB. The bucket allowed 50 MB and six
-- MIME types. Align the bucket with the application boundary.
update storage.buckets
set file_size_limit = 4000000,
    allowed_mime_types = array['application/pdf']
where id = 'omera-forms';
