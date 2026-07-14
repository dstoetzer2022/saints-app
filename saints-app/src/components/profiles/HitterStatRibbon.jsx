import React, { useMemo } from 'react';
import { hitterTrackmanProfile, percentileRank } from '@/lib/profileStats';
import { markerColor } from '@/components/shared/PercentileBar';
import { C, FONT } from '@/lib/darkTheme';
import { fmtStat } from '@/lib/profileStats';

// Hitter counterpart to PitcherStatRibbon: slim one-line stat strip for the
// sticky profile header, with percentile dots vs the CCL hitter pool.
// `invert` flips the dot for lower-is-better stats (K%, Whiff%, Chase%).
export default function HitterStatRibbon({ pitches, hitterPool }) {
  const stats = useMemo(() => {
    if (!pitches || pitches.length < 5) return null;
    const prof = hitterTrackmanProfile(pitches);
    if (!prof) return null;
    const games = new Set(pitches.map(p => p.game_id).filter(Boolean)).size;

    const dot = (raw, poolKey, invert = false) => {
      if (raw == null || !hitterPool?.[poolKey]?.length) return null;
      const pr = percentileRank(hitterPool[poolKey], raw);
      if (pr == null) return null;
      return invert ? 100 - pr : pr;
    };
    const p1 = v => v == null ? '—' : (v * 100).toFixed(1) + '%';

    return [
      { k: 'G', v: String(games) },
      { k: 'Pitches', v: String(pitches.length) },
      { k: 'AVG', v: prof.avg != null ? fmtStat(prof.avg) : '—', pr: dot(prof.avg, 'avg') },
      { k: 'SLG', v: prof.slg != null ? fmtStat(prof.slg) : '—', pr: dot(prof.slg, 'slg') },
      { k: 'K%', v: p1(prof.kPct), pr: dot(prof.kPct, 'kPct', true) },
      { k: 'BB%', v: p1(prof.bbPct), pr: dot(prof.bbPct, 'bbPct') },
      { k: 'Whiff%', v: p1(prof.whiffPct), pr: dot(prof.whiffPct, 'whiffPct', true) },
      { k: 'Chase%', v: p1(prof.chasePct), pr: dot(prof.chasePct, 'chasePct', true) },
      { k: 'HardHit%', v: p1(prof.hardPct), pr: dot(prof.hardPct, 'hardPct') },
      { k: 'BABIP', v: prof.babip != null ? fmtStat(prof.babip) : '—', pr: dot(prof.babip, 'babip') },
    ];
  }, [pitches, hitterPool]);

  if (!stats) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '5px 14px', margin: '0 28px 8px',
      background: 'rgba(17,31,46,0.6)', border: `1px solid ${C.edge}`, borderRadius: 6,
      overflowX: 'auto', whiteSpace: 'nowrap', fontFamily: FONT, flexShrink: 0,
    }}>
      {stats.map(s => (
        <span key={s.k} style={{ display: 'flex', alignItems: 'baseline', gap: 5, fontSize: 11.5, flexShrink: 0 }}>
          <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6, color: C.muted }}>{s.k}</span>
          <span style={{ fontWeight: 900, color: C.white, fontVariantNumeric: 'tabular-nums' }}>{s.v}</span>
          {s.pr != null && (
            <span style={{ width: 6, height: 6, borderRadius: '50%', alignSelf: 'center', background: markerColor(s.pr) }} />
          )}
        </span>
      ))}
    </div>
  );
}
