import * as Tone from "tone";

// Offline rendering needs a real Web Audio backend (OfflineAudioContext). That
// exists in a browser (run `vitest --browser`) but not in plain node, so these
// tests self-detect and skip loudly rather than failing the suite (NFR-08).

let cached: boolean | null = null;

export async function audioRenderingAvailable(): Promise<boolean> {
  if (cached !== null) return cached;
  try {
    await Tone.Offline(() => {
      new Tone.Oscillator(220, "sine").toDestination().start(0).stop(0.05);
    }, 0.1);
    cached = true;
  } catch {
    // eslint-disable-next-line no-console
    console.warn(
      "[audio tests] OfflineAudioContext unavailable — skipping render tests. " +
        "Run `npx vitest --browser` in a browser env to execute §9.1/§9.2."
    );
    cached = false;
  }
  return cached;
}

/** Peak absolute sample across a channel. */
export function peak(ch: Float32Array): number {
  let p = 0;
  for (let i = 0; i < ch.length; i++) p = Math.max(p, Math.abs(ch[i]));
  return p;
}

/** RMS over a [startSec, endSec] window. */
export function rmsWindow(ch: Float32Array, sampleRate: number, startSec: number, endSec: number): number {
  const a = Math.max(0, Math.floor(startSec * sampleRate));
  const b = Math.min(ch.length, Math.floor(endSec * sampleRate));
  let sum = 0;
  for (let i = a; i < b; i++) sum += ch[i] * ch[i];
  const n = Math.max(1, b - a);
  return Math.sqrt(sum / n);
}

/** Zero-crossing rate — a cheap brightness proxy for spectral-centroid ordering. */
export function zeroCrossingRate(ch: Float32Array, sampleRate: number, startSec: number, endSec: number): number {
  const a = Math.max(0, Math.floor(startSec * sampleRate));
  const b = Math.min(ch.length, Math.floor(endSec * sampleRate));
  let crossings = 0;
  for (let i = a + 1; i < b; i++) {
    if ((ch[i - 1] <= 0 && ch[i] > 0) || (ch[i - 1] >= 0 && ch[i] < 0)) crossings++;
  }
  const seconds = Math.max(1e-6, (b - a) / sampleRate);
  return crossings / seconds;
}
