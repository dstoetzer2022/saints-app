import React from 'react';

// ── Baserunner Report table (Team Report combined flow) ────────────────────
// New JSX rendering of the same data BaserunnerReport.jsx's standalone
// window-print already shows, built in PrintProfileReport's visual language
// for consistency with the rest of the combined document. The standalone
// modal's own print button is untouched — it still opens its own window
// with its own (working) HTML string, unchanged by this addition. This is a
// deliberate, disclosed trade-off: the same report now has two renderings
// (documented risk of drift) rather than a larger, riskier refactor of the
// already-working standalone flow in the same pass as this feature.
const INK = '#1a1a1a';
const MUT = '#666';
const GOLD = '#b8860b';
const REPORT_FONT = "'Archivo', system-ui, sans-serif";
const LINE = '#e4e7ea';

const SPEED_LABELS = { fast: 'Fast', average: 'Average', slow: 'Slow' };
const AGGR_LABELS = { aggressive: 'Aggressive', average: 'Average', passive: 'Passive' };
const SPEED_DOT = { fast: '#1a7a3a', average: '#a8780a', slow: '#b53030' };
const AGGR_DOT = { aggressive: '#1a7a3a', average: '#a8780a', passive: '#b53030' };

function Dot({ color }) {
  return <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', marginRight: 4, verticalAlign: 'middle', background: color }} />;
}

export default function BaserunnerReportTable({ team, obs }) {
  if (!obs.length) {
    return <div style={{ fontFamily: REPORT_FONT, color: MUT, fontSize: 12, padding: '20px 0' }}>No baserunner observations found for {team.name}.</div>;
  }

  const summary = [
    { label: 'Runners', value: obs.length },
    { label: 'SB Att', value: obs.reduce((a, o) => a + (o.steal_attempts || 0), 0) },
    { label: 'SB Suc', value: obs.reduce((a, o) => a + (o.steals_successful || 0), 0) },
    { label: 'Fast', value: obs.filter(o => o.speed_rating === 'fast').length },
    { label: 'Aggressive', value: obs.filter(o => o.aggression_rating === 'aggressive').length },
  ];

  return (
    <div style={{ fontFamily: REPORT_FONT, color: INK }}>
      <style>{`.brt-row { page-break-inside: avoid; break-inside: avoid; }`}</style>
      <div style={{ borderBottom: `2.5px solid ${INK}`, paddingBottom: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2.5, textTransform: 'uppercase', color: GOLD }}>Baserunner Report</div>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.4, marginTop: 3 }}>{team.name}</div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {summary.map(s => (
          <div key={s.label} style={{ border: `1px solid ${LINE}`, borderRadius: 6, padding: '6px 12px', textAlign: 'center', minWidth: 64 }}>
            <div style={{ fontSize: 8, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.1, color: MUT }}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: INK }}>{s.value}</div>
          </div>
        ))}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['#', 'Name', 'Pos', 'Bats', 'Speed', 'Aggression', 'Lead (1B)', 'SB', 'PO Att', 'Dirt Adv', 'Notes'].map(h => (
              <th key={h} style={{ fontSize: 8.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6, color: '#fff', background: '#0e253a', textAlign: 'left', padding: '5px 7px', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {obs.map((o, i) => {
            const stealPct = o.steal_attempts > 0 ? Math.round((o.steals_successful || 0) / o.steal_attempts * 100) : null;
            const sbCell = o.steal_attempts > 0 ? `${o.steals_successful ?? 0}/${o.steal_attempts}${stealPct != null ? ` (${stealPct}%)` : ''}` : '—';
            const td = { fontSize: 11, padding: '5px 7px', borderBottom: `1px solid ${LINE === '#e4e7ea' ? '#eee' : LINE}`, verticalAlign: 'top', background: i % 2 === 1 ? '#fafafa' : 'transparent' };
            return (
              <tr key={o.id || i} className="brt-row">
                <td style={{ ...td, textAlign: 'center' }}>{o.jersey_number || '—'}</td>
                <td style={{ ...td, fontWeight: 800, color: INK, whiteSpace: 'nowrap' }}>{o.runner_name || '—'}</td>
                <td style={td}>{o.position || '—'}</td>
                <td style={td}>{o.bats ? o.bats + 'HB' : '—'}</td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>{o.speed_rating ? <><Dot color={SPEED_DOT[o.speed_rating] || '#999'} />{SPEED_LABELS[o.speed_rating] || o.speed_rating}</> : '—'}</td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>{o.aggression_rating ? <><Dot color={AGGR_DOT[o.aggression_rating] || '#999'} />{AGGR_LABELS[o.aggression_rating] || o.aggression_rating}</> : '—'}</td>
                <td style={td}>{o.lead_size_1b || '—'}</td>
                <td style={{ ...td, textAlign: 'center' }}>{sbCell}</td>
                <td style={{ ...td, textAlign: 'center' }}>{o.pickoff_attempts || '—'}</td>
                <td style={{ ...td, textAlign: 'center' }}>{o.dirt_ball_advances || '—'}</td>
                <td style={{ ...td, fontStyle: 'italic', color: '#555' }}>{o.notes || ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
