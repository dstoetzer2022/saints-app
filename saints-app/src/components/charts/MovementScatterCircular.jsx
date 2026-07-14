import React, { useMemo } from 'react';
import { normalizePitch, getPitchColor } from '@/lib/ds';
import { C, FONT } from '@/lib/darkTheme';

// Savant-parity circular movement plot. Unlike the old MovementChart (one
// mean dot per pitch type), this renders every individual pitch, clipped to
// a circular boundary with concentric 5"/10"/15"/20" break rings — matching
// Baseball Savant's actual movement-plot shape rather than a square grid.
// leagueAvg (from profileStats.leagueMovementProfile, keyed by same hand) is
// optional; without it the ellipses are simply omitted.
export default function MovementScatterCircular({ pitches, leagueAvg }) {
  const W = 460, H = 460, cx0 = W / 2, cy0 = H / 2, R = 200;

  const byType = useMemo(() => {
    const map = {};
    pitches.forEach(p => {
      const hb = parseFloat(p.horz_break), ivb = parseFloat(p.induced_vert_break);
      if (!Number.isFinite(hb) || !Number.isFinite(ivb)) return;
      const pt = normalizePitch(p.tagged_pitch_type || p.pitch_type);
      (map[pt] = map[pt] || []).push({ hb, ivb });
    });
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
  }, [pitches]);

  const total = byType.reduce((s, [, rows]) => s + rows.length, 0);
  if (!total) return <div style={{ color: C.muted, fontSize: 12 }}>No movement data (horz_break / induced_vert_break) for these pitches.</div>;

  // Dynamic scale: size the axis to the pitcher's actual data (plus league-avg
  // ellipses) so no point ever falls outside the circular clip boundary.
  // Rings are drawn at even fractions of this domain rather than a fixed
  // 5/10/15/20" — a pitcher with unusually big movement gets bigger rings
  // instead of losing points off the edge.
  const isLHP = pitches.some(p => p.pitcher_hand === 'Left');
  const handKey = isLHP ? 'Left' : 'Right';

  const maxDataR = useMemo(() => {
    let m = 0;
    for (const [, rows] of byType) for (const r of rows) {
      m = Math.max(m, Math.hypot(r.hb, r.ivb));
    }
    for (const [pt] of byType) {
      const la = leagueAvg?.[handKey]?.[pt];
      if (la) m = Math.max(m, Math.hypot(la.hbMean, la.ivbMean) + Math.max(la.hbSd, la.ivbSd) * 0.9);
    }
    return m;
  }, [byType, leagueAvg, handKey]);

  const DOMAIN = Math.max(20, Math.ceil((maxDataR * 1.08) / 5) * 5); // 8% pad, snapped to 5"
  const SCALE = R / DOMAIN;
  const ringStep = DOMAIN / 4;
  const rings = [4, 3, 2, 1].map(i => Math.round(ringStep * i));

  // horz_break: positive = arm side, negative = glove side (see
  // PitcherCanvas3D.jsx rel_side convention). Arm-side points plot to the
  // RIGHT (x = cx0 + hb*SCALE grows with positive hb), so the ARM label
  // belongs on the right and GLOVE on the left.
  const rightLabel = isLHP ? 'GLOVE' : 'ARM';
  const leftLabel = isLHP ? 'ARM' : 'GLOVE';

  const clipId = 'moveClip';

  return (
    <div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 8 }}>
        {byType.map(([pt, rows]) => (
          <div key={pt} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: getPitchColor(pt) }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: C.muted, fontFamily: FONT }}>{pt} {(rows.length / total * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 460, display: 'block', margin: '0 auto' }}>
        <defs>
          <clipPath id={clipId}><circle cx={cx0} cy={cy0} r={R} /></clipPath>
        </defs>

        {rings.map(v => {
          const rad = v * SCALE;
          return (
            <g key={v}>
              <circle cx={cx0} cy={cy0} r={rad} fill="none" stroke={v === rings[rings.length - 1] ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.09)'} strokeWidth={1} strokeDasharray={v === rings[0] ? '' : '3 3'} />
              <text x={cx0 + 3} y={cy0 - rad - 3} fontSize={8} fill={C.muted}>{v}"</text>
            </g>
          );
        })}
        <circle cx={cx0} cy={cy0} r={R} fill="none" stroke="rgba(255,255,255,.16)" strokeWidth={1.3} />
        <line x1={cx0} y1={cy0 - R} x2={cx0} y2={cy0 + R} stroke="rgba(255,255,255,.14)" strokeWidth={1} />
        <line x1={cx0 - R} y1={cy0} x2={cx0 + R} y2={cy0} stroke="rgba(255,255,255,.14)" strokeWidth={1} />

        <text x={cx0} y={cy0 - R - 8} textAnchor="middle" fontSize={9} fontWeight={700} fill={C.muted}>RISE</text>
        <text x={cx0} y={cy0 + R + 16} textAnchor="middle" fontSize={9} fontWeight={700} fill={C.muted}>DROP</text>
        <text x={cx0 - R - 10} y={cy0 + 4} textAnchor="end" fontSize={9} fill={C.muted}>{leftLabel}</text>
        <text x={cx0 + R + 10} y={cy0 + 4} fontSize={9} fill={C.muted}>{rightLabel}</text>

        <g clipPath={`url(#${clipId})`}>
          {byType.map(([pt]) => {
            const la = leagueAvg?.[handKey]?.[pt];
            if (!la) return null;
            const ex = cx0 + la.hbMean * SCALE, ey = cy0 - la.ivbMean * SCALE;
            const rx = la.hbSd * SCALE * 0.9, ry = la.ivbSd * SCALE * 0.9;
            const color = getPitchColor(pt);
            return (
              <ellipse key={pt} cx={ex} cy={ey} rx={rx} ry={ry} fill={color} fillOpacity={0.13}
                stroke="rgba(125,147,166,.55)" strokeWidth={1} strokeDasharray="3 2" />
            );
          })}
          {byType.map(([pt, rows]) => {
            const color = getPitchColor(pt);
            return rows.map((r, i) => {
              const x = cx0 + r.hb * SCALE, y = cy0 - r.ivb * SCALE;
              return <circle key={pt + i} cx={x} cy={y} r={3.6} fill={color} fillOpacity={0.75} stroke="rgba(0,0,0,.35)" strokeWidth={0.4} />;
            });
          })}
        </g>
      </svg>

      {leagueAvg?.[handKey] && Object.keys(leagueAvg[handKey]).length > 0 && (
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 6, fontSize: 9, color: C.muted, justifyContent: 'center' }}>
          <span>Shaded ellipse = league avg spread, same-handed pitchers</span>
        </div>
      )}
    </div>
  );
}
