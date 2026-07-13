import { describe, expect, it } from "vitest";
import { parseSound, parsePattern, serializeSound, serializePattern } from "../src/storage/Serializer";
import { blankPreset } from "../src/engine/preset";
import { emptyPattern } from "../src/engine/pattern";

describe("parseSound", () => {
  it("round-trips a valid preset unchanged", () => {
    const p = blankPreset("My Sound");
    p.waveform = "sine";
    p.filterType = "highpass";
    p.params.cutoff = 3000;
    p.fx.drive.on = true;
    const res = parseSound(JSON.parse(serializeSound(p)));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value).toEqual(p);
  });

  it("rejects wrong schema / version", () => {
    expect(parseSound({ ...blankPreset("x"), schema: "nope" }).ok).toBe(false);
    expect(parseSound({ ...blankPreset("x"), version: 2 }).ok).toBe(false);
  });

  it("rejects invalid waveform and filter type", () => {
    expect(parseSound({ ...blankPreset("x"), waveform: "buzz" }).ok).toBe(false);
    expect(parseSound({ ...blankPreset("x"), filterType: "notch" }).ok).toBe(false);
  });

  it("accepts filterType off (bypass)", () => {
    const res = parseSound({ ...blankPreset("x"), filterType: "off" });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.filterType).toBe("off");
  });

  it("rejects an out-of-range param with key + range in the message", () => {
    const p = blankPreset("x");
    p.params.cutoff = 99999; // max is 12000
    const res = parseSound(p);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.join()).toMatch(/params\.cutoff.*12000/);
  });

  it("rejects an out-of-range fx param", () => {
    const p = blankPreset("x");
    p.fx.delay.params.feedback = 5; // max 0.95
    expect(parseSound(p).ok).toBe(false);
  });
});

describe("parsePattern (v2)", () => {
  it("round-trips a valid pattern", () => {
    const p = emptyPattern("Beat");
    p.tracks[0].steps[0] = 1;
    const res = parsePattern(JSON.parse(serializePattern(p)));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.tracks.length).toBe(p.tracks.length);
      expect(res.value.tracks[0].steps[0]).toBe(1);
      expect(res.value.tracks[0].preset.name).toBe(p.tracks[0].preset.name);
    }
  });

  it("rejects bad bpm / swing", () => {
    const res = parsePattern({ schema: "lab1.pattern", version: 2, bpm: 999, swing: 3, tracks: [] });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.join()).toMatch(/bpm/);
      expect(res.errors.join()).toMatch(/swing/);
    }
  });

  it("rejects a step velocity outside 0..1", () => {
    const p = emptyPattern();
    (p.tracks[0].steps as number[])[0] = 2;
    expect(parsePattern(p).ok).toBe(false);
  });

  it("validates embedded track presets", () => {
    const p = emptyPattern();
    p.tracks[0].preset.params.cutoff = 99999;
    const res = parsePattern(p);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.join()).toMatch(/tracks\[0\]\.preset/);
  });
});
