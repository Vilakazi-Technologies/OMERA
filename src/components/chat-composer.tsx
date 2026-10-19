"use client";

import { useState } from "react";
import { ArrowUp, Mic, Square } from "lucide-react";
import { ChatModelSelect } from "@/components/chat-model-select";
import { LanguageSelect } from "@/components/language-select";
import { useApp } from "@/context/app-provider";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { cn } from "@/lib/cn";

type Props = {
  onSend: (text: string, replyLanguageId: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
  showLanguage?: boolean;
  chatModelId?: string;
  onChatModelChange?: (modelId: string) => void;
};

export function ChatComposer({
  onSend,
  disabled,
  placeholder = "Message Omera…",
  showLanguage = true,
  chatModelId,
  onChatModelChange,
}: Props) {
  const [text, setText] = useState("");
  const { languageId, setLanguageId, languageExplicit } = useApp();
  const { recording, error: recorderError, start, stop } = useVoiceRecorder(languageId);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  async function handleMic() {
    if (disabled || transcribing) return;
    if (recording) {
      setTranscribing(true);
      setVoiceError(null);
      try {
        const clip = await stop();
        const res = await fetch("/api/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audioBase64: clip.base64,
            mimeType: clip.mimeType,
            languageId: clip.languageId,
          }),
        });
        const data = (await res.json()) as { text?: unknown };
        const transcript = data.text;
        if (!res.ok || typeof transcript !== "string" || !transcript.trim()) {
          setVoiceError(
            "Voice transcription failed. Your text was kept — try again or type instead.",
          );
          return;
        }
        setText((prev) => (prev ? `${prev} ${transcript}` : transcript));
      } catch {
        setVoiceError(
          "Voice transcription failed. Your text was kept — try again or type instead.",
        );
      } finally {
        setTranscribing(false);
      }
      return;
    }
    setVoiceError(null);
    await start();
  }

  function submit() {
    const trimmed = text.trim();
    if (!trimmed || disabled || transcribing) return;
    onSend(trimmed, languageExplicit ? languageId : null);
    setText("");
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-6 pt-2">
      {recorderError && (
        <p className="mb-2 text-center text-xs text-red-400">{recorderError}</p>
      )}
      {voiceError && (
        <p role="alert" className="mb-2 text-center text-xs text-red-400">
          {voiceError}
        </p>
      )}
      {transcribing && (
        <p className="mb-2 text-center text-xs text-slate-300">
          Transcribing…
        </p>
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
          aria-label="Message"
          className="max-h-40 min-h-[44px] w-full resize-none bg-transparent px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
        />
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            {chatModelId && onChatModelChange ? (
              <ChatModelSelect
                variant="compact"
                value={chatModelId}
                onChange={onChatModelChange}
              />
            ) : null}
            {showLanguage ? (
              <LanguageSelect
                value={languageId}
                onChange={setLanguageId}
                compact
              />
            ) : null}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleMic}
              disabled={disabled || transcribing}
              className={cn(
                "rounded-xl p-2.5 transition",
                recording
                  ? "bg-red-500/20 text-red-400"
                  : "text-slate-300 hover:bg-white/8 hover:text-white",
              )}
              aria-label={
                transcribing
                  ? "Transcribing voice"
                  : recording
                    ? "Stop recording"
                    : "Record voice"
              }
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
              disabled={disabled || transcribing || !text.trim()}
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
