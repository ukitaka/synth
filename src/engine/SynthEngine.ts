import * as Tone from "tone";

export interface SynthParams {
  waveform: Tone.ToneOscillatorType;
  cutoff: number; // Hz
  resonance: number; // Q
  attack: number; // s
  release: number; // s
}

/**
 * Minimal monophonic subtractive synth for SYNTH mode — the "existing LAB-1"
 * voice the DRUM mode sits alongside (design §1). Kept intentionally small: it
 * only has to demonstrate the shared master bus and mode coexistence
 * (FR-010..012). Signal path: OSC -> FILTER -> AMP ENV -> out -> Bus.
 */
export class SynthEngine {
  private readonly osc: Tone.Oscillator;
  private readonly filter: Tone.Filter;
  private readonly amp: Tone.AmplitudeEnvelope;
  private readonly out: Tone.Gain;
  private readonly params: SynthParams = {
    waveform: "sawtooth",
    cutoff: 1200,
    resonance: 4,
    attack: 0.01,
    release: 0.4,
  };

  constructor(bus: Tone.Gain) {
    this.out = new Tone.Gain(0.7);
    this.out.connect(bus);

    // OSC -> FILTER -> AMP ENV -> out
    this.osc = new Tone.Oscillator({ type: "sawtooth", frequency: 220 }).start();
    this.filter = new Tone.Filter({ type: "lowpass", frequency: 1200, Q: 4 });
    this.amp = new Tone.AmplitudeEnvelope({ attack: 0.01, decay: 0.1, sustain: 0.8, release: 0.4 });

    this.osc.connect(this.filter);
    this.filter.connect(this.amp);
    this.amp.connect(this.out);
  }

  setParam<K extends keyof SynthParams>(key: K, value: SynthParams[K]): void {
    this.params[key] = value;
    switch (key) {
      case "waveform":
        this.osc.type = value as Tone.ToneOscillatorType;
        break;
      case "cutoff":
        this.filter.frequency.value = value as number;
        break;
      case "resonance":
        this.filter.Q.value = value as number;
        break;
      case "attack":
        this.amp.attack = value as number;
        break;
      case "release":
        this.amp.release = value as number;
        break;
    }
  }

  getParams(): SynthParams {
    return { ...this.params };
  }

  noteOn(freq: number, time: number = Tone.now()): void {
    this.osc.frequency.setValueAtTime(freq, time);
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
    this.filter.dispose();
    this.amp.dispose();
    this.out.dispose();
  }
}
