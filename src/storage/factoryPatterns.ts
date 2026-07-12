import type { Pattern } from "../engine/types";
import { normalizePattern } from "../engine/pattern";

// Factory patterns are code constants (never stored), so they are undeletable
// like factory kits. Patterns are independent of kits (FR-056).

const four = (n: number[]) => n; // readability alias for step arrays

const BASIC_HOUSE: Pattern = normalizePattern({
  schema: "lab1.pattern",
  version: 1,
  name: "Basic House",
  bpm: 122,
  swing: 0,
  length: 16,
  tracks: {
    BD: four([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]),
    CP: four([0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]),
    CH: four([1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0]),
    OH: four([0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0]),
  },
});

const TECHNO: Pattern = normalizePattern({
  schema: "lab1.pattern",
  version: 1,
  name: "Techno",
  bpm: 132,
  swing: 0,
  length: 16,
  tracks: {
    BD: four([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]),
    SD: four([0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]),
    CH: four([0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0]),
    LT: four([0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0]),
  },
});

export const FACTORY_PATTERNS: readonly Pattern[] = [BASIC_HOUSE, TECHNO];

export function isFactoryPattern(name: string): boolean {
  return FACTORY_PATTERNS.some((p) => p.name === name);
}
