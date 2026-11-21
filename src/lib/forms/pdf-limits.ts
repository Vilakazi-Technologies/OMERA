/** Shared PDF form-fill limits. Keep in sync with docs/form-support.md. */

/** Max original PDF upload (bytes). Multipart wrapper is slightly larger. */
export const FORM_PDF_FILE_LIMIT = 20_000_000;
export const FORM_PDF_MULTIPART_LIMIT = 20_400_000;
export const FORM_PDF_FILE_LIMIT_MB = 20;

/**
 * Vercel Node request bodies are often capped near 4.5 MB on the platform.
 * App + bucket allow 20 MB; a platform 413 still maps to FILE_TOO_LARGE.
 */
export const FORM_PDF_PLATFORM_HINT_MB = 4.5;

/** In-place AcroForm inspect/fill. Longer packs fall back to text + answers appendix. */
export const FORM_PDF_FILL_PAGE_LIMIT = 40;

/** Widgets inspect may keep for briefing/Q&A (fill still uses the 100-field cap). */
export const FORM_PDF_INSPECT_FIELD_LIMIT = 250;

/** Pages of text Omera reads for briefing and questions (first N). */
export const FORM_PDF_READ_PAGE_LIMIT = 80;

/** Characters sent to briefing/field models after extraction. */
export const FORM_PDF_TEXT_CHAR_BUDGET = 80_000;

/** Raster pages sent to vision when text is thin. */
export const FORM_VISION_MAX_PAGES = 10;

/** Title-length extracts still get a briefing instead of UNREADABLE_DOCUMENT. */
export const FORM_MIN_READABLE_CHARS = 20;

export const FORM_MAX_INFERRED_FIELDS = 50;
