import { VOICE_IDS, type KitPreset, type Pattern, type VoiceId } from "../engine/types";
import { VOICE_SPECS, defaultParams } from "../engine/voiceSpecs";

// JSON I/O with schema + range validation (FR-043, FR-044, design §6).
// Rejections carry a human-readable reason (which key, which allowed range) so
// the UI can show exactly why an import failed.

export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const SWING_MAX = 0.75;
const BPM_MIN = 40;
const BPM_MAX = 220;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Parse + validate a kit preset. Out-of-range values are rejected (FR-044). */
export function parseKit(input: unknown): ParseResult<KitPreset> {
  const errors: string[] = [];
  if (!isObject(input)) return { ok: false, errors: ["root must be a JSON object"] };
  if (input.schema !== "lab1.kit") errors.push(`schema must be "lab1.kit" (got ${JSON.stringify(input.schema)})`);
  if (input.version !== 1) errors.push(`version must be 1 (got ${JSON.stringify(input.version)})`);

  const name = typeof input.name === "string" && input.name.trim() ? input.name : "Imported Kit";
  const voicesIn = isObject(input.voices) ? input.voices : undefined;
  if (!voicesIn) errors.push("voices must be an object");

  const voices = {} as KitPreset["voices"];
  if (voicesIn) {
    for (const id of VOICE_IDS) {
      const raw = voicesIn[id];
      // Missing voice -> defaults (forward/backward compatible).
      const params = defaultParams(id);
      if (raw !== undefined && !isObject(raw)) {
        errors.push(`voices.${id} must be an object`);
      } else if (isObject(raw)) {
        for (const spec of VOICE_SPECS[id]) {
          const v = raw[spec.key];
          if (v === undefined) continue; // fall back to default
          if (typeof v !== "number" || !Number.isFinite(v)) {
            errors.push(`voices.${id}.${spec.key} must be a finite number (got ${JSON.stringify(v)})`);
          } else if (v < spec.min || v > spec.max) {
            errors.push(`voices.${id}.${spec.key}=${v} out of range [${spec.min}, ${spec.max}]`);
          } else {
            params[spec.key] = v;
          }
        }
      }
      voices[id] = params;
    }
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { schema: "lab1.kit", version: 1, name, voices } };
}

/** Clamp any kit-shaped params into range (lenient, for internal use). */
export function clampKit(name: string, voicesIn: Record<VoiceId, Record<string, number>>): KitPreset {
  const voices = {} as KitPreset["voices"];
  for (const id of VOICE_IDS) {
    const params = defaultParams(id);
    for (const spec of VOICE_SPECS[id]) {
      const v = voicesIn[id]?.[spec.key];
      if (typeof v === "number" && Number.isFinite(v)) {
        params[spec.key] = Math.min(spec.max, Math.max(spec.min, v));
      }
    }
    voices[id] = params;
  }
  return { schema: "lab1.kit", version: 1, name, voices };
}

/** Parse + validate a Phase-2 pattern (design §6.2). */
export function parsePattern(input: unknown): ParseResult<Pattern> {
  const errors: string[] = [];
  if (!isObject(input)) return { ok: false, errors: ["root must be a JSON object"] };
  if (input.schema !== "lab1.pattern") errors.push(`schema must be "lab1.pattern"`);
  if (input.version !== 1) errors.push(`version must be 1`);

  const name = typeof input.name === "string" && input.name.trim() ? input.name : "Imported Pattern";
  const length = typeof input.length === "number" ? input.length : 16;

  let bpm = 122;
  if (typeof input.bpm === "number") {
    if (input.bpm < BPM_MIN || input.bpm > BPM_MAX) errors.push(`bpm=${input.bpm} out of range [${BPM_MIN}, ${BPM_MAX}]`);
    else bpm = input.bpm;
  }

  let swing = 0;
  if (typeof input.swing === "number") {
    if (input.swing < 0 || input.swing > SWING_MAX) errors.push(`swing=${input.swing} out of range [0, ${SWING_MAX}]`);
    else swing = input.swing;
  }

  const tracks: Pattern["tracks"] = {};
  if (input.tracks !== undefined) {
    if (!isObject(input.tracks)) {
      errors.push("tracks must be an object");
    } else {
      for (const [id, steps] of Object.entries(input.tracks)) {
        if (!VOICE_IDS.includes(id as VoiceId)) {
          errors.push(`tracks.${id} is not a known voice`);
          continue;
        }
        if (!Array.isArray(steps)) {
          errors.push(`tracks.${id} must be an array`);
          continue;
        }
        const arr: number[] = [];
        steps.forEach((s, i) => {
          if (typeof s !== "number" || s < 0 || s > 1) {
            errors.push(`tracks.${id}[${i}]=${JSON.stringify(s)} must be a velocity 0..1`);
          } else {
            arr[i] = s;
          }
        });
        tracks[id as VoiceId] = arr;
      }
    }
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { schema: "lab1.pattern", version: 1, name, bpm, swing, length, tracks } };
}

/** Pretty JSON for export (FR-043). */
export function serializeKit(kit: KitPreset): string {
  return JSON.stringify(kit, null, 2);
}

export function serializePattern(pattern: Pattern): string {
  return JSON.stringify(pattern, null, 2);
}
