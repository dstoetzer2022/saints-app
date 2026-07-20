import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PitcherPage, REPORT_FONT, INK } from './PrintProfileReport';

// Single-game pitcher report — reuses PitcherPage from PrintProfileReport
// verbatim (one layout implementation, fix-at-source), just fed pitches
// pre-filtered to one game_id instead of the profile's season/scope window.
// Pitchers only for now, per spec; a hitter version would wire HitterPage
// the same way if this gets extended later.

function formatGameDate(d) {
  if (!d) return '';
  const parsed = new Date(d);
  return isNaN(parsed) ? d : parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PrintGameReport({ open, onClose, player, team, school, hand, pitches, hitterPool, arsenalPool, opponent, gameDate }) {
  useEffect(() => {
    if (!open) return;
    document.body.classList.add('print-report-open');
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('print-report-open');
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const scopeLabel = ['Game', opponent ? `vs ${opponent}` : null, formatGameDate(gameDate)].filter(Boolean).join(' · ');

  return createPortal(
    <div className="print-report-overlay" style={{ position: 'fixed', inset: 0, zIndex: 2000, background: '#3f4348', overflowY: 'auto', padding: '56px 0 40px', fontFamily: REPORT_FONT, color: INK }}>
      <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1, display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '10px 20px', background: '#2b2e32' }}>
        <button onClick={() => window.print()} style={{ background: '#c6b583', border: 'none', color: '#1a1a1a', borderRadius: 6, padding: '8px 18px', fontSize: 12, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', cursor: 'pointer', fontFamily: REPORT_FONT }}>
          Print / Save PDF
        </button>
        <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #888', color: '#ccc', borderRadius: 6, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: REPORT_FONT }}>
          Close
        </button>
      </div>
      <PitcherPage player={player} team={team} school={school} hand={hand} pitches={pitches} hitterPool={hitterPool} arsenalPool={arsenalPool} scopeLabel={scopeLabel} />
    </div>,
    document.body
  );
}
