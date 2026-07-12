import { useEffect, useRef, useState } from "react";
import type { KitPreset } from "../../engine/types";
import type { KitStore, KitListItem } from "../../storage/KitStore";
import { parseKit, serializeKit } from "../../storage/Serializer";

interface Props {
  store: KitStore;
  /** Build a kit snapshot of the current engine params under `name`. */
  getCurrentKit: (name: string) => KitPreset;
  /** Apply a loaded/imported kit to the engine. */
  onApplyKit: (kit: KitPreset) => void;
}

/**
 * KIT bar: load / save / export / import / delete (FR-041..044, design §4).
 * Factory kits are listed but cannot be overwritten or deleted (FR-042).
 */
export function KitControls({ store, getCurrentKit, onApplyKit }: Props) {
  const [items, setItems] = useState<KitListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [name, setName] = useState("My Kit");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = async (keepId?: string) => {
    const list = await store.list();
    setItems(list);
    if (keepId && list.some((i) => i.id === keepId)) setSelectedId(keepId);
    else if (!list.some((i) => i.id === selectedId)) setSelectedId(list[0]?.id ?? "");
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = items.find((i) => i.id === selectedId);

  const handleLoad = async (id: string) => {
    setSelectedId(id);
    setError(null);
    const kit = await store.load(id);
    if (kit) {
      onApplyKit(kit);
      setName(kit.name);
    }
  };

  const handleSave = async () => {
    setError(null);
    try {
      await store.save(name, getCurrentKit(name), Date.now());
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleDelete = async () => {
    if (!selected || selected.isFactory) return;
    setError(null);
    await store.delete(selected.id);
    await refresh();
  };

  const handleExport = () => {
    setError(null);
    const kit = getCurrentKit(name);
    const blob = new Blob([serializeKit(kit)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/\s+/g, "_")}.kit.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (file: File) => {
    setError(null);
    try {
      const parsed = parseKit(JSON.parse(await file.text()));
      if (!parsed.ok) {
        setError(`Import failed: ${parsed.errors.join("; ")}`);
        return;
      }
      onApplyKit(parsed.value);
      setName(parsed.value.name);
    } catch {
      setError("Import failed: not valid JSON");
    }
  };

  return (
    <div className="kit-bar">
      <span className="kit-label">KIT</span>
      <select value={selectedId} onChange={(e) => handleLoad(e.target.value)}>
        {items.map((i) => (
          <option key={i.id} value={i.id}>
            {i.isFactory ? `★ ${i.name}` : i.name}
          </option>
        ))}
      </select>
      <input
        className="kit-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-label="kit name"
        placeholder="kit name"
      />
      <button type="button" onClick={handleSave}>保存</button>
      <button type="button" onClick={handleExport}>書出</button>
      <button type="button" onClick={() => fileRef.current?.click()}>読込</button>
      <button type="button" onClick={handleDelete} disabled={!selected || selected.isFactory}>削除</button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleImportFile(f);
          e.target.value = "";
        }}
      />
      {error && <div className="kit-error">{error}</div>}
    </div>
  );
}
