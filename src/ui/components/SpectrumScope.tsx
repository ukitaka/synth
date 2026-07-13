import { useEffect, useRef } from "react";
import type { SoundEngine } from "../../engine/SoundEngine";

// Log-frequency spectrum view for the FILTER section: the green area is the
// FFT of what's actually sounding (post-filter), the orange curve is the
// filter's magnitude response — dips in the curve are what's being cut.
// Colors follow the panel language: green = audio, orange = the operator.

const MIN_F = 20;
const MAX_F = 20000;
const MIN_DB = -90;
const MAX_DB = 12; // headroom for resonance peaks above 0 dB
const CURVE_N = 160;

interface Props {
  sound: SoundEngine;
  running: boolean;
}

export function SpectrumScope({ sound, running }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!running) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const logMin = Math.log10(MIN_F);
    const logSpan = Math.log10(MAX_F) - logMin;
    const xOf = (f: number) => ((Math.log10(f) - logMin) / logSpan) * w;
    const yOf = (db: number) =>
      (1 - (Math.min(MAX_DB, Math.max(MIN_DB, db)) - MIN_DB) / (MAX_DB - MIN_DB)) * h;

    // Log-spaced probe frequencies for the response curve (reused each frame).
    const freqs = new Float32Array(CURVE_N);
    for (let i = 0; i < CURVE_N; i++) {
      freqs[i] = Math.pow(10, logMin + (i / (CURVE_N - 1)) * logSpan);
    }
    const mags = new Float32Array(CURVE_N);

    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      // --- playing signal: green filled spectrum ---
      const spec = sound.getSpectrum();
      const binHz = sound.sampleRate / 2 / spec.length;
      ctx.beginPath();
      let started = false;
      let firstX = 0;
      for (let i = 1; i < spec.length; i++) {
        const f = i * binHz;
        if (f < MIN_F) continue;
        if (f > MAX_F) break;
        const x = xOf(f);
        const y = yOf(spec[i]);
        if (!started) {
          ctx.moveTo(x, y);
          firstX = x;
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      if (started) {
        ctx.strokeStyle = "#52ff9d";
        ctx.lineWidth = 1.5;
        ctx.shadowColor = "#52ff9d";
        ctx.shadowBlur = 4;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.lineTo(w, h);
        ctx.lineTo(firstX, h);
        ctx.closePath();
        ctx.fillStyle = "rgba(82, 255, 157, 0.12)";
        ctx.fill();
      }

      // --- filter response: orange curve (dips = cut) ---
      sound.getFilterResponse(freqs, mags);
      ctx.beginPath();
      for (let i = 0; i < CURVE_N; i++) {
        const db = 20 * Math.log10(mags[i] + 1e-7);
        const x = xOf(freqs[i]);
        const y = yOf(db);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = "#ff8a3d";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // faint passband tint under the curve
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fillStyle = "rgba(255, 138, 61, 0.08)";
      ctx.fill();

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [sound, running]);

  return (
    <div className="scope-wrap">
      <canvas ref={canvasRef} className="spectrum" width={520} height={110} />
      <span className="scope-label">SPECTRUM</span>
      <span className="scope-sub">FILTER RESPONSE</span>
    </div>
  );
}
