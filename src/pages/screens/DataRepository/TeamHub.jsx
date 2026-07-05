import React, { useState } from 'react';
import { C, FONT } from '@/lib/darkTheme';

const TABS = [
  { key: 'pitchers', label: 'Pitching Staff', desc: 'Arsenal, usage, and per-pitcher profiles', icon: '⚾' },
  { key: 'hitters', label: 'Hitters', desc: 'Zone profiles, spray charts, and hitter reports', icon: '🎯' },
  { key: 'rest', label: 'Pitcher Rest Tracker', desc: 'League-wide pitch counts and days rest', icon: '📋' },
];

function HubCard({ tab, onClick, accentColor }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? C.raised : C.surface,
        border: `1px solid ${hovered ? accentColor : C.rim}`,
        borderRadius: 12,
        padding: '28px 22px',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered ? '0 12px 32px rgba(0,0,0,0.4)' : 'none',
      }}
    >
      <div style={{ fontSize: 26, marginBottom: 14 }}>{tab.icon}</div>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 16, color: C.white, marginBottom: 6 }}>
        {tab.label}
      </div>
      <div style={{ fontFamily: FONT, fontSize: 12.5, color: C.muted, lineHeight: 1.4 }}>
        {tab.desc}
      </div>
    </div>
  );
}

export default function TeamHub({ team, onSelectTab, onBack }) {
  const accentColor = team?.primary_color || C.gold;
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          {TABS.map(tab => (
            <HubCard key={tab.key} tab={tab} accentColor={accentColor} onClick={() => onSelectTab(tab.key)} />
          ))}
        </div>
      </div>
    </div>
  );
}
