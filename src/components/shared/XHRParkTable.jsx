import React, { useMemo } from 'react';
import { xHRParkBreakdown, xHRProfile } from '@/lib/profileStats';
import { C, FONT } from '@/lib/darkTheme';

const FONT_STYLE = { fontFamily: FONT };

// direction: 'for' (hitter's own fly balls) or 'against' (pitcher's allowed).
export default function XHRParkTable({ rows, direction = 'for' }) {
  const breakdown = useMemo(() => xHRParkBreakdown(rows), [rows]);
  const profile = useMemo(() => xHRProfile(rows), [rows]);

  if (!breakdown) return <div style={{ color: C.muted, fontSize: 12, ...FONT_STYLE }}>Need at least 5 fly balls (LA 20°–40°) with distance/bearing recorded.</div>;

  const verb = direction === 'against' ? 'allowed' : 'hit';

  return (
    <div style={FONT_STYLE}>
      {profile && (
        <div style={{ marginBottom: 14, fontSize: 12, color: C.cream }}>
          Of {profile.n} {verb} fly balls: <b style={{ color: C.green }}>{Math.round(profile.noDoubterPct * 100)}%</b> would've left all {profile.ofParks} parks (no-doubter), <b style={{ color: C.gold }}>{Math.round(profile.someParksPct * 100)}%</b> in some parks only, <b style={{ color: C.muted }}>{Math.round(profile.noParksPct * 100)}%</b> in none.
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead><tr>
            <th style={{ textAlign: 'left', padding: '5px 8px', fontSize: 9, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6 }}>Park (CF dist)</th>
            <th style={{ textAlign: 'right', padding: '5px 8px', fontSize: 9, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6 }}>Would-be HR%</th>
          </tr></thead>
          <tbody>
            {breakdown.parks.map(p => (
              <tr key={p.code}>
                <td style={{ padding: '6px 8px', fontSize: 12, color: C.cream, borderBottom: `0.5px solid ${C.edge}` }}>{p.name} <span style={{ color: C.muted }}>({p.cf}')</span></td>
                <td style={{ padding: '6px 8px', fontSize: 12, textAlign: 'right', borderBottom: `0.5px solid ${C.edge}` }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 60, height: 6, background: C.edge, borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${p.pct * 100}%`, height: '100%', background: C.gold }} />
                    </div>
                    <span style={{ color: C.white, fontWeight: 700, minWidth: 32, textAlign: 'right' }}>{Math.round(p.pct * 100)}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 9, color: C.muted, marginTop: 6 }}>
        Distance-only approximation (LA 20°–40° fly balls vs. fence distance by spray angle) — no wall-height data exists for these fields, so this can overstate HRs on low liners and understate them on towering fly balls that die at a tall wall.
      </div>
    </div>
  );
}
