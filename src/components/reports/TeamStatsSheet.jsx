import React, { useEffect, useMemo, useState } from 'react';
import { canonicalNameKey } from '@/lib/statsUtils';
import { slashLine, xERA, buildPitcherPool } from '@/lib/profileStats';
import { getLeaguePitches } from '@/lib/leagueCache';
import { loadPools } from '@/lib/poolCache';

// ── Team Stats Sheet (Phase 5) ──────────────────────────────────────────────
// Same visual design language as PrintProfileReport (light paper, INK text,
// GOLD accent) rather than reproducing the uploaded PrestoSports-import
// template's own palette — this sheet sits inside the combined Team Report
// alongside player profile pages, and a third, different visual identity
// there would look stitched-together rather than like one document.
//
// Data source, deliberately: Trackman-derived, not an official box score.
// ERA, W-L, saves, and fielding errors are official-scorekeeper stats —
// earned-vs-unearned runs and win/loss-of-record are human judgment calls a
// PrestoSports scorekeeper makes, not something ball-tracking data can
// derive. Rather than fabricate numbers that look official but aren't, this
// shows xERA (expected ERA from quality of contact allowed) instead of ERA,
// and omits W-L/SV/errors entirely. AVG/OBP/SLG/HR/BB/K are the same
// slashLine() math used everywhere else in the app, so they agree with
// every other screen — no separate stat pipeline to drift out of sync.
const INK = '#1a1a1a';
const MUT = '#666';
const GOLD = '#b8860b';
const REPORT_FONT = "'Archivo', system-ui, sans-serif";
const LINE = '#e4e7ea';

function groupByPlayer(rows, nameField) {
  const groups = {};
  rows.forEach(r => {
    const name = r[nameField];
    if (!name) return;
    const key = canonicalNameKey(name);
    if (!groups[key]) groups[key] = { name, rows: [] };
    groups[key].rows.push(r);
  });
  return Object.values(groups);
}

function jerseyFor(rosterList, name) {
  const key = canonicalNameKey(name);
  const match = (rosterList || []).find(p => canonicalNameKey(p.name) === key);
  return match?.jerseyNumber || match?.jersey_number || '';
}

const fmt3 = v => v == null ? '—' : v.toFixed(3).replace(/^0\./, '.');
const fmt2 = v => v == null ? '—' : v.toFixed(2);
const fmt0 = v => v == null ? '—' : Math.round(v).toString();

function StatTable({ title, cols, rows }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: GOLD, marginBottom: 6 }}>{title}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
        <thead>
          <tr>
            <th style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: '#fff', background: '#0e253a', padding: '5px 6px', textAlign: 'left' }}>Player</th>
            {cols.map(c => (
              <th key={c.key} style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: '#fff', background: '#0e253a', padding: '5px 6px', textAlign: 'right' }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.key} style={{ background: i % 2 === 1 ? '#fafafa' : 'transparent' }}>
              <td style={{ fontSize: 10.5, fontWeight: 800, color: INK, padding: '5px 6px', borderBottom: `1px solid ${LINE}`, whiteSpace: 'nowrap' }}>
                {r.jersey ? `#${r.jersey} ` : ''}{r.name}
              </td>
              {cols.map(c => (
                <td key={c.key} style={{ fontSize: 10.5, color: '#333', padding: '5px 6px', borderBottom: `1px solid ${LINE}`, textAlign: 'right' }}>{c.render(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LeaderCard({ rank, name, jersey, line1, line2, big, bigLabel }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 4px', borderBottom: `1px solid ${LINE}` }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: GOLD, width: 22, textAlign: 'center', flexShrink: 0 }}>{rank}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: INK }}>{jersey ? `#${jersey} ` : ''}{name}</div>
        <div style={{ fontSize: 10, color: MUT, marginTop: 1 }}>{line1}{line2 ? ` · ${line2}` : ''}</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: '#1a6b3a' }}>{big}</div>
        <div style={{ fontSize: 8, color: MUT, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>{bigLabel}</div>
      </div>
    </div>
  );
}

export default function TeamStatsSheet({ team, pitches, batterPitches, pitchers, hitters }) {
  const [pitcherPool, setPitcherPool] = useState(null);

  useEffect(() => {
    let cancelled = false;
    loadPools().then(p => {
      if (cancelled) return;
      if (p) { setPitcherPool(p.pitcherPool); return; }
      getLeaguePitches().then(lp => { if (!cancelled) setPitcherPool(buildPitcherPool(lp)); });
    });
    return () => { cancelled = true; };
  }, []);

  const hitterRows = useMemo(() => {
    return groupByPlayer(batterPitches, 'batter_name').map(g => {
      const s = slashLine(g.rows);
      return { key: canonicalNameKey(g.name), name: g.name.includes(',') ? g.name.split(',').reverse().join(' ').trim() : g.name, jersey: jerseyFor(hitters, g.name), pa: s.pa, ...s };
    }).filter(r => r.pa >= 5).sort((a, b) => b.pa - a.pa);
  }, [batterPitches, hitters]);

  const pitcherRows = useMemo(() => {
    if (!pitcherPool) return [];
    return groupByPlayer(pitches, 'pitcher_name').map(g => {
      const s = slashLine(g.rows);
      const xera = pitcherPool.xGrid ? xERA(g.rows, pitcherPool.xGrid, pitcherPool.leagueWoba) : null;
      return { key: canonicalNameKey(g.name), name: g.name.includes(',') ? g.name.split(',').reverse().join(' ').trim() : g.name, jersey: jerseyFor(pitchers, g.name), pitchCount: g.rows.length, xera, ...s };
    }).filter(r => r.pitchCount >= 15).sort((a, b) => b.pitchCount - a.pitchCount);
  }, [pitches, pitchers, pitcherPool]);

  const hitterLeaders = useMemo(() => {
    const maxPA = Math.max(...hitterRows.map(r => r.pa), 1);
    const gate = Math.max(10, Math.round(maxPA * 0.4));
    return [...hitterRows].filter(r => r.pa >= gate).sort((a, b) => (b.ops ?? -1) - (a.ops ?? -1)).slice(0, 3);
  }, [hitterRows]);

  const pitcherLeaders = useMemo(() => {
    const maxPitches = Math.max(...pitcherRows.map(r => r.pitchCount), 1);
    const gate = Math.max(30, Math.round(maxPitches * 0.3));
    return [...pitcherRows].filter(r => r.pitchCount >= gate && r.xera != null).sort((a, b) => a.xera - b.xera).slice(0, 3);
  }, [pitcherRows]);

  const HITTER_COLS = [
    { key: 'pa', label: 'PA', render: r => fmt0(r.pa) },
    { key: 'ab', label: 'AB', render: r => fmt0(r.ab) },
    { key: 'h', label: 'H', render: r => fmt0(r.h) },
    { key: 'hr', label: 'HR', render: r => fmt0(r.hr) },
    { key: 'bb', label: 'BB', render: r => fmt0(r.bb) },
    { key: 'k', label: 'SO', render: r => fmt0(r.k) },
    { key: 'avg', label: 'AVG', render: r => fmt3(r.avg) },
    { key: 'obp', label: 'OBP', render: r => fmt3(r.obp) },
    { key: 'slg', label: 'SLG', render: r => fmt3(r.slg) },
  ];

  const PITCHER_COLS = [
    { key: 'xera', label: 'xERA', render: r => fmt2(r.xera) },
    { key: 'pitches', label: 'Pitches', render: r => fmt0(r.pitchCount) },
    { key: 'k', label: 'K', render: r => fmt0(r.k) },
    { key: 'bb', label: 'BB', render: r => fmt0(r.bb) },
    { key: 'hr', label: 'HR', render: r => fmt0(r.hr) },
    { key: 'avg', label: 'AVG Agst', render: r => fmt3(r.avg) },
    { key: 'obp', label: 'OBP Agst', render: r => fmt3(r.obp) },
    { key: 'slg', label: 'SLG Agst', render: r => fmt3(r.slg) },
  ];

  return (
    <div style={{ fontFamily: REPORT_FONT, color: INK }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `2.5px solid ${INK}`, paddingBottom: 10, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2.5, textTransform: 'uppercase', color: GOLD }}>Team Stats Sheet</div>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.4, marginTop: 3 }}>{team.name}</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 10, color: MUT, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, lineHeight: 1.6 }}>
          Team Stats<br />
          Printed {new Date().toLocaleDateString()}
        </div>
      </div>

      {/* Leaders */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', borderBottom: '1.5px solid #ccc', paddingBottom: 6, marginBottom: 2 }}>
            Most Productive Hitters <span style={{ fontSize: 9, color: MUT, fontWeight: 600, textTransform: 'none' }}>(min PA gate)</span>
          </div>
          {hitterLeaders.length ? hitterLeaders.map((r, i) => (
            <LeaderCard key={r.key} rank={i + 1} name={r.name} jersey={r.jersey}
              line1={`${fmt3(r.avg)} AVG`} line2={`${fmt0(r.hr)} HR, ${fmt0(r.bb)} BB`}
              big={fmt3(r.ops)} bigLabel="OPS" />
          )) : <div style={{ fontSize: 11, color: MUT, padding: '10px 4px' }}>No hitters meet the sample gate.</div>}
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', borderBottom: '1.5px solid #ccc', paddingBottom: 6, marginBottom: 2 }}>
            Most Productive Pitchers <span style={{ fontSize: 9, color: MUT, fontWeight: 600, textTransform: 'none' }}>(min pitch gate)</span>
          </div>
          {pitcherLeaders.length ? pitcherLeaders.map((r, i) => (
            <LeaderCard key={r.key} rank={i + 1} name={r.name} jersey={r.jersey}
              line1={`${fmt0(r.pitchCount)} pitches`} line2={`${fmt0(r.k)} K, ${fmt3(r.avg)} AVG agst`}
              big={fmt2(r.xera)} bigLabel="xERA" />
          )) : <div style={{ fontSize: 11, color: MUT, padding: '10px 4px' }}>No pitchers meet the sample gate.</div>}
        </div>
      </div>

      <StatTable title="Hitters" cols={HITTER_COLS} rows={hitterRows} />
      <StatTable title="Pitchers" cols={PITCHER_COLS} rows={pitcherRows} />

      <div style={{ fontSize: 9, color: MUT, marginTop: 4 }}>
        Sample gates hide small-N lines
      </div>
    </div>
  );
}
