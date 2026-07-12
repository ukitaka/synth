import { FACTORY_META, FACTORY_PRESETS, STARTER_KIT } from "./factoryPresets";
import type { Pattern, PatternTrack, SoundPreset } from "./types";

export const STEP_COUNT = 16;

export function makeTrack(preset: SoundPreset, note: number, chokeGroup?: string): PatternTrack {
  return {
    preset: structuredClone(preset),
    note,
    chokeGroup,
    mute: false,
    steps: new Array(STEP_COUNT).fill(0),
  };
}

/** A fresh pattern seeded with the familiar starter kit tracks. */
export function emptyPattern(name = "New Pattern", bpm = 122): Pattern {
  const tracks = STARTER_KIT.map((name) => {
    const preset = FACTORY_PRESETS.find((p) => p.name === name)!;
    const meta = FACTORY_META[name];
    return makeTrack(preset, meta.note, meta.choke);
  });
  return { schema: "lab1.pattern", version: 2, name, bpm, swing: 0, length: STEP_COUNT, tracks };
}

/** Pad every track's steps to `length` (import may send short/absent arrays). */
export function normalizePattern(p: Pattern): Pattern {
  return {
    ...p,
    tracks: p.tracks.map((t) => ({
      ...t,
      steps: Array.from({ length: p.length }, (_, i) => t.steps[i] ?? 0),
    })),
  };
}
