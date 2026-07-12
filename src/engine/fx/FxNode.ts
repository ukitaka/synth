import * as Tone from "tone";

/**
 * Base for one insert effect, built only from Tone.js primitives (project ethos,
 * NFR-03). Each effect is a dry/wet crossfade:
 *
 *   input ─┬─► dry ───────────────────────► output
 *          └─► [subclass processing] ─► wet ─► output
 *
 * Subclasses connect `this.input -> ... -> this.wet` in their constructor. The
 * effect starts bypassed (wet 0); `setMix` crossfades and `setEnabled` bypasses
 * without forgetting the mix.
 */
export abstract class FxNode {
  readonly input: Tone.Gain;
  readonly output: Tone.Gain;
  protected readonly dry: Tone.Gain;
  protected readonly wet: Tone.Gain;
  private mix = 0.3;
  private enabled = false;

  constructor() {
    this.input = new Tone.Gain(1);
    this.output = new Tone.Gain(1);
    this.dry = new Tone.Gain(1);
    this.wet = new Tone.Gain(0);
    this.input.connect(this.dry);
    this.dry.connect(this.output);
    this.wet.connect(this.output);
  }

  /** Wet amount 0..1 (dry = 1 - wet). Applied only while enabled. */
  setMix(mix: number): void {
    this.mix = Math.min(1, Math.max(0, mix));
    this.apply();
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.apply();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private apply(): void {
    const w = this.enabled ? this.mix : 0;
    this.wet.gain.rampTo(w, 0.02);
    this.dry.gain.rampTo(1 - w, 0.02);
  }

  connect(dest: Tone.InputNode): void {
    this.output.connect(dest);
  }

  dispose(): void {
    this.input.dispose();
    this.output.dispose();
    this.dry.dispose();
    this.wet.dispose();
  }
}
