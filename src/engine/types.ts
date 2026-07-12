// Core engine types. The app is preset-driven: a SoundPreset is one designed
// voice (SOUND tab), and a Pattern arranges preset-driven tracks (PATTERN tab).
// Kept free of React/Tone so the engine stays UI-independent and testable.

export type SynthWaveform = "sawtooth" | "square" | "triangle" | "sine";
export type FilterType = "lowpass" | "highpass" | "bandpass";
export type FxId = "drive" | "wah" | "delay" | "reverb";

/**
 * Declarative description of one editable knob. The UI renders one knob per
 * spec and the serializer validates values against min/max, so adding a
 * parameter needs no UI or validation change.
 */
export interface ParamSpec {
  key: string;
  label: string;
  min: number;
  max: number;
  default: number;
  scale: "lin" | "log";
  fmt: (v: number) => string;
}

/** Enable flag + params for one effect inside a preset. */
export interface FxState {
  on: boolean;
  params: Record<string, number>;
}

/**
 * One designed sound (SOUND tab). This is the unit saved/loaded/exported and
 * the thing a PATTERN track plays. Timbre only — the trigger pitch is a
 * per-track property so the same preset can be tuned per track.
 */
export interface SoundPreset {
  schema: "lab1.sound";
  version: 1;
  name: string;
  waveform: SynthWaveform;
  filterType: FilterType;
  params: Record<string, number>;
  fx: Record<FxId, FxState>;
}

/** One track of a pattern: an embedded preset + how/when it fires. */
export interface PatternTrack {
  preset: SoundPreset; // embedded snapshot -> patterns are self-contained
  note: number; // trigger frequency in Hz
  chokeGroup?: string; // tracks sharing a group cut each other (e.g. hats)
  mute?: boolean;
  steps: number[]; // step velocities 0..1
}

/** 16-step, N-track arrangement (PATTERN tab). Independent of the preset store. */
export interface Pattern {
  schema: "lab1.pattern";
  version: 2;
  name: string;
  bpm: number;
  swing: number; // 0..0.75
  length: number; // 16
  tracks: PatternTrack[];
}

/** Index entry kept in `drumlab:index` for fast listing. */
export interface IndexEntry {
  id: string;
  name: string;
  type: "sound" | "pattern";
  updatedAt: number;
}
