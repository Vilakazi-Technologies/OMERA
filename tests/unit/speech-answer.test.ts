import { expect, it } from "vitest";
import {
  confirmedSpeechAnswer,
  stageSpeechTranscript,
} from "@/lib/forms/speech-answer";

it("does not save a transcript until the user confirms it", () => {
  const heard = stageSpeechTranscript("  ayanda   vilakazi ");
  expect(heard).toBe("ayanda vilakazi");
  expect(confirmedSpeechAnswer(heard, "pending")).toBeNull();

  const edited = "Ayanda Vilakazi";
  expect(confirmedSpeechAnswer(edited, "pending")).toBeNull();
  expect(confirmedSpeechAnswer(edited, "use")).toBe("Ayanda Vilakazi");
  expect(confirmedSpeechAnswer("   ", "use")).toBeNull();
  expect(confirmedSpeechAnswer(null, "use")).toBeNull();
});
