import { blankPreset } from "./preset";
import type { FilterType, SoundPreset, SynthWaveform } from "./types";

// 808-style drum sounds re-created with the mono synth, plus a couple of
// melodic sounds. Factory presets are code constants (never stored), so they
// are naturally undeletable. Each carries a suggested trigger note used when it
// is placed on a PATTERN track.

interface Recipe {
  name: string;
  note: number; // suggested trigger frequency (Hz)
  waveform?: SynthWaveform;
  filterType?: FilterType;
  params?: Partial<Record<string, number>>;
  choke?: string;
}

function make(r: Recipe): SoundPreset {
  const p = blankPreset(r.name);
  if (r.waveform) p.waveform = r.waveform;
  if (r.filterType) p.filterType = r.filterType;
  if (r.params) for (const [k, v] of Object.entries(r.params)) p.params[k] = v as number;
  return p;
}

const RECIPES: Recipe[] = [
  {
    name: "Kick", note: 55, waveform: "sine", filterType: "lowpass",
    params: { pitchAmt: 6, pitchTime: 0.05, noise: 0, cutoff: 8000, attack: 0.002, decay: 0.35, sustain: 0, release: 0.05 },
  },
  {
    name: "Tom", note: 110, waveform: "sine", filterType: "lowpass",
    params: { pitchAmt: 2, pitchTime: 0.08, noise: 0, cutoff: 6000, attack: 0.002, decay: 0.35, sustain: 0, release: 0.05 },
  },
  {
    name: "Snare", note: 200, waveform: "triangle", filterType: "bandpass",
    params: { pitchAmt: 1.4, pitchTime: 0.03, noise: 0.6, cutoff: 1800, reso: 3, attack: 0.001, decay: 0.18, sustain: 0, release: 0.05 },
  },
  {
    name: "Closed Hat", note: 300, waveform: "square", filterType: "highpass", choke: "hat",
    params: { noise: 1, cutoff: 8000, reso: 1, attack: 0.001, decay: 0.045, sustain: 0, release: 0.01 },
  },
  {
    name: "Open Hat", note: 300, waveform: "square", filterType: "highpass", choke: "hat",
    params: { noise: 1, cutoff: 8000, reso: 1, attack: 0.001, decay: 0.4, sustain: 0, release: 0.05 },
  },
  {
    name: "Clap", note: 300, waveform: "sawtooth", filterType: "bandpass",
    params: { noise: 1, cutoff: 1200, reso: 2, attack: 0.001, decay: 0.2, sustain: 0, release: 0.05 },
  },
  {
    name: "Zap", note: 220, waveform: "sine", filterType: "lowpass",
    params: { pitchAmt: 8, pitchTime: 0.15, noise: 0, cutoff: 9000, attack: 0.002, decay: 0.25, sustain: 0, release: 0.05 },
  },
  {
    name: "Bass", note: 55, waveform: "sawtooth", filterType: "lowpass",
    params: { pitchAmt: 1, noise: 0, cutoff: 800, reso: 4, filterEnv: 2, attack: 0.005, decay: 0.25, sustain: 0.7, release: 0.2 },
  },
];

export const FACTORY_PRESETS: readonly SoundPreset[] = RECIPES.map(make);

/** Suggested trigger note (Hz) and choke group for a factory preset, when placed on a track. */
export const FACTORY_META: Record<string, { note: number; choke?: string }> = Object.fromEntries(
  RECIPES.map((r) => [r.name, { note: r.note, choke: r.choke }])
);

/** Names used to seed a fresh pattern (a familiar starter kit). */
export const STARTER_KIT = ["Kick", "Snare", "Closed Hat", "Open Hat", "Clap", "Tom"];

export function isFactoryPreset(name: string): boolean {
  return FACTORY_PRESETS.some((p) => p.name === name);
}
