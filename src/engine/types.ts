// Core engine types shared by voices, the drum engine and the persistence layer.
// Kept free of React and Tone so the engine stays UI-independent (NFR-04, NFR-08).

export type VoiceId = "BD" | "SD" | "CH" | "OH" | "CP" | "LT";

export const VOICE_IDS: VoiceId[] = ["BD", "SD", "CH", "OH", "CP", "LT"];

export const VOICE_LABELS: Record<VoiceId, string> = {
  BD: "BD",
  SD: "SD",
  CH: "CH",
  OH: "OH",
  CP: "CP",
  LT: "LT",
};

/**
 * Declarative description of one editable voice parameter. The UI renders one
 * knob per spec (design §4) and the serializer validates values against
 * `min`/`max` (FR-044), so adding a parameter needs no UI or validation change.
 */
export interface ParamSpec {
  key: string; // storage key, e.g. "tune"
  label: string; // knob caption, e.g. "TUNE"
  min: number;
  max: number;
  default: number;
  scale: "lin" | "log"; // knob response curve
  fmt: (v: number) => string; // value readout formatter
}

/** 6-voice parameter snapshot — the unit that gets saved/loaded (design §6.1). */
export interface KitPreset {
  schema: "lab1.kit";
  version: 1;
  name: string;
  voices: Record<VoiceId, Record<string, number>>;
}

/** 16-step x 6-track pattern (Phase 2, design §6.2). Independent of any kit. */
export interface Pattern {
  schema: "lab1.pattern";
  version: 1;
  name: string;
  bpm: number;
  swing: number; // 0..0.75
  length: number; // 16
  tracks: Partial<Record<VoiceId, number[]>>; // step velocities 0..1; omitted = all off
}

/** Index entry kept in `drumlab:index` for fast listing (design §5). */
export interface IndexEntry {
  id: string;
  name: string;
  type: "kit" | "pattern";
  updatedAt: number;
}
