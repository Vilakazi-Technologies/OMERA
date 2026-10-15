export function encodeMonoWav(samples: Float32Array, sampleRate: number): Uint8Array {
  if (sampleRate !== 16000 || samples.length === 0 || samples.length > 960000) {
    throw new Error("INVALID_AUDIO_LENGTH");
  }
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index++) view.setUint8(offset + index, value.charCodeAt(index));
  };
  text(0, "RIFF");
  view.setUint32(4, bytes.length - 8, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, index) => {
    if (!Number.isFinite(sample)) throw new Error("INVALID_AUDIO_SAMPLE");
    const value = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + index * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
  });
  return bytes;
}
