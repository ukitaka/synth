import * as Tone from "tone";
import { MasterBus } from "./MasterBus";
import { SoundEngine } from "./SoundEngine";
import { PatternEngine } from "./PatternEngine";
import { Sequencer } from "./Sequencer";
import { emptyPattern } from "./pattern";
import { SoundPresetStore } from "../storage/SoundPresetStore";
import { PatternStore } from "../storage/PatternStore";
import { createStorage } from "../storage/StorageAdapter";

export type Mode = "SOUND" | "PATTERN";

/**
 * Owns the shared master bus and both halves of the app (design: SOUND designs
 * one voice, PATTERN arranges preset-driven tracks). Both connect to the same
 * bus, so the oscilloscope works in either mode.
 */
export class AudioSystem {
  readonly master: MasterBus;
  readonly sound: SoundEngine; // SOUND tab: the voice being designed
  readonly pattern: PatternEngine; // PATTERN tab: preset-driven tracks
  readonly sequencer: Sequencer;
  readonly presets: SoundPresetStore;
  readonly patterns: PatternStore;
  private started = false;

  constructor() {
    this.master = new MasterBus();
    this.sound = new SoundEngine(this.master.input);
    this.pattern = new PatternEngine(this.master.input);
    this.sequencer = new Sequencer(this.pattern, emptyPattern());
    const storage = createStorage();
    this.presets = new SoundPresetStore(storage);
    this.patterns = new PatternStore(storage);
  }

  /** Resume the AudioContext on first user gesture (iOS autoplay). */
  async powerOn(): Promise<void> {
    if (this.started) return;
    await Tone.start();
    this.started = true;
  }

  isStarted(): boolean {
    return this.started;
  }

  /** Release the outgoing mode's voices on switch. */
  releaseMode(mode: Mode): void {
    if (mode === "PATTERN") {
      if (this.sequencer.isPlaying()) this.sequencer.stop();
      this.pattern.releaseAll();
    } else {
      this.sound.releaseAll();
    }
  }

  setMasterVolume(db: number): void {
    this.master.setVolume(db);
  }
}
