import { describe, expect, it } from "vitest";
import { KitStore } from "../src/storage/KitStore";
import { MemoryStorage } from "../src/storage/StorageAdapter";
import { FACTORY_KITS } from "../src/storage/factoryKits";
import { defaultParams } from "../src/engine/voiceSpecs";
import { VOICE_IDS, type KitPreset } from "../src/engine/types";

function kit(name: string): KitPreset {
  const voices = {} as KitPreset["voices"];
  for (const id of VOICE_IDS) voices[id] = defaultParams(id);
  return { schema: "lab1.kit", version: 1, name, voices };
}

describe("KitStore", () => {
  it("lists factory kits first and they are immutable (FR-042)", async () => {
    const store = new KitStore(new MemoryStorage());
    const list = await store.list();
    expect(list.slice(0, FACTORY_KITS.length).every((i) => i.isFactory)).toBe(true);

    await expect(store.delete(`factory:${FACTORY_KITS[0].name}`)).rejects.toThrow();
    await expect(store.save(FACTORY_KITS[0].name, kit(FACTORY_KITS[0].name), 1)).rejects.toThrow();
  });

  it("saves, loads and round-trips a user kit (FR-041)", async () => {
    const store = new KitStore(new MemoryStorage());
    const k = kit("Mine");
    k.voices.BD.tune = 60;
    const id = await store.save("Mine", k, 100);
    const loaded = await store.load(id);
    expect(loaded?.voices.BD.tune).toBe(60);
  });

  it("overwrites an existing kit of the same name instead of duplicating", async () => {
    const store = new KitStore(new MemoryStorage());
    const id1 = await store.save("Same", kit("Same"), 1);
    const id2 = await store.save("Same", kit("Same"), 2);
    expect(id1).toBe(id2);
    const list = await store.list();
    expect(list.filter((i) => i.name === "Same").length).toBe(1);
  });

  it("deletes a user kit", async () => {
    const store = new KitStore(new MemoryStorage());
    const id = await store.save("Temp", kit("Temp"), 1);
    await store.delete(id);
    expect(await store.load(id)).toBeNull();
  });

  it("loads a factory kit by id", async () => {
    const store = new KitStore(new MemoryStorage());
    const loaded = await store.load(`factory:${FACTORY_KITS[0].name}`);
    expect(loaded?.name).toBe(FACTORY_KITS[0].name);
  });
});
