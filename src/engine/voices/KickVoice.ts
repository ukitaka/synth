import * as Tone from "tone";
import { DrumVoice } from "../DrumVoice";
import { BD_SPECS } from "../voiceSpecs";
import type { ParamSpec, VoiceId } from "../types";

/**
 * BD — bass drum / kick (design §3.1).
 *
 *   Sine Osc  <-freq- FreqEnv(tune*pitchAmt -> tune, ~40ms)
 *            -> AmpEnv(A:1ms, D:decay, S:0) -> WaveShaper(tanh) -> out -> Bus
 *   White Noise -> HPF 4kHz -> AmpEnv(D:8ms) -> clickGain --------^   (attack click)
 *
 * The pitch envelope sweeping tune*pitchAmt down to tune is the "body" of the
 * drum; the short HPF'd noise burst is the beater click. TomVoice reuses this
 * whole graph with different defaults (design §3.5).
 */
export interface KickVoiceOpts {
  id?: VoiceId;
  specs?: ParamSpec[];
}

export class KickVoice extends DrumVoice {
  readonly id: VoiceId;
  readonly paramSpecs: ParamSpec[];

  private readonly osc: Tone.Oscillator;
  private readonly pitchEnv: Tone.FrequencyEnvelope;
  private readonly bodyEnv: Tone.AmplitudeEnvelope;
  private readonly noise: Tone.Noise;
  private readonly clickEnv: Tone.AmplitudeEnvelope;
  private readonly clickGain: Tone.Gain;

  constructor(bus: Tone.Gain, opts: KickVoiceOpts = {}) {
    super(bus);
    // Set before initParams(); TomVoice passes its own id/specs (design §3.5).
    this.id = opts.id ?? "BD";
    this.paramSpecs = opts.specs ?? BD_SPECS;

    // --- body path: sine driven by a fast downward pitch sweep ---
    this.osc = new Tone.Oscillator({ type: "sine", frequency: 0 }).start();
    this.pitchEnv = new Tone.FrequencyEnvelope({
      attack: 0.001,
      decay: 0.04, // ~40ms sweep (design §3.1)
      sustain: 0,
      release: 0.01,
      baseFrequency: 50,
      octaves: Math.log2(3),
      exponent: 2, // steeper-than-linear pitch fall = 808 "boom"
    });
    this.pitchEnv.connect(this.osc.frequency);

    this.bodyEnv = new Tone.AmplitudeEnvelope({ attack: 0.001, decay: 0.4, sustain: 0, release: 0.01 });
    const shaper = new Tone.WaveShaper(KickVoice.saturationCurve(), 1024);

    // sine -> body AmpEnv -> saturation -> out
    this.osc.connect(this.bodyEnv);
    this.bodyEnv.connect(shaper);
    shaper.connect(this.out);

    // --- click path: HPF'd white-noise transient ---
    this.noise = new Tone.Noise("white").start();
    const hpf = new Tone.Filter({ type: "highpass", frequency: 4000, Q: 0.7 });
    this.clickEnv = new Tone.AmplitudeEnvelope({ attack: 0.0005, decay: 0.008, sustain: 0, release: 0.005 });
    this.clickGain = new Tone.Gain(0);

    // noise -> HPF -> click AmpEnv -> clickGain -> out
    this.noise.connect(hpf);
    hpf.connect(this.clickEnv);
    this.clickEnv.connect(this.clickGain);
    this.clickGain.connect(this.out);

    this.envs.push(this.bodyEnv, this.clickEnv);
    this.initParams();
  }

  /** Soft tanh saturation — fixed, models the 808 output stage (design §3.1). */
  private static saturationCurve(): Float32Array {
    const n = 1024;
    const curve = new Float32Array(n);
    const drive = 2;
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * drive) / Math.tanh(drive);
    }
    return curve;
  }

  protected applyParam(key: string, value: number): void {
    super.applyParam(key, value);
    switch (key) {
      case "tune":
        this.pitchEnv.baseFrequency = value;
        break;
      case "pitchAmt":
        this.pitchEnv.octaves = Math.log2(value);
        break;
      case "decay":
        this.bodyEnv.decay = value;
        break;
      case "click":
        this.clickGain.gain.value = value;
        break;
    }
  }

  trigger(time: number, velocity: number): void {
    this.pitchEnv.cancel(time);
    this.pitchEnv.triggerAttack(time);
    this.fire(this.bodyEnv, time, velocity);
    this.fire(this.clickEnv, time, velocity);
  }
}
