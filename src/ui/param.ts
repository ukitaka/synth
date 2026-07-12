import type { ParamSpec } from "../engine/types";

// Map a parameter value <-> a 0..1 knob position, honoring the spec's scale.
// Log-scaled params always have min > 0 (see voiceSpecs), so the log math is safe.

export function toNorm(value: number, spec: ParamSpec): number {
  const v = Math.min(spec.max, Math.max(spec.min, value));
  if (spec.scale === "log") {
    return (Math.log(v) - Math.log(spec.min)) / (Math.log(spec.max) - Math.log(spec.min));
  }
  return (v - spec.min) / (spec.max - spec.min);
}

export function fromNorm(norm: number, spec: ParamSpec): number {
  const n = Math.min(1, Math.max(0, norm));
  if (spec.scale === "log") {
    return Math.exp(Math.log(spec.min) + n * (Math.log(spec.max) - Math.log(spec.min)));
  }
  return spec.min + n * (spec.max - spec.min);
}
