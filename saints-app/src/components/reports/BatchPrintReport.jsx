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
  const [leaguePitches, setLeaguePitches] = useState([]);
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
      setLeaguePitches(leaguePitches);
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
    const nameField = isPitcher ? 'pitcher_name' : 'batter_name';
    // AUDIT: `pitches`/`batterPitches` (RosterView) are scoped strictly by
    // pitcher_team/batter_team — unlike PlayerProfile's single-player fetch,
    // which queries by pitcher_name AND unions any league-wide row matching
    // by canonical name key, so a row with a missing/mistagged team code
    // still surfaces. A team-scoped-only set can silently drop real
    // pitches (e.g. O'Regan's hardest pitch of the season tagged under a
    // mismatched team code) — Max FB and every other stat would then read
    // low with no visible error. Union with leaguePitches by name, same
    // merge pattern as PlayerProfile, so batch print sees the identical
    // pitch universe a single-player print would.
    const teamScoped = isPitcher
      ? pitches.filter(p => canonicalNameKey(p.pitcher_name) === key && !p._fromArsenal)
      : batterPitches.filter(p => canonicalNameKey(p.batter_name) === key);
    const variantRows = leaguePitches.filter(p => canonicalNameKey(p[nameField]) === key);
    const seen = new Set();
    const rows = [...teamScoped, ...variantRows].filter(r => {
      const id = r.id ?? `${r[nameField]}|${r.game_id}|${r.pitch_no ?? ''}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
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
