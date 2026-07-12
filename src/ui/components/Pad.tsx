import type { VoiceId } from "../../engine/types";

interface Props {
  id: VoiceId;
  keyCap: string; // PC key hint, e.g. "Z"
  selected: boolean;
  active: boolean; // lit on trigger (FR-033)
  onDown: (id: VoiceId) => void;
}

/**
 * A drum pad: pressing it triggers the voice AND selects it for editing
 * (design §4). Presentational — DrumPanel owns trigger/lit/selection state.
 * `onPointerDown` (not click) keeps latency low and enables multi-touch;
 * `touchAction: none` stops the browser stealing the gesture for scrolling.
 */
export function Pad({ id, keyCap, selected, active, onDown }: Props) {
  return (
    <button
      type="button"
      className={`pad${selected ? " pad-selected" : ""}${active ? " pad-active" : ""}`}
      style={{ touchAction: "none" }}
      onPointerDown={(e) => {
        e.preventDefault();
        onDown(id);
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="pad-name">{id}</span>
      <span className="pad-key">{keyCap}</span>
    </button>
  );
}
