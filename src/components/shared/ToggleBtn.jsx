import React from 'react';
import { NAVY, GOLD } from '@/lib/ds';

export default function ToggleBtn({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {options.map(opt => {
        const active = value === opt;
        return (
          <button key={opt} type="button" onClick={() => onChange(opt)}
            style={{
              padding: '5px 14px', borderRadius: 5, fontWeight: 700, fontSize: 13, cursor: 'pointer',
              border: `1.5px solid ${NAVY}`,
              background: active ? NAVY : '#fff',
              color: active ? GOLD : NAVY,
              transition: 'all 0.12s',
            }}>
            {opt}
          </button>
        );
      })}
    </div>
  );
}