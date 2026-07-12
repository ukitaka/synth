import * as Tone from "tone";
import { DrumVoice } from "../DrumVoice";
import { CP_SPECS } from "../voiceSpecs";
import type { ParamSpec, VoiceId } from "../types";

/**
 * CP — hand clap (design §3.4). Models several hands not quite in sync as a
 * 3-burst retrigger plus a longer tail, all off one band-passed noise source:
 *
 *   White Noise -> BPF(tone,Q1.5) -+-> AmpEnv A (3 bursts, D:15ms) -> gainA -+-> out
 *                                  \-> AmpEnv B (tail, D:decay)     -> gainB -/
 *
 * The three A-bursts fire at t, t+spread, t+2*spread and the tail at t+2*spread,
 * all scheduled relative to the trigger `time` so it stays tight under the
 * Phase-2 sequencer too (design §3.4).
 */
export class ClapVoice extends DrumVoice {
  readonly id: VoiceId = "CP";
  readonly paramSpecs: ParamSpec[] = CP_SPECS;

  private readonly bpf: Tone.Filter;
  private readonly burstEnv: Tone.AmplitudeEnvelope;
  private readonly tailEnv: Tone.AmplitudeEnvelope;

  constructor(bus: Tone.Gain) {
    super(bus);

    this.bpf = new Tone.Filter({ type: "bandpass", frequency: 1100, Q: 1.5 });
    const noise = new Tone.Noise("white").start();
    noise.connect(this.bpf);

    // burst path: three short attacks
    this.burstEnv = new Tone.AmplitudeEnvelope({ attack: 0.001, decay: 0.015, sustain: 0, release: 0.005 });
    const burstGain = new Tone.Gain(0.9);
    this.bpf.connect(this.burstEnv);
    this.burstEnv.connect(burstGain);
    burstGain.connect(this.out);

    // tail path: single longer decay
    this.tailEnv = new Tone.AmplitudeEnvelope({ attack: 0.002, decay: 0.3, sustain: 0, release: 0.01 });
    const tailGain = new Tone.Gain(0.7);
    this.bpf.connect(this.tailEnv);
    this.tailEnv.connect(tailGain);
    tailGain.connect(this.out);

    this.envs.push(this.burstEnv, this.tailEnv);
    this.initParams();
  }

  protected applyParam(key: string, value: number): void {
    super.applyParam(key, value);
    switch (key) {
      case "tone":
        this.bpf.frequency.value = value;
        break;
      case "decay":
        this.tailEnv.decay = value;
        break;
      // "spread" is read at trigger time; nothing live to update.
    }
  }

  trigger(time: number, velocity: number): void {
    const spread = this.params.spread / 1000; // ms -> s
    // three bursts, then the tail after the last one
    this.fire(this.burstEnv, time, velocity);
    this.fire(this.burstEnv, time + spread, velocity);
    this.fire(this.burstEnv, time + 2 * spread, velocity);
    this.fire(this.tailEnv, time + 2 * spread, velocity);
  }
}
