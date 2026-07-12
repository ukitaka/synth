import { SYNTH_SPECS } from "../engine/synthSpecs";
import { FX_DEFS } from "../engine/fx/fxSpecs";
import { blankPreset } from "../engine/preset";
import type { FilterType, Pattern, PatternTrack, SoundPreset, SynthWaveform } from "../engine/types";

// JSON I/O with schema + range validation. Rejections carry a human-readable
// reason (which key, which allowed range) so the UI can show why import failed.

export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const SWING_MAX = 0.75;
const BPM_MIN = 40;
const BPM_MAX = 220;
const WAVES: SynthWaveform[] = ["sawtooth", "square", "triangle", "sine"];
const FILTERS: FilterType[] = ["lowpass", "highpass", "bandpass"];

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Validate one sound preset, collecting errors into `errors`. Returns a value even on error. */
function readSound(input: unknown, errors: string[], where: string): SoundPreset {
  const preset = blankPreset("Imported Sound");
  if (!isObject(input)) {
    errors.push(`${where} must be an object`);
    return preset;
  }
  if (input.schema !== "lab1.sound") errors.push(`${where}.schema must be "lab1.sound"`);
  if (input.version !== 1) errors.push(`${where}.version must be 1`);
  if (typeof input.name === "string" && input.name.trim()) preset.name = input.name;
  if (WAVES.includes(input.waveform as SynthWaveform)) preset.waveform = input.waveform as SynthWaveform;
  else if (input.waveform !== undefined) errors.push(`${where}.waveform invalid`);
  if (FILTERS.includes(input.filterType as FilterType)) preset.filterType = input.filterType as FilterType;
  else if (input.filterType !== undefined) errors.push(`${where}.filterType invalid`);

  const params = isObject(input.params) ? input.params : {};
  for (const spec of SYNTH_SPECS) {
    const v = params[spec.key];
    if (v === undefined) continue;
    if (typeof v !== "number" || !Number.isFinite(v)) errors.push(`${where}.params.${spec.key} must be a number`);
    else if (v < spec.min || v > spec.max) errors.push(`${where}.params.${spec.key}=${v} out of [${spec.min}, ${spec.max}]`);
    else preset.params[spec.key] = v;
  }

  const fxIn = isObject(input.fx) ? input.fx : {};
  for (const def of FX_DEFS) {
    const st = fxIn[def.id];
    if (!isObject(st)) continue;
    preset.fx[def.id].on = !!st.on;
    const p = isObject(st.params) ? st.params : {};
    for (const spec of def.params) {
      const v = p[spec.key];
      if (v === undefined) continue;
      if (typeof v !== "number" || !Number.isFinite(v)) errors.push(`${where}.fx.${def.id}.${spec.key} must be a number`);
      else if (v < spec.min || v > spec.max) errors.push(`${where}.fx.${def.id}.${spec.key}=${v} out of [${spec.min}, ${spec.max}]`);
      else preset.fx[def.id].params[spec.key] = v;
    }
  }
  return preset;
}

export function parseSound(input: unknown): ParseResult<SoundPreset> {
  const errors: string[] = [];
  const value = readSound(input, errors, "sound");
  return errors.length ? { ok: false, errors } : { ok: true, value };
}

export function parsePattern(input: unknown): ParseResult<Pattern> {
  const errors: string[] = [];
  if (!isObject(input)) return { ok: false, errors: ["root must be a JSON object"] };
  if (input.schema !== "lab1.pattern") errors.push(`schema must be "lab1.pattern"`);
  if (input.version !== 2) errors.push(`version must be 2`);

  const name = typeof input.name === "string" && input.name.trim() ? input.name : "Imported Pattern";
  const length = typeof input.length === "number" ? input.length : 16;

  let bpm = 122;
  if (typeof input.bpm === "number") {
    if (input.bpm < BPM_MIN || input.bpm > BPM_MAX) errors.push(`bpm=${input.bpm} out of [${BPM_MIN}, ${BPM_MAX}]`);
    else bpm = input.bpm;
  }
  let swing = 0;
  if (typeof input.swing === "number") {
    if (input.swing < 0 || input.swing > SWING_MAX) errors.push(`swing=${input.swing} out of [0, ${SWING_MAX}]`);
    else swing = input.swing;
  }

  const tracks: PatternTrack[] = [];
  if (!Array.isArray(input.tracks)) {
    errors.push("tracks must be an array");
  } else {
    input.tracks.forEach((t, i) => {
      if (!isObject(t)) {
        errors.push(`tracks[${i}] must be an object`);
        return;
      }
      const preset = readSound(t.preset, errors, `tracks[${i}].preset`);
      const note = typeof t.note === "number" && Number.isFinite(t.note) ? t.note : 220;
      const steps: number[] = [];
      if (Array.isArray(t.steps)) {
        t.steps.forEach((s, j) => {
          if (typeof s !== "number" || s < 0 || s > 1) errors.push(`tracks[${i}].steps[${j}] must be 0..1`);
          else steps[j] = s;
        });
      }
      tracks.push({
        preset,
        note,
        chokeGroup: typeof t.chokeGroup === "string" ? t.chokeGroup : undefined,
        mute: !!t.mute,
        steps: Array.from({ length }, (_, j) => steps[j] ?? 0),
      });
    });
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { schema: "lab1.pattern", version: 2, name, bpm, swing, length, tracks } };
}

export function serializeSound(p: SoundPreset): string {
  return JSON.stringify(p, null, 2);
}
export function serializePattern(p: Pattern): string {
  return JSON.stringify(p, null, 2);
}
