import React, { useMemo } from 'react';
import { platoonSplitRows, fmtStat } from '@/lib/profileStats';
import { C, FONT } from '@/lib/darkTheme';

const FONT_STYLE = { fontFamily: FONT };
const pct = v => v == null ? '—' : Math.round(v * 100) + '%';

// side: 'batter_hand' for a pitcher's allowed splits (vs RHH/LHH),
// 'pitcher_hand' for a hitter's own splits (vs RHP/LHP).
export default function PlatoonSplitsTable({ rows, side }) {
  const splits = useMemo(() => platoonSplitRows(rows, side), [rows, side]);
  if (splits.length < 2) return <div style={{ color: C.muted, fontSize: 12 }}>Need enough pitches against both hands to split.</div>;

  const th = { padding: '5px 8px', fontSize: 9, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, textAlign: 'right', ...FONT_STYLE };
  const td = { padding: '7px 8px', fontSize: 12, textAlign: 'right', color: C.cream, fontVariantNumeric: 'tabular-nums', borderBottom: `0.5px solid ${C.edge}`, ...FONT_STYLE };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead><tr>
          <th style={{ ...th, textAlign: 'left' }}>vs</th>
          <th style={th}>PA</th>
          <th style={th}>AVG</th>
          <th style={th}>OBP</th>
          <th style={th}>SLG</th>
          <th style={th}>OPS</th>
          <th style={th}>K%</th>
          <th style={th}>Whiff%</th>
        </tr></thead>
        <tbody>
          {splits.map(s => (
            <tr key={s.label}>
              <td style={{ ...td, textAlign: 'left', fontWeight: 700, color: C.white }}>{s.label}</td>
              <td style={td}>{s.stats.pa}</td>
              <td style={td}>{fmtStat(s.stats.avg)}</td>
              <td style={td}>{fmtStat(s.stats.obp)}</td>
              <td style={td}>{fmtStat(s.stats.slg)}</td>
              <td style={{ ...td, fontWeight: 700, color: C.gold }}>{fmtStat(s.stats.ops)}</td>
              <td style={td}>{pct(s.stats.kPct)}</td>
              <td style={td}>{pct(s.stats.whiffPct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
