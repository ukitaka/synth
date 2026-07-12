import * as Tone from "tone";
import { Drive } from "./Drive";
import { AutoWah } from "./AutoWah";
import { FeedbackDelay } from "./FeedbackDelay";
import { Reverb } from "./Reverb";
import { fxDefaults, type FxId } from "./fxSpecs";

/**
 * SYNTH-only FX rack, series-connected (design decision: SYNTH-only):
 *
 *   input -> Drive -> AutoWah -> Delay -> Reverb -> output -> bus
 *
 * All four effects are built from Tone primitives (see fx/*.ts). Each starts
 * bypassed; the UI enables and drives them via `setParam` / `setEnabled`.
 */
export class FxChain {
  readonly input: Tone.Gain;
  readonly output: Tone.Gain;
  private readonly drive: Drive;
  private readonly wah: AutoWah;
  private readonly delay: FeedbackDelay;
  private readonly reverb: Reverb;
  private readonly values: Record<FxId, Record<string, number>> = { drive: {}, wah: {}, delay: {}, reverb: {} };

  constructor() {
    this.input = new Tone.Gain(1);
    this.output = new Tone.Gain(1);
    this.drive = new Drive();
    this.wah = new AutoWah();
    this.delay = new FeedbackDelay();
    this.reverb = new Reverb();

    // series chain
    this.input.connect(this.drive.input);
    this.drive.connect(this.wah.input);
    this.wah.connect(this.delay.input);
    this.delay.connect(this.reverb.input);
    this.reverb.connect(this.output);

    // seed every effect with its defaults (still bypassed until enabled)
    for (const id of ["drive", "wah", "delay", "reverb"] as FxId[]) {
      const d = fxDefaults(id);
      for (const [k, v] of Object.entries(d)) this.setParam(id, k, v);
    }
  }

  setEnabled(id: FxId, on: boolean): void {
    this.node(id).setEnabled(on);
  }

  isEnabled(id: FxId): boolean {
    return this.node(id).isEnabled();
  }

  getParam(id: FxId, key: string): number {
    return this.values[id][key];
  }

  setParam(id: FxId, key: string, value: number): void {
    this.values[id][key] = value;
    if (key === "mix") {
      this.node(id).setMix(value);
      return;
    }
    switch (id) {
      case "drive":
        if (key === "drive") this.drive.setDrive(value);
        break;
      case "wah":
        if (key === "rate") this.wah.setRate(value);
        else if (key === "depth") this.wah.setDepth(value);
        else if (key === "base") this.wah.setBase(value);
        break;
      case "delay":
        if (key === "time") this.delay.setTime(value);
        else if (key === "feedback") this.delay.setFeedback(value);
        break;
      case "reverb":
        if (key === "size") this.reverb.setSize(value);
        else if (key === "damp") this.reverb.setDamp(value);
        break;
    }
  }

  connect(dest: Tone.InputNode): void {
    this.output.connect(dest);
  }

  private node(id: FxId) {
    return id === "drive" ? this.drive : id === "wah" ? this.wah : id === "delay" ? this.delay : this.reverb;
  }

  dispose(): void {
    this.drive.dispose();
    this.wah.dispose();
    this.delay.dispose();
    this.reverb.dispose();
    this.input.dispose();
    this.output.dispose();
  }
}
