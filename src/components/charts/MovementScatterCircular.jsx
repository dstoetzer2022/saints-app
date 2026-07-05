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
  const W = 460, H = 460, cx0 = W / 2, cy0 = H / 2, SCALE = 9, R = 200;

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

  const isLHP = pitches.some(p => p.pitcher_hand === 'Left');
  const armLabel = isLHP ? 'GLOVE' : 'ARM';
  const gloveLabel = isLHP ? 'ARM' : 'GLOVE';
  const handKey = isLHP ? 'Left' : 'Right';

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

        {[20, 15, 10, 5].map(v => {
          const rad = v * SCALE;
          return (
            <g key={v}>
              <circle cx={cx0} cy={cy0} r={rad} fill="none" stroke={v === 5 ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.09)'} strokeWidth={1} strokeDasharray={v === 20 ? '' : '3 3'} />
              <text x={cx0 + 3} y={cy0 - rad - 3} fontSize={8} fill={C.muted}>{v}"</text>
            </g>
          );
        })}
        <circle cx={cx0} cy={cy0} r={R} fill="none" stroke="rgba(255,255,255,.16)" strokeWidth={1.3} />
        <line x1={cx0} y1={cy0 - R} x2={cx0} y2={cy0 + R} stroke="rgba(255,255,255,.14)" strokeWidth={1} />
        <line x1={cx0 - R} y1={cy0} x2={cx0 + R} y2={cy0} stroke="rgba(255,255,255,.14)" strokeWidth={1} />

        <text x={cx0} y={cy0 - R - 8} textAnchor="middle" fontSize={9} fontWeight={700} fill={C.muted}>RISE</text>
        <text x={cx0} y={cy0 + R + 16} textAnchor="middle" fontSize={9} fontWeight={700} fill={C.muted}>DROP</text>
        <text x={cx0 - R - 10} y={cy0 + 4} textAnchor="end" fontSize={9} fill={C.muted}>{armLabel}</text>
        <text x={cx0 + R + 10} y={cy0 + 4} fontSize={9} fill={C.muted}>{gloveLabel}</text>

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
