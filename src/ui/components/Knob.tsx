import { useRef } from "react";
import type { ParamSpec } from "../../engine/types";
import { fromNorm, toNorm } from "../param";

const DRAG_RANGE_PX = 180; // full-scale travel for a vertical drag

interface Props {
  spec: ParamSpec;
  value: number;
  onChange: (value: number) => void;
}

/**
 * One rotary knob, generated from a ParamSpec (design §4). Vertical drag edits
 * the value; the pointer angle only reflects state. Works for mouse and touch.
 */
export function Knob({ spec, value, onChange }: Props) {
  const drag = useRef<{ startY: number; startNorm: number } | null>(null);

  const norm = toNorm(value, spec);
  const angle = -135 + norm * 270; // -135deg..+135deg sweep

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
    <div className="knob">
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
        <span className="knob-indicator" style={{ transform: `rotate(${angle}deg)` }} />
      </div>
      <div className="knob-label">{spec.label}</div>
      <div className="knob-value">{spec.fmt(value)}</div>
    </div>
  );
}
