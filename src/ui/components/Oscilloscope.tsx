import { useEffect, useRef } from "react";
import type { MasterBus } from "../../engine/MasterBus";

interface Props {
  master: MasterBus;
  running: boolean;
}

/**
 * Shared oscilloscope. Reads the master bus analyser each animation frame
 * (FR-012); rAF is used only for drawing, never for audio timing (NFR-02).
 */
export function Oscilloscope({ master, running }: Props) {
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
      ctx.strokeStyle = "#7dffb0";
      ctx.lineWidth = 2;
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

  return <canvas ref={canvasRef} className="scope" width={520} height={90} />;
}
