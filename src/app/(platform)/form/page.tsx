"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Download,
  FileUp,
  Loader2,
} from "lucide-react";
import { ChatComposer } from "@/components/chat-composer";
import { LanguageSelect } from "@/components/language-select";
import { useApp } from "@/context/app-provider";
import { activeQuestion } from "@/lib/forms/questions";
import { formErrorMessage, missingRequiredFields } from "@/lib/forms/form-errors";
import { cn } from "@/lib/cn";

type Step = "upload" | "questions" | "review" | "complete";

type ClientField = {
  id: string;
  label: string;
  prompt: string;
  required: boolean;
  kind?: "text" | "checkbox" | "choice" | "signature";
  options?: string[];
  value?: string | boolean;
};

type LocalSession = {
  sessionId: string;
  fileName: string;
  fields: ClientField[];
  currentIndex: number;
  languageId: string;
  revision: number;
  status: string;
};

const FORM_REF_KEY = "omera-form-ref";

function normalizeField(raw: unknown): ClientField | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.id !== "string" || !record.id) return null;
  const value = record.value;
  return {
    id: record.id,
    label: typeof record.label === "string" ? record.label : record.id,
    prompt:
      typeof record.prompt === "string"
        ? record.prompt
        : `Please provide a value for ${record.id}.`,
    required: record.required === true,
    kind:
      record.kind === "checkbox" ||
      record.kind === "choice" ||
      record.kind === "signature"
        ? record.kind
        : "text",
    options: Array.isArray(record.options)
      ? record.options.filter(
          (option): option is string => typeof option === "string",
        )
      : undefined,
    value:
      typeof value === "string" || typeof value === "boolean"
        ? value
        : undefined,
  };
}

function displayValue(field: ClientField): string {
  if (typeof field.value === "boolean") return field.value ? "Yes" : "No";
  return field.value ?? "—";
}

export default function FormFillPage() {
  const { languageId, setLanguageId } = useApp();
  const [step, setStep] = useState<Step>("upload");
  const [session, setSession] = useState<LocalSession | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [editingFromReview, setEditingFromReview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportNote, setExportNote] = useState<string | null>(null);

  // Restore through the server session ID after a refresh. Only the session
  // reference lives in local storage — never form answers. Identity is
  // rechecked before any recovered data is shown.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = localStorage.getItem(FORM_REF_KEY);
        if (!raw) return;
        let sessionId: string | null = null;
        try {
          sessionId = (JSON.parse(raw) as { sessionId?: unknown }).sessionId as string ?? null;
          if (typeof sessionId !== "string" || !sessionId) return;
        } catch {
          localStorage.removeItem(FORM_REF_KEY);
          return;
        }
        const identity = await fetch("/api/auth/session", {
          cache: "no-store",
        });
        if (!identity.ok || cancelled) {
          if (!cancelled && !identity.ok) {
            localStorage.removeItem(FORM_REF_KEY);
          }
          return;
        }
        const res = await fetch(`/api/forms/sessions/${sessionId}`, {
          cache: "no-store",
        });
        if (!res.ok || cancelled) {
          if (!cancelled && res.status === 404) {
            localStorage.removeItem(FORM_REF_KEY);
          }
          return;
        }
        const data = (await res.json()) as { session: Record<string, unknown> };
        const fields = Array.isArray(data.session.fields)
          ? (data.session.fields
              .map(normalizeField)
              .filter((field): field is ClientField => field !== null))
          : [];
        const currentIndex =
          typeof data.session.currentIndex === "number"
            ? data.session.currentIndex
            : 0;
        if (cancelled) return;
        setSession({
          sessionId: String(data.session.id),
          fileName: String(data.session.fileName ?? "form.pdf"),
          fields,
          currentIndex,
          languageId:
            typeof data.session.languageId === "string"
              ? data.session.languageId
              : languageId,
          revision:
            typeof data.session.revision === "number"
              ? data.session.revision
              : 1,
          status:
            typeof data.session.status === "string"
              ? data.session.status
              : "in_progress",
        });
        setStep(currentIndex >= fields.length ? "review" : "questions");
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = session
    ? activeQuestion({
        fields: session.fields,
        currentIndex: session.currentIndex,
        languageId: session.languageId,
      })
    : null;

  async function savePatch(
    answers: Record<string, string | boolean>,
    nextIndex: number,
  ): Promise<boolean> {
    if (!session) return false;
    const res = await fetch(`/api/forms/sessions/${session.sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answers,
        revision: session.revision,
        currentIndex: nextIndex,
      }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(
        `Save failed (${body.error ?? res.status}). Your answer was not recorded — try again.`,
      );
      return false;
    }
    const data = (await res.json()) as {
      session: Record<string, unknown>;
      revision: number;
    };
    const fields = Array.isArray(data.session.fields)
      ? (data.session.fields
          .map(normalizeField)
          .filter((field): field is ClientField => field !== null))
      : session.fields;
    setSession({
      ...session,
      fields,
      currentIndex:
        typeof data.session.currentIndex === "number"
          ? data.session.currentIndex
          : nextIndex,
      revision: data.revision,
      status:
        typeof data.session.status === "string"
          ? data.session.status
          : session.status,
    });
    return true;
  }

  async function uploadFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("languageId", languageId);
      const res = await fetch("/api/forms/analyze", {
        method: "POST",
        body,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(
          formErrorMessage(
            data.error,
            `Upload failed (${data.error ?? res.status}). Only fillable PDFs are supported.`,
          ),
        );
        return;
      }
      const data = (await res.json()) as {
        sessionId: string;
        fileName: string;
        fields: unknown[];
        revision: number;
        status: string;
      };
      const fields = data.fields
        .map(normalizeField)
        .filter((field): field is ClientField => field !== null);
      localStorage.setItem(
        FORM_REF_KEY,
        JSON.stringify({ sessionId: data.sessionId }),
      );
      setSession({
        sessionId: data.sessionId,
        fileName: data.fileName,
        fields,
        currentIndex: 0,
        languageId,
        revision: data.revision,
        status: data.status,
      });
      setStep(fields.length ? "questions" : "review");
    } finally {
      setUploading(false);
    }
  }

  async function submitAnswer(text: string) {
    if (!session || !current || saving) return;
    const field = current.field as ClientField;
    const value =
      field.kind === "checkbox"
        ? /^(yes|y|true|1)\b/i.test(text.trim())
        : text;
    setSaving(true);
    setError(null);
    try {
      const nextIndex = session.currentIndex + 1;
      const saved = await savePatch({ [field.id]: value }, nextIndex);
      if (!saved) return;
      if (editingFromReview) {
        setEditingFromReview(false);
        setStep("review");
        return;
      }
      setStep(nextIndex >= session.fields.length ? "review" : "questions");
    } finally {
      setSaving(false);
    }
  }

  async function submitChoice(value: string | boolean) {
    if (!session || !current || saving) return;
    setSaving(true);
    setError(null);
    try {
      const nextIndex = session.currentIndex + 1;
      const saved = await savePatch({ [current.field.id]: value }, nextIndex);
      if (!saved) return;
      if (editingFromReview) {
        setEditingFromReview(false);
        setStep("review");
        return;
      }
      setStep(nextIndex >= session.fields.length ? "review" : "questions");
    } finally {
      setSaving(false);
    }
  }

  async function skipCurrent() {
    if (!session || !current || saving) return;
    if (current.field.required) return;
    setSaving(true);
    setError(null);
    try {
      const nextIndex = session.currentIndex + 1;
      const saved = await savePatch({}, nextIndex);
      if (!saved) return;
      if (editingFromReview) {
        setEditingFromReview(false);
        setStep("review");
        return;
      }
      setStep(nextIndex >= session.fields.length ? "review" : "questions");
    } finally {
      setSaving(false);
    }
  }

  async function goBack() {
    if (!session || saving) return;
    setError(null);
    const nextIndex = Math.max(0, session.currentIndex - 1);
    setSaving(true);
    try {
      const saved = await savePatch({}, nextIndex);
      if (!saved) return;
      setStep("questions");
    } finally {
      setSaving(false);
    }
  }

  function editField(index: number) {
    if (!session) return;
    setError(null);
    setEditingFromReview(true);
    setSession({ ...session, currentIndex: index });
    setStep("questions");
  }

  async function exportPdf() {
    if (!session || exporting) return;
    const missing = missingRequiredFields(session.fields);
    if (missing.length) {
      setError(
        `Complete required fields first: ${missing.map((f) => f.label).join(", ")}.`,
      );
      return;
    }
    setExporting(true);
    setError(null);
    setExportNote(null);
    try {
      const res = await fetch(
        `/api/forms/sessions/${session.sessionId}/export`,
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(
          formErrorMessage(
            body.error,
            `Export failed (${body.error ?? res.status}). Fix answers and try again.`,
          ),
        );
        return;
      }
      const mode = res.headers.get("X-Form-Export-Mode");
      if (mode === "appendix") {
        setExportNote(
          "Your original PDF is included with a new “Completed answers” page at the end (this form had no fillable fields).",
        );
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = match?.[1] ?? `${session.fileName}-completed.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setStep("complete");
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
        <div>
          <h1 className="text-sm font-medium text-white">Form fill</h1>
          <p className="text-xs text-slate-500">
            Upload · AI asks in text · You answer by voice
          </p>
        </div>
        <LanguageSelect value={languageId} onChange={setLanguageId} />
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        {error && (
          <p
            role="alert"
            className="mx-auto mb-4 max-w-lg rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300"
          >
            {error}
          </p>
        )}

        {restoring && (
          <div className="mx-auto flex max-w-lg flex-col items-center pt-[8vh] text-center">
            <Loader2 className="size-6 animate-spin text-slate-400" />
            <p className="mt-3 text-sm text-slate-400">
              Restoring your session…
            </p>
          </div>
        )}

        {!restoring && step === "upload" && (
          <div className="mx-auto flex max-w-lg flex-col items-center pt-[8vh] text-center">
            <div className="flex w-full flex-col items-center rounded-2xl border border-dashed border-white/20 bg-white/5 px-6 py-12">
              <FileUp className="size-10 text-white/80" />
              <h2 className="mt-4 text-lg font-semibold text-white">
                Upload your form
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                PDF forms (fillable or text-based). Omera reads the fields and
                guides you — one question at a time. Max 4&nbsp;MB.
              </p>
              <label className="mt-6 cursor-pointer rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black hover:bg-white/90">
                {uploading ? "Analysing…" : "Choose file"}
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,application/pdf"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadFile(f);
                  }}
                />
              </label>
              {uploading && (
                <Loader2 className="mt-4 size-6 animate-spin text-slate-400" />
              )}
            </div>
          </div>
        )}

        {!restoring && (step === "questions" || step === "review" || step === "complete") && session && (
          <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-wider text-slate-500">
                Document
              </p>
              <p className="mt-1 truncate text-sm font-medium text-white">
                {session.fileName}
              </p>
              {step === "questions" && current && (
                <>
                  <p className="mt-6 text-xs text-white/50">
                    Field {current.index + 1} of {current.total}
                    {current.field.required ? (
                      <span className="ml-2 text-amber-400/90">Required</span>
                    ) : (
                      <span className="ml-2 text-white/35">Optional</span>
                    )}
                  </p>
                  <div className="mt-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 text-sm text-slate-100">
                    {current.field.prompt}
                  </div>
                  {(current.field as ClientField).kind === "checkbox" ? (
                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void submitChoice(true)}
                        className="flex-1 rounded-full bg-white py-2 text-sm font-medium text-black disabled:opacity-50"
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void submitChoice(false)}
                        className="flex-1 rounded-full border border-white/20 py-2 text-sm text-white disabled:opacity-50"
                      >
                        No
                      </button>
                    </div>
                  ) : (current.field as ClientField).kind === "choice" &&
                    (current.field as ClientField).options?.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {((current.field as ClientField).options ?? []).map(
                        (option) => (
                          <button
                            key={option}
                            type="button"
                            disabled={saving}
                            onClick={() => void submitChoice(option)}
                            className="rounded-full border border-white/20 px-4 py-1.5 text-sm text-white disabled:opacity-50"
                          >
                            {option}
                          </button>
                        ),
                      )}
                    </div>
                  ) : null}
                  <div className="mt-4 flex gap-2">
                    {session.currentIndex > 0 && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void goBack()}
                        className="rounded-full border border-white/20 px-4 py-1.5 text-sm text-white disabled:opacity-50"
                      >
                        Back
                      </button>
                    )}
                    {!current.field.required && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void skipCurrent()}
                        className="rounded-full border border-white/20 px-4 py-1.5 text-sm text-white disabled:opacity-50"
                      >
                        Skip
                      </button>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    Type or tap the microphone — one question per screen
                    (quiet for open offices).
                  </p>
                </>
              )}
              {(step === "review" || step === "complete") && (
                <div className="mt-6">
                  <h2 className="text-sm font-medium text-white">
                    {step === "complete"
                      ? "Your completed PDF has downloaded."
                      : "Review your answers"}
                  </h2>
                  {step === "review" && (
                    <p className="mt-1 text-xs text-slate-500">
                      Nothing is final until you download the completed PDF.
                    </p>
                  )}
                  {step === "complete" && (
                    <div className="mt-2 flex items-start gap-2 text-sm text-emerald-400">
                      <CheckCircle2 className="size-5 shrink-0" />
                      <p>
                        {exportNote ??
                          "Saved as a completed PDF — not a text summary."}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">
                Captured answers
              </p>
              <ul className="space-y-2">
                {session.fields.map((f, index) => (
                  <li
                    key={f.id}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-sm",
                      f.required &&
                        (f.value === undefined ||
                          f.value === "" ||
                          (f.kind === "checkbox" && f.value !== true))
                        ? "border-amber-500/40 bg-amber-500/5"
                        : f.value !== undefined && f.value !== ""
                          ? "border-emerald-500/30 bg-emerald-500/5"
                          : "border-white/8 bg-white/3 text-slate-500",
                    )}
                  >
                    <span className="text-xs text-slate-500">
                      {f.label}
                      {f.required ? (
                        <span className="ml-1 text-amber-400/80">*</span>
                      ) : null}
                    </span>
                    <p className="text-slate-100">{displayValue(f)}</p>
                    {(step === "review" || step === "complete") && (
                      <button
                        type="button"
                        aria-label={`Edit ${f.label}`}
                        onClick={() => editField(index)}
                        className="mt-1 text-xs text-indigo-300 underline"
                      >
                        Edit
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {(step === "review" || step === "complete") && (
                <button
                  type="button"
                  onClick={() => void exportPdf()}
                  disabled={exporting}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-white py-2.5 text-sm font-medium text-black disabled:opacity-50"
                >
                  <Download className="size-4" />
                  {exporting ? "Preparing PDF…" : "Download completed PDF"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {!restoring &&
        step === "questions" &&
        current &&
        ((current.field as ClientField).kind === "text" ||
          (current.field as ClientField).kind === "signature") && (
        <ChatComposer
          onSend={(text) => void submitAnswer(text)}
          placeholder="Type your answer or use the microphone…"
          showLanguage={false}
          disabled={saving}
        />
      )}
    </>
  );
}
