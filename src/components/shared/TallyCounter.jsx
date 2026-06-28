import React from 'react';
import { NAVY, BORDER, PAPER } from '@/lib/ds';

export default function TallyCounter({ value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <button type="button" onClick={() => onChange(Math.max(0, value - 1))}
        style={{ width: 24, height: 28, border: `1.5px solid ${BORDER}`, borderRadius: 4, background: PAPER, fontWeight: 700, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        −
      </button>
      <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 700, fontSize: 15, color: NAVY }}>{value}</span>
      <button type="button" onClick={() => onChange(value + 1)}
        style={{ width: 24, height: 28, border: `1.5px solid ${BORDER}`, borderRadius: 4, background: PAPER, fontWeight: 700, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        +
      </button>
    </div>
  );
}