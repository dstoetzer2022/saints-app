import React from 'react';

// Extended for Phase 4.2 (offline-first Live Scout): 'offline' status shows
// when a write is queued in IndexedDB but hasn't reached the server yet —
// distinct from the normal in-flight 'saving' so a scout on a spotty
// connection can see their notes are safely queued locally, not lost.
export default function AutosaveTag({ status, pendingCount = 0 }) {
  if (status === 'offline' || pendingCount > 0) {
    return (
      <span style={{ fontSize: 11, fontWeight: 700, color: '#facc15', display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#facc15', display: 'inline-block' }} />
        Offline — saved locally{pendingCount > 1 ? ` (${pendingCount} pending)` : ''}
      </span>
    );
  }
  if (!status) return null;
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: status === 'saving' ? 'rgba(255,255,255,0.4)' : '#4ade80', transition: 'opacity 0.2s' }}>
      {status === 'saving' ? 'Saving…' : 'Saved ✓'}
    </span>
  );
}