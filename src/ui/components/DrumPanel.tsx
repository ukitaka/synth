import { useCallback, useEffect, useRef, useState } from "react";
import type { AudioSystem } from "../../engine/AudioSystem";
import { VOICE_IDS, type KitPreset, type VoiceId } from "../../engine/types";
import { VOICE_SPECS } from "../../engine/voiceSpecs";
import { Pad } from "./Pad";
import { Knob } from "./Knob";
import { KitControls } from "./KitControls";
import { SequencerPanel } from "./SequencerPanel";

// PC keyboard mapping (design §4): Z X C V B N = BD SD CH OH CP LT.
const KEY_CAPS: Record<VoiceId, string> = { BD: "Z", SD: "X", CH: "C", OH: "V", CP: "B", LT: "N" };
const CODE_TO_VOICE: Record<string, VoiceId> = {
  KeyZ: "BD", KeyX: "SD", KeyC: "CH", KeyV: "OH", KeyB: "CP", KeyN: "LT",
};

const FLASH_MS = 110;

interface Props {
  system: AudioSystem;
  active: boolean; // this panel is the visible mode
}

export function DrumPanel({ system, active }: Props) {
  const [selected, setSelected] = useState<VoiceId>("BD");
  const [showSeq, setShowSeq] = useState(false);
  const [lit, setLit] = useState<Record<string, boolean>>({});
  // Mirror of engine params so knobs re-render on edit / kit load.
  const [params, setParams] = useState<Record<VoiceId, Record<string, number>>>(() => {
    const p = {} as Record<VoiceId, Record<string, number>>;
    for (const id of VOICE_IDS) p[id] = system.drum.voices[id].getParams();
    return p;
  });
  const flashTimers = useRef<Record<string, number>>({});

  const flash = useCallback((id: VoiceId) => {
    setLit((l) => ({ ...l, [id]: true }));
    window.clearTimeout(flashTimers.current[id]);
    flashTimers.current[id] = window.setTimeout(
      () => setLit((l) => ({ ...l, [id]: false })),
      FLASH_MS
    );
  }, []);

  const hit = useCallback(
    (id: VoiceId, select = true) => {
      system.drum.trigger(id);
      if (select) setSelected(id);
      flash(id);
    },
    [system, flash]
  );

  // PC keyboard playing (FR-031). Ignore key auto-repeat so holding a key
  // doesn't machine-gun the voice.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const id = CODE_TO_VOICE[e.code];
      if (!id) return;
      // don't hijack typing in the kit name field
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      e.preventDefault();
      hit(id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, hit]);

  const setParam = (id: VoiceId, key: string, value: number) => {
    system.drum.setParam(id, key, value);
    setParams((p) => ({ ...p, [id]: { ...p[id], [key]: value } }));
  };

  const syncFromEngine = () => {
    const p = {} as Record<VoiceId, Record<string, number>>;
    for (const id of VOICE_IDS) p[id] = system.drum.voices[id].getParams();
    setParams(p);
  };

  const applyKit = (kit: KitPreset) => {
    system.drum.loadKit(kit);
    syncFromEngine();
  };

  return (
    <div className="drum-panel">
      <KitControls
        store={system.kits}
        getCurrentKit={(name) => system.drum.toKitJSON(name)}
        onApplyKit={applyKit}
      />

      <div className="voice-editor">
        <div className="voice-title">選択ボイス: {selected}</div>
        <div className="knob-row">
          {VOICE_SPECS[selected].map((spec) => (
            <Knob
              key={spec.key}
              spec={spec}
              value={params[selected][spec.key]}
              onChange={(v) => setParam(selected, spec.key, v)}
            />
          ))}
        </div>
      </div>

      <div className="pad-grid">
        {VOICE_IDS.map((id) => (
          <Pad
            key={id}
            id={id}
            keyCap={KEY_CAPS[id]}
            selected={selected === id}
            active={!!lit[id]}
            onDown={hit}
          />
        ))}
      </div>

      <button
        type="button"
        className={`seq-toggle${showSeq ? " on" : ""}`}
        onClick={() => setShowSeq((s) => !s)}
      >
        {showSeq ? "▲ シーケンサーを閉じる" : "▼ シーケンサー"}
      </button>
      {showSeq && <SequencerPanel system={system} active={active && showSeq} />}
    </div>
  );
}
