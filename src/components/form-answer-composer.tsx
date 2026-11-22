"use client";

import { useState } from "react";
import { ArrowUp, Mic, Square } from "lucide-react";
import { useApp } from "@/context/app-provider";
import { useBrowserDictation } from "@/hooks/use-browser-dictation";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { stageSpeechTranscript } from "@/lib/forms/speech-answer";
import { cn } from "@/lib/cn";

type Props = {
  onSend: (text: string) => void;
  onSpeechDraft: (transcript: string) => void;
  onEditSpeechDraft: (text: string) => void;
  onUseSpeech: () => void;
  speechDraft: string | null;
  disabled?: boolean;
  placeholder?: string;
};

export function FormAnswerComposer({
  onSend,
  onSpeechDraft,
  onEditSpeechDraft,
  onUseSpeech,
  speechDraft,
  disabled,
  placeholder = "Type your answer or use the microphone…",
}: Props) {
  const [text, setText] = useState("");
  const { languageId } = useApp();
  const dictation = useBrowserDictation(languageId);
  const { recording, error: recorderError, start, stop } = useVoiceRecorder(languageId);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [liveSpeech, setLiveSpeech] = useState("");
  const listening = dictation.listening || recording;
  const awaitingConfirm = speechDraft !== null && !listening && !transcribing;

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
      let merged = live.trim() || liveSpeech.trim();

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
                "Voice transcription failed. Try again or type your answer.",
              );
              return;
            }
          }
        }

        const staged = stageSpeechTranscript(merged);
        if (staged) {
          onSpeechDraft(staged);
        } else {
          setVoiceError("No speech detected. Try again or type your answer.");
        }
      } finally {
        setLiveSpeech("");
        setTranscribing(false);
      }
      return;
    }

    setVoiceError(null);
    setLiveSpeech("");
    const liveStarted = dictation.start("", (display) => {
      setLiveSpeech(display);
    });
    await start();
    if (!liveStarted && !recording) {
      setVoiceError("Voice input is not available in this browser.");
    }
  }

  function submitTyped() {
    const trimmed = text.trim();
    if (!trimmed || disabled || transcribing || listening) return;
    onSend(trimmed);
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
      {(listening || transcribing) && liveSpeech && (
        <p className="mb-2 text-center text-sm text-white">{liveSpeech}</p>
      )}
      {awaitingConfirm && (
        <div className="mb-3 rounded-2xl border border-amber-400/40 bg-amber-500/10 p-3">
          <p className="text-xs font-medium text-amber-100">
            Check what we heard. Nothing is saved until you tap Use this.
          </p>
          <textarea
            value={speechDraft ?? ""}
            onChange={(event) => onEditSpeechDraft(event.target.value)}
            rows={2}
            aria-label="Confirm transcript"
            disabled={disabled}
            className="mt-2 min-h-[44px] w-full resize-y rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white outline-none"
          />
          <button
            type="button"
            onClick={onUseSpeech}
            disabled={disabled || !speechDraft?.trim()}
            className="mt-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-40"
          >
            Use this
          </button>
        </div>
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
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submitTyped();
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
        <div className="flex items-center justify-end gap-1 px-1">
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
            onClick={submitTyped}
            disabled={disabled || transcribing || listening || !text.trim()}
            className="rounded-xl bg-white p-2.5 text-black transition hover:bg-white/90 disabled:opacity-40"
            aria-label="Send message"
          >
            <ArrowUp className="size-5" />
          </button>
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-slate-500">
        Spoken answers stay here until you tap Use this. Typed answers send
        when you tap the arrow.
      </p>
    </div>
  );
}
