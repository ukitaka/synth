// Persistence abstraction (design §5, NFR-06). The app talks only to this
// interface; the concrete backend is chosen once at startup by `createStorage`.

export interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  /** Keys starting with `prefix`. */
  list(prefix: string): Promise<string[]>;
}

/** Standard Web backend: localStorage (synchronous, wrapped in promises). */
export class LocalStorage implements StorageAdapter {
  async get(key: string): Promise<string | null> {
    return window.localStorage.getItem(key);
  }
  async set(key: string, value: string): Promise<void> {
    window.localStorage.setItem(key, value);
  }
  async delete(key: string): Promise<void> {
    window.localStorage.removeItem(key);
  }
  async list(prefix: string): Promise<string[]> {
    const out: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(prefix)) out.push(k);
    }
    return out;
  }
}

/** Minimal async KV shape exposed by the Claude artifact environment. */
interface ArtifactKV {
  getItem(key: string): Promise<string>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  keys?(): Promise<string[]>;
}

/**
 * Claude artifact backend (window.storage). A missing key throws there, so we
 * normalize the throw to null and keep the upper layers branch-free (design §5).
 */
export class ArtifactStorage implements StorageAdapter {
  constructor(private readonly kv: ArtifactKV) {}

  async get(key: string): Promise<string | null> {
    try {
      const v = await this.kv.getItem(key);
      return v ?? null;
    } catch {
      return null; // missing key -> null, not an error
    }
  }
  async set(key: string, value: string): Promise<void> {
    await this.kv.setItem(key, value);
  }
  async delete(key: string): Promise<void> {
    try {
      await this.kv.removeItem(key);
    } catch {
      /* deleting a missing key is a no-op */
    }
  }
  async list(prefix: string): Promise<string[]> {
    const keys = (await this.kv.keys?.()) ?? [];
    return keys.filter((k) => k.startsWith(prefix));
  }
}

/** In-memory fallback (used in tests and when no persistent backend exists). */
export class MemoryStorage implements StorageAdapter {
  private readonly map = new Map<string, string>();
  async get(key: string): Promise<string | null> {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  async set(key: string, value: string): Promise<void> {
    this.map.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }
  async list(prefix: string): Promise<string[]> {
    return [...this.map.keys()].filter((k) => k.startsWith(prefix));
  }
}

/** Detect the environment and pick a backend (NFR-06). */
export function createStorage(): StorageAdapter {
  const w = globalThis as unknown as { storage?: ArtifactKV; localStorage?: Storage };
  if (w.storage && typeof w.storage.getItem === "function") {
    return new ArtifactStorage(w.storage);
  }
  if (typeof w.localStorage !== "undefined") {
    try {
      // Some environments expose localStorage but throw on access (privacy mode).
      const probe = "__drumlab_probe__";
      w.localStorage.setItem(probe, "1");
      w.localStorage.removeItem(probe);
      return new LocalStorage();
    } catch {
      /* fall through */
    }
  }
  return new MemoryStorage();
}
