import { useEffect, useRef } from "react";
import type { MasterBus } from "../../engine/MasterBus";

interface Props {
  master: MasterBus;
  running: boolean;
  /** Optional secondary label, top-right (e.g. "MASTER · PRE-CLIP"). */
  sub?: string;
}

/**
 * Shared oscilloscope. Reads the master bus analyser each animation frame;
 * rAF is used only for drawing, never for audio timing (NFR-02). The glow is a
 * fixed canvas shadowBlur (cheap, no per-frame recomputation) rather than a
 * CSS filter, to keep the redraw loop light.
 */
export function Oscilloscope({ master, running, sub }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!running) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      const data = master.getWaveform();
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = "#52ff9d";
      ctx.shadowColor = "#52ff9d";
      ctx.shadowBlur = 6;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (let i = 0; i < data.length; i++) {
        const x = (i / (data.length - 1)) * w;
        const y = (0.5 - data[i] * 0.48) * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [master, running]);

  return (
    <div className="scope-wrap">
      <canvas ref={canvasRef} className="scope" width={520} height={90} />
      <span className="scope-label">SCOPE</span>
      {sub && <span className="scope-sub">{sub}</span>}
    </div>
  );
}
