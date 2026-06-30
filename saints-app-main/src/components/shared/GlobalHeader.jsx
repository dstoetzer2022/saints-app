import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { NAVY, GOLD } from '@/lib/ds';

export default function GlobalHeader({ onHome }) {
  const [logoUrl, setLogoUrl] = useState(null);

  useEffect(() => {
    base44.entities.Team.filter({ code: 'ARR' }).then(teams => {
      if (teams[0]?.logo_url) setLogoUrl(teams[0].logo_url);
    }).catch(() => {});
  }, []);

  return (
    <header style={{
      background: NAVY,
      borderBottom: `3px solid ${GOLD}`,
      padding: '12px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <button
        onClick={onHome}
        style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        {logoUrl
          ? <img src={logoUrl} alt="Saints" style={{ width: 32, height: 32, objectFit: 'contain' }} />
          : <span style={{ fontSize: 22 }}>⚾</span>
        }
        <span style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 800, fontSize: 17, color: GOLD, letterSpacing: '-0.3px', whiteSpace: 'nowrap' }}>
          SAINTS DATA MATRIX
        </span>
      </button>
    </header>
  );
}