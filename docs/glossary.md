# Glossary

| Term | Meaning |
|---|---|
| Omera | The VILATECH business adviser product. |
| VILATECH | The company that builds Omera. |
| Xavani | The inference service Omera calls. |
| Contract | The capability payload at `/v1/capabilities`, contract version 1. |
| `omera_mode` | The Xavani mode that disables tools, memory, and persistence. |
| Research mode | No model key. Answers are composed from live sources and cite them. |
| Keyless mode | Optional no-key model endpoint. Off by default. |
| Model mode | A model key exists. Replies come from the model. |
| Capability block | `service` object in the Xavani capabilities response. |
| Service key | Bearer secret that authenticates Omera to Xavani. |
| AcroForm | A PDF with fillable form fields. |
| RLS | Postgres row level security. |
| Revision | Form session version used to reject stale writes. |
| Quota | Per-user request budget enforced by `consumeQuota`. |
| Rate limit | Per-instance request brake for a single route. |
| BLOCKED | A gate that waits for a real external input. Never a silent pass. |
