import React, { useMemo } from 'react';
import { contourDensity } from 'd3-contour';
import { C, FONT } from '@/lib/darkTheme';

// Savant-parity pitch-location density contour. Real d3.contourDensity() KDE
// (not an SVG gradient approximation) rendered with a blue(low)->white->
// red(high) diverging scale, matching the reference example rather than the
// app's usual gold/pitch-type coloring. Renders a strike-zone box + edge
// ticks + plate silhouette to orient the reader, same as the discrete
// ZoneHeatmap grid does for zone splits.
const CW = 190, CH = 240;
const PLATE_HALF_WIDTH = 0.83;
const ZONE_TOP = 3.5, ZONE_BOT = 1.5;
const PAD_TOP = 26, PAD_BOT = 46;
const PLOT_H = CH - PAD_TOP - PAD_BOT;
const SCALE = PLOT_H / 5.2;
const CX = CW / 2;

function toPx(sideFt, heightFt) {
  return { x: CX + sideFt * SCALE, y: PAD_TOP + (ZONE_TOP + 1.1 - heightFt) * SCALE };
}

// Diverging blue -> white -> red, keyed 0 (lowest density) .. 1 (highest).
function divergingColor(t) {
  const stops = [
    [0.19, 0.33, 0.62], // blue
    [0.96, 0.96, 0.94], // near-white
    [0.83, 0.16, 0.16], // red
  ];
  const seg = t < 0.5 ? [stops[0], stops[1], t * 2] : [stops[1], stops[2], (t - 0.5) * 2];
  const [a, b, lt] = seg;
  const mix = (i) => Math.round((a[i] + (b[i] - a[i]) * lt) * 255);
  return `rgb(${mix(0)},${mix(1)},${mix(2)})`;
}

function ContourCell({ pts, label, n }) {
  const contours = useMemo(() => {
    if (pts.length < 15) return null;
    return contourDensity().x(d => d[0]).y(d => d[1]).size([CW, CH]).bandwidth(18).thresholds(14)(pts);
  }, [pts]);

  const zTL = toPx(-PLATE_HALF_WIDTH, ZONE_TOP);
  const zBR = toPx(PLATE_HALF_WIDTH, ZONE_BOT);
  const plateY = CH - 22, plateW = 34, plateH = 16, px0 = CX - plateW / 2;

  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={CW} height={CH} viewBox={`0 0 ${CW} ${CH}`} style={{ background: C.base, borderRadius: 6 }}>
        {contours ? (() => {
          const maxV = Math.max(...contours.map(c => c.value));
          return contours.map((c, i) => {
            const col = divergingColor(maxV ? c.value / maxV : 0);
            return c.coordinates.map((poly, pi) => poly.map((ring, ri) => (
              <path key={`${i}-${pi}-${ri}`} d={'M' + ring.map(pt => `${pt[0].toFixed(1)},${pt[1].toFixed(1)}`).join('L') + 'Z'} fill={col} stroke="none" />
            )));
          });
        })() : (
          <text x={CW / 2} y={CH / 2} textAnchor="middle" fontSize={10} fill={C.muted}>Need 15+ located pitches</text>
        )}
        <line x1={zTL.x - 14} y1={zTL.y} x2={zTL.x - 14} y2={zBR.y} stroke={C.muted} strokeWidth={1.2} />
        <line x1={zBR.x + 14} y1={zTL.y} x2={zBR.x + 14} y2={zBR.y} stroke={C.muted} strokeWidth={1.2} />
        <rect x={zTL.x.toFixed(1)} y={zTL.y.toFixed(1)} width={(zBR.x - zTL.x).toFixed(1)} height={(zBR.y - zTL.y).toFixed(1)} fill="none" stroke={C.cream} strokeWidth={1.4} />
        <polygon points={`${px0},${plateY} ${px0 + plateW},${plateY} ${px0 + plateW},${plateY + plateH * 0.5} ${CX},${plateY + plateH} ${px0},${plateY + plateH * 0.5}`} fill="none" stroke={C.muted} strokeWidth={1.2} />
      </svg>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.cream, marginTop: 6, fontFamily: FONT }}>{label}</div>
      <div style={{ fontSize: 9, color: C.muted, fontFamily: FONT }}>n={n}</div>
    </div>
  );
}

// groups: [{ label, color, pitches }] — pitches need plate_loc_side/height.
export default function LocationContourPlot({ groups }) {
  const cells = useMemo(() => groups.map(g => {
    const pts = g.pitches
      .filter(p => Number.isFinite(parseFloat(p.plate_loc_side)) && Number.isFinite(parseFloat(p.plate_loc_height)))
      .map(p => {
        const { x, y } = toPx(parseFloat(p.plate_loc_side), parseFloat(p.plate_loc_height));
        return [x, y];
      });
    return { label: g.label, pts, n: pts.length };
  }).filter(c => c.n > 0), [groups]);

  if (!cells.length) return <div style={{ color: C.muted, fontSize: 12 }}>No location data.</div>;

  return (
    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
      {cells.map(c => <ContourCell key={c.label} pts={c.pts} label={c.label} n={c.n} />)}
    </div>
  );
}
