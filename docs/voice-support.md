# Voice support matrix

Typed input is available for all eleven product languages. Voice input
is available only where a documented voice route exists. Languages
without a voice route keep full typed input and are never rerouted to
another language for transcription.

| Language | Typed input | Voice route | Status | Promotion gate |
| --- | --- | --- | --- | --- |
| English (eng) | Yes | Yes | Supported | Production route |
| isiZulu (zul) | Yes | Yes | Supported | Production route |
| Afrikaans (afr) | Yes | Yes | Beta | Measured quality review |
| Sesotho (sot) | Yes | Yes | Beta | Measured quality review |
| isiXhosa (xho) | Yes | No | Unavailable | Documented route plus measured quality review |
| Sepedi (nso) | Yes | No | Unavailable | Documented route plus measured quality review |
| Setswana (tsn) | Yes | No | Unavailable | Documented route plus measured quality review |
| siSwati (ssw) | Yes | No | Unavailable | Documented route plus measured quality review |
| Tshivenda (ven) | Yes | No | Unavailable | Documented route plus measured quality review |
| Xitsonga (tso) | Yes | No | Unavailable | Documented route plus measured quality review |
| isiNdebele (nbl) | Yes | No | Unavailable | Documented route plus measured quality review |

## Rules

- The capability endpoint (`GET /api/capabilities`) is the runtime
  source of this matrix and uses product labels only.
- Measured speech quality is unrecorded for every language until
  consented product recordings are evaluated.
- A beta route is promoted to supported only after its measured
  quality review passes.
- A language without a voice route returns `UNSUPPORTED_LANGUAGE`
  from transcription; the request is never transcribed as another
  language.
- The chat composer shows "Voice unavailable" (or "Voice beta")
  beside the selected language and keeps the transcript editable
  before submission. Failed transcriptions never submit text.
