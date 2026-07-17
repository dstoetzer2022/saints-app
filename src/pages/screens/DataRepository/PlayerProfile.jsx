import React, { useState, useEffect, useRef, useMemo } from 'react';
import { cldImg } from '@/lib/cloudinaryImg';
import * as THREE from 'three';
import { base44 } from '@/api/base44Client';
import { normalizePitch, getPitchColor } from '@/lib/ds';
import { normalizeName, canonicalNameKey, normalizeHandLabel, toTrackmanName } from '@/lib/statsUtils';
import { buildPitcherPool, buildHitterPool, buildArsenalPool } from '@/lib/profileStats';
import { fetchAllFiltered } from '@/lib/fetchAll';
import { getLeaguePitches, correctRowsByPitcher } from '@/lib/leagueCache';
import { loadPools } from '@/lib/poolCache';
import { buildScene } from '@/lib/pitch3dEngine';
import reportError from '@/lib/reportError';
import PitcherProfileOverview from '@/components/profiles/PitcherProfileOverview';
import BatterProfileOverview from '@/components/profiles/BatterProfileOverview';
import PlayerInfoBar from '@/components/shared/PlayerInfoBar';
import ExportProfileButton from '@/components/shared/ExportProfileButton';
import PrintProfileReport from '@/components/reports/PrintProfileReport';
import ProfileCompareTab from '@/components/shared/ProfileCompareTab';
import PasswordGate from '@/components/shared/PasswordGate';
import { C, FONT } from '@/lib/darkTheme';

// League pitch cache now lives in @/lib/leagueCache so HomeScreen can warm it
// on app mount (see warmLeagueCache) instead of only on first profile open.

// BUGFIX (per audit): observation fetches (PitcherObservation/CatcherObservation/
// BaserunnerObservation) previously queried only the "First Last" name format,
// missing every row stored in Trackman's "Last, First" format entirely — these
// are hand-entered live-scouting rows, so both formats show up in practice
// depending on how the scout typed the name that day. Fetches both formats in
// parallel and unions them, de-duped by id (cheap insurance — a name can't
// literally satisfy two different filter strings for the same row, but this
// matches the id-dedupe pattern already used for the pitch merge below).
async function fetchObsBothFormats(entity, field, sortField, nameA, nameB) {
  const [a, b] = await Promise.all([
    fetchAllFiltered(entity, { [field]: nameA }, sortField).catch(() => []),
    nameB && nameB !== nameA
      ? fetchAllFiltered(entity, { [field]: nameB }, sortField).catch(() => [])
      : Promise.resolve([]),
  ]);
  const seen = new Set();
  return [...a, ...b].filter(r => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}

// ── Hand chip ─────────────────────────────────────────────────
function HandChip({ isPitcher, hand }) {
  if (!hand) return null;
  const PITCHER_STYLES = {
    R: { bg: 'rgba(215,25,28,.18)', text: '#ff7070', border: 'rgba(215,25,28,.32)' },
    L: { bg: 'rgba(44,123,182,.18)', text: '#70b8f0', border: 'rgba(44,123,182,.32)' },
  };
  const BATTER_STYLES = {
    Right: { bg: 'rgba(215,25,28,.18)', text: '#ff7070', border: 'rgba(215,25,28,.32)' },
    Left: { bg: 'rgba(44,123,182,.18)', text: '#70b8f0', border: 'rgba(44,123,182,.32)' },
    Switch: { bg: 'rgba(74,222,128,.12)', text: '#4ade80', border: 'rgba(74,222,128,.28)' },
  };
  let s, label;
  if (isPitcher) {
    const code = hand[0]?.toUpperCase() === 'L' ? 'L' : 'R';
    s = PITCHER_STYLES[code];
    label = code === 'L' ? 'LHP' : 'RHP';
  } else {
    // Different entities store handedness differently (single-letter codes vs
    // full words) — always normalize before deriving the label/style so every
    // hitter's actual handedness shows, not just a default.
    label = normalizeHandLabel(hand);
    if (!label) return null;
    s = BATTER_STYLES[label];
  }
  return (
    <span style={{
      fontSize: 11, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase',
      padding: '4px 12px', borderRadius: 3,
      background: s.bg, color: s.text, border: `1px solid ${s.border}`,
      fontFamily: FONT,
    }}>
      {label}
    </span>
  );
}

// ── Game Log ──────────────────────────────────────────────────
const thS = {
  textAlign: 'left', padding: '5px 10px',
  borderBottom: `2px solid ${C.edge}`,
  fontWeight: 800, color: C.muted, fontSize: 10,
  textTransform: 'uppercase', letterSpacing: 0.8, whiteSpace: 'nowrap',
  background: C.surface,
};
const tdS = {
  padding: '5px 10px',
  borderBottom: `1px solid ${C.edge}`,
  whiteSpace: 'nowrap', fontSize: 12, color: C.cream,
};

function GameEntry({ game, opponent, oppTeam, summary, isPitcher, data }) {
  const [expanded, setExpanded] = useState(false);
  const pitches = data[0] || [];

  return (
    <div style={{ border: `1px solid ${C.edge}`, borderRadius: 8, marginBottom: 8, overflow: 'hidden' }}>
      <div
        onClick={() => setExpanded(e => !e)}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(x => !x); } }}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px',
          cursor: 'pointer', background: expanded ? C.raised : C.surface,
        }}
      >
        <span style={{ fontSize: 12, color: C.muted, minWidth: 88, fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontFamily: FONT }}>{game.date}</span>
        {oppTeam?.logo_url
          ? <img src={cldImg(oppTeam.logo_url, 48)} alt={opponent} style={{ width: 22, height: 22, objectFit: 'contain' }} />
          : <div style={{ width: 22, height: 22, background: C.faint, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800, color: C.muted }}>{(opponent || '?').slice(0, 3)}</div>
        }
        <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: C.white, fontFamily: FONT }}>vs {opponent || '—'}</span>
        <span style={{ fontSize: 11, color: C.muted, fontFamily: FONT }}>{summary}</span>
        <span style={{ color: C.faint, fontSize: 11 }}>{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && pitches.length > 0 && (
        <div style={{ borderTop: `1px solid ${C.edge}`, overflowX: 'auto', background: C.base }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT }}>
            <thead>
              <tr>
                {(isPitcher
                  ? ['Inn', 'Type', 'Velo', 'Spin', 'HB', 'iVB', 'Call', 'Result']
                  : ['Inn', 'Pitcher', 'Type', 'Velo', 'Call', 'EV', 'LA', 'Result']
                ).map(h => <th key={h} style={thS}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {pitches.slice(0, 60).map((p, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.015)' }}>
                  <td style={{ ...tdS, color: C.muted }}>{p.inning}</td>
                  {!isPitcher && <td style={{ ...tdS, color: C.muted, fontSize: 11 }}>{p.pitcher_name}</td>}
                  <td style={tdS}>{normalizePitch(p.tagged_pitch_type || p.pitch_type)}</td>
                  <td style={{ ...tdS, fontWeight: 700, color: C.gold, fontVariantNumeric: 'tabular-nums' }}>{p.rel_speed != null ? Number(p.rel_speed).toFixed(1) : '—'}</td>
                  {isPitcher && <td style={{ ...tdS, fontVariantNumeric: 'tabular-nums' }}>{p.spin_rate != null ? Number(p.spin_rate).toFixed(0) : '—'}</td>}
                  {isPitcher && <td style={{ ...tdS, fontVariantNumeric: 'tabular-nums' }}>{p.horz_break != null ? Number(p.horz_break).toFixed(1) : '—'}</td>}
                  {isPitcher && <td style={{ ...tdS, fontVariantNumeric: 'tabular-nums' }}>{p.induced_vert_break != null ? Number(p.induced_vert_break).toFixed(1) : '—'}</td>}
                  <td style={{ ...tdS, color: C.muted }}>{p.pitch_call || '—'}</td>
                  {!isPitcher && <td style={{ ...tdS, fontWeight: 700, color: C.white, fontVariantNumeric: 'tabular-nums' }}>{p.exit_speed != null ? Number(p.exit_speed).toFixed(1) : '—'}</td>}
                  {!isPitcher && <td style={{ ...tdS, fontVariantNumeric: 'tabular-nums' }}>{p.launch_angle != null ? Number(p.launch_angle).toFixed(1) : '—'}</td>}
                  <td style={{ ...tdS, color: C.muted }}>{p.play_result || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {pitches.length > 60 && (
            <div style={{ fontSize: 11, color: C.muted, padding: '6px 12px', textAlign: 'center', background: C.surface, fontFamily: FONT }}>+{pitches.length - 60} more pitches</div>
          )}
        </div>
      )}
    </div>
  );
}

function GameLog({ isPitcher, team, allTeams, games, pitches, pitcherObs, catcherObs, runnerObs }) {
  // AUDIT: this component used to independently re-fetch TrackmanPitch with
  // its own exact-match query, which had two bugs:
  //  1. For hitters, it queried batter_name using the raw "First Last" player
  //     name instead of converting to Trackman's "Last, First" form — so it
  //     NEVER matched anything and every hitter's game log was empty.
  //  2. It had no canonicalNameKey/nickname recovery, so any pitcher whose
  //     name was logged under a variant spelling (e.g. a nickname like
  //     "Joe" vs roster "Joseph") silently lost that game from the log.
  // Fix: consume the parent's `pitches`/observation state, which is already
  // fetched with the correct name form AND merged with canonical-key variant
  // matches from the league cache. No independent re-fetch needed.
  const groupBy = (rows, key) => {
    const m = {};
    for (const r of rows || []) { const k = r[key]; if (!k) continue; (m[k] = m[k] || []).push(r); }
    return m;
  };

  const gameData = React.useMemo(() => {
    const tpBy = groupBy(pitches, 'game_id');
    const map = {};
    if (isPitcher) {
      const poBy = groupBy(pitcherObs, 'game_id');
      games.forEach(g => { map[g.id] = [tpBy[g.id] || [], poBy[g.id] || []]; });
    } else {
      const coBy = groupBy(catcherObs, 'game_id'), roBy = groupBy(runnerObs, 'game_id');
      games.forEach(g => { map[g.id] = [tpBy[g.id] || [], coBy[g.id] || [], roBy[g.id] || []]; });
    }
    return map;
  }, [pitches, pitcherObs, catcherObs, runnerObs, games, isPitcher]);

  const gamesWithData = games.filter(g => {
    const d = gameData[g.id];
    return d && d.some(arr => arr.length > 0);
  }).sort((a, b) => b.date?.localeCompare(a.date));

  if (!gamesWithData.length) return <p style={{ color: C.muted, textAlign: 'center', padding: 40, fontFamily: FONT }}>No game log available.</p>;

  return (
    <div>
      {gamesWithData.map(g => {
        const d = gameData[g.id] || [];
        const opponent = g.home_team_code === team.code ? g.away_team : g.home_team;
        const opponentCode = g.home_team_code === team.code ? g.away_team_code : g.home_team_code;
        const oppTeam = allTeams.find(t => t.code === opponentCode || t.name === opponent);
        const pitchesInGame = d[0] || [];
        const summary = isPitcher
          ? `${pitchesInGame.length} pitches, ${[...new Set(pitchesInGame.map(p => p.inning))].length} inn`
          : `${pitchesInGame.length} pitches seen`;
        return <GameEntry key={g.id} game={g} opponent={opponent} oppTeam={oppTeam} summary={summary} isPitcher={isPitcher} data={d} />;
      })}
    </div>
  );
}

// ── Floating player nav ────────────────────────────────────────
function FloatingPlayerNav({ player, roster, onNavigate }) {
  if (!roster || roster.length < 2) return null;
  const idx = roster.findIndex(p => p.name === player.name);
  if (idx < 0) return null;
  const prev = idx > 0 ? roster[idx - 1] : null;
  const next = idx < roster.length - 1 ? roster[idx + 1] : null;

  const btnStyle = (disabled) => ({
    display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
    background: disabled ? 'rgba(255,255,255,.04)' : 'rgba(14,37,58,.85)',
    border: `1px solid ${disabled ? 'rgba(255,255,255,.08)' : 'rgba(198,181,131,.35)'}`,
    borderRadius: 8, cursor: disabled ? 'default' : 'pointer',
    color: disabled ? 'rgba(255,255,255,.2)' : '#edeae0',
    fontFamily: FONT, fontSize: 11, fontWeight: 700,
    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
    transition: 'background 0.15s',
    opacity: disabled ? 0.4 : 1,
    pointerEvents: disabled ? 'none' : 'auto',
  });

  return (
    <div style={{
      position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', alignItems: 'center', gap: 8, zIndex: 100,
    }}>
      <button style={btnStyle(!prev)} onClick={() => prev && onNavigate(prev)}>
        ‹ {prev ? prev.name.split(' ').slice(-1)[0] : ''}
      </button>
      <div style={{
        padding: '6px 14px', background: 'rgba(14,37,58,.85)', backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(198,181,131,.35)',
        borderRadius: 8, fontSize: 10, fontWeight: 700, color: '#c6b583',
        letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: FONT,
      }}>
        {idx + 1} / {roster.length}
      </div>
      <button style={btnStyle(!next)} onClick={() => next && onNavigate(next)}>
        {next ? next.name.split(' ').slice(-1)[0] : ''} ›
      </button>
    </div>
  );
}


// ── Trail Curation Tab ─────────────────────────────────────────
function fmt1t(v) { return v != null ? Number(v).toFixed(1) : '—'; }
function fmtIt(v) { return v != null ? Math.round(v) : '—'; }

function TrailCurationTab({ pitcherName }) {
  const lfName = toTrackmanName(pitcherName);
  const [pitchGroups, setPitchGroups] = useState({});
  const [curated, setCurated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(null);
  const [toast, setToast] = useState(null);
  const [previewPitch, setPreviewPitch] = useState(null);
  const [previewType, setPreviewType] = useState(null);
  const mountRef = useRef(null);
  const sceneRef = useRef(null);

  // Load pitches + curated trails
  useEffect(() => {
    if (!lfName) return;
    setLoading(true);
    Promise.all([
      fetchAllFiltered(base44.entities.TrackmanPitch, { pitcher_name: lfName }, '-created_date'),
      fetchAllFiltered(base44.entities.CuratedDugoutTrail, { pitcher_name: lfName }, 'display_order'),
    ]).then(([pitchRows, curatedRows]) => {
      const groups = {};
      for (const r of (pitchRows || [])) {
        // AUDIT: group by normalized type — raw grouping let "Fastball" and
        // "Four-Seam" create duplicate trail slots for the same real pitch.
        const pt = normalizePitch(r.tagged_pitch_type || r.pitch_type || 'Unknown');
        if (!groups[pt]) groups[pt] = [];
        groups[pt].push(r);
      }
      setPitchGroups(groups);
      setCurated(curatedRows || []);
      setLoading(false);
    }).catch(() => { setPitchGroups({}); setCurated([]); setLoading(false); setToast('Failed to load pitch data — reopen this tab to retry.'); });
  }, [lfName]);

  // Build + mount 3D scene whenever previewPitch changes
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    if (sceneRef.current) { sceneRef.current.dispose(); sceneRef.current = null; }
    if (!previewPitch) return;

    const color = getPitchColor(previewType);
    const speed = previewPitch.rel_speed != null ? parseFloat(previewPitch.rel_speed) : 88;
    const ivb   = previewPitch.induced_vert_break != null ? parseFloat(previewPitch.induced_vert_break) : null;
    const hb    = previewPitch.horz_break != null ? parseFloat(previewPitch.horz_break) : null;
    const relH  = previewPitch.rel_height != null ? parseFloat(previewPitch.rel_height) : 6.0;
    const relS  = previewPitch.rel_side != null ? parseFloat(previewPitch.rel_side) : 0;
    const ext   = previewPitch.extension != null ? parseFloat(previewPitch.extension) : null;
    const plH   = previewPitch.plate_loc_height != null ? parseFloat(previewPitch.plate_loc_height) : null;
    const plS   = previewPitch.plate_loc_side != null ? parseFloat(previewPitch.plate_loc_side) : null;
    const spinAxis = previewPitch.spin_axis != null ? parseFloat(previewPitch.spin_axis) : null;

    const relY = ext != null ? 60.5 - ext : 54;
    const vy0 = -speed * 1.467, ay = 10.0;
    const dsc = vy0*vy0 - 4*(0.5*ay)*relY;
    let tf = dsc > 0 ? (-vy0 - Math.sqrt(dsc)) / ay : 0.45;
    if (!(tf > 0 && tf < 1.2)) tf = 0.45;
    const ax = hb != null ? 2*(hb/12)/(tf*tf) : 0;
    const az = -32.174 + (ivb != null ? 2*(ivb/12)/(tf*tf) : 0);
    const targetZ = plH ?? 2.5, targetX = plS ?? (relS + (hb != null ? hb/12 : 0));
    const vz0 = (targetZ - relH - 0.5*az*tf*tf) / tf;
    const vx0 = (targetX - relS - 0.5*ax*tf*tf) / tf;
    const path = [];
    for (let i = 0; i <= 90; i++) {
      const t = tf*i/90;
      path.push({ d: relY + vy0*t, h: relH + vz0*t + 0.5*az*t*t, s: relS + vx0*t + 0.5*ax*t*t });
    }
    const pitcher = {
      name: previewType, throws: previewPitch.pitcher_hand?.[0]?.toUpperCase() || 'R', total: 1,
      pitches: [{ type: previewType, displayColor: color, count: 1,
        speed: +speed.toFixed(1), spin: previewPitch.spin_rate != null ? Math.round(parseFloat(previewPitch.spin_rate)) : 0,
        spinAxis, ivb: ivb != null ? +ivb.toFixed(1) : 0, hb: hb != null ? +hb.toFixed(1) : 0,
        path, tflight: +tf.toFixed(3), usage: 1 }],
      allPitches: [],
    };

    let cancelled = false;
    const rafId = requestAnimationFrame(() => {
      if (cancelled || !mountRef.current) return;
      const st = buildScene(THREE, mountRef.current, pitcher, { mode: 'avg', preview: true });
      st.setCam('catcher');
      st.select(0);
      st.play();
      sceneRef.current = st;
      st.onDone = () => {
        setTimeout(() => { if (sceneRef.current === st) { st.select(0); st.play(); } }, 1000);
      };
    });
    return () => { cancelled = true; cancelAnimationFrame(rafId); if (sceneRef.current) { sceneRef.current.dispose(); sceneRef.current = null; } };
  }, [previewPitch?.id, previewType]);

  const handleAdd = async (pitch, pitchType) => {
    setAdding(pitch.id);
    try {
      // AUDIT: normalizePitch on both sides of the match (per the shared
      // convention), and CREATE first / DELETE after — the old order lost the
      // existing trail if the create failed mid-flight.
      const existing = curated.find(t => normalizePitch(t.pitch_type) === normalizePitch(pitchType));
      const newTrail = await base44.entities.CuratedDugoutTrail.create({
        pitcher_name: lfName, pitcher_team: pitch.pitcher_team || '',
        pitcher_hand: pitch.pitcher_hand || '', pitch_type: pitchType,
        display_label: pitchType, display_order: existing ? (existing.display_order ?? curated.length) : curated.length,
        active: true, trail_color: getPitchColor(pitchType),
        source_game_id: pitch.game_id || '', source_pitch_no: pitch.pitch_no || null,
        rel_speed: pitch.rel_speed != null ? parseFloat(pitch.rel_speed) : null,
        spin_rate: pitch.spin_rate != null ? parseFloat(pitch.spin_rate) : null,
        spin_axis: pitch.spin_axis != null ? parseFloat(pitch.spin_axis) : null,
        horz_break: pitch.horz_break != null ? parseFloat(pitch.horz_break) : null,
        induced_vert_break: pitch.induced_vert_break != null ? parseFloat(pitch.induced_vert_break) : null,
        plate_loc_height: pitch.plate_loc_height != null ? parseFloat(pitch.plate_loc_height) : null,
        plate_loc_side: pitch.plate_loc_side != null ? parseFloat(pitch.plate_loc_side) : null,
        rel_height: pitch.rel_height != null ? parseFloat(pitch.rel_height) : null,
        rel_side: pitch.rel_side != null ? parseFloat(pitch.rel_side) : null,
        extension: pitch.extension != null ? parseFloat(pitch.extension) : null,
        vert_rel_angle: pitch.vert_rel_angle != null ? parseFloat(pitch.vert_rel_angle) : null,
        horz_rel_angle: pitch.horz_rel_angle != null ? parseFloat(pitch.horz_rel_angle) : null,
      });
      if (existing) await base44.entities.CuratedDugoutTrail.delete(existing.id).catch(() => {});
      setCurated(prev => {
        const next = existing ? prev.filter(t => t.id !== existing.id).concat(newTrail) : prev.concat(newTrail);
        return [...next].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
      });
      setToast(existing ? `Replaced ${pitchType} trail` : `Added ${pitchType} trail`);
    } catch (e) {
      setToast(`Couldn't save trail — ${e?.message || 'network error'}. Try again.`);
    } finally { setAdding(null); }
  };

  const curatedTypes = new Set(curated.map(t => normalizePitch(t.pitch_type)));

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: C.muted, fontFamily: FONT }}>
      <div style={{ width: 22, height: 22, border: `2px solid ${C.edge}`, borderTopColor: C.gold, borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginRight: 12 }} />
      Loading pitch data…
    </div>
  );

  const FONT_STYLE = { fontFamily: FONT };

  return (
    <div style={{ display: 'flex', gap: 0, height: '100%', minHeight: 0 }}>
      {/* Left: 3D preview — always visible */}
      <div style={{ flex: '0 0 480px', display: 'flex', flexDirection: 'column', background: '#06121a', borderRight: `1px solid ${C.edge}` }}>
        <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
          <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
          {!previewPitch && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 32, opacity: 0.3 }}>⚾</div>
              <div style={{ fontSize: 13, color: C.muted, ...FONT_STYLE }}>Click a pitch to preview its flight</div>
            </div>
          )}
          {previewPitch && (
            <div style={{ position: 'absolute', top: 10, left: 12, right: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: getPitchColor(previewType), flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(198,181,131,.85)', ...FONT_STYLE }}>
                {previewType} · {fmt1t(previewPitch.rel_speed)} mph · {fmtIt(previewPitch.spin_rate)} rpm
                {previewPitch.induced_vert_break != null && <> · {fmt1t(previewPitch.induced_vert_break)}" IVB</>}
                {previewPitch.horz_break != null && <> · {fmt1t(previewPitch.horz_break)}" HB</>}
              </span>
            </div>
          )}
        </div>
        {/* Curated trail status */}
        <div style={{ padding: '10px 14px', borderTop: `1px solid ${C.edge}`, background: '#0a1a28' }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: C.gold, marginBottom: 6, ...FONT_STYLE }}>
            Curated Trails ({curated.length})
          </div>
          {curated.length === 0 && (
            <div style={{ fontSize: 11, color: C.muted, fontStyle: 'italic', ...FONT_STYLE }}>None yet — add from the pitch list →</div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {curated.map(t => {
              const color = t.trail_color || getPitchColor(t.pitch_type);
              return (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 5, background: `${color}18`, border: `1px solid ${color}55`, borderRadius: 5, padding: '4px 8px' }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: C.cream, ...FONT_STYLE }}>{t.display_label || t.pitch_type}</span>
                  <span style={{ fontSize: 9, color: C.muted, ...FONT_STYLE }}>{fmt1t(t.rel_speed)} mph</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right: pitch list */}
      <div style={{ flex: 1, overflowY: 'auto', background: C.base }}>
        {Object.entries(pitchGroups).sort((a, b) => b[1].length - a[1].length).map(([pt, pitches]) => {
          const color = getPitchColor(pt);
          const isCurated = curatedTypes.has(pt);
          return (
            <div key={pt} style={{ borderBottom: `1px solid ${C.edge}` }}>
              {/* Pitch type header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: C.surface, position: 'sticky', top: 0, zIndex: 2 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                <span style={{ fontSize: 12, fontWeight: 800, color: C.white, flex: 1, ...FONT_STYLE }}>{pt}</span>
                <span style={{ fontSize: 10, color: C.muted, ...FONT_STYLE }}>{pitches.length} pitches</span>
                {isCurated && <span style={{ fontSize: 9, fontWeight: 800, color: '#1D9E75', background: 'rgba(29,158,117,.15)', borderRadius: 3, padding: '2px 6px', ...FONT_STYLE }}>✓ CURATED</span>}
              </div>
              {/* Individual pitches */}
              {pitches.slice(0, 100).map(p => {
                const isPreview = previewPitch?.id === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => { setPreviewPitch(p); setPreviewType(pt); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 14px 8px 28px', cursor: 'pointer',
                      background: isPreview ? `${color}18` : 'transparent',
                      borderLeft: `3px solid ${isPreview ? color : 'transparent'}`,
                      transition: 'background 0.1s',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: isPreview ? C.white : C.cream, ...FONT_STYLE }}>
                        #{p.pitch_no}
                        <span style={{ fontWeight: 400, color: C.muted, fontSize: 10, marginLeft: 6 }}>{(p.game_id || '').slice(-6)}</span>
                        {isPreview && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 800, color, background: `${color}22`, borderRadius: 3, padding: '1px 5px' }}>PREVIEWING</span>}
                      </div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 1, ...FONT_STYLE }}>
                        <span style={{ color: C.cream, fontWeight: 700 }}>{fmt1t(p.rel_speed)}</span> mph
                        {' · '}<span style={{ color: C.cream }}>{fmtIt(p.spin_rate)}</span> rpm
                        {' · '}{fmtIt(p.spin_axis)}°
                        {p.induced_vert_break != null && <> · <span style={{ color: '#1D9E75' }}>{fmt1t(p.induced_vert_break)}" IVB</span></>}
                        {p.horz_break != null && <> · <span style={{ color: '#378ADD' }}>{fmt1t(p.horz_break)}" HB</span></>}
                      </div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); handleAdd(p, pt); }}
                      disabled={adding === p.id}
                      style={{
                        background: isCurated ? '#BA7517' : '#0e253a',
                        color: '#fff', border: 'none', borderRadius: 6,
                        padding: '5px 10px', fontSize: 10, fontWeight: 700,
                        cursor: adding === p.id ? 'wait' : 'pointer',
                        opacity: adding === p.id ? 0.6 : 1, whiteSpace: 'nowrap',
                        ...FONT_STYLE,
                      }}
                    >
                      {isCurated ? 'Replace' : 'Add trail'}
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#0F6E56', color: '#E1F5EE', padding: '10px 20px', borderRadius: 8, fontSize: 12, fontWeight: 700, zIndex: 999, boxShadow: '0 4px 20px rgba(0,0,0,.5)', ...FONT_STYLE }}>
          {toast}
          <button onClick={() => setToast(null)} style={{ marginLeft: 10, background: 'none', border: 'none', color: '#E1F5EE', cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>
      )}
    </div>
  );
}

// ── Main PlayerProfile ─────────────────────────────────────────
export default function PlayerProfile({ player, team, onBack, roster, onNavigate }) {
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [pitches, setPitches] = useState([]);
  const [pitcherObs, setPitcherObs] = useState([]);
  const [catcherObs, setCatcherObs] = useState([]);
  const [runnerObs, setRunnerObs] = useState([]);
  const [games, setGames] = useState([]);
  const [allTeams, setAllTeams] = useState([]);
  const [pitcherPool, setPitcherPool] = useState(null);
  const [hitterPool, setHitterPool] = useState(null);
  const [arsenalPool, setArsenalPool] = useState(null);
  const [leaguePitches, setLeaguePitches] = useState([]);
  const [school, setSchool] = useState(player.school || '');
  const [hand, setHand] = useState(player.hand || '');
  const [printOpen, setPrintOpen] = useState(false);

  const isPitcher = player.role === 'Pitcher';
  const trackmanName = toTrackmanName(player.name);
  const normalizedName = normalizeName(player.name);

  useEffect(() => {
    // ── Two-stage load (Phase 4.1) ────────────────────────────────────
    // Stage A: the player's own rows + games/teams/player record + the
    // precomputed LeaguePool snapshot. If the snapshot exists, the profile
    // paints here — percentile bars, ribbon, fusion cards, everything —
    // without waiting for the ~40k-row league pull.
    // Stage B: the league pull continues in the background for name-variant
    // recovery (rows stored under apostrophe/nickname/order variants), the
    // movement-plot league rings, and the Compare tab. If no snapshot
    // existed, pools are built here exactly as before.
    // AUDIT: player fetches paginate (the old 1000/500 caps silently
    // truncated any player past that many pitches).
    let cancelled = false;
    const playerFetch = isPitcher
      ? [
          fetchAllFiltered(base44.entities.TrackmanPitch, { pitcher_name: trackmanName }, 'date'),
          fetchObsBothFormats(base44.entities.PitcherObservation, 'pitcher_name', 'pitcher_name', normalizedName, trackmanName),
          Promise.resolve([]),
          Promise.resolve([]),
        ]
      : [
          fetchAllFiltered(base44.entities.TrackmanPitch, { batter_name: trackmanName }, 'date'),
          Promise.resolve([]),
          fetchObsBothFormats(base44.entities.CatcherObservation, 'catcher_name', 'catcher_name', normalizedName, trackmanName),
          fetchObsBothFormats(base44.entities.BaserunnerObservation, 'runner_name', 'runner_name', normalizedName, trackmanName),
        ];

    (async () => {
      const [playerPitches, obsA, obsB, obsC, g, teams, playerRecords, poolPayload] = await Promise.all([
        ...playerFetch,
        base44.entities.Game.list('-date', 200),
        base44.entities.Team.list('name', 100),
        base44.entities.Player.filter({ name: trackmanName }, undefined, 1).catch(() => []),
        loadPools(),
      ]);
      if (cancelled) return;

      // Run the SAME two-pass arsenal correction the league cache applies,
      // on just this player's exact-match rows, so stage A never flashes
      // pre-correction pitch labels that then flick to corrected ones when
      // the league merge lands. (For hitters this groups the faced pitches
      // by opposing pitcher, identical to the league-wide path.)
      const localCorrected = correctRowsByPitcher(playerPitches || []);
      setPitches(localCorrected);

      if (isPitcher) {
        setPitcherObs(obsA);
      } else {
        setCatcherObs(obsB);
        setRunnerObs(obsC);
      }
      setAllTeams(teams);
      if (playerRecords && playerRecords[0]?.school) setSchool(playerRecords[0].school);
      // Manual "bats" override takes precedence over the auto-detected hand
      // (Trackman can mislabel a hand on a mis-configured session, which
      // would otherwise falsely show as a switch hitter).
      if (playerRecords && playerRecords[0]?.bats) setHand(normalizeHandLabel(playerRecords[0].bats));

      const setGamesFor = rows => {
        const relevantGameIds = new Set(
          [...rows, ...(obsA || []), ...(obsB || []), ...(obsC || [])]
            .map(r => r.game_id).filter(Boolean)
        );
        setGames(g.filter(gm => relevantGameIds.has(gm.id)));
      };
      setGamesFor(localCorrected);

      const havePrecomputedPools = !!poolPayload;
      if (havePrecomputedPools) {
        if (isPitcher) {
          setPitcherPool(poolPayload.pitcherPool);
          // Print report needs these on pitcher profiles too: splits-allowed
          // shading percentiles vs the league HITTER pool, and the arsenal
          // table percentiles vs per-pitch-type league distributions.
          setHitterPool(poolPayload.hitterPool);
          setArsenalPool(poolPayload.arsenalPool);
        } else {
          setHitterPool(poolPayload.hitterPool);
        }
        setLoading(false); // profile paints now; league merge continues below
      }

      // ── Stage B: league pull (background when pools were precomputed) ──
      const leaguePitches = await getLeaguePitches();
      if (cancelled) return;

      // The exact-match server query (pitcher_name/batter_name = trackmanName)
      // misses rows stored under name variants (curly apostrophe, nickname,
      // "First Last" order). Recover them by canonical-key filtering the full
      // league set, then union with the exact-match rows and de-dupe by id.
      // variantRows come from getLeaguePitches(), which runs the arsenal
      // correction pipeline centrally — spread FIRST so they win the de-dup;
      // localCorrected is kept as a fallback for rows too new to be in the
      // 10-min league cache yet.
      const wantKey = canonicalNameKey(player.name);
      const nameField = isPitcher ? 'pitcher_name' : 'batter_name';
      const variantRows = (leaguePitches || []).filter(
        r => canonicalNameKey(r[nameField]) === wantKey
      );
      const mergedSeen = new Set();
      const mergedPitches = [...variantRows, ...localCorrected].filter(r => {
        const id = r.id ?? `${r[nameField]}|${r.game_id}|${r.pitch_no ?? ''}`;
        if (mergedSeen.has(id)) return false;
        mergedSeen.add(id);
        return true;
      });

      setPitches(mergedPitches);
      if (mergedPitches.length !== localCorrected.length) setGamesFor(mergedPitches);
      // AUDIT: setLeaguePitches was only called on the pitcher branch — the
      // compare-tab player picker (and any future hitter feature needing the
      // league set) had nothing to search on hitter profiles.
      setLeaguePitches(leaguePitches);
      if (!havePrecomputedPools) {
        if (isPitcher) {
          setPitcherPool(buildPitcherPool(leaguePitches));
          setHitterPool(buildHitterPool(leaguePitches));
          setArsenalPool(buildArsenalPool(leaguePitches));
        } else {
          setHitterPool(buildHitterPool(leaguePitches));
        }
      }
      setLoading(false);
    })().catch(err => {
      if (cancelled) return;
      reportError(err, 'Could not load player data');
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [normalizedName, trackmanName, isPitcher]);

  const tabs = isPitcher ? ['overview', 'trailcuration', 'gamelog', 'compare'] : ['overview', 'gamelog', 'compare'];
  const tabLabels = { overview: 'Overview', trailcuration: 'Trail Curation', gamelog: 'Game Log', compare: 'Compare' };

  // ── Global data scope (mockup v3, item 3) ─────────────────────────────
  // Filters the pitch rows feeding the Overview tab. Season = everything;
  // Last 3 = three most recent game_ids by row date; vs L / vs R = batter
  // hand splits. Other tabs (Game Log, Compare, 3D) keep the full season set.
  const [scope, setScope] = useState('season');
  const scopedPitches = useMemo(() => {
    const handField = isPitcher ? 'batter_hand' : 'pitcher_hand';
    if (scope === 'vsL') return pitches.filter(p => p[handField] === 'Left');
    if (scope === 'vsR') return pitches.filter(p => p[handField] === 'Right');
    if (scope === 'last3') {
      const byGame = {};
      pitches.forEach(p => {
        if (p.game_id && p.date && !byGame[p.game_id]) byGame[p.game_id] = p.date;
      });
      const recent = Object.entries(byGame)
        .filter(([, d]) => d)
        .sort((a, b) => new Date(b[1]) - new Date(a[1]))
        .slice(0, 3)
        .map(([id]) => id);
      const keep = new Set(recent);
      return pitches.filter(p => keep.has(p.game_id));
    }
    return pitches;
  }, [pitches, scope, isPitcher]);
  const SCOPES = isPitcher
    ? [['season', 'Season'], ['last3', 'Last 3'], ['vsL', 'vs LHB'], ['vsR', 'vs RHB']]
    : [['season', 'Season'], ['last3', 'Last 3'], ['vsL', 'vs LHP'], ['vsR', 'vs RHP']];

  // Eyebrow
  const eyebrow = `${team.name} · ${isPitcher ? 'Pitcher' : 'Hitter'}`;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.base, minHeight: 0, overflow: 'hidden' }}>

      {/* Profile header — single horizontal band: back · jersey · identity · edit controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 28px', background: '#0e253a', borderBottom: `1px solid ${C.edge}`, flexShrink: 0 }}>
        <button
          onClick={onBack}
          title="Back to Roster"
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1, color: C.muted, fontFamily: FONT, padding: 4, flexShrink: 0 }}
        >
          ←
        </button>
        {/* Jersey number */}
        {player.jerseyNumber && (
          <div style={{ flexShrink: 0, fontSize: 30, fontWeight: 900, lineHeight: 1, letterSpacing: -1.5, color: '#b8860b', fontVariantNumeric: 'tabular-nums', fontFamily: FONT }}>
            #{player.jerseyNumber}
          </div>
        )}
        {/* Identity block */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1, lineHeight: 1.15 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 22, fontWeight: 900, color: '#ffffff', letterSpacing: -0.5, fontFamily: FONT, lineHeight: 1 }}>
              {player.name}
            </span>
            {/* Bats/Throws badges */}
            {player.bats && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: 'rgba(184,134,11,0.2)', color: '#c6b583', fontFamily: FONT }}>
                B: {player.bats}
              </span>
            )}
            {player.throws && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: 'rgba(184,134,11,0.2)', color: '#c6b583', fontFamily: FONT }}>
                T: {player.throws}
              </span>
            )}
            {hand && !player.bats && !player.throws && (
              <HandChip isPitcher={isPitcher} hand={hand} />
            )}
          </div>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.55)', fontFamily: FONT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {[school, `${team.name} · ${isPitcher ? 'Pitcher' : 'Hitter'}`].filter(Boolean).join(' · ')}
          </span>
        </div>
        {/* Edit bar — jersey + school only */}
        <div className="no-print" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <ExportProfileButton onClick={() => setPrintOpen(true)} />
          <PlayerInfoBar playerName={trackmanName} team={team.name} isPitcher={isPitcher} onSchoolChange={setSchool} onBatsChange={setHand} />
        </div>
      </div>

      {/* Tabs */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', borderBottom: `1px solid ${C.edge}`, background: C.surface, flexShrink: 0, padding: '0 32px' }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '11px 16px',
            fontWeight: 700, fontSize: 12, fontFamily: FONT, letterSpacing: 0.3,
            color: tab === t ? C.white : C.muted,
            borderBottom: tab === t ? `2px solid ${C.gold}` : '2px solid transparent',
            transition: 'color 0.12s',
            textTransform: 'uppercase',
          }}>
            {tabLabels[t]}
          </button>
        ))}
        {/* Scope selector — filters the Overview tab globally */}
        {tab === 'overview' && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 3, background: C.base, border: `1px solid ${C.edge}`, borderRadius: 7, padding: 3 }}>
            {SCOPES.map(([key, label]) => (
              <button key={key} onClick={() => setScope(key)} style={{
                border: 'none', cursor: 'pointer', borderRadius: 5,
                padding: '4px 10px', fontSize: 11, fontWeight: 800, fontFamily: FONT,
                background: scope === key ? C.gold : 'transparent',
                color: scope === key ? '#080f17' : C.muted,
              }}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div data-print-root style={{ flex: 1, overflowY: tab === 'trailcuration' ? 'hidden' : 'auto', padding: tab === 'trailcuration' ? 0 : '28px 32px 80px', display: tab === 'trailcuration' ? 'flex' : 'block', flexDirection: 'column', minHeight: 0 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div style={{ width: 26, height: 26, border: `3px solid ${C.faint}`, borderTopColor: C.gold, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : (
          <>
            {tab === 'overview' && isPitcher && (
              <PitcherProfileOverview pitches={scopedPitches} pitcherObs={pitcherObs} pitcherPool={pitcherPool} leaguePitches={leaguePitches} arsenalPool={arsenalPool} playerNameKey={normalizedName} />
            )}
            {tab === 'overview' && !isPitcher && (
              <BatterProfileOverview pitches={scopedPitches} runnerObs={runnerObs} catcherObs={catcherObs} hitterPool={hitterPool} playerNameKey={normalizedName} />
            )}
            {tab === 'trailcuration' && isPitcher && (
              <PasswordGate>
                <TrailCurationTab pitcherName={trackmanName} />
              </PasswordGate>
            )}
            {tab === 'gamelog' && (
              <GameLog isPitcher={isPitcher} team={team} allTeams={allTeams} games={games} pitches={pitches} pitcherObs={pitcherObs} catcherObs={catcherObs} runnerObs={runnerObs} />
            )}
            {tab === 'compare' && (
              <ProfileCompareTab
                currentName={player.name}
                currentPitches={pitches}
                isPitcher={isPitcher}
                leaguePitches={leaguePitches}
              />
            )}
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <PrintProfileReport
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        player={player}
        team={team}
        school={school}
        hand={isPitcher ? (player.throws || hand) : (player.bats || hand)}
        isPitcher={isPitcher}
        pitches={scopedPitches}
        hitterPool={hitterPool}
        arsenalPool={arsenalPool}
        scopeLabel={SCOPES.find(([key]) => key === scope)?.[1]}
      />
      <FloatingPlayerNav player={player} roster={roster} onNavigate={onNavigate} />
    </div>
  );
}