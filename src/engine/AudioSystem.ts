import * as Tone from "tone";
import { MasterBus } from "./MasterBus";
import { DrumEngine } from "./DrumEngine";
import { SynthEngine } from "./SynthEngine";
import { Sequencer } from "./Sequencer";
import { emptyPattern } from "./pattern";
import { KitStore } from "../storage/KitStore";
import { PatternStore } from "../storage/PatternStore";
import { createStorage } from "../storage/StorageAdapter";

export type Mode = "SYNTH" | "DRUM";

/**
 * Owns the shared master bus and both engines (design §1). Both engines are
 * created up front and connected to the same bus, so the oscilloscope works in
 * either mode (FR-012) and switching mode is a UI-only concern (FR-010).
 */
export class AudioSystem {
  readonly master: MasterBus;
  readonly drum: DrumEngine;
  readonly synth: SynthEngine;
  readonly sequencer: Sequencer;
  readonly kits: KitStore;
  readonly patterns: PatternStore;
  private started = false;

  constructor() {
    this.master = new MasterBus();
    this.drum = new DrumEngine(this.master.input);
    this.synth = new SynthEngine(this.master.input);
    this.sequencer = new Sequencer(this.drum, emptyPattern());
    const storage = createStorage();
    this.kits = new KitStore(storage);
    this.patterns = new PatternStore(storage);
  }

  /** Resume the AudioContext on first user gesture (iOS autoplay, design §8). */
  async powerOn(): Promise<void> {
    if (this.started) return;
    await Tone.start();
    this.started = true;
  }

  isStarted(): boolean {
    return this.started;
  }

  /** Release the outgoing mode's voices on switch, via release (FR-011). */
  releaseMode(mode: Mode): void {
    if (mode === "DRUM") {
      if (this.sequencer.isPlaying()) this.sequencer.stop();
      this.drum.releaseAll();
    } else {
      this.synth.releaseAll();
    }
  }

  setMasterVolume(db: number): void {
    this.master.setVolume(db);
  }
}
