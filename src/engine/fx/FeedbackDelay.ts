import * as Tone from "tone";
import { FxNode } from "./FxNode";

/**
 * Feedback delay built from primitives (not Tone.FeedbackDelay):
 *
 *   input ─► delay ─┬─► wet
 *            ▲       └─► feedback Gain ─┐
 *            └───────────────────────────┘   (delayed signal fed back in)
 *
 * A damping lowpass in the feedback path makes repeats darken like a real
 * analog delay instead of ringing forever.
 */
export class FeedbackDelay extends FxNode {
  private readonly delay: Tone.Delay;
  private readonly feedback: Tone.Gain;
  private readonly damp: Tone.Filter;

  constructor() {
    super();
    this.delay = new Tone.Delay(0.3, 2); // maxDelay 2s
    this.feedback = new Tone.Gain(0.35);
    this.damp = new Tone.Filter({ type: "lowpass", frequency: 4000 });

    this.input.connect(this.delay);
    this.delay.connect(this.wet);
    // feedback loop with damping
    this.delay.connect(this.damp);
    this.damp.connect(this.feedback);
    this.feedback.connect(this.delay);
  }

  setTime(seconds: number): void {
    this.delay.delayTime.rampTo(Math.max(0.01, seconds), 0.05);
  }

  /** 0..0.95; kept below 1 so the loop always decays. */
  setFeedback(amount: number): void {
    this.feedback.gain.rampTo(Math.min(0.95, Math.max(0, amount)), 0.02);
  }

  dispose(): void {
    this.delay.dispose();
    this.feedback.dispose();
    this.damp.dispose();
    super.dispose();
  }
}
