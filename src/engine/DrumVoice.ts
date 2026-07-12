import * as Tone from "tone";
import type { ParamSpec, VoiceId } from "./types";

/**
 * Base class for one drum voice (design §2).
 *
 * A voice owns its own synthesis graph (oscillators / noise -> filters ->
 * amplitude envelopes -> gains) and exposes only two things to the outside
 * world: `setParam` for the UI and `trigger(time, velocity)` for both pad
 * playing (`time = Tone.now()`) and the Phase-2 sequencer (future Transport
 * time). Keeping the time argument here is what lets Phase 2 reuse the engine
 * unchanged (design §7).
 *
 * The signal graph is built in each subclass constructor, written in flow order
 * with a path comment, so the code reads like a circuit diagram (NFR-04).
 */
export abstract class DrumVoice {
  abstract readonly id: VoiceId;
  abstract readonly paramSpecs: ParamSpec[];
  /** Voices sharing a choke group cut each other off, e.g. "hat" (FR-022). */
  readonly chokeGroup?: string;

  /** Final per-voice output; its gain is the voice level in linear units. */
  protected readonly out: Tone.Gain;
  /** Current parameter values, seeded from paramSpecs defaults. */
  protected readonly params: Record<string, number> = {};
  /** Amplitude envelopes registered by subclasses for choke / release. */
  protected readonly envs: Tone.AmplitudeEnvelope[] = [];

  constructor(bus: Tone.Gain) {
    this.out = new Tone.Gain(1);
    this.out.connect(bus);
  }

  /**
   * Seed params from specs and apply them. Subclasses MUST call this at the end
   * of their constructor, after the audio graph exists, so `applyParam` can
   * push initial values into live nodes.
   */
  protected initParams(): void {
    for (const spec of this.paramSpecs) {
      this.params[spec.key] = spec.default;
    }
    for (const spec of this.paramSpecs) {
      this.applyParam(spec.key, this.params[spec.key]);
    }
  }

  /** Fire the voice. Retrigger of a still-sounding voice is click-safe. */
  abstract trigger(time: number, velocity: number): void;

  /**
   * Apply one live parameter change to the audio graph. `level` is handled here
   * (dB -> linear on `out`); subclasses handle their own keys and delegate the
   * rest to `super.applyParam`.
   */
  protected applyParam(key: string, value: number): void {
    if (key === "level") {
      this.out.gain.value = Tone.dbToGain(value);
    }
  }

  setParam(key: string, value: number): void {
    if (!(key in this.params)) return;
    this.params[key] = value;
    this.applyParam(key, value);
  }

  getParams(): Record<string, number> {
    return { ...this.params };
  }

  setParams(p: Record<string, number>): void {
    for (const spec of this.paramSpecs) {
      if (typeof p[spec.key] === "number") {
        this.setParam(spec.key, p[spec.key]);
      }
    }
  }

  /** Hard-ish cut for choke groups: release every envelope now (design §3.3). */
  choke(time: number): void {
    for (const env of this.envs) env.triggerRelease(time);
  }

  /** Natural release used on mode switch (FR-011); not a hard cut. */
  release(time: number): void {
    for (const env of this.envs) env.triggerRelease(time);
  }

  /**
   * Click-safe attack. AmplitudeEnvelope ramps from its current value, so a
   * fast retrigger glides instead of stepping (design §2 anti-click intent).
   * Callers set per-trigger `decay` before calling.
   */
  protected fire(env: Tone.AmplitudeEnvelope, time: number, velocity: number): void {
    env.cancel(time);
    env.triggerAttack(time, velocity);
  }

  dispose(): void {
    for (const env of this.envs) env.dispose();
    this.out.dispose();
  }
}
