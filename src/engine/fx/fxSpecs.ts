import type { ParamSpec } from "../types";

// Declarative description of the FX rack, so the SYNTH FX UI is generated the
// same paramSpec-driven way as the drum knobs.

export type FxId = "drive" | "wah" | "delay" | "reverb";

export interface FxDef {
  id: FxId;
  label: string;
  params: ParamSpec[];
}

const hz = (v: number) => `${Math.round(v)}Hz`;
const khz = (v: number) => `${(v / 1000).toFixed(1)}k`;
const ms = (v: number) => `${Math.round(v * 1000)}ms`;
const pct = (v: number) => `${Math.round(v * 100)}%`;
const oct = (v: number) => `${v.toFixed(1)}oct`;
const x = (v: number) => `x${v.toFixed(1)}`;

const MIX: ParamSpec = { key: "mix", label: "MIX", min: 0, max: 1, default: 0.3, scale: "lin", fmt: pct };

export const FX_DEFS: FxDef[] = [
  {
    id: "drive",
    label: "DRIVE",
    params: [
      { key: "drive", label: "DRIVE", min: 1, max: 20, default: 4, scale: "log", fmt: x },
      { ...MIX, default: 1 },
    ],
  },
  {
    id: "wah",
    label: "AUTO-WAH",
    params: [
      { key: "rate", label: "RATE", min: 0.1, max: 10, default: 2, scale: "log", fmt: (v) => `${v.toFixed(1)}Hz` },
      { key: "depth", label: "DEPTH", min: 1, max: 5, default: 3, scale: "lin", fmt: oct },
      { key: "base", label: "BASE", min: 100, max: 2000, default: 400, scale: "log", fmt: hz },
      { ...MIX, default: 0.6 },
    ],
  },
  {
    id: "delay",
    label: "DELAY",
    params: [
      { key: "time", label: "TIME", min: 0.02, max: 1.0, default: 0.3, scale: "log", fmt: ms },
      { key: "feedback", label: "FBK", min: 0, max: 0.95, default: 0.35, scale: "lin", fmt: pct },
      MIX,
    ],
  },
  {
    id: "reverb",
    label: "REVERB",
    params: [
      { key: "size", label: "SIZE", min: 0, max: 0.95, default: 0.7, scale: "lin", fmt: pct },
      { key: "damp", label: "DAMP", min: 500, max: 8000, default: 3000, scale: "log", fmt: khz },
      MIX,
    ],
  },
];

/** Default param map for one effect. */
export function fxDefaults(id: FxId): Record<string, number> {
  const def = FX_DEFS.find((d) => d.id === id)!;
  const out: Record<string, number> = {};
  for (const p of def.params) out[p.key] = p.default;
  return out;
}
