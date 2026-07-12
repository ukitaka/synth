import { VOICE_IDS, type VoiceId } from "./types";

// Choke-group membership (FR-022), kept as pure data so the routing logic is
// testable without Web Audio. CH and OH share the "hat" group: firing one cuts
// the other, like a real hi-hat pedal.
export const CHOKE_GROUPS: Partial<Record<VoiceId, string>> = {
  CH: "hat",
  OH: "hat",
};

/** Voices that should be choked when `id` is triggered (excludes `id` itself). */
export function chokeTargets(id: VoiceId): VoiceId[] {
  const group = CHOKE_GROUPS[id];
  if (!group) return [];
  return VOICE_IDS.filter((other) => other !== id && CHOKE_GROUPS[other] === group);
}
