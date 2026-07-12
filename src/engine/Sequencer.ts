import * as Tone from "tone";
import type { DrumEngine } from "./DrumEngine";
import type { Pattern, VoiceId } from "./types";

/**
 * 16-step sequencer (design §7, Phase 2). Timing comes only from the Transport's
 * look-ahead scheduler — never setTimeout/rAF (NFR-02). The playhead is drawn
 * via Tone.Draw so the UI follows audio time instead of driving it.
 *
 * The only coupling to Phase 1 is `engine.trigger(id, vel, time)`: the callback
 * forwards the Transport's future `time` straight through, so voices sound
 * exactly as they do from the pads (design §7).
 */
export class Sequencer {
  private pattern: Pattern;
  private eventId: number | null = null;
  private step = 0;
  private onStep: ((step: number) => void) | null = null;

  constructor(private readonly engine: DrumEngine, pattern: Pattern) {
    this.pattern = pattern;
  }

  setPlayheadCallback(cb: ((step: number) => void) | null): void {
    this.onStep = cb;
  }

  /**
   * Swap the live pattern. Editing during playback (FR-054) works because the
   * scheduled callback reads `this.pattern` fresh every step; tempo/swing are
   * pushed to the Transport immediately.
   */
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
    t.swingSubdivision = "16n"; // swing delays the off-beat 16ths
    this.step = 0;

    this.eventId = t.scheduleRepeat((time) => {
      const step = this.step;
      const tracks = this.pattern.tracks;
      for (const id of Object.keys(tracks) as VoiceId[]) {
        const vel = tracks[id]?.[step] ?? 0;
        if (vel > 0) this.engine.trigger(id, vel, time); // future time, transparent
      }
      // Advance for the next callback; UI update is deferred to audio time.
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
    if (this.onStep) this.onStep(-1); // clear playhead
  }
}
