/**
 * Shared stat computation utilities for pitcher and hitter profile percentiles.
 * Matches SaintsScoutEngine logic exactly.
 */

import { normalizePitch } from '@/lib/ds';

// percentileRank: (below + equal*0.5) / n * 100, rounded
export function percentileRank(arr, v) {
  if (!arr || !arr.length || v == null) return null;
  const below = arr.filter(x => x < v).length;
  const equal = arr.filter(x => x === v).length;
  return Math.round(((below + equal * 0.5) / arr.length) * 100);
}

// Identify pitch family
// Includes both raw Trackman names and normalized forms from normalizePitch()
const FB_TYPES = new Set(['Fastball', 'Four-Seam', 'Sinker', 'Cutter', 'FourSeamFastBall', 'TwoSeamFastBall', 'OneSeamFastBall']);
const BB_TYPES = new Set(['Slider', 'Sweeper', 'Curveball', 'Curveball_Knuckle']);

function pitchFamily(pt) {
  if (FB_TYPES.has(pt)) return 'fb';
  if (BB_TYPES.has(pt)) return 'bb';
  return 'other';
}

function mean(arr) {
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function isBIP(p) {
  return p.pitch_call === 'InPlay' && p.hit_distance > 0;
}

function isSwing(call) {
  return ['StrikeSwinging', 'FoulBall', 'FoulTip', 'FoulBallNotFieldable', 'FoulBallFieldable', 'InPlay'].includes(call);
}

function isOutOfZone(p) {
  const h = p.plate_loc_height, s = p.plate_loc_side;
  if (h == null || s == null) return false;
  return h < 1.5 || h > 3.5 || s < -0.83 || s > 0.83;
}

// ── pitchOutcomes: derive pitcher outcome stats from raw rows ──
function pitchOutcomes(rows) {
  const bip = rows.filter(isBIP);
  const bipN = bip.length || 1;
  const evs = bip.map(p => p.exit_speed).filter(v => v != null && v > 0);
  const hardHit = evs.filter(v => v >= 95);
  const softHit = evs.filter(v => v < 80);

  // Derive hit type from launch_angle (tagged_hit_type not stored)
  function laToType(la) {
    if (la == null || la < 10) return 'GroundBall';
    if (la < 25) return 'LineDrive';
    if (la < 50) return 'FlyBall';
    return 'PopUp';
  }
  const hts = { GroundBall: 0, FlyBall: 0, LineDrive: 0, PopUp: 0 };
  bip.forEach(p => { const t = laToType(p.launch_angle); hts[t]++; });

  // BABIP: hits on BIP excluding HRs / (AB - K - HR + SF), simplified to hits-on-bip/bip
  const hits = bip.filter(p => ['Single', 'Double', 'Triple'].includes(p.play_result)).length;
  const hr = bip.filter(p => p.play_result === 'HomeRun').length;
  const babipDen = bip.length - hr;
  const babip = babipDen > 0 ? hits / babipDen : null;

  // whiff%: swinging strikes / swings (contact + whiff). Matches ArsenalTable definition.
  const whiffs = rows.filter(p => p.pitch_call === 'StrikeSwinging').length;
  const swings = rows.filter(p => isSwing(p.pitch_call)).length;

  return {
    hardPct: evs.length ? hardHit.length / evs.length : null,
    softPct: evs.length ? softHit.length / evs.length : null,
    gbPct: bip.length ? hts.GroundBall / bipN : null,
    whiffPct: swings ? whiffs / swings : null,
    babip,
    bipCount: bip.length,
  };
}

// ── pitcherProfile: compute a single pitcher's metrics from raw rows ──
export function pitcherProfile(rows) {
  if (!rows.length) return null;

  // Group by normalized pitch type
  const byType = {};
  rows.forEach(p => {
    const pt = normalizePitch(p.tagged_pitch_type || p.pitch_type);
    if (!byType[pt]) byType[pt] = [];
    byType[pt].push(p);
  });

  // Arsenal detail: sorted by usage desc
  const arsenalEntries = Object.entries(byType).sort((a, b) => b[1].length - a[1].length);
  const arsenalDetail = arsenalEntries.map(([pt, pRows]) => {
    const velos = pRows.map(r => r.rel_speed).filter(v => v != null && v > 0);
    const spins = pRows.map(r => r.spin_rate).filter(v => v != null);
    return {
      pt,
      count: pRows.length,
      avgVelo: mean(velos),
      maxVelo: velos.length ? Math.max(...velos) : null,
      avgSpin: mean(spins),
      family: pitchFamily(pt),
    };
  });

  // FB pitch: first in arsenal that is fb family, else highest usage
  // Avg/Max FB velocity stat: pick the highest-usage TRUE fastball, excluding the
  // cutter (its velo skews the fastball read). Cutter remains family:'fb' for arsenal
  // labeling/movement, but is not eligible to define the fastball velocity stat.
  const fb = arsenalDetail.find(d => d.family === 'fb' && normalizePitch(d.pt) !== 'Cutter')
    || arsenalDetail.find(d => d.family === 'fb')
    || arsenalDetail[0];
  // BB pitch: first that is bb family
  const bb = arsenalDetail.find(d => d.family === 'bb') || null;

  // K% and BB%: count PA-ending pitches (InPlay, strikeout, walk, HBP) as denominator
  const kCount = rows.filter(r => r.kor_bb === 'Strikeout').length;
  const bbCount = rows.filter(r => r.kor_bb === 'Walk').length;
  const paEndingCount = rows.filter(r =>
    r.pitch_call === 'InPlay' ||
    r.kor_bb === 'Strikeout' ||
    r.kor_bb === 'Walk' ||
    r.pitch_call === 'HitByPitch'
  ).length;
  const totalPAs = paEndingCount || null;
  const kPct = totalPAs ? kCount / totalPAs : null;
  const bbPct = totalPAs ? bbCount / totalPAs : null;

  const outcomes = pitchOutcomes(rows);

  return {
    fb,
    bb,
    kPct,
    bbPct,
    ...outcomes,
  };
}

// ── hitterTrackmanProfile: compute a single hitter's metrics from raw pitch rows ──
export function hitterTrackmanProfile(rows) {
  if (!rows.length) return null;

  const bip = rows.filter(isBIP);
  if (bip.length < 10) return null; // qualification

  const evs = bip.map(p => p.exit_speed).filter(v => v != null && v > 0);
  const hardHit = evs.filter(v => v >= 95);
  // Use launch_angle thresholds (matches ContactProfile component — tagged_hit_type unreliable)
  const hts = { GroundBall: 0, FlyBall: 0, LineDrive: 0, PopUp: 0 };
  bip.forEach(p => {
    const la = p.launch_angle;
    if (la == null || la < 10) hts.GroundBall++;
    else if (la < 25) hts.LineDrive++;
    else if (la < 50) hts.FlyBall++;
    else hts.PopUp++;
  });
  const bipN = bip.length;

  // Air balls = FlyBall + LineDrive + PopUp
  const airBalls = bip.filter(p => ['FlyBall', 'LineDrive', 'PopUp'].includes(p.tagged_hit_type));
  // Pull: bearing < -15 for RHH, > 15 for LHH — simplified: bearing < -15 as pull direction
  // Per Trackman convention bearing is signed from center; pull for RHH is negative bearing
  const batterHand = rows[0]?.batter_hand;
  const airPullBalls = airBalls.filter(p => {
    if (p.bearing == null) return false;
    return batterHand === 'Left' ? p.bearing > 15 : p.bearing < -15;
  });
  const airPullPct = airBalls.length ? airPullBalls.length / airBalls.length : null;

  // Slugging & ISO from play_result
  let tb = 0, hits = 0, hr = 0, ab = 0;
  bip.forEach(p => {
    const r = p.play_result;
    if (['Single', 'Double', 'Triple', 'HomeRun', 'Out', 'FieldersChoice', 'Error'].includes(r)) ab++;
    if (r === 'Single') { tb += 1; hits++; }
    else if (r === 'Double') { tb += 2; hits++; }
    else if (r === 'Triple') { tb += 3; hits++; }
    else if (r === 'HomeRun') { tb += 4; hits++; hr++; }
  });
  // Add strikeout ABs too (rows with pa_result = Strikeout)
  const kAB = rows.filter(r => r.kor_bb === 'Strikeout').length;
  const totalAB = ab + kAB;
  const slg = totalAB ? tb / totalAB : null;
  const avg_ = totalAB ? hits / totalAB : null;
  const iso = (slg != null && avg_ != null) ? slg - avg_ : null;

  // OBP: (hits + walks) / (AB + walks + HBP)
  const walks = rows.filter(r => r.kor_bb === 'Walk').length;
  const obp = (totalAB + walks) ? (hits + walks) / (totalAB + walks) : null;

  // BABIP: hits-on-BIP (excl HRs) / (BIP - HRs)
  const babipDen = bipN - hr;
  const babip = babipDen > 0 ? (hits - hr) / babipDen : null;

  // Whiff%, Chase%, O-Swing%, F-Strike%, Z-Contact%, O-Contact%
  const swings = rows.filter(p => isSwing(p.pitch_call)).length;
  const whiffCount = rows.filter(p => p.pitch_call === 'StrikeSwinging').length;
  const ooz = rows.filter(isOutOfZone);
  const inZone = rows.filter(p => !isOutOfZone(p) && p.plate_loc_height != null);
  const chaseSwings = ooz.filter(p => isSwing(p.pitch_call)).length;
  const oSwings = ooz.filter(p => isSwing(p.pitch_call)).length;
  // F-Strike: first pitch of each PA that is a strike (called or swinging or foul)
  const firstPitches = rows.filter(p => p.balls === 0 && p.strikes === 0);
  const fStrikes = firstPitches.filter(p =>
    ['StrikeSwinging', 'StrikeCalled', 'FoulBall', 'FoulTip', 'FoulBallNotFieldable', 'FoulBallFieldable', 'InPlay'].includes(p.pitch_call)
  ).length;
  // Z-Contact: swings on in-zone pitches that made contact (not StrikeSwinging)
  const zSwings = inZone.filter(p => isSwing(p.pitch_call)).length;
  const zWhiffs = inZone.filter(p => p.pitch_call === 'StrikeSwinging').length;
  // O-Contact: swings on OOZ pitches that made contact (not StrikeSwinging)
  const oWhiffs = ooz.filter(p => p.pitch_call === 'StrikeSwinging').length;

  return {
    avgEV: mean(evs),
    maxEV: evs.length ? Math.max(...evs) : null,
    hardPct: evs.length ? hardHit.length / evs.length : null,
    gbPct: bipN ? hts.GroundBall / bipN : null,
    airPullPct,
    whiffPct: swings ? whiffCount / swings : null,
    chasePct: ooz.length ? chaseSwings / ooz.length : null,
    oSwingPct: ooz.length ? oSwings / ooz.length : null,
    fStrikePct: firstPitches.length ? fStrikes / firstPitches.length : null,
    zContactPct: zSwings ? (zSwings - zWhiffs) / zSwings : null,
    oContactPct: oSwings ? (oSwings - oWhiffs) / oSwings : null,
    slg,
    obp,
    iso,
    babip,
    battedBalls: bipN,
    avg: avg_,
  };
}

// ── buildPitcherPool: build distribution arrays from all TrackmanPitch rows ──
// Requires ≥20 pitches per pitcher to qualify
export function buildPitcherPool(allPitches) {
  const byPitcher = {};
  allPitches.forEach(p => {
    if (!p.pitcher_name) return;
    if (!byPitcher[p.pitcher_name]) byPitcher[p.pitcher_name] = [];
    byPitcher[p.pitcher_name].push(p);
  });

  const pool = {
    fbVelo: [], maxVelo: [], fbSpin: [], bbSpin: [],
    kPct: [], bbPct: [], hardPct: [], softPct: [],
    gbPct: [], whiffPct: [], babip: [],
    qualifiedN: 0,
  };

  Object.values(byPitcher).forEach(rows => {
    if (rows.length < 20) return;
    const prof = pitcherProfile(rows);
    if (!prof) return;
    pool.qualifiedN++;
    if (prof.fb?.avgVelo != null) pool.fbVelo.push(prof.fb.avgVelo);
    if (prof.fb?.maxVelo != null) pool.maxVelo.push(prof.fb.maxVelo);
    if (prof.fb?.avgSpin != null) pool.fbSpin.push(prof.fb.avgSpin);
    if (prof.bb?.avgSpin != null) pool.bbSpin.push(prof.bb.avgSpin);
    if (prof.kPct != null) pool.kPct.push(prof.kPct);
    if (prof.bbPct != null) pool.bbPct.push(prof.bbPct);
    if (prof.hardPct != null) pool.hardPct.push(prof.hardPct);
    if (prof.softPct != null) pool.softPct.push(prof.softPct);
    if (prof.gbPct != null) pool.gbPct.push(prof.gbPct);
    if (prof.whiffPct != null) pool.whiffPct.push(prof.whiffPct);
    if (prof.babip != null) pool.babip.push(prof.babip);
  });

  return pool;
}

// ── buildHitterPool: build distribution arrays from all batter TrackmanPitch rows ──
export function buildHitterPool(allPitches) {
  const byBatter = {};
  allPitches.forEach(p => {
    if (!p.batter_name) return;
    if (!byBatter[p.batter_name]) byBatter[p.batter_name] = [];
    byBatter[p.batter_name].push(p);
  });

  const pool = {
    avgEV: [], maxEV: [], hardPct: [], gbPct: [],
    airPullPct: [], whiffPct: [], chasePct: [],
    oSwingPct: [], fStrikePct: [], zContactPct: [], oContactPct: [],
    slg: [], obp: [], iso: [], babip: [],
    qualifiedN: 0,
  };

  Object.values(byBatter).forEach(rows => {
    const prof = hitterTrackmanProfile(rows);
    if (!prof) return;
    pool.qualifiedN++;
    if (prof.avgEV != null) pool.avgEV.push(prof.avgEV);
    if (prof.maxEV != null) pool.maxEV.push(prof.maxEV);
    if (prof.hardPct != null) pool.hardPct.push(prof.hardPct);
    if (prof.gbPct != null) pool.gbPct.push(prof.gbPct);
    if (prof.airPullPct != null) pool.airPullPct.push(prof.airPullPct);
    if (prof.whiffPct != null) pool.whiffPct.push(prof.whiffPct);
    if (prof.chasePct != null) pool.chasePct.push(prof.chasePct);
    if (prof.oSwingPct != null) pool.oSwingPct.push(prof.oSwingPct);
    if (prof.fStrikePct != null) pool.fStrikePct.push(prof.fStrikePct);
    if (prof.zContactPct != null) pool.zContactPct.push(prof.zContactPct);
    if (prof.oContactPct != null) pool.oContactPct.push(prof.oContactPct);
    if (prof.slg != null) pool.slg.push(prof.slg);
    if (prof.obp != null) pool.obp.push(prof.obp);
    if (prof.iso != null) pool.iso.push(prof.iso);
    if (prof.babip != null) pool.babip.push(prof.babip);
  });

  return pool;
}

// fmt: format a number removing leading zero (0.325 → ".325")
export function fmtStat(v, decimals = 3) {
  if (v == null) return '—';
  const s = v.toFixed(decimals);
  return s.startsWith('0.') ? s.slice(1) : s;
}