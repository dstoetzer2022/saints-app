import React from 'react';
import { NAVY } from '@/lib/ds';

export function SpeedPicker({ value, onChange }) {
  const opts = [
    { val: 'fast', color: '#22c55e', label: 'Fast' },
    { val: 'average', color: '#eab308', label: 'Average' },
    { val: 'slow', color: '#ef4444', label: 'Slow' },
  ];
  return <CirclePicker value={value} onChange={onChange} opts={opts} />;
}

export function AggressionPicker({ value, onChange }) {
  const opts = [
    { val: 'aggressive', color: '#22c55e', label: 'Aggressive' },
    { val: 'average', color: '#eab308', label: 'Average' },
    { val: 'passive', color: '#ef4444', label: 'Passive' },
  ];
  return <CirclePicker value={value} onChange={onChange} opts={opts} />;
}

function CirclePicker({ value, onChange, opts }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {opts.map(o => (
        <button key={o.val} type="button" title={o.label}
          onClick={() => onChange(value === o.val ? '' : o.val)}
          style={{
            width: 28, height: 28, borderRadius: '50%', background: o.color, cursor: 'pointer', padding: 0,
            border: value === o.val ? `3px solid ${NAVY}` : '2px solid #ccc',
            transform: value === o.val ? 'scale(1.15)' : 'scale(1)',
            transition: 'all 0.12s',
          }} />
      ))}
      {value && (
        <button type="button" onClick={() => onChange('')}
          style={{ fontSize: 13, color: '#888', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}>
          ×
        </button>
      )}
    </div>
  );
}