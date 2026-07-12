import * as Tone from "tone";
import { DrumVoice } from "../DrumVoice";
import { SD_SPECS } from "../voiceSpecs";
import type { ParamSpec, VoiceId } from "../types";

// Second body oscillator sits at 330Hz when tune is at the default 185Hz.
const OSC2_RATIO = 330 / 185;

/**
 * SD — snare (design §3.2). Two triangle "shell" oscillators plus a band-passed
 * noise "snare wire" mixed by the SNAPPY control.
 *
 *   Tri(tune)      -> FreqEnv(x2->x1,30ms) -> AmpEnv(D:0.12) -> gain(1-snappy)   -\
 *   Tri(tune*1.78) -> FreqEnv(shallow)     -> AmpEnv(D:0.08) -> gain(0.6*(1-snap))-+-> out -> Bus
 *   White Noise -> BPF(1.8k,Q2) -> AmpEnv(D:decay) ----------> gain(snappy)       -/
 */
export class SnareVoice extends DrumVoice {
  readonly id: VoiceId = "SD";
  readonly paramSpecs: ParamSpec[] = SD_SPECS;

  private readonly osc1: Tone.Oscillator;
  private readonly osc2: Tone.Oscillator;
  private readonly pitch1: Tone.FrequencyEnvelope;
  private readonly pitch2: Tone.FrequencyEnvelope;
  private readonly bodyEnv1: Tone.AmplitudeEnvelope;
  private readonly bodyEnv2: Tone.AmplitudeEnvelope;
  private readonly bodyGain1: Tone.Gain;
  private readonly bodyGain2: Tone.Gain;
  private readonly noise: Tone.Noise;
  private readonly noiseEnv: Tone.AmplitudeEnvelope;
  private readonly noiseGain: Tone.Gain;

  constructor(bus: Tone.Gain) {
    super(bus);

    // --- shell: two triangle oscillators with quick pitch drops ---
    this.osc1 = new Tone.Oscillator({ type: "triangle", frequency: 0 }).start();
    this.pitch1 = new Tone.FrequencyEnvelope({
      attack: 0.001, decay: 0.03, sustain: 0, release: 0.01,
      baseFrequency: 185, octaves: 1, // x2 -> x1
    });
    this.pitch1.connect(this.osc1.frequency);
    this.bodyEnv1 = new Tone.AmplitudeEnvelope({ attack: 0.001, decay: 0.12, sustain: 0, release: 0.01 });
    this.bodyGain1 = new Tone.Gain(0.5);
    this.osc1.connect(this.bodyEnv1);
    this.bodyEnv1.connect(this.bodyGain1);
    this.bodyGain1.connect(this.out);

    this.osc2 = new Tone.Oscillator({ type: "triangle", frequency: 0 }).start();
    this.pitch2 = new Tone.FrequencyEnvelope({
      attack: 0.001, decay: 0.03, sustain: 0, release: 0.01,
      baseFrequency: 330, octaves: 0.5, // shallower drop
    });
    this.pitch2.connect(this.osc2.frequency);
    this.bodyEnv2 = new Tone.AmplitudeEnvelope({ attack: 0.001, decay: 0.08, sustain: 0, release: 0.01 });
    this.bodyGain2 = new Tone.Gain(0.3);
    this.osc2.connect(this.bodyEnv2);
    this.bodyEnv2.connect(this.bodyGain2);
    this.bodyGain2.connect(this.out);

    // --- snare wire: band-passed white noise ---
    this.noise = new Tone.Noise("white").start();
    const bpf = new Tone.Filter({ type: "bandpass", frequency: 1800, Q: 2 });
    this.noiseEnv = new Tone.AmplitudeEnvelope({ attack: 0.001, decay: 0.18, sustain: 0, release: 0.01 });
    this.noiseGain = new Tone.Gain(0.5);
    this.noise.connect(bpf);
    bpf.connect(this.noiseEnv);
    this.noiseEnv.connect(this.noiseGain);
    this.noiseGain.connect(this.out);

    this.envs.push(this.bodyEnv1, this.bodyEnv2, this.noiseEnv);
    this.initParams();
  }

  protected applyParam(key: string, value: number): void {
    super.applyParam(key, value);
    switch (key) {
      case "tune":
        this.pitch1.baseFrequency = value;
        this.pitch2.baseFrequency = value * OSC2_RATIO;
        break;
      case "snappy": {
        // snappy=0 -> all shell, snappy=1 -> all wire (808 SNAPPY control).
        const body = 1 - value;
        this.bodyGain1.gain.value = body;
        this.bodyGain2.gain.value = 0.6 * body;
        this.noiseGain.gain.value = value;
        break;
      }
      case "decay":
        this.noiseEnv.decay = value;
        break;
    }
  }

  trigger(time: number, velocity: number): void {
    this.pitch1.cancel(time);
    this.pitch1.triggerAttack(time);
    this.pitch2.cancel(time);
    this.pitch2.triggerAttack(time);
    this.fire(this.bodyEnv1, time, velocity);
    this.fire(this.bodyEnv2, time, velocity);
    this.fire(this.noiseEnv, time, velocity);
  }
}
