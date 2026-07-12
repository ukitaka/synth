import { describe, expect, it } from "vitest";
import { fromNorm, toNorm } from "../src/ui/param";
import { VOICE_SPECS } from "../src/engine/voiceSpecs";
import { VOICE_IDS } from "../src/engine/types";

// Knob position mapping must round-trip for both lin and log scales.
describe("param norm mapping", () => {
  it("round-trips every spec's default", () => {
    for (const id of VOICE_IDS) {
      for (const spec of VOICE_SPECS[id]) {
        const back = fromNorm(toNorm(spec.default, spec), spec);
        expect(back).toBeCloseTo(spec.default, 6);
      }
    }
  });

  it("maps endpoints to 0 and 1", () => {
    for (const id of VOICE_IDS) {
      for (const spec of VOICE_SPECS[id]) {
        expect(toNorm(spec.min, spec)).toBeCloseTo(0, 6);
        expect(toNorm(spec.max, spec)).toBeCloseTo(1, 6);
      }
    }
  });

  it("clamps out-of-range input", () => {
    const spec = VOICE_SPECS.BD[0]; // tune 30..80
    expect(toNorm(1000, spec)).toBe(1);
    expect(toNorm(-5, spec)).toBe(0);
  });
});
