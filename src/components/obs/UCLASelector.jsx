import React from 'react';
import { NAVY, GOLD } from '@/lib/ds';

const SLOTS = ['U', '·', 'C', '·', 'L', '·', 'A'];
const LETTERS = ['U', 'C', 'L', 'A'];

function letterIndex(l) { return LETTERS.indexOf(l); }

export default function UCLASelector({ value, onChange }) {
  // value is a string like "", "U", "C·L", "U·C·L·A"
  const selectedLetters = value ? value.split('·') : [];
  const startIdx = selectedLetters.length ? letterIndex(selectedLetters[0]) : -1;
  const endIdx = selectedLetters.length ? letterIndex(selectedLetters[selectedLetters.length - 1]) : -1;

  function isInRange(letter) {
    const idx = letterIndex(letter);
    return idx >= startIdx && idx <= endIdx;
  }

  function handleClick(letter) {
    const idx = letterIndex(letter);
    if (startIdx === -1) {
      // nothing selected — start fresh
      onChange(letter);
      return;
    }
    if (idx === startIdx && idx === endIdx) {
      // clicking the only selected — clear
      onChange('');
      return;
    }
    if (isInRange(letter)) {
      // clicking inside range — collapse to just this letter
      onChange(letter);
      return;
    }
    // extend range
    const newStart = Math.min(idx, startIdx);
    const newEnd = Math.max(idx, endIdx);
    const range = LETTERS.slice(newStart, newEnd + 1).join('·');
    onChange(range);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {SLOTS.map((slot, i) => {
        if (slot === '·') {
          return (
            <span key={i} style={{ color: '#aaa', fontSize: 10, padding: '0 1px' }}>·</span>
          );
        }
        const active = isInRange(slot);
        return (
          <button
            key={slot}
            type="button"
            onClick={() => handleClick(slot)}
            style={{
              width: 32, height: 32, borderRadius: 5,
              border: `1.5px solid ${active ? NAVY : '#cdc8bd'}`,
              background: active ? NAVY : '#fff',
              color: active ? GOLD : NAVY,
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {slot}
          </button>
        );
      })}
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          style={{ marginLeft: 4, fontSize: 12, color: '#888', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          ×
        </button>
      )}
    </div>
  );
}