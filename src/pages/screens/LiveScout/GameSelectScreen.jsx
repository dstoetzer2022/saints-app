import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import DarkScreenLayout from '@/components/shared/DarkScreenLayout';

const NAVY_DARK = '#07111c';
const GOLD = '#c6b583';
const CCL_LOGO = 'https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817535/Primary_Logo_CCL_-1-_mbfr9k.png';
const SAINTS_LOGO = 'https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817534/av99z9xmev36zy31_qm53uc.png';

export default function GameSelectScreen({ onResume, onNewGame, onBack }) {
  const [inProgress, setInProgress] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.Game.filter({ status: 'in-progress' }, '-date', 20),
      base44.entities.Team.list('name', 100),
    ]).then(([games, ts]) => {
      setInProgress(games);
      setTeams(ts);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  function getOpponent(game) {
    const isSaintsHome = game.home_team_code === 'ARR' || game.home_team === 'Arroyo Seco Saints';
    const oppCode = isSaintsHome ? game.away_team_code : game.home_team_code;
    const oppName = isSaintsHome ? game.away_team : game.home_team;
    const team = teams.find(t => t.code === oppCode || t.name === oppName);
    return { name: oppName || oppCode, logo: team?.logo_url || CCL_LOGO, team };
  }

  return (
    <DarkScreenLayout>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 20px' }}>

        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 40 }}>
          <img src={SAINTS_LOGO} alt="Saints" style={{ width: 80, height: 80, objectFit: 'contain', marginBottom: 18, filter: 'drop-shadow(0 0 24px rgba(198,181,131,0.25))' }} />
          <div style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 800, fontSize: 28, color: '#f0ece0', letterSpacing: '-0.5px', textTransform: 'uppercase', lineHeight: 1 }}>Live Scout</div>
          <div style={{ fontSize: 11, color: 'rgba(198,181,131,0.6)', fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 6 }}>Arroyo Seco Saints · 2026</div>
        </div>

        <div style={{ width: '100%', maxWidth: 460 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ width: 26, height: 26, border: '3px solid rgba(198,181,131,0.2)', borderTopColor: GOLD, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
            </div>
          ) : (
            <>
              {/* In-progress games */}
              {inProgress.length > 0 && (
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(198,181,131,0.55)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 }}>Resume In-Progress</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {inProgress.map(game => {
                      const opp = getOpponent(game);
                      return (
                        <div key={game.id} onClick={() => onResume(game, opp.team)}
                          className="dark-glass-card"
                          style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 18px', cursor: 'pointer', borderColor: 'rgba(34,197,94,0.35)', transition: 'background 0.15s, border-color 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.borderColor = 'rgba(34,197,94,0.6)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(34,197,94,0.35)'; }}>
                          <img src={opp.logo} alt={opp.name} style={{ width: 52, height: 52, objectFit: 'contain', flexShrink: 0, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))' }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 800, fontSize: 16, color: '#f0ece0', fontFamily: "'Archivo', sans-serif" }}>{opp.name}</div>
                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{game.date}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.5)', color: '#4ade80', borderRadius: 4, padding: '3px 10px', fontSize: 10.5, fontWeight: 800, letterSpacing: 0.8 }}>● LIVE</span>
                            <span style={{ fontWeight: 800, fontSize: 13, color: GOLD }}>Resume →</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* New Game */}
              <button onClick={onNewGame} className="dark-primary-btn"
                style={{ width: '100%', padding: '18px', fontSize: 17 }}>
                + New Game
              </button>
            </>
          )}
        </div>

        {/* Back */}
        <button onClick={onBack} className="dark-back-btn" style={{ marginTop: 28 }}>
          ← Home
        </button>
      </div>
    </DarkScreenLayout>
  );
}