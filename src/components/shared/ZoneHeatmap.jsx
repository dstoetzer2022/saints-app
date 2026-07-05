import React from 'react';

// AUDIT (Savant-parity): shared zone-grid heatmap — used by both the pitcher
// profile (pitch-location density) and the hitter profile (swing/whiff by
// zone). One implementation, two color modes.
//
// mode='usage'  → color intensity = usage% (how often pitched here)
// mode='whiff'  → color intensity = whiff% (how often swung-and-missed here)
// Cells flagged lowN render neutral gray, never a misleading extreme
// percentage off a handful of pitches (matches the app-wide minimum-N rule).

const GOLD = '#c8920c';
const RED = '#d4534f';
const NEUTRAL = '#1e3448';
const MUTED = '#7d93a6';

export default function ZoneHeatmap({ cells, mode = 'usage', label }) {
  if (!cells || cells.length !== 9) return null;

  const colorFor = cell => {
    if (mode === 'usage') {
      if (cell.usagePct == null || cell.count === 0) return NEUTRAL;
      const t = Math.min(1, cell.usagePct / 25); // 25%+ usage = full intensity
      return mixHex(NEUTRAL, GOLD, t);
    }
    if (cell.lowN || cell.whiffPct == null) return NEUTRAL;
    const t = Math.min(1, cell.whiffPct / 50); // 50%+ whiff = full intensity
    return mixHex(NEUTRAL, RED, t);
  };

  const valueFor = cell => {
    if (mode === 'usage') return cell.count > 0 ? `${cell.usagePct}%` : '—';
    return cell.lowN || cell.whiffPct == null ? '—' : `${cell.whiffPct}%`;
  };

  return (
    <div>
      {label && (
        <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
          {label}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3, maxWidth: 180 }}>
        {cells.map((c, i) => {
          const val = valueFor(c);
          const rowLabel = ['top', 'middle', 'bottom'][Math.floor(i / 3)];
          const colLabel = ['left', 'center', 'right'][i % 3];
          return (
            <div
              key={i}
              role="img"
              aria-label={`${rowLabel} ${colLabel} zone: ${val === '—' ? 'not enough pitches' : val}`}
              style={{
                background: colorFor(c), borderRadius: 4, aspectRatio: '1',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <span aria-hidden="true" style={{ fontSize: 11, fontWeight: 700, color: '#f4f2ec', fontVariantNumeric: 'tabular-nums' }}>
                {val}
              </span>
            </div>
          );
        })}
      </div>
      {mode === 'whiff' && (
        <div style={{ fontSize: 9, color: MUTED, marginTop: 6 }}>Cells with fewer than 5 swings show "—" (too small a sample to trust).</div>
      )}
    </div>
  );
}

function mixHex(a, b, t) {
  const pa = hexToRgb(a), pb = hexToRgb(b);
  const r = Math.round(pa.r + (pb.r - pa.r) * t);
  const g = Math.round(pa.g + (pb.g - pa.g) * t);
  const bl = Math.round(pa.b + (pb.b - pa.b) * t);
  return `rgb(${r},${g},${bl})`;
}
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}
