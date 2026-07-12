import * as Tone from "tone";
import { SoundEngine } from "./SoundEngine";
import type { Pattern } from "./types";

interface Track {
  sound: SoundEngine;
  note: number;
  chokeGroup?: string;
  mute: boolean;
}

/**
 * The PATTERN engine: one SoundEngine voice per track, each configured from the
 * track's embedded preset (replaces the old fixed 808 DrumEngine). Tracks are
 * triggered by index; same-choke-group tracks cut each other (e.g. hats).
 *
 * `trigger(i, vel, time)` takes an explicit time so pad auditioning and the
 * Sequencer share the same entry point.
 */
export class PatternEngine {
  private tracks: Track[] = [];

  constructor(private readonly bus: Tone.Gain) {}

  get length(): number {
    return this.tracks.length;
  }

  /**
   * Reconcile the live voices with a pattern's track list. Cheap for step edits
   * (they don't call this); called only on structural changes (add/remove track,
   * preset reassign, note/choke/mute change).
   */
  sync(pattern: Pattern): void {
    while (this.tracks.length > pattern.tracks.length) {
      this.tracks.pop()!.sound.dispose();
    }
    pattern.tracks.forEach((t, i) => {
      let tr = this.tracks[i];
      if (!tr) {
        tr = { sound: new SoundEngine(this.bus), note: t.note, mute: false };
        this.tracks[i] = tr;
      }
      tr.sound.loadPreset(t.preset);
      tr.note = t.note;
      tr.chokeGroup = t.chokeGroup;
      tr.mute = !!t.mute;
    });
  }

  setMute(i: number, mute: boolean): void {
    if (this.tracks[i]) this.tracks[i].mute = mute;
  }

  trigger(i: number, velocity = 1, time: number = Tone.now()): void {
    const tr = this.tracks[i];
    if (!tr || tr.mute) return;
    if (tr.chokeGroup) {
      this.tracks.forEach((o, j) => {
        if (j !== i && o.chokeGroup === tr.chokeGroup) o.sound.noteOff(time);
      });
    }
    tr.sound.noteOn(tr.note, time, velocity);
  }

  /** Audition a track ignoring mute (used when editing). */
  preview(i: number): void {
    const tr = this.tracks[i];
    if (tr) tr.sound.noteOn(tr.note);
  }

  releaseAll(time: number = Tone.now()): void {
    for (const t of this.tracks) t.sound.releaseAll(time);
  }

  dispose(): void {
    for (const t of this.tracks) t.sound.dispose();
    this.tracks = [];
  }
}
