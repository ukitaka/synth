import * as Tone from "tone";
import { DrumVoice } from "../DrumVoice";
import { CH_SPECS, OH_SPECS } from "../voiceSpecs";
import type { ParamSpec, VoiceId } from "../types";

// Six inharmonic partials measured from a real 808 hat (design §3.3).
const HAT_FREQS = [205.3, 304.4, 369.6, 522.7, 540, 800];

/**
 * CH / OH — hi-hats (design §3.3). Metallic timbre from six detuned square
 * oscillators, not noise:
 *
 *   Square x6 (tune-scaled) -> sum -> BPF(10k,Q1) -> HPF(tone) -> AmpEnv -> out -> Bus
 *
 * CH and OH are the same class with different decay defaults; both share the
 * "hat" choke group so the open hat is cut when the closed hat fires (FR-022).
 */
export class HatVoice extends DrumVoice {
  readonly id: VoiceId;
  readonly paramSpecs: ParamSpec[];
  readonly chokeGroup = "hat";

  static readonly CH_SPECS = CH_SPECS;
  static readonly OH_SPECS = OH_SPECS;

  private readonly oscs: Tone.Oscillator[] = [];
  private readonly ampEnv: Tone.AmplitudeEnvelope;
  private readonly hpf: Tone.Filter;

  constructor(bus: Tone.Gain, id: VoiceId, specs: ParamSpec[]) {
    super(bus);
    this.id = id;
    this.paramSpecs = specs;

    // six squares -> shared sum bus
    const sum = new Tone.Gain(0.15); // keep six oscillators well below clipping
    for (const f of HAT_FREQS) {
      const osc = new Tone.Oscillator({ type: "square", frequency: f }).start();
      osc.connect(sum);
      this.oscs.push(osc);
    }

    // sum -> BPF(10k) -> HPF(tone) -> AmpEnv -> out
    const bpf = new Tone.Filter({ type: "bandpass", frequency: 10000, Q: 1 });
    this.hpf = new Tone.Filter({ type: "highpass", frequency: 7000, Q: 0.7 });
    // 5ms release so choke() cuts cleanly (design §3.3).
    this.ampEnv = new Tone.AmplitudeEnvelope({ attack: 0.001, decay: 0.04, sustain: 0, release: 0.005 });

    sum.connect(bpf);
    bpf.connect(this.hpf);
    this.hpf.connect(this.ampEnv);
    this.ampEnv.connect(this.out);

    this.envs.push(this.ampEnv);
    this.initParams();
  }

  protected applyParam(key: string, value: number): void {
    super.applyParam(key, value);
    switch (key) {
      case "decay":
        this.ampEnv.decay = value;
        break;
      case "tone":
        this.hpf.frequency.value = value;
        break;
      case "tune":
        this.oscs.forEach((osc, i) => {
          osc.frequency.value = HAT_FREQS[i] * value;
        });
        break;
    }
  }

  trigger(time: number, velocity: number): void {
    this.fire(this.ampEnv, time, velocity);
  }
}
