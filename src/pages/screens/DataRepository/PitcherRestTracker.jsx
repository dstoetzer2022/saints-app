import React, { useState, useEffect, useMemo } from 'react';
import { C, FONT } from '@/lib/darkTheme';
import { base44 } from '@/api/base44Client';
import { normalizeName } from '@/lib/statsUtils';

// Populated by the CCL scraper (see the standalone ccl-pitcher-tracker repo).
// Point this at wherever the scraper's GitHub Action commits pitcher-rest.json —
// defaults to a same-origin path, i.e. this file living in this app's own
// public/data/ folder so Cloudflare Pages serves it statically alongside the app.
const REST_DATA_URL = 'https://raw.githubusercontent.com/dstoetzer2022/ccl-pitcher-tracker/main/data/pitcher-rest.json';

// A pitcher who's thrown this many (or more) pitches within the trailing window
// is flagged unavailable regardless of days-rest tier — overuse risk overrides
// the normal rest-day heuristic.
const WORKLOAD_PITCH_LIMIT = 55;
const WORKLOAD_WINDOW_DAYS = 2;

// ── Availability tier (unchanged logic, just the single source of truth
// the 3-column board groups by) ──────────────────────────────────────────
function tierFor(daysRest, overworked) {
  if (overworked) return 'unavailable';
  if (daysRest <= 1) return 'unavailable';
  if (daysRest <= 3) return 'maybe';
  return 'available';
}
const TIER_META = {
  available: { title: 'Available', color: C.green, bg: 'rgba(33,197,93,0.16)' },
  maybe: { title: 'Maybe', color: C.amber, bg: 'rgba(232,168,0,0.16)' },
  unavailable: { title: 'Unavailable', color: C.red, bg: 'rgba(232,64,64,0.16)' },
};

// Sums pitches thrown across recent outings within the trailing window (in days,
// counted back from today). recentOutings is capped at 5 by the scraper, which
// comfortably covers any realistic 2-day workload.
function recentWorkload(outings, windowDays) {
  if (!outings?.length) return 0;
  const today = new Date();
  return outings.reduce((sum, o) => {
    if (!o.date || o.pitches == null) return sum;
    const days = Math.floor((today - new Date(o.date)) / 86400000);
    return days <= windowDays ? sum + o.pitches : sum;
  }, 0);
}

function RolePill({ role }) {
  const isSP = role === 'SP';
  return (
    <span style={{
      padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, fontFamily: FONT, letterSpacing: 0.3,
      background: isSP ? 'rgba(200,146,12,0.16)' : 'rgba(90,112,128,0.18)', color: isSP ? C.gold : C.muted,
    }}>
      {role}
    </span>
  );
}

function FlagBadge({ flag }) {
  if (!flag) return null;
  const isBlowup = flag === 'blowup';
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, fontFamily: FONT, marginTop: 4,
      color: isBlowup ? '#f08a8a' : C.amber,
    }}>
      ⚠ {isBlowup ? 'Blowup last time out' : 'Rough outing last time out'}
    </div>
  );
}

function MiniSparkline({ outings }) {
  const vals = (outings || []).map(o => o.pitches || 0);
  if (!vals.length) return null;
  const max = Math.max(...vals, 1);
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 14, marginTop: 6 }}>
      {vals.map((v, i) => (
        <div key={i} style={{
          width: 4, borderRadius: '1px 1px 0 0',
          height: v ? Math.max(3, (v / max) * 14) : 2,
          background: v ? C.gold : C.faint,
          opacity: v ? 0.85 : 0.4,
        }} />
      ))}
    </div>
  );
}

function PitcherCard({ p, jersey, tier, workloadPitches, overworked }) {
  const meta = TIER_META[tier];
  return (
    <div style={{ background: C.raised, borderRadius: 8, padding: '10px 12px', borderLeft: `3px solid ${meta.color}`, opacity: tier === 'unavailable' && !overworked ? 0.85 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: C.white }}>
          {jersey && <span style={{ fontSize: 11, color: C.muted, fontWeight: 700, marginRight: 5, fontVariantNumeric: 'tabular-nums' }}>#{jersey}</span>}
          {p.pitcher}
        </span>
        <span style={{ fontSize: 15, fontWeight: 800, color: meta.color, fontVariantNumeric: 'tabular-nums' }}>
          {p.daysRest}d
        </span>
      </div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 4, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {p.starts > 0 && <RolePill role="SP" />}
        {p.relief > 0 && <RolePill role="RP" />}
        <span>{p.starts}GS &middot; {p.relief}RP &middot; avg {p.avgPitches ?? '—'}p</span>
      </div>
      {p.lastOpponent && (
        <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>vs {p.lastOpponent}</div>
      )}
      <FlagBadge flag={p.lastOutingFlag} />
      {overworked && (
        <div style={{ fontSize: 10, fontWeight: 700, color: '#ff8f8f', marginTop: 4 }}>
          ⚠ {workloadPitches}p in last {WORKLOAD_WINDOW_DAYS}d — overworked overrides rest tier
        </div>
      )}
      <MiniSparkline outings={p.recentOutings} />
    </div>
  );
}

function TierColumn({ tier, pitchers, jerseyByName }) {
  const meta = TIER_META[tier];
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.edge}`, borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div style={{ padding: '11px 14px', borderTop: `3px solid ${meta.color}`, borderBottom: `1px solid ${C.edge}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: meta.color, fontFamily: FONT }}>{meta.title}</span>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 10, background: meta.bg, color: meta.color, fontFamily: FONT }}>{pitchers.length}</span>
      </div>
      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', maxHeight: 'calc(100vh - 210px)' }}>
        {pitchers.length === 0 ? (
          <div style={{ color: C.muted, fontSize: 12, textAlign: 'center', padding: '20px 0' }}>None</div>
        ) : pitchers.map(({ p, workloadPitches, overworked }) => (
          <PitcherCard key={p.pitcher} p={p} jersey={jerseyByName[normalizeName(p.pitcher)]} tier={tier} workloadPitches={workloadPitches} overworked={overworked} />
        ))}
      </div>
    </div>
  );
}

export default function PitcherRestTracker({ team, onBack }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('rest');
  const [roleFilter, setRoleFilter] = useState('all'); // 'all' | 'sp' | 'rp'
  const [jerseyByName, setJerseyByName] = useState({});

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(REST_DATA_URL)
      .then(r => { if (!r.ok) throw new Error('not found'); return r.json(); })
      .then(json => { setData(json); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  // Jersey numbers come from the Player roster entity (TeamHub), joined by
  // normalized name. Falls back to no number shown if a player hasn't been
  // added to the roster yet.
  useEffect(() => {
    base44.entities.Player.filter({ team: team.name })
      .then(players => {
        const map = {};
        for (const pl of players || []) {
          if (pl.jersey_number) map[normalizeName(pl.name)] = pl.jersey_number;
        }
        setJerseyByName(map);
      })
      .catch(() => setJerseyByName({}));
  }, [team.name]);

  // Enrich once (workload + tier), THEN filter by role, THEN split into
  // columns, THEN sort within each column — sort is per-column so e.g.
  // "Workload" ranks the Unavailable column by pitch count (most overworked
  // first) while Available still ranks by days rest.
  const enriched = useMemo(() => {
    if (!data?.pitchers) return [];
    return data.pitchers
      .filter(p => p.team === team.name)
      .map(p => {
        const workloadPitches = recentWorkload(p.recentOutings, WORKLOAD_WINDOW_DAYS);
        const overworked = workloadPitches >= WORKLOAD_PITCH_LIMIT;
        return { p, workloadPitches, overworked, tier: tierFor(p.daysRest, overworked) };
      })
      .filter(row => roleFilter === 'all'
        || (roleFilter === 'sp' && row.p.starts > 0)
        || (roleFilter === 'rp' && row.p.relief > 0));
  }, [data, team.name, roleFilter]);

  const columns = useMemo(() => {
    const sorters = {
      rest: (a, b) => a.p.daysRest - b.p.daysRest,
      workload: (a, b) => b.workloadPitches - a.workloadPitches,
      role: (a, b) => (b.p.starts > 0) - (a.p.starts > 0) || a.p.pitcher.localeCompare(b.p.pitcher),
      name: (a, b) => a.p.pitcher.localeCompare(b.p.pitcher),
    };
    const sorter = sorters[sort] || sorters.rest;
    const byTier = { available: [], maybe: [], unavailable: [] };
    enriched.forEach(row => byTier[row.tier].push(row));
    Object.values(byTier).forEach(rows => rows.sort(sorter));
    return byTier;
  }, [enriched, sort]);

  const totalPitchers = enriched.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: C.base, fontFamily: FONT, overflow: 'hidden' }}>
      <div style={{ padding: '18px 24px', borderBottom: `1px solid ${C.edge}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <button
            onClick={onBack}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: C.muted, fontFamily: FONT, padding: 0, marginBottom: 10 }}
          >
            ← {team.name}
          </button>
          <h1 style={{ fontWeight: 800, fontSize: 18, color: C.white, margin: 0 }}>Pitcher Rest Tracker</h1>
          <p style={{ color: C.muted, fontSize: 12, margin: '4px 0 0' }}>
            {data?.generatedAt ? `Updated ${new Date(data.generatedAt).toLocaleDateString()}` : 'League-wide, auto-scraped from CCL box scores'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['all', 'All'], ['sp', 'SP'], ['rp', 'RP']].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setRoleFilter(key)}
                style={{
                  background: roleFilter === key ? C.rim : 'none', border: `1px solid ${C.rim}`,
                  color: roleFilter === key ? C.cream : C.muted, borderRadius: 20, padding: '5px 11px',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[['rest', 'Days rest'], ['workload', 'Workload'], ['role', 'Role'], ['name', 'Name']].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSort(key)}
                style={{
                  background: sort === key ? C.gold : 'none', border: `1px solid ${sort === key ? C.gold : C.rim}`,
                  color: sort === key ? C.base : C.muted, borderRadius: 20, padding: '6px 12px',
                  fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div style={{ width: 24, height: 24, border: `3px solid ${C.faint}`, borderTopColor: C.gold, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', color: C.muted, padding: 60, fontSize: 13, lineHeight: 1.6 }}>
            Couldn't load <code style={{ color: C.gold }}>{REST_DATA_URL}</code>.<br />
            Make sure the CCL scraper's <code style={{ color: C.gold }}>data/pitcher-rest.json</code> is deployed into this app's <code style={{ color: C.gold }}>public/data/</code> folder.
          </div>
        ) : totalPitchers === 0 ? (
          <div style={{ textAlign: 'center', color: C.muted, padding: 60, fontSize: 13 }}>
            No logged outings yet for {team.name}.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(260px, 1fr))', gap: 16 }}>
            <TierColumn tier="available" pitchers={columns.available} jerseyByName={jerseyByName} />
            <TierColumn tier="maybe" pitchers={columns.maybe} jerseyByName={jerseyByName} />
            <TierColumn tier="unavailable" pitchers={columns.unavailable} jerseyByName={jerseyByName} />
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
