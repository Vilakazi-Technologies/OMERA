/** Shared PDF form-fill limits. Keep in sync with docs/form-support.md. */

/** Max original PDF upload (bytes). Multipart wrapper is slightly larger. */
export const FORM_PDF_FILE_LIMIT = 4_000_000;
export const FORM_PDF_MULTIPART_LIMIT = 4_100_000;

/** In-place AcroForm inspect/fill. Longer packs fall back to text + answers appendix. */
export const FORM_PDF_FILL_PAGE_LIMIT = 40;

/** Pages of text Omera reads for briefing and questions (first N). */
export const FORM_PDF_READ_PAGE_LIMIT = 80;

/** Characters sent to briefing/field models after extraction. */
export const FORM_PDF_TEXT_CHAR_BUDGET = 80_000;

/** Raster pages sent to vision when text is thin. */
export const FORM_VISION_MAX_PAGES = 6;

export const FORM_MAX_INFERRED_FIELDS = 50;
