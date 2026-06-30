import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useApp } from '@/lib/AppContext';
import { NAVY, GOLD, PAPER } from '@/lib/ds';

export default function AppLayout() {
  const { teams } = useApp();
  const navigate = useNavigate();
  const saintsTeam = teams.find(t => t.code === 'ARR');
  const logoUrl = saintsTeam?.logo_url;

  return (
    <div style={{ minHeight: '100vh', background: PAPER }}>
      <header style={{
        background: NAVY,
        borderBottom: `3px solid ${GOLD}`,
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
      }}>
        <div
          onClick={() => navigate('/')}
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
        >
          {logoUrl && (
            <img src={logoUrl} alt="Saints" style={{ width: 32, height: 32, objectFit: 'contain' }} />
          )}
          <span style={{
            fontFamily: "'Archivo', sans-serif",
            fontWeight: 800,
            fontSize: 17,
            color: GOLD,
            letterSpacing: '0.04em',
            whiteSpace: 'nowrap',
          }}>
            SAINTS DATA MATRIX
          </span>
        </div>
      </header>

      <Outlet />
    </div>
  );
}