import { FACTORY_META, FACTORY_PRESETS } from "../engine/factoryPresets";
import { makeTrack, normalizePattern } from "../engine/pattern";
import type { Pattern, PatternTrack } from "../engine/types";

// Factory patterns are code constants (undeletable). Each track embeds a
// factory-preset snapshot, so patterns are self-contained (portable JSON).

function track(presetName: string, steps: number[]): PatternTrack {
  const preset = FACTORY_PRESETS.find((p) => p.name === presetName)!;
  const meta = FACTORY_META[presetName];
  const t = makeTrack(preset, meta.note, meta.choke);
  t.steps = steps.slice();
  return t;
}

const BASIC_HOUSE: Pattern = normalizePattern({
  schema: "lab1.pattern", version: 2, name: "Basic House", bpm: 122, swing: 0, length: 16,
  tracks: [
    track("Kick", [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]),
    track("Clap", [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]),
    track("Closed Hat", [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0]),
    track("Open Hat", [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0]),
  ],
});

const TECHNO: Pattern = normalizePattern({
  schema: "lab1.pattern", version: 2, name: "Techno", bpm: 132, swing: 0, length: 16,
  tracks: [
    track("Kick", [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]),
    track("Snare", [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]),
    track("Closed Hat", [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0]),
    track("Tom", [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0]),
  ],
});

export const FACTORY_PATTERNS: readonly Pattern[] = [BASIC_HOUSE, TECHNO];

export function isFactoryPattern(name: string): boolean {
  return FACTORY_PATTERNS.some((p) => p.name === name);
}
