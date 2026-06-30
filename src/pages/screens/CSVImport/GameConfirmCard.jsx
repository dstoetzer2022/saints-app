import React from 'react';

const GOLD = '#c6b583';
const NAVY = '#07111c';

export default function GameConfirmCard({ preview, onImport, onCancel, importing, progress }) {
  const { homeTeam, awayTeam, date, stadium, pitchCount, duplicate } = preview;

  return (
    <div style={{
      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(198,181,131,0.22)',
      borderRadius: 14, backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
      padding: '28px 28px 24px', width: '100%', maxWidth: 520,
    }}>
      {/* Teams header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 20 }}>
        <TeamLogo team={awayTeam} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: 'rgba(198,181,131,0.55)', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>at</div>
        </div>
        <TeamLogo team={homeTeam} />
      </div>

      {/* Game info */}
      <div style={{ textAlign: 'center', marginBottom: 18 }}>
        <div style={{ fontWeight: 800, fontSize: 17, color: '#f0ece0', letterSpacing: '-0.3px' }}>
          {awayTeam?.name || '—'} <span style={{ color: 'rgba(198,181,131,0.5)' }}>vs</span> {homeTeam?.name || '—'}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>
          {date} {stadium ? `· ${stadium}` : ''}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(198,181,131,0.7)', fontWeight: 700, marginTop: 6 }}>
          {pitchCount} pitches detected
        </div>
      </div>

      {/* Duplicate warning */}
      {duplicate && (
        <div style={{
          background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.35)',
          borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12,
          color: '#fb923c', fontWeight: 600, lineHeight: 1.5,
        }}>
          ⚠️ This game has already been imported. Re-importing will overwrite existing Trackman data for this game.
        </div>
      )}

      {/* Progress */}
      {importing && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
            <span>{progress.label}</span>
            <span>{progress.pct}%</span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 99, height: 5, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: GOLD, borderRadius: 99, width: `${progress.pct}%`, transition: 'width 0.3s ease' }} />
          </div>
        </div>
      )}

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onCancel} disabled={importing} style={{
          flex: 1, padding: '11px 0', borderRadius: 8, border: '1px solid rgba(198,181,131,0.25)',
          background: 'rgba(255,255,255,0.05)', color: 'rgba(240,236,224,0.7)', fontWeight: 700,
          fontSize: 14, cursor: importing ? 'not-allowed' : 'pointer', fontFamily: "'Archivo', sans-serif",
          opacity: importing ? 0.5 : 1,
        }}>Cancel</button>
        <button onClick={onImport} disabled={importing} style={{
          flex: 2, padding: '11px 0', borderRadius: 8, border: 'none',
          background: importing ? 'rgba(198,181,131,0.4)' : GOLD,
          color: NAVY, fontWeight: 800, fontSize: 14, cursor: importing ? 'not-allowed' : 'pointer',
          fontFamily: "'Archivo', sans-serif",
        }}>
          {importing ? 'Importing…' : duplicate ? 'Re-import & Overwrite' : 'Import'}
        </button>
      </div>
    </div>
  );
}

function TeamLogo({ team }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 64, height: 64, borderRadius: 12,
        background: team?.primary_color ? `${team.primary_color}33` : 'rgba(255,255,255,0.07)',
        border: '1px solid rgba(198,181,131,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      }}>
        {team?.logo_url
          ? <img src={team.logo_url} alt={team.name} style={{ width: 48, height: 48, objectFit: 'contain' }} />
          : <span style={{ fontWeight: 800, fontSize: 18, color: team?.primary_color || '#c6b583' }}>{(team?.code || '?').slice(0, 3)}</span>
        }
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.55)', textAlign: 'center', maxWidth: 80, lineHeight: 1.3 }}>{team?.code || '—'}</div>
    </div>
  );
}