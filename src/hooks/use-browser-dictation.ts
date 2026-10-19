"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { speechRecognitionLang } from "@/lib/speech/language-bcp47";

type RecognitionResult = {
  isFinal: boolean;
  0?: { transcript?: string };
};

type RecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: {
    resultIndex: number;
    results: { length: number; [index: number]: RecognitionResult };
  }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type RecognitionCtor = new () => RecognitionInstance;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const win = window as Window & {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

function joinDisplay(base: string, finals: string, interim: string): string {
  const parts = [base.trim(), finals.trim(), interim.trim()].filter(Boolean);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/** After a session ends, interim text is dropped unless we fold the last display into finals. */
function spokenFromDisplay(base: string, display: string): string {
  const b = base.trim();
  const full = display.trim();
  if (!full) return "";
  if (!b) return full;
  if (full === b) return "";
  if (full.startsWith(b)) {
    return full.slice(b.length).trim();
  }
  return full;
}

/** Live speech-to-text in the browser (words appear as you speak). */
export function useBrowserDictation(languageId: string) {
  const [listening, setListening] = useState(false);
  const supported = useMemo(() => getRecognitionCtor() !== null, []);
  const recognitionRef = useRef<RecognitionInstance | null>(null);
  const transcriptRef = useRef("");
  const basePrefixRef = useRef("");
  const finalsRef = useRef("");
  const activeRef = useRef(false);
  const onUpdateRef = useRef<(display: string) => void>(() => undefined);

  const attachHandlers = useCallback(
    (rec: RecognitionInstance) => {
      rec.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          const piece = result[0]?.transcript ?? "";
          if (result.isFinal && piece) {
            finalsRef.current += piece;
          }
        }
        let interim = "";
        for (let i = 0; i < event.results.length; i += 1) {
          const result = event.results[i];
          if (!result.isFinal) {
            interim += result[0]?.transcript ?? "";
          }
        }
        const display = joinDisplay(
          basePrefixRef.current,
          finalsRef.current,
          interim,
        );
        transcriptRef.current = display;
        onUpdateRef.current(display);
      };

      rec.onerror = () => {
        // Keep accumulated text; onend may restart the session.
      };

      rec.onend = () => {
        if (!activeRef.current || recognitionRef.current !== rec) return;
        const spoken = spokenFromDisplay(
          basePrefixRef.current,
          transcriptRef.current,
        );
        if (spoken) {
          finalsRef.current = spoken;
          const display = joinDisplay(basePrefixRef.current, spoken, "");
          transcriptRef.current = display;
          onUpdateRef.current(display);
        }
        try {
          rec.start();
        } catch {
          // Session already running or mic released.
        }
      };
    },
    [],
  );

  const stop = useCallback((): string => {
    activeRef.current = false;
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (rec) {
      try {
        rec.onend = null;
        rec.stop();
      } catch {
        try {
          rec.abort();
        } catch {
          // ignore
        }
      }
    }
    setListening(false);
    return transcriptRef.current;
  }, []);

  const start = useCallback(
    (prefix: string, onUpdate: (display: string) => void): boolean => {
      const Ctor = getRecognitionCtor();
      if (!Ctor) return false;
      stop();

      basePrefixRef.current = prefix.trim();
      finalsRef.current = "";
      onUpdateRef.current = onUpdate;
      transcriptRef.current = basePrefixRef.current;

      const rec = new Ctor();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = speechRecognitionLang(languageId);
      attachHandlers(rec);

      try {
        rec.start();
      } catch {
        return false;
      }

      activeRef.current = true;
      recognitionRef.current = rec;
      setListening(true);
      onUpdate(transcriptRef.current);
      return true;
    },
    [attachHandlers, languageId, stop],
  );

  return { supported, listening, start, stop };
};
