import { useEffect, useRef, useState } from "react";
import type { SoundPreset } from "../../engine/types";
import type { SoundPresetStore, PresetListItem } from "../../storage/SoundPresetStore";
import { parseSound, serializeSound } from "../../storage/Serializer";

interface Props {
  store: SoundPresetStore;
  /** Snapshot the current SOUND design under `name`. */
  getCurrent: (name: string) => SoundPreset;
  /** Apply a loaded/imported preset to the SOUND engine + UI. */
  onApply: (preset: SoundPreset) => void;
}

/**
 * Left column of the SOUND tab: save / load / delete / export / import the
 * sounds you design. Factory presets are listed but immutable.
 */
export function PresetControls({ store, getCurrent, onApply }: Props) {
  const [items, setItems] = useState<PresetListItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("My Sound");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = async () => setItems(await store.list());
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = items.find((i) => i.id === selectedId);

  const load = async (id: string) => {
    setSelectedId(id);
    setError(null);
    const p = await store.load(id);
    if (p) {
      onApply(p);
      setName(p.name);
    }
  };

  const save = async () => {
    setError(null);
    try {
      await store.save(name, getCurrent(name), Date.now());
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const del = async () => {
    if (!selected || selected.isFactory) return;
    await store.delete(selected.id);
    setSelectedId("");
    await refresh();
  };

  const exportJson = () => {
    const blob = new Blob([serializeSound(getCurrent(name))], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/\s+/g, "_")}.sound.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importFile = async (file: File) => {
    setError(null);
    try {
      const res = parseSound(JSON.parse(await file.text()));
      if (!res.ok) {
        setError(`Import failed: ${res.errors.join("; ")}`);
        return;
      }
      onApply(res.value);
      setName(res.value.name);
    } catch {
      setError("Import failed: not valid JSON");
    }
  };

  return (
    <div className="preset-col">
      <div className="preset-save">
        <input value={name} onChange={(e) => setName(e.target.value)} aria-label="preset name" placeholder="name" />
        <button type="button" onClick={save}>保存</button>
      </div>
      <div className="preset-list">
        {items.map((i) => (
          <button
            key={i.id}
            type="button"
            className={`preset-item${selectedId === i.id ? " sel" : ""}`}
            onClick={() => load(i.id)}
          >
            {i.isFactory ? `★ ${i.name}` : i.name}
          </button>
        ))}
      </div>
      <div className="preset-actions">
        <button type="button" onClick={exportJson}>書出</button>
        <button type="button" onClick={() => fileRef.current?.click()}>読込</button>
        <button type="button" onClick={del} disabled={!selected || selected.isFactory}>削除</button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importFile(f);
          e.target.value = "";
        }}
      />
      {error && <div className="kit-error">{error}</div>}
    </div>
  );
}
