import React, { useMemo } from 'react';
import { pitcherProfile, percentileRank, cswKbb } from '@/lib/profileStats';
import { markerColor } from '@/components/shared/PercentileBar';
import { C, FONT } from '@/lib/darkTheme';

// Slim one-line stat ribbon for the sticky profile header (mockup v3, item 2).
// Same stats that previously required scrolling to individual sections, each
// with a small percentile-colored dot using the app's PercentileBar scale.
// Percentile dots only render when the pitcher pool is available; `invert`
// flips the dot for lower-is-better stats (BB%, HardHit%).
export default function PitcherStatRibbon({ pitches, pitcherPool }) {
  const stats = useMemo(() => {
    if (!pitches || pitches.length < 5) return null;
    const prof = pitcherProfile(pitches);
    if (!prof) return null;
    const { cswPct, kbbPct } = cswKbb(pitches);
    const games = new Set(pitches.map(p => p.game_id).filter(Boolean)).size;

    const dot = (raw, poolKey, invert = false) => {
      if (raw == null || !pitcherPool?.[poolKey]?.length) return null;
      const pr = percentileRank(pitcherPool[poolKey], raw);
      if (pr == null) return null;
      return invert ? 100 - pr : pr;
    };
    const p1 = v => v == null ? '—' : (v * 100).toFixed(1) + '%';

    return [
      { k: 'G', v: String(games) },
      { k: 'Pitches', v: String(pitches.length) },
      { k: 'K%', v: p1(prof.kPct), pr: dot(prof.kPct, 'kPct') },
      { k: 'BB%', v: p1(prof.bbPct), pr: dot(prof.bbPct, 'bbPct', true) },
      { k: 'K-BB%', v: kbbPct == null ? '—' : kbbPct + '%' },
      { k: 'CSW%', v: cswPct == null ? '—' : cswPct + '%' },
      { k: 'Strike%', v: p1(prof.strikePct), pr: dot(prof.strikePct, 'strikePct') },
      { k: 'Whiff%', v: p1(prof.whiffPct), pr: dot(prof.whiffPct, 'whiffPct') },
      { k: 'HardHit%', v: p1(prof.hardPct), pr: dot(prof.hardPct, 'hardPct', true) },
      { k: 'Putaway%', v: p1(prof.putawayPct), pr: dot(prof.putawayPct, 'putawayPct') },
    ];
  }, [pitches, pitcherPool]);

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
