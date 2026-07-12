import type { IndexEntry, KitPreset } from "../engine/types";
import type { StorageAdapter } from "./StorageAdapter";
import { FACTORY_KITS, isFactoryKit } from "./factoryKits";
import { parseKit } from "./Serializer";

// Named kit persistence over a StorageAdapter (design §5).
// Keys: drumlab:kit:{uuid}, drumlab:index. Factory kits live in code and are
// merged in at list time, so they can never be deleted (FR-042).

const KIT_PREFIX = "drumlab:kit:";
const INDEX_KEY = "drumlab:index";

export interface KitListItem {
  id: string; // factory kits use "factory:<name>"
  name: string;
  isFactory: boolean;
  updatedAt: number;
}

function uuid(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  // Fallback without Math.random dependency: timestamp-ish unique-enough id.
  return `k-${Date.now().toString(36)}-${(performance?.now?.() ?? 0).toString(36)}`;
}

export class KitStore {
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
    await this.storage.set(INDEX_KEY, JSON.stringify(entries));
  }

  /** Factory kits first, then user kits (newest first). Reads index only. */
  async list(): Promise<KitListItem[]> {
    const factory: KitListItem[] = FACTORY_KITS.map((k) => ({
      id: `factory:${k.name}`,
      name: k.name,
      isFactory: true,
      updatedAt: 0,
    }));
    const index = await this.readIndex();
    const user = index
      .filter((e) => e.type === "kit")
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((e) => ({ id: e.id, name: e.name, isFactory: false, updatedAt: e.updatedAt }));
    return [...factory, ...user];
  }

  async load(id: string): Promise<KitPreset | null> {
    if (id.startsWith("factory:")) {
      const name = id.slice("factory:".length);
      const kit = FACTORY_KITS.find((k) => k.name === name);
      return kit ? structuredClone(kit) : null;
    }
    const raw = await this.storage.get(KIT_PREFIX + id);
    if (!raw) return null;
    const res = parseKit(JSON.parse(raw));
    return res.ok ? res.value : null;
  }

  /**
   * Save a kit under `name`. Overwrites an existing user kit with the same name;
   * otherwise creates a new one. Returns the stored id. Factory names are
   * rejected so factory kits stay immutable (FR-042).
   */
  async save(name: string, kit: KitPreset, now: number): Promise<string> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("kit name required");
    if (isFactoryKit(trimmed)) throw new Error(`"${trimmed}" is a factory kit name`);

    const index = await this.readIndex();
    const existing = index.find((e) => e.type === "kit" && e.name === trimmed);
    const id = existing?.id ?? uuid();
    const toStore: KitPreset = { ...kit, name: trimmed };

    await this.storage.set(KIT_PREFIX + id, JSON.stringify(toStore));
    const entry: IndexEntry = { id, name: trimmed, type: "kit", updatedAt: now };
    const next = existing ? index.map((e) => (e.id === id ? entry : e)) : [...index, entry];
    await this.writeIndex(next);
    return id;
  }

  async delete(id: string): Promise<void> {
    if (id.startsWith("factory:")) throw new Error("factory kits cannot be deleted");
    await this.storage.delete(KIT_PREFIX + id);
    const index = await this.readIndex();
    await this.writeIndex(index.filter((e) => e.id !== id));
  }
}
