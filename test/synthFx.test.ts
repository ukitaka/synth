import { describe, expect, it } from "vitest";
import { SYNTH_SPECS, synthDefaults } from "../src/engine/synthSpecs";
import { FX_DEFS, fxDefaults, type FxId } from "../src/engine/fx/fxSpecs";
import { fromNorm, toNorm } from "../src/ui/param";

describe("synth specs", () => {
  it("defaults cover every spec and sit within range", () => {
    const d = synthDefaults();
    for (const s of SYNTH_SPECS) {
      expect(d[s.key]).toBe(s.default);
      expect(s.default).toBeGreaterThanOrEqual(s.min);
      expect(s.default).toBeLessThanOrEqual(s.max);
    }
  });

  it("pitchAmt x1 default means no pitch sweep (melodic play)", () => {
    // log2(1) = 0 octaves -> flat pitch envelope
    expect(synthDefaults().pitchAmt).toBe(1);
    expect(Math.log2(synthDefaults().pitchAmt)).toBe(0);
  });

  it("knob mapping round-trips for every synth spec", () => {
    for (const s of SYNTH_SPECS) {
      expect(fromNorm(toNorm(s.default, s), s)).toBeCloseTo(s.default, 6);
    }
  });
});

describe("fx specs", () => {
  const ids: FxId[] = ["drive", "wah", "delay", "reverb"];

  it("every effect has a mix param and in-range defaults", () => {
    for (const id of ids) {
      const def = FX_DEFS.find((d) => d.id === id)!;
      expect(def.params.some((p) => p.key === "mix")).toBe(true);
      const d = fxDefaults(id);
      for (const p of def.params) {
        expect(d[p.key]).toBe(p.default);
        expect(p.default).toBeGreaterThanOrEqual(p.min);
        expect(p.default).toBeLessThanOrEqual(p.max);
      }
    }
  });

  it("delay feedback default stays below unity so it decays", () => {
    expect(fxDefaults("delay").feedback).toBeLessThan(1);
  });
});
