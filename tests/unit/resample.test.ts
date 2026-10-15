import { afterEach, expect, it, vi } from "vitest";
import { resampleToMono16k, VOICE_SAMPLE_RATE } from "@/lib/speech/resample";

/** Minimal browser resampler: linear interpolation into the declared length. */
class FakeBuffer {
  readonly data: Float32Array;
  constructor(
    readonly length: number,
    readonly sampleRate: number,
  ) {
    this.data = new Float32Array(length);
  }
  copyToChannel(source: Float32Array, _channel: number): void {
    this.data.set(source.subarray(0, this.length));
  }
  getChannelData(_channel: number): Float32Array {
    return this.data;
  }
}

class FakeOfflineAudioContext {
  readonly destination = {};
  private source: { buffer: FakeBuffer } | null = null;
  constructor(
    readonly channels: number,
    readonly length: number,
    readonly sampleRate: number,
  ) {}
  createBuffer(_channels: number, length: number, sampleRate: number): FakeBuffer {
    return new FakeBuffer(length, sampleRate);
  }
  createBufferSource(): {
    buffer: FakeBuffer | null;
    connect: () => void;
    start: () => void;
  } {
    const context = this;
    const node = {
      buffer: null as FakeBuffer | null,
      connect(): void {},
      start(): void {
        context.source = node as unknown as { buffer: FakeBuffer };
      },
    };
    return node;
  }
  async startRendering(): Promise<FakeBuffer> {
    const input = this.source?.buffer;
    if (!input) throw new Error("No source buffer");
    const output = new FakeBuffer(this.length, this.sampleRate);
    for (let index = 0; index < this.length; index++) {
      const position = (index / this.length) * input.length;
      const lower = Math.floor(position);
      const upper = Math.min(lower + 1, input.length - 1);
      const fraction = position - lower;
      output.data[index] =
        input.data[lower] * (1 - fraction) + input.data[upper] * fraction;
    }
    return output;
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

it("output_length_matches_the_declared_sample_rate", async () => {
  vi.stubGlobal("OfflineAudioContext", FakeOfflineAudioContext);
  const sourceRate = 48000;
  const left = new Float32Array(sourceRate).fill(0.5);
  const output = await resampleToMono16k([left], sourceRate);
  expect(output).toBeInstanceOf(Float32Array);
  expect(output.length).toBe(VOICE_SAMPLE_RATE);
  expect(VOICE_SAMPLE_RATE).toBe(16000);
});

it("stereo_input_is_mixed_to_mono", async () => {
  vi.stubGlobal("OfflineAudioContext", FakeOfflineAudioContext);
  const sourceRate = 16000;
  const left = new Float32Array([0.2, 0.4, 0.6, 0.8]);
  const right = new Float32Array([0.8, 0.6, 0.4, 0.2]);
  const output = await resampleToMono16k([left, right], sourceRate);
  expect(Array.from(output)).toEqual([0.5, 0.5, 0.5, 0.5]);
});
