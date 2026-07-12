import { describe, expect, it } from "vitest";
import {
  parseKit,
  parsePattern,
  serializeKit,
  clampKit,
} from "../src/storage/Serializer";
import { defaultParams } from "../src/engine/voiceSpecs";
import { VOICE_IDS, type KitPreset } from "../src/engine/types";

function defaultKit(name = "Test"): KitPreset {
  const voices = {} as KitPreset["voices"];
  for (const id of VOICE_IDS) voices[id] = defaultParams(id);
  return { schema: "lab1.kit", version: 1, name, voices };
}

describe("parseKit", () => {
  it("round-trips a valid kit unchanged (design §9.3)", () => {
    const kit = defaultKit("My 808");
    const round = parseKit(JSON.parse(serializeKit(kit)));
    expect(round.ok).toBe(true);
    if (round.ok) expect(round.value).toEqual(kit);
  });

  it("rejects a wrong schema (FR-044)", () => {
    const bad = { ...defaultKit(), schema: "lab1.pattern" };
    const res = parseKit(bad);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.join()).toMatch(/schema/);
  });

  it("rejects a wrong version", () => {
    const bad = { ...defaultKit(), version: 2 };
    const res = parseKit(bad);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.join()).toMatch(/version/);
  });

  it("rejects an out-of-range value with key and range in the message", () => {
    const kit = defaultKit();
    kit.voices.BD.tune = 999; // spec is 30..80
    const res = parseKit(kit);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.join()).toMatch(/BD\.tune/);
      expect(res.errors.join()).toMatch(/\[30, 80\]/);
    }
  });

  it("rejects a non-numeric value", () => {
    const kit = defaultKit() as unknown as { voices: Record<string, Record<string, unknown>> };
    kit.voices.BD.decay = "loud";
    const res = parseKit(kit);
    expect(res.ok).toBe(false);
  });

  it("fills a missing voice with defaults", () => {
    const kit = defaultKit() as unknown as { voices: Record<string, unknown> };
    delete kit.voices.LT;
    const res = parseKit(kit);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.voices.LT).toEqual(defaultParams("LT"));
  });
});

describe("clampKit", () => {
  it("clamps out-of-range values into range", () => {
    const kit = clampKit("Clamped", {
      BD: { tune: 999, pitchAmt: 3, decay: 0.4, click: 0.3, level: 0 },
    } as never);
    expect(kit.voices.BD.tune).toBe(80); // clamped to max
  });
});

describe("parsePattern", () => {
  it("accepts a valid pattern", () => {
    const res = parsePattern({
      schema: "lab1.pattern",
      version: 1,
      name: "Basic House",
      bpm: 122,
      swing: 0,
      length: 16,
      tracks: { BD: [1, 0, 0, 0], CH: [0, 0, 1, 0] },
    });
    expect(res.ok).toBe(true);
  });

  it("rejects out-of-range bpm and swing", () => {
    const res = parsePattern({ schema: "lab1.pattern", version: 1, bpm: 400, swing: 2 });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.join()).toMatch(/bpm/);
      expect(res.errors.join()).toMatch(/swing/);
    }
  });

  it("rejects a velocity outside 0..1", () => {
    const res = parsePattern({
      schema: "lab1.pattern",
      version: 1,
      tracks: { BD: [1, 2, 0] },
    });
    expect(res.ok).toBe(false);
  });
});
