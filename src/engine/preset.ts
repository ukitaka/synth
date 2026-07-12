import { synthDefaults } from "./synthSpecs";
import { FX_DEFS, fxDefaults } from "./fx/fxSpecs";
import type { SoundPreset } from "./types";

// Tone-free preset helpers so the serializer/validator and tests can build
// presets without pulling in Web Audio.

/** A blank sound with default synth params and all FX off. */
export function blankPreset(name: string): SoundPreset {
  const fx = {} as SoundPreset["fx"];
  for (const def of FX_DEFS) fx[def.id] = { on: false, params: fxDefaults(def.id) };
  return {
    schema: "lab1.sound",
    version: 1,
    name,
    waveform: "sawtooth",
    filterType: "lowpass",
    params: synthDefaults(),
    fx,
  };
}
