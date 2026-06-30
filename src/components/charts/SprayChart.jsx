import React, { useMemo } from "react";

// Canonical field geometry constants
const W = 400, H = 380;
const CX = W / 2, CY = H - 20; // home plate position (bottom center)
const MAX_DIST = 420;

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
  const { points, stats } = useMemo(() => {
    const bip = pitches.filter(p => p.bearing != null && p.hit_distance != null && p.hit_distance > 0);
    let hard = 0, med = 0, soft = 0;
    const points = bip.map(p => {
      const ev = p.exit_speed;
      // Color by EV: hard=red, medium=gold, soft=teal, unknown=gray
      let color, label;
      if (ev >= 95)       { color = '#E24B4A'; label = 'hard'; hard++; }
      else if (ev >= 80)  { color = '#EF9F27'; label = 'med';  med++;  }
      else if (ev > 0)    { color = '#1D9E75'; label = 'soft'; soft++; }
      else                { color = '#888780'; label = null; }
      // Hit type shape: GB=square, LD=diamond, FB=circle, PU=triangle
      const la = p.launch_angle;
      const shape = la == null ? 'circle' : la < 10 ? 'square' : la < 25 ? 'diamond' : la < 50 ? 'circle' : 'triangle';
      const { x, y } = toXY(p.bearing, p.hit_distance);
      return { x, y, color, shape, ev, dist: p.hit_distance };
    });
    return { points, stats: { hard, med, soft, total: bip.length } };
  }, [pitches]);

  if (!points.length) {
    return <p style={{ textAlign: 'center', color: '#888', padding: 32, fontSize: 13 }}>No batted ball data</p>;
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
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 360, display: 'block' }}>
        {/* Outfield grass */}
        <path d={`M ${CX} ${CY} L ${lfWall.x} ${lfWall.y} A ${H-60} ${H-60} 0 0 1 ${rfWall.x} ${rfWall.y} Z`}
          fill="rgba(29,158,117,.10)" />
        {/* Foul lines */}
        <line x1={CX} y1={CY} x2={lfWall.x} y2={lfWall.y} stroke="rgba(255,255,255,.25)" strokeWidth={1} />
        <line x1={CX} y1={CY} x2={rfWall.x} y2={rfWall.y} stroke="rgba(255,255,255,.25)" strokeWidth={1} />
        {/* Outfield wall arc */}
        <path d={`M ${lfWall.x} ${lfWall.y} A ${H-60} ${H-60} 0 0 1 ${rfWall.x} ${rfWall.y}`}
          fill="none" stroke="rgba(255,255,255,.3)" strokeWidth={1.5} />
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
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8, fontSize: 10, color: '#888', fontFamily: "'Archivo',sans-serif" }}>
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
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4, fontSize: 10, color: '#888', fontFamily: "'Archivo',sans-serif" }}>
        <span>● FB/LD</span>
        <span>■ GB</span>
        <span>◆ LD</span>
        <span>▲ PU</span>
        <span style={{ color: '#aaa' }}>n={stats.total}</span>
      </div>
    </div>
  );
}
