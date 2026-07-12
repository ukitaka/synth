import { describe, expect, it } from "vitest";
import { SoundPresetStore } from "../src/storage/SoundPresetStore";
import { PatternStore } from "../src/storage/PatternStore";
import { MemoryStorage } from "../src/storage/StorageAdapter";
import { FACTORY_PRESETS } from "../src/engine/factoryPresets";
import { FACTORY_PATTERNS } from "../src/storage/factoryPatterns";
import { blankPreset } from "../src/engine/preset";
import { emptyPattern } from "../src/engine/pattern";

describe("SoundPresetStore", () => {
  it("lists factory presets first and they are immutable", async () => {
    const store = new SoundPresetStore(new MemoryStorage());
    const list = await store.list();
    expect(list.slice(0, FACTORY_PRESETS.length).every((i) => i.isFactory)).toBe(true);
    await expect(store.delete(`factory:${FACTORY_PRESETS[0].name}`)).rejects.toThrow();
    await expect(store.save(FACTORY_PRESETS[0].name, blankPreset(FACTORY_PRESETS[0].name), 1)).rejects.toThrow();
  });

  it("saves, loads and overwrites a user preset", async () => {
    const store = new SoundPresetStore(new MemoryStorage());
    const p = blankPreset("Mine");
    p.params.cutoff = 2000;
    const id1 = await store.save("Mine", p, 1);
    const id2 = await store.save("Mine", p, 2);
    expect(id1).toBe(id2); // same name overwrites
    const loaded = await store.load(id1);
    expect(loaded?.params.cutoff).toBe(2000);
  });

  it("loads a factory preset by name", async () => {
    const store = new SoundPresetStore(new MemoryStorage());
    const p = await store.loadByName("Kick");
    expect(p?.name).toBe("Kick");
    expect(p?.waveform).toBe("sine");
  });
});

describe("PatternStore + shared index", () => {
  it("lists factory patterns and keeps them immutable", async () => {
    const store = new PatternStore(new MemoryStorage());
    const list = await store.list();
    expect(list.slice(0, FACTORY_PATTERNS.length).every((i) => i.isFactory)).toBe(true);
    await expect(store.delete(`factory:${FACTORY_PATTERNS[0].name}`)).rejects.toThrow();
  });

  it("saving a pattern does not clobber saved presets (shared index)", async () => {
    const storage = new MemoryStorage();
    const presets = new SoundPresetStore(storage);
    const patterns = new PatternStore(storage);
    await presets.save("P1", blankPreset("P1"), 1);
    await patterns.save("Beat", emptyPattern("Beat"), 2);
    expect((await presets.list()).some((i) => i.name === "P1")).toBe(true);
    expect((await patterns.list()).some((i) => i.name === "Beat")).toBe(true);
  });

  it("round-trips a user pattern with embedded presets", async () => {
    const store = new PatternStore(new MemoryStorage());
    const p = emptyPattern("Groove");
    p.tracks[0].steps[4] = 1;
    const id = await store.save("Groove", p, 1);
    const loaded = await store.load(id);
    expect(loaded?.tracks[0].steps[4]).toBe(1);
    expect(loaded?.tracks[0].preset.name).toBe(p.tracks[0].preset.name);
  });
});
