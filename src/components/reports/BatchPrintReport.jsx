import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { canonicalNameKey } from '@/lib/statsUtils';
import { buildHitterPool, buildArsenalPool } from '@/lib/profileStats';
import { getLeaguePitches } from '@/lib/leagueCache';
import { PitcherPage, HitterPage, REPORT_FONT, INK } from '@/components/reports/PrintProfileReport';

// Multi-player print run. Reuses the exact same PitcherPage/HitterPage the
// single-player report renders (fix-at-source — no second report
// definition to drift out of sync) and stacks one .print-report-page per
// selected player inside the same portal/overlay chrome. index.css already
// forces a physical page break between consecutive .print-report-page
// elements in print media, so this "just works" as one browser print job.
//
// players: [{ name, role: 'Pitcher'|'Hitter', jerseyNumber, hand, school }]
// pitches: team's pitcher_team-scoped TrackmanPitch rows (already loaded by
//   RosterView for the roster table's quick stats — no refetch here)
// batterPitches: team's batter_team-scoped TrackmanPitch rows
export default function BatchPrintReport({ open, onClose, players, team, pitches, batterPitches }) {
  const [hitterPool, setHitterPool] = useState(null);
  const [arsenalPool, setArsenalPool] = useState(null);
  const [poolsLoading, setPoolsLoading] = useState(true);

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

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPoolsLoading(true);
    getLeaguePitches().then(leaguePitches => {
      if (cancelled) return;
      // Same builders PlayerProfile uses for a single player — computed once
      // here and shared across every page in the batch instead of once per
      // player, since the league pool doesn't change player to player.
      setHitterPool(buildHitterPool(leaguePitches));
      setArsenalPool(buildArsenalPool(leaguePitches));
      setPoolsLoading(false);
    });
    return () => { cancelled = true; };
  }, [open]);

  // Ordering requirement: pitchers first, then hitters, regardless of
  // checkbox click order — matches the roster table's own section order.
  const ordered = useMemo(() => {
    const pitchers = players.filter(p => p.role === 'Pitcher');
    const hitters = players.filter(p => p.role !== 'Pitcher');
    return [...pitchers, ...hitters];
  }, [players]);

  const pageFor = player => {
    const isPitcher = player.role === 'Pitcher';
    const key = canonicalNameKey(player.name);
    // AUDIT: `pitches` (team pitcher_team scope) is padded with synthetic
    // PitcherArsenal placeholder rows — see RosterView's `_fromArsenal`
    // rows — so a pitcher with only season-aggregate arsenal data still
    // appears in the roster list. Those rows carry pitcher_name/hand/team
    // ONLY (no pitch_type, no Trackman fields) purely to seed the list;
    // they are NOT real pitches. Left in, every one of them normalizes to
    // "Undefined" in the arsenal breakdown, inflating the Undefined bucket
    // by however many arsenal rows that pitcher has (often 7-15% of the
    // set). Must be excluded here — the print report needs real per-pitch
    // rows, not roster-membership markers.
    const rows = isPitcher
      ? pitches.filter(p => canonicalNameKey(p.pitcher_name) === key && !p._fromArsenal)
      : batterPitches.filter(p => canonicalNameKey(p.batter_name) === key);
    const hand = isPitcher ? player.hand : player.hand;
    const commonProps = { player, team, school: player.school, hand, pitches: rows };
    return isPitcher
      ? <PitcherPage key={key} {...commonProps} hitterPool={hitterPool} arsenalPool={arsenalPool} />
      : <HitterPage key={key} {...commonProps} hitterPool={hitterPool} />;
  };

  if (!open) return null;

  return createPortal(
    <div className="print-report-overlay" style={{ position: 'fixed', inset: 0, zIndex: 2000, background: '#3f4348', overflowY: 'auto', padding: '56px 0 40px', fontFamily: REPORT_FONT, color: INK }}>
      <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 20px', background: '#2b2e32' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#ccc', fontFamily: REPORT_FONT }}>
          {poolsLoading ? 'Loading league pools…' : `${ordered.length} report${ordered.length === 1 ? '' : 's'} · pitchers then hitters`}
        </span>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => window.print()}
            disabled={poolsLoading}
            style={{ background: poolsLoading ? '#8a8577' : '#c6b583', border: 'none', color: '#1a1a1a', borderRadius: 6, padding: '8px 18px', fontSize: 12, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', cursor: poolsLoading ? 'default' : 'pointer', fontFamily: REPORT_FONT }}
          >
            Print / Save PDF
          </button>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #888', color: '#ccc', borderRadius: 6, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: REPORT_FONT }}>
            Close
          </button>
        </div>
      </div>
      {poolsLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 120 }}>
          <div style={{ width: 24, height: 24, border: '3px solid #6a6e73', borderTopColor: '#c6b583', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : (
        ordered.map(pageFor)
      )}
    </div>,
    document.body
  );
}
