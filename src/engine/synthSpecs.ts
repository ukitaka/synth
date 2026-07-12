import type { ParamSpec } from "./types";

// Params for the SYNTH-mode mono synth. Same paramSpec shape as the drum voices
// so the UI knobs are generated the same way. Pitch envelope + noise + filter
// envelope are what let you sculpt drum sounds by hand (kick/tom/snare/zap).

const hz = (v: number) => `${Math.round(v)}Hz`;
const ms = (v: number) => `${Math.round(v * 1000)}ms`;
const pct = (v: number) => `${Math.round(v * 100)}%`;
const oct = (v: number) => (v <= 0 ? "off" : `${v.toFixed(1)}oct`);
const x = (v: number) => `x${v.toFixed(1)}`;

export type SynthWaveform = "sawtooth" | "square" | "triangle" | "sine";

export const SYNTH_SPECS: ParamSpec[] = [
  // pitch envelope — set to x1 for melodic play, raise for a drum "thump"
  { key: "pitchAmt", label: "P.AMT", min: 1, max: 8, default: 1, scale: "lin", fmt: x },
  { key: "pitchTime", label: "P.TIME", min: 0.005, max: 0.5, default: 0.04, scale: "log", fmt: ms },
  // source mix
  { key: "noise", label: "NOISE", min: 0, max: 1, default: 0, scale: "lin", fmt: pct },
  // filter
  { key: "cutoff", label: "CUTOFF", min: 80, max: 12000, default: 4000, scale: "log", fmt: hz },
  { key: "reso", label: "RESO", min: 0.5, max: 20, default: 2, scale: "log", fmt: (v) => `Q${v.toFixed(1)}` },
  { key: "filterEnv", label: "F.ENV", min: 0, max: 4, default: 0, scale: "lin", fmt: oct },
  // amp envelope (sustain 0 + short decay = one-shot drum; sustain>0 = held note)
  { key: "attack", label: "ATTACK", min: 0.001, max: 1, default: 0.005, scale: "log", fmt: ms },
  { key: "decay", label: "DECAY", min: 0.005, max: 2, default: 0.2, scale: "log", fmt: ms },
  { key: "sustain", label: "SUSTAIN", min: 0, max: 1, default: 0.6, scale: "lin", fmt: pct },
  { key: "release", label: "RELEASE", min: 0.005, max: 2, default: 0.3, scale: "log", fmt: ms },
];

export function synthDefaults(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of SYNTH_SPECS) out[s.key] = s.default;
  return out;
}
