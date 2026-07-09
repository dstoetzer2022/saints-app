import React from 'react';

// AUDIT (Savant-parity): in-app export/print, replacing the manual
// GitHub-repo sharing step. Uses the browser's native print dialog (save-as-
// PDF) rather than a client-side PDF library — no new dependency, and it
// respects whatever the browser's print handling already does correctly.
// Print-only CSS (hiding chrome, expanding scroll areas) lives in index.css
// under @media print, scoped to [data-print-root].

export default function ExportProfileButton({ style, onClick }) {
  return (
    <button
      onClick={onClick || (() => window.print())}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'transparent', border: '1px solid #c6b583', color: '#c6b583',
        borderRadius: 6, padding: '7px 14px', fontSize: 11, fontWeight: 700,
        letterSpacing: 0.3, textTransform: 'uppercase', cursor: 'pointer',
        fontFamily: "'Archivo', system-ui, sans-serif",
        ...style,
      }}
      aria-label="Export or print this player's profile"
    >
      Export / Print
    </button>
  );
}
