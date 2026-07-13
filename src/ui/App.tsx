import { useMemo, useState } from "react";
import { AudioSystem, type Mode } from "../engine/AudioSystem";
import { SoundPanel } from "./components/SoundPanel";
import { PatternPanel } from "./components/PatternPanel";

export function App() {
  const system = useMemo(() => new AudioSystem(), []);
  const [powered, setPowered] = useState(false);
  const [mode, setMode] = useState<Mode>("SOUND");

  const powerOn = async () => {
    await system.powerOn();
    setPowered(true);
  };

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    system.releaseMode(mode); // release outgoing voices (no hard cut)
    setMode(next);
  };

  return (
    <div className="lab1">
      <header className="topbar">
        <span className="brand">LAB-1</span>
        <span className="brand-sub">SUBTRACTIVE GROOVEBOX</span>
        <div className="mode-switch" role="tablist" aria-label="mode">
          {(["SOUND", "PATTERN"] as const).map((m) => (
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
          <span className="power-led">
            <span className="power-led-dot" />
          </span>
          <span>POWER</span>
        </button>
      </header>

      <main className={`panels${powered ? "" : " powered-off"}`}>
        <div style={{ display: mode === "SOUND" ? "block" : "none" }}>
          <SoundPanel system={system} active={powered && mode === "SOUND"} />
        </div>
        <div style={{ display: mode === "PATTERN" ? "block" : "none" }}>
          <PatternPanel system={system} active={powered && mode === "PATTERN"} />
        </div>
        {!powered && <div className="power-hint">POWER を押して音を有効にしてください</div>}
      </main>
    </div>
  );
}
