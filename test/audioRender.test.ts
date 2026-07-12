import { describe, expect, it } from "vitest";
import * as Tone from "tone";
import { MasterBus } from "../src/engine/MasterBus";
import { DrumEngine } from "../src/engine/DrumEngine";
import { Sequencer } from "../src/engine/Sequencer";
import { SynthEngine } from "../src/engine/SynthEngine";
import { emptyPattern } from "../src/engine/pattern";
import { VOICE_IDS, type VoiceId } from "../src/engine/types";
import { audioRenderingAvailable, peak, rmsWindow, zeroCrossingRate } from "./helpers/audioEnv";

/** Detect onset times: samples crossing `thresh` after `refractory` seconds of quiet. */
function onsets(ch: Float32Array, sampleRate: number, thresh: number, refractory: number): number[] {
  const times: number[] = [];
  let last = -Infinity;
  for (let i = 0; i < ch.length; i++) {
    const t = i / sampleRate;
    if (Math.abs(ch[i]) > thresh && t - last > refractory) {
      times.push(t);
      last = t;
    }
  }
  return times;
}

// Offline synthesis characteristics (design §9.1, §9.2). Runs only where
// OfflineAudioContext exists (browser mode); skips loudly in node.

const available = await audioRenderingAvailable();

/** Render a scenario that triggers voices at given times, return channel 0. */
async function render(
  duration: number,
  hits: { id: VoiceId; time: number }[]
): Promise<{ ch: Float32Array; sampleRate: number }> {
  const buf = await Tone.Offline(() => {
    const master = new MasterBus();
    const engine = new DrumEngine(master.input);
    for (const h of hits) engine.trigger(h.id, 1, h.time);
  }, duration);
  return { ch: buf.getChannelData(0), sampleRate: buf.sampleRate };
}

(available ? describe : describe.skip)("offline synthesis (§9)", () => {
  it("every voice produces audible output", async () => {
    for (const id of VOICE_IDS) {
      const { ch } = await render(1.0, [{ id, time: 0 }]);
      expect(peak(ch)).toBeGreaterThan(0.01);
    }
  });

  it("longer decay yields more late energy (RMS monotonicity, §9.1)", async () => {
    // Kick with default (0.4) vs a scenario relying on the tail window.
    const short = await Tone.Offline(() => {
      const m = new MasterBus();
      const e = new DrumEngine(m.input);
      e.setParam("BD", "decay", 0.15);
      e.trigger("BD", 1, 0);
    }, 1.0);
    const long = await Tone.Offline(() => {
      const m = new MasterBus();
      const e = new DrumEngine(m.input);
      e.setParam("BD", "decay", 1.2);
      e.trigger("BD", 1, 0);
    }, 1.0);
    const sr = short.sampleRate;
    const eShort = rmsWindow(short.getChannelData(0), sr, 0.35, 0.5);
    const eLong = rmsWindow(long.getChannelData(0), sr, 0.35, 0.5);
    expect(eLong).toBeGreaterThan(eShort);
  });

  it("spectral brightness ordering BD < LT < SD < CH (§9.1)", async () => {
    const zcr = async (id: VoiceId) => {
      const { ch, sampleRate } = await render(0.4, [{ id, time: 0 }]);
      return zeroCrossingRate(ch, sampleRate, 0.0, 0.03);
    };
    const bd = await zcr("BD");
    const lt = await zcr("LT");
    const sd = await zcr("SD");
    const ch = await zcr("CH");
    expect(bd).toBeLessThan(lt);
    expect(lt).toBeLessThan(sd);
    expect(sd).toBeLessThan(ch);
  });

  it("full kit at max velocity does not hard-clip (§9.1)", async () => {
    const { ch } = await render(1.0, VOICE_IDS.map((id) => ({ id, time: 0 })));
    // Hard bound: no digital clipping. Design targets <= -0.5 dBFS of headroom.
    expect(peak(ch)).toBeLessThanOrEqual(1.0);
  });

  it("closed hat chokes the open hat (§9.2)", async () => {
    // A: OH rings freely. B: CH fires 100ms later and cuts it.
    const free = await render(0.4, [{ id: "OH", time: 0 }]);
    const choked = await render(0.4, [
      { id: "OH", time: 0 },
      { id: "CH", time: 0.1 },
    ]);
    const sr = free.sampleRate;
    // Measure the OH tail after the choke point; CH (decay 0.04) is gone by 0.15.
    const eFree = rmsWindow(free.ch, sr, 0.15, 0.25);
    const eChoked = rmsWindow(choked.ch, sr, 0.15, 0.25);
    expect(eChoked).toBeLessThan(eFree * 0.2); // OH tail largely gone
  });

  it("sequencer plays 4-on-the-floor with even spacing (§9.4)", async () => {
    // BD on every quarter (steps 0,4,8,12) at 120bpm -> one hit per 0.5s.
    const buf = await Tone.Offline(() => {
      const master = new MasterBus();
      const engine = new DrumEngine(master.input);
      const pattern = emptyPattern("test", 120);
      pattern.tracks.BD = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
      const seq = new Sequencer(engine, pattern);
      seq.start(); // starts the (offline) Transport internally
    }, 2.1);
    const sr = buf.sampleRate;
    const hits = onsets(buf.getChannelData(0), sr, 0.2, 0.2);
    // ~4 quarter-note kicks over 2s (allow the first/last boundary to vary).
    expect(hits.length).toBeGreaterThanOrEqual(3);
    const gaps = hits.slice(1).map((t, i) => t - hits[i]);
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    for (const g of gaps) expect(Math.abs(g - mean)).toBeLessThan(0.03); // < 30ms jitter
  });
});

(available ? describe : describe.skip)("SYNTH drum design + FX", () => {
  it("pitch envelope makes a note fall in pitch (drum thump)", async () => {
    const buf = await Tone.Offline(() => {
      const m = new MasterBus();
      const s = new SynthEngine(m.input);
      s.setParam("pitchAmt", 6); // strong downward sweep
      s.setParam("pitchTime", 0.08);
      s.setParam("sustain", 0);
      s.setParam("decay", 0.3);
      s.noteOn(60, 0); // ~C2-ish landing
    }, 0.4);
    const sr = buf.sampleRate;
    const ch = buf.getChannelData(0);
    const early = zeroCrossingRate(ch, sr, 0.0, 0.03);
    const late = zeroCrossingRate(ch, sr, 0.15, 0.25);
    expect(early).toBeGreaterThan(late); // pitch (and thus ZCR) falls
  });

  it("noise source produces a much brighter signal than a sine", async () => {
    const render = async (noise: number) => {
      const buf = await Tone.Offline(() => {
        const m = new MasterBus();
        const s = new SynthEngine(m.input);
        s.setWaveform("sine");
        s.setParam("noise", noise);
        s.setParam("cutoff", 12000);
        s.noteOn(200, 0);
      }, 0.3);
      return zeroCrossingRate(buf.getChannelData(0), buf.sampleRate, 0.02, 0.15);
    };
    expect(await render(1)).toBeGreaterThan((await render(0)) * 3);
  });

  it("drive flattens peaks (lower crest factor)", async () => {
    const crest = async (driveOn: boolean) => {
      const buf = await Tone.Offline(() => {
        const m = new MasterBus();
        const s = new SynthEngine(m.input);
        s.setWaveform("sine");
        s.setParam("sustain", 1);
        if (driveOn) {
          s.setFxEnabled("drive", true);
          s.setFxParam("drive", "drive", 15);
          s.setFxParam("drive", "mix", 1);
        }
        s.noteOn(200, 0);
      }, 0.3);
      const ch = buf.getChannelData(0);
      const p = peak(ch);
      const r = rmsWindow(ch, buf.sampleRate, 0.05, 0.25);
      return p / (r || 1); // crest factor
    };
    expect(await crest(true)).toBeLessThan(await crest(false));
  });

  it("delay produces a repeat after the note ends", async () => {
    const buf = await Tone.Offline(() => {
      const m = new MasterBus();
      const s = new SynthEngine(m.input);
      s.setParam("sustain", 0);
      s.setParam("decay", 0.05); // short blip
      s.setFxEnabled("delay", true);
      s.setFxParam("delay", "time", 0.2);
      s.setFxParam("delay", "feedback", 0.5);
      s.setFxParam("delay", "mix", 0.6);
      s.noteOn(300, 0);
    }, 0.8);
    const hits = onsets(buf.getChannelData(0), buf.sampleRate, 0.05, 0.08);
    expect(hits.length).toBeGreaterThanOrEqual(2); // original + at least one echo
  });
});
