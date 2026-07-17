import { useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import type { AudioSystem } from "../../engine/AudioSystem";
import type { FilterType, SoundPreset, SynthWaveform } from "../../engine/types";
import { SYNTH_SPECS } from "../../engine/synthSpecs";
import { FX_DEFS, fxDefaults, type FxId } from "../../engine/fx/fxSpecs";
import { Knob } from "./Knob";
import { Oscilloscope } from "./Oscilloscope";
import { SpectrumScope } from "./SpectrumScope";
import { EnvScope } from "./EnvScope";
import { PresetControls } from "./PresetControls";

// Keyboard geometry: fixed-width keys over five rendered octaves (C2..C7);
// anything wider than the column scrolls horizontally. Black keys sit centered
// on the boundary `at` white keys into their octave (none between E/F, B/C).
const WHITE_W = 44;
const KEY_GAP = 3;
const BLACK_W = 26;
const RENDER_OCTS = [2, 3, 4, 5, 6];
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
WHITE_KEYS.push({ note: "C7" });

const BLACK_KEYS: { note: string; left: number }[] = RENDER_OCTS.flatMap((o, oi) =>
  OCT_BLACK.map((b) => ({
    note: `${b.n}${o}`,
    // boundary between white keys (at-1) and (at) within this octave
    left: (oi * 7 + b.at) * (WHITE_W + KEY_GAP) - KEY_GAP / 2 - BLACK_W / 2,
  }))
);

const KEYS_WIDTH = WHITE_KEYS.length * WHITE_W + (WHITE_KEYS.length - 1) * KEY_GAP;

// PC keys play the middle rendered octave (C4..C5).
const CODE_TO_NOTE: Record<string, string> = {
  KeyA: "C4", KeyW: "C#4", KeyS: "D4", KeyE: "D#4", KeyD: "E4", KeyF: "F4",
  KeyT: "F#4", KeyG: "G4", KeyY: "G#4", KeyH: "A4", KeyU: "A#4", KeyJ: "B4", KeyK: "C5",
};

const WAVES: SynthWaveform[] = ["sawtooth", "square", "triangle", "sine"];
const FILTERS: { id: FilterType; label: string }[] = [
  { id: "lowpass", label: "LP" }, { id: "highpass", label: "HP" }, { id: "bandpass", label: "BP" },
];
const FILTER_LABEL: Record<FilterType, string> = { lowpass: "LP", highpass: "HP", bandpass: "BP", off: "—" };

// Voice-panel sections in signal order (Elektron-style pages). The knob specs
// are the same SYNTH_SPECS, split by which stage of the path they belong to.
type VoiceTab = "osc" | "filter" | "fx";
const VOICE_TAB_KEY = "lab1:ui:voiceTab"; // view state only (replaces lab1:ui:fxOpen)
const OSC_KEYS = ["pitchAmt", "pitchTime", "noise", "attack", "decay", "sustain", "release"];
const OSC_SPECS = SYNTH_SPECS.filter((s) => OSC_KEYS.includes(s.key));
const FILTER_SPECS = SYNTH_SPECS.filter((s) => ["cutoff", "reso", "filterEnv"].includes(s.key));

// Repeat rates in seconds (musical labels assume 120 BPM).
const REPEAT_RATES = [
  { label: "1/4", s: 0.5 },
  { label: "1/8", s: 0.25 },
  { label: "1/16", s: 0.125 },
];

interface Props {
  system: AudioSystem;
  active: boolean;
}

/**
 * SOUND tab, v2 layout (docs/sound-layout-brief.md): presets (left) | main.
 * Main = voice panel with signal-order tabs (OSC | FILTER | FX) + always-on
 * monitor stack (scope + spectrum), and a full-width keyboard below with the
 * REPEAT dock at its left edge (hardware ARP position).
 */
export function SoundPanel({ system, active }: Props) {
  const s = system.sound;
  const [wave, setWave] = useState<SynthWaveform>(s.getWaveform());
  const [filterType, setFilterTypeState] = useState<FilterType>(s.getFilterType());
  const [params, setParams] = useState<Record<string, number>>(() => s.getParams());
  const [fxOn, setFxOn] = useState<Record<FxId, boolean>>({ drive: false, wah: false, delay: false, reverb: false });
  const [fxParams, setFxParams] = useState<Record<FxId, Record<string, number>>>(() => ({
    drive: fxDefaults("drive"), wah: fxDefaults("wah"), delay: fxDefaults("delay"), reverb: fxDefaults("reverb"),
  }));
  const [voiceTab, setVoiceTab] = useState<VoiceTab>(() => {
    try {
      const v = window.localStorage.getItem(VOICE_TAB_KEY);
      return v === "filter" || v === "fx" ? v : "osc";
    } catch {
      return "osc";
    }
  });
  // Which effect the FX page is editing (sub-tab; scales with FX_DEFS).
  const [fxSel, setFxSel] = useState<FxId>("drive");
  const [repeating, setRepeating] = useState(false);
  const [repeatRate, setRepeatRate] = useState(0.25);
  const [lastNote, setLastNote] = useState("C4");
  const held = useRef<Set<string>>(new Set());
  const keyboardRef = useRef<HTMLDivElement>(null);

  const chooseTab = (t: VoiceTab) => {
    setVoiceTab(t);
    try {
      window.localStorage.setItem(VOICE_TAB_KEY, t);
    } catch {
      /* view state only */
    }
  };

  // Start the key strip centered on the middle octave when it overflows.
  useEffect(() => {
    const el = keyboardRef.current;
    if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, []);

  const noteOn = (note: string) => {
    const freq = Tone.Frequency(note).toFrequency();
    setLastNote(note);
    if (s.isRepeating()) s.setRepeatFreq(freq); // repeat follows the last key
    s.noteOn(freq);
  };
  const noteOff = () => s.noteOff();

  const toggleRepeat = () => {
    if (repeating) {
      s.stopRepeat();
      setRepeating(false);
    } else {
      s.startRepeat(Tone.Frequency(lastNote).toFrequency(), repeatRate);
      setRepeating(true);
    }
  };
  const chooseRate = (sec: number) => {
    setRepeatRate(sec);
    if (repeating) s.startRepeat(Tone.Frequency(lastNote).toFrequency(), sec);
  };

  // Leaving the tab stops the repeat (AudioSystem also stops the engine side).
  useEffect(() => {
    if (!active && repeating) setRepeating(false);
  }, [active, repeating]);

  const setParam = (key: string, value: number) => {
    s.setParam(key, value);
    setParams((p) => ({ ...p, [key]: value }));
  };
  const chooseWave = (w: SynthWaveform) => { s.setWaveform(w); setWave(w); };
  // Clicking the lit filter chip again turns the filter off (bypass); no lit
  // chip = off. There is no dedicated OFF button.
  const chooseFilter = (t: FilterType) => {
    const next: FilterType = filterType === t ? "off" : t;
    s.setFilterType(next);
    setFilterTypeState(next);
  };
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
  }, [active]);

  const anyFxOn = FX_DEFS.some((d) => fxOn[d.id]);

  return (
    <div className="sound-tab">
      <PresetControls store={system.presets} getCurrent={(name) => s.toPreset(name)} onApply={applyPreset} />

      <div className="sound-main">
        {/* Monitor rack: the three displays are peers, side by side on top —
            eyes up (monitors), hands below (panel, then keys). */}
        <div className="monitor-row">
          <Oscilloscope master={system.master} running={active} sub="MASTER · PRE-CLIP" />
          <SpectrumScope sound={s} running={active} />
          <EnvScope params={params} />
        </div>

        <div className="voice-panel">
            <div className="vtabs">
              <button type="button" className={`vtab${voiceTab === "osc" ? " on" : ""}`} onClick={() => chooseTab("osc")}>
                OSC
              </button>
              <button type="button" className={`vtab${voiceTab === "filter" ? " on" : ""}`} onClick={() => chooseTab("filter")}>
                FILTER <span className="vtab-status">{FILTER_LABEL[filterType]}</span>
              </button>
              <button type="button" className={`vtab${voiceTab === "fx" ? " on" : ""}`} onClick={() => chooseTab("fx")}>
                FX
                <span className="vtab-leds">
                  {FX_DEFS.map((def) => (
                    <span key={def.id} className={`vtab-led${fxOn[def.id] ? " on" : ""}`} />
                  ))}
                </span>
              </button>
              <span className="vchain" aria-hidden="true">
                <span className="vchain-seg">IN</span>
                <span className="vchain-arrow">›</span>
                <span className="vchain-seg on">OSC</span>
                <span className="vchain-arrow">›</span>
                <span className={`vchain-seg${filterType !== "off" ? " on" : ""}`}>FILTER</span>
                <span className="vchain-arrow">›</span>
                <span className={`vchain-seg${anyFxOn ? " on" : ""}`}>FX</span>
                <span className="vchain-arrow">›</span>
                <span className="vchain-seg">OUT</span>
              </span>
            </div>

            {/* All three pages stay mounted, stacked in one grid cell; only
                the active one is visible. The panel is always as tall as the
                tallest page, so switching tabs never reflows the layout. */}
            <div className="vtab-pages">
              <div className={`vtab-page${voiceTab === "osc" ? " on" : ""}`}>
                <div className="select-row">
                  <span className="select-group">
                    <span className="select-label">WAVE</span>
                    {WAVES.map((w) => (
                      <button key={w} type="button" className={`chip${wave === w ? " on" : ""}`} onClick={() => chooseWave(w)}>{w}</button>
                    ))}
                  </span>
                </div>
                <div className="knob-row">
                  {OSC_SPECS.map((spec) => (
                    <Knob key={spec.key} spec={spec} value={params[spec.key]} onChange={(v) => setParam(spec.key, v)} />
                  ))}
                </div>
              </div>

              <div className={`vtab-page${voiceTab === "filter" ? " on" : ""}`}>
                <div className="select-row">
                  <span className="select-group">
                    {FILTERS.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        className={`chip${filterType === f.id ? " on" : ""}`}
                        aria-pressed={filterType === f.id}
                        onClick={() => chooseFilter(f.id)}
                      >
                        {f.label}
                      </button>
                    ))}
                  </span>
                </div>
                <div className="knob-row">
                  {FILTER_SPECS.map((spec) => (
                    <Knob key={spec.key} spec={spec} value={params[spec.key]} onChange={(v) => setParam(spec.key, v)} />
                  ))}
                </div>
              </div>

              <div className={`vtab-page${voiceTab === "fx" ? " on" : ""}`}>
                {/* The signal chain doubles as the sub-tab bar: IN › units › OUT.
                    Adding an effect to FX_DEFS grows this row automatically. */}
                <div className="fx-nav">
                  <span className="vchain-seg">IN</span>
                  {FX_DEFS.map((def) => (
                    <span key={def.id} className="fx-nav-step">
                      <span className="vchain-arrow">›</span>
                      <button
                        type="button"
                        className={`chip fx-navchip${fxSel === def.id ? " on" : ""}`}
                        onClick={() => setFxSel(def.id)}
                      >
                        <span className={`vtab-led${fxOn[def.id] ? " on" : ""}`} />
                        {def.label}
                      </button>
                    </span>
                  ))}
                  <span className="vchain-arrow">›</span>
                  <span className="vchain-seg">OUT</span>
                </div>
                {FX_DEFS.filter((def) => def.id === fxSel).map((def) => (
                  <div key={def.id} className={`fx-edit${fxOn[def.id] ? "" : " off"}`}>
                    <button type="button" className={`fx-power${fxOn[def.id] ? " on" : ""}`} onClick={() => toggleFx(def.id)}>
                      <span className={`fx-led${fxOn[def.id] ? " on" : ""}`} />
                      <span className="fx-name">{def.label}</span>
                      <span className="fx-state">{fxOn[def.id] ? "ON" : "OFF"}</span>
                    </button>
                    <div className="knob-row">
                      {def.params.map((spec) => (
                        <Knob key={spec.key} spec={spec} value={fxParams[def.id][spec.key]} onChange={(v) => setFxParam(def.id, spec.key, v)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

        </div>

        <div className="key-row">
          <div className="repeat-dock">
            <button
              type="button"
              className={`repeat-btn${repeating ? " on" : ""}`}
              aria-pressed={repeating}
              onClick={toggleRepeat}
            >
              ⟳ REPEAT
            </button>
            <div className="repeat-rates">
              {REPEAT_RATES.map((r) => (
                <button
                  key={r.label}
                  type="button"
                  className={`chip${repeatRate === r.s ? " on" : ""}`}
                  onClick={() => chooseRate(r.s)}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div className="repeat-note">{lastNote}</div>
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
        </div>
        <div className="keyboard-hint">A W S E D F T G Y H U J K　·　C2–C7 HORIZONTAL SCROLL</div>
      </div>
    </div>
  );
}
