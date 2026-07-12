import { describe, expect, it } from "vitest";
import * as Tone from "tone";
import { MasterBus } from "../src/engine/MasterBus";
import { SoundEngine } from "../src/engine/SoundEngine";
import { PatternEngine } from "../src/engine/PatternEngine";
import { Sequencer } from "../src/engine/Sequencer";
import { emptyPattern } from "../src/engine/pattern";
import { audioRenderingAvailable, peak, zeroCrossingRate } from "./helpers/audioEnv";

// Web-Audio render tests: run only where OfflineAudioContext exists (browser),
// skip loudly in node.

const available = await audioRenderingAvailable();

function onsets(ch: Float32Array, sr: number, thresh: number, refractory: number): number[] {
  const times: number[] = [];
  let last = -Infinity;
  for (let i = 0; i < ch.length; i++) {
    const t = i / sr;
    if (Math.abs(ch[i]) > thresh && t - last > refractory) {
      times.push(t);
      last = t;
    }
  }
  return times;
}

(available ? describe : describe.skip)("SoundEngine + PATTERN rendering", () => {
  it("a kick preset sweeps down in pitch", async () => {
    const buf = await Tone.Offline(() => {
      const m = new MasterBus();
      const s = new SoundEngine(m.input);
      s.setWaveform("sine");
      s.setParam("pitchAmt", 6);
      s.setParam("pitchTime", 0.08);
      s.setParam("sustain", 0);
      s.setParam("decay", 0.3);
      s.noteOn(60, 0);
    }, 0.4);
    const sr = buf.sampleRate;
    const ch = buf.getChannelData(0);
    expect(zeroCrossingRate(ch, sr, 0, 0.03)).toBeGreaterThan(zeroCrossingRate(ch, sr, 0.15, 0.25));
  });

  it("highpass + noise is brighter than lowpass + noise", async () => {
    const render = async (filter: "lowpass" | "highpass") => {
      const buf = await Tone.Offline(() => {
        const m = new MasterBus();
        const s = new SoundEngine(m.input);
        s.setParam("noise", 1);
        s.setFilterType(filter);
        s.setParam("cutoff", 6000);
        s.noteOn(200, 0);
      }, 0.2);
      return zeroCrossingRate(buf.getChannelData(0), buf.sampleRate, 0.02, 0.12);
    };
    expect(await render("highpass")).toBeGreaterThan(await render("lowpass"));
  });

  it("PatternEngine plays the assigned preset on a track", async () => {
    const buf = await Tone.Offline(() => {
      const m = new MasterBus();
      const engine = new PatternEngine(m.input);
      engine.sync(emptyPattern());
      engine.trigger(0, 1, 0); // track 0 = Kick
    }, 0.4);
    expect(peak(buf.getChannelData(0))).toBeGreaterThan(0.05);
  });

  it("sequencer plays 4-on-the-floor with even spacing", async () => {
    const buf = await Tone.Offline(() => {
      const m = new MasterBus();
      const engine = new PatternEngine(m.input);
      const pattern = emptyPattern("t", 120);
      pattern.tracks.forEach((t) => (t.steps = new Array(16).fill(0)));
      pattern.tracks[0].steps = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]; // Kick
      engine.sync(pattern);
      new Sequencer(engine, pattern).start();
    }, 2.1);
    const hits = onsets(buf.getChannelData(0), buf.sampleRate, 0.2, 0.2);
    expect(hits.length).toBeGreaterThanOrEqual(3);
    const gaps = hits.slice(1).map((t, i) => t - hits[i]);
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    for (const g of gaps) expect(Math.abs(g - mean)).toBeLessThan(0.03);
  });
});
