import { useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import type { AudioSystem } from "../../engine/AudioSystem";
import { SYNTH_SPECS, type SynthWaveform } from "../../engine/synthSpecs";
import { FX_DEFS, fxDefaults, type FxId } from "../../engine/fx/fxSpecs";
import { Knob } from "./Knob";

// One octave of keys mapped to the home row for PC playing.
const KEYS: { note: string; code: string; sharp: boolean }[] = [
  { note: "C4", code: "KeyA", sharp: false },
  { note: "C#4", code: "KeyW", sharp: true },
  { note: "D4", code: "KeyS", sharp: false },
  { note: "D#4", code: "KeyE", sharp: true },
  { note: "E4", code: "KeyD", sharp: false },
  { note: "F4", code: "KeyF", sharp: false },
  { note: "F#4", code: "KeyT", sharp: true },
  { note: "G4", code: "KeyG", sharp: false },
  { note: "G#4", code: "KeyY", sharp: true },
  { note: "A4", code: "KeyH", sharp: false },
  { note: "A#4", code: "KeyU", sharp: true },
  { note: "B4", code: "KeyJ", sharp: false },
  { note: "C5", code: "KeyK", sharp: false },
];

const WAVES: SynthWaveform[] = ["sawtooth", "square", "triangle", "sine"];

interface Props {
  system: AudioSystem;
  active: boolean;
}

/** SYNTH-mode UI: octave, drum-capable synth knobs, and the SYNTH-only FX rack. */
export function SynthPanel({ system, active }: Props) {
  const synth = system.synth;
  const [wave, setWave] = useState<SynthWaveform>(synth.getWaveform());
  const [octave, setOctave] = useState(0); // semitone-octave offset from base
  const [params, setParams] = useState<Record<string, number>>(() => synth.getParams());
  const [fxOn, setFxOn] = useState<Record<FxId, boolean>>({ drive: false, wah: false, delay: false, reverb: false });
  const [fxParams, setFxParams] = useState<Record<FxId, Record<string, number>>>(() => ({
    drive: fxDefaults("drive"),
    wah: fxDefaults("wah"),
    delay: fxDefaults("delay"),
    reverb: fxDefaults("reverb"),
  }));
  const held = useRef<Set<string>>(new Set());

  const freqOf = (note: string) => Tone.Frequency(note).transpose(octave * 12).toFrequency();
  const noteOn = (note: string) => synth.noteOn(freqOf(note));
  const noteOff = () => synth.noteOff();

  const setParam = (key: string, value: number) => {
    synth.setParam(key, value);
    setParams((p) => ({ ...p, [key]: value }));
  };
  const chooseWave = (w: SynthWaveform) => {
    synth.setWaveform(w);
    setWave(w);
  };
  const toggleFx = (id: FxId) => {
    const next = !fxOn[id];
    synth.setFxEnabled(id, next);
    setFxOn((s) => ({ ...s, [id]: next }));
  };
  const setFxParam = (id: FxId, key: string, value: number) => {
    synth.setFxParam(id, key, value);
    setFxParams((s) => ({ ...s, [id]: { ...s[id], [key]: value } }));
  };

  // PC keyboard: notes on the home row, z / x shift the octave.
  useEffect(() => {
    if (!active) return;
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT") return;
      if (e.repeat) return;
      if (e.code === "KeyZ") return setOctave((o) => Math.max(-3, o - 1));
      if (e.code === "KeyX") return setOctave((o) => Math.min(3, o + 1));
      const k = KEYS.find((x) => x.code === e.code);
      if (!k) return;
      held.current.add(k.note);
      noteOn(k.note);
    };
    const up = (e: KeyboardEvent) => {
      const k = KEYS.find((x) => x.code === e.code);
      if (!k) return;
      held.current.delete(k.note);
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
    <div className="synth-panel">
      <div className="synth-head">
        <div className="wave-row">
          {WAVES.map((w) => (
            <button key={w} type="button" className={`wave-btn${wave === w ? " on" : ""}`} onClick={() => chooseWave(w)}>
              {w}
            </button>
          ))}
        </div>
        <div className="octave">
          <span>OCT</span>
          <button type="button" onClick={() => setOctave((o) => Math.max(-3, o - 1))}>−</button>
          <span className="octave-val">{octave >= 0 ? `+${octave}` : octave}</span>
          <button type="button" onClick={() => setOctave((o) => Math.min(3, o + 1))}>+</button>
        </div>
      </div>

      <div className="knob-row">
        {SYNTH_SPECS.map((spec) => (
          <Knob key={spec.key} spec={spec} value={params[spec.key]} onChange={(v) => setParam(spec.key, v)} />
        ))}
      </div>

      <div className="keyboard">
        {KEYS.map((k) => (
          <button
            key={k.note}
            type="button"
            className={`pkey${k.sharp ? " sharp" : ""}`}
            style={{ touchAction: "none" }}
            onPointerDown={(e) => {
              e.preventDefault();
              noteOn(k.note);
            }}
            onPointerUp={noteOff}
            onPointerLeave={(e) => {
              if (e.buttons) noteOff();
            }}
          >
            {k.note}
          </button>
        ))}
      </div>

      <div className="fx-rack">
        {FX_DEFS.map((def) => (
          <div key={def.id} className={`fx-unit${fxOn[def.id] ? " on" : ""}`}>
            <button type="button" className="fx-title" onClick={() => toggleFx(def.id)}>
              <span className={`fx-led${fxOn[def.id] ? " on" : ""}`} />
              {def.label}
            </button>
            <div className="knob-row">
              {def.params.map((spec) => (
                <Knob
                  key={spec.key}
                  spec={spec}
                  value={fxParams[def.id][spec.key]}
                  onChange={(v) => setFxParam(def.id, spec.key, v)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
