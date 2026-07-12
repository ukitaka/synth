import { VOICE_IDS, type Pattern, type VoiceId } from "./types";

export const STEP_COUNT = 16;

/** A blank 16-step pattern with every track present and off. */
export function emptyPattern(name = "New Pattern", bpm = 122): Pattern {
  const tracks = {} as Record<VoiceId, number[]>;
  for (const id of VOICE_IDS) tracks[id] = new Array(STEP_COUNT).fill(0);
  return { schema: "lab1.pattern", version: 1, name, bpm, swing: 0, length: STEP_COUNT, tracks };
}

/** Return a copy with every track padded to `length` (import may omit tracks). */
export function normalizePattern(p: Pattern): Pattern {
  const tracks = {} as Record<VoiceId, number[]>;
  for (const id of VOICE_IDS) {
    const src = p.tracks[id] ?? [];
    tracks[id] = Array.from({ length: p.length }, (_, i) => src[i] ?? 0);
  }
  return { ...p, tracks };
}
