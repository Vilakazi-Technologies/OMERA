export type SpeechDecision = "pending" | "use";

/** Normalise a transcript. This does not store an answer. */
export function stageSpeechTranscript(transcript: string): string | null {
  const text = transcript.replace(/\s+/g, " ").trim();
  return text || null;
}

/**
 * Speech is saved only when the user chooses "Use this".
 * Editing the draft keeps the decision pending, so a wrong transcript is not stored.
 */
export function confirmedSpeechAnswer(
  transcript: string | null,
  decision: SpeechDecision,
): string | null {
  if (decision !== "use") return null;
  return stageSpeechTranscript(transcript ?? "");
}
