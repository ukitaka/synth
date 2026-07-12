import type { KitPreset } from "../engine/types";
import { defaultParams } from "../engine/voiceSpecs";

// Factory kits are code constants, never written to storage, which makes them
// naturally undeletable (FR-042, design §5). At least two are required.

/** All-defaults kit — the classic 808 voicing from design §6.1. */
const KIT_808: KitPreset = {
  schema: "lab1.kit",
  version: 1,
  name: "808 Classic",
  voices: {
    BD: defaultParams("BD"),
    SD: defaultParams("SD"),
    CH: defaultParams("CH"),
    OH: defaultParams("OH"),
    CP: defaultParams("CP"),
    LT: defaultParams("LT"),
  },
};

/** Punchier techno voicing: tighter kick, drier snare, shorter hats. */
const KIT_TECHNO: KitPreset = {
  schema: "lab1.kit",
  version: 1,
  name: "Techno",
  voices: {
    BD: { tune: 45, pitchAmt: 4, decay: 0.28, click: 0.6, level: 2 },
    SD: { tune: 200, snappy: 0.7, decay: 0.12, level: -1 },
    CH: { decay: 0.03, tone: 8500, tune: 1.1, level: -2 },
    OH: { decay: 0.32, tone: 8500, tune: 1.1, level: -3 },
    CP: { decay: 0.22, tone: 1300, spread: 8, level: -1 },
    LT: { tune: 110, pitchAmt: 1.8, decay: 0.28, level: -1 },
  },
};

export const FACTORY_KITS: readonly KitPreset[] = [KIT_808, KIT_TECHNO];

export function isFactoryKit(name: string): boolean {
  return FACTORY_KITS.some((k) => k.name === name);
}
