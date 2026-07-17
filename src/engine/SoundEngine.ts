import * as Tone from "tone";
import { FxChain } from "./fx/FxChain";
import { SYNTH_SPECS, synthDefaults } from "./synthSpecs";
import { FX_DEFS } from "./fx/fxSpecs";
import { blankPreset } from "./preset";
import type { FilterType, FxId, SoundPreset, SynthWaveform } from "./types";

/**
 * Monophonic subtractive synth = one designed "sound" (SOUND tab), and the
 * voice each PATTERN track plays. Signal path:
 *
 *   Osc(wave) ─► oscGain(1-noise) ─┐
 *   Noise     ─► noiseGain(noise)  ─┴─► Filter(LP/HP/BP) ─► AmpEnv ─► out ─► FxChain ─► Bus
 *   PitchEnv (note*pitchAmt -> note) ─► Osc.frequency
 *   FilterEnv (cutoff, +filterEnv oct) ─► Filter.frequency
 *
 * The pitch envelope turns a plain note into a kick/tom thump; the noise source
 * + highpass/bandpass filter cover hats/snares/claps. FX are per-sound.
 */
export class SoundEngine {
  private readonly osc: Tone.Oscillator;
  private readonly noise: Tone.Noise;
  private readonly oscGain: Tone.Gain;
  private readonly noiseGain: Tone.Gain;
  private readonly filter: Tone.Filter;
  private readonly filtGain: Tone.Gain; // filtered path level (1 unless OFF)
  private readonly bypassGain: Tone.Gain; // dry path level (1 when filter OFF)
  private readonly amp: Tone.AmplitudeEnvelope;
  private readonly pitchEnv: Tone.FrequencyEnvelope;
  private readonly filterEnv: Tone.FrequencyEnvelope;
  private readonly out: Tone.Gain;
  readonly fx: FxChain;

  /** FFT tap on the post-filter signal, for the spectrum display. */
  private readonly fft: Tone.Analyser;
  /** Unconnected biquad used only to compute the filter's response curve. */
  private readonly probe: BiquadFilterNode;
  private phaseScratch: Float32Array<ArrayBuffer> | null = null;

  private waveform: SynthWaveform = "sawtooth";
  private filterType: FilterType = "lowpass";
  private readonly params: Record<string, number> = synthDefaults();

  // Repeat playback (design-loop aid): retrigger the last note on a fixed
  // interval, scheduled on the Transport's look-ahead (NFR-02).
  private repeatId: number | null = null;
  private repeatFreq = 261.63; // C4
  private repeatInterval = 0.25;

  constructor(bus: Tone.Gain) {
    this.out = new Tone.Gain(0.7);
    this.fx = new FxChain();
    this.out.connect(this.fx.input);
    this.fx.connect(bus);

    this.osc = new Tone.Oscillator({ type: "sawtooth", frequency: 0 }).start();
    this.noise = new Tone.Noise("white").start();
    this.oscGain = new Tone.Gain(1);
    this.noiseGain = new Tone.Gain(0);

    this.filter = new Tone.Filter({ type: "lowpass", frequency: 0, Q: 2 });
    this.amp = new Tone.AmplitudeEnvelope({ attack: 0.005, decay: 0.2, sustain: 0.6, release: 0.3 });
    this.pitchEnv = new Tone.FrequencyEnvelope({
      attack: 0.001, decay: 0.04, sustain: 0, release: 0.01, baseFrequency: 220, octaves: 0, exponent: 2,
    });
    this.filterEnv = new Tone.FrequencyEnvelope({
      attack: 0.001, decay: 0.2, sustain: 0, release: 0.01, baseFrequency: 4000, octaves: 0,
    });

    this.osc.connect(this.oscGain);
    this.noise.connect(this.noiseGain);
    // Two parallel paths into the amp: through the filter (default) and a dry
    // bypass. Filter type "off" crossfades to the dry path — a true bypass,
    // unlike opening the cutoff, which our 12kHz max never fully achieves.
    this.filtGain = new Tone.Gain(1);
    this.bypassGain = new Tone.Gain(0);
    this.oscGain.connect(this.filter);
    this.noiseGain.connect(this.filter);
    this.oscGain.connect(this.bypassGain);
    this.noiseGain.connect(this.bypassGain);
    this.filter.connect(this.filtGain);
    this.filtGain.connect(this.amp);
    this.bypassGain.connect(this.amp);
    this.amp.connect(this.out);

    this.pitchEnv.connect(this.osc.frequency);
    this.filterEnv.connect(this.filter.frequency);

    // Spectrum tap: post-filter/amp, pre-FX — shows exactly what the filter
    // lets through, before drive/delay/reverb recolor it.
    this.fft = new Tone.Analyser("fft", 1024);
    this.fft.smoothing = 0.85;
    this.amp.connect(this.fft);
    this.probe = this.filter.context.rawContext.createBiquadFilter();

    for (const s of SYNTH_SPECS) this.applyParam(s.key, this.params[s.key]);
  }

  /** dB per FFT bin (bin i covers i * sampleRate/2 / length Hz). */
  getSpectrum(): Float32Array {
    return this.fft.getValue() as Float32Array;
  }

  get sampleRate(): number {
    return this.filter.context.sampleRate;
  }

  /**
   * Magnitude response of the current filter settings at `freqs`, written into
   * `magOut` (linear gain). Computed on a detached probe biquad because the
   * live filter's frequency param is signal-driven (base 0 + envelope), which
   * makes its own getFrequencyResponse read wrong. The curve shows the at-rest
   * cutoff; a filter-envelope sweep momentarily sits above it.
   */
  getFilterResponse(freqs: Float32Array<ArrayBuffer>, magOut: Float32Array<ArrayBuffer>): void {
    if (this.filterType === "off") {
      magOut.fill(1); // bypassed: flat 0 dB line
      return;
    }
    this.probe.type = this.filterType;
    this.probe.frequency.value = this.params.cutoff;
    this.probe.Q.value = this.params.reso;
    if (!this.phaseScratch || this.phaseScratch.length !== freqs.length) {
      this.phaseScratch = new Float32Array(freqs.length);
    }
    this.probe.getFrequencyResponse(freqs, magOut, this.phaseScratch);
  }

  setWaveform(w: SynthWaveform): void {
    this.waveform = w;
    this.osc.type = w;
  }
  getWaveform(): SynthWaveform {
    return this.waveform;
  }

  setFilterType(t: FilterType): void {
    this.filterType = t;
    if (t === "off") {
      // short crossfade so toggling mid-note doesn't click
      this.filtGain.gain.rampTo(0, 0.02);
      this.bypassGain.gain.rampTo(1, 0.02);
    } else {
      this.filter.type = t;
      this.filtGain.gain.rampTo(1, 0.02);
      this.bypassGain.gain.rampTo(0, 0.02);
    }
  }
  getFilterType(): FilterType {
    return this.filterType;
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
        this.filterEnv.decay = value;
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

  /** Snapshot the current design as a portable preset. */
  toPreset(name: string): SoundPreset {
    const fx = {} as SoundPreset["fx"];
    for (const def of FX_DEFS) {
      const params: Record<string, number> = {};
      for (const p of def.params) params[p.key] = this.fx.getParam(def.id, p.key);
      fx[def.id] = { on: this.fx.isEnabled(def.id), params };
    }
    return {
      schema: "lab1.sound",
      version: 1,
      name,
      waveform: this.waveform,
      filterType: this.filterType,
      params: this.getParams(),
      fx,
    };
  }

  /** Apply a (validated) preset to this engine. */
  loadPreset(preset: SoundPreset): void {
    this.setWaveform(preset.waveform);
    this.setFilterType(preset.filterType);
    for (const s of SYNTH_SPECS) {
      if (typeof preset.params[s.key] === "number") this.setParam(s.key, preset.params[s.key]);
    }
    for (const def of FX_DEFS) {
      const st = preset.fx[def.id];
      if (!st) continue;
      for (const p of def.params) {
        if (typeof st.params[p.key] === "number") this.setFxParam(def.id, p.key, st.params[p.key]);
      }
      this.setFxEnabled(def.id, !!st.on);
    }
  }

  noteOn(freq: number, time: number = Tone.now(), velocity = 1): void {
    this.pitchEnv.baseFrequency = freq;
    this.pitchEnv.octaves = Math.log2(this.params.pitchAmt);
    this.pitchEnv.cancel(time);
    this.pitchEnv.triggerAttack(time);
    this.filterEnv.cancel(time);
    this.filterEnv.triggerAttack(time);
    this.amp.triggerAttack(time, velocity);
  }

  noteOff(time: number = Tone.now()): void {
    this.amp.triggerRelease(time);
  }

  /**
   * Retrigger `freq` every `interval` seconds (Transport-scheduled, so it does
   * not drift with UI load). The gate closes at 50% of the interval so
   * sustained sounds pulse instead of holding.
   */
  startRepeat(freq: number, interval: number): void {
    this.stopRepeat();
    this.repeatFreq = freq;
    this.repeatInterval = interval;
    const t = Tone.getTransport();
    this.repeatId = t.scheduleRepeat((time) => {
      this.noteOn(this.repeatFreq, time);
      this.noteOff(time + this.repeatInterval * 0.5);
    }, interval);
    t.start();
  }

  /** Follow the most recently played note while repeating. */
  setRepeatFreq(freq: number): void {
    this.repeatFreq = freq;
  }

  isRepeating(): boolean {
    return this.repeatId !== null;
  }

  stopRepeat(): void {
    if (this.repeatId !== null) {
      Tone.getTransport().clear(this.repeatId);
      this.repeatId = null;
    }
  }

  releaseAll(time: number = Tone.now()): void {
    this.amp.triggerRelease(time);
  }

  /** Restore params to their defaults + all FX off (blank sound). */
  reset(): void {
    this.loadPreset(blankPreset(""));
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
    this.filtGain.dispose();
    this.bypassGain.dispose();
    this.fft.dispose();
    this.out.dispose();
    this.fx.dispose();
  }
}
