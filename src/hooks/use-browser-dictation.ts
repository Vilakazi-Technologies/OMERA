"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { speechRecognitionLang } from "@/lib/speech/language-bcp47";

type RecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: {
    resultIndex: number;
    results: { length: number; [index: number]: { isFinal: boolean; 0?: { transcript?: string } } };
  }) => void) | null;
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

/** Live speech-to-text in the browser (words appear as you speak). */
export function useBrowserDictation(languageId: string) {
  const [listening, setListening] = useState(false);
  const supported = useMemo(() => getRecognitionCtor() !== null, []);
  const recognitionRef = useRef<RecognitionInstance | null>(null);
  const transcriptRef = useRef("");

  const stop = useCallback((): string => {
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (rec) {
      try {
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
      const rec = new Ctor();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = speechRecognitionLang(languageId);
      let committed = prefix.trim();
      if (committed) committed += " ";

      rec.onresult = (event) => {
        let interim = "";
        let session = committed;
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          const piece = result[0]?.transcript ?? "";
          if (result.isFinal) session += piece;
          else interim += piece;
        }
        const display = (session + interim).trim();
        transcriptRef.current = display;
        onUpdate(display);
      };
      rec.onerror = () => {
        // Keep partial transcript; server fallback may run on stop.
      };

      try {
        rec.start();
      } catch {
        return false;
      }
      recognitionRef.current = rec;
      transcriptRef.current = committed.trim();
      setListening(true);
      return true;
    },
    [languageId, stop],
  );

  return { supported, listening, start, stop };
};
