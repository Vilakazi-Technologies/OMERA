"use client";

import { useCallback, useState } from "react";
import {
  CheckCircle2,
  Download,
  FileUp,
  Loader2,
} from "lucide-react";
import { ChatComposer } from "@/components/chat-composer";
import { LanguageSelect } from "@/components/language-select";
import { useApp } from "@/context/app-provider";
import { extractFieldFromSpeech } from "@/lib/form-demo";
import { persistFormSession } from "@/lib/omera-sync";
import type { FormField } from "@/lib/types";
import { cn } from "@/lib/cn";

type Step = "upload" | "questions" | "complete";

export default function FormFillPage() {
  const { languageId, setLanguageId, formSession, setFormSession } = useApp();
  const [step, setStep] = useState<Step>(formSession ? "questions" : "upload");
  const [uploading, setUploading] = useState(false);
  const [assistantLine, setAssistantLine] = useState<string | null>(null);

  const currentField: FormField | undefined =
    formSession?.fields[formSession.currentIndex];

  const uploadFile = useCallback(
    async (file: File) => {
      setUploading(true);
      const body = new FormData();
      body.append("file", file);
      body.append("languageId", languageId);
      const res = await fetch("/api/forms/analyze", {
        method: "POST",
        body,
      });
      const data = await res.json();
      setFormSession({
        id: data.sessionId ?? crypto.randomUUID(),
        remoteId: data.sessionId,
        fileName: data.fileName,
        fields: data.fields,
        currentIndex: 0,
        languageId,
      });
      setAssistantLine(data.fields[0]?.prompt ?? data.message);
      setStep("questions");
      setUploading(false);
    },
    [languageId, setFormSession],
  );

  function applyAnswer(text: string) {
    if (!formSession || !currentField) return;

    const value = extractFieldFromSpeech(currentField, text);
    const fields = formSession.fields.map((f, i) =>
      i === formSession.currentIndex ? { ...f, value } : f,
    );

    const nextIndex = formSession.currentIndex + 1;
    if (nextIndex >= fields.length) {
      const done = { ...formSession, fields, currentIndex: nextIndex };
      setFormSession(done);
      if (formSession.remoteId) {
        void persistFormSession(formSession.remoteId, {
          fields,
          currentIndex: nextIndex,
          status: "completed",
        });
      }
      setAssistantLine(
        "You're done. Review your answers below, then download the summary.",
      );
      setStep("complete");
      return;
    }

    const updated = {
      ...formSession,
      fields,
      currentIndex: nextIndex,
    };
    setFormSession(updated);
    if (formSession.remoteId) {
      void persistFormSession(formSession.remoteId, {
        fields,
        currentIndex: nextIndex,
        status: "in_progress",
      });
    }
    setAssistantLine(fields[nextIndex].prompt);
  }

  function downloadSummary() {
    if (!formSession) return;
    const lines = formSession.fields.map(
      (f) => `${f.label}: ${f.value ?? "—"}`,
    );
    const blob = new Blob(
      [
        `Omera by VILATECH — Form summary\nFile: ${formSession.fileName}\n\n${lines.join("\n")}\n`,
      ],
      { type: "text/plain" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "omera-form-summary.txt";
    a.click();
    URL.revokeObjectURL(url);
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
        {step === "upload" && (
          <div className="mx-auto flex max-w-lg flex-col items-center pt-[8vh] text-center">
            <div
              className="flex w-full flex-col items-center rounded-2xl border border-dashed border-white/20 bg-white/5 px-6 py-12"
            >
              <FileUp className="size-10 text-white/80" />
              <h2 className="mt-4 text-lg font-semibold text-white">
                Upload your form
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                PDF, Word, or a photo. Omera reads the fields and guides
                you — question by question.
              </p>
              <label className="mt-6 cursor-pointer rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black hover:bg-white/90">
                {uploading ? "Analysing…" : "Choose file"}
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadFile(f);
                  }}
                />
              </label>
              {uploading && (
                <Loader2 className="mt-4 size-6 animate-spin text-slate-400" />
              )}
            </div>
          </div>
        )}

        {(step === "questions" || step === "complete") && formSession && (
          <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-wider text-slate-500">
                Document
              </p>
              <p className="mt-1 truncate text-sm font-medium text-white">
                {formSession.fileName}
              </p>
              {step === "questions" && currentField && (
                <>
                  <p className="mt-6 text-xs text-white/50">
                    Field {formSession.currentIndex + 1} of{" "}
                    {formSession.fields.length}
                  </p>
                  <div className="mt-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 text-sm text-slate-100">
                    {assistantLine ?? currentField.prompt}
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    Type or tap the microphone — questions stay on screen (quiet
                    for open offices).
                  </p>
                </>
              )}
              {step === "complete" && (
                <div className="mt-6 flex items-start gap-2 text-sm text-emerald-400">
                  <CheckCircle2 className="size-5 shrink-0" />
                  <p>{assistantLine}</p>
                </div>
              )}
            </div>

            <div>
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">
                Captured answers
              </p>
              <ul className="space-y-2">
                {formSession.fields.map((f) => (
                  <li
                    key={f.id}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-sm",
                      f.value
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : "border-white/8 bg-white/3 text-slate-500",
                    )}
                  >
                    <span className="text-xs text-slate-500">{f.label}</span>
                    <p className="text-slate-100">{f.value ?? "—"}</p>
                  </li>
                ))}
              </ul>
              {step === "complete" && (
                <button
                  type="button"
                  onClick={downloadSummary}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-white py-2.5 text-sm font-medium text-black"
                >
                  <Download className="size-4" />
                  Download summary
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {step === "questions" && currentField && (
        <ChatComposer
          onSend={applyAnswer}
          placeholder="Type your answer or use the microphone…"
          showLanguage={false}
        />
      )}
    </>
  );
}
