import * as Tone from "tone";
import { FxNode } from "./FxNode";

/**
 * Auto-wah: an LFO sweeping a resonant bandpass (Filter + LFO primitives).
 *
 *   LFO ─► filter.frequency
 *   input ─► filter(bandpass, high Q) ─► wet
 *
 * `rate` is the sweep speed, `depth` the sweep span (base .. base*2^depth),
 * `base` the low end of the sweep.
 */
export class AutoWah extends FxNode {
  private readonly filter: Tone.Filter;
  private readonly lfo: Tone.LFO;
  private base = 400;
  private depth = 3; // octaves

  constructor() {
    super();
    this.filter = new Tone.Filter({ type: "bandpass", frequency: 400, Q: 6 });
    this.lfo = new Tone.LFO({ frequency: 2, min: 400, max: 400 * 2 ** 3, type: "sine" });
    this.lfo.connect(this.filter.frequency);
    this.lfo.start();

    this.input.connect(this.filter);
    this.filter.connect(this.wet);
    this.updateRange();
  }

  private updateRange(): void {
    this.lfo.min = this.base;
    this.lfo.max = this.base * 2 ** this.depth;
  }

  setRate(hz: number): void {
    this.lfo.frequency.rampTo(hz, 0.05);
  }

  setDepth(octaves: number): void {
    this.depth = octaves;
    this.updateRange();
  }

  setBase(hz: number): void {
    this.base = hz;
    this.updateRange();
  }

  setResonance(q: number): void {
    this.filter.Q.value = q;
  }

  dispose(): void {
    this.lfo.dispose();
    this.filter.dispose();
    super.dispose();
  }
}
