"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { encodeMonoWav } from "@/lib/speech/wav";
import { resampleToMono16k, VOICE_SAMPLE_RATE } from "@/lib/speech/resample";

/** Recordings stop automatically after 60 seconds. */
export const VOICE_MAX_DURATION_MS = 60000;

export type VoiceClip = {
  wav: Uint8Array;
  /** Base64 of the WAV bytes for JSON transport. */
  base64: string;
  mimeType: "audio/wav" | "audio/webm";
  languageId: string;
};

function stopTracks(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch {
      // A track that is already stopped needs no further handling.
    }
  });
}

function wavToBase64(wav: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = "";
  for (let offset = 0; offset < wav.length; offset += CHUNK) {
    binary += String.fromCharCode(...wav.subarray(offset, offset + CHUNK));
  }
  return btoa(binary);
}

/**
 * @param languageId UI language at call time. Callers must pass the
 * selected language so a change mid-recording rejects the clip.
 * Defaults to "eng" only until callers are migrated.
 */
export function useVoiceRecorder(languageId: string = "eng") {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const failedRef = useRef(false);
  const languageRef = useRef(languageId);
  const startLanguageRef = useRef<string | null>(null);
  const pendingRef = useRef<{
    resolve: (clip: VoiceClip) => void;
    reject: (error: Error) => void;
  } | null>(null);

  useEffect(() => {
    languageRef.current = languageId;
  }, [languageId]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const finish = useCallback(async () => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    const stream = streamRef.current;
    streamRef.current = null;
    recorderRef.current = null;
    clearTimer();
    setRecording(false);

    const fail = (message: string) => {
      failedRef.current = false;
      stopTracks(stream);
      setError(message);
      pending?.reject(new Error(message));
    };

    if (failedRef.current) {
      fail("Voice recording failed.");
      return;
    }
    if (startLanguageRef.current !== languageRef.current) {
      fail("The language changed before transcription completed.");
      return;
    }
    try {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      if (bytes.length === 0) {
        fail("No audio was recorded.");
        return;
      }
      let clip: VoiceClip | null = null;
      if (typeof AudioContext !== "undefined") {
        const context = new AudioContext();
        try {
          const decoded = await context.decodeAudioData(bytes.buffer.slice(0));
          const channels = Array.from(
            { length: decoded.numberOfChannels },
            (_, index) => decoded.getChannelData(index),
          );
          const mono = await resampleToMono16k(channels, decoded.sampleRate);
          const wav = encodeMonoWav(mono, VOICE_SAMPLE_RATE);
          clip = {
            wav,
            base64: wavToBase64(wav),
            mimeType: "audio/wav",
            languageId: startLanguageRef.current ?? languageRef.current,
          };
        } catch {
          // Fall back to raw WebM for server-side Whisper (OpenRouter).
        } finally {
          await context.close().catch(() => undefined);
        }
      }
      if (!clip) {
        clip = {
          wav: bytes,
          base64: wavToBase64(bytes),
          mimeType: "audio/webm",
          languageId: startLanguageRef.current ?? languageRef.current,
        };
      }
      failedRef.current = false;
      stopTracks(stream);
      pending?.resolve(clip);
    } catch {
      fail("Voice recording failed.");
    }
  }, [clearTimer]);

  const start = useCallback(async () => {
    setError(null);
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError("Voice recording is not available in this browser.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone access is required for voice answers.");
      return;
    }
    failedRef.current = false;
    startLanguageRef.current = languageRef.current;
    chunksRef.current = [];
    streamRef.current = stream;
    const recorder = new MediaRecorder(stream);
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onerror = () => {
      failedRef.current = true;
      try {
        recorder.stop();
      } catch {
        // finish reports the failure.
      }
    };
    recorder.onstop = () => {
      void finish();
    };
    recorder.start();
    setRecording(true);
    timerRef.current = window.setTimeout(() => {
      try {
        recorder.stop();
      } catch {
        // finish reports the failure.
      }
    }, VOICE_MAX_DURATION_MS);
  }, [finish]);

  const stop = useCallback((): Promise<VoiceClip> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      return Promise.reject(new Error("Not recording"));
    }
    return new Promise<VoiceClip>((resolve, reject) => {
      pendingRef.current = { resolve, reject };
      recorder.stop();
    });
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const recorder = recorderRef.current;
      recorderRef.current = null;
      if (recorder && recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {
          // Tracks still stop below.
        }
      }
      stopTracks(streamRef.current);
      streamRef.current = null;
      pendingRef.current?.reject(new Error("Voice recording cancelled."));
      pendingRef.current = null;
    },
    [],
  );

  return { recording, error, start, stop };
}
