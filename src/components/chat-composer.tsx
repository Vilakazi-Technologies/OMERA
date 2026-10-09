"use client";

import { useState } from "react";
import { ArrowUp, Mic, Square } from "lucide-react";
import { LanguageSelect } from "@/components/language-select";
import { useApp } from "@/context/app-provider";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { cn } from "@/lib/cn";

type Props = {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  showLanguage?: boolean;
};

export function ChatComposer({
  onSend,
  disabled,
  placeholder = "Message Omera…",
  showLanguage = true,
}: Props) {
  const [text, setText] = useState("");
  const { languageId, setLanguageId } = useApp();
  const { recording, error, start, stop } = useVoiceRecorder();

  async function handleMic() {
    if (recording) {
      const { base64, mimeType } = await stop();
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioBase64: base64,
          mimeType,
          languageId,
        }),
      });
      const data = await res.json();
      if (data.text) {
        setText((prev) => (prev ? `${prev} ${data.text}` : data.text));
      }
      return;
    }
    await start();
  }

  function submit() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-6 pt-2">
      {error && (
        <p className="mb-2 text-center text-xs text-red-400">{error}</p>
      )}
      <div
        className="liquid-card rounded-2xl p-2"
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder={placeholder}
          disabled={disabled}
          className="max-h-40 min-h-[44px] w-full resize-none bg-transparent px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
        />
        <div className="flex items-center justify-between gap-2 px-1">
          {showLanguage ? (
            <LanguageSelect
              value={languageId}
              onChange={setLanguageId}
              compact
            />
          ) : (
            <span />
          )}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleMic}
              disabled={disabled}
              className={cn(
                "rounded-xl p-2.5 transition",
                recording
                  ? "bg-red-500/20 text-red-400"
                  : "text-slate-300 hover:bg-white/8 hover:text-white",
              )}
              aria-label={recording ? "Stop recording" : "Record voice"}
            >
              {recording ? (
                <Square className="size-5 fill-current" />
              ) : (
                <Mic className="size-5" />
              )}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={disabled || !text.trim()}
              className="rounded-xl bg-white p-2.5 text-black transition hover:bg-white/90 disabled:opacity-40"
              aria-label="Send message"
            >
              <ArrowUp className="size-5" />
            </button>
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-slate-500">
        A product of VILATECH
      </p>
    </div>
  );
}
