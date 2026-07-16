import React from 'react';
import { raw, hitterLeaders, pitcherLeaders } from '@/lib/officialTeamStatsPdf';

// ── Team Stats Sheet (portrait) ─────────────────────────────────────────────
// Approved mockup, 2026-07-15/16: header + leaderboard only. Full hitter/
// pitcher tables were removed from this page per Derek's note (2026-07-16)
// — they duplicated the Comprehensive Team Report's tables, which have the
// merged scouting columns these plain ones didn't. No Base44 writes; the
// parsed data lives only in TeamReportBuilder's component state.
const INK = '#1a1a1a';
const MUT = '#666';
const GOLD = '#b8860b';
const REPORT_FONT = "'Archivo', system-ui, sans-serif";
const LINE = '#e4e7ea';

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
  const { record, hitters, pitchers } = officialStats;
  const H = hitterLeaders(hitters);
  const P = pitcherLeaders(pitchers);
  const rec = [record?.overall, record?.home && `Home ${record.home}`, record?.away && `Away ${record.away}`, record?.conf && `Conf ${record.conf}`].filter(Boolean).join('  ·  ');

  return (
    // Print CSS zeroes .print-report-page's padding at print time — margin
    // needs to live here instead, same fix as ComprehensiveTeamReport.jsx.
    <div style={{ fontFamily: REPORT_FONT, color: INK, padding: '0.2in' }}>
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

      {/* Leaders — the only content on this page, per Derek's note
          (2026-07-16): full hitter/pitcher tables now live only in the
          Comprehensive Team Report, which has the merged scouting columns.
          Extended to top 5 (was top 3). */}
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
    </div>
  );
}
