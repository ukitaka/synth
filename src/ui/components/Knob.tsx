import { useRef } from "react";
import type { ParamSpec } from "../../engine/types";
import { fromNorm, toNorm } from "../param";

const DRAG_RANGE_PX = 180; // full-scale travel for a vertical drag

// Ring geometry shared by every knob size (viewBox is size-independent).
const RING_R = 15.5;
const RING_CIRC = 2 * Math.PI * RING_R; // ~97.4
const RING_SWEEP = RING_CIRC * 0.75; // 270° of a full circle, ~73

interface Props {
  spec: ParamSpec;
  value: number;
  onChange: (value: number) => void;
  /** "lg" = main sound params (default), "sm" = FX unit knobs. */
  size?: "lg" | "sm";
}

/**
 * One rotary knob, generated from a ParamSpec. Vertical drag edits the value;
 * the pointer angle only reflects state. Works for mouse and touch.
 *
 * Visually: a static tick ring, a value arc (SVG stroke-dasharray, tracks the
 * knob position), and a metallic cap with a pointer line — all built from the
 * same drag/keyboard model as before (unchanged: pointer capture, dblclick
 * reset, aria-slider). Hover/drag brighten states are pure CSS (:hover/:active).
 */
export function Knob({ spec, value, onChange, size = "lg" }: Props) {
  const drag = useRef<{ startY: number; startNorm: number } | null>(null);

  const norm = toNorm(value, spec);
  const angle = -135 + norm * 270; // -135deg..+135deg sweep
  const arcLen = (norm * RING_SWEEP).toFixed(1);

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, startNorm: norm };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dy = drag.current.startY - e.clientY;
    const next = drag.current.startNorm + dy / DRAG_RANGE_PX;
    onChange(fromNorm(next, spec));
  };
  const endDrag = (e: React.PointerEvent) => {
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  // Double-click resets to default.
  const onDoubleClick = () => onChange(spec.default);

  return (
    <div className={`knob knob-${size}`}>
      <div
        className="knob-dial"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={onDoubleClick}
        role="slider"
        aria-label={spec.label}
        aria-valuemin={spec.min}
        aria-valuemax={spec.max}
        aria-valuenow={value}
      >
        <svg className="knob-ring" viewBox="0 0 40 40">
          <circle className="knob-ring-ticks" cx="20" cy="20" r="18.5" transform="rotate(135 20 20)" />
          <circle className="knob-ring-track" cx="20" cy="20" r={RING_R} transform="rotate(135 20 20)" />
          <circle
            className="knob-ring-value"
            cx="20"
            cy="20"
            r={RING_R}
            strokeDasharray={`${arcLen} ${RING_CIRC.toFixed(1)}`}
            transform="rotate(135 20 20)"
          />
        </svg>
        <div className="knob-cap">
          <span className="knob-indicator" style={{ transform: `rotate(${angle}deg)` }} />
        </div>
      </div>
      <div className="knob-label">{spec.label}</div>
      <div className="knob-value">{spec.fmt(value)}</div>
    </div>
  );
}
