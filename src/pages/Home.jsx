import React from 'react';
import { useNavigate } from 'react-router-dom';
import { NAVY, GOLD, PAPER } from '@/lib/ds';
import { PlusCircle, BarChart2 } from 'lucide-react';

function HomeCard({ icon: Icon, title, subtitle, onClick }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        border: `2px solid ${hover ? GOLD : NAVY}`,
        borderRadius: 10,
        padding: '36px 32px',
        cursor: 'pointer',
        background: hover ? '#faf9f5' : '#fff',
        transition: 'all 0.15s',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
        minWidth: 220,
        flex: 1,
        maxWidth: 300,
      }}
    >
      <Icon size={42} color={hover ? GOLD : NAVY} strokeWidth={1.5} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 800, fontSize: 20, color: NAVY, marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 13, color: '#666', lineHeight: 1.4 }}>{subtitle}</div>
      </div>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: 'calc(100vh - 67px)',
      padding: '40px 24px', background: PAPER,
    }}>
      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        <h1 style={{ fontWeight: 800, fontSize: 28, color: NAVY, margin: 0, letterSpacing: '0.02em' }}>
          Saints Data Matrix
        </h1>
        <p style={{ color: '#888', marginTop: 6, fontSize: 13 }}>2026 Season</p>
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 700 }}>
        <HomeCard
          icon={PlusCircle}
          title="Add Data"
          subtitle="Import Trackman CSV or log scouting observations"
          onClick={() => navigate('/add')}
        />
        <HomeCard
          icon={BarChart2}
          title="View / Export"
          subtitle="Profiles, reports, and raw data for the active team"
          onClick={() => navigate('/view')}
        />
      </div>
    </div>
  );
}