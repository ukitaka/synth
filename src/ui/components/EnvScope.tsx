// Envelope display: draws the amp ADSR and the pitch envelope from the current
// params. This is a settings visualization (like the filter response curve),
// not an audio tap — plain SVG re-rendered on knob changes, no rAF.
// Colors follow the panel language: orange = the thing you operate (amp env),
// muted = secondary overlay (pitch env).

const W = 400;
const H = 120;
const PAD = 8;
const HOLD = 0.22; // fixed visual width of the sustain plateau
const MIN_SEG = 0.05; // minimum visual share per A/D/R segment
const MAX_PITCH_OCT = 3; // log2(pitchAmt max 8)

interface Props {
  params: Record<string, number>;
}

export function EnvScope({ params }: Props) {
  const { attack, decay, sustain, release, pitchAmt, pitchTime } = params;

  const usable = W - 2 * PAD;
  const y = (level: number) => H - PAD - level * (H - 2 * PAD);

  // A/D/R widths proportional to their times, clamped to a minimum so a 1ms
  // attack still reads as a segment; sustain plateau is a fixed width.
  const sum = attack + decay + release;
  const raw = [attack, decay, release].map((t) => Math.max(MIN_SEG, (t / sum) * (1 - HOLD)));
  const scale = (1 - HOLD) / (raw[0] + raw[1] + raw[2]);
  const [wA, wD, wR] = raw.map((w) => w * scale * usable);
  const wHold = HOLD * usable;

  const x0 = PAD;
  const xPeak = x0 + wA;
  const xSus = xPeak + wD;
  const xRel = xSus + wHold;
  const xEnd = xRel + wR;

  const ampPath =
    `M ${x0} ${y(0)} L ${xPeak.toFixed(1)} ${y(1)} ` +
    `L ${xSus.toFixed(1)} ${y(sustain)} L ${xRel.toFixed(1)} ${y(sustain)} ` +
    `L ${xEnd.toFixed(1)} ${y(0)}`;
  const ampFill = `${ampPath} L ${xEnd.toFixed(1)} ${y(0)} L ${x0} ${y(0)} Z`;

  // Pitch envelope: starts at note*pitchAmt, falls to the note over pitchTime.
  // Drawn against the attack+decay span so the fast "thump" reads as the
  // narrow spike it really is next to the amp envelope.
  const pitchLevel = Math.min(1, Math.log2(Math.max(1, pitchAmt)) / MAX_PITCH_OCT);
  const preSus = xSus - x0;
  const pitchW = Math.min(preSus, (pitchTime / (attack + decay)) * preSus);
  const pitchPath =
    pitchLevel > 0.005
      ? `M ${x0} ${y(pitchLevel)} Q ${(x0 + pitchW * 0.25).toFixed(1)} ${y(0)} ${(x0 + pitchW).toFixed(1)} ${y(0)} L ${xEnd.toFixed(1)} ${y(0)}`
      : `M ${x0} ${y(0)} L ${xEnd.toFixed(1)} ${y(0)}`;

  return (
    <div className="scope-wrap env-wrap">
      <svg className="env-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <path d={ampFill} fill="rgba(255, 138, 61, 0.08)" stroke="none" />
        <path d={pitchPath} fill="none" stroke="#8e9297" strokeWidth="1.4" strokeDasharray="4 3" />
        <path d={ampPath} fill="none" stroke="#ff8a3d" strokeWidth="1.6" />
      </svg>
      <span className="scope-label">ENVELOPE</span>
      <span className="scope-sub">
        <span style={{ color: "#ff8a3d" }}>AMP</span> · <span>PITCH</span>
      </span>
    </div>
  );
}
