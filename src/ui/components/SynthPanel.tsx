import { useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import type { AudioSystem } from "../../engine/AudioSystem";
import type { ParamSpec } from "../../engine/types";
import type { SynthParams } from "../../engine/SynthEngine";
import { Knob } from "./Knob";

const hz = (v: number) => `${Math.round(v)}Hz`;
const sec = (v: number) => `${(v * 1000).toFixed(0)}ms`;

const SPECS: Record<"cutoff" | "resonance" | "attack" | "release", ParamSpec> = {
  cutoff: { key: "cutoff", label: "CUTOFF", min: 80, max: 12000, default: 1200, scale: "log", fmt: hz },
  resonance: { key: "resonance", label: "RESO", min: 0.5, max: 20, default: 4, scale: "log", fmt: (v) => `Q${v.toFixed(1)}` },
  attack: { key: "attack", label: "ATTACK", min: 0.001, max: 1, default: 0.01, scale: "log", fmt: sec },
  release: { key: "release", label: "RELEASE", min: 0.02, max: 2, default: 0.4, scale: "log", fmt: sec },
};

// One octave, mapped to the home row for PC playing.
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

interface Props {
  system: AudioSystem;
  active: boolean;
}

/** Minimal SYNTH-mode UI. Enough to prove mode coexistence (FR-010..012). */
export function SynthPanel({ system, active }: Props) {
  const [p, setP] = useState<SynthParams>(() => system.synth.getParams());
  const held = useRef<Set<string>>(new Set());

  const set = <K extends keyof SynthParams>(key: K, value: SynthParams[K]) => {
    system.synth.setParam(key, value);
    setP((prev) => ({ ...prev, [key]: value }));
  };

  const noteOn = (note: string) => system.synth.noteOn(Tone.Frequency(note).toFrequency());
  const noteOff = () => system.synth.noteOff();

  useEffect(() => {
    if (!active) return;
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const k = KEYS.find((x) => x.code === e.code);
      if (!k) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT") return;
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
  }, [active]);

  return (
    <div className="synth-panel">
      <div className="wave-row">
        {(["sawtooth", "square", "triangle", "sine"] as const).map((w) => (
          <button
            key={w}
            type="button"
            className={`wave-btn${p.waveform === w ? " on" : ""}`}
            onClick={() => set("waveform", w)}
          >
            {w}
          </button>
        ))}
      </div>
      <div className="knob-row">
        <Knob spec={SPECS.cutoff} value={p.cutoff} onChange={(v) => set("cutoff", v)} />
        <Knob spec={SPECS.resonance} value={p.resonance} onChange={(v) => set("resonance", v)} />
        <Knob spec={SPECS.attack} value={p.attack} onChange={(v) => set("attack", v)} />
        <Knob spec={SPECS.release} value={p.release} onChange={(v) => set("release", v)} />
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
    </div>
  );
}
