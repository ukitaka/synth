import * as Tone from "tone";

/**
 * Shared master output for both SYNTH and DRUM modes (FR-012).
 *
 * Signal path (design §1):
 *   input Gain -> Analyser (oscilloscope, shared by both modes)
 *              -> Volume  (master level)
 *              -> WaveShaper (tanh safety clip)
 *              -> Destination
 *
 * Both engines connect their output to `input`, so the oscilloscope shows a
 * waveform whichever mode is active. The Analyser taps the pre-fader sum, so
 * the scope always shows the clean synthesized waveform (learning aid, G1).
 *
 * The tanh WaveShaper is a mastering safety net: individually a kick/tom peaks
 * near 0 dBFS, so six simultaneous voices would clip. tanh(x) never exceeds 1,
 * so it guarantees the design §9.1 no-clip invariant with a gentle 808-style
 * soft knee, using only a permitted primitive (NFR-03).
 */
export class MasterBus {
  readonly input: Tone.Gain;
  readonly analyser: Tone.Analyser;
  readonly volume: Tone.Volume;
  readonly limiter: Tone.WaveShaper;

  constructor() {
    this.input = new Tone.Gain(1);
    // Waveform analyser for the shared oscilloscope. 1024 samples is enough to
    // draw one screen of the lowest drum tones without being expensive.
    this.analyser = new Tone.Analyser("waveform", 1024);
    this.volume = new Tone.Volume(0);
    this.limiter = new Tone.WaveShaper(MasterBus.softClipCurve(), 2048);

    // signal path, written in flow order
    this.input.connect(this.analyser);
    this.input.connect(this.volume);
    this.volume.connect(this.limiter);
    this.limiter.toDestination();
  }

  /** tanh soft-clip: ~linear until ~0.5, saturating below +-1 (no hard clip). */
  private static softClipCurve(): Float32Array {
    const n = 2048;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(x);
    }
    return curve;
  }

  /** Master volume in dB (UI power/volume control). */
  setVolume(db: number): void {
    this.volume.volume.value = db;
  }

  /** Latest waveform frame for the oscilloscope. */
  getWaveform(): Float32Array {
    return this.analyser.getValue() as Float32Array;
  }

  dispose(): void {
    this.input.dispose();
    this.analyser.dispose();
    this.volume.dispose();
    this.limiter.dispose();
  }
}
