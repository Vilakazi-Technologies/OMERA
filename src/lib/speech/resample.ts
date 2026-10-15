/** Voice pipeline sample rate: 16 kHz mono. */
export const VOICE_SAMPLE_RATE = 16000;

/** Mix channel data to mono using the per-sample channel mean. */
export function mixToMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 0) throw new Error("INVALID_AUDIO_CHANNELS");
  const length = channels[0].length;
  for (const channel of channels) {
    if (channel.length !== length) throw new Error("INVALID_AUDIO_CHANNELS");
  }
  if (channels.length === 1) return channels[0].slice();
  const mono = new Float32Array(length);
  for (let index = 0; index < length; index++) {
    let sum = 0;
    for (const channel of channels) sum += channel[index];
    mono[index] = sum / channels.length;
  }
  return mono;
}

/**
 * Convert decoded channel data to 16 kHz mono.
 *
 * Mixing is the exact channel mean. Sample-rate conversion runs through
 * the browser `OfflineAudioContext`; same-rate input skips it.
 */
export async function resampleToMono16k(
  channels: Float32Array[],
  sourceSampleRate: number,
): Promise<Float32Array> {
  const mono = mixToMono(channels);
  if (!Number.isFinite(sourceSampleRate) || sourceSampleRate <= 0) {
    throw new Error("INVALID_SAMPLE_RATE");
  }
  if (sourceSampleRate === VOICE_SAMPLE_RATE) return mono;
  const targetLength = Math.max(
    1,
    Math.round((mono.length / sourceSampleRate) * VOICE_SAMPLE_RATE),
  );
  const context = new OfflineAudioContext(1, targetLength, VOICE_SAMPLE_RATE);
  const source = context.createBuffer(1, mono.length, sourceSampleRate);
  const owned = new Float32Array(mono.length);
  owned.set(mono);
  source.copyToChannel(owned, 0);
  const node = context.createBufferSource();
  node.buffer = source;
  node.connect(context.destination);
  node.start(0);
  const rendered = await context.startRendering();
  return rendered.getChannelData(0).slice();
}
