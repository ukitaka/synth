import * as Tone from "tone";
import { FxNode } from "./FxNode";

/**
 * Drive / distortion via a WaveShaper (design ethos: a permitted primitive).
 *
 *   input -> WaveShaper(tanh, k=drive) -> makeup Gain -> wet
 *
 * `drive` steepens the tanh curve; a makeup gain compensates the level the
 * saturation removes so turning it up doesn't just get quieter.
 */
export class Drive extends FxNode {
  private readonly shaper: Tone.WaveShaper;
  private readonly makeup: Tone.Gain;

  constructor() {
    super();
    this.shaper = new Tone.WaveShaper(Drive.curve(4), 2048);
    this.makeup = new Tone.Gain(1);
    this.input.connect(this.shaper);
    this.shaper.connect(this.makeup);
    this.makeup.connect(this.wet);
  }

  /** tanh curve with gain k before saturation, normalized to unity at x=1. */
  private static curve(k: number): Float32Array {
    const n = 2048;
    const c = new Float32Array(n);
    const norm = Math.tanh(k);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      c[i] = Math.tanh(k * x) / norm;
    }
    return c;
  }

  /** drive 1..20: higher = harder clipping. */
  setDrive(k: number): void {
    this.shaper.setMap((x) => Math.tanh(k * x) / Math.tanh(k));
    // gentle makeup: more drive compresses peaks, so lift a little
    this.makeup.gain.value = 1 + Math.min(0.6, (k - 1) * 0.03);
  }

  dispose(): void {
    this.shaper.dispose();
    this.makeup.dispose();
    super.dispose();
  }
}
