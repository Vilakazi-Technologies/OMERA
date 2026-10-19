"use client";

import { useRef, useState } from "react";
import { ArrowUp, Mic, Square } from "lucide-react";
import { ChatModelSelect } from "@/components/chat-model-select";
import { LanguageSelect } from "@/components/language-select";
import { useApp } from "@/context/app-provider";
import { useBrowserDictation } from "@/hooks/use-browser-dictation";
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
  const dictation = useBrowserDictation(languageId);
  const { recording, error: recorderError, start, stop } = useVoiceRecorder(languageId);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const prefixBeforeVoiceRef = useRef("");

  const listening = dictation.listening || recording;

  async function transcribeClip(clip: {
    base64: string;
    mimeType: string;
    languageId: string;
  }): Promise<string | null> {
    const res = await fetch("/api/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audioBase64: clip.base64,
        mimeType: clip.mimeType,
        languageId: clip.languageId,
      }),
    });
    const data = (await res.json()) as { text?: unknown; error?: string };
    if (!res.ok || typeof data.text !== "string" || !data.text.trim()) {
      return null;
    }
    return data.text.trim();
  }

  async function handleMic() {
    if (disabled || transcribing) return;

    if (listening) {
      setTranscribing(true);
      setVoiceError(null);
      const live = dictation.stop();
      let merged = live.trim();

      try {
        if (recording) {
          try {
            const clip = await stop();
            if (!merged) {
              const server = await transcribeClip(clip);
              if (server) merged = server;
            }
          } catch {
            if (!merged) {
              setVoiceError(
                "Voice transcription failed. Try again or type your message.",
              );
              return;
            }
          }
        }

        if (merged) {
          const prefix = prefixBeforeVoiceRef.current.trim();
          setText(prefix && !merged.startsWith(prefix) ? `${prefix} ${merged}` : merged);
        } else {
          setVoiceError(
            "No speech detected. Try again or type your message.",
          );
        }
      } finally {
        setTranscribing(false);
      }
      return;
    }

    setVoiceError(null);
    prefixBeforeVoiceRef.current = text;
    const liveStarted = dictation.start(text, (display) => {
      setText(display);
    });
    await start();
    if (!liveStarted && !recording) {
      setVoiceError("Voice input is not available in this browser.");
    }
  }

  function submit() {
    const trimmed = text.trim();
    if (!trimmed || disabled || transcribing || listening) return;
    onSend(trimmed, languageExplicit ? languageId : null);
    setText("");
  }

  const boxPlaceholder = listening
    ? "Listening… speak now"
    : transcribing
      ? "Transcribing…"
      : placeholder;

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
      {listening && !voiceError && (
        <p className="mb-2 text-center text-xs text-emerald-300/90">
          {dictation.supported
            ? "Speaking… words appear as you talk"
            : "Recording… release when finished"}
        </p>
      )}
      <div className="liquid-card rounded-2xl p-2">
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
          placeholder={boxPlaceholder}
          disabled={disabled || listening}
          aria-label="Message"
          className={cn(
            "max-h-60 min-h-[44px] w-full resize-y bg-transparent px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500",
            listening && "text-white",
          )}
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
              onClick={() => void handleMic()}
              disabled={disabled || transcribing}
              className={cn(
                "rounded-xl p-2.5 transition",
                listening
                  ? "bg-red-500/20 text-red-400"
                  : "text-slate-300 hover:bg-white/8 hover:text-white",
              )}
              aria-label={
                transcribing
                  ? "Transcribing voice"
                  : listening
                    ? "Stop recording"
                    : "Record voice"
              }
            >
              {listening ? (
                <Square className="size-5 fill-current" />
              ) : (
                <Mic className="size-5" />
              )}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={disabled || transcribing || listening || !text.trim()}
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
};
