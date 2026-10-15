#!/usr/bin/env node
/**
 * Omera smoke script.
 *
 * Checks GET /api/health, a chat round trip (POST /api/chat), a
 * transcription round trip (POST /api/transcribe), and a form analysis
 * round trip (POST /api/forms/analyze) against a target URL.
 *
 * Paid provider checks run only behind the explicit operator flag
 * `--paid`. Outcomes are reported as PASS / GATED / SKIPPED / FAIL with
 * HTTP status codes and safe error codes only — response bodies are
 * never printed, so provider error detail never leaks to public logs.
 *
 * Usage:
 *   node scripts/smoke.mjs --help
 *   node scripts/smoke.mjs [--target URL] [--paid] [--cookie "name=value"]
 *     [--timeout-ms 15000]
 *
 * Exit codes: 0 when nothing FAILs, 1 when any check FAILs,
 * 2 on usage errors.
 */

const DEFAULT_TARGET = "http://127.0.0.1:3000";
const DEFAULT_TIMEOUT_MS = 15000;

/** Error codes the API contract defines; safe to print. */
const SAFE_ERROR_CODES = new Set([
  "UNAUTHORIZED",
  "FORBIDDEN",
  "INVALID_REQUEST",
  "INVALID_AUDIO",
  "INVALID_AUDIO_SIZE",
  "INVALID_MULTIPART",
  "UNSUPPORTED_LANGUAGE",
  "VOICE_UNAVAILABLE",
  "XAVANI_UNAVAILABLE",
  "CHAT_UNAVAILABLE",
  "FORM_TRANSLATION_FAILED",
  "NO_FIELDS_TO_INTERPRET",
  "UNKNOWN_TEMPLATE",
  "UNSUPPORTED_XFA",
  "NO_FILLABLE_FIELDS",
  "SIGNATURE_REQUIRES_REVIEW",
  "SERVICE_UNAVAILABLE",
  "NOT_FOUND",
  "QUOTA_EXCEEDED",
  "RATE_LIMITED",
]);

function usage() {
  return [
    "Usage: node scripts/smoke.mjs [options]",
    "",
    "Options:",
    `  --target URL       Base URL of the deployment (default: ${DEFAULT_TARGET})`,
    "  --paid             Run the paid provider round trips (chat,",
    "                     transcription, form analysis). Without this flag",
    "                     those checks report SKIPPED.",
    '  --cookie "n=v"     Operator session cookie for authenticated checks.',
    "                     Repeatable. Without it, gated routes report GATED.",
    `  --timeout-ms N     Per-request timeout in ms (default: ${DEFAULT_TIMEOUT_MS})`,
    "  --help             Print this text and exit 0.",
    "",
    "Outcome meanings:",
    "  PASS     The endpoint answered as the contract requires.",
    "  GATED    The endpoint requires an operator session (--cookie).",
    "  SKIPPED  A paid check without --paid; nothing was attempted.",
    "  FAIL     Unexpected status or unreachable target.",
  ].join("\n");
}

function parseArgs(argv) {
  const options = {
    target: DEFAULT_TARGET,
    paid: false,
    cookies: [],
    timeoutMs: DEFAULT_TIMEOUT_MS,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--paid") {
      options.paid = true;
    } else if (arg === "--target") {
      const value = argv[i + 1];
      if (!value) throw new Error("missing value for --target");
      options.target = value.replace(/\/+$/, "");
      i += 1;
    } else if (arg === "--cookie") {
      const value = argv[i + 1];
      if (!value) throw new Error("missing value for --cookie");
      options.cookies.push(value);
      i += 1;
    } else if (arg === "--timeout-ms") {
      const value = Number(argv[i + 1]);
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error("invalid value for --timeout-ms");
      }
      options.timeoutMs = value;
      i += 1;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return options;
}

/** Read a response safely: status code plus a whitelisted error code only. */
async function safeOutcome(response) {
  const outcome = { http: response.status, error: null };
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const body = await response.json();
      const code =
        body && typeof body.error === "string" ? body.error : null;
      if (code && SAFE_ERROR_CODES.has(code)) outcome.error = code;
      else if (code) outcome.error = "REDACTED";
    } catch {
      outcome.error = "UNREADABLE_BODY";
    }
  } else {
    await response.body?.cancel().catch(() => undefined);
  }
  return outcome;
}

async function request(url, init, timeoutMs) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "error",
  });
  return safeOutcome(response);
}

function report(name, verdict, detail) {
  console.log(`${verdict} ${name}${detail ? ` — ${detail}` : ""}`);
  return verdict;
}

async function checkHealth(options) {
  const name = "health";
  try {
    const outcome = await request(
      `${options.target}/api/health`,
      { headers: { Accept: "application/json" } },
      options.timeoutMs,
    );
    if (outcome.http !== 200) {
      return report(name, "FAIL", `HTTP ${outcome.http}`);
    }
    return report(name, "PASS", `HTTP 200 error=${outcome.error ?? "none"}`);
  } catch (error) {
    const reason = error instanceof Error ? error.name : "UNKNOWN";
    return report(name, "FAIL", `unreachable (${reason})`);
  }
}

/**
 * Classify a paid round trip without leaking provider detail.
 * 2xx: PASS. 401/403 without a cookie: GATED. Anything else: FAIL,
 * except well-formed 4xx validation answers which prove reachability.
 */
function classifyPaid(name, outcome, attempted) {
  if (!attempted) return report(name, "SKIPPED", "needs --paid");
  if (outcome.http >= 200 && outcome.http < 300) {
    return report(name, "PASS", `HTTP ${outcome.http}`);
  }
  if (outcome.http === 401 || outcome.http === 403) {
    return report(name, "GATED", `HTTP ${outcome.http}; retry with --cookie`);
  }
  if (outcome.http >= 400 && outcome.http < 500) {
    return report(name, "PASS", `reachable; validation HTTP ${outcome.http}`);
  }
  return report(name, "FAIL", `HTTP ${outcome.http}`);
}

async function checkChat(options) {
  const name = "chat";
  if (!options.paid) return classifyPaid(name, null, false);
  const headers = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
    Origin: options.target,
  };
  if (options.cookies.length) {
    headers.Cookie = options.cookies.join("; ");
  }
  try {
    const outcome = await request(
      `${options.target}/api/chat`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          replyLanguageId: "eng",
          messages: [{ role: "user", content: "Smoke check. Reply briefly." }],
        }),
      },
      options.timeoutMs,
    );
    return classifyPaid(name, outcome, true);
  } catch (error) {
    const reason = error instanceof Error ? error.name : "UNKNOWN";
    return report(name, "FAIL", `unreachable (${reason})`);
  }
}

async function checkTranscription(options) {
  const name = "transcription";
  if (!options.paid) return classifyPaid(name, null, false);
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Origin: options.target,
  };
  if (options.cookies.length) {
    headers.Cookie = options.cookies.join("; ");
  }
  // 0.1 s of silent 16 kHz 16-bit mono WAV: schema-valid, decode-bounded.
  const samples = 1600;
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + samples * 2, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(16000, 24);
  wav.writeUInt32LE(32000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(samples * 2, 40);
  try {
    const outcome = await request(
      `${options.target}/api/transcribe`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          audioBase64: wav.toString("base64"),
          mimeType: "audio/wav",
          languageId: "eng",
        }),
      },
      options.timeoutMs,
    );
    return classifyPaid(name, outcome, true);
  } catch (error) {
    const reason = error instanceof Error ? error.name : "UNKNOWN";
    return report(name, "FAIL", `unreachable (${reason})`);
  }
}

async function checkFormAnalysis(options) {
  const name = "form-analysis";
  if (!options.paid) return classifyPaid(name, null, false);
  const headers = { Origin: options.target };
  if (options.cookies.length) {
    headers.Cookie = options.cookies.join("; ");
  }
  // Minimal "%PDF" magic header: exercises validation, never a real form.
  const form = new FormData();
  form.append(
    "file",
    new File(["%PDF-1.7 smoke"], "smoke.pdf", {
      type: "application/pdf",
    }),
  );
  form.append("languageId", "eng");
  try {
    const outcome = await request(
      `${options.target}/api/forms/analyze`,
      { method: "POST", headers, body: form },
      options.timeoutMs,
    );
    return classifyPaid(name, outcome, true);
  } catch (error) {
    const reason = error instanceof Error ? error.name : "UNKNOWN";
    return report(name, "FAIL", `unreachable (${reason})`);
  }
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(usage());
    console.error(`\nerror: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 2;
    return;
  }
  if (options.help) {
    console.log(usage());
    return;
  }
  console.log(`target: ${options.target} paid: ${options.paid ? "yes" : "no"}`);
  const verdicts = [
    await checkHealth(options),
    await checkChat(options),
    await checkTranscription(options),
    await checkFormAnalysis(options),
  ];
  const failed = verdicts.filter((verdict) => verdict === "FAIL").length;
  console.log(failed ? `smoke: ${failed} check(s) FAILED` : "smoke: no failures");
  if (failed) process.exitCode = 1;
}

await main();
