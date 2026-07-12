import { describe, expect, it } from "vitest";
import { blankPreset } from "../src/engine/preset";
import { FACTORY_PRESETS } from "../src/engine/factoryPresets";
import { SYNTH_SPECS } from "../src/engine/synthSpecs";
import { FX_DEFS } from "../src/engine/fx/fxSpecs";
import { parseSound } from "../src/storage/Serializer";
import { fromNorm, toNorm } from "../src/ui/param";

describe("blankPreset", () => {
  it("covers every synth param and every fx", () => {
    const p = blankPreset("x");
    for (const s of SYNTH_SPECS) expect(p.params[s.key]).toBe(s.default);
    for (const def of FX_DEFS) {
      expect(p.fx[def.id].on).toBe(false);
      for (const s of def.params) expect(p.fx[def.id].params[s.key]).toBe(s.default);
    }
  });
});

describe("factory presets", () => {
  it("all validate", () => {
    for (const p of FACTORY_PRESETS) expect(parseSound(p).ok).toBe(true);
  });
  it("Kick is a sine with a strong pitch drop", () => {
    const kick = FACTORY_PRESETS.find((p) => p.name === "Kick")!;
    expect(kick.waveform).toBe("sine");
    expect(kick.params.pitchAmt).toBeGreaterThan(3);
    expect(kick.params.sustain).toBe(0);
  });
  it("hats are noise through a highpass", () => {
    const ch = FACTORY_PRESETS.find((p) => p.name === "Closed Hat")!;
    expect(ch.filterType).toBe("highpass");
    expect(ch.params.noise).toBe(1);
  });
});

describe("knob mapping", () => {
  it("round-trips synth and fx spec defaults", () => {
    const specs = [...SYNTH_SPECS, ...FX_DEFS.flatMap((d) => d.params)];
    for (const s of specs) expect(fromNorm(toNorm(s.default, s), s)).toBeCloseTo(s.default, 6);
  });
});
