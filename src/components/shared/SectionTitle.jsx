import React from 'react';
import { NAVY, GOLD } from '@/lib/ds';

export default function SectionTitle({ children, sub }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 5, height: 22, background: GOLD, borderRadius: 2, flexShrink: 0 }} />
        <h2 style={{ margin: 0, fontFamily: "'Archivo', sans-serif", fontSize: 19, fontWeight: 800, color: NAVY, letterSpacing: '-0.3px' }}>
          {children}
        </h2>
      </div>
      {sub && <p style={{ margin: '4px 0 0 15px', fontSize: 12.5, color: '#777' }}>{sub}</p>}
    </div>
  );
}