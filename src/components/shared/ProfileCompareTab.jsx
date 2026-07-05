import React, { useState, useMemo } from 'react';
import { canonicalNameKey, isStrike, isSwing, isWhiff, isFastballVeloType } from '@/lib/statsUtils';
import { normalizePitch } from '@/lib/ds';
import { cswKbb, approxBarrelRate } from '@/lib/profileStats';

// AUDIT (Savant-parity): side-by-side comparison view (pitcher-vs-pitcher or
// hitter-vs-hitter). Reuses the already-cached leaguePitches set — no new
// network fetch, so opening this tab is instant and adds zero extra load.

const C = {
  surface: '#0d1a26', edge: '#192c3e', gold: '#c8920c',
  cream: '#edeae0', muted: '#7d93a6', white: '#f8f8f4',
};
const FONT = "'Archivo', system-ui, sans-serif";

function displayName(lastFirst) {
  if (!lastFirst || !lastFirst.includes(',')) return lastFirst;
  const [last, first] = lastFirst.split(',').map(s => s.trim());
  return `${first} ${last}`;
}

function pitcherStats(rows) {
  const n = rows.length;
  if (!n) return null;
  const fb = rows.filter(r => isFastballVeloType(normalizePitch(r.tagged_pitch_type || r.pitch_type)))
    .map(r => parseFloat(r.rel_speed)).filter(v => Number.isFinite(v) && v > 0);
  const swings = rows.filter(isSwing);
  const { cswPct, kbbPct } = cswKbb(rows);
  return {
    n,
    'Avg FB velo': fb.length ? `${(fb.reduce((a, b) => a + b, 0) / fb.length).toFixed(1)} mph` : '—',
    'Strike%': `${Math.round((rows.filter(isStrike).length / n) * 100)}%`,
    'Whiff%': swings.length ? `${Math.round((rows.filter(isWhiff).length / swings.length) * 100)}%` : '—',
    'CSW%': cswPct != null ? `${cswPct}%` : '—',
    'K-BB%': kbbPct != null ? `${kbbPct}%` : '—',
  };
}

function hitterStats(rows) {
  const n = rows.length;
  if (!n) return null;
  const bip = rows.filter(r => r.exit_speed != null);
  const evs = bip.map(r => parseFloat(r.exit_speed)).filter(Number.isFinite);
  const swings = rows.filter(isSwing);
  const { barrelPct } = approxBarrelRate(rows);
  return {
    n,
    'Avg exit velo': evs.length ? `${(evs.reduce((a, b) => a + b, 0) / evs.length).toFixed(1)} mph` : '—',
    'Whiff%': swings.length ? `${Math.round((rows.filter(isWhiff).length / swings.length) * 100)}%` : '—',
    'Barrel% (approx)': barrelPct != null ? `${barrelPct}%` : '—',
  };
}

export default function ProfileCompareTab({ currentName, currentPitches, isPitcher, leaguePitches }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);

  const nameField = isPitcher ? 'pitcher_name' : 'batter_name';
  const currentKey = canonicalNameKey(currentName);

  const candidates = useMemo(() => {
    const seen = new Set([currentKey]);
    const names = [];
    for (const r of leaguePitches || []) {
      const raw = r[nameField];
      if (!raw) continue;
      const key = canonicalNameKey(raw);
      if (seen.has(key)) continue;
      seen.add(key);
      names.push({ key, raw: displayName(raw) });
    }
    return names.sort((a, b) => a.raw.localeCompare(b.raw));
  }, [leaguePitches, currentKey, nameField]);

  const filtered = query.length >= 2
    ? candidates.filter(c => c.raw.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : [];

  const opponentPitches = useMemo(() => {
    if (!selected) return [];
    return (leaguePitches || []).filter(r => canonicalNameKey(r[nameField]) === selected.key);
  }, [selected, leaguePitches, nameField]);

  const statFn = isPitcher ? pitcherStats : hitterStats;
  const myStats = statFn(currentPitches);
  const theirStats = selected ? statFn(opponentPitches) : null;

  return (
    <div style={{ fontFamily: FONT }}>
      {!selected && (
        <div style={{ maxWidth: 340 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
            Compare against
          </div>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={isPitcher ? 'Search a pitcher…' : 'Search a hitter…'}
            style={{
              width: '100%', background: C.surface, border: `1px solid ${C.edge}`, borderRadius: 6,
              padding: '9px 12px', color: C.white, fontSize: 13, fontFamily: FONT,
            }}
          />
          {filtered.length > 0 && (
            <div style={{ marginTop: 6, background: C.surface, border: `1px solid ${C.edge}`, borderRadius: 6, overflow: 'hidden' }}>
              {filtered.map(c => (
                <div
                  key={c.key}
                  onClick={() => setSelected(c)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter') setSelected(c); }}
                  style={{ padding: '9px 12px', fontSize: 13, color: C.cream, cursor: 'pointer', borderBottom: `1px solid ${C.edge}` }}
                >
                  {c.raw}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {selected && (
        <div>
          <button
            onClick={() => { setSelected(null); setQuery(''); }}
            style={{ background: 'none', border: 'none', color: C.muted, fontSize: 11, fontWeight: 700, cursor: 'pointer', marginBottom: 16, padding: 0 }}
          >
            ← Choose someone else
          </button>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[{ label: displayName(currentName), stats: myStats }, { label: selected.raw, stats: theirStats }].map((col, i) => (
              <div key={i} style={{ background: C.surface, border: `1px solid ${C.edge}`, borderRadius: 9, padding: '14px 16px' }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.gold, marginBottom: 12 }}>{col.label}</div>
                {col.stats ? Object.entries(col.stats).filter(([k]) => k !== 'n').map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.edge}` }}>
                    <span style={{ fontSize: 12, color: C.muted }}>{k}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.white, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
                  </div>
                )) : <div style={{ color: C.muted, fontSize: 12 }}>No data.</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
