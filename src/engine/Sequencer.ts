import * as Tone from "tone";
import type { PatternEngine } from "./PatternEngine";
import type { Pattern } from "./types";

/**
 * 16-step sequencer. Timing comes only from the Transport's look-ahead
 * scheduler — never setTimeout/rAF. The playhead is drawn via Tone.Draw so the
 * UI follows audio time instead of driving it.
 *
 * The only coupling to the sound layer is `engine.trigger(trackIndex, vel,
 * time)`, which forwards the Transport's future time straight through.
 */
export class Sequencer {
  private pattern: Pattern;
  private eventId: number | null = null;
  private step = 0;
  private onStep: ((step: number) => void) | null = null;

  constructor(private readonly engine: PatternEngine, pattern: Pattern) {
    this.pattern = pattern;
  }

  setPlayheadCallback(cb: ((step: number) => void) | null): void {
    this.onStep = cb;
  }

  /** Swap the live pattern. Editing during playback works because the callback
   * reads `this.pattern` fresh each step; tempo/swing are pushed immediately. */
  setPattern(pattern: Pattern): void {
    this.pattern = pattern;
    const t = Tone.getTransport();
    t.bpm.value = pattern.bpm;
    t.swing = pattern.swing;
  }

  getPattern(): Pattern {
    return this.pattern;
  }

  isPlaying(): boolean {
    return this.eventId !== null;
  }

  start(): void {
    if (this.eventId !== null) return;
    const t = Tone.getTransport();
    t.bpm.value = this.pattern.bpm;
    t.swing = this.pattern.swing;
    t.swingSubdivision = "16n";
    this.step = 0;

    this.eventId = t.scheduleRepeat((time) => {
      const step = this.step;
      this.pattern.tracks.forEach((track, i) => {
        const vel = track.steps[step] ?? 0;
        if (vel > 0) this.engine.trigger(i, vel, time); // future time, transparent
      });
      this.step = (step + 1) % this.pattern.length;
      if (this.onStep) Tone.getDraw().schedule(() => this.onStep?.(step), time);
    }, "16n");

    t.start();
  }

  stop(): void {
    const t = Tone.getTransport();
    if (this.eventId !== null) {
      t.clear(this.eventId);
      this.eventId = null;
    }
    t.stop();
    this.step = 0;
    this.engine.releaseAll();
    if (this.onStep) this.onStep(-1);
  }
}
