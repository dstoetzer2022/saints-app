import React, { useState } from 'react';
import { C, FONT } from '@/lib/darkTheme';

const TABS = [
  { key: 'pitchers', label: 'Pitching Staff', desc: 'Arsenal, usage, and per-pitcher profiles', icon: '⚾', accent: '#c8920c' },
  { key: 'hitters', label: 'Hitters', desc: 'Zone profiles, spray charts, and hitter reports', icon: '🎯', accent: '#4a90c8' },
  { key: 'rest', label: 'Pitcher Rest Tracker', desc: 'League-wide pitch counts and days rest', icon: '📋', accent: '#21c55d' },
];

function HubCard({ tab, onClick }) {
  const [hovered, setHovered] = useState(false);
  const accent = tab.accent;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        background: hovered
          ? `linear-gradient(155deg, ${C.raised} 0%, ${C.surface} 100%)`
          : C.surface,
        border: `1px solid ${hovered ? accent : C.rim}`,
        borderRadius: 14,
        padding: '26px 22px 22px',
        cursor: 'pointer',
        overflow: 'hidden',
        transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
        transform: hovered ? 'translateY(-3px)' : 'none',
        boxShadow: hovered ? `0 14px 36px rgba(0,0,0,0.45), 0 0 0 1px ${accent}22` : '0 1px 0 rgba(0,0,0,0.2)',
      }}
    >
      {/* Top accent bar */}
      <div
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: accent,
          opacity: hovered ? 1 : 0.55,
          transition: 'opacity 0.18s ease',
        }}
      />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div
          style={{
            width: 44, height: 44, borderRadius: 10,
            background: hovered ? accent : `${accent}1a`,
            border: `1px solid ${hovered ? accent : `${accent}55`}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 21, marginBottom: 16,
            transition: 'all 0.18s ease',
          }}
        >
          {tab.icon}
        </div>
        <div
          style={{
            fontSize: 15, color: accent, opacity: hovered ? 1 : 0,
            transform: hovered ? 'translateX(0)' : 'translateX(-4px)',
            transition: 'all 0.18s ease', fontWeight: 900, marginTop: 10,
          }}
        >
          →
        </div>
      </div>

      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 16.5, color: C.white, marginBottom: 6, letterSpacing: '-0.2px' }}>
        {tab.label}
      </div>
      <div style={{ fontFamily: FONT, fontSize: 12.5, color: C.muted, lineHeight: 1.45 }}>
        {tab.desc}
      </div>
    </div>
  );
}

export default function TeamHub({ team, onSelectTab, onBack }) {
  const initials = team?.name ? team.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '??';

  return (
    <div style={{ minHeight: '100vh', background: C.base, padding: '40px 24px 80px', display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: FONT }}>
      <div style={{ width: '100%', maxWidth: 760 }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: `1px solid ${C.rim}`, borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 600, color: C.gold, cursor: 'pointer', marginBottom: 32, fontFamily: FONT }}
        >
          ← Data Repository
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 36 }}>
          {team?.logo_url
            ? <img src={team.logo_url} alt={team.name} style={{ width: 52, height: 52, objectFit: 'contain', borderRadius: 6, border: `1px solid ${C.rim}`, background: C.raised }} />
            : (
              <div style={{ width: 52, height: 52, borderRadius: 6, background: C.raised, border: `1px solid ${C.rim}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900, color: C.gold }}>
                {initials}
              </div>
            )
          }
          <div>
            <h1 style={{ fontWeight: 800, fontSize: 24, color: C.white, letterSpacing: '-0.4px', margin: 0 }}>{team?.name}</h1>
            <p style={{ color: C.muted, fontSize: 12.5, margin: '4px 0 0' }}>Select what you want to look at</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {TABS.map(tab => (
            <HubCard key={tab.key} tab={tab} onClick={() => onSelectTab(tab.key)} />
          ))}
        </div>
      </div>
    </div>
  );
}
