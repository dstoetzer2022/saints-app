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

function restClass(d) { return d <= 1 ? 'low' : d <= 3 ? 'mid' : 'high'; }
function restColor(d) { return d <= 1 ? C.red : d <= 3 ? C.amber : C.green; }
function restLabel(d) { return d === 0 ? 'Today' : d === 1 ? '1 day' : `${d} days`; }
function availLabel(d) { return d <= 1 ? 'Unavailable' : d <= 3 ? 'Maybe' : 'Available'; }

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

function RestChip({ days, overworked, workloadPitches }) {
  const tier = overworked ? 'low' : restClass(days);
  const color = overworked ? C.red : restColor(days);
  const label = overworked ? 'Unavailable' : availLabel(days);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
      <span style={{
        display: 'inline-flex', alignItems: 'baseline', gap: 4, padding: '5px 12px',
        borderRadius: 14, fontWeight: 800, fontFamily: FONT, lineHeight: 1,
        background: `${color}2e`, color,
      }}>
        <span style={{ fontSize: 22 }}>{days}</span>
        <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.85 }}>{days === 1 ? 'day' : 'days'}</span>
      </span>
      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, color, marginTop: 2 }}>
        {label}
      </span>
      {overworked && (
        <span style={{ fontSize: 9.5, color: C.muted, marginTop: 1 }}>{workloadPitches}p / {WORKLOAD_WINDOW_DAYS}d</span>
      )}
    </div>
  );
}

function RolePills({ starts, relief }) {
  return (
    <div style={{ display: 'flex', gap: 5, marginTop: 5 }}>
      {starts > 0 && (
        <span style={{
          display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
          fontFamily: FONT, letterSpacing: 0.3, background: 'rgba(200,146,12,0.16)', color: C.gold,
        }}>SP</span>
      )}
      {relief > 0 && (
        <span style={{
          display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
          fontFamily: FONT, letterSpacing: 0.3, background: 'rgba(90,112,128,0.18)', color: C.muted,
        }}>RP</span>
      )}
    </div>
  );
}

function FlagBadge({ flag }) {
  if (!flag) return null;
  const isBlowup = flag === 'blowup';
  return (
    <span style={{
      display: 'inline-block', marginLeft: 6, padding: '3px 9px', borderRadius: 4,
      fontSize: 11.5, fontWeight: 700, fontFamily: FONT,
      background: isBlowup ? 'rgba(232,64,64,0.16)' : 'rgba(232,168,0,0.16)',
      color: isBlowup ? '#f08a8a' : C.amber,
    }}>
      ⚠ {isBlowup ? 'Blowup' : 'Rough outing'}
    </span>
  );
}

function MiniSparkline({ outings }) {
  const vals = outings.map(o => o.pitches || 0);
  const max = Math.max(...vals, 1);
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.4, color: C.muted, marginBottom: 3 }}>Last 5</div>
      <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 20, borderBottom: `1px solid ${C.edge}`, paddingBottom: 2 }}>
        {vals.map((v, i) => (
          <div key={i} style={{
            width: 6, borderRadius: '2px 2px 0 0',
            height: v ? Math.max(4, (v / max) * 18) : 2,
            background: v ? C.gold : C.faint,
            opacity: v ? 1 : 0.4,
          }} />
        ))}
      </div>
    </div>
  );
}

function PitcherCard({ p, jersey }) {
  const workloadPitches = recentWorkload(p.recentOutings, WORKLOAD_WINDOW_DAYS);
  const overworked = workloadPitches >= WORKLOAD_PITCH_LIMIT;
  const tier = overworked ? 'low' : restClass(p.daysRest);
  const tierColor = { low: C.red, mid: C.amber, high: C.green }[tier];

  return (
    <div style={{ background: C.surface, borderRadius: 10, padding: '16px 18px', borderLeft: `6px solid ${tierColor}` }}>
      {overworked && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(232,64,64,0.14)', color: '#ff8f8f',
          fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 6, marginBottom: 10, fontFamily: FONT,
        }}>
          ⚠ {workloadPitches} pitches in last {WORKLOAD_WINDOW_DAYS} days — unavailable
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            {jersey && (
              <span style={{ fontSize: 14, fontWeight: 800, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>#{jersey}</span>
            )}
            <span style={{ fontSize: 19, fontWeight: 800, color: C.white, lineHeight: 1.2 }}>{p.pitcher}</span>
          </div>
          <RolePills starts={p.starts} relief={p.relief} />
          <div style={{ fontSize: 12, color: C.muted, marginTop: 5 }}>{p.starts}GS &middot; {p.relief}RP</div>
        </div>
        <RestChip days={p.daysRest} overworked={overworked} workloadPitches={workloadPitches} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, paddingTop: 12, borderTop: `1px solid ${C.edge}` }}>
        <div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, color: C.muted, marginBottom: 3 }}>Pitches</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.cream, fontVariantNumeric: 'tabular-nums' }}>{p.avgPitches ?? '—'}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, color: C.muted, marginBottom: 3 }}>Last IP</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.cream, fontVariantNumeric: 'tabular-nums' }}>{p.lastIp ?? '—'}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, color: C.muted, marginBottom: 3 }}>Avg rest</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.cream, fontVariantNumeric: 'tabular-nums' }}>{p.avgRestDays != null ? `${p.avgRestDays}d` : '—'}</div>
        </div>
      </div>
      <div style={{ marginTop: 10, fontSize: 12.5, color: C.muted, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <span>{p.lastOpponent || '—'}<FlagBadge flag={p.lastOutingFlag} /></span>
        <MiniSparkline outings={p.recentOutings || []} />
      </div>
    </div>
  );
}

export default function PitcherRestTracker({ team, onBack }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('rest');
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

  const pitchers = useMemo(() => {
    if (!data?.pitchers) return [];
    const rows = data.pitchers.filter(p => p.team === team.name);
    const sorters = {
      rest: (a, b) => a.daysRest - b.daysRest,
      pitches: (a, b) => (b.avgPitches || 0) - (a.avgPitches || 0),
      name: (a, b) => a.pitcher.localeCompare(b.pitcher),
    };
    return [...rows].sort(sorters[sort] || sorters.rest);
  }, [data, team.name, sort]);

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
        <div style={{ display: 'flex', gap: 8 }}>
          {[['rest', 'Days rest'], ['pitches', 'Avg pitches'], ['name', 'Name']].map(([key, label]) => (
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
        ) : pitchers.length === 0 ? (
          <div style={{ textAlign: 'center', color: C.muted, padding: 60, fontSize: 13 }}>
            No logged outings yet for {team.name}.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {pitchers.map(p => (
              <PitcherCard key={p.pitcher} p={p} jersey={jerseyByName[normalizeName(p.pitcher)]} />
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
