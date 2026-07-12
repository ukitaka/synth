import * as Tone from "tone";
import type { DrumVoice } from "./DrumVoice";
import { KickVoice } from "./voices/KickVoice";
import { SnareVoice } from "./voices/SnareVoice";
import { HatVoice } from "./voices/HatVoice";
import { ClapVoice } from "./voices/ClapVoice";
import { TomVoice } from "./voices/TomVoice";
import { CH_SPECS, OH_SPECS } from "./voiceSpecs";
import { chokeTargets } from "./chokeGroups";
import { VOICE_IDS, type KitPreset, type VoiceId } from "./types";

/**
 * Holds the six drum voices and routes triggers (design §2). All voices connect
 * to the shared MasterBus, so the oscilloscope works in DRUM mode too (FR-012).
 *
 * `trigger` takes an explicit `time` (default `Tone.now()`), so pad playing and
 * the Phase-2 sequencer share the exact same entry point (design §7).
 */
export class DrumEngine {
  readonly voices: Record<VoiceId, DrumVoice>;

  constructor(bus: Tone.Gain) {
    this.voices = {
      BD: new KickVoice(bus),
      SD: new SnareVoice(bus),
      CH: new HatVoice(bus, "CH", CH_SPECS),
      OH: new HatVoice(bus, "OH", OH_SPECS),
      CP: new ClapVoice(bus),
      LT: new TomVoice(bus),
    };
  }

  /**
   * Fire a voice. If it belongs to a choke group, cut the others in that group
   * first (FR-022); same-voice retrigger is handled inside the voice.
   */
  trigger(id: VoiceId, velocity = 1, time: number = Tone.now()): void {
    for (const target of chokeTargets(id)) {
      this.voices[target].choke(time);
    }
    this.voices[id].trigger(time, velocity);
  }

  /** Natural release of every voice, used on mode switch (FR-011). */
  releaseAll(time: number = Tone.now()): void {
    for (const v of Object.values(this.voices)) v.release(time);
  }

  setParam(id: VoiceId, key: string, value: number): void {
    this.voices[id].setParam(key, value);
  }

  /** Serialize current parameters into a kit preset (design §6.1). */
  toKitJSON(name: string): KitPreset {
    const voices = {} as KitPreset["voices"];
    for (const id of VOICE_IDS) {
      voices[id] = this.voices[id].getParams();
    }
    return { schema: "lab1.kit", version: 1, name, voices };
  }

  /** Apply a (already validated) kit preset to all voices. */
  loadKit(kit: KitPreset): void {
    for (const id of VOICE_IDS) {
      const p = kit.voices[id];
      if (p) this.voices[id].setParams(p);
    }
  }

  dispose(): void {
    for (const v of Object.values(this.voices)) v.dispose();
  }
}
