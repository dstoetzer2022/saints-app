import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const NAVY = '#0e253a';
const GOLD = '#c6b583';

const DIV_COLORS = {
  North: { bg: 'rgba(59,130,246,0.18)', border: 'rgba(59,130,246,0.4)', text: '#93c5fd' },
  South: { bg: 'rgba(239,68,68,0.18)', border: 'rgba(239,68,68,0.4)', text: '#fca5a5' },
  Affiliate: { bg: 'rgba(156,163,175,0.18)', border: 'rgba(156,163,175,0.35)', text: '#d1d5db' },
};

function DivBadge({ division }) {
  const c = DIV_COLORS[division] || DIV_COLORS.Affiliate;
  return (
    <span style={{
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
    }}>
      {division || 'CCL'}
    </span>
  );
}

function TeamCard({ team, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${hovered ? 'rgba(198,181,131,0.5)' : 'rgba(198,181,131,0.15)'}`,
        borderRadius: 12,
        padding: '28px 18px 22px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 12,
        transition: 'all 0.18s ease',
        transform: hovered ? 'translateY(-3px)' : 'none',
        boxShadow: hovered ? '0 16px 40px rgba(0,0,0,0.45)' : 'none',
        backdropFilter: 'blur(12px)',
        width: '100%',
      }}
    >
      <div style={{ width: 72, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {team.logo_url ? (
          <img
            src={team.logo_url}
            alt={team.name}
            style={{ maxWidth: 72, maxHeight: 72, objectFit: 'contain', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))' }}
          />
        ) : (
          <div style={{
            width: 64, height: 64, borderRadius: '50%', background: team.primary_color || NAVY,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 800, color: team.secondary_color || GOLD,
          }}>
            {(team.code || team.name || '?').slice(0, 3).toUpperCase()}
          </div>
        )}
      </div>
      <div>
        <div style={{ fontWeight: 800, fontSize: 14, color: '#f0ece0', lineHeight: 1.2, marginBottom: 8 }}>{team.name}</div>
        <DivBadge division={team.division} />
      </div>
    </div>
  );
}

export default function TeamGrid({ onSelectTeam, onHome, onLeaderboard }) {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Team.list('name', 100).then(ts => {
      setTeams(ts);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const byDivision = ['South', 'Affiliate', 'North'];
  const grouped = byDivision.reduce((acc, d) => {
    acc[d] = teams.filter(t => t.division === d);
    return acc;
  }, {});
  const ungrouped = teams.filter(t => !byDivision.includes(t.division));

  return (
    <div style={{ minHeight: '100vh', background: '#07111c', padding: '40px 24px 80px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: 900 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={onHome}
            style={{ background: 'none', border: '1px solid rgba(198,181,131,0.3)', borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 600, color: GOLD, cursor: 'pointer' }}
          >
            ← Home
          </button>
          {onLeaderboard && (
            <button
              onClick={onLeaderboard}
              style={{ background: 'rgba(198,181,131,0.12)', border: '1px solid rgba(198,181,131,0.4)', borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 700, color: GOLD, cursor: 'pointer' }}
            >
              🏆 League Leaderboard
            </button>
          )}
        </div>

        <div style={{ marginBottom: 40, textAlign: 'center' }}>
          <h1 style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 800, fontSize: 28, color: '#f0ece0', letterSpacing: '-0.5px', margin: 0 }}>
            Data Repository
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 6 }}>Select a team to browse their roster and player profiles</p>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div style={{ width: 28, height: 28, border: '3px solid rgba(198,181,131,0.2)', borderTopColor: GOLD, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : (
          <div>
            {byDivision.map(div => grouped[div]?.length > 0 && (
              <div key={div} style={{ marginBottom: 40 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 18 }}>
                  <div style={{ width: 3, height: 18, background: GOLD, borderRadius: 2 }} />
                  <span style={{ fontWeight: 800, fontSize: 13, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1.5 }}>{div} Division</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
                  {grouped[div].map(t => <TeamCard key={t.id} team={t} onClick={() => onSelectTeam(t)} />)}
                </div>
              </div>
            ))}
            {ungrouped.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 18 }}>
                  <div style={{ width: 3, height: 18, background: GOLD, borderRadius: 2 }} />
                  <span style={{ fontWeight: 800, fontSize: 13, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1.5 }}>Teams</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
                  {ungrouped.map(t => <TeamCard key={t.id} team={t} onClick={() => onSelectTeam(t)} />)}
                </div>
              </div>
            )}
            {teams.length === 0 && (
              <p style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 60 }}>No teams found. Add teams in Settings.</p>
            )}
          </div>
        )}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}