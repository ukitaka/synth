import * as Tone from "tone";
import { KickVoice } from "./KickVoice";
import { LT_SPECS } from "../voiceSpecs";

/**
 * LT — low tom (design §3.5). Same circuit as the kick, but with a higher
 * fundamental and a shallower pitch drop, and no click knob. Reuses KickVoice's
 * whole graph; only defaults and paramSpecs differ.
 */
export class TomVoice extends KickVoice {
  constructor(bus: Tone.Gain) {
    super(bus, { id: "LT", specs: LT_SPECS });
  }
}
