// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("@/context/app-provider", () => ({
  useApp: () => ({
    languageId: "eng",
    setLanguageId: vi.fn(),
    languageExplicit: true,
  }),
}));

import { FormAnswerComposer } from "@/components/form-answer-composer";
import { confirmedSpeechAnswer } from "@/lib/forms/speech-answer";

function Harness({ initial }: { initial: string }) {
  const [draft, setDraft] = useState(initial);
  const [saved, setSaved] = useState("");
  return (
    <>
      <FormAnswerComposer
        speechDraft={draft}
        onSpeechDraft={setDraft}
        onEditSpeechDraft={setDraft}
        onUseSpeech={() => {
          const answer = confirmedSpeechAnswer(draft, "use");
          if (!answer) return;
          setSaved(answer);
        }}
        onSend={(text) => setSaved(`typed:${text}`)}
      />
      <p data-testid="saved">{saved}</p>
    </>
  );
}

beforeEach(() => {
  vi.stubGlobal("MediaRecorder", undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("keeps a transcript unsaved until Use this, and saves the edited words", () => {
  render(<Harness initial="ayanda vilakazi" />);
  expect(screen.getByTestId("saved")).toHaveTextContent("");
  expect(screen.getByRole("button", { name: "Use this" })).toBeEnabled();

  fireEvent.change(screen.getByRole("textbox", { name: "Confirm transcript" }), {
    target: { value: "Ayanda Vilakazi" },
  });
  expect(screen.getByTestId("saved")).toHaveTextContent("");

  fireEvent.click(screen.getByRole("button", { name: "Use this" }));
  expect(screen.getByTestId("saved")).toHaveTextContent("Ayanda Vilakazi");
});
