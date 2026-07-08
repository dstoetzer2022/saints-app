import React from 'react';

const LABEL = '#8fa8bc';
const VALUE = '#edeae0';
const MUTED = '#4a6070';
const FONT = "'Archivo', system-ui, sans-serif";

// Viz improvement #3: same diverging stops as the dugout heat surfaces
// (HitterViz colorAt / statsUtils divergingColorAt) — blue (47,99,166) ->
// neutral -> red (200,40,44) — so the whole app speaks one color language.
// Neutral is pulled down to 170 (vs 242 on heatmap fills) purely so the
// midpoint marker stays visible against the dark profile background.
function markerColor(pct) {
  const N = 170;
  if (pct <= 50) {
    const t = pct / 50;
    const r = Math.round(47 + (N - 47) * t);
    const g = Math.round(99 + (N - 99) * t);
    const b = Math.round(166 + (N - 166) * t);
    return `rgb(${r},${g},${b})`;
  } else {
    const t = (pct - 50) / 50;
    const r = Math.round(N + (200 - N) * t);
    const g = Math.round(N + (40 - N) * t);
    const b = Math.round(N + (44 - N) * t);
    return `rgb(${r},${g},${b})`;
  }
}

export default function PercentileBar({ label, value, percentile, invert = false, unit = '', labelWidth = 150 }) {
  if (value == null) return null;

  if (percentile == null) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, fontFamily: FONT }}>
        <div style={{ width: labelWidth, flexShrink: 0, textAlign: 'right' }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: LABEL }}>{label} </span>
          <span style={{ fontSize: 11.5, fontWeight: 900, color: VALUE, fontVariantNumeric: 'tabular-nums' }}>{value}{unit}</span>
        </div>
        <div style={{ flex: 1, fontSize: 10.5, color: MUTED, fontStyle: 'italic' }}>small sample</div>
      </div>
    );
  }

  const displayPct = invert ? 100 - percentile : percentile;
  const barPct = Math.max(0, Math.min(100, displayPct));
  const color = markerColor(displayPct);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, fontFamily: FONT }}>
      {/* Label + value on the left */}
      <div style={{ width: labelWidth, flexShrink: 0, textAlign: 'right' }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: LABEL }}>{label} </span>
        <span style={{ fontSize: 11.5, fontWeight: 900, color: VALUE, fontVariantNumeric: 'tabular-nums' }}>{value}{unit}</span>
      </div>

      {/* Track */}
      <div style={{ flex: 1, height: 7, background: 'rgba(255,255,255,0.07)', borderRadius: 3.5, position: 'relative', overflow: 'visible' }}>
        {/* Filled portion */}
        <div style={{
          position: 'absolute', left: 0, top: 0, height: '100%',
          width: `${barPct}%`,
          background: `linear-gradient(to right, #1e4a7a, ${color})`,
          borderRadius: 3.5,
        }} />
        {/* Bubble marker */}
        <div style={{
          position: 'absolute',
          left: `calc(${barPct}% - 11px)`,
          top: -7.5,
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: color,
          border: '2px solid #080f17',
          boxShadow: `0 2px 5px rgba(0,0,0,0.6), 0 0 6px ${color}55`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1,
        }}>
          <span style={{ fontSize: 9, fontWeight: 900, color: '#fff', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{Math.round(displayPct)}</span>
        </div>
      </div>
    </div>
  );
}

export function computePercentile(value, arr) {
  if (!arr || !arr.length || value == null) return null;
  const below = arr.filter(v => v < value).length;
  return (below / arr.length) * 100;
}