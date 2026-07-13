import { useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import type { AudioSystem } from "../../engine/AudioSystem";
import type { FilterType, SoundPreset, SynthWaveform } from "../../engine/types";
import { SYNTH_SPECS } from "../../engine/synthSpecs";
import { FX_DEFS, fxDefaults, type FxId } from "../../engine/fx/fxSpecs";
import { Knob } from "./Knob";
import { Oscilloscope } from "./Oscilloscope";
import { PresetControls } from "./PresetControls";

// Keyboard geometry: fixed-width keys over three rendered octaves (C3..C6);
// anything wider than the column scrolls horizontally. Black keys sit centered
// on the boundary `at` white keys into their octave (none between E/F, B/C).
const WHITE_W = 44;
const KEY_GAP = 3;
const BLACK_W = 26;
const RENDER_OCTS = [3, 4, 5];
const OCT_WHITE = ["C", "D", "E", "F", "G", "A", "B"];
const OCT_BLACK = [
  { n: "C#", at: 1 },
  { n: "D#", at: 2 },
  { n: "F#", at: 4 },
  { n: "G#", at: 5 },
  { n: "A#", at: 6 },
];

const WHITE_KEYS: { note: string }[] = RENDER_OCTS.flatMap((o) =>
  OCT_WHITE.map((n) => ({ note: `${n}${o}` }))
);
WHITE_KEYS.push({ note: "C6" });

const BLACK_KEYS: { note: string; left: number }[] = RENDER_OCTS.flatMap((o, oi) =>
  OCT_BLACK.map((b) => ({
    note: `${b.n}${o}`,
    // boundary between white keys (at-1) and (at) within this octave
    left: (oi * 7 + b.at) * (WHITE_W + KEY_GAP) - KEY_GAP / 2 - BLACK_W / 2,
  }))
);

const KEYS_WIDTH = WHITE_KEYS.length * WHITE_W + (WHITE_KEYS.length - 1) * KEY_GAP;

// PC keys play the middle rendered octave (C4..C5), shifted by the OCT control.
const CODE_TO_NOTE: Record<string, string> = {
  KeyA: "C4", KeyW: "C#4", KeyS: "D4", KeyE: "D#4", KeyD: "E4", KeyF: "F4",
  KeyT: "F#4", KeyG: "G4", KeyY: "G#4", KeyH: "A4", KeyU: "A#4", KeyJ: "B4", KeyK: "C5",
};

const WAVES: SynthWaveform[] = ["sawtooth", "square", "triangle", "sine"];
const FILTERS: { id: FilterType; label: string }[] = [
  { id: "lowpass", label: "LP" }, { id: "highpass", label: "HP" }, { id: "bandpass", label: "BP" },
];
const FX_CHAIN_LABELS: Record<FxId, string> = { drive: "DRIVE", wah: "WAH", delay: "DELAY", reverb: "REV" };

interface Props {
  system: AudioSystem;
  active: boolean;
}

/** SOUND tab: 3 columns — presets (left), scope+keyboard (center), controls (right). */
export function SoundPanel({ system, active }: Props) {
  const s = system.sound;
  const [wave, setWave] = useState<SynthWaveform>(s.getWaveform());
  const [filterType, setFilterTypeState] = useState<FilterType>(s.getFilterType());
  const [octave, setOctave] = useState(0);
  const [params, setParams] = useState<Record<string, number>>(() => s.getParams());
  const [fxOn, setFxOn] = useState<Record<FxId, boolean>>({ drive: false, wah: false, delay: false, reverb: false });
  const [fxParams, setFxParams] = useState<Record<FxId, Record<string, number>>>(() => ({
    drive: fxDefaults("drive"), wah: fxDefaults("wah"), delay: fxDefaults("delay"), reverb: fxDefaults("reverb"),
  }));
  const held = useRef<Set<string>>(new Set());
  const keyboardRef = useRef<HTMLDivElement>(null);

  // Start the key strip centered on the middle octave when it overflows.
  useEffect(() => {
    const el = keyboardRef.current;
    if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, []);

  const freqOf = (note: string) => Tone.Frequency(note).transpose(octave * 12).toFrequency();
  const noteOn = (note: string) => s.noteOn(freqOf(note));
  const noteOff = () => s.noteOff();

  const setParam = (key: string, value: number) => {
    s.setParam(key, value);
    setParams((p) => ({ ...p, [key]: value }));
  };
  const chooseWave = (w: SynthWaveform) => { s.setWaveform(w); setWave(w); };
  const chooseFilter = (t: FilterType) => { s.setFilterType(t); setFilterTypeState(t); };
  const toggleFx = (id: FxId) => {
    const next = !fxOn[id];
    s.setFxEnabled(id, next);
    setFxOn((st) => ({ ...st, [id]: next }));
  };
  const setFxParam = (id: FxId, key: string, value: number) => {
    s.setFxParam(id, key, value);
    setFxParams((st) => ({ ...st, [id]: { ...st[id], [key]: value } }));
  };

  const applyPreset = (preset: SoundPreset) => {
    s.loadPreset(preset);
    setWave(preset.waveform);
    setFilterTypeState(preset.filterType);
    setParams(s.getParams());
    const on = {} as Record<FxId, boolean>;
    const fp = {} as Record<FxId, Record<string, number>>;
    for (const def of FX_DEFS) {
      on[def.id] = !!preset.fx[def.id]?.on;
      fp[def.id] = { ...fxDefaults(def.id), ...preset.fx[def.id]?.params };
    }
    setFxOn(on);
    setFxParams(fp);
  };

  useEffect(() => {
    if (!active) return;
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT") return;
      if (e.repeat) return;
      if (e.code === "KeyZ") return setOctave((o) => Math.max(-3, o - 1));
      if (e.code === "KeyX") return setOctave((o) => Math.min(3, o + 1));
      const note = CODE_TO_NOTE[e.code];
      if (!note) return;
      held.current.add(note);
      noteOn(note);
    };
    const up = (e: KeyboardEvent) => {
      const note = CODE_TO_NOTE[e.code];
      if (!note) return;
      held.current.delete(note);
      if (held.current.size === 0) noteOff();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, octave]);

  return (
    <div className="sound-tab">
      <PresetControls store={system.presets} getCurrent={(name) => s.toPreset(name)} onApply={applyPreset} />

      <div className="sound-center">
        <Oscilloscope master={system.master} running={active} sub="MASTER · PRE-CLIP" />
        <div className="center-controls">
          <div className="select-row">
            <span className="select-group">
              <span className="select-label">OSC WAVE</span>
              {WAVES.map((w) => (
                <button key={w} type="button" className={`chip${wave === w ? " on" : ""}`} onClick={() => chooseWave(w)}>{w}</button>
              ))}
            </span>
            <span className="select-group">
              <span className="select-label">FILTER</span>
              {FILTERS.map((f) => (
                <button key={f.id} type="button" className={`chip${filterType === f.id ? " on" : ""}`} onClick={() => chooseFilter(f.id)}>{f.label}</button>
              ))}
            </span>
          </div>
          <div className="knob-row">
            {SYNTH_SPECS.map((spec) => (
              <Knob key={spec.key} spec={spec} value={params[spec.key]} onChange={(v) => setParam(spec.key, v)} />
            ))}
          </div>
        </div>
        <div className="octave">
          <span>OCTAVE</span>
          <button type="button" onClick={() => setOctave((o) => Math.max(-3, o - 1))}>−</button>
          <span className="octave-val">{octave >= 0 ? `+${octave}` : octave}</span>
          <button type="button" onClick={() => setOctave((o) => Math.min(3, o + 1))}>＋</button>
          <span className="octave-hint">Z / X</span>
        </div>
        <div className="keyboard" ref={keyboardRef}>
          <div className="keys-scroll" style={{ width: KEYS_WIDTH }}>
            <div className="keys-white">
              {WHITE_KEYS.map((k) => (
                <button
                  key={k.note}
                  type="button"
                  className="pkey"
                  style={{ touchAction: "none" }}
                  onPointerDown={(e) => { e.preventDefault(); noteOn(k.note); }}
                  onPointerUp={noteOff}
                  onPointerLeave={(e) => { if (e.buttons) noteOff(); }}
                >
                  <span className="pkey-label">{k.note}</span>
                </button>
              ))}
            </div>
            <div className="keys-black">
              {BLACK_KEYS.map((k) => (
                <button
                  key={k.note}
                  type="button"
                  className="pkey sharp"
                  style={{ touchAction: "none", left: k.left }}
                  onPointerDown={(e) => { e.preventDefault(); noteOn(k.note); }}
                  onPointerUp={noteOff}
                  onPointerLeave={(e) => { if (e.buttons) noteOff(); }}
                >
                  <span className="pkey-label">{k.note}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="keyboard-hint">A W S E D F T G Y H U J K</div>
      </div>

      <div className="sound-controls">
        <div className="fx-section">
          <div className="fx-chain">
            <span className="select-label">FX CHAIN</span>
            <span className="fx-chain-seg">IN</span>
            {FX_DEFS.map((def) => (
              <span key={def.id} className="fx-chain-seg-wrap">
                <span className="fx-chain-arrow">›</span>
                <span className={`fx-chain-seg${fxOn[def.id] ? " on" : ""}`}>{FX_CHAIN_LABELS[def.id]}</span>
              </span>
            ))}
            <span className="fx-chain-arrow">›</span>
            <span className="fx-chain-seg">OUT</span>
          </div>
          <div className="fx-rack">
            {FX_DEFS.map((def) => (
              <div key={def.id} className={`fx-unit${fxOn[def.id] ? " on" : ""}`}>
                <button type="button" className="fx-title" onClick={() => toggleFx(def.id)}>
                  <span className={`fx-led${fxOn[def.id] ? " on" : ""}`} />
                  <span className="fx-name">{def.label}</span>
                  <span className="fx-state">{fxOn[def.id] ? "ON" : "OFF"}</span>
                </button>
                <div className="knob-row">
                  {def.params.map((spec) => (
                    <Knob key={spec.key} spec={spec} size="sm" value={fxParams[def.id][spec.key]} onChange={(v) => setFxParam(def.id, spec.key, v)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
