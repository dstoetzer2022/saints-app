import React, { useMemo } from 'react';
import { contourDensity } from 'd3-contour';
import { C, FONT } from '@/lib/darkTheme';

// Savant-parity pitch-location density contour. Real d3.contourDensity() KDE
// (not an SVG gradient approximation) rendered with a blue(low)->white->
// red(high) diverging scale, matching the reference example rather than the
// app's usual gold/pitch-type coloring. Renders a strike-zone box + edge
// ticks + plate silhouette to orient the reader, same as the discrete
// ZoneHeatmap grid does for zone splits.
const DEFAULT_CW = 190, DEFAULT_CH = 240;
const PLATE_HALF_WIDTH = 0.83;
const ZONE_TOP = 3.5, ZONE_BOT = 1.5;
const PAD_TOP = 26, PAD_BOT = 46;

function makeToPx(cw, ch) {
  const plotH = ch - PAD_TOP - PAD_BOT;
  const scale = plotH / 5.2;
  const cx = cw / 2;
  return (sideFt, heightFt) => ({ x: cx + sideFt * scale, y: PAD_TOP + (ZONE_TOP + 1.1 - heightFt) * scale });
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

function MiniSpinClock({ axisDeg, color, size = 24, pal }) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 3;
  const rad = axisDeg != null ? (axisDeg - 90) * Math.PI / 180 : null;
  const tipX = rad != null ? cx + r * Math.cos(rad) : null;
  const tipY = rad != null ? cy + r * Math.sin(rad) : null;
  const sw = size > 24 ? 2.4 : 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={pal.edge} strokeWidth={1} />
      {tipX != null ? (
        <>
          <line x1={cx} y1={cy} x2={tipX} y2={tipY} stroke={color || pal.accent} strokeWidth={sw} />
          <circle cx={cx} cy={cy} r={size > 24 ? 2 : 1.6} fill={color || pal.accent} />
        </>
      ) : (
        <circle cx={cx} cy={cy} r={1.2} fill={pal.muted} />
      )}
    </svg>
  );
}

function ContourCell({ pts, label, n, axisDeg, spinColor, spinGated, cw, ch, minPoints, pal, labelSize, clockSize }) {
  const toPx = useMemo(() => makeToPx(cw, ch), [cw, ch]);
  const contours = useMemo(() => {
    if (pts.length < minPoints) return null;
    return contourDensity().x(d => d[0]).y(d => d[1]).size([cw, ch]).bandwidth(18).thresholds(14)(pts);
  }, [pts, cw, ch]);

  const cx = cw / 2;
  const zTL = toPx(-PLATE_HALF_WIDTH, ZONE_TOP);
  const zBR = toPx(PLATE_HALF_WIDTH, ZONE_BOT);
  const plateY = ch - 22, plateW = 34, plateH = 16, px0 = cx - plateW / 2;

  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={cw} height={ch} viewBox={`0 0 ${cw} ${ch}`} style={{ background: pal.bg, borderRadius: 6 }}>
        {contours ? (() => {
          const maxV = Math.max(...contours.map(c => c.value));
          return contours.map((c, i) => {
            const col = divergingColor(maxV ? c.value / maxV : 0);
            return c.coordinates.map((poly, pi) => poly.map((ring, ri) => (
              <path key={`${i}-${pi}-${ri}`} d={'M' + ring.map(pt => `${pt[0].toFixed(1)},${pt[1].toFixed(1)}`).join('L') + 'Z'} fill={col} stroke="none" />
            )));
          });
        })() : (
          <text x={cw / 2} y={ch / 2} textAnchor="middle" fontSize={10} fill={pal.muted}>Need {minPoints}+ located pitches</text>
        )}
        <line x1={zTL.x - 14} y1={zTL.y} x2={zTL.x - 14} y2={zBR.y} stroke={pal.muted} strokeWidth={1.2} />
        <line x1={zBR.x + 14} y1={zTL.y} x2={zBR.x + 14} y2={zBR.y} stroke={pal.muted} strokeWidth={1.2} />
        <rect x={zTL.x.toFixed(1)} y={zTL.y.toFixed(1)} width={(zBR.x - zTL.x).toFixed(1)} height={(zBR.y - zTL.y).toFixed(1)} fill="none" stroke={pal.zone} strokeWidth={1.4} />
        <polygon points={`${cx},${plateY} ${px0 + plateW},${plateY + plateH * 0.5} ${px0 + plateW},${plateY + plateH} ${px0},${plateY + plateH} ${px0},${plateY + plateH * 0.5}`} fill="none" stroke={pal.muted} strokeWidth={1.2} />
      </svg>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 6 }}>
        <span style={{ fontSize: labelSize, fontWeight: labelSize > 10 ? 800 : 700, color: pal.label, fontFamily: FONT }}>{label}</span>
        {axisDeg !== undefined && <MiniSpinClock axisDeg={axisDeg} color={spinColor} size={clockSize} pal={pal} />}
      </div>
      <div style={{ fontSize: labelSize > 10 ? 9 : 9, color: pal.muted, fontFamily: FONT }}>
        n={n}{axisDeg != null ? ` · spin ${Math.round(axisDeg / 30) % 12 || 12}:00` : (spinGated ? ' · no spin data' : '')}
      </div>
    </div>
  );
}

// groups: [{ label, color, pitches, axisDeg, spinGated }] — pitches need plate_loc_side/height.
// cellWidth/cellHeight: optional per-cell SVG size (defaults preserve existing pitcher-profile sizing);
// pass smaller values when a caller needs more columns to fit on one line without wrapping.
// palette: optional color overrides for non-dark surfaces (the print report
// passes a light paper palette) — the KDE fills themselves stay the same
// blue→white→red density scale everywhere. labelSize/clockSize let print
// callers enlarge the pitch-type caption and spin clock without touching
// the on-screen profile's sizing.
export default function LocationContourPlot({ groups, cellWidth = DEFAULT_CW, cellHeight = DEFAULT_CH, gap = 18, wrap = 'wrap', minPoints = 15, palette, labelSize = 10, clockSize = 24 }) {
  const pal = { bg: C.base, edge: C.edge, muted: C.muted, zone: C.cream, label: C.cream, accent: C.gold, ...palette };
  const toPx = useMemo(() => makeToPx(cellWidth, cellHeight), [cellWidth, cellHeight]);
  const cells = useMemo(() => groups.map(g => {
    const pts = g.pitches
      .filter(p => Number.isFinite(parseFloat(p.plate_loc_side)) && Number.isFinite(parseFloat(p.plate_loc_height)))
      .map(p => {
        const { x, y } = toPx(parseFloat(p.plate_loc_side), parseFloat(p.plate_loc_height));
        return [x, y];
      });
    return { label: g.label, pts, n: pts.length, axisDeg: g.axisDeg, spinColor: g.color, spinGated: g.spinGated };
  }).filter(c => c.n > 0), [groups, toPx]);

  if (!cells.length) return <div style={{ color: pal.muted, fontSize: 12 }}>No location data.</div>;

  return (
    <div style={{ display: 'flex', gap, flexWrap: wrap }}>
      {cells.map(c => (
        <ContourCell key={c.label} pts={c.pts} label={c.label} n={c.n} axisDeg={c.axisDeg} spinColor={c.spinColor} spinGated={c.spinGated} cw={cellWidth} ch={cellHeight} minPoints={minPoints} pal={pal} labelSize={labelSize} clockSize={clockSize} />
      ))}
    </div>
  );
}
