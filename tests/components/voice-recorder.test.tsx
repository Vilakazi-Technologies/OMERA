// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

vi.mock("@/lib/speech/resample", () => ({
  VOICE_SAMPLE_RATE: 16000,
  resampleToMono16k: vi.fn(
    async (channels: Float32Array[]) => channels[0].slice(),
  ),
}));

import {
  useVoiceRecorder,
  VOICE_MAX_DURATION_MS,
  type VoiceClip,
} from "@/hooks/use-voice-recorder";

class FakeRecorder {
  static instances: FakeRecorder[] = [];
  state: "inactive" | "recording" = "inactive";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public stream: MediaStream) {
    FakeRecorder.instances.push(this);
  }
  start(): void {
    this.state = "recording";
  }
  stop(): void {
    if (this.state === "inactive") return;
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob([new Uint8Array([9, 9])]) });
    this.onstop?.();
  }
  fail(): void {
    this.onerror?.();
  }
}

function fakeStream() {
  const stops = [vi.fn(), vi.fn()];
  const stream = {
    getTracks: () => stops.map((stop) => ({ stop })),
  } as unknown as MediaStream;
  return { stream, stops };
}

function decodedAudio(channels = 2) {
  return {
    numberOfChannels: channels,
    sampleRate: 48000,
    getChannelData: (index: number) =>
      new Float32Array([0.2 + index * 0.1, 0.4 + index * 0.1]),
  };
}

let current: { stream: MediaStream; stops: ReturnType<typeof vi.fn>[] };
let decodeAudioData: ReturnType<typeof vi.fn>;
let closeAudio: ReturnType<typeof vi.fn>;

beforeEach(() => {
  if (typeof Blob.prototype.arrayBuffer !== "function") {
    Blob.prototype.arrayBuffer = function arrayBufferPolyfill() {
      return new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(this);
      });
    };
  }
  FakeRecorder.instances = [];
  current = fakeStream();
  decodeAudioData = vi.fn(async () => decodedAudio());
  closeAudio = vi.fn(async () => undefined);
  Object.defineProperty(window.navigator, "mediaDevices", {
    value: { getUserMedia: vi.fn(async () => current.stream) },
    configurable: true,
  });
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  vi.stubGlobal(
    "AudioContext",
    vi.fn(function () {
      return {
        decodeAudioData,
        close: closeAudio,
      };
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  Reflect.deleteProperty(window.navigator, "mediaDevices");
});

async function startRecording(languageId = "zul") {
  const hook = renderHook(({ lang }: { lang: string }) => useVoiceRecorder(lang), {
    initialProps: { lang: languageId },
  });
  await act(async () => {
    await hook.result.current.start();
  });
  expect(hook.result.current.recording).toBe(true);
  return hook;
}

it("every_exit_path_stops_its_tracks", async () => {
  // stop path
  const first = await startRecording();
  let clip: VoiceClip | undefined;
  await act(async () => {
    clip = await first.result.current.stop();
  });
  expect(clip?.languageId).toBe("zul");
  expect(["audio/wav", "audio/webm"]).toContain(clip?.mimeType);
  expect(clip?.wav).toBeInstanceOf(Uint8Array);
  expect(typeof clip?.base64).toBe("string");
  expect(current.stops[0]).toHaveBeenCalled();
  expect(current.stops[1]).toHaveBeenCalled();
  first.unmount();

  // failure path: undecodable audio
  current = fakeStream();
  Object.defineProperty(window.navigator, "mediaDevices", {
    value: { getUserMedia: vi.fn(async () => current.stream) },
    configurable: true,
  });
  decodeAudioData.mockRejectedValueOnce(new Error("decode failed"));
  const second = await startRecording();
  let fallbackClip: VoiceClip | undefined;
  await act(async () => {
    fallbackClip = await second.result.current.stop();
  });
  expect(fallbackClip?.mimeType).toBe("audio/webm");
  expect(second.result.current.error).toBeNull();
  expect(current.stops[0]).toHaveBeenCalled();
  expect(current.stops[1]).toHaveBeenCalled();
  second.unmount();

  // unmount path
  current = fakeStream();
  Object.defineProperty(window.navigator, "mediaDevices", {
    value: { getUserMedia: vi.fn(async () => current.stream) },
    configurable: true,
  });
  const third = await startRecording();
  await act(async () => {
    third.unmount();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});

it("a_language_change_before_completion_is_rejected", async () => {
  const hook = await startRecording("zul");
  hook.rerender({ lang: "eng" });
  await act(async () => {
    await expect(hook.result.current.stop()).rejects.toThrow(/language/i);
  });
  expect(current.stops[0]).toHaveBeenCalled();
  hook.unmount();
});

it("the_recording_is_bounded_to_60_seconds", async () => {
  expect(VOICE_MAX_DURATION_MS).toBe(60000);
  vi.useFakeTimers();
  const hook = await startRecording();
  expect(FakeRecorder.instances).toHaveLength(1);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60000);
    await Promise.resolve();
  });
  expect(FakeRecorder.instances[0].state).toBe("inactive");
  expect(hook.result.current.recording).toBe(false);
  hook.unmount();
});
