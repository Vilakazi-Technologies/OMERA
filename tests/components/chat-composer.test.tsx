// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const voiceFixture = vi.hoisted(() => ({
  recording: true,
  startMock: vi.fn(),
  stopMock: vi.fn(),
  dictationStopMock: vi.fn(() => ""),
}));

vi.mock("@/hooks/use-browser-dictation", () => ({
  useBrowserDictation: () => ({
    supported: false,
    listening: false,
    start: vi.fn(() => false),
    stop: voiceFixture.dictationStopMock,
  }),
}));

vi.mock("@/hooks/use-voice-recorder", () => ({
  useVoiceRecorder: () => ({
    recording: voiceFixture.recording,
    error: null,
    start: voiceFixture.startMock,
    stop: async () => {
      voiceFixture.recording = false;
      return voiceFixture.stopMock();
    },
  }),
}));

vi.mock("@/context/app-provider", () => ({
  useApp: vi.fn(),
}));

import { ChatComposer } from "@/components/chat-composer";
import { useApp } from "@/context/app-provider";
import { authAppValue, resetAuthFixture } from "../fixtures/authenticated-app";

const CLIP = {
  wav: new Uint8Array([1, 2]),
  base64: "AQI=",
  mimeType: "audio/wav",
  languageId: "zul",
};

beforeEach(() => {
  resetAuthFixture({ languageId: "zul", languageExplicit: true });
  vi.mocked(useApp).mockImplementation(() => authAppValue() as never);
  voiceFixture.recording = true;
  voiceFixture.startMock.mockReset();
  voiceFixture.stopMock.mockReset();
  voiceFixture.stopMock.mockResolvedValue(CLIP);
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
  await screen.findByText(/voice transcription failed|no speech detected/i);
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
  await screen.findByPlaceholderText(/transcribing/i);
  await resolveFetch!(
    new Response(JSON.stringify({ text: "Sawubona", languageId: "zul" }), { status: 200 }),
  );
  const box = await screen.findByDisplayValue("Sawubona");
  fireEvent.change(box, { target: { value: "Sawubona mngani" } });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  expect(onSend).toHaveBeenCalledWith("Sawubona mngani", "zul");
});
