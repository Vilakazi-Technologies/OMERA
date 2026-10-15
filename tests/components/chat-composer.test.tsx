// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const startMock = vi.fn();
const stopMock = vi.fn();

vi.mock("@/hooks/use-voice-recorder", () => ({
  useVoiceRecorder: () => ({
    recording: true,
    error: null,
    start: startMock,
    stop: stopMock,
  }),
}));

vi.mock("@/context/app-provider", () => ({
  useApp: () => ({
    languageId: "zul",
    setLanguageId: vi.fn(),
    languageExplicit: true,
  }),
}));

import { ChatComposer } from "@/components/chat-composer";

const CLIP = {
  wav: new Uint8Array([1, 2]),
  base64: "AQI=",
  mimeType: "audio/wav",
  languageId: "zul",
};

beforeEach(() => {
  startMock.mockReset();
  stopMock.mockReset();
  stopMock.mockResolvedValue(CLIP);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("transcription_errors_do_not_submit_text", async () => {
  const onSend = vi.fn();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ error: "VOICE_UNAVAILABLE" }), { status: 503 })),
  );
  render(<ChatComposer onSend={onSend} />);
  fireEvent.click(screen.getByRole("button", { name: "Stop recording" }));
  await screen.findByText(/transcription failed/i);
  expect(onSend).not.toHaveBeenCalled();
});

it("the_transcript_is_editable_before_submission", async () => {
  const onSend = vi.fn();
  let resolveFetch: ((response: Response) => void) | null = null;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    ),
  );
  render(<ChatComposer onSend={onSend} />);
  fireEvent.click(screen.getByRole("button", { name: "Stop recording" }));
  await screen.findByText(/transcribing/i);
  await resolveFetch!(
    new Response(JSON.stringify({ text: "Sawubona", languageId: "zul" }), { status: 200 }),
  );
  const box = await screen.findByDisplayValue("Sawubona");
  fireEvent.change(box, { target: { value: "Sawubona mngani" } });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  expect(onSend).toHaveBeenCalledWith("Sawubona mngani", "zul");
});
