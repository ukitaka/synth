import { useMemo, useState } from "react";
import { AudioSystem, type Mode } from "../engine/AudioSystem";
import { Oscilloscope } from "./components/Oscilloscope";
import { DrumPanel } from "./components/DrumPanel";
import { SynthPanel } from "./components/SynthPanel";

export function App() {
  // One AudioSystem for the whole app lifetime.
  const system = useMemo(() => new AudioSystem(), []);
  const [powered, setPowered] = useState(false);
  const [mode, setMode] = useState<Mode>("DRUM");

  const powerOn = async () => {
    await system.powerOn();
    setPowered(true);
  };

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    // Release the outgoing mode's voices so nothing is cut abruptly (FR-011).
    system.releaseMode(mode);
    setMode(next);
  };

  return (
    <div className="lab1">
      <header className="topbar">
        <span className="brand">LAB-1</span>
        <div className="mode-switch" role="tablist" aria-label="mode">
          {(["SYNTH", "DRUM"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              className={`mode-btn${mode === m ? " on" : ""}`}
              onClick={() => switchMode(m)}
            >
              {m}
            </button>
          ))}
        </div>
        <button type="button" className={`power${powered ? " on" : ""}`} onClick={powerOn}>
          ● POWER
        </button>
      </header>

      <Oscilloscope master={system.master} running={powered} />

      {!powered && (
        <div className="power-hint">POWER を押して音を有効にしてください</div>
      )}

      <main className="panels">
        <div style={{ display: mode === "DRUM" ? "block" : "none" }}>
          <DrumPanel system={system} active={powered && mode === "DRUM"} />
        </div>
        <div style={{ display: mode === "SYNTH" ? "block" : "none" }}>
          <SynthPanel system={system} active={powered && mode === "SYNTH"} />
        </div>
      </main>
    </div>
  );
}
