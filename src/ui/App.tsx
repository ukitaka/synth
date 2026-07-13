import { useEffect, useMemo, useState } from "react";
import { AudioSystem, type Mode } from "../engine/AudioSystem";
import { SoundPanel } from "./components/SoundPanel";
import { PatternPanel } from "./components/PatternPanel";

export function App() {
  const system = useMemo(() => new AudioSystem(), []);
  // The UI is live from the start; `powered` only tracks whether the
  // AudioContext has actually been resumed (browsers require a user gesture).
  const [powered, setPowered] = useState(false);
  const [mode, setMode] = useState<Mode>("SOUND");

  const powerOn = async () => {
    await system.powerOn();
    setPowered(true);
  };

  // Auto-start audio on the first interaction anywhere (pointer or key), so
  // the panel behaves as if the power were on by default.
  useEffect(() => {
    const start = () => void powerOn();
    window.addEventListener("pointerdown", start, { once: true });
    window.addEventListener("keydown", start, { once: true });
    return () => {
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      <main className="panels">
        <div style={{ display: mode === "SOUND" ? "block" : "none", height: "100%" }}>
          <SoundPanel system={system} active={mode === "SOUND"} />
        </div>
        <div style={{ display: mode === "PATTERN" ? "block" : "none", height: "100%" }}>
          <PatternPanel system={system} active={mode === "PATTERN"} />
        </div>
      </main>
    </div>
  );
}
