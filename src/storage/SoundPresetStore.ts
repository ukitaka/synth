import type { IndexEntry, SoundPreset } from "../engine/types";
import { FACTORY_PRESETS, isFactoryPreset } from "../engine/factoryPresets";
import type { StorageAdapter } from "./StorageAdapter";
import { parseSound } from "./Serializer";

// Named sound-preset persistence (SOUND tab). Keys: drumlab:sound:{uuid} and a
// shared drumlab:index. Factory presets live in code and are merged at list
// time, so they can never be deleted.

const PREFIX = "drumlab:sound:";
const INDEX_KEY = "drumlab:index";

export interface PresetListItem {
  id: string; // factory presets use "factory:<name>"
  name: string;
  isFactory: boolean;
  updatedAt: number;
}

function uuid(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `s-${Date.now().toString(36)}-${(performance?.now?.() ?? 0).toString(36)}`;
}

export class SoundPresetStore {
  constructor(private readonly storage: StorageAdapter) {}

  private async readIndex(): Promise<IndexEntry[]> {
    const raw = await this.storage.get(INDEX_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as IndexEntry[]) : [];
    } catch {
      return [];
    }
  }

  private async writeIndex(entries: IndexEntry[]): Promise<void> {
    await this.storage.set(INDEX_KEY, JSON.stringify(entries)); // preserves other types
  }

  async list(): Promise<PresetListItem[]> {
    const factory: PresetListItem[] = FACTORY_PRESETS.map((p) => ({
      id: `factory:${p.name}`,
      name: p.name,
      isFactory: true,
      updatedAt: 0,
    }));
    const index = await this.readIndex();
    const user = index
      .filter((e) => e.type === "sound")
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((e) => ({ id: e.id, name: e.name, isFactory: false, updatedAt: e.updatedAt }));
    return [...factory, ...user];
  }

  async load(id: string): Promise<SoundPreset | null> {
    if (id.startsWith("factory:")) {
      const name = id.slice("factory:".length);
      const p = FACTORY_PRESETS.find((x) => x.name === name);
      return p ? structuredClone(p) : null;
    }
    const raw = await this.storage.get(PREFIX + id);
    if (!raw) return null;
    const res = parseSound(JSON.parse(raw));
    return res.ok ? res.value : null;
  }

  /** Load a preset by display name (factory or user). Used to resolve tracks. */
  async loadByName(name: string): Promise<SoundPreset | null> {
    if (isFactoryPreset(name)) return this.load(`factory:${name}`);
    const index = await this.readIndex();
    const entry = index.find((e) => e.type === "sound" && e.name === name);
    return entry ? this.load(entry.id) : null;
  }

  async save(name: string, preset: SoundPreset, now: number): Promise<string> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("preset name required");
    if (isFactoryPreset(trimmed)) throw new Error(`"${trimmed}" is a factory preset name`);

    const index = await this.readIndex();
    const existing = index.find((e) => e.type === "sound" && e.name === trimmed);
    const id = existing?.id ?? uuid();
    await this.storage.set(PREFIX + id, JSON.stringify({ ...preset, name: trimmed }));
    const entry: IndexEntry = { id, name: trimmed, type: "sound", updatedAt: now };
    const next = existing ? index.map((e) => (e.id === id ? entry : e)) : [...index, entry];
    await this.writeIndex(next);
    return id;
  }

  async delete(id: string): Promise<void> {
    if (id.startsWith("factory:")) throw new Error("factory presets cannot be deleted");
    await this.storage.delete(PREFIX + id);
    const index = await this.readIndex();
    await this.writeIndex(index.filter((e) => e.id !== id));
  }
}
