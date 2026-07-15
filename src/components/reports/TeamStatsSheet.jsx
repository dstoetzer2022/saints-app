import React from 'react';
import { H_COLS, P_COLS, N, raw, trueIP, hitterLeaders, pitcherLeaders } from '@/lib/officialTeamStatsPdf';

// ── Team Stats Sheet (portrait) ─────────────────────────────────────────────
// Approved mockup, 2026-07-15: replaces the old Trackman-derived slash-line
// version. Renders the official PrestoSports box score (uploaded PDF,
// parsed client-side by officialTeamStatsPdf.js) — full column set, exactly
// what a coach expects from the season stat sheet. No Base44 writes; the
// parsed data lives only in TeamReportBuilder's component state.
const INK = '#1a1a1a';
const MUT = '#666';
const GOLD = '#b8860b';
const REPORT_FONT = "'Archivo', system-ui, sans-serif";
const LINE = '#e4e7ea';
const NAVY = '#0e253a';

function StatTable({ title, cols, colLabel, rows, totals, totalsKey, oppKey, allCols, formatCell }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: GOLD, marginBottom: 6 }}>{title}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
        <thead>
          <tr>
            <th style={{ fontSize: 7.5, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase', color: '#fff', background: NAVY, padding: '4px 5px', textAlign: 'left' }}>#</th>
            <th style={{ fontSize: 7.5, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase', color: '#fff', background: NAVY, padding: '4px 5px', textAlign: 'left' }}>{colLabel}</th>
            {cols.map(c => (
              <th key={c} style={{ fontSize: 7.5, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase', color: '#fff', background: NAVY, padding: '4px 5px', textAlign: 'right', whiteSpace: 'nowrap' }}>{c === 'OB' ? 'OBP' : c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.num + r.name} style={{ background: i % 2 === 1 ? '#fafafa' : 'transparent' }}>
              <td style={{ fontSize: 8.5, color: '#999', padding: '3.5px 5px', borderBottom: `1px solid ${LINE}`, textAlign: 'center' }}>{r.num}</td>
              <td style={{ fontSize: 9.5, fontWeight: 800, color: INK, padding: '3.5px 5px', borderBottom: `1px solid ${LINE}`, whiteSpace: 'nowrap' }}>{r.name}</td>
              {cols.map(c => (
                <td key={c} style={{ fontSize: 9, color: '#333', padding: '3.5px 5px', borderBottom: `1px solid ${LINE}`, textAlign: 'right', fontWeight: (c === 'AVG' || c === 'OB' || c === 'SLG' || c === 'ERA' || c === 'BAVG') ? 800 : 400 }}>
                  {formatCell ? formatCell(c, r[c]) : raw(r[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {(totals[totalsKey] || totals[oppKey]) && (
          <tfoot>
            {totals[totalsKey] && (() => {
              const t = {}; allCols.forEach((c, i) => t[c] = totals[totalsKey][i]);
              return (
                <tr>
                  <td style={{ borderTop: `1.5px solid ${INK}` }} />
                  <td style={{ fontSize: 9.5, fontWeight: 800, padding: '4px 5px', borderTop: `1.5px solid ${INK}` }}>Team</td>
                  {cols.map(c => <td key={c} style={{ fontSize: 9, fontWeight: 800, padding: '4px 5px', textAlign: 'right', borderTop: `1.5px solid ${INK}` }}>{raw(t[c])}</td>)}
                </tr>
              );
            })()}
            {totals[oppKey] && (() => {
              const t = {}; allCols.forEach((c, i) => t[c] = totals[oppKey][i]);
              return (
                <tr>
                  <td />
                  <td style={{ fontSize: 9.5, fontWeight: 700, color: '#777', padding: '4px 5px' }}>Opp</td>
                  {cols.map(c => <td key={c} style={{ fontSize: 9, fontWeight: 700, color: '#777', padding: '4px 5px', textAlign: 'right' }}>{raw(t[c])}</td>)}
                </tr>
              );
            })()}
          </tfoot>
        )}
      </table>
    </div>
  );
}

function LeaderCard({ rank, name, jersey, line1, big, bigLabel }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 4px', borderBottom: `1px solid ${LINE}` }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: GOLD, width: 22, textAlign: 'center', flexShrink: 0 }}>{rank}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: INK }}>{jersey ? `#${jersey} ` : ''}{name}</div>
        <div style={{ fontSize: 10, color: MUT, marginTop: 1 }}>{line1}</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: '#1a6b3a' }}>{big}</div>
        <div style={{ fontSize: 8, color: MUT, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>{bigLabel}</div>
      </div>
    </div>
  );
}

// officialStats: { team, record, hitters, pitchers, totals } — the exact
// shape parseOfficialStatsPdf() returns. No live-data props needed anymore.
export default function TeamStatsSheet({ team, officialStats }) {
  if (!officialStats) {
    return (
      <div style={{ fontFamily: REPORT_FONT, color: MUT, fontSize: 12, padding: '20px 0' }}>
        No official stats PDF uploaded for {team.name}.
      </div>
    );
  }
  const { record, hitters, pitchers, totals } = officialStats;
  const H = hitterLeaders(hitters);
  const P = pitcherLeaders(pitchers);
  const rec = [record?.overall, record?.home && `Home ${record.home}`, record?.away && `Away ${record.away}`, record?.conf && `Conf ${record.conf}`].filter(Boolean).join('  ·  ');

  const sortedHitters = [...hitters].sort((a, b) => N(b.AB) - N(a.AB));
  const sortedPitchers = [...pitchers].sort((a, b) => trueIP(b.IP) - trueIP(a.IP));

  return (
    <div style={{ fontFamily: REPORT_FONT, color: INK }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `2.5px solid ${INK}`, paddingBottom: 10, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2.5, textTransform: 'uppercase', color: GOLD }}>Team Stats Sheet</div>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.4, marginTop: 3 }}>{team.name}</div>
          {rec && <div style={{ fontSize: 10.5, color: MUT, fontWeight: 600, marginTop: 2 }}>{rec}</div>}
        </div>
        <div style={{ textAlign: 'right', fontSize: 10, color: MUT, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, lineHeight: 1.6 }}>
          Official Stats<br />
          Printed {new Date().toLocaleDateString()}
        </div>
      </div>

      {/* Leaders */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', borderBottom: '1.5px solid #ccc', paddingBottom: 6, marginBottom: 2 }}>
            Most Productive Hitters <span style={{ fontSize: 9, color: MUT, fontWeight: 600, textTransform: 'none' }}>({H.gate})</span>
          </div>
          {H.list.length ? H.list.map((x, i) => (
            <LeaderCard key={x.h.num + x.h.name} rank={i + 1} name={x.h.name} jersey={x.h.num}
              line1={`${raw(x.h.AVG)} AVG · ${raw(x.h.HR)} HR · ${raw(x.h.RBI)} RBI`}
              big={x.ops.toFixed(3).replace(/^0/, '')} bigLabel="OPS" />
          )) : <div style={{ fontSize: 11, color: MUT, padding: '10px 4px' }}>No hitters meet the sample gate.</div>}
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', borderBottom: '1.5px solid #ccc', paddingBottom: 6, marginBottom: 2 }}>
            Most Productive Pitchers <span style={{ fontSize: 9, color: MUT, fontWeight: 600, textTransform: 'none' }}>({P.gate})</span>
          </div>
          {P.list.length ? P.list.map((x, i) => (
            <LeaderCard key={x.p.num + x.p.name} rank={i + 1} name={x.p.name} jersey={x.p.num}
              line1={`${raw(x.p.IP)} IP · ${raw(x.p.SO)} K · ${x.k9.toFixed(1)} K/9`}
              big={raw(x.p.ERA)} bigLabel="ERA" />
          )) : <div style={{ fontSize: 11, color: MUT, padding: '10px 4px' }}>No pitchers meet the sample gate.</div>}
        </div>
      </div>

      <StatTable title="Hitters" cols={H_COLS} colLabel="Batter" rows={sortedHitters} totals={totals} totalsKey="hit" oppKey="hitOpp" allCols={H_COLS} />
      <StatTable title="Pitchers" cols={P_COLS} colLabel="Pitcher" rows={sortedPitchers} totals={totals} totalsKey="pit" oppKey="pitOpp" allCols={P_COLS} />

      <div style={{ fontSize: 9, color: MUT, marginTop: 4 }}>
        Source: official PrestoSports export, parsed from the uploaded PDF. IP shown as innings.outs. Dash = none recorded.
      </div>
    </div>
  );
}
