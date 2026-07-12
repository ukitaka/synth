import { describe, expect, it } from "vitest";
import { PatternStore } from "../src/storage/PatternStore";
import { KitStore } from "../src/storage/KitStore";
import { MemoryStorage } from "../src/storage/StorageAdapter";
import { FACTORY_PATTERNS } from "../src/storage/factoryPatterns";
import { emptyPattern } from "../src/engine/pattern";
import { defaultParams } from "../src/engine/voiceSpecs";
import { VOICE_IDS, type KitPreset } from "../src/engine/types";

describe("PatternStore", () => {
  it("lists factory patterns first and they are immutable", async () => {
    const store = new PatternStore(new MemoryStorage());
    const list = await store.list();
    expect(list.slice(0, FACTORY_PATTERNS.length).every((i) => i.isFactory)).toBe(true);
    await expect(store.delete(`factory:${FACTORY_PATTERNS[0].name}`)).rejects.toThrow();
    await expect(store.save(FACTORY_PATTERNS[0].name, emptyPattern(), 1)).rejects.toThrow();
  });

  it("saves, loads and round-trips a user pattern (FR-055)", async () => {
    const store = new PatternStore(new MemoryStorage());
    const p = emptyPattern("Beat");
    p.tracks.BD![0] = 1;
    p.tracks.CH![2] = 1;
    const id = await store.save("Beat", p, 10);
    const loaded = await store.load(id);
    expect(loaded?.tracks.BD?.[0]).toBe(1);
    expect(loaded?.tracks.CH?.[2]).toBe(1);
  });

  it("keeps every track present after load (normalized)", async () => {
    const store = new PatternStore(new MemoryStorage());
    const loaded = await store.load(`factory:${FACTORY_PATTERNS[0].name}`);
    for (const id of VOICE_IDS) expect(loaded?.tracks[id]?.length).toBe(16);
  });
});

describe("shared index (kits + patterns)", () => {
  it("saving a pattern does not clobber saved kits", async () => {
    const storage = new MemoryStorage();
    const kits = new KitStore(storage);
    const patterns = new PatternStore(storage);

    const kit: KitPreset = {
      schema: "lab1.kit",
      version: 1,
      name: "K",
      voices: Object.fromEntries(VOICE_IDS.map((id) => [id, defaultParams(id)])) as KitPreset["voices"],
    };
    await kits.save("K", kit, 1);
    await patterns.save("P", emptyPattern("P"), 2);

    const kitList = await kits.list();
    const patList = await patterns.list();
    expect(kitList.some((i) => i.name === "K")).toBe(true);
    expect(patList.some((i) => i.name === "P")).toBe(true);
  });
});
