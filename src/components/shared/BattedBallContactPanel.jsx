import React, { useMemo } from 'react';
import { BarChart, Bar, Cell, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { battedBallProfile, contactQualityBreakdown, evHistogramBins, fmtStat } from '@/lib/profileStats';
import { C, FONT } from '@/lib/darkTheme';

const FONT_STYLE = { fontFamily: FONT };
const pct = v => v == null ? '—' : Math.round(v * 100) + '%';
const n1 = v => v == null ? '—' : v.toFixed(1);

function SegBar({ segments, label }) {
  const total = segments.reduce((s, x) => s + (x.value || 0), 0);
  if (!total) return null;
  return (
    <div style={{ flex: '1 1 220px' }}>
      <div style={{ fontSize: 10, color: C.muted, marginBottom: 5, ...FONT_STYLE }}>{label}</div>
      <div style={{ display: 'flex', height: 20, borderRadius: 4, overflow: 'hidden', border: `1px solid ${C.edge}` }}>
        {segments.filter(s => s.value > 0).map(s => (
          <div key={s.label} style={{ width: (s.value / total * 100) + '%', background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: s.text }}>
            {s.value / total >= 0.08 ? `${s.label} ${Math.round(s.value / total * 100)}%` : ''}
          </div>
        ))}
      </div>
    </div>
  );
}

const TIER_LABEL = { Barrel: 'Barrel', Solid: 'Solid', FlareBurner: 'Flare/Burner', Topped: 'Topped', Under: 'Under', Weak: 'Weak' };
const TIER_COLOR = { Barrel: C.green, Solid: '#4a95c0', FlareBurner: C.gold, Topped: '#c49a5a', Under: C.muted, Weak: C.red };

function ContactQualityTable({ rows }) {
  const { tiers, n } = useMemo(() => contactQualityBreakdown(rows), [rows]);
  if (!tiers.length) return <div style={{ color: C.muted, fontSize: 12 }}>Need at least 5 balls in play.</div>;
  const th = { padding: '6px 8px', fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.6, textAlign: 'right', background: C.surface, ...FONT_STYLE };
  const td = { padding: '7px 8px', fontSize: 12, textAlign: 'right', color: C.cream, fontVariantNumeric: 'tabular-nums', borderBottom: `0.5px solid ${C.edge}`, ...FONT_STYLE };
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead><tr>
          <th style={{ ...th, textAlign: 'left' }}>Type</th>
          <th style={th}>%</th>
          <th style={th}>Avg EV</th>
          <th style={th}>wOBA (approx)</th>
        </tr></thead>
        <tbody>
          {tiers.map((t, i) => (
            <tr
              key={t.key}
              style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.018)', borderLeft: `3px solid ${TIER_COLOR[t.key]}44`, transition: 'background 0.1s' }}
              onMouseEnter={e => { e.currentTarget.style.background = C.raised; }}
              onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.018)'; }}
            >
              <td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: TIER_COLOR[t.key], marginRight: 6 }} />
                {TIER_LABEL[t.key]}
              </td>
              <td style={{ ...td, color: t.pct ? C.white : C.muted, fontWeight: 700 }}>{t.pct}%</td>
              <td style={td}>{n1(t.avgEV)}</td>
              <td style={td}>{t.woba != null ? fmtStat(t.woba) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize: 9, color: C.muted, marginTop: 4, ...FONT_STYLE }}>n={n} balls in play. Tiers are an EV/LA approximation, not Statcast's proprietary formula — same caveat as Barrel% (approx) elsewhere in the app.</div>
    </div>
  );
}

function EVHistogram({ rows }) {
  const bins = useMemo(() => evHistogramBins(rows), [rows]);
  if (!bins.length) return null;
  return (
    <div>
      <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, ...FONT_STYLE }}>Exit velocity distribution</div>
      <ResponsiveContainer width="100%" height={110}>
        <BarChart data={bins} margin={{ top: 2, right: 8, bottom: 2, left: 0 }}>
          <XAxis dataKey="label" tick={{ fontSize: 9, fill: C.muted }} interval={4} />
          <YAxis tick={{ fontSize: 9, fill: C.muted }} width={22} />
          <Bar dataKey="count" radius={[2, 2, 0, 0]}>
            {bins.map((b, i) => (
              <Cell key={i} fill={b.lo >= 95 ? C.red : b.lo >= 80 ? C.gold : C.green} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// rows = balls-in-play-eligible pitch rows (InPlay pitch_call with exit_speed etc).
export default function BattedBallContactPanel({ rows }) {
  const profile = useMemo(() => battedBallProfile(rows), [rows]);

  return (
    <div style={FONT_STYLE}>
      {profile && (
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 18 }}>
          <SegBar label="Trajectory" segments={[
            { label: 'GB', value: profile.gbPct, color: '#c49a5a', text: '#3a2c14' },
            { label: 'LD', value: profile.ldPct, color: C.green, text: '#0a2e14' },
            { label: 'FB', value: profile.fbPct, color: '#4a95c0', text: '#0a2436' },
            { label: 'PU', value: profile.puPct, color: C.muted, text: '#12222e' },
          ]} />
          {profile.pullPct != null && (
            <SegBar label="Direction" segments={[
              { label: 'Pull', value: profile.pullPct, color: C.red, text: '#fff' },
              { label: 'Straight', value: profile.straightPct, color: C.muted, text: '#12222e' },
              { label: 'Oppo', value: profile.oppoPct, color: C.gold, text: '#3a2c02' },
            ]} />
          )}
        </div>
      )}
      <div style={{ marginBottom: 18 }}>
        <ContactQualityTable rows={rows} />
      </div>
      <EVHistogram rows={rows} />
    </div>
  );
}
