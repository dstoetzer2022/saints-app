import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { canonicalNameKey, normHand, isSwing, isWhiff } from '@/lib/statsUtils';
import { getPitchColor, normalizePitch } from '@/lib/ds';
import { fetchAllFiltered } from '@/lib/fetchAll';
import { ZoneHeatmap, SprayChart, rgba } from './HitterViz';

// ── Per-team pitch cache (bugfix, per audit) ─────────────────────────────
// Both the current-batter and next-two-hitters stat fetches below queried
// the SAME team's TrackmanPitch rows independently, each capped at 1000 —
// the Saints alone already exceed 1,000 rows as batter_team partway through
// a season, so stats were silently computed from a shrinking recent-games
// window rather than the full season. Replaced with one shared, fully
// paginated fetch per team, cached 60s so switching between the two
// consumers (or re-rendering on poll) doesn't re-fetch the same team twice.
const _teamPitchCache = new Map(); // team -> { rows, at }
const TEAM_CACHE_TTL_MS = 60 * 1000;

function getTeamBatterPitches(team) {
  const now = Date.now();
  const cached = _teamPitchCache.get(team);
  if (cached && now - cached.at < TEAM_CACHE_TTL_MS) return cached.promise;
  const promise = fetchAllFiltered(base44.entities.TrackmanPitch, { batter_team: team }, '-date')
    .catch(() => []);
  _teamPitchCache.set(team, { at: now, promise });
  return promise;
}

const FONT   = "'Archivo', system-ui, sans-serif";
const NAVY   = '#0e253a';
const NAVY_L = '#24445f';
const GOLD   = '#c8920c';
const GOLDM  = '#c6b583';
const TEXT   = '#e8eef5';
const TEXTD  = '#9fb2c4';
const TEXTF  = '#8299ad'; // AUDIT: was #5f7488 (3.2:1 — below WCAG AA)
const GOOD   = '#2dba5a';

const SPEED_THEME = {
  fast:    { bg:'rgba(34,197,94,0.13)',  border:'rgba(45,186,90,0.65)',  glow:'0 0 18px rgba(45,186,90,0.35)',  text:'#4ade80' },
  average: { bg:'rgba(234,179,8,0.10)',  border:'rgba(234,179,8,0.55)', glow:'0 0 18px rgba(234,179,8,0.25)',  text:'#facc15' },
  slow:    { bg:'rgba(239,68,68,0.12)',  border:'rgba(239,68,68,0.55)', glow:'0 0 18px rgba(239,68,68,0.28)',  text:'#f87171' },
};
const AGGR_COLOR = { aggressive:'#4ade80', average:'#facc15', passive:'#94a3b8' };

const AB_RES  = ['Single','Double','Triple','HomeRun','Out','Error','FieldersChoice'];
const HIT_RES = ['Single','Double','Triple','HomeRun'];
const TB_MAP  = { Single:1, Double:2, Triple:3, HomeRun:4 };

// End-of-plate-appearance detection: a strikeout/walk/HBP is never
// pitch_call === 'InPlay', so identifying them requires reading the
// pre-pitch ball/strike count (same balls/strikes fields already relied on
// for the pitcher dugout's ahead/even/behind and 1st-pitch splits).
//   • Strikeout: pitch_call is a called/swinging strike AND strikes was 2
//   • Walk:      pitch_call is BallCalled AND balls was 3
//   • HBP:       pitch_call === 'HitByPitch'
// NOTE: sac flies aren't tracked in this data, so AB/PA below are a
// standard simplified version (matches the existing OBP convention already
// used elsewhere: HBP in both numerator and denominator, no SF term).
function computeStats(rows) {
  let swings=0, whiffs=0, contacts=0, ballsInPlayAB=0, H=0, tb=0, BB=0, K=0, HBP=0;
  const evs = [];
  for (const r of rows) {
    if (isSwing(r))  swings++;
    if (isWhiff(r))  whiffs++;
    if (isSwing(r) && !isWhiff(r)) contacts++;

    const b = r.balls ?? 0, s = r.strikes ?? 0;

    if (r.pitch_call === 'InPlay') {
      const ev = parseFloat(r.exit_speed);
      if (isFinite(ev) && ev > 30) evs.push(ev);
      if (AB_RES.includes(r.play_result))  ballsInPlayAB++;
      if (HIT_RES.includes(r.play_result)) { H++; tb += TB_MAP[r.play_result]||0; }
    } else if (r.pitch_call === 'HitByPitch') {
      HBP++;
    } else if ((r.pitch_call === 'StrikeCalled' || r.pitch_call === 'StrikeSwinging') && s === 2) {
      K++;
    } else if (r.pitch_call === 'BallCalled' && b === 3) {
      BB++;
    }
  }
  // Strikeouts count as at-bats (a real-baseball rule the old InPlay-only
  // AB calc was missing) — fixes AVG/SLG being inflated by excluding K's.
  const AB = ballsInPlayAB + K;
  const PA = AB + BB + HBP;
  return {
    pitches: rows.length, AB, H, BB, K, HBP,
    avgEV:      evs.length ? evs.reduce((a,b)=>a+b,0)/evs.length : null,
    maxEV:      evs.length ? Math.max(...evs) : null,
    contactPct: swings ? (swings-whiffs)/swings : null,
    BA:    AB ? H/AB  : null,
    SLG:   AB ? tb/AB : null,
    OBP:   PA ? (H+BB+HBP)/PA : null,
    BBpct: PA ? BB/PA : null,
    Kpct:  PA ? K/PA  : null,
  };
}

// ── Per-pitch-type breakdown ──────────────────────────────────────────────────
// NOTE: assumes the pitch-type field is r.pitch_type (falls back to
// r.tagged_pitch_type / r.auto_pitch_type if present under a different name).
// If pitch types come back blank in the live app, this field name is the
// first thing to check against the actual TrackmanPitch schema.
function computePitchTypeStats(rows) {
  const total = rows.length;
  const map = {};
  for (const r of rows) {
    const raw = r.pitch_type || r.tagged_pitch_type || r.auto_pitch_type || 'Other';
    const type = normalizePitch(raw) || raw;
    if (!map[type]) map[type] = { type, n:0, swings:0, whiffs:0, AB:0, tb:0 };
    const g = map[type];
    g.n++;
    if (isSwing(r)) g.swings++;
    if (isWhiff(r)) g.whiffs++;
    if (r.pitch_call === 'InPlay') {
      if (AB_RES.includes(r.play_result))  g.AB++;
      if (HIT_RES.includes(r.play_result)) g.tb += TB_MAP[r.play_result] || 0;
    }
  }
  return Object.values(map)
    .map(g => ({
      ...g,
      usagePct: total ? g.n/total : 0,
      whiffPct: g.swings ? g.whiffs/g.swings : null,
      slg:      g.AB     ? g.tb/g.AB         : null,
    }))
    .sort((a,b) => b.n - a.n);
}

const fmtAvg = v => v == null ? '—' : v.toFixed(3).replace(/^0/,'');
const fmtPct = v => v == null ? '—' : Math.round(v*100)+'%';
const fmtEV  = v => v == null ? '—' : v.toFixed(1);

// t (0..1) drives a blue-white-red background tint behind the value, same
// scale used everywhere else in dugout view (Hot Zones, pitch-type table,
// pitcher season rates). null t = no color (used for raw counts like Pitches,
// which aren't a rate/performance stat).
function StatPill({ label, value, t }) {
  const bg = t != null ? rgba(t, 0.32) : 'transparent';
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'4px 14px', borderRight:`1px solid ${NAVY_L}`, background:bg, transition:'background 0.3s' }}>
      <span style={{ fontSize:18, fontWeight:800, color:TEXT, fontFamily:FONT, fontVariantNumeric:'tabular-nums', lineHeight:1.15 }}>{value}</span>
      <span style={{ fontSize:9, letterSpacing:'1px', textTransform:'uppercase', color:TEXTF, fontWeight:700, marginTop:2, fontFamily:FONT }}>{label}</span>
    </div>
  );
}

// Maps a stat value onto the 0..1 blue-white-red scale using (lo, hi) anchors:
// lo -> blue(0), hi -> red(1). For "lower is better" stats (e.g. K%), pass
// lo as the WORSE/bigger number and hi as the BETTER/smaller number — the
// inversion falls out of the math automatically, no special-casing needed.
// Thresholds are college-summer-ball ballpark calibration; easy to retune.
function statT(value, lo, hi) {
  if (value == null) return null;
  return Math.max(0, Math.min(1, (value - lo) / (hi - lo)));
}

// ── Section title — centered, large, readable from across the dugout ──────────
function SectionTitle({ children }) {
  return (
    <div style={{ fontSize:16, letterSpacing:'1.5px', textTransform:'uppercase', color:GOLDM, fontWeight:800, fontFamily:FONT, marginBottom:10, textAlign:'center' }}>
      {children}
    </div>
  );
}

// Opposing team's logo badge — same circular treatment as Pitcher Dugout View,
// falls back to team initials if no logo URL or the image fails to load.
function TeamLogo({ logoUrl, teamName, size = 54 }) {
  const [failed, setFailed] = useState(false);
  const initials = teamName ? teamName.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase() : '?';
  const st = { width: size, height: size, borderRadius: '50%', background: '#13314e', border: '2px solid #b8860b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: GOLDM, fontFamily: FONT, fontWeight: 800, flexShrink: 0, objectFit: 'contain' };
  if (failed || !logoUrl) return <div style={st}>{initials}</div>;
  return <img src={logoUrl} alt={teamName} onError={() => setFailed(true)} style={st} />;
}

// ── Pitch-type production table ───────────────────────────────────────────────
function PitchTypeTable({ rows }) {
  const stats = useMemo(() => computePitchTypeStats(rows), [rows]);

  if (!stats.length) {
    return <div style={{ color:TEXTF, fontSize:13, fontStyle:'italic', textAlign:'center' }}>No pitch data</div>;
  }

  return (
    <div style={{ width:'100%' }}>
      {/* Header row */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 52px 52px 56px', gap:6, padding:'0 4px 8px', borderBottom:`1px solid ${NAVY_L}`, marginBottom:4 }}>
        <span style={{ fontSize:10, fontWeight:800, letterSpacing:'0.8px', textTransform:'uppercase', color:TEXTF, fontFamily:FONT }}>Pitch</span>
        <span style={{ fontSize:10, fontWeight:800, letterSpacing:'0.8px', textTransform:'uppercase', color:TEXTF, fontFamily:FONT, textAlign:'right' }}>Use%</span>
        <span style={{ fontSize:10, fontWeight:800, letterSpacing:'0.8px', textTransform:'uppercase', color:TEXTF, fontFamily:FONT, textAlign:'right' }}>Whiff%</span>
        <span style={{ fontSize:10, fontWeight:800, letterSpacing:'0.8px', textTransform:'uppercase', color:TEXTF, fontFamily:FONT, textAlign:'right' }}>SLG</span>
      </div>
      {/* Rows */}
      <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
        {stats.map(g => {
          // Whiff% inverted: high whiff = bad for hitter = blue (cold).
          // SLG direct: high SLG = good for hitter = red (damage).
          // Both match the same blue-white-red scale used in Hot Zones.
          const whiffT = g.whiffPct != null ? 1 - Math.max(0, Math.min(1, g.whiffPct/0.45)) : null;
          const slgT   = g.slg      != null ? Math.max(0, Math.min(1, g.slg/0.700))         : null;
          return (
            <div key={g.type} style={{ display:'grid', gridTemplateColumns:'1fr 52px 52px 56px', gap:6, alignItems:'center', padding:'7px 4px', borderRadius:5 }}>
              <span style={{ display:'flex', alignItems:'center', gap:7, fontSize:14, fontWeight:700, color:TEXT, fontFamily:FONT, minWidth:0 }}>
                <span style={{ width:10, height:10, borderRadius:3, background:getPitchColor(g.type), flexShrink:0 }} />
                <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{g.type}</span>
              </span>
              <span style={{ fontSize:14, fontWeight:700, color:TEXTD, fontFamily:FONT, textAlign:'right', fontVariantNumeric:'tabular-nums' }}>{Math.round(g.usagePct*100)}%</span>
              <span style={{ fontSize:14, fontWeight:700, color:TEXT, fontFamily:FONT, textAlign:'right', fontVariantNumeric:'tabular-nums', background: whiffT!=null ? rgba(whiffT,0.32) : 'transparent', borderRadius:4, padding:'2px 5px' }}>{fmtPct(g.whiffPct)}</span>
              <span style={{ fontSize:14, fontWeight:800, color:TEXT, fontFamily:FONT, textAlign:'right', fontVariantNumeric:'tabular-nums', background: slgT!=null ? rgba(slgT,0.32) : 'transparent', borderRadius:4, padding:'2px 5px' }}>{g.slg!=null ? fmtAvg(g.slg) : '—'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Baserunner slot — speed-colored glow when occupied ────────────────────────
function BaseSlot({ base, runner }) {
  const LABELS = { '1B':'1st Base', '2B':'2nd Base', '3B':'3rd Base' };
  const isEmpty  = !runner;
  const isOnBase = runner?.is_on_base;
  const speed    = runner?.speed_rating;
  const theme    = (isOnBase && speed && SPEED_THEME[speed]) ? SPEED_THEME[speed] : null;

  return (
    <div style={{
      flex: 1, minWidth: 0,
      border:     `1px solid ${theme ? theme.border : isEmpty ? NAVY_L : GOLDM}`,
      borderRadius: 10,
      padding:    '14px 16px',
      background: theme ? theme.bg : isEmpty ? 'rgba(27,58,89,0.35)' : 'rgba(200,146,12,0.07)',
      display:    'flex', flexDirection:'column', gap:7,
      boxShadow:  theme ? theme.glow : 'none',
      transition: 'box-shadow 0.3s, border-color 0.3s, background 0.3s',
    }}>
      <div style={{ fontSize:15, letterSpacing:'2px', textTransform:'uppercase', fontWeight:900, color:theme ? theme.text : isEmpty ? TEXTF : GOLDM, fontFamily:FONT }}>
        {LABELS[base]}
      </div>

      {isEmpty ? (
        <div style={{ fontSize:15, color:TEXTF, fontStyle:'italic', fontFamily:FONT }}>Empty</div>
      ) : (
        <>
          <div style={{ fontSize:19, fontWeight:800, color:TEXT, fontFamily:FONT, lineHeight:1.2 }}>
            {runner.jersey_number ? <span style={{ color:GOLDM, marginRight:6 }}>#{runner.jersey_number}</span> : null}
            {runner.runner_name}
          </div>
          <div style={{ display:'flex', gap:7, flexWrap:'wrap', alignItems:'center' }}>
            {speed && (
              <span style={{ fontSize:13, fontWeight:800, padding:'4px 11px', borderRadius:5,
                background: theme ? theme.border.replace('0.65','0.18').replace('0.55','0.18') : 'rgba(255,255,255,0.08)',
                color: theme ? theme.text : TEXTD, border:`1px solid ${theme ? theme.border : 'transparent'}`, fontFamily:FONT }}>
                {speed}
              </span>
            )}
            {runner.aggression_rating && (
              <span style={{ fontSize:13, fontWeight:700, padding:'4px 11px', borderRadius:5,
                background:(AGGR_COLOR[runner.aggression_rating]||TEXTF)+'22',
                color:AGGR_COLOR[runner.aggression_rating]||TEXTD,
                border:`1px solid ${(AGGR_COLOR[runner.aggression_rating]||TEXTF)}44`, fontFamily:FONT }}>
                {runner.aggression_rating}
              </span>
            )}
            {runner.steal_attempts > 0 && (
              <span style={{ fontSize:13, color:GOLDM, fontWeight:700, fontFamily:FONT }}>
                {runner.steals_successful||0}/{runner.steal_attempts} SB
              </span>
            )}
          </div>
          {base==='1B' && runner.lead_size_1b && (
            <div style={{ fontSize:13, color:TEXTD, fontFamily:FONT }}>Lead: {runner.lead_size_1b}</div>
          )}
          {runner.notes && (
            <div style={{ fontSize:13, color:TEXTD, fontStyle:'italic', fontFamily:FONT }}>{runner.notes}</div>
          )}
        </>
      )}
    </div>
  );
}

// ── On-deck / in-the-hole card — name+hand+speed header, then two tinted halves ──
// Left half tinted by Contact% (higher = redder / more damage), right half by SLG.
// Both use the same statcast blue-white-red scale (rgba + statT) as the header pills.
function NextBatterCard({ label, hitter, contactPct, slg, speedRating }) {
  const hand      = normHand(hitter?.hitter_hand);
  const handLabel = hand === 'S' ? 'SHH' : hand ? hand+'HB' : null;
  const theme     = (speedRating && SPEED_THEME[speedRating]) ? SPEED_THEME[speedRating] : null;

  const contactT = statT(contactPct, 0.60, 0.88);
  const slgT     = statT(slg,        0.350, 0.580);

  return (
    <div style={{ flex:1, minWidth:0, border:`1px solid ${NAVY_L}`, borderRadius:10, overflow:'hidden', background:'rgba(200,146,12,0.04)' }}>
      <div style={{ fontSize:13, letterSpacing:'2px', textTransform:'uppercase', fontWeight:900, color:GOLDM, fontFamily:FONT, padding:'8px 12px 5px' }}>
        {label}
      </div>

      {hitter ? (
        <>
          {/* name + hand + speed — spans full card width */}
          <div style={{ padding:'0 12px 9px', borderBottom:`1px solid ${NAVY_L}` }}>
            <div style={{ fontSize:18, fontWeight:800, color:TEXT, fontFamily:FONT, lineHeight:1.15, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {hitter.hitter_name}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:7, marginTop:6, flexWrap:'wrap' }}>
              {handLabel && (
                <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:4, background:'rgba(200,146,12,0.18)', color:GOLDM, fontFamily:FONT }}>
                  {handLabel}
                </span>
              )}
              {theme && (
                <span style={{ fontSize:12, fontWeight:800, padding:'3px 10px', borderRadius:5,
                  background:theme.bg, border:`1px solid ${theme.border}`, color:theme.text, fontFamily:FONT }}>
                  {speedRating}
                </span>
              )}
            </div>
          </div>

          {/* two balanced halves — Contact% (left) | SLG (right) */}
          <div style={{ display:'flex' }}>
            <div style={{ flex:1, textAlign:'center', padding:'8px 8px', background: contactT != null ? rgba(contactT, 0.32) : 'transparent', borderRight:`1px solid rgba(36,68,95,0.6)`, transition:'background 0.3s' }}>
              <div style={{ fontSize:18, fontWeight:800, color:TEXT, fontFamily:FONT, fontVariantNumeric:'tabular-nums', lineHeight:1.1 }}>{fmtPct(contactPct)}</div>
              <div style={{ fontSize:9, letterSpacing:'1px', color:TEXTF, fontWeight:700, fontFamily:FONT, marginTop:2 }}>CONTACT</div>
            </div>
            <div style={{ flex:1, textAlign:'center', padding:'8px 8px', background: slgT != null ? rgba(slgT, 0.32) : 'transparent', transition:'background 0.3s' }}>
              <div style={{ fontSize:18, fontWeight:800, color:TEXT, fontFamily:FONT, fontVariantNumeric:'tabular-nums', lineHeight:1.1 }}>{slg != null ? fmtAvg(slg) : '—'}</div>
              <div style={{ fontSize:9, letterSpacing:'1px', color:TEXTF, fontWeight:700, fontFamily:FONT, marginTop:2 }}>SLG</div>
            </div>
          </div>
        </>
      ) : (
        <div style={{ padding:'12px', fontSize:14, color:TEXTF, fontStyle:'italic', fontFamily:FONT }}>—</div>
      )}
    </div>
  );
}

export default function HitterDugoutPanel({ gameId, orientation = 'horizontal' }) {
  const [currentBatter, setCurrentBatter] = useState(null);
  const [batterRows,    setBatterRows]     = useState([]);
  const [runners,       setRunners]        = useState([]);
  const [lineup,        setLineup]         = useState([]);  // full HitterObservation lineup for this game
  const [speedByName,   setSpeedByName]    = useState({});  // canonicalNameKey -> speed_rating (from BaserunnerObservation scouting)
  const pollRef = useRef(null);

  const poll = useCallback(() => {
    if (!gameId) return;
    Promise.all([
      base44.entities.HitterObservation.filter({ game_id: gameId, is_current_batter: true }, '-updated_date', 1).catch(() => []),
      base44.entities.BaserunnerObservation.filter({ game_id: gameId, is_on_base: true }, 'runner_name', 20).catch(() => []),
      // Full lineup — drives the on-deck / in-the-hole row (derived from
      // lineup_position). BUGFIX (per audit): was sorted by lineup_position
      // with a 30-row cap, which could drop the newest edit for a spot on
      // sub-heavy games (many HitterObservation rows per position across 9
      // spots easily exceeds 30) — the downstream dedup below picks the
      // newest row per position by updated_date, so it needs the newest
      // rows present in the fetch, not just the first 30 by position order.
      base44.entities.HitterObservation.filter({ game_id: gameId }, '-updated_date', 100).catch(() => []),
      // All scouted runners (not just on-base) — speed_rating is the only observed run-speed
      // in this data, and HitterObservation has no speed field, so on-deck speed comes from here.
      base44.entities.BaserunnerObservation.filter({ game_id: gameId }, 'runner_name', 60).catch(() => []),
    ]).then(([batters, runnerRows, lineupRows, allRunners]) => {
      setCurrentBatter(batters?.[0] || null);
      setRunners(runnerRows || []);
      setLineup(lineupRows || []);
      const smap = {};
      for (const r of (allRunners || [])) {
        if (r.runner_name && r.speed_rating) smap[canonicalNameKey(r.runner_name)] = r.speed_rating;
      }
      setSpeedByName(smap);
    }).catch(() => {});
  }, [gameId]);

  useEffect(() => {
    if (!gameId) return;
    poll();
    pollRef.current = setInterval(poll, 10000);
    return () => clearInterval(pollRef.current);
  }, [gameId, poll]);

  useEffect(() => {
    if (!currentBatter?.hitter_name || !currentBatter?.hitter_team) { setBatterRows([]); return; }
    let cancelled = false;
    (async () => {
      const rows = await getTeamBatterPitches(currentBatter.hitter_team);
      if (cancelled) return;
      const key = canonicalNameKey(currentBatter.hitter_name);
      setBatterRows((rows||[]).filter(r => canonicalNameKey(r.batter_name) === key));
    })();
    return () => { cancelled = true; };
  }, [currentBatter?.hitter_name, currentBatter?.hitter_team]);

  // Resolve opposing team logo — matches Pitcher Dugout View's lookup pattern
  const [teamLogoUrl, setTeamLogoUrl] = useState(null);
  useEffect(() => {
    if (!currentBatter?.hitter_team) { setTeamLogoUrl(null); return; }
    let cancelled = false;
    base44.entities.Team.filter({ name: currentBatter.hitter_team }, '-created_date', 1)
      .then(rows => { if (!cancelled) setTeamLogoUrl(rows?.[0]?.logo_url || null); })
      .catch(() => { if (!cancelled) setTeamLogoUrl(null); });
    return () => { cancelled = true; };
  }, [currentBatter?.hitter_team]);

  // ── On deck / in the hole — relative to the CURRENT batter's lineup spot ─────
  // Data has multiple HitterObservation rows per spot across a game (subs, edits),
  // so we first collapse to ONE hitter per lineup_position (most-recent wins), then
  // index off the lineup NUMBER (not array position). Current batter in the 2-hole
  // => on deck = 3-hole, in the hole = 4-hole. Wraps 9 -> 1.
  const nextTwo = useMemo(() => {
    if (!currentBatter || !lineup.length) return [null, null];

    // Collapse to one row per lineup_position, keeping the newest by updated_date.
    const bySpot = new Map();
    for (const h of lineup) {
      if (h.lineup_position == null) continue;
      const spot = Math.round(h.lineup_position);
      const prev = bySpot.get(spot);
      if (!prev || new Date(h.updated_date) > new Date(prev.updated_date)) bySpot.set(spot, h);
    }
    if (!bySpot.size) return [null, null];

    // The current batter's authoritative spot: prefer their own lineup_position,
    // else find which spot their name occupies in the deduped map.
    let curSpot = currentBatter.lineup_position != null ? Math.round(currentBatter.lineup_position) : null;
    if (curSpot == null || !bySpot.has(curSpot)) {
      const curKey = canonicalNameKey(currentBatter.hitter_name);
      for (const [spot, h] of bySpot) {
        if (canonicalNameKey(h.hitter_name) === curKey) { curSpot = spot; break; }
      }
    }
    if (curSpot == null) return [null, null];

    // Highest occupied spot defines the wrap point (usually 9, but guards short lineups).
    const maxSpot = Math.max(...bySpot.keys());
    const step = (n) => {
      let s = curSpot;
      for (let i = 0; i < n; i++) s = s >= maxSpot ? 1 : s + 1;
      return bySpot.get(s) || null;
    };
    return [step(1), step(2)];
  }, [currentBatter, lineup]);

  // Contact% + SLG for the next two hitters, computed from their Trackman rows.
  // Same team as the current batter, so one team-wide fetch covers both.
  const [nextStats, setNextStats] = useState({}); // canonicalNameKey -> { contactPct, SLG }
  useEffect(() => {
    const team = currentBatter?.hitter_team;
    const targets = nextTwo.filter(Boolean);
    if (!team || !targets.length) { setNextStats({}); return; }
    let cancelled = false;
    (async () => {
      const rows = await getTeamBatterPitches(team);
      if (cancelled) return;
      const out = {};
      for (const h of targets) {
        const key = canonicalNameKey(h.hitter_name);
        const hrows = (rows || []).filter(r => canonicalNameKey(r.batter_name) === key);
        const s = computeStats(hrows);
        out[key] = { contactPct: s.contactPct, SLG: s.SLG };
      }
      if (!cancelled) setNextStats(out);
    })();
    return () => { cancelled = true; };
  }, [currentBatter?.hitter_team, nextTwo]);

  if (!gameId) return null;

  const hand      = normHand(currentBatter?.hitter_hand);
  const handLabel = hand === 'S' ? 'SHH' : hand ? hand+'HB' : null;
  const stats     = computeStats(batterRows);
  const hasData   = batterRows.length > 0;
  const runnerAt  = base => runners.find(r => r.current_base === base) || null;

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden', fontFamily:FONT, background:'#0c1e2d' }}>

      {/* ── BATTER HEADER ─────────────────────────────────────── */}
      <div style={{ background:NAVY, borderBottom:`1px solid ${NAVY_L}`, flexShrink:0, display:'flex', alignItems:'stretch', minHeight:68 }}>
        <div style={{ padding:'10px 20px', display:'flex', alignItems:'center', gap:12, flex:'0 0 auto' }}>
          {currentBatter && (
            <TeamLogo logoUrl={teamLogoUrl} teamName={currentBatter.hitter_team} size={48} />
          )}
          {currentBatter ? (
            <>
              {currentBatter.jersey_number && (
                <div style={{ fontSize:34, fontWeight:900, color:GOLD, lineHeight:1, fontVariantNumeric:'tabular-nums', minWidth:56, textAlign:'center', flexShrink:0 }}>
                  #{currentBatter.jersey_number}
                </div>
              )}
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3, flexWrap:'wrap' }}>
                  <span style={{ fontSize:24, fontWeight:900, color:TEXT, letterSpacing:-0.5 }}>{currentBatter.hitter_name}</span>
                  {handLabel && <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:4, background:'rgba(200,146,12,0.18)', color:GOLDM }}>{handLabel}</span>}
                </div>
                <div style={{ fontSize:11, color:TEXTD, fontWeight:500 }}>{currentBatter.hitter_team||'—'} · Batter</div>
              </div>
            </>
          ) : (
            <div style={{ fontSize:14, color:'rgba(255,255,255,0.3)', fontStyle:'italic' }}>Waiting for batter…</div>
          )}
        </div>
        <div style={{ width:1, background:NAVY_L, flexShrink:0, alignSelf:'stretch', margin:'8px 0' }} />
        <div style={{ display:'flex', alignItems:'stretch', flex:1, overflow:'hidden', flexWrap: orientation === 'vertical' ? 'wrap' : 'nowrap' }}>
          <StatPill label="Pitches"  value={stats.pitches||'—'} />
          <StatPill label="AVG"      value={fmtAvg(stats.BA)}   t={statT(stats.BA,      0.220, 0.330)} />
          <StatPill label="OBP"      value={fmtAvg(stats.OBP)}  t={statT(stats.OBP,     0.300, 0.430)} />
          <StatPill label="SLG"      value={fmtAvg(stats.SLG)}  t={statT(stats.SLG,     0.350, 0.580)} />
          <StatPill label="BB%"      value={fmtPct(stats.BBpct)} t={statT(stats.BBpct,  0.04,  0.16)} />
          <StatPill label="K%"       value={fmtPct(stats.Kpct)}  t={statT(stats.Kpct,   0.32,  0.12)} />
          <StatPill label="Avg EV"   value={fmtEV(stats.avgEV)} t={statT(stats.avgEV,   72,    90)} />
          <StatPill label="Max EV"   value={stats.maxEV ? Math.round(stats.maxEV)+'' : '—'} t={statT(stats.maxEV, 82, 100)} />
          <StatPill label="Contact%" value={fmtPct(stats.contactPct)} t={statT(stats.contactPct, 0.60, 0.88)} />
        </div>
      </div>

      {/* ── ON DECK / IN THE HOLE — vertical view only, mirrors baserunner card styling ── */}
      {orientation === 'vertical' && currentBatter && (
        <div style={{ flexShrink:0, background:'rgba(14,37,58,0.75)', borderBottom:`1px solid ${NAVY_L}`, padding:'10px 14px' }}>
          <div style={{ display:'flex', gap:10 }}>
            <NextBatterCard
              label="On Deck"
              hitter={nextTwo[0]}
              contactPct={nextTwo[0] ? nextStats[canonicalNameKey(nextTwo[0].hitter_name)]?.contactPct : null}
              slg={nextTwo[0] ? nextStats[canonicalNameKey(nextTwo[0].hitter_name)]?.SLG : null}
              speedRating={nextTwo[0] ? speedByName[canonicalNameKey(nextTwo[0].hitter_name)] : null}
            />
            <NextBatterCard
              label="In The Hole"
              hitter={nextTwo[1]}
              contactPct={nextTwo[1] ? nextStats[canonicalNameKey(nextTwo[1].hitter_name)]?.contactPct : null}
              slg={nextTwo[1] ? nextStats[canonicalNameKey(nextTwo[1].hitter_name)]?.SLG : null}
              speedRating={nextTwo[1] ? speedByName[canonicalNameKey(nextTwo[1].hitter_name)] : null}
            />
          </div>
        </div>
      )}

      {/* ── VIZ BODY — Hot Zones | Pitch Type | Spray Chart — side-by-side (horizontal) or stacked (vertical) ───── */}
      {/* Vertical: no scroll — the three panels flex to share whatever height remains
          after the header, on-deck row, and baserunner footer. SVGs scale to fit. */}
      <div style={{ flex:1, display:'flex', flexDirection: orientation === 'vertical' ? 'column' : 'row', minHeight:0, overflow:'hidden' }}>

        {/* LEFT/TOP — hot zones */}
        <div style={{
          flex: orientation === 'vertical' ? '1.15 1 0' : '0 0 42%',
          maxWidth: orientation === 'vertical' ? '100%' : '42%',
          minHeight: 0,
          borderRight: orientation === 'vertical' ? 'none' : `1px solid ${NAVY_L}`,
          borderBottom: orientation === 'vertical' ? `1px solid ${NAVY_L}` : 'none',
          padding:'10px 14px', display:'flex', flexDirection:'column', overflow:'hidden',
        }}>
          <SectionTitle>HOT ZONES</SectionTitle>
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', minHeight:0, overflow:'hidden' }}>
            {hasData ? (
              <div style={{ maxWidth: orientation === 'vertical' ? 640 : 600, maxHeight:'100%', width:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <ZoneHeatmap rows={batterRows} viewMode="pitcher" batterHand={hand} />
              </div>
            ) : (
              <div style={{ color:TEXTF, fontSize:13, fontStyle:'italic', textAlign:'center' }}>
                {currentBatter ? 'No Trackman data for this batter' : 'No batter active'}
              </div>
            )}
          </div>
          {/* Legend — blue (weak contact/EV) → white (moderate) → red (strong contact + high EV) */}
          <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:6, fontSize:12, color:TEXTF, flexShrink:0, justifyContent:'center' }}>
            <span>Weak</span>
            <div style={{ display:'flex', height:9, borderRadius:3, overflow:'hidden', width:140 }}>
              {['rgba(47,99,166,0.9)','rgba(144,170,205,0.9)','rgba(242,242,242,0.9)','rgba(221,138,140,0.9)','rgba(200,40,44,0.9)'].map((c,i)=><span key={i} style={{flex:1,background:c}}/>)}
            </div>
            <span>Damage</span>
          </div>
        </div>

        {/* CENTER — pitch type production table */}
        <div style={{
          flex: orientation === 'vertical' ? '0 1 auto' : '0 0 25%',
          maxWidth: orientation === 'vertical' ? '100%' : '25%',
          minHeight: 0,
          borderRight: orientation === 'vertical' ? 'none' : `1px solid ${NAVY_L}`,
          borderBottom: orientation === 'vertical' ? `1px solid ${NAVY_L}` : 'none',
          padding:'10px 14px', display:'flex', flexDirection:'column', overflow:'hidden',
        }}>
          <SectionTitle>By Pitch Type</SectionTitle>
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', minHeight:0, overflow:'hidden' }}>
            {hasData ? <PitchTypeTable rows={batterRows} /> : (
              <div style={{ color:TEXTF, fontSize:13, fontStyle:'italic', textAlign:'center' }}>
                {currentBatter ? 'No Trackman data for this batter' : 'No batter active'}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT/BOTTOM — spray chart */}
        <div style={{
          flex: orientation === 'vertical' ? '1.15 1 0' : '1 1 38%',
          maxWidth: orientation === 'vertical' ? '100%' : 'none',
          minHeight: 0,
          padding:'10px 14px', display:'flex', flexDirection:'column', overflow:'hidden',
        }}>
          <SectionTitle>Spray Chart</SectionTitle>
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', minHeight:0, overflow:'hidden' }}>
            {hasData ? (
              <div style={{ maxWidth: orientation === 'vertical' ? 440 : 380, maxHeight:'100%', width:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <SprayChart rows={batterRows} hand={hand} dugout={true} />
              </div>
            ) : (
              <div style={{ color:TEXTF, fontSize:13, fontStyle:'italic', textAlign:'center' }}>
                {currentBatter ? 'No Trackman data for this batter' : 'No batter active'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── BASERUNNER FOOTER — no header label, just the three cards ── */}
      <div style={{ flexShrink:0, borderTop:`2px solid ${GOLD}`, background:'rgba(14,37,58,0.75)', padding:'12px 16px' }}>
        <div style={{ display:'flex', gap:10 }}>
          <BaseSlot base="1B" runner={runnerAt('1B')} />
          <BaseSlot base="2B" runner={runnerAt('2B')} />
          <BaseSlot base="3B" runner={runnerAt('3B')} />
        </div>
      </div>
    </div>
  );
}
