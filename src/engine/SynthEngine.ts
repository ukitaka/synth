import * as Tone from "tone";
import { FxChain } from "./fx/FxChain";
import { SYNTH_SPECS, synthDefaults, type SynthWaveform } from "./synthSpecs";
import type { FxId } from "./fx/fxSpecs";

/**
 * Monophonic subtractive synth for SYNTH mode, built to double as a drum
 * designer (pitch envelope + noise + filter envelope). Signal path:
 *
 *   Osc(wave) ─► oscGain(1-noise) ─┐
 *   Noise     ─► noiseGain(noise)  ─┴─► Filter ─► AmpEnv ─► out ─► FxChain ─► Bus
 *   PitchEnv (note*pitchAmt -> note) ─► Osc.frequency
 *   FilterEnv (cutoff, +filterEnv oct) ─► Filter.frequency
 *
 * The pitch envelope is what turns a plain note into a kick/tom: a fast fall
 * from note*pitchAmt down to the note. With pitchAmt = x1 the synth plays
 * ordinary pitched notes. FX are SYNTH-only, on the output (design decision).
 */
export class SynthEngine {
  private readonly osc: Tone.Oscillator;
  private readonly noise: Tone.Noise;
  private readonly oscGain: Tone.Gain;
  private readonly noiseGain: Tone.Gain;
  private readonly filter: Tone.Filter;
  private readonly amp: Tone.AmplitudeEnvelope;
  private readonly pitchEnv: Tone.FrequencyEnvelope;
  private readonly filterEnv: Tone.FrequencyEnvelope;
  private readonly out: Tone.Gain;
  readonly fx: FxChain;

  private waveform: SynthWaveform = "sawtooth";
  private readonly params: Record<string, number> = synthDefaults();

  constructor(bus: Tone.Gain) {
    this.out = new Tone.Gain(0.7);
    this.fx = new FxChain();
    this.out.connect(this.fx.input);
    this.fx.connect(bus);

    // sources
    this.osc = new Tone.Oscillator({ type: "sawtooth", frequency: 0 }).start();
    this.noise = new Tone.Noise("white").start();
    this.oscGain = new Tone.Gain(1);
    this.noiseGain = new Tone.Gain(0);

    // filter + envelopes
    this.filter = new Tone.Filter({ type: "lowpass", frequency: 0, Q: 2 });
    this.amp = new Tone.AmplitudeEnvelope({ attack: 0.005, decay: 0.2, sustain: 0.6, release: 0.3 });
    this.pitchEnv = new Tone.FrequencyEnvelope({
      attack: 0.001, decay: 0.04, sustain: 0, release: 0.01, baseFrequency: 220, octaves: 0, exponent: 2,
    });
    this.filterEnv = new Tone.FrequencyEnvelope({
      attack: 0.001, decay: 0.2, sustain: 0, release: 0.01, baseFrequency: 4000, octaves: 0,
    });

    // Osc + Noise -> mix -> Filter -> AmpEnv -> out
    this.osc.connect(this.oscGain);
    this.noise.connect(this.noiseGain);
    this.oscGain.connect(this.filter);
    this.noiseGain.connect(this.filter);
    this.filter.connect(this.amp);
    this.amp.connect(this.out);

    // envelopes drive their targets (targets themselves sit at 0)
    this.pitchEnv.connect(this.osc.frequency);
    this.filterEnv.connect(this.filter.frequency);

    for (const s of SYNTH_SPECS) this.applyParam(s.key, this.params[s.key]);
  }

  setWaveform(w: SynthWaveform): void {
    this.waveform = w;
    this.osc.type = w;
  }

  getWaveform(): SynthWaveform {
    return this.waveform;
  }

  private applyParam(key: string, value: number): void {
    switch (key) {
      case "pitchAmt":
        this.pitchEnv.octaves = Math.log2(value);
        break;
      case "pitchTime":
        this.pitchEnv.decay = value;
        break;
      case "noise":
        this.oscGain.gain.value = 1 - value;
        this.noiseGain.gain.value = value;
        break;
      case "cutoff":
        this.filterEnv.baseFrequency = value;
        break;
      case "reso":
        this.filter.Q.value = value;
        break;
      case "filterEnv":
        this.filterEnv.octaves = value;
        break;
      case "attack":
        this.amp.attack = value;
        break;
      case "decay":
        this.amp.decay = value;
        this.filterEnv.decay = value; // filter env tracks amp decay
        break;
      case "sustain":
        this.amp.sustain = value;
        break;
      case "release":
        this.amp.release = value;
        break;
    }
  }

  setParam(key: string, value: number): void {
    if (!(key in this.params)) return;
    this.params[key] = value;
    this.applyParam(key, value);
  }

  getParams(): Record<string, number> {
    return { ...this.params };
  }

  setFxEnabled(id: FxId, on: boolean): void {
    this.fx.setEnabled(id, on);
  }

  setFxParam(id: FxId, key: string, value: number): void {
    this.fx.setParam(id, key, value);
  }

  isFxEnabled(id: FxId): boolean {
    return this.fx.isEnabled(id);
  }

  noteOn(freq: number, time: number = Tone.now()): void {
    // Pitch envelope is relative to the played note.
    this.pitchEnv.baseFrequency = freq;
    this.pitchEnv.octaves = Math.log2(this.params.pitchAmt);
    this.pitchEnv.cancel(time);
    this.pitchEnv.triggerAttack(time);
    this.filterEnv.cancel(time);
    this.filterEnv.triggerAttack(time);
    this.amp.triggerAttack(time);
  }

  noteOff(time: number = Tone.now()): void {
    this.amp.triggerRelease(time);
  }

  releaseAll(time: number = Tone.now()): void {
    this.amp.triggerRelease(time);
  }

  dispose(): void {
    this.osc.dispose();
    this.noise.dispose();
    this.oscGain.dispose();
    this.noiseGain.dispose();
    this.filter.dispose();
    this.amp.dispose();
    this.pitchEnv.dispose();
    this.filterEnv.dispose();
    this.out.dispose();
    this.fx.dispose();
  }
}
