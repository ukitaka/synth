import type { IndexEntry, Pattern } from "../engine/types";
import { normalizePattern } from "../engine/pattern";
import type { StorageAdapter } from "./StorageAdapter";
import { FACTORY_PATTERNS, isFactoryPattern } from "./factoryPatterns";
import { parsePattern } from "./Serializer";

// Named pattern persistence (design §5, FR-055). Same shape as KitStore and the
// same shared `drumlab:index`; patterns are independent data (FR-056).

const PATTERN_PREFIX = "drumlab:pattern:";
const INDEX_KEY = "drumlab:index";

export interface PatternListItem {
  id: string; // factory patterns use "factory:<name>"
  name: string;
  isFactory: boolean;
  updatedAt: number;
}

function uuid(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `p-${Date.now().toString(36)}-${(performance?.now?.() ?? 0).toString(36)}`;
}

export class PatternStore {
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
    // Preserve entries of other types (kits) — we read/modify/write the whole list.
    await this.storage.set(INDEX_KEY, JSON.stringify(entries));
  }

  async list(): Promise<PatternListItem[]> {
    const factory: PatternListItem[] = FACTORY_PATTERNS.map((p) => ({
      id: `factory:${p.name}`,
      name: p.name,
      isFactory: true,
      updatedAt: 0,
    }));
    const index = await this.readIndex();
    const user = index
      .filter((e) => e.type === "pattern")
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((e) => ({ id: e.id, name: e.name, isFactory: false, updatedAt: e.updatedAt }));
    return [...factory, ...user];
  }

  async load(id: string): Promise<Pattern | null> {
    if (id.startsWith("factory:")) {
      const name = id.slice("factory:".length);
      const p = FACTORY_PATTERNS.find((x) => x.name === name);
      return p ? normalizePattern(structuredClone(p)) : null;
    }
    const raw = await this.storage.get(PATTERN_PREFIX + id);
    if (!raw) return null;
    const res = parsePattern(JSON.parse(raw));
    return res.ok ? normalizePattern(res.value) : null;
  }

  async save(name: string, pattern: Pattern, now: number): Promise<string> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("pattern name required");
    if (isFactoryPattern(trimmed)) throw new Error(`"${trimmed}" is a factory pattern name`);

    const index = await this.readIndex();
    const existing = index.find((e) => e.type === "pattern" && e.name === trimmed);
    const id = existing?.id ?? uuid();
    const toStore: Pattern = { ...pattern, name: trimmed };

    await this.storage.set(PATTERN_PREFIX + id, JSON.stringify(toStore));
    const entry: IndexEntry = { id, name: trimmed, type: "pattern", updatedAt: now };
    const next = existing ? index.map((e) => (e.id === id ? entry : e)) : [...index, entry];
    await this.writeIndex(next);
    return id;
  }

  async delete(id: string): Promise<void> {
    if (id.startsWith("factory:")) throw new Error("factory patterns cannot be deleted");
    await this.storage.delete(PATTERN_PREFIX + id);
    const index = await this.readIndex();
    await this.writeIndex(index.filter((e) => e.id !== id));
  }
}
