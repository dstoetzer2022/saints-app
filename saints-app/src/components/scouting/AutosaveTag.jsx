import React from 'react';

export default function AutosaveTag({ status }) {
  if (!status) return null;
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: status === 'saving' ? '#888' : '#2c5530', transition: 'opacity 0.2s' }}>
      {status === 'saving' ? 'Saving…' : 'Saved ✓'}
    </span>
  );
}