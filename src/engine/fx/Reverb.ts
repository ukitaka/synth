import * as Tone from "tone";
import { FxNode } from "./FxNode";

// One feedback comb filter: input -> delay -> (out) and delay -> damp -> fb -> delay.
interface Comb {
  delay: Tone.Delay;
  damp: Tone.Filter;
  fb: Tone.Gain;
}

// Freeverb-style comb delay times (seconds); mutually prime-ish to smear echoes.
const COMB_TIMES = [0.0297, 0.0371, 0.0411, 0.0437, 0.005, 0.0017];

/**
 * Algorithmic reverb from primitives (no Tone.Reverb / convolution): a bank of
 * parallel damped feedback comb filters summed to a wet mix.
 *
 *   input ─► [ comb x6 in parallel ] ─► sum ─► wet
 *   each comb: delay ─┬─► sum
 *                     └─► damp(LPF) ─► feedback Gain ─► delay
 *
 * `size` sets the comb feedback (tail length); `damp` sets how fast highs die.
 */
export class Reverb extends FxNode {
  private readonly combs: Comb[] = [];
  private readonly sum: Tone.Gain;

  constructor() {
    super();
    this.sum = new Tone.Gain(1 / COMB_TIMES.length);
    for (const t of COMB_TIMES) {
      const delay = new Tone.Delay(t, 0.1);
      const damp = new Tone.Filter({ type: "lowpass", frequency: 3000 });
      const fb = new Tone.Gain(0.7);
      this.input.connect(delay);
      delay.connect(this.sum);
      delay.connect(damp);
      damp.connect(fb);
      fb.connect(delay);
      this.combs.push({ delay, damp, fb });
    }
    this.sum.connect(this.wet);
  }

  /** 0..0.95: comb feedback -> reverb tail length. */
  setSize(size: number): void {
    const g = Math.min(0.95, Math.max(0, size));
    for (const c of this.combs) c.fb.gain.rampTo(g, 0.05);
  }

  /** Damping cutoff in Hz: lower = darker, shorter-sounding tail. */
  setDamp(freqHz: number): void {
    for (const c of this.combs) c.damp.frequency.rampTo(freqHz, 0.05);
  }

  dispose(): void {
    for (const c of this.combs) {
      c.delay.dispose();
      c.damp.dispose();
      c.fb.dispose();
    }
    this.sum.dispose();
    super.dispose();
  }
}
