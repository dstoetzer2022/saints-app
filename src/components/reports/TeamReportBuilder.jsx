import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { base44 } from '@/api/base44Client';
import { canonicalNameKey, normalizeName } from '@/lib/statsUtils';
import { buildHitterPool, buildArsenalPool } from '@/lib/profileStats';
import { getLeaguePitches } from '@/lib/leagueCache';
import { C, FONT } from '@/lib/darkTheme';
import { PitcherPage, HitterPage, REPORT_FONT, INK } from '@/components/reports/PrintProfileReport';
import TeamStatsSheet from '@/components/reports/TeamStatsSheet';
import { ComprehensiveHitterPage, ComprehensivePitcherPage } from '@/components/reports/ComprehensiveTeamReport';
import { parseOfficialStatsPdf } from '@/lib/officialTeamStatsPdf';

// ── Team Report Builder (Phase 5) ───────────────────────────────────────────
// One combined PDF: Team Stats Sheet + Baserunner Report + Pitcher/Catcher
// Report + every selected player's individual profile page — the exact same
// PitcherPage/HitterPage BatchPrintReport and the profile's own Export PDF
// button already use (fix-at-source, no fourth definition of "what a player
// report looks like"). Whole roster auto-selected; deselect anyone you don't
// want included. Team-wide sections are independently toggleable too.
function mergeByRunner(rows) {
  const map = {};
  rows.forEach(o => {
    const key = normalizeName(o.runner_name).toLowerCase();
    if (!map[key]) { map[key] = { ...o }; return; }
    const e = map[key];
    if (!e.speed_rating && o.speed_rating) e.speed_rating = o.speed_rating;
    if (!e.aggression_rating && o.aggression_rating) e.aggression_rating = o.aggression_rating;
    if (!e.lead_size_1b && o.lead_size_1b) e.lead_size_1b = o.lead_size_1b;
    if (!e.position && o.position) e.position = o.position;
    if (!e.jersey_number && o.jersey_number) e.jersey_number = o.jersey_number;
    e.steal_attempts = (e.steal_attempts || 0) + (o.steal_attempts || 0);
    e.steals_successful = (e.steals_successful || 0) + (o.steals_successful || 0);
    e.pickoff_attempts = (e.pickoff_attempts || 0) + (o.pickoff_attempts || 0);
    e.dirt_ball_advances = (e.dirt_ball_advances || 0) + (o.dirt_ball_advances || 0);
    if (o.notes && !e.notes) e.notes = o.notes;
  });
  return Object.values(map).sort((a, b) => (parseInt(a.jersey_number) || 999) - (parseInt(b.jersey_number) || 999));
}

function mergeByPitcher(rows) {
  const map = {};
  rows.forEach(o => {
    const key = normalizeName(o.pitcher_name).toLowerCase();
    if (!map[key]) {
      map[key] = { ...o, time_to_plate_1b: [...(o.time_to_plate_1b || [])], time_to_plate_2b: [...(o.time_to_plate_2b || [])], time_to_plate_slide: [...(o.time_to_plate_slide || [])], pickoff_moves: [...(o.pickoff_moves || [])] };
      return;
    }
    const e = map[key];
    e.time_to_plate_1b = [...e.time_to_plate_1b, ...(o.time_to_plate_1b || [])];
    e.time_to_plate_2b = [...e.time_to_plate_2b, ...(o.time_to_plate_2b || [])];
    e.time_to_plate_slide = [...e.time_to_plate_slide, ...(o.time_to_plate_slide || [])];
    e.pickoff_moves = [...new Set([...e.pickoff_moves, ...(o.pickoff_moves || [])])];
    if (o.notes && !e.notes) e.notes = o.notes;
  });
  return Object.values(map).sort((a, b) => (parseInt(a.jersey_number) || 999) - (parseInt(b.jersey_number) || 999));
}

function mergeByCatcher(rows) {
  const map = {};
  rows.forEach(o => {
    const key = normalizeName(o.catcher_name).toLowerCase();
    if (!map[key]) {
      map[key] = { ...o, steal_attempts: [...(o.steal_attempts || [])], between_innings_throws: [...(o.between_innings_throws || [])], trackman_pop_times: [...(o.trackman_pop_times || [])] };
      return;
    }
    const e = map[key];
    e.steal_attempts = [...e.steal_attempts, ...(o.steal_attempts || [])];
    e.between_innings_throws = [...e.between_innings_throws, ...(o.between_innings_throws || [])];
    e.trackman_pop_times = [...e.trackman_pop_times, ...(o.trackman_pop_times || [])];
    if (!e.warmup_pop_time && o.warmup_pop_time) e.warmup_pop_time = o.warmup_pop_time;
    if (o.notes && !e.notes) e.notes = o.notes;
    if (o.blocking_notes && !e.blocking_notes) e.blocking_notes = o.blocking_notes;
  });
  return Object.values(map).sort((a, b) => (parseInt(a.jersey_number) || 999) - (parseInt(b.jersey_number) || 999));
}

function PlayerCard({ name, jersey, included, onToggle }) {
  const parts = name.includes(',') ? name.split(',').map(s => s.trim()) : null;
  const display = parts ? `${parts[1]} ${parts[0]}` : name;
  return (
    <div onClick={onToggle} style={{
      display: 'flex', alignItems: 'center', gap: 10, background: C.surface, border: `1px solid ${C.edge}`,
      borderRadius: 8, padding: '9px 11px', cursor: 'pointer', opacity: included ? 1 : 0.4, transition: 'opacity .12s',
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${included ? C.gold : C.edge}`, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', background: included ? C.gold : C.base,
        color: '#080f17', fontSize: 12, fontWeight: 900,
      }}>{included ? '✓' : ''}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: C.white, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{display}</div>
        {jersey && <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, marginTop: 1 }}>#{jersey}</div>}
      </div>
    </div>
  );
}

function SectionToggle({ icon, title, desc, on, onToggle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.surface, border: `1px solid ${C.edge}`, borderRadius: 8, padding: '10px 13px' }}>
      <span style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(200,146,12,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.gold, fontSize: 13, flexShrink: 0 }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: C.white }}>{title}</div>
        <div style={{ fontSize: 10.5, color: C.muted, marginTop: 1 }}>{desc}</div>
      </div>
      <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
        <div onClick={onToggle} style={{
          width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${on ? C.gold : C.edge}`, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', background: on ? C.gold : C.base,
          color: '#080f17', fontSize: 12, fontWeight: 900,
        }}>{on ? '✓' : ''}</div>
      </div>
    </div>
  );
}

export default function TeamReportBuilder({ open, onClose, team, pitchers, hitters, pitches, batterPitches }) {
  const [loading, setLoading] = useState(true);
  const [runnerObs, setRunnerObs] = useState([]);
  const [pitcherObs, setPitcherObs] = useState([]);
  const [catcherObs, setCatcherObs] = useState([]);
  const [includeStats, setIncludeStats] = useState(true);
  const [includeComprehensive, setIncludeComprehensive] = useState(true);
  const [excludedKeys, setExcludedKeys] = useState(() => new Set());
  const [generating, setGenerating] = useState(null); // null | 'team' | 'players'
  const [hitterPool, setHitterPool] = useState(null);
  const [arsenalPool, setArsenalPool] = useState(null);
  const [poolsLoading, setPoolsLoading] = useState(true);
  const [leaguePitches, setLeaguePitches] = useState([]);

  // Official stats PDF — client-side only, nothing persisted to Base44.
  // Re-upload each time you build a report (per Derek's call: ephemeral,
  // no new entity/schema needed).
  const [officialStats, setOfficialStats] = useState(null);
  const [pdfFileName, setPdfFileName] = useState('');
  const [pdfError, setPdfError] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);

  const handlePdfUpload = async file => {
    if (!file) return;
    if (file.type !== 'application/pdf') { setPdfError('Please choose a PDF file.'); return; }
    setPdfLoading(true);
    setPdfError('');
    try {
      const data = await parseOfficialStatsPdf(file);
      setOfficialStats(data);
      setPdfFileName(file.name);
    } catch (e) {
      setPdfError(e?.message || 'Failed to read PDF.');
      setOfficialStats(null);
      setPdfFileName('');
    } finally {
      setPdfLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPoolsLoading(true);
    // Same builders PlayerProfile/BatchPrintReport use — computed once and
    // shared across every page in this report rather than once per player.
    getLeaguePitches().then(leaguePitches => {
      if (cancelled) return;
      setLeaguePitches(leaguePitches);
      setHitterPool(buildHitterPool(leaguePitches));
      setArsenalPool(buildArsenalPool(leaguePitches));
      setPoolsLoading(false);
    });
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      base44.entities.BaserunnerObservation.filter({ runner_team: team.name }, 'runner_name', 500).catch(() => []),
      base44.entities.PitcherObservation.filter({ pitcher_team: team.name }, 'pitcher_name', 500).catch(() => []),
      base44.entities.CatcherObservation.filter({ catcher_team: team.name }, 'catcher_name', 200).catch(() => []),
    ]).then(([r, p, c]) => {
      setRunnerObs(mergeByRunner(r));
      setPitcherObs(mergeByPitcher(p));
      setCatcherObs(mergeByCatcher(c));
      setLoading(false);
    });
  }, [open, team.name]);

  useEffect(() => {
    if (!open) return;
    document.body.classList.add('print-report-open');
    return () => document.body.classList.remove('print-report-open');
  }, [open, generating]);

  const allPlayers = useMemo(() => [
    ...pitchers.map(p => ({ ...p, role: 'Pitcher', key: canonicalNameKey(p.name) })),
    ...hitters.map(h => ({ ...h, role: 'Hitter', key: canonicalNameKey(h.name) })),
  ], [pitchers, hitters]);

  const includedPitchers = pitchers.filter(p => !excludedKeys.has(canonicalNameKey(p.name)));
  const includedHitters = hitters.filter(h => !excludedKeys.has(canonicalNameKey(h.name)));
  const selectedCount = includedPitchers.length + includedHitters.length;
  const teamPageCount = officialStats ? (includeStats ? 1 : 0) + (includeComprehensive ? 2 : 0) : 0;

  const toggle = key => setExcludedKeys(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const selectAll = () => setExcludedKeys(new Set());
  const selectNone = () => setExcludedKeys(new Set(allPlayers.map(p => p.key)));

  if (!open) return null;

  // Team Stats Report prints as its own landscape document — this swaps the
  // WHOLE print job's @page to landscape via a temporary stylesheet, then
  // reverts it after. Deliberately not using named/mixed @page selectors
  // (page: landscape on individual elements): that technique has patchy
  // cross-browser support for actually switching physical page orientation
  // mid-document. A single unnamed @page override, active for one
  // single-orientation print job at a time, is much more reliably
  // supported. Player Reports (portrait) never call this — they just use
  // the default @page already set in index.css.
  function printLandscape() {
    const style = document.createElement('style');
    style.id = 'landscape-print-override';
    style.textContent = '@media print { @page { size: letter landscape; margin: 0.4in; } }';
    document.head.appendChild(style);
    const cleanup = () => { style.remove(); window.removeEventListener('afterprint', cleanup); };
    window.addEventListener('afterprint', cleanup);
    window.print();
  }

  if (generating === 'team') {
    return createPortal(
      <div className="print-report-overlay" style={{ position: 'fixed', inset: 0, zIndex: 2000, background: '#3f4348', overflowY: 'auto', padding: '56px 0 40px', fontFamily: REPORT_FONT, color: INK }}>
        <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 20px', background: '#2b2e32' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#ccc', fontFamily: REPORT_FONT }}>
            {team.name} — Team Stats Report ({teamPageCount} page{teamPageCount === 1 ? '' : 's'}, landscape)
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={printLandscape} style={{ background: '#c6b583', border: 'none', color: '#1a1a1a', borderRadius: 6, padding: '8px 18px', fontSize: 12, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', cursor: 'pointer', fontFamily: REPORT_FONT }}>
              Print / Save PDF
            </button>
            <button onClick={() => setGenerating(null)} style={{ background: 'transparent', border: '1px solid #888', color: '#ccc', borderRadius: 6, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: REPORT_FONT }}>
              Back
            </button>
          </div>
        </div>

        {includeStats && officialStats && (
          <div className="print-report-page print-report-page--landscape-preview">
            <TeamStatsSheet team={team} officialStats={officialStats} />
          </div>
        )}
        {includeComprehensive && officialStats && (
          <>
            <div className="print-report-page print-report-page--landscape-preview">
              <ComprehensiveHitterPage team={team} officialStats={officialStats} runnerObs={runnerObs} catcherObs={catcherObs} />
            </div>
            <div className="print-report-page print-report-page--landscape-preview">
              <ComprehensivePitcherPage team={team} officialStats={officialStats} pitcherObs={pitcherObs} />
            </div>
          </>
        )}
      </div>,
      document.body
    );
  }

  if (generating === 'players') {
    const pageFor = (player, isPitcher) => {
      const key = canonicalNameKey(player.name);
      const nameField = isPitcher ? 'pitcher_name' : 'batter_name';
      // Same merge as BatchPrintReport's fix: `pitches`/`batterPitches` here
      // are raw, team-scoped TrackmanPitch rows (RosterView's fetch) — they
      // don't carry the two-pass arsenal correction. leaguePitches (from
      // getLeaguePitches()) does. Spread the corrected rows FIRST so the
      // id de-dup keeps the corrected tagged_pitch_type for every pitch
      // that exists in both sets, instead of silently falling back to the
      // uncorrected label. Team-scoped set stays as a union fallback for
      // any row missing/mismatched in the league cache.
      const teamScoped = (isPitcher ? pitches : batterPitches).filter(p => canonicalNameKey(p[nameField]) === key && !p._fromArsenal);
      const variantRows = leaguePitches.filter(p => canonicalNameKey(p[nameField]) === key);
      const seen = new Set();
      const rows = [...variantRows, ...teamScoped].filter(r => {
        const id = r.id ?? `${r[nameField]}|${r.game_id}|${r.pitch_no ?? ''}`;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      const commonProps = { player, team, school: player.school, hand: player.hand, pitches: rows };
      return isPitcher
        ? <PitcherPage key={'p-' + key} {...commonProps} hitterPool={hitterPool} arsenalPool={arsenalPool} />
        : <HitterPage key={'h-' + key} {...commonProps} hitterPool={hitterPool} />;
    };

    return createPortal(
      <div className="print-report-overlay" style={{ position: 'fixed', inset: 0, zIndex: 2000, background: '#3f4348', overflowY: 'auto', padding: '56px 0 40px', fontFamily: REPORT_FONT, color: INK }}>
        <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 20px', background: '#2b2e32' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#ccc', fontFamily: REPORT_FONT }}>
            {team.name} — Player Reports ({selectedCount} player profile{selectedCount === 1 ? '' : 's'}, portrait)
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => window.print()} style={{ background: '#c6b583', border: 'none', color: '#1a1a1a', borderRadius: 6, padding: '8px 18px', fontSize: 12, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', cursor: 'pointer', fontFamily: REPORT_FONT }}>
              Print / Save PDF
            </button>
            <button onClick={() => setGenerating(null)} style={{ background: 'transparent', border: '1px solid #888', color: '#ccc', borderRadius: 6, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: REPORT_FONT }}>
              Back
            </button>
          </div>
        </div>

        {includedPitchers.map(p => pageFor(p, true))}
        {includedHitters.map(h => pageFor(h, false))}
      </div>,
      document.body
    );
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 1500, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '32px 16px' }}>
      <div style={{ width: '100%', maxWidth: 980, background: C.base, borderRadius: 12, border: `1px solid ${C.edge}`, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 24px', borderBottom: `1px solid ${C.edge}`, background: C.surface }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: C.white, fontFamily: FONT }}>Team Report — {team.name}</div>
            <div style={{ fontSize: 11.5, color: C.muted, fontFamily: FONT, marginTop: 2 }}>Select what to include, then generate one combined PDF</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: `1px solid ${C.edge}`, borderRadius: 6, padding: '8px 14px', fontSize: 12, fontWeight: 700, color: C.muted, cursor: 'pointer', fontFamily: FONT }}>
            Cancel
          </button>
        </div>

        <div style={{ padding: '20px 24px 90px', maxHeight: '72vh', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
              <div style={{ width: 24, height: 24, border: `3px solid ${C.faint}`, borderTopColor: C.gold, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: '10px 14px', background: C.raised, border: `1px solid ${C.edge}`, borderRadius: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: C.white, fontFamily: FONT }}>
                  <span style={{ color: C.gold }}>{selectedCount}</span> of {allPlayers.length} selected
                </span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 14 }}>
                  <button onClick={selectAll} style={{ background: 'none', border: 'none', color: C.gold, fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: FONT, textDecoration: 'underline' }}>Select all</button>
                  <button onClick={selectNone} style={{ background: 'none', border: 'none', color: C.gold, fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: FONT, textDecoration: 'underline' }}>Select none</button>
                </div>
              </div>

              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.3, color: C.gold, fontFamily: FONT, marginBottom: 9 }}>Official Season Stats</div>
              <div style={{ marginBottom: 20 }}>
                <div
                  onClick={() => document.getElementById('officialStatsPdfInput').click()}
                  style={{
                    border: `2px dashed ${officialStats ? C.gold : C.edge}`, borderRadius: 8, padding: '16px 14px',
                    background: C.surface, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                  }}
                >
                  <span style={{ width: 30, height: 30, borderRadius: 6, background: 'rgba(200,146,12,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.gold, fontSize: 14, flexShrink: 0 }}>↑</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: C.white, fontFamily: FONT }}>
                      {pdfLoading ? 'Reading PDF…' : officialStats ? `${officialStats.hitters.length} hitters, ${officialStats.pitchers.length} pitchers loaded` : 'Upload PrestoSports "Print Version" export'}
                    </div>
                    <div style={{ fontSize: 10.5, color: C.muted, fontFamily: FONT, marginTop: 2 }}>
                      {pdfFileName || 'Parsed client-side — nothing is saved. Required for Team Stats Sheet & Comprehensive Team Report.'}
                    </div>
                    {pdfError && <div style={{ fontSize: 10.5, color: '#f87171', fontFamily: FONT, marginTop: 3 }}>{pdfError}</div>}
                  </div>
                </div>
                <input id="officialStatsPdfInput" type="file" accept="application/pdf" style={{ display: 'none' }} onChange={e => handlePdfUpload(e.target.files[0])} />
              </div>

              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.3, color: C.gold, fontFamily: FONT, marginBottom: 9 }}>Team Reports</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20, opacity: officialStats ? 1 : 0.45 }}>
                <SectionToggle icon="◆" title="Team Stats Sheet" desc="Official box score, full column set — leaders, hitters, pitchers" on={includeStats && !!officialStats} onToggle={() => officialStats && setIncludeStats(v => !v)} />
                <SectionToggle icon="▦" title="Comprehensive Team Report" desc="2 landscape pages — Hitters + Pitchers, with baserunner/catcher/pickoff scouting merged in" on={includeComprehensive && !!officialStats} onToggle={() => officialStats && setIncludeComprehensive(v => !v)} />
              </div>

              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.3, color: C.gold, fontFamily: FONT, marginBottom: 2 }}>
                Pitcher Profiles <span style={{ color: C.muted, fontWeight: 600 }}>({includedPitchers.length} of {pitchers.length})</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8, margin: '9px 0 20px' }}>
                {pitchers.map(p => (
                  <PlayerCard key={p.name} name={p.name} jersey={p.jerseyNumber || p.jersey_number}
                    included={!excludedKeys.has(canonicalNameKey(p.name))} onToggle={() => toggle(canonicalNameKey(p.name))} />
                ))}
              </div>

              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.3, color: C.gold, fontFamily: FONT, marginBottom: 2 }}>
                Hitter Profiles <span style={{ color: C.muted, fontWeight: 600 }}>({includedHitters.length} of {hitters.length})</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8, marginTop: 9 }}>
                {hitters.map(h => (
                  <PlayerCard key={h.name} name={h.name} jersey={h.jerseyNumber || h.jersey_number}
                    included={!excludedKeys.has(canonicalNameKey(h.name))} onToggle={() => toggle(canonicalNameKey(h.name))} />
                ))}
              </div>
            </>
          )}
        </div>

        <div style={{ position: 'sticky', bottom: 0, display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 24px', background: C.surface, borderTop: `1px solid ${C.edge}` }}>
          <div style={{ fontSize: 10.5, color: C.muted, fontFamily: FONT }}>
            Two separate documents, printed independently — Team Stats Report is landscape, Player Reports stays portrait.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => setGenerating('team')}
              disabled={poolsLoading || teamPageCount === 0}
              style={{
                background: (poolsLoading || teamPageCount === 0) ? C.faint : C.gold, color: (poolsLoading || teamPageCount === 0) ? C.muted : '#080f17', border: 'none', borderRadius: 6, padding: '9px 20px',
                fontSize: 12.5, fontWeight: 800, fontFamily: FONT, cursor: (poolsLoading || teamPageCount === 0) ? 'default' : 'pointer',
                opacity: teamPageCount === 0 ? 0.4 : 1,
              }}
            >
              Team Stats Report ({teamPageCount} pg) →
            </button>
            <button
              onClick={() => setGenerating('players')}
              disabled={poolsLoading || selectedCount === 0}
              style={{
                background: (poolsLoading || selectedCount === 0) ? C.faint : C.gold, color: (poolsLoading || selectedCount === 0) ? C.muted : '#080f17', border: 'none', borderRadius: 6, padding: '9px 20px',
                fontSize: 12.5, fontWeight: 800, fontFamily: FONT, cursor: (poolsLoading || selectedCount === 0) ? 'default' : 'pointer',
                opacity: selectedCount === 0 ? 0.4 : 1,
              }}
            >
              {poolsLoading ? 'Loading league data…' : `Player Reports (${selectedCount}) →`}
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>,
    document.body
  );
}
