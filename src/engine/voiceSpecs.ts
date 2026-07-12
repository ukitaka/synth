import type { ParamSpec, VoiceId } from "./types";

// Single source of truth for every editable parameter (design §3, §4).
// Deliberately Tone-free so the UI, the serializer/validator (FR-044) and the
// offline tests can all read it without pulling in Web Audio.

const hz = (v: number) => `${Math.round(v)}Hz`;
const khz = (v: number) => `${(v / 1000).toFixed(1)}k`;
const sec = (v: number) => `${(v * 1000).toFixed(0)}ms`;
const ms = (v: number) => `${Math.round(v)}ms`;
const db = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}dB`;
const ratio = (v: number) => `x${v.toFixed(1)}`;
const mult = (v: number) => `x${v.toFixed(2)}`;
const pct = (v: number) => `${Math.round(v * 100)}%`;

const LEVEL: ParamSpec = { key: "level", label: "LEVEL", min: -24, max: 6, default: 0, scale: "lin", fmt: db };

export const BD_SPECS: ParamSpec[] = [
  { key: "tune", label: "TUNE", min: 30, max: 80, default: 50, scale: "lin", fmt: hz },
  { key: "pitchAmt", label: "PITCH", min: 1.5, max: 6, default: 3, scale: "lin", fmt: ratio },
  { key: "decay", label: "DECAY", min: 0.1, max: 1.5, default: 0.4, scale: "log", fmt: sec },
  { key: "click", label: "CLICK", min: 0, max: 1, default: 0.3, scale: "lin", fmt: pct },
  LEVEL,
];

export const SD_SPECS: ParamSpec[] = [
  { key: "tune", label: "TUNE", min: 120, max: 280, default: 185, scale: "lin", fmt: hz },
  { key: "snappy", label: "SNAPPY", min: 0, max: 1, default: 0.5, scale: "lin", fmt: pct },
  { key: "decay", label: "DECAY", min: 0.05, max: 0.5, default: 0.18, scale: "log", fmt: sec },
  LEVEL,
];

const hatSpecs = (decayDefault: number): ParamSpec[] => [
  { key: "decay", label: "DECAY", min: 0.02, max: 1.2, default: decayDefault, scale: "log", fmt: sec },
  { key: "tone", label: "TONE", min: 3000, max: 10000, default: 7000, scale: "log", fmt: khz },
  { key: "tune", label: "TUNE", min: 0.8, max: 1.3, default: 1.0, scale: "lin", fmt: mult },
  LEVEL,
];

export const CH_SPECS = hatSpecs(0.04);
export const OH_SPECS = hatSpecs(0.5);

export const CP_SPECS: ParamSpec[] = [
  { key: "decay", label: "DECAY", min: 0.1, max: 0.8, default: 0.3, scale: "log", fmt: sec },
  { key: "tone", label: "TONE", min: 600, max: 2000, default: 1100, scale: "log", fmt: hz },
  { key: "spread", label: "SPREAD", min: 5, max: 20, default: 10, scale: "lin", fmt: ms },
  LEVEL,
];

export const LT_SPECS: ParamSpec[] = [
  { key: "tune", label: "TUNE", min: 60, max: 200, default: 95, scale: "lin", fmt: hz },
  { key: "pitchAmt", label: "PITCH", min: 1.2, max: 3, default: 1.6, scale: "lin", fmt: ratio },
  { key: "decay", label: "DECAY", min: 0.1, max: 1.0, default: 0.35, scale: "log", fmt: sec },
  LEVEL,
];

export const VOICE_SPECS: Record<VoiceId, ParamSpec[]> = {
  BD: BD_SPECS,
  SD: SD_SPECS,
  CH: CH_SPECS,
  OH: OH_SPECS,
  CP: CP_SPECS,
  LT: LT_SPECS,
};

/** Default parameter map for one voice, built from its specs. */
export function defaultParams(id: VoiceId): Record<string, number> {
  const out: Record<string, number> = {};
  for (const spec of VOICE_SPECS[id]) out[spec.key] = spec.default;
  return out;
}
