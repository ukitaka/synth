import { useEffect, useRef, useState } from "react";
import type { Pattern } from "../../engine/types";
import type { PatternStore, PatternListItem } from "../../storage/PatternStore";
import { parsePattern, serializePattern } from "../../storage/Serializer";
import { normalizePattern } from "../../engine/pattern";

interface Props {
  store: PatternStore;
  getCurrent: () => Pattern;
  onApply: (pattern: Pattern) => void;
}

/** PATTERN bar: load / save / export / import / delete (FR-055). */
export function PatternControls({ store, getCurrent, onApply }: Props) {
  const [items, setItems] = useState<PatternListItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("My Pattern");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = async () => setItems(await store.list());
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = items.find((i) => i.id === selectedId);

  const handleLoad = async (id: string) => {
    setSelectedId(id);
    setError(null);
    const p = await store.load(id);
    if (p) {
      onApply(p);
      setName(p.name);
    }
  };

  const handleSave = async () => {
    setError(null);
    try {
      await store.save(name, getCurrent(), Date.now());
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleDelete = async () => {
    if (!selected || selected.isFactory) return;
    await store.delete(selected.id);
    setSelectedId("");
    await refresh();
  };

  const handleExport = () => {
    const blob = new Blob([serializePattern(getCurrent())], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/\s+/g, "_")}.pattern.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file: File) => {
    setError(null);
    try {
      const parsed = parsePattern(JSON.parse(await file.text()));
      if (!parsed.ok) {
        setError(`Import failed: ${parsed.errors.join("; ")}`);
        return;
      }
      onApply(normalizePattern(parsed.value));
      setName(parsed.value.name);
    } catch {
      setError("Import failed: not valid JSON");
    }
  };

  return (
    <div className="kit-bar">
      <span className="kit-label">PTN</span>
      <select value={selectedId} onChange={(e) => handleLoad(e.target.value)}>
        <option value="">—</option>
        {items.map((i) => (
          <option key={i.id} value={i.id}>
            {i.isFactory ? `★ ${i.name}` : i.name}
          </option>
        ))}
      </select>
      <input className="kit-name" value={name} onChange={(e) => setName(e.target.value)} aria-label="pattern name" placeholder="NAME…" />
      <button type="button" onClick={handleSave}>SAVE</button>
      <button type="button" onClick={handleExport}>EXPORT</button>
      <button type="button" onClick={() => fileRef.current?.click()}>IMPORT</button>
      <button type="button" onClick={handleDelete} disabled={!selected || selected.isFactory}>DELETE</button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleImport(f);
          e.target.value = "";
        }}
      />
      {error && <div className="kit-error">{error}</div>}
    </div>
  );
}
