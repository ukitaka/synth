import { useEffect, useState } from "react";
import type { AudioSystem } from "../../engine/AudioSystem";
import { VOICE_IDS, type Pattern, type VoiceId } from "../../engine/types";
import { PatternControls } from "./PatternControls";

interface Props {
  system: AudioSystem;
  active: boolean;
}

/**
 * 16-step x 6-track sequencer UI (FR-050..056). All timing lives in the
 * Sequencer engine (Transport); this component only edits the pattern and
 * reflects the playhead the engine pushes back through Tone.Draw (FR-053).
 */
export function SequencerPanel({ system, active }: Props) {
  const seq = system.sequencer;
  const [pattern, setPattern] = useState<Pattern>(() => seq.getPattern());
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(-1);

  // Receive playhead updates from the engine (audio-clock driven).
  useEffect(() => {
    seq.setPlayheadCallback((step) => setPlayhead(step));
    return () => seq.setPlayheadCallback(null);
  }, [seq]);

  // Stop the transport if this panel/mode goes away.
  useEffect(() => {
    if (!active && playing) {
      seq.stop();
      setPlaying(false);
    }
  }, [active, playing, seq]);

  const apply = (next: Pattern) => {
    setPattern(next);
    seq.setPattern(next); // live edit reflected next step (FR-054)
  };

  const toggle = (id: VoiceId, i: number) => {
    const track = pattern.tracks[id] ?? [];
    const nextTrack = track.slice();
    nextTrack[i] = nextTrack[i] > 0 ? 0 : 1;
    apply({ ...pattern, tracks: { ...pattern.tracks, [id]: nextTrack } });
  };

  const setBpm = (bpm: number) => apply({ ...pattern, bpm });
  const setSwing = (swing: number) => apply({ ...pattern, swing });

  const playStop = () => {
    if (playing) {
      seq.stop();
      setPlaying(false);
    } else {
      seq.start();
      setPlaying(true);
    }
  };

  return (
    <div className="seq-panel">
      <PatternControls store={system.patterns} getCurrent={() => seq.getPattern()} onApply={apply} />

      <div className="transport">
        <button type="button" className={`play-btn${playing ? " on" : ""}`} onClick={playStop}>
          {playing ? "■ STOP" : "▶ PLAY"}
        </button>
        <label className="transport-ctl">
          BPM
          <input
            type="number"
            min={40}
            max={220}
            value={Math.round(pattern.bpm)}
            onChange={(e) => setBpm(Math.min(220, Math.max(40, Number(e.target.value) || 40)))}
          />
        </label>
        <label className="transport-ctl">
          SWING
          <input
            type="range"
            min={0}
            max={75}
            value={Math.round(pattern.swing * 100)}
            onChange={(e) => setSwing(Number(e.target.value) / 100)}
          />
          <span>{Math.round(pattern.swing * 100)}%</span>
        </label>
      </div>

      <div className="seq-grid">
        {VOICE_IDS.map((id) => (
          <div key={id} className="seq-row">
            <span className="seq-track">{id}</span>
            <div className="seq-steps">
              {Array.from({ length: pattern.length }, (_, i) => {
                const on = (pattern.tracks[id]?.[i] ?? 0) > 0;
                const beat = i % 4 === 0;
                return (
                  <button
                    key={i}
                    type="button"
                    className={`seq-cell${on ? " on" : ""}${beat ? " beat" : ""}${playhead === i ? " head" : ""}`}
                    onClick={() => toggle(id, i)}
                    aria-label={`${id} step ${i + 1}`}
                    aria-pressed={on}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
