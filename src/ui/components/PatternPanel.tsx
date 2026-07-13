import { useCallback, useEffect, useState } from "react";
import type { AudioSystem } from "../../engine/AudioSystem";
import type { Pattern } from "../../engine/types";
import { makeTrack } from "../../engine/pattern";
import { FACTORY_META, FACTORY_PRESETS } from "../../engine/factoryPresets";
import type { PresetListItem } from "../../storage/SoundPresetStore";
import { Oscilloscope } from "./Oscilloscope";
import { PatternControls } from "./PatternControls";

interface Props {
  system: AudioSystem;
  active: boolean;
}

/**
 * PATTERN tab: a 16-step sequencer whose tracks each play a SOUND preset.
 * The pattern object is the source of truth; the PatternEngine is re-synced on
 * structural changes (add/remove track, preset reassign, tune/mute), while step
 * edits just update the object the running Sequencer reads each step.
 */
export function PatternPanel({ system, active }: Props) {
  const seq = system.sequencer;
  const [pattern, setPatternState] = useState<Pattern>(() => seq.getPattern());
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(-1);
  const [presetList, setPresetList] = useState<PresetListItem[]>([]);

  // Keep the engine in sync with the initial pattern + load the preset list.
  useEffect(() => {
    system.pattern.sync(pattern);
    void system.presets.list().then(setPresetList);
    seq.setPlayheadCallback((step) => setPlayhead(step));
    return () => seq.setPlayheadCallback(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!active && playing) {
      seq.stop();
      setPlaying(false);
    }
  }, [active, playing, seq]);

  // structural=true also re-syncs the engine voices.
  const apply = useCallback(
    (next: Pattern, structural: boolean) => {
      setPatternState(next);
      seq.setPattern(next);
      if (structural) system.pattern.sync(next);
    },
    [seq, system]
  );

  const mutate = (fn: (p: Pattern) => Pattern, structural: boolean) => apply(fn(pattern), structural);

  const toggleStep = (ti: number, si: number) =>
    mutate((p) => {
      const tracks = p.tracks.slice();
      const steps = tracks[ti].steps.slice();
      steps[si] = steps[si] > 0 ? 0 : 1;
      tracks[ti] = { ...tracks[ti], steps };
      return { ...p, tracks };
    }, false);

  const changePreset = async (ti: number, id: string) => {
    const preset = await system.presets.load(id);
    if (!preset) return;
    const meta = FACTORY_META[preset.name];
    mutate((p) => {
      const tracks = p.tracks.slice();
      tracks[ti] = {
        ...tracks[ti],
        preset,
        note: meta?.note ?? tracks[ti].note,
        chokeGroup: meta?.choke ?? tracks[ti].chokeGroup,
      };
      return { ...p, tracks };
    }, true);
  };

  const setNote = (ti: number, note: number) =>
    mutate((p) => {
      const tracks = p.tracks.slice();
      tracks[ti] = { ...tracks[ti], note };
      return { ...p, tracks };
    }, true);

  const toggleMute = (ti: number) =>
    mutate((p) => {
      const tracks = p.tracks.slice();
      tracks[ti] = { ...tracks[ti], mute: !tracks[ti].mute };
      return { ...p, tracks };
    }, true);

  const removeTrack = (ti: number) =>
    mutate((p) => ({ ...p, tracks: p.tracks.filter((_, i) => i !== ti) }), true);

  const addTrack = () => {
    const preset = FACTORY_PRESETS.find((p) => p.name === "Kick") ?? FACTORY_PRESETS[0];
    const meta = FACTORY_META[preset.name];
    mutate((p) => ({ ...p, tracks: [...p.tracks, makeTrack(preset, meta?.note ?? 220, meta?.choke)] }), true);
  };

  const audition = (ti: number) => system.pattern.preview(ti);

  const setBpm = (bpm: number) => mutate((p) => ({ ...p, bpm }), false);
  const setSwing = (swing: number) => mutate((p) => ({ ...p, swing }), false);

  const playStop = () => {
    if (playing) { seq.stop(); setPlaying(false); }
    else { seq.start(); setPlaying(true); }
  };

  const applyPattern = (next: Pattern) => apply(next, true);

  return (
    <div className="pattern-tab">
      <Oscilloscope master={system.master} running={active} />

      <PatternControls store={system.patterns} getCurrent={() => seq.getPattern()} onApply={applyPattern} />

      <div className="transport">
        <button type="button" className={`play-btn${playing ? " on" : ""}`} onClick={playStop}>
          {playing ? "■ STOP" : "▶ PLAY"}
        </button>
        <span className="step-indicator">
          STEP {playing && playhead >= 0 ? String(playhead + 1).padStart(2, "0") : "--"} / {pattern.length}
        </span>
        <label className="transport-ctl">
          BPM
          <input type="number" min={40} max={220} value={Math.round(pattern.bpm)}
            onChange={(e) => setBpm(Math.min(220, Math.max(40, Number(e.target.value) || 40)))} />
        </label>
        <label className="transport-ctl">
          SWING
          <input type="range" min={0} max={75} value={Math.round(pattern.swing * 100)}
            onChange={(e) => setSwing(Number(e.target.value) / 100)} />
          <span>{Math.round(pattern.swing * 100)}%</span>
        </label>
        <span className="track-count">{pattern.tracks.length} TRACK · {pattern.length} STEP</span>
      </div>

      <div className="step-ruler" aria-hidden="true">
        <span className="step-ruler-gutter" />
        <span className="step-ruler-cells">
          {Array.from({ length: pattern.length }, (_, i) => (
            <span key={i} className={`step-ruler-cell${i % 4 === 0 ? " beat" : ""}`}>
              {i % 4 === 0 ? i / 4 + 1 : ""}
            </span>
          ))}
        </span>
      </div>

      <div className="track-list">
        {pattern.tracks.map((track, ti) => (
          <div key={ti} className="track-row">
            <div className="track-head">
              <select value="" onChange={(e) => e.target.value && changePreset(ti, e.target.value)} title="preset">
                <option value="">{track.preset.name}</option>
                {presetList.map((i) => (
                  <option key={i.id} value={i.id}>{i.isFactory ? `★ ${i.name}` : i.name}</option>
                ))}
              </select>
              <input className="tune" type="number" min={20} max={2000} value={Math.round(track.note)}
                onChange={(e) => setNote(ti, Math.min(2000, Math.max(20, Number(e.target.value) || 20)))} title="tune (Hz)" />
              <button type="button" className={`mini${track.mute ? " on" : ""}`} onClick={() => toggleMute(ti)} title="mute">M</button>
              <button type="button" className="mini" onClick={() => audition(ti)} title="audition">♪</button>
              <button type="button" className="mini" onClick={() => removeTrack(ti)} title="remove">×</button>
            </div>
            <div className="seq-steps">
              {track.steps.map((v, si) => (
                <button
                  key={si}
                  type="button"
                  className={`seq-cell${v > 0 ? " on" : ""}${si % 4 === 0 ? " beat" : ""}${playhead === si ? " head" : ""}`}
                  onClick={() => toggleStep(ti, si)}
                  aria-label={`${track.preset.name} step ${si + 1}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <button type="button" className="add-track" onClick={addTrack}>＋ ADD TRACK</button>
    </div>
  );
}
