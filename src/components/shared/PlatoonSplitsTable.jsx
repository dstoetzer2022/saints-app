import React, { useMemo, useState } from 'react';
import { platoonSplitRows, fmtStat } from '@/lib/profileStats';
import { C, FONT } from '@/lib/darkTheme';

const FONT_STYLE = { fontFamily: FONT };
const pct = v => v == null ? '—' : Math.round(v * 100) + '%';

const STAT_DEFS = [
  { key: 'pa', label: 'PA', fmt: v => v ?? '—' },
  { key: 'avg', label: 'AVG', fmt: fmtStat },
  { key: 'obp', label: 'OBP', fmt: fmtStat },
  { key: 'slg', label: 'SLG', fmt: fmtStat },
  { key: 'kPct', label: 'K%', fmt: pct },
  { key: 'whiffPct', label: 'Whiff%', fmt: pct },
];

function SplitCard({ split }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: '1 1 220px', background: hovered ? C.raised : C.base,
        border: `1px solid ${hovered ? C.gold : C.edge}`, borderRadius: 10,
        padding: '14px 16px', transition: 'all 0.15s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: C.white, ...FONT_STYLE }}>{split.label}</span>
        <span style={{ fontSize: 20, fontWeight: 900, color: C.gold, fontVariantNumeric: 'tabular-nums', ...FONT_STYLE }}>{fmtStat(split.stats.ops)}</span>
      </div>
      <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, ...FONT_STYLE }}>OPS</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px 6px', borderTop: `1px solid ${C.edge}`, paddingTop: 10 }}>
        {STAT_DEFS.map(d => (
          <div key={d.key} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, ...FONT_STYLE }}>{d.label}</div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.cream, marginTop: 2, fontVariantNumeric: 'tabular-nums', ...FONT_STYLE }}>{d.fmt(split.stats[d.key])}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// side: 'batter_hand' for a pitcher's allowed splits (vs RHH/LHH),
// 'pitcher_hand' for a hitter's own splits (vs RHP/LHP).
export default function PlatoonSplitsTable({ rows, side }) {
  const splits = useMemo(() => platoonSplitRows(rows, side), [rows, side]);
  if (splits.length < 2) return <div style={{ color: C.muted, fontSize: 12 }}>Need enough pitches against both hands to split.</div>;

  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
      {splits.map(s => <SplitCard key={s.label} split={s} />)}
    </div>
  );
}
