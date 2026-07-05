import React, { useState, useEffect, useMemo } from 'react';
import { C, FONT } from '@/lib/darkTheme';

// Populated by the CCL scraper (see the standalone ccl-pitcher-tracker repo).
// Point this at wherever the scraper's GitHub Action commits pitcher-rest.json —
// defaults to a same-origin path, i.e. this file living in this app's own
// public/data/ folder so Cloudflare Pages serves it statically alongside the app.
const REST_DATA_URL = 'https://raw.githubusercontent.com/dstoetzer2022/ccl-pitcher-tracker/main/data/pitcher-rest.json';

function restClass(d) { return d <= 1 ? 'low' : d <= 3 ? 'mid' : 'high'; }
function restColor(d) { return d <= 1 ? C.red : d <= 3 ? C.amber : C.green; }
function restLabel(d) { return d === 0 ? 'Today' : d === 1 ? '1 day' : `${d} days`; }
function availLabel(d) { return d <= 1 ? 'Likely unavailable' : d <= 3 ? 'Possible, watch role' : 'Likely available'; }

function RestPill({ days }) {
  const color = restColor(days);
  return (
    <div>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px',
        borderRadius: 20, fontWeight: 700, fontSize: 12.5, fontFamily: FONT,
        background: `${color}29`, color,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
        {restLabel(days)}
      </span>
      <div style={{ fontSize: 10.5, color: C.muted, marginTop: 3 }}>{availLabel(days)}</div>
    </div>
  );
}

function RoleBadge({ role, starts, relief }) {
  return (
    <div>
      <span style={{
        display: 'inline-block', padding: '3px 9px', borderRadius: 4, fontSize: 11, fontWeight: 700,
        fontFamily: FONT, letterSpacing: 0.3,
        background: role === 'SP' ? 'rgba(200,146,12,0.16)' : 'rgba(90,112,128,0.18)',
        color: role === 'SP' ? C.gold : C.muted,
      }}>
        {role}
      </span>
      <div style={{ fontSize: 10.5, color: C.muted, marginTop: 3 }}>{starts}GS &middot; {relief}RP</div>
    </div>
  );
}

function FlagBadge({ flag }) {
  if (!flag) return null;
  const isBlowup = flag === 'blowup';
  return (
    <div style={{
      display: 'inline-block', marginTop: 4, padding: '2px 7px', borderRadius: 4,
      fontSize: 10, fontWeight: 700, fontFamily: FONT,
      background: isBlowup ? 'rgba(232,64,64,0.16)' : 'rgba(232,168,0,0.16)',
      color: isBlowup ? '#f08a8a' : C.amber,
    }}>
      ⚠ {isBlowup ? 'Blowup' : 'Rough outing'}
    </div>
  );
}

function Sparkline({ outings }) {
  const vals = outings.map(o => o.pitches || 0);
  const max = Math.max(...vals, 1);
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 22 }}>
      {vals.map((v, i) => (
        <div key={i} style={{
          width: 5, borderRadius: 1,
          height: v ? Math.max(6, (v / max) * 22) : 3,
          background: v ? C.gold : C.faint,
          opacity: v ? 1 : 0.4,
        }} />
      ))}
    </div>
  );
}

export default function PitcherRestTracker({ team, onBack }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('rest');

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(REST_DATA_URL)
      .then(r => { if (!r.ok) throw new Error('not found'); return r.json(); })
      .then(json => { setData(json); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

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

      <div style={{ flex: 1, overflow: 'auto', padding: '0 24px' }}>
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
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 4 }}>
            <thead>
              <tr>
                {['Pitcher', 'Role', 'Days rest', 'Avg pitches', 'Avg rest', 'Last outing', 'IP', 'Pitches', 'Last 5'].map((h, i) => (
                  <th key={h} style={{
                    textAlign: [3, 4, 6, 7].includes(i) ? 'right' : 'left', padding: '10px 10px 8px', fontSize: 10.5,
                    textTransform: 'uppercase', letterSpacing: 1, color: C.muted, fontWeight: 700,
                    borderBottom: `1px solid ${C.edge}`, position: 'sticky', top: 0, background: C.base,
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pitchers.map(p => (
                <tr key={p.pitcher} style={{ borderBottom: `1px solid ${C.edge}` }}>
                  <td style={{ padding: '11px 10px', fontWeight: 800, fontSize: 13.5, color: C.cream }}>{p.pitcher}</td>
                  <td style={{ padding: '11px 10px' }}><RoleBadge role={p.role} starts={p.starts} relief={p.relief} /></td>
                  <td style={{ padding: '11px 10px' }}><RestPill days={p.daysRest} /></td>
                  <td style={{ padding: '11px 10px', textAlign: 'right', color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{p.avgPitches ?? '—'}</td>
                  <td style={{ padding: '11px 10px', textAlign: 'right', color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{p.avgRestDays != null ? `${p.avgRestDays}d` : '—'}</td>
                  <td style={{ padding: '11px 10px', fontSize: 12, color: C.muted }}>
                    {p.lastOpponent || '—'}
                    <FlagBadge flag={p.lastOutingFlag} />
                  </td>
                  <td style={{ padding: '11px 10px', textAlign: 'right', color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{p.lastIp ?? '—'}</td>
                  <td style={{ padding: '11px 10px', textAlign: 'right', color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{p.lastPitches ?? '—'}</td>
                  <td style={{ padding: '11px 10px' }}><Sparkline outings={p.recentOutings || []} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
