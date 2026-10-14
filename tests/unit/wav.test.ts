import { expect, it } from "vitest";
import { encodeMonoWav } from "@/lib/speech/wav";

it("encodes mono PCM with an exact WAV header", () => {
  const bytes = encodeMonoWav(new Float32Array([-1, 0, 1]), 16000);
  const view = new DataView(bytes.buffer);
  expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("RIFF");
  expect(new TextDecoder().decode(bytes.slice(8, 12))).toBe("WAVE");
  expect(bytes.length).toBe(50);
  expect(view.getUint32(24, true)).toBe(16000);
  expect(view.getUint16(22, true)).toBe(1);
  expect(view.getInt16(44, true)).toBe(-32768);
  expect(view.getInt16(46, true)).toBe(0);
  expect(view.getInt16(48, true)).toBe(32767);
  expect(() => encodeMonoWav(new Float32Array(), 16000)).toThrow("INVALID_AUDIO_LENGTH");
  expect(() => encodeMonoWav(new Float32Array([NaN]), 16000)).toThrow("INVALID_AUDIO_SAMPLE");
});

it("writes every PCM header field and little-endian frame bytes", () => {
  const bytes = encodeMonoWav(new Float32Array([-1, 0, 1]), 16000);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const marker = (offset: number) => new TextDecoder().decode(bytes.subarray(offset, offset + 4));
  expect(marker(0)).toBe("RIFF");
  expect(view.getUint32(4, true)).toBe(42);
  expect(marker(8)).toBe("WAVE");
  expect(marker(12)).toBe("fmt ");
  expect(view.getUint32(16, true)).toBe(16);
  expect(view.getUint16(20, true)).toBe(1);
  expect(view.getUint16(22, true)).toBe(1);
  expect(view.getUint32(24, true)).toBe(16000);
  expect(view.getUint32(28, true)).toBe(32000);
  expect(view.getUint16(32, true)).toBe(2);
  expect(view.getUint16(34, true)).toBe(16);
  expect(marker(36)).toBe("data");
  expect(view.getUint32(40, true)).toBe(6);
  expect(bytes.byteLength).toBe(50);
  expect(Array.from(bytes.subarray(44))).toEqual([0x00, 0x80, 0x00, 0x00, 0xff, 0x7f]);
});

it("clamps samples and encodes exact signed PCM goldens", () => {
  const bytes = encodeMonoWav(new Float32Array([-2, -1, -0.5, 0, 0.5, 1, 2]), 16000);
  const view = new DataView(bytes.buffer);
  const frames = Array.from({ length: 7 }, (_, index) => view.getInt16(44 + index * 2, true));
  expect(frames).toEqual([-32768, -32768, -16384, 0, 16384, 32767, 32767]);
  expect(Array.from(bytes.subarray(44))).toEqual([
    0x00, 0x80, 0x00, 0x80, 0x00, 0xc0, 0x00, 0x00, 0x00, 0x40, 0xff, 0x7f, 0xff, 0x7f,
  ]);
});

it("rounds positive and negative fractional PCM values including values around zero", () => {
  const bytes = encodeMonoWav(new Float32Array([-0.1, 0.1, -1 / 65536, 1 / 65536]), 16000);
  const view = new DataView(bytes.buffer);
  expect(Array.from({ length: 4 }, (_, index) => view.getInt16(44 + index * 2, true)))
    .toEqual([-3277, 3277, 0, 0]);
});

it.each([0, 960001])("rejects invalid audio length %i with the documented error", (length) => {
  expect(() => encodeMonoWav(new Float32Array(length), 16000))
    .toThrowError(new Error("INVALID_AUDIO_LENGTH"));
});

it.each([0, -16000, 8000, 15999, 16001, 44100, 48000, NaN, Infinity, -Infinity])(
  "rejects non-16000 sample rate %s with the documented error",
  (sampleRate) => {
    expect(() => encodeMonoWav(new Float32Array([0]), sampleRate))
      .toThrowError(new Error("INVALID_AUDIO_LENGTH"));
  },
);

it.each([NaN, Infinity, -Infinity])("rejects non-finite sample %s with the documented error", (sample) => {
  expect(() => encodeMonoWav(new Float32Array([0, sample, 1]), 16000))
    .toThrowError(new Error("INVALID_AUDIO_SAMPLE"));
});

it("accepts exactly 960000 samples and preserves every frame and source byte", () => {
  const samples = new Float32Array(960000).fill(0.5);
  const sourceBefore = Buffer.from(new Uint8Array(samples.buffer));
  const bytes = encodeMonoWav(samples, 16000);
  const view = new DataView(bytes.buffer);
  expect(bytes.byteLength).toBe(1920044);
  expect(view.getUint32(4, true)).toBe(1920036);
  expect(view.getUint32(40, true)).toBe(1920000);
  const expectedFrames = Buffer.alloc(1920000);
  for (let offset = 0; offset < expectedFrames.length; offset += 2) {
    expectedFrames.writeInt16LE(16384, offset);
  }
  expect(Buffer.compare(Buffer.from(bytes.subarray(44)), expectedFrames)).toBe(0);
  expect(Buffer.compare(Buffer.from(new Uint8Array(samples.buffer)), sourceBefore)).toBe(0);
});

it("encodes only a Float32Array subview without changing its backing samples", () => {
  const samples = new Float32Array([NaN, -2, -0.5, 0, 0.5, 2, Infinity]);
  const before = Buffer.from(new Uint8Array(samples.buffer));
  const subview = samples.subarray(1, 6);
  expect(subview.byteOffset).toBe(Float32Array.BYTES_PER_ELEMENT);
  const bytes = encodeMonoWav(subview, 16000);
  const expected = encodeMonoWav(new Float32Array([-2, -0.5, 0, 0.5, 2]), 16000);
  expect(bytes.byteLength).toBe(54);
  expect(Buffer.compare(Buffer.from(bytes), Buffer.from(expected))).toBe(0);
  const view = new DataView(bytes.buffer);
  expect(Array.from({ length: 5 }, (_, index) => view.getInt16(44 + index * 2, true)))
    .toEqual([-32768, -16384, 0, 16384, 32767]);
  expect(Buffer.compare(Buffer.from(new Uint8Array(samples.buffer)), before)).toBe(0);
});
