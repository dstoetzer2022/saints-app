import React, { useMemo, useState } from "react";
import { C, FONT } from '@/lib/darkTheme';
import { fenceArcPath } from '@/lib/profileStats';

// Park fence overlay (per audit): profile spray charts aggregate a whole
// season across every venue played, so there's no single "the game's park"
// to draw. Brookside (the Saints' own park) is used as a fixed reference —
// same convention as the dugout's road-game behavior — so distances read
// consistently regardless of where any individual ball was actually hit.
const REFERENCE_PARK = 'ARR_SEC';

// Canonical field geometry constants
const W = 400, H = 380;
const CX = W / 2, CY = H - 20; // home plate position (bottom center)
const MAX_DIST = 420;

const HIT_TYPES = [
  { key: 'all', label: 'All types' },
  { key: 'GB', label: 'Ground balls' },
  { key: 'LD', label: 'Line drives' },
  { key: 'FB', label: 'Fly balls' },
  { key: 'PU', label: 'Pop ups' },
];
const EV_BINS = [
  { key: 'all', label: 'All exit velos' },
  { key: 'soft', label: '<80 mph' },
  { key: 'med', label: '80–94 mph' },
  { key: 'hard', label: '95+ mph' },
];
const RESULT_FILTERS = [
  { key: 'all', label: 'All balls in play' },
  { key: 'hits', label: 'Hits only' },
];

function hitTypeOf(la) {
  if (la == null) return null;
  return la < 10 ? 'GB' : la < 25 ? 'LD' : la < 50 ? 'FB' : 'PU';
}
function evBinOf(ev) {
  if (ev == null || ev <= 0) return null;
  return ev >= 95 ? 'hard' : ev >= 80 ? 'med' : 'soft';
}

const selectStyle = {
  background: C.raised, color: C.cream, border: `1px solid ${C.edge}`, borderRadius: 5,
  padding: '5px 8px', fontSize: 11, fontFamily: FONT,
};

// Convert bearing (degrees, 0=CF, neg=LF, pos=RF) + distance to SVG coords
function toXY(bearing, dist) {
  const rad = (bearing * Math.PI) / 180;
  const norm = Math.min(dist / MAX_DIST, 1);
  // Scale so 420ft fills ~90% of chart height
  const r = norm * (H - 60);
  return {
    x: CX + Math.sin(rad) * r,
    y: CY - Math.cos(rad) * r,
  };
}

// Arc path from left foul line to right foul line at a given distance
function arcPath(dist) {
  const norm = Math.min(dist / MAX_DIST, 1);
  const r = norm * (H - 60);
  const leftAngle = -45 * Math.PI / 180;
  const rightAngle = 45 * Math.PI / 180;
  const x1 = CX + Math.sin(leftAngle) * r;
  const y1 = CY - Math.cos(leftAngle) * r;
  const x2 = CX + Math.sin(rightAngle) * r;
  const y2 = CY - Math.cos(rightAngle) * r;
  return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
}

// Foul line endpoint at a given distance
function foulPt(side, dist) { // side: -1 = left, 1 = right
  const angle = side * 45 * Math.PI / 180;
  const r = Math.min(dist / MAX_DIST, 1) * (H - 60);
  return { x: CX + Math.sin(angle) * r, y: CY - Math.cos(angle) * r };
}

export default function SprayChart({ pitches }) {
  const [resultFilter, setResultFilter] = useState('all');
  const [hitType, setHitType] = useState('all');
  const [evBin, setEvBin] = useState('all');

  const { points, stats, totalBip } = useMemo(() => {
    const bip = pitches.filter(p => p.pitch_call === 'InPlay' && p.bearing != null && p.hit_distance != null && p.hit_distance > 0);
    const filtered = bip.filter(p => {
      if (resultFilter === 'hits' && !['Single', 'Double', 'Triple', 'HomeRun'].includes(p.play_result)) return false;
      if (hitType !== 'all' && hitTypeOf(p.launch_angle) !== hitType) return false;
      if (evBin !== 'all' && evBinOf(p.exit_speed) !== evBin) return false;
      return true;
    });
    let hard = 0, med = 0, soft = 0;
    const points = filtered.map(p => {
      const ev = p.exit_speed;
      let color;
      if (ev >= 95)       { color = '#E24B4A'; hard++; }
      else if (ev >= 80)  { color = '#EF9F27'; med++;  }
      else if (ev > 0)    { color = '#1D9E75'; soft++; }
      else                { color = '#888780'; }
      // Hit type shape: GB=square, LD=diamond, FB=circle, PU=triangle
      const la = p.launch_angle;
      const shape = la == null ? 'circle' : la < 10 ? 'square' : la < 25 ? 'diamond' : la < 50 ? 'circle' : 'triangle';
      const { x, y } = toXY(p.bearing, p.hit_distance);
      return { x, y, color, shape, ev, dist: p.hit_distance };
    });
    return { points, stats: { hard, med, soft, total: filtered.length }, totalBip: bip.length };
  }, [pitches, resultFilter, hitType, evBin]);

  const fencePath = useMemo(() => fenceArcPath(REFERENCE_PARK, toXY), []);

  const controls = (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 10 }}>
      <select value={resultFilter} onChange={e => setResultFilter(e.target.value)} style={selectStyle}>
        {RESULT_FILTERS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>
      <select value={hitType} onChange={e => setHitType(e.target.value)} style={selectStyle}>
        {HIT_TYPES.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>
      <select value={evBin} onChange={e => setEvBin(e.target.value)} style={selectStyle}>
        {EV_BINS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>
    </div>
  );

  if (!totalBip) {
    return <p style={{ textAlign: 'center', color: C.muted, padding: 32, fontSize: 13, fontFamily: FONT }}>No batted ball data</p>;
  }
  if (!points.length) {
    return (
      <div>
        {controls}
        <p style={{ textAlign: 'center', color: C.muted, padding: 32, fontSize: 13, fontFamily: FONT }}>No batted balls match this filter.</p>
      </div>
    );
  }

  const lfWall = foulPt(-1, MAX_DIST);
  const rfWall = foulPt(1, MAX_DIST);
  const cfTop  = toXY(0, MAX_DIST);

  // Infield diamond (90ft bases, scaled)
  const base = 90 / MAX_DIST * (H - 60);
  const diamond = [
    { x: CX,          y: CY },           // home
    { x: CX - base * 0.707, y: CY - base * 0.707 }, // 3B
    { x: CX,          y: CY - base * 1.414 }, // 2B
    { x: CX + base * 0.707, y: CY - base * 0.707 }, // 1B
  ];
  const dPts = diamond.map(p => `${p.x},${p.y}`).join(' ');

  function renderDot(p, i) {
    const r = 4;
    if (p.shape === 'square') {
      return <rect key={i} x={p.x - r} y={p.y - r} width={r*2} height={r*2}
        fill={p.color} fillOpacity={0.82} stroke="rgba(0,0,0,.25)" strokeWidth={0.5} />;
    }
    if (p.shape === 'diamond') {
      return <polygon key={i} points={`${p.x},${p.y-r} ${p.x+r},${p.y} ${p.x},${p.y+r} ${p.x-r},${p.y}`}
        fill={p.color} fillOpacity={0.82} stroke="rgba(0,0,0,.25)" strokeWidth={0.5} />;
    }
    if (p.shape === 'triangle') {
      return <polygon key={i} points={`${p.x},${p.y-r} ${p.x+r},${p.y+r} ${p.x-r},${p.y+r}`}
        fill={p.color} fillOpacity={0.65} stroke="rgba(0,0,0,.25)" strokeWidth={0.5} />;
    }
    return <circle key={i} cx={p.x} cy={p.y} r={r}
      fill={p.color} fillOpacity={0.82} stroke="rgba(0,0,0,.25)" strokeWidth={0.5} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {controls}
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 360, display: 'block' }}>
        {/* Outfield grass */}
        <path d={`M ${CX} ${CY} L ${lfWall.x} ${lfWall.y} A ${H-60} ${H-60} 0 0 1 ${rfWall.x} ${rfWall.y} Z`}
          fill="rgba(29,158,117,.10)" />
        {/* Foul lines */}
        <line x1={CX} y1={CY} x2={lfWall.x} y2={lfWall.y} stroke="rgba(255,255,255,.25)" strokeWidth={1} />
        <line x1={CX} y1={CY} x2={rfWall.x} y2={rfWall.y} stroke="rgba(255,255,255,.25)" strokeWidth={1} />
        {/* Outfield wall — real Brookside (Saints home park) fence shape,
            per audit. Shown as a reference line (dashed) since a season's
            worth of balls were hit across many different venues; a solid
            uniform-radius arc here previously implied every CCL park is a
            perfect circle at 420ft, which none are. */}
        {fencePath ? (
          <path d={fencePath} fill="none" stroke="rgba(200,146,12,.45)" strokeWidth={1.5} strokeDasharray="5 3" />
        ) : (
          <path d={`M ${lfWall.x} ${lfWall.y} A ${H-60} ${H-60} 0 0 1 ${rfWall.x} ${rfWall.y}`}
            fill="none" stroke="rgba(255,255,255,.3)" strokeWidth={1.5} />
        )}
        {/* Distance arcs */}
        {[200, 300, 370].map(d => (
          <path key={d} d={arcPath(d)} fill="none"
            stroke="rgba(255,255,255,.10)" strokeWidth={1} strokeDasharray="4 3" />
        ))}
        {/* Distance labels */}
        {[200, 300, 370].map(d => {
          const { x, y } = toXY(0, d);
          return <text key={d} x={x} y={y - 4} textAnchor="middle" fontSize={8}
            fill="rgba(255,255,255,.3)" fontFamily="'Archivo',sans-serif">{d}</text>;
        })}
        {/* Infield dirt */}
        <polygon points={dPts} fill="rgba(180,140,80,.12)" stroke="rgba(255,255,255,.18)" strokeWidth={1} />
        {/* Pitcher's mound */}
        <circle cx={CX} cy={diamond[2].y + (CY - diamond[2].y) * 0.43} r={5}
          fill="rgba(180,140,80,.25)" stroke="rgba(255,255,255,.15)" strokeWidth={1} />
        {/* Home plate */}
        <polygon points={`${CX},${CY-7} ${CX+5},${CY-3} ${CX+5},${CY+3} ${CX-5},${CY+3} ${CX-5},${CY-3}`}
          fill="rgba(255,255,255,.7)" />
        {/* Batted ball dots — GBs first so FBs render on top */}
        {[...points].sort((a, b) => a.shape === 'circle' ? 1 : -1).map(renderDot)}
        {/* Pull/Oppo labels */}
        <text x={18} y={CY - 30} fontSize={9} fontWeight={700} fill="rgba(255,255,255,.4)" fontFamily="'Archivo',sans-serif">LF</text>
        <text x={W - 18} y={CY - 30} textAnchor="end" fontSize={9} fontWeight={700} fill="rgba(255,255,255,.4)" fontFamily="'Archivo',sans-serif">RF</text>
        <text x={CX} y={28} textAnchor="middle" fontSize={9} fontWeight={700} fill="rgba(255,255,255,.35)" fontFamily="'Archivo',sans-serif">CF</text>
      </svg>

      {/* Legend row */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8, fontSize: 10, color: C.muted, fontFamily: FONT }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#E24B4A', display: 'inline-block' }} /> Hard 95+
          {stats.hard > 0 && <span style={{ color: '#E24B4A', fontWeight: 700 }}>({stats.hard})</span>}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF9F27', display: 'inline-block' }} /> Med 80–94
          {stats.med > 0 && <span style={{ color: '#EF9F27', fontWeight: 700 }}>({stats.med})</span>}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1D9E75', display: 'inline-block' }} /> Soft &lt;80
          {stats.soft > 0 && <span style={{ color: '#1D9E75', fontWeight: 700 }}>({stats.soft})</span>}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4, fontSize: 10, color: C.muted, fontFamily: FONT }}>
        <span>● FB/LD</span>
        <span>■ GB</span>
        <span>◆ LD</span>
        <span>▲ PU</span>
        {fencePath && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 12, height: 0, borderTop: '1.5px dashed rgba(200,146,12,.6)', display: 'inline-block' }} />
            Brookside fence (ref)
          </span>
        )}
        <span style={{ color: C.cream }}>n={stats.total} of {totalBip}</span>
      </div>
    </div>
  );
}
