import React, { useState, useEffect, useMemo } from 'react';
import { getLeaguePitches } from '@/lib/leagueCache';
import {
  buildLeaderboardRows, PITCHER_LEADERBOARD_METRICS, HITTER_LEADERBOARD_METRICS,
} from '@/lib/profileStats';
import { getTeamByName, getTeamShort } from '@/lib/teams';
import PlayerProfile from './PlayerProfile';
import { C, FONT } from '@/lib/darkTheme';

const FONT_STYLE = { fontFamily: FONT };

function fmtCell(v, m) {
  if (v == null || Number.isNaN(v)) return '—';
  if (m.pct) return Math.round(v * 100) + '%';
  if (m.stat) {
    // Batting-average style: ".325" not "0.325"
    const s = v.toFixed(m.decimals);
    return s.startsWith('0.') ? s.slice(1) : (s.startsWith('-0.') ? '-' + s.slice(2) : s);
  }
  const s = v.toFixed(m.decimals);
  const sign = m.signed && v > 0 ? '+' : '';
  return sign + s + (m.unit || '');
}

// Default sort direction for a metric: for "invert" metrics, lower is
// better, so the first click of that column header should sort ascending.
function defaultDirFor(m) { return m.invert ? 'asc' : 'desc'; }

export default function Leaderboard({ onBack }) {
  const [allPitches, setAllPitches] = useState(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState('pitcher'); // 'pitcher' | 'hitter'
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [sortKey, setSortKey] = useState('runValue');
  const [sortDir, setSortDir] = useState('desc');
  const [activePlayer, setActivePlayer] = useState(null); // { name, role } | null

  useEffect(() => {
    let live = true;
    getLeaguePitches().then(rows => { if (live) { setAllPitches(rows); setLoading(false); } });
    return () => { live = false; };
  }, []);

  const METRICS = role === 'pitcher' ? PITCHER_LEADERBOARD_METRICS : HITTER_LEADERBOARD_METRICS;
  const CATEGORIES = useMemo(() => {
    const seen = [];
    METRICS.forEach(m => { if (!seen.includes(m.category)) seen.push(m.category); });
    return seen;
  }, [METRICS]);

  // Which metric columns are currently shown — defaults to everything.
  const [visibleKeys, setVisibleKeys] = useState(() => new Set(PITCHER_LEADERBOARD_METRICS.map(m => m.key)));
  useEffect(() => { setVisibleKeys(new Set(METRICS.map(m => m.key))); setSortKey(METRICS[0].key); setSortDir(defaultDirFor(METRICS[0])); }, [role]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => {
    if (!allPitches) return [];
    return buildLeaderboardRows(allPitches, role);
  }, [allPitches, role]);

  const teams = useMemo(() => {
    const s = new Set(rows.map(r => r.team).filter(Boolean));
    return [...s].sort();
  }, [rows]);

  const filtered = useMemo(() => {
    let out = rows;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter(r => r.name.toLowerCase().includes(q) || (r.team || '').toLowerCase().includes(q));
    }
    if (teamFilter) out = out.filter(r => r.team === teamFilter);
    return out;
  }, [rows, search, teamFilter]);

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;  // nulls always sink to bottom regardless of direction
      if (bv == null) return -1;
      return (av - bv) * dir;
    });
  }, [filtered, sortKey, sortDir]);

  function onHeaderClick(key) {
    if (key === sortKey) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); return; }
    const m = METRICS.find(mm => mm.key === key);
    setSortKey(key);
    setSortDir(defaultDirFor(m));
  }

  function toggleColumn(key) {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) { if (next.size > 1) next.delete(key); } else next.add(key);
      return next;
    });
  }

  if (activePlayer) {
    const teamObj = getTeamByName(activePlayer.team) || { name: activePlayer.team || 'CCL', code: activePlayer.team };
    const navRoster = sorted.filter(r => r.role === activePlayer.role).map(r => ({ name: r.name, role: r.role }));
    return (
      <PlayerProfile
        player={{ name: activePlayer.name, role: activePlayer.role }}
        team={teamObj}
        roster={navRoster}
        onBack={() => setActivePlayer(null)}
        onNavigate={p => setActivePlayer({ name: p.name, role: p.role, team: activePlayer.team })}
      />
    );
  }

  const visibleMetrics = METRICS.filter(m => visibleKeys.has(m.key));

  return (
    <div style={{ minHeight: '100vh', background: C.base, fontFamily: FONT, padding: '28px 24px 80px' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: `1px solid ${C.rim}`, borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 600, color: C.gold, cursor: 'pointer', marginBottom: 20, ...FONT_STYLE }}
        >
          ← Back
        </button>

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: C.cream, margin: 0, letterSpacing: '-0.3px' }}>League Leaderboard</h1>
            <p style={{ color: C.muted, fontSize: 12.5, margin: '4px 0 0' }}>
              {loading ? 'Loading league data…' : `${sorted.length} qualified ${role === 'pitcher' ? 'pitchers' : 'hitters'}`}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {['pitcher', 'hitter'].map(r => (
              <button
                key={r}
                onClick={() => setRole(r)}
                style={{
                  background: role === r ? C.gold : 'transparent',
                  color: role === r ? '#1a1400' : C.muted,
                  border: `1px solid ${role === r ? C.gold : C.rim}`,
                  borderRadius: 7, padding: '7px 18px', fontSize: 13, fontWeight: 800,
                  cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 0.6, ...FONT_STYLE,
                }}
              >
                {r === 'pitcher' ? 'Pitchers' : 'Hitters'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search player or team…"
            style={{
              background: C.surface, border: `1px solid ${C.edge}`, borderRadius: 7, padding: '8px 12px',
              fontSize: 13, color: C.cream, minWidth: 220, ...FONT_STYLE,
            }}
          />
          <select
            value={teamFilter}
            onChange={e => setTeamFilter(e.target.value)}
            style={{
              background: C.surface, border: `1px solid ${C.edge}`, borderRadius: 7, padding: '8px 12px',
              fontSize: 13, color: teamFilter ? C.cream : C.muted, ...FONT_STYLE,
            }}
          >
            <option value="">All Teams</option>
            {teams.map(t => <option key={t} value={t}>{getTeamShort(getTeamByName(t)?.code) !== getTeamByName(t)?.code ? getTeamByName(t)?.short || t : t}</option>)}
          </select>

          <ColumnPicker categories={CATEGORIES} metrics={METRICS} visibleKeys={visibleKeys} onToggle={toggleColumn} />
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
            <div style={{ width: 28, height: 28, border: `3px solid ${C.edge}`, borderTopColor: C.gold, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : (
          <div style={{ overflowX: 'auto', border: `1px solid ${C.edge}`, borderRadius: 10, background: C.surface }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12.5 }}>
              <thead>
                <tr>
                  <Th sticky label="Player" onClick={null} />
                  <Th label="Team" onClick={null} />
                  <Th label="N" onClick={() => onHeaderClick('n')} active={sortKey === 'n'} dir={sortDir} />
                  {visibleMetrics.map(m => (
                    <Th key={m.key} label={m.label} onClick={() => onHeaderClick(m.key)} active={sortKey === m.key} dir={sortDir} />
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => (
                  <tr
                    key={r.name + r.team}
                    onClick={() => setActivePlayer({ name: r.name, role: r.role, team: r.team })}
                    style={{
                      cursor: 'pointer',
                      background: i % 2 ? 'rgba(255,255,255,0.015)' : 'transparent',
                      borderTop: `1px solid ${C.edge}`,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(200,146,12,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.background = i % 2 ? 'rgba(255,255,255,0.015)' : 'transparent'}
                  >
                    <td style={{ padding: '8px 12px', color: C.cream, fontWeight: 700, whiteSpace: 'nowrap', position: 'sticky', left: 0, background: 'inherit' }}>{r.name}</td>
                    <td style={{ padding: '8px 12px', color: C.muted, whiteSpace: 'nowrap' }}>{getTeamByName(r.team)?.short || r.team || '—'}</td>
                    <td style={{ padding: '8px 12px', color: C.muted, textAlign: 'right' }}>{r.n}</td>
                    {visibleMetrics.map(m => (
                      <td key={m.key} style={{ padding: '8px 12px', textAlign: 'right', color: r[m.key] == null ? C.faint : C.cream, fontVariantNumeric: 'tabular-nums' }}>
                        {fmtCell(r[m.key], m)}
                      </td>
                    ))}
                  </tr>
                ))}
                {sorted.length === 0 && (
                  <tr><td colSpan={3 + visibleMetrics.length} style={{ padding: 40, textAlign: 'center', color: C.muted }}>No players match.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Th({ label, onClick, active, dir, sticky }) {
  return (
    <th
      onClick={onClick || undefined}
      style={{
        padding: '9px 12px', textAlign: label === 'Player' || label === 'Team' ? 'left' : 'right',
        fontSize: 10.5, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase',
        color: active ? C.gold : C.muted, whiteSpace: 'nowrap', cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none', borderBottom: `1px solid ${C.rim}`, background: C.surface,
        position: sticky ? 'sticky' : 'static', left: sticky ? 0 : undefined,
      }}
    >
      {label}{active ? (dir === 'asc' ? ' ▲' : ' ▼') : ''}
    </th>
  );
}

function ColumnPicker({ categories, metrics, visibleKeys, onToggle }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: C.surface, border: `1px solid ${C.edge}`, borderRadius: 7, padding: '8px 14px',
          fontSize: 13, fontWeight: 600, color: C.muted, cursor: 'pointer', ...FONT_STYLE,
        }}
      >
        Columns ({visibleKeys.size}/{metrics.length}) {open ? '▲' : '▼'}
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '110%', left: 0, zIndex: 20, background: C.raised,
          border: `1px solid ${C.rim}`, borderRadius: 8, padding: 14, width: 460,
          boxShadow: '0 12px 32px rgba(0,0,0,0.5)', display: 'flex', flexWrap: 'wrap', gap: 18,
        }}>
          {categories.map(cat => (
            <div key={cat} style={{ minWidth: 130 }}>
              <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: C.gold, marginBottom: 6 }}>{cat}</div>
              {metrics.filter(m => m.category === cat).map(m => (
                <label key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.cream, marginBottom: 4, cursor: 'pointer' }}>
                  <input type="checkbox" checked={visibleKeys.has(m.key)} onChange={() => onToggle(m.key)} />
                  {m.label}
                </label>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
