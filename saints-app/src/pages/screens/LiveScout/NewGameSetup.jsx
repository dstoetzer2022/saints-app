import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import DarkScreenLayout from '@/components/shared/DarkScreenLayout';
import { snapshotTeamSeasonStats } from '@/lib/seasonAggregation';

const GOLD = '#c6b583';
const CCL_LOGO = 'https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817535/Primary_Logo_CCL_-1-_mbfr9k.png';

const DIV_COLORS = { South: '#ef4444', North: '#3b82f6', Affiliate: '#6b7280' };

export default function NewGameSetup({ onNext, onBack }) {
  const [teams, setTeams] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [opponentId, setOpponentId] = useState('');

  useEffect(() => {
    base44.entities.Team.list('name', 100).then(ts => setTeams(ts.filter(t => t.code !== 'ARR')));
  }, []);

  const opponent = teams.find(t => t.id === opponentId);

  return (
    <DarkScreenLayout>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '40px 20px 60px' }}>
        <div style={{ width: '100%', maxWidth: 520 }}>

          {/* Header */}
          <div style={{ marginBottom: 28 }}>
            <button onClick={onBack} className="dark-back-btn" style={{ marginBottom: 24 }}>← Back</button>
            <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 800, fontSize: 26, color: '#f0ece0', letterSpacing: '-0.5px', textTransform: 'uppercase' }}>New Game</div>
            <div style={{ fontSize: 11, color: 'rgba(198,181,131,0.55)', fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 5 }}>Set up today's scouting session</div>
          </div>

          {/* Date */}
          <div className="dark-glass-card" style={{ padding: '18px 20px', marginBottom: 16 }}>
            <label className="dark-label">Game Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="dark-input" />
          </div>

          {/* Opponent grid */}
          <div className="dark-glass-card" style={{ padding: '18px 20px', marginBottom: 20 }}>
            <label className="dark-label">Select Opponent</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 2 }}>
              {teams.map(t => {
                const selected = opponentId === t.id;
                const divColor = DIV_COLORS[t.division] || '#6b7280';
                return (
                  <div key={t.id} onClick={() => setOpponentId(t.id)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                      padding: '14px 8px', borderRadius: 10, cursor: 'pointer', transition: 'all 0.12s',
                      background: selected ? 'rgba(198,181,131,0.12)' : 'rgba(255,255,255,0.04)',
                      border: `1.5px solid ${selected ? GOLD : 'rgba(255,255,255,0.1)'}`,
                    }}
                    onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                    onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}>
                    <img src={t.logo_url || CCL_LOGO} alt={t.name} style={{ width: 38, height: 38, objectFit: 'contain', filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.5))' }} />
                    <div style={{ fontWeight: 700, fontSize: 11, color: selected ? '#f0ece0' : 'rgba(240,236,224,0.65)', textAlign: 'center', lineHeight: 1.3, fontFamily: "'Archivo', sans-serif" }}>{t.name}</div>
                    {t.division && (
                      <div style={{ fontSize: 9, fontWeight: 800, color: divColor, letterSpacing: 0.8, textTransform: 'uppercase', opacity: 0.85 }}>{t.division}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected opponent banner */}
          {opponent && (
            <div className="dark-glass-card" style={{ padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14, borderColor: `rgba(198,181,131,0.35)` }}>
              <img src={opponent.logo_url || CCL_LOGO} alt={opponent.name} style={{ width: 44, height: 44, objectFit: 'contain', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))' }} />
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(198,181,131,0.6)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>Opponent</div>
                <div style={{ fontWeight: 800, fontSize: 17, color: '#f0ece0', fontFamily: "'Archivo', sans-serif" }}>{opponent.name}</div>
              </div>
            </div>
          )}

          <button disabled={!date || !opponentId} onClick={() => {
            // Fire-and-forget background snapshot of opponent's season stats
            if (opponent?.trackman_code) {
              base44.entities.Team.list('name', 100).then(allTeams => {
                snapshotTeamSeasonStats(opponent.trackman_code, allTeams).catch(() => {});
              }).catch(() => {});
            }
            onNext({ date, opponent });
          }} className="dark-primary-btn" style={{ width: '100%', padding: '16px', fontSize: 16 }}>
            Next: Lineup Card →
          </button>
        </div>
      </div>
    </DarkScreenLayout>
  );
}