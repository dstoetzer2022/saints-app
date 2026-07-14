import React, { useMemo, useState } from 'react';
import { xHRParkBreakdown, xHRProfile } from '@/lib/profileStats';
import { C, FONT } from '@/lib/darkTheme';

const FONT_STYLE = { fontFamily: FONT };

function SummaryPill({ value, label, color }) {
  return (
    <div style={{ flex: '1 1 120px', background: C.base, border: `1px solid ${C.edge}`, borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 900, color, fontVariantNumeric: 'tabular-nums', ...FONT_STYLE }}>{value}</div>
      <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 2, ...FONT_STYLE }}>{label}</div>
    </div>
  );
}

function ParkRow({ park, maxPct }) {
  const [hovered, setHovered] = useState(false);
  const isTop = park.pct === maxPct && maxPct > 0;
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', borderRadius: 6, background: hovered ? C.raised : 'transparent', transition: 'background 0.1s' }}
    >
      <div style={{ width: 150, flexShrink: 0, fontSize: 12, color: C.cream, fontWeight: isTop ? 700 : 500, ...FONT_STYLE }}>
        {park.name} <span style={{ color: C.muted, fontWeight: 400 }}>({park.cf}')</span>
      </div>
      <div style={{ flex: 1, height: 8, background: C.edge, borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          width: `${park.pct * 100}%`, height: '100%', borderRadius: 4,
          background: isTop ? `linear-gradient(90deg, ${C.goldDim}, ${C.gold})` : 'rgba(200,146,12,.45)',
        }} />
      </div>
      <div style={{ width: 40, textAlign: 'right', fontSize: 12, fontWeight: 800, color: isTop ? C.gold : C.white, fontVariantNumeric: 'tabular-nums', ...FONT_STYLE }}>
        {Math.round(park.pct * 100)}%
      </div>
    </div>
  );
}

// direction: 'for' (hitter's own fly balls) or 'against' (pitcher's allowed).
export default function XHRParkTable({ rows, direction = 'for' }) {
  const breakdown = useMemo(() => xHRParkBreakdown(rows), [rows]);
  const profile = useMemo(() => xHRProfile(rows), [rows]);

  if (!breakdown) return <div style={{ color: C.muted, fontSize: 12, ...FONT_STYLE }}>Need at least 5 fly balls (LA 20°–40°) with distance/bearing recorded.</div>;

  const verb = direction === 'against' ? 'allowed' : 'hit';
  const maxPct = Math.max(...breakdown.parks.map(p => p.pct), 0);

  return (
    <div style={FONT_STYLE}>
      {profile && (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            <SummaryPill value={`${Math.round(profile.noDoubterPct * 100)}%`} label="No-doubter" color={C.green} />
            <SummaryPill value={`${Math.round(profile.someParksPct * 100)}%`} label="Some parks" color={C.gold} />
            <SummaryPill value={`${Math.round(profile.noParksPct * 100)}%`} label="No parks" color={C.muted} />
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 12, ...FONT_STYLE }}>
            Of {profile.n} {verb} fly balls, based on distance vs. fence at {profile.ofParks} CCL parks.
          </div>
        </>
      )}
      <div style={{ fontSize: 9, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4, padding: '0 8px' }}>
        Park (CF dist) &nbsp;·&nbsp; Would-be HR%
      </div>
      <div>
        {breakdown.parks.map(p => <ParkRow key={p.code} park={p} maxPct={maxPct} />)}
      </div>
      <div style={{ fontSize: 9, color: C.muted, marginTop: 10 }}>
        Distance-only approximation (LA 20°–40° fly balls vs. fence distance by spray angle) — no wall-height data exists for these fields, so this can overstate HRs on low liners and understate them on towering fly balls that die at a tall wall.
      </div>
    </div>
  );
}
