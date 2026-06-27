import React from 'react';

const GOLD = '#c6b583';
const NAVY = '#07111c';

export default function ImportSummaryCard({ summary, onViewRepo, onDone }) {
  const { pitchCount, pitchers, batters, catcherPops } = summary;

  return (
    <div style={{
      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(74,222,128,0.25)',
      borderRadius: 14, backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
      padding: '28px 28px 24px', width: '100%', maxWidth: 520,
    }}>
      <div style={{ display: 'flex', align: 'center', gap: 10, marginBottom: 20 }}>
        <span style={{ fontSize: 24 }}>✅</span>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18, color: '#4ade80', letterSpacing: '-0.3px' }}>Import Complete</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{pitchCount} pitches imported</div>
        </div>
      </div>

      {/* Pitchers */}
      <Section label={`${pitchers.length} Pitcher${pitchers.length !== 1 ? 's' : ''} Found`}>
        {pitchers.map((p, i) => (
          <Row key={i} left={p.name} right={<span style={{ color: 'rgba(198,181,131,0.7)', fontSize: 11 }}>{p.team}</span>} />
        ))}
      </Section>

      {/* Batters */}
      <Section label={`${batters.length} Batter${batters.length !== 1 ? 's' : ''} Found`}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
          {batters.slice(0, 8).join(', ')}{batters.length > 8 ? ` +${batters.length - 8} more` : ''}
        </div>
      </Section>

      {/* Catcher pop times */}
      <Section label="Catcher Pop Time Data">
        {catcherPops.length === 0
          ? <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>None found in this file</div>
          : catcherPops.map((c, i) => (
            <Row key={i} left={c.name} right={<span style={{ color: GOLD, fontWeight: 700, fontSize: 12 }}>{c.count} throw{c.count !== 1 ? 's' : ''}</span>} />
          ))
        }
      </Section>

      <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
        <button onClick={onDone} style={{
          flex: 1, padding: '10px 0', borderRadius: 8,
          border: '1px solid rgba(198,181,131,0.25)', background: 'rgba(255,255,255,0.05)',
          color: 'rgba(240,236,224,0.7)', fontWeight: 700, fontSize: 13,
          cursor: 'pointer', fontFamily: "'Archivo', sans-serif",
        }}>Import Another</button>
        <button onClick={onViewRepo} style={{
          flex: 2, padding: '10px 0', borderRadius: 8, border: 'none',
          background: GOLD, color: NAVY, fontWeight: 800, fontSize: 14,
          cursor: 'pointer', fontFamily: "'Archivo', sans-serif",
        }}>View in Data Repository →</button>
      </div>
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(198,181,131,0.55)', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{children}</div>
    </div>
  );
}

function Row({ left, right }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: '#f0ece0', fontWeight: 600 }}>
      <span>{left}</span>
      <span>{right}</span>
    </div>
  );
}