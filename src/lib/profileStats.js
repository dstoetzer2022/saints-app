/**
 * Shared stat computation utilities for pitcher and hitter profile percentiles.
 * Matches SaintsScoutEngine logic exactly.
 */

import { normalizePitch, getPitchColor } from '@/lib/ds';
import { canonicalNameKey, isSwing as isSwingRow, isWhiff, circularMean, isFastballVeloType, stdDev, sprayDistribution, normHand } from '@/lib/statsUtils';

// ── Savant-parity feature helpers ─────────────────────────────────────────────
// Shared source for all new profile-page additions (pitcher AND hitter), so
// CSW%/K-BB%, release point, extension, spin direction, zone splits, and the
// rolling trend chart each have exactly one implementation.

const hasLoc = p => Number.isFinite(parseFloat(p.plate_loc_height)) && Number.isFinite(parseFloat(p.plate_loc_side));
const inZone = p => {
  const h = parseFloat(p.plate_loc_height), s = parseFloat(p.plate_loc_side);
  return Number.isFinite(h) && Number.isFinite(s) && h >= 1.5 && h <= 3.5 && s >= -0.83 && s <= 0.83;
};

// CSW% (called strikes + whiffs / total) and K-BB% (K rate minus BB rate,
// approximated from kor_bb outcomes per plate appearance seen in these rows).
export function cswKbb(rows) {
  const n = rows.length;
  if (!n) return { cswPct: null, kbbPct: null, n: 0 };
  const csw = rows.filter(r => r.pitch_call === 'StrikeCalled' || isWhiff(r)).length;
  const cswPct = Math.round((csw / n) * 100);
  // kor_bb marks the pitch that ends a PA in a K or BB; count once per PA.
  const paEnders = rows.filter(r => r.kor_bb === 'Strikeout' || r.kor_bb === 'Walk');
  let kbbPct = null;
  if (paEnders.length >= 10) {
    const k = paEnders.filter(r => r.kor_bb === 'Strikeout').length;
    const bb = paEnders.filter(r => r.kor_bb === 'Walk').length;
    kbbPct = Math.round(((k - bb) / paEnders.length) * 100);
  }
  return { cswPct, kbbPct, n };
}

// Release point scatter, grouped by canonical pitch type for coloring.
export function releasePoints(rows) {
  const groups = {};
  for (const r of rows) {
    const x = parseFloat(r.rel_side), y = parseFloat(r.rel_height);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const type = normalizePitch(r.tagged_pitch_type || r.pitch_type);
    (groups[type] = groups[type] || []).push({ x, y });
  }
  return Object.entries(groups)
    .map(([type, points]) => ({ type, color: getPitchColor(type), points }))
    .sort((a, b) => b.points.length - a.points.length);
}

// Extension: season mean + per-pitch-type breakdown.
export function extensionBreakdown(rows) {
  const vals = rows.map(r => parseFloat(r.extension)).filter(Number.isFinite);
  const seasonMean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  const groups = {};
  for (const r of rows) {
    const v = parseFloat(r.extension);
    if (!Number.isFinite(v)) continue;
    const type = normalizePitch(r.tagged_pitch_type || r.pitch_type);
    (groups[type] = groups[type] || []).push(v);
  }
  const byType = Object.entries(groups)
    .map(([type, vs]) => ({ type, mean: vs.reduce((a, b) => a + b, 0) / vs.length, n: vs.length }))
    .sort((a, b) => b.n - a.n);
  return { seasonMean, n: vals.length, byType };
}

// Spin direction ("clock face"), per pitch type. spin_axis is a known data-
// quality gap at certain venues (Chabot College Field, confirmed audit finding)
// — any type with zero valid spin_axis values is explicitly null-gated rather
// than rendering a misleading blank/zero wheel.
// AUDIT (spin-direction clock bug): raw Trackman spin_axis is the physical
// angular-momentum tilt, which is 180° antiparallel to the conventional
// "Tilt" clock everyone actually uses (12:00 = pure backspin/rise, matching
// the RISE label at the top of the movement plot). Verified against this
// app's own horz_break/induced_vert_break: a heavy-rise, near-zero-HB
// four-seam was plotting near 6-7 o'clock on the raw value instead of the
// expected ~12-1 o'clock. Flipping by 180° here (once, at the source) fixes
// every consumer instead of patching the SVG math per component.
export function spinDirectionByType(rows) {
  const groups = {};
  for (const r of rows) {
    const type = normalizePitch(r.tagged_pitch_type || r.pitch_type);
    const raw = r.spin_axis != null ? parseFloat(r.spin_axis) : null;
    const tilt = Number.isFinite(raw) ? (raw + 180) % 360 : null;
    (groups[type] = groups[type] || []).push(tilt);
  }
  return Object.entries(groups).map(([type, axes]) => {
    const valid = axes.filter(Number.isFinite);
    return {
      type,
      color: getPitchColor(type),
      n: axes.length,
      validN: valid.length,
      axisDeg: valid.length ? circularMean(valid) : null,
      nullGated: valid.length === 0,
    };
  }).sort((a, b) => b.n - a.n);
}

// Zone-split summary on a 3x3 grid spanning the zone plus one "chase ring"
// bin on each side (side -1.5..1.5 ft, height 1.0..4.0 ft). Cells with fewer
// than MIN_N pitches are flagged low-N and should render as neutral, not a
// misleading extreme percentage off a handful of pitches.
const MIN_N = 5;
export function zoneGrid(rows, { swingOnly = false } = {}) {
  const located = rows.filter(hasLoc);
  const sideMin = -1.5, sideMax = 1.5, hMin = 1.0, hMax = 4.0;
  const cellW = (sideMax - sideMin) / 3, cellH = (hMax - hMin) / 3;
  const cells = Array.from({ length: 9 }, () => ({ count: 0, swings: 0, whiffs: 0 }));
  for (const r of located) {
    const s = parseFloat(r.plate_loc_side), h = parseFloat(r.plate_loc_height);
    let col = Math.floor((s - sideMin) / cellW);
    let row = 2 - Math.floor((h - hMin) / cellH); // row 0 = top (high pitches)
    col = Math.max(0, Math.min(2, col));
    row = Math.max(0, Math.min(2, row));
    const cell = cells[row * 3 + col];
    cell.count++;
    if (isSwingRow(r)) { cell.swings++; if (isWhiff(r)) cell.whiffs++; }
  }
  const totalN = located.length;
  return cells.map(c => ({
    ...c,
    usagePct: totalN ? Math.round((c.count / totalN) * 100) : null,
    whiffPct: c.swings >= MIN_N ? Math.round((c.whiffs / c.swings) * 100) : null,
    lowN: swingOnly ? c.swings < MIN_N : c.count < MIN_N,
  }));
}

// Rolling per-game trend: fastball velo, whiff%, chase% by game, sorted by
// date. Uses game_id + date already present on every TrackmanPitch row — no
// separate GameLog fetch needed.
export function rollingGameTrend(rows) {
  const byGame = {};
  for (const r of rows) {
    if (!r.game_id) continue;
    (byGame[r.game_id] = byGame[r.game_id] || { date: r.date, rows: [] }).rows.push(r);
    if (!byGame[r.game_id].date && r.date) byGame[r.game_id].date = r.date;
  }
  return Object.entries(byGame).map(([gameId, { date, rows: gr }]) => {
    const fb = gr.filter(r => isFastballVeloType(normalizePitch(r.tagged_pitch_type || r.pitch_type)))
      .map(r => parseFloat(r.rel_speed)).filter(v => Number.isFinite(v) && v > 0);
    const swings = gr.filter(isSwingRow);
    const located = gr.filter(hasLoc);
    const ooz = located.filter(r => !inZone(r));
    return {
      gameId, date,
      n: gr.length,
      veloMean: fb.length ? fb.reduce((a, b) => a + b, 0) / fb.length : null,
      whiffPct: swings.length ? Math.round((gr.filter(isWhiff).length / swings.length) * 100) : null,
      chasePct: ooz.length >= MIN_N ? Math.round((ooz.filter(isSwingRow).length / ooz.length) * 100) : null,
    };
  }).filter(g => g.date).sort((a, b) => new Date(a.date) - new Date(b.date));
}

// Approximate "barrel rate" — a custom EV/LA threshold, NOT Statcast's
// proprietary formula. Labeled as an approximation everywhere it's shown.
export function approxBarrelRate(rows) {
  const bip = rows.filter(r => r.exit_speed != null && r.launch_angle != null && r.play_result);
  if (bip.length < MIN_N) return { barrelPct: null, n: bip.length };
  const barrels = bip.filter(r => {
    const ev = parseFloat(r.exit_speed), la = parseFloat(r.launch_angle);
    return Number.isFinite(ev) && Number.isFinite(la) && ev >= 95 && la >= 10 && la <= 35;
  });
  return { barrelPct: Math.round((barrels.length / bip.length) * 100), n: bip.length };
}

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

// Quantile of a single player's own distribution (e.g. EV90 = quantile(evs, 0.9)).
// Distinct from percentileRank, which ranks a value against a POOL of other
// players — this ranks a value against the player's OWN sample.
function quantile(arr, q) {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(q * sorted.length)));
  return sorted[idx];
}

// BUGFIX (per audit): was gated on `hit_distance > 0`, which silently
// dropped every ball in play with missing Trackman distance from AVG/SLG/
// ISO/BABIP/EV/hit-type distribution. A ball in play is defined by the
// pitch_call alone. Distance-dependent uses (xHR-by-park, spray validity)
// already carry their own explicit hit_distance checks at their own call
// sites and never routed through this function, so no replacement gate is
// needed here.
function isBIP(p) {
  return p.pitch_call === 'InPlay';
}

// AUDIT: delegate to the shared statsUtils classifier (single source of truth).
function isSwing(call) {
  return isSwingRow({ pitch_call: call });
}

function isOutOfZone(p) {
  const h = p.plate_loc_height, s = p.plate_loc_side;
  if (h == null || s == null) return false;
  return h < 1.5 || h > 3.5 || s < -0.83 || s > 0.83;
}

// ── pitchOutcomes: derive pitcher outcome stats from raw rows ──
function pitchOutcomes(rows) {
  const bip = rows.filter(isBIP);
  const evs = bip.map(p => p.exit_speed).filter(v => v != null && v > 0);
  const hardHit = evs.filter(v => v >= 95);
  const softHit = evs.filter(v => v < 80);

  // Derive hit type from launch_angle (tagged_hit_type not stored).
  // BUGFIX (per audit): null launch angle was previously bucketed as
  // GroundBall by default, inflating GB% with balls that have no actual
  // trajectory reading. Now excluded from both the bucket counts and the
  // percentage denominator (knownLaN), which is separate from bipN (still
  // used for babip/hardPct/softPct — those are EV-based, not LA-based, and
  // shouldn't shrink just because a launch angle is missing).
  function laToType(la) {
    if (la < 10) return 'GroundBall';
    if (la < 25) return 'LineDrive';
    if (la < 50) return 'FlyBall';
    return 'PopUp';
  }
  const hts = { GroundBall: 0, FlyBall: 0, LineDrive: 0, PopUp: 0 };
  let knownLaN = 0;
  bip.forEach(p => {
    if (p.launch_angle == null) return;
    hts[laToType(p.launch_angle)]++;
    knownLaN++;
  });

  // BABIP: hits on BIP excluding HRs / (AB - K - HR + SF), simplified to hits-on-bip/bip
  const hits = bip.filter(p => ['Single', 'Double', 'Triple'].includes(p.play_result)).length;
  const hr = bip.filter(p => p.play_result === 'HomeRun').length;
  const babipDen = bip.length - hr;
  const babip = babipDen > 0 ? hits / babipDen : null;

  // whiff%: swinging strikes / swings (contact + whiff). Matches ArsenalTable definition.
  const whiffs = rows.filter(p => p.pitch_call === 'StrikeSwinging').length;
  const swings = rows.filter(p => isSwing(p.pitch_call)).length;

  // Chase% (swings on out-of-zone pitches / out-of-zone pitches) and avg EV
  // against — new percentile-bar metrics, computed here so the single-pitcher
  // view and the pool builder share one implementation.
  const ooz = rows.filter(isOutOfZone);
  const chaseSwings = ooz.filter(p => isSwing(p.pitch_call));
  const chasePct = ooz.length ? chaseSwings.length / ooz.length : null;
  const avgEVAgainst = evs.length ? mean(evs) : null;
  const extensionMean = extensionBreakdown(rows).seasonMean;

  // Strike% — any strike-type call (swinging, called, foul, in-play) / total pitches
  const STRIKE_CALLS = ['StrikeSwinging', 'StrikeCalled', 'FoulBall', 'FoulTip', 'FoulBallNotFieldable', 'FoulBallFieldable', 'InPlay'];
  const strikeCount = rows.filter(p => STRIKE_CALLS.includes(p.pitch_call)).length;
  const strikePct = rows.length ? strikeCount / rows.length : null;

  // First-pitch strike% — first pitch of each PA that is a strike
  const firstPitches = rows.filter(p => p.balls === 0 && p.strikes === 0);
  const fStrikes = firstPitches.filter(p => STRIKE_CALLS.includes(p.pitch_call)).length;
  const fpsPct = firstPitches.length ? fStrikes / firstPitches.length : null;

  // Flyball% and avg launch angle against (batted balls) — denominator is
  // knownLaN (balls with an actual launch angle reading), not bipN.
  const fbPct = knownLaN ? hts.FlyBall / knownLaN : null;
  const lasAgainst = bip.map(p => p.launch_angle).filter(v => v != null && Number.isFinite(v));
  const avgLaunchAgainst = lasAgainst.length ? mean(lasAgainst) : null;

  // Putaway% — two-strike pitches that end in a strikeout / total two-strike pitches
  const twoK = rows.filter(r => r.strikes === 2);
  const putawayPct = twoK.length ? rows.filter(r => r.strikes === 2 && r.kor_bb === 'Strikeout').length / twoK.length : null;

  return {
    hardPct: evs.length ? hardHit.length / evs.length : null,
    softPct: evs.length ? softHit.length / evs.length : null,
    gbPct: knownLaN ? hts.GroundBall / knownLaN : null,
    fbPct,
    whiffPct: swings ? whiffs / swings : null,
    babip,
    bipCount: bip.length,
    chasePct,
    avgEVAgainst,
    avgLaunchAgainst,
    extensionMean,
    strikePct,
    fpsPct,
    putawayPct,
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
  // BUGFIX (per audit): null launch angle was previously bucketed as
  // GroundBall by default. Now excluded from both the bucket counts and the
  // percentage denominator (knownLaN) — bipN is kept separate for BABIP
  // below, which is EV/outcome-based and shouldn't shrink over a missing LA.
  const hts = { GroundBall: 0, FlyBall: 0, LineDrive: 0, PopUp: 0 };
  let knownLaN = 0;
  bip.forEach(p => {
    const la = p.launch_angle;
    if (la == null) return;
    if (la < 10) hts.GroundBall++;
    else if (la < 25) hts.LineDrive++;
    else if (la < 50) hts.FlyBall++;
    else hts.PopUp++;
    knownLaN++;
  });
  const bipN = bip.length;

  // Air balls = FlyBall + LineDrive + PopUp
  // AUDIT: tagged_hit_type is not stored (per the comments above), so the old
  // filter was always empty and Air-Pull% was permanently null. Derive from
  // launch angle using the same buckets as the distribution above.
  const airBalls = bip.filter(p => p.launch_angle != null && p.launch_angle >= 10);
  // Pull: bearing < -15 for RHH, > 15 for LHH.
  // BUGFIX (per audit): previously used rows[0].batter_hand for the ENTIRE
  // dataset, which misclassified every ball for a switch hitter's minority
  // side. Each ball is now classified by its OWN row's batter_hand.
  const airPullBalls = airBalls.filter(p => {
    if (p.bearing == null) return false;
    const hand = String(p.batter_hand || '').toUpperCase().startsWith('L') ? 'Left' : 'Right';
    return hand === 'Left' ? p.bearing > 15 : p.bearing < -15;
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

  // BABIP: hits-on-BIP (excl HRs) / (BIP - HRs)
  const babipDen = bipN - hr;
  const babip = babipDen > 0 ? (hits - hr) / babipDen : null;

  // OBP: (hits + walks + HBP) / (AB + walks + HBP)
  // BUGFIX (per audit): previously omitted HBP from both numerator and
  // denominator — ran low in an HBP-heavy league and disagreed with the
  // dugout's own computeStats, which does include it.
  const walks = rows.filter(r => r.kor_bb === 'Walk').length;
  const hbp = rows.filter(r => r.pitch_call === 'HitByPitch').length;
  const obp = (totalAB + walks + hbp) ? (hits + walks + hbp) / (totalAB + walks + hbp) : null;

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

  // BB% / K% — PA-ending count mirrors the pitcher-side kPct/bbPct
  // denominator (InPlay, K, BB, or HBP).
  const bbCount = rows.filter(r => r.kor_bb === 'Walk').length;
  const paEndingCount = rows.filter(r =>
    r.pitch_call === 'InPlay' || r.kor_bb === 'Strikeout' || r.kor_bb === 'Walk' || r.pitch_call === 'HitByPitch'
  ).length;
  const bbPct = paEndingCount ? bbCount / paEndingCount : null;
  const kPct = paEndingCount ? kAB / paEndingCount : null;

  // Batted-ball mix (fly ball / line drive), soft-hit%, and approx barrel%.
  // Soft/Hard thresholds match the FanGraphs-style EV buckets already used
  // for hardPct (>=95 = hard); soft mirrors that at the low end (<60).
  const fbPct = knownLaN ? hts.FlyBall / knownLaN : null;
  const ldPct = knownLaN ? hts.LineDrive / knownLaN : null;
  const softHit = evs.filter(v => v < 60);
  const softPct = evs.length ? softHit.length / evs.length : null;
  // Barrel% base set intentionally mirrors contactQualityBreakdown's filter
  // (exit_speed/launch_angle/play_result present) rather than isBIP's
  // hit_distance>0 gate, so this always agrees with the Contact Profile table.
  const barrelEligibleRows = rows.filter(p => p.exit_speed != null && p.launch_angle != null && p.play_result);
  const barrels = barrelEligibleRows.filter(p => p.exit_speed >= 95 && p.launch_angle >= 10 && p.launch_angle <= 35);
  const barrelEligibleN = barrelEligibleRows.length;
  const barrelPct = barrelEligibleN ? barrels.length / barrelEligibleN : null;

  // Contact%, 2K-Contact%, Swing%, FPSw% — all built off the shared swing
  // and contact-call classifiers, consistent with PlateDiscipline/HitterTrends.
  const isContactCall = c => ['FoulBall', 'FoulTip', 'FoulBallNotFieldable', 'FoulBallFieldable', 'InPlay'].includes(c);
  const contactCount = rows.filter(p => isContactCall(p.pitch_call)).length;
  const contactPct = swings ? contactCount / swings : null;
  const twoK = rows.filter(p => p.strikes === 2);
  const twoKSwings = twoK.filter(p => isSwing(p.pitch_call)).length;
  const twoKContact = twoK.filter(p => isContactCall(p.pitch_call)).length;
  const twoKContactPct = twoKSwings ? twoKContact / twoKSwings : null;
  const swingPct = rows.length ? swings / rows.length : null;
  const fpSwings = firstPitches.filter(p => isSwing(p.pitch_call)).length;
  const fpSwPct = firstPitches.length ? fpSwings / firstPitches.length : null;

  // Launch angle, EV90 (90th percentile of this hitter's own EV distribution)
  // and the average launch angle of just the batted balls at/above that
  // threshold — "what does this hitter do with his hardest-hit contact".
  const las = bip.map(p => p.launch_angle).filter(v => v != null && Number.isFinite(v));
  const avgLaunchAngle = las.length ? mean(las) : null;
  const ev90 = evs.length >= MIN_N ? quantile(evs, 0.9) : null;
  const laAtEv90 = ev90 != null
    ? (() => {
        const qualifying = bip.filter(p => p.exit_speed >= ev90 && p.launch_angle != null && Number.isFinite(p.launch_angle));
        return qualifying.length ? mean(qualifying.map(p => p.launch_angle)) : null;
      })()
    : null;

  return {
    avgEV: mean(evs),
    maxEV: evs.length ? Math.max(...evs) : null,
    hardPct: evs.length ? hardHit.length / evs.length : null,
    gbPct: knownLaN ? hts.GroundBall / knownLaN : null,
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
    bbPct,
    kPct,
    avgLaunchAngle,
    ev90,
    laAtEv90,
    fbPct,
    ldPct,
    softPct,
    barrelPct,
    contactPct,
    twoKContactPct,
    swingPct,
    fpSwPct,
  };
}

// ── xStats: leaguewide EV×LA expected-outcome grid (xBA/xwOBA/xSLG) ──────
// APPROXIMATION of Statcast's proprietary EV/LA model, built from CCL's own
// pooled batted-ball outcomes rather than MLB's — necessarily coarser (CCL's
// full-season BIP count is in the low thousands, not millions). Labeled
// "(approx)" everywhere it's surfaced, same convention as approxBarrelRate
// and contactQualityBreakdown above.
const EV_BIN_EDGES = [70, 80, 90, 95, 100]; // 6 bins: <70,70-80,80-90,90-95,95-100,100+
const LA_BIN_EDGES = [0, 10, 20, 30, 40];   // 6 bins: <0,0-10,10-20,20-30,30-40,40+
const XSTATS_MIN_N = 8;

function binIndex(v, edges) {
  for (let i = 0; i < edges.length; i++) if (v < edges[i]) return i;
  return edges.length;
}

// Standard published sabermetric wOBA linear weights — NOT fit to CCL data.
// These are stable across levels/contexts the same way run-value-by-count
// tables are, which is why it's defensible to borrow them (unlike SIERA's
// regression coefficients, which genuinely need a large fitting sample).
export const WOBA_WEIGHTS = { BB: 0.69, HBP: 0.72, '1B': 0.89, '2B': 1.27, '3B': 1.62, HR: 2.10 };
export const WOBA_SCALE = 1.15;
// No earned-run field exists anywhere in this app's schema (Game has no
// score/runs field), so there is no CCL ground truth to calibrate an ERA
// scale against. This anchor is an external assumption (typical summer
// wood-bat-league ERA) purely so xERA reads on a familiar scale — the
// PERCENTILE RANK is the reliable part of this stat, not the absolute number.
const LEAGUE_ERA_ANCHOR = 5.00;
const PA_PER_9 = 38;

function tbValueOf(result) {
  if (result === 'Single') return 1;
  if (result === 'Double') return 2;
  if (result === 'Triple') return 3;
  if (result === 'HomeRun') return 4;
  return 0;
}
function wobaValueOf(result) {
  if (result === 'Single') return WOBA_WEIGHTS['1B'];
  if (result === 'Double') return WOBA_WEIGHTS['2B'];
  if (result === 'Triple') return WOBA_WEIGHTS['3B'];
  if (result === 'HomeRun') return WOBA_WEIGHTS.HR;
  return 0;
}

export function buildXStatsGrid(leaguePitches) {
  const cells = {};
  for (const r of leaguePitches || []) {
    if (r.pitch_call !== 'InPlay') continue;
    const ev = parseFloat(r.exit_speed), la = parseFloat(r.launch_angle);
    if (!Number.isFinite(ev) || !Number.isFinite(la) || !r.play_result) continue;
    const key = `${binIndex(ev, EV_BIN_EDGES)}-${binIndex(la, LA_BIN_EDGES)}`;
    const c = (cells[key] = cells[key] || { hits: 0, tb: 0, woba: 0, n: 0 });
    c.n++;
    if (['Single', 'Double', 'Triple', 'HomeRun'].includes(r.play_result)) c.hits++;
    c.tb += tbValueOf(r.play_result);
    c.woba += wobaValueOf(r.play_result);
  }
  const grid = {};
  for (const key of Object.keys(cells)) {
    const c = cells[key];
    if (c.n < XSTATS_MIN_N) continue;
    grid[key] = { hitProb: c.hits / c.n, tbAvg: c.tb / c.n, wobaAvg: c.woba / c.n, n: c.n };
  }
  return grid;
}

function xStatsLookup(grid, ev, la) {
  return grid[`${binIndex(ev, EV_BIN_EDGES)}-${binIndex(la, LA_BIN_EDGES)}`] || null;
}

// Applies the grid to one player's own rows to get xBA/xSLG/xwOBA. K
// contributes 0 everywhere; BB/HBP contribute their fixed wOBA weight to
// xwOBA only (they already happened, so there's nothing to "expect"); any
// BIP missing EV/LA, or landing in a too-sparse grid cell, is excluded from
// the average rather than guessed at.
export function xStatsForRows(rows, grid) {
  if (!grid || !Object.keys(grid).length) return null;
  let hitSum = 0, tbSum = 0, wobaSum = 0, gridded = 0;
  const bb = rows.filter(r => r.kor_bb === 'Walk').length;
  const hbp = rows.filter(r => r.pitch_call === 'HitByPitch').length;
  const k = rows.filter(r => r.kor_bb === 'Strikeout').length;
  const bip = rows.filter(isBIP);
  bip.forEach(r => {
    const ev = parseFloat(r.exit_speed), la = parseFloat(r.launch_angle);
    if (!Number.isFinite(ev) || !Number.isFinite(la)) return;
    const cell = xStatsLookup(grid, ev, la);
    if (!cell) return;
    hitSum += cell.hitProb; tbSum += cell.tbAvg; wobaSum += cell.wobaAvg; gridded++;
  });
  const ab = gridded + k;
  const pa = ab + bb + hbp;
  if (ab < MIN_N) return null;
  return {
    xBA: hitSum / ab,
    xSLG: tbSum / ab,
    xwOBA: pa ? (wobaSum + bb * WOBA_WEIGHTS.BB + hbp * WOBA_WEIGHTS.HBP) / pa : null,
    n: gridded, ab, pa,
  };
}

// ── Run value (linear weights, runs above/below average) ─────────────────
// Uses ACTUAL outcomes (real hits/BB/K), converted to wOBA with the
// published weights above, then to runs via WOBA_SCALE. leagueWoba is this
// pool's own real league-average wOBA (computed once, passed in) — so the
// baseline is CCL-native even though the weights themselves are borrowed.
export function actualWoba(rows) {
  let h1 = 0, h2 = 0, h3 = 0, hr = 0, bb = 0, hbp = 0, ab = 0;
  rows.forEach(r => {
    if (r.kor_bb === 'Walk') { bb++; return; }
    if (r.pitch_call === 'HitByPitch') { hbp++; return; }
    if (r.kor_bb === 'Strikeout') { ab++; return; }
    if (!['Out', 'Single', 'Double', 'Triple', 'HomeRun', 'Error', 'FieldersChoice', 'Sacrifice'].includes(r.play_result)) return;
    if (r.play_result === 'Sacrifice') return;
    ab++;
    if (r.play_result === 'Single') h1++;
    else if (r.play_result === 'Double') h2++;
    else if (r.play_result === 'Triple') h3++;
    else if (r.play_result === 'HomeRun') hr++;
  });
  const pa = ab + bb + hbp;
  if (!pa) return null;
  const wobaNum = h1 * WOBA_WEIGHTS['1B'] + h2 * WOBA_WEIGHTS['2B'] + h3 * WOBA_WEIGHTS['3B']
    + hr * WOBA_WEIGHTS.HR + bb * WOBA_WEIGHTS.BB + hbp * WOBA_WEIGHTS.HBP;
  return { woba: wobaNum / pa, pa };
}

// invert=true for pitchers: flips the sign so positive = runs SAVED (better),
// matching the "higher is better" convention every other percentile bar uses.
export function runValue(rows, leagueWoba, { invert = false } = {}) {
  const w = actualWoba(rows);
  if (!w || leagueWoba == null) return null;
  const delta = (w.woba - leagueWoba) / WOBA_SCALE * w.pa;
  return invert ? -delta : delta;
}

// xERA (approx) — same run-value math applied to xwOBA-against instead of
// actual wOBA-against, read against the external LEAGUE_ERA_ANCHOR above.
export function xERA(rows, grid, leagueWoba) {
  const x = xStatsForRows(rows, grid);
  if (!x || x.xwOBA == null || leagueWoba == null) return null;
  const runsPerPADelta = (x.xwOBA - leagueWoba) / WOBA_SCALE;
  return LEAGUE_ERA_ANCHOR + runsPerPADelta * PA_PER_9;
}

// League-average actual wOBA across all PAs in the pool — the baseline both
// runValue() and xERA() compare against.
export function leagueAvgWoba(leaguePitches) {
  const w = actualWoba(leaguePitches || []);
  return w ? w.woba : null;
}

// ── xHR (distance-only, would-be-HR-across-CCL-parks) ────────────────────
// APPROXIMATION: uses hit_distance vs. fence distance by spray angle ONLY —
// no wall height, because no CCL park's wall-height-by-angle data exists
// anywhere (same category of gap as the missing Game score field). A low
// liner and a moonshot landing at the same spot count identically here.
// Restricting to LA 20-40 (true fly-ball shape) is a partial compensation,
// not a fix.
//
// Each park entry is {lf, lfGap, cf, rfGap, rf} in feet, angles fixed at
// foul line=45°, gap=22.5°, straightaway=0° (bearing convention: 0=CF,
// negative=left, positive=right, matching hit_distance/bearing fields).
// Parks with incomplete public dimensions are marked partial:true and
// excluded from the "would-be-HR in N of M parks" denominator rather than
// guessing at their missing numbers — fill these in as real data surfaces.
export const CCL_PARK_DIMENSIONS = {
  ARR_SEC: { name: 'Brookside Park (Arroyo Seco Saints)', lf: 374, lfGap: 370, cf: 365, rfGap: 345, rf: 345 },
  SAN_LUI: { name: 'Sinsheimer Stadium (SLO Blues)', lf: 325, lfGap: 375, cf: 390, rfGap: 370, rf: 320 },
  SAN_BAR: { name: 'Santa Barbara High School (Foresters)', lf: 325, lfGap: 370, cf: 385, rfGap: 370, rf: 325 },
  SON_STO: { name: 'Arnold Field (Sonoma Stompers)', lf: 304, lfGap: 330, cf: 435, rfGap: 345, rf: 310 },
  WAL_CRE: { name: 'Monte Vista High School (Crawdads)', lf: 300, lfGap: 325, cf: 375, rfGap: 315, rf: 290 },
  ORA_COU2: { name: 'OC Great Park (Riptide)', lf: 325, lfGap: 375, cf: 400, rfGap: 375, rf: 325 },
  CON_OAK: { name: 'Ventura College Pirate Park (Conejo Oaks)', lf: 331, lfGap: 371, cf: 462, rfGap: 382, rf: 315 },
  MLB_ACA: { name: 'MLB Academy (Academy Barons)', lf: 325, lfGap: 370, cf: 400, rfGap: 365, rf: 320 },
  MEN_PAR: { name: 'Baylands Park (Menlo Park Legends)', lf: 320, lfGap: 360, cf: 380, rfGap: 365, rf: 315 },
  // San Francisco Seagulls' listed home (San Bruno) uses a portable fence
  // with inconsistent dimensions game-to-game — not usable for a fixed xHR
  // model. Chabot College substitutes as their nearest fixed-dimension
  // venue, per Derek. (Chabot is also the venue with the known spin_axis
  // null gap noted elsewhere in this app — same physical field.)
  SAN_FRA4: { name: 'Chabot College (SF Seagulls, sub for San Bruno)', lf: 330, lfGap: 365, cf: 385, rfGap: 370, rf: 330 },
  // These 5 are travel/affiliate programs with no CCL home park (they only
  // play road games in this league) — null by design, not a data gap.
  PHI_BAS: null, ALA_MER: null, SAN_DIE25: null, SAN_DIE_24: null, SAN_MAR6: null,
};

export function fenceDistanceAt(park, bearingDeg) {
  if (!park) return null;
  const pts = [];
  if (park.lf != null) pts.push([-45, park.lf]);
  if (park.lfGap != null) pts.push([-22.5, park.lfGap]);
  if (park.cf != null) pts.push([0, park.cf]);
  if (park.rfGap != null) pts.push([22.5, park.rfGap]);
  if (park.rf != null) pts.push([45, park.rf]);
  if (pts.length < 2) return null;
  const b = Math.max(-45, Math.min(45, bearingDeg));
  for (let i = 0; i < pts.length - 1; i++) {
    const [a1, d1] = pts[i], [a2, d2] = pts[i + 1];
    if (b >= a1 && b <= a2) {
      const t = (b - a1) / (a2 - a1);
      return d1 + (d2 - d1) * t;
    }
  }
  return b < pts[0][0] ? pts[0][1] : pts[pts.length - 1][1];
}

// ── Park fence overlay (per audit) ────────────────────────────────────────
// Builds an SVG path tracing the TRUE fence shape for a given park across
// bearings -45..45deg, using fenceDistanceAt at each sample point — replaces
// the generic uniform-radius "wall" arcs spray charts previously drew (which
// implied every CCL park is a perfect circle; none are). `toXY(bearing,
// dist) => {x,y}` is supplied by the caller so this stays chart-geometry
// agnostic (each of the three spray chart implementations scales/orients
// its SVG slightly differently).
export function fenceArcPath(parkCode, toXY, steps = 24) {
  const park = CCL_PARK_DIMENSIONS[parkCode];
  if (!park) return null;
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const bearing = -45 + (90 * i) / steps;
    const dist = fenceDistanceAt(park, bearing);
    if (dist == null) return null;
    const { x, y } = toXY(bearing, dist);
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  return d.trim();
}

// Returns { clearedIn, ofParks, parkNames } for one batted ball, or null if
// it isn't a real fly-ball candidate (LA outside 20-40) or is missing
// bearing/distance. clearedIn/ofParks only count parks with usable data.
export function xHRForRow(row) {
  const dist = row.hit_distance, bearing = row.bearing, la = row.launch_angle;
  if (dist == null || bearing == null || la == null || la < 20 || la > 40) return null;
  const usable = Object.entries(CCL_PARK_DIMENSIONS).filter(([, p]) => p && !p.partial);
  if (!usable.length) return null;
  const cleared = usable.filter(([, p]) => dist >= fenceDistanceAt(p, bearing));
  return { clearedIn: cleared.length, ofParks: usable.length, parkNames: cleared.map(([, p]) => p.name) };
}

// Season aggregate: for how many of a player's fly balls would N parks have
// been a HR, on average — a "how home-run-friendly does this profile play"
// number rather than a per-ball detail.
export function xHRProfile(rows) {
  const results = rows.map(xHRForRow).filter(Boolean);
  if (!results.length) return null;
  const ofParks = results[0].ofParks;
  const noDoubters = results.filter(r => r.clearedIn === ofParks).length;
  const someParks = results.filter(r => r.clearedIn > 0 && r.clearedIn < ofParks).length;
  const noParks = results.filter(r => r.clearedIn === 0).length;
  return {
    n: results.length,
    ofParks,
    noDoubters, someParks, noParks,
    noDoubterPct: noDoubters / results.length,
    someParksPct: someParks / results.length,
    noParksPct: noParks / results.length,
  };
}

// Per-park breakdown: of this player's fly-ball sample, what % would have
// left each of the 10 parks. Sorted largest-to-smallest CF so the pattern
// (this hitter/pitcher plays big in small parks only, etc.) is readable at
// a glance.
export function xHRParkBreakdown(rows) {
  const candidates = rows.filter(r => r.hit_distance != null && r.bearing != null && r.launch_angle != null && r.launch_angle >= 20 && r.launch_angle <= 40);
  if (candidates.length < MIN_N) return null;
  const usable = Object.entries(CCL_PARK_DIMENSIONS).filter(([, p]) => p);
  const parks = usable.map(([code, p]) => {
    const clears = candidates.filter(r => r.hit_distance >= fenceDistanceAt(p, r.bearing)).length;
    return { code, name: p.name, cf: p.cf, count: clears, pct: clears / candidates.length };
  }).sort((a, b) => b.cf - a.cf);
  return { n: candidates.length, parks };
}
export function buildPitcherPool(allPitches) {
  // AUDIT: key on canonicalNameKey — raw-string grouping split one pitcher
  // into multiple sub-threshold pool entries on spelling variants.
  const byPitcher = {};
  allPitches.forEach(p => {
    if (!p.pitcher_name) return;
    const k = canonicalNameKey(p.pitcher_name);
    if (!byPitcher[k]) byPitcher[k] = [];
    byPitcher[k].push(p);
  });

  const grid = buildXStatsGrid(allPitches);
  const leagueWoba = leagueAvgWoba(allPitches);

  const pool = {
    fbVelo: [], maxVelo: [], fbSpin: [], bbSpin: [],
    kPct: [], bbPct: [], hardPct: [], softPct: [],
    gbPct: [], fbPct: [], whiffPct: [], babip: [],
    chasePct: [], avgEVAgainst: [], avgLaunchAgainst: [], extension: [],
    runValue: [], xERA: [], xBAAgainst: [], xSLGAgainst: [], xwOBAAgainst: [],
    strikePct: [], fpsPct: [], putawayPct: [],
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
    if (prof.fbPct != null) pool.fbPct.push(prof.fbPct);
    if (prof.whiffPct != null) pool.whiffPct.push(prof.whiffPct);
    if (prof.babip != null) pool.babip.push(prof.babip);
    if (prof.chasePct != null) pool.chasePct.push(prof.chasePct);
    if (prof.avgEVAgainst != null) pool.avgEVAgainst.push(prof.avgEVAgainst);
    if (prof.avgLaunchAgainst != null) pool.avgLaunchAgainst.push(prof.avgLaunchAgainst);
    if (prof.extensionMean != null) pool.extension.push(prof.extensionMean);
    if (prof.strikePct != null) pool.strikePct.push(prof.strikePct);
    if (prof.fpsPct != null) pool.fpsPct.push(prof.fpsPct);
    if (prof.putawayPct != null) pool.putawayPct.push(prof.putawayPct);
    const rv = runValue(rows, leagueWoba, { invert: true });
    if (rv != null) pool.runValue.push(rv);
    const xe = xERA(rows, grid, leagueWoba);
    if (xe != null) pool.xERA.push(xe);
    const xs = xStatsForRows(rows, grid);
    if (xs?.xBA != null) pool.xBAAgainst.push(xs.xBA);
    if (xs?.xSLG != null) pool.xSLGAgainst.push(xs.xSLG);
    if (xs?.xwOBA != null) pool.xwOBAAgainst.push(xs.xwOBA);
  });

  pool.xGrid = grid;
  pool.leagueWoba = leagueWoba;
  return pool;
}

// ── buildHitterPool: build distribution arrays from all batter TrackmanPitch rows ──
export function buildHitterPool(allPitches) {
  const byBatter = {};
  allPitches.forEach(p => {
    if (!p.batter_name) return;
    const k = canonicalNameKey(p.batter_name);
    if (!byBatter[k]) byBatter[k] = [];
    byBatter[k].push(p);
  });

  const grid = buildXStatsGrid(allPitches);
  const leagueWoba = leagueAvgWoba(allPitches);

  const pool = {
    avgEV: [], maxEV: [], hardPct: [], gbPct: [],
    airPullPct: [], whiffPct: [], chasePct: [],
    oSwingPct: [], fStrikePct: [], zContactPct: [], oContactPct: [],
    slg: [], obp: [], iso: [], babip: [], avg: [],
    runValue: [], xBA: [], xwOBA: [], xSLG: [], bbPct: [], kPct: [], launchAngle: [], ev90: [], laAtEv90: [],
    fbPct: [], ldPct: [], softPct: [], barrelPct: [], contactPct: [], twoKContactPct: [], swingPct: [], fpSwPct: [],
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
    if (prof.bbPct != null) pool.bbPct.push(prof.bbPct);
    if (prof.avg != null) pool.avg.push(prof.avg);
    if (prof.kPct != null) pool.kPct.push(prof.kPct);
    if (prof.avgLaunchAngle != null) pool.launchAngle.push(prof.avgLaunchAngle);
    if (prof.ev90 != null) pool.ev90.push(prof.ev90);
    if (prof.laAtEv90 != null) pool.laAtEv90.push(prof.laAtEv90);
    if (prof.fbPct != null) pool.fbPct.push(prof.fbPct);
    if (prof.ldPct != null) pool.ldPct.push(prof.ldPct);
    if (prof.softPct != null) pool.softPct.push(prof.softPct);
    if (prof.barrelPct != null) pool.barrelPct.push(prof.barrelPct);
    if (prof.contactPct != null) pool.contactPct.push(prof.contactPct);
    if (prof.twoKContactPct != null) pool.twoKContactPct.push(prof.twoKContactPct);
    if (prof.swingPct != null) pool.swingPct.push(prof.swingPct);
    if (prof.fpSwPct != null) pool.fpSwPct.push(prof.fpSwPct);
    const rv = runValue(rows, leagueWoba, { invert: false });
    if (rv != null) pool.runValue.push(rv);
    const xs = xStatsForRows(rows, grid);
    if (xs?.xBA != null) pool.xBA.push(xs.xBA);
    if (xs?.xwOBA != null) pool.xwOBA.push(xs.xwOBA);
    if (xs?.xSLG != null) pool.xSLG.push(xs.xSLG);
  });

  pool.xGrid = grid;
  pool.leagueWoba = leagueWoba;
  return pool;
}

// fmt: format a number removing leading zero (0.325 → ".325")
export function fmtStat(v, decimals = 3) {
  if (v == null) return '—';
  const s = v.toFixed(decimals);
  return s.startsWith('0.') ? s.slice(1) : s;
}

// ── Savant-parity: league-average movement by handedness, per pitch type ──
// Powers the shaded "league avg (same-handed)" ellipse on the circular
// movement plot — a RHP's Four-Seam is benchmarked against other RHP
// Four-Seams, not the whole league regardless of arm side. Requires at
// least MIN_N pitchers' worth of pitches per hand/type cell or it's omitted
// (same minimum-N convention as the rest of the app).
export function leagueMovementProfile(leaguePitches) {
  const groups = {}; // hand -> type -> { hb: [], ivb: [] }
  for (const r of leaguePitches || []) {
    const hb = parseFloat(r.horz_break), ivb = parseFloat(r.induced_vert_break);
    if (!Number.isFinite(hb) || !Number.isFinite(ivb)) continue;
    const hand = r.pitcher_hand === 'Left' ? 'Left' : 'Right';
    const type = normalizePitch(r.tagged_pitch_type || r.pitch_type);
    const g = (groups[hand] = groups[hand] || {});
    (g[type] = g[type] || { hb: [], ivb: [] });
    g[type].hb.push(hb);
    g[type].ivb.push(ivb);
  }
  const out = {};
  for (const hand of Object.keys(groups)) {
    out[hand] = {};
    for (const type of Object.keys(groups[hand])) {
      const { hb, ivb } = groups[hand][type];
      if (hb.length < 20) continue; // pitch-level minimum, distinct from MIN_N cell rule
      out[hand][type] = { hbMean: mean(hb), ivbMean: mean(ivb), hbSd: stdDev(hb), ivbSd: stdDev(ivb), n: hb.length };
    }
  }
  return out;
}

// ── Savant-parity: contact-quality tiers (Weak/Topped/Under/Flare-Burner/
// Solid/Barrel) ─────────────────────────────────────────────────────────
// APPROXIMATION, not Statcast's proprietary EV/LA matrix — same caveat as
// approxBarrelRate above, and deliberately reuses its EV>=95 / LA 10-35
// barrel threshold so the two "barrel" numbers shown elsewhere in the app
// never disagree with each other.
export function contactQualityBreakdown(rows) {
  const bip = rows.filter(r => r.exit_speed != null && r.launch_angle != null && r.play_result);
  if (bip.length < MIN_N) return { tiers: [], n: bip.length };
  const tierOf = (ev, la) => {
    if (ev < 59) return 'Weak';
    if (ev >= 95 && la >= 10 && la <= 35) return 'Barrel';
    if (la < 10) return 'Topped';
    if (la > 35) return 'Under';
    if (ev >= 85) return 'Solid';
    return 'FlareBurner';
  };
  const order = ['Barrel', 'Solid', 'FlareBurner', 'Topped', 'Under', 'Weak'];
  const buckets = Object.fromEntries(order.map(k => [k, []]));
  bip.forEach(r => {
    const ev = parseFloat(r.exit_speed), la = parseFloat(r.launch_angle);
    if (!Number.isFinite(ev) || !Number.isFinite(la)) return;
    const t = tierOf(ev, la);
    buckets[t].push({ ev, r });
  });
  const n = bip.length;
  const wobaWeight = r => {
    const res = r.play_result;
    if (res === 'HomeRun') return 2.0;
    if (res === 'Triple') return 1.6;
    if (res === 'Double') return 1.25;
    if (res === 'Single') return 0.9;
    return 0;
  };
  const tiers = order.map(key => {
    const items = buckets[key];
    if (!items.length) return { key, pct: 0, avgEV: null, woba: null };
    const evs = items.map(i => i.ev);
    const wobaSum = items.reduce((s, i) => s + wobaWeight(i.r), 0);
    return {
      key,
      pct: Math.round((items.length / n) * 100),
      avgEV: mean(evs),
      woba: wobaSum / items.length,
      n: items.length,
    };
  });
  return { tiers, n };
}

// ── Savant-parity: batted-ball profile (trajectory + pull/straight/oppo) ──
// Trajectory buckets match the thresholds already used in ContactSection/
// ContactProfile (LA<10 GB, 10-25 LD, 25-50 FB, >50 PU). Direction reuses
// the existing sprayDistribution/sprayThird helpers rather than re-deriving
// pull/oppo logic a third time.
export function battedBallProfile(rows) {
  const bip = rows.filter(r => r.pitch_call === 'InPlay' && r.exit_speed > 0);
  if (bip.length < MIN_N) return null;
  // BUGFIX (per audit): null launch angle was previously bucketed as
  // GroundBall by default. Now excluded from both the bucket counts and the
  // percentage denominator (knownLaN, separate from n/bip.length).
  let gb = 0, ld = 0, fb = 0, pu = 0, knownLaN = 0;
  bip.forEach(r => {
    const la = r.launch_angle;
    if (la == null) return;
    if (la < 10) gb++; else if (la < 25) ld++; else if (la < 50) fb++; else pu++;
    knownLaN++;
  });
  const n = bip.length;
  // BUGFIX (per audit): previously derived ONE hand from the first row with
  // a batter_hand present and applied it to the whole set — wrong for half
  // of a switch hitter's contact. sprayDistribution now classifies each row
  // by its own batter_hand internally, so passing a single fallback hand
  // here only matters for rows that are somehow missing batter_hand.
  const fallbackHand = normHand(bip.find(r => r.batter_hand)?.batter_hand);
  const spray = sprayDistribution(bip, fallbackHand);
  return {
    n,
    gbPct: knownLaN ? gb / knownLaN : null,
    ldPct: knownLaN ? ld / knownLaN : null,
    fbPct: knownLaN ? fb / knownLaN : null,
    puPct: knownLaN ? pu / knownLaN : null,
    pullPct: spray?.pullPct ?? null, straightPct: spray?.midPct ?? null, oppoPct: spray?.oppoPct ?? null,
  };
}

// ── Savant-parity: exit-velocity histogram bins ──────────────────────────
export function evHistogramBins(rows, binWidth = 3) {
  const evs = rows.filter(r => r.pitch_call === 'InPlay').map(r => r.exit_speed).filter(v => v != null && v > 0);
  if (evs.length < MIN_N) return [];
  const minV = Math.floor(Math.min(...evs) / binWidth) * binWidth;
  const maxV = Math.ceil(Math.max(...evs) / binWidth) * binWidth;
  const bins = [];
  for (let v = minV; v < maxV; v += binWidth) bins.push({ lo: v, label: String(v), count: 0 });
  evs.forEach(v => {
    const i = Math.min(bins.length - 1, Math.max(0, Math.floor((v - minV) / binWidth)));
    bins[i].count++;
  });
  return bins;
}

// ── Savant-parity: slash line from raw pitch rows ────────────────────────
// Shared by the hitter's own OffenseLine AND pitcher-allowed platoon splits
// — one implementation of AB/H/TB/BB/K accounting instead of three.
export function slashLine(rows) {
  let ab = 0, h = 0, tb = 0, hr = 0, xbh = 0, bb = 0, k = 0, hbp = 0;
  const isTerminal = p => ['Out', 'Single', 'Double', 'Triple', 'HomeRun', 'Error', 'FieldersChoice', 'Sacrifice'].includes(p.play_result);
  rows.forEach(p => {
    if (p.pitch_call === 'HitByPitch') { hbp++; return; }
    if (p.kor_bb === 'Walk') { bb++; return; }
    if (p.kor_bb === 'Strikeout') { k++; ab++; return; }
    if (isTerminal(p)) {
      if (p.play_result === 'Sacrifice') return;
      ab++;
      if (p.play_result === 'Single') { h++; tb++; }
      else if (p.play_result === 'Double') { h++; tb += 2; xbh++; }
      else if (p.play_result === 'Triple') { h++; tb += 3; xbh++; }
      else if (p.play_result === 'HomeRun') { h++; tb += 4; hr++; xbh++; }
    }
  });
  // BUGFIX (per audit): pa/obp now include HBP (were previously ab+bb only,
  // ran low in an HBP-heavy league and disagreed with the dugout's own
  // computeStats). kPct denominator is now PA, not total pitches seen — was
  // previously `k / rows.length`, which understated displayed K% by roughly
  // 4-5x since most pitches in an at-bat aren't the PA-ending pitch.
  const pa = ab + bb + hbp;
  const avg = ab ? h / ab : null;
  const slg = ab ? tb / ab : null;
  const obp = pa ? (h + bb + hbp) / pa : null;
  const iso = (slg != null && avg != null) ? slg - avg : null;
  const ops = (obp != null && slg != null) ? obp + slg : null;
  const swings = rows.filter(isSwingRow).length;
  const whiffs = rows.filter(isWhiff).length;
  return { pa, ab, h, tb, hr, xbh, bb, k, hbp, avg, slg, obp, iso, ops,
    kPct: pa ? k / pa : null,
    whiffPct: swings ? whiffs / swings : null };
}

// ── Savant-parity: platoon split rows, keyed by the opposite-role hand ───
// side = 'batter_hand' (for a pitcher's allowed splits) or 'pitcher_hand'
// (for a hitter's own splits vs L/R).
export function platoonSplitRows(rows, side) {
  const right = rows.filter(r => r[side] === 'Right');
  const left = rows.filter(r => r[side] === 'Left');
  return [
    { label: side === 'batter_hand' ? 'RHH' : 'RHP', rows: right, stats: slashLine(right) },
    { label: side === 'batter_hand' ? 'LHH' : 'LHP', rows: left, stats: slashLine(left) },
  ].filter(s => s.rows.length >= MIN_N);
}
// ── buildArsenalPool: per-pitch-type league distributions for the print
// report's arsenal-table shading. Each qualified (pitcher, pitch type) pair
// with ≥10 pitches of that type contributes ONE value per metric: its avg
// velo/spin/IVB, its mean |HB| (absolute value so LHP/RHP horizontal movement
// compares on magnitude, not sign — raw HB sign flips with pitcher hand), and
// its whiff rate (gated at ≥5 swings so a 1-for-2 doesn't pollute the pool).
// Undefined/Other tags are excluded — they're mistags, not pitches. Keyed on
// canonicalNameKey like buildPitcherPool (raw-string grouping splits pitchers
// on spelling variants). Returns { [pitchType]: { velo, spin, ivb, absHb,
// whiff } } arrays for percentileRank/divergingCell.
export function buildArsenalPool(allPitches) {
  const byKey = {};
  for (const p of allPitches) {
    if (!p.pitcher_name) continue;
    const t = normalizePitch(p.tagged_pitch_type || p.pitch_type);
    if (t === 'Undefined' || t === 'Other') continue;
    const k = `${canonicalNameKey(p.pitcher_name)}|${t}`;
    (byKey[k] = byKey[k] || { t, rows: [] }).rows.push(p);
  }
  const meanOf = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  const nums = (rows, f) => rows.map(f).map(Number).filter(Number.isFinite);
  const pool = {};
  Object.values(byKey).forEach(({ t, rows }) => {
    if (rows.length < 10) return;
    const P = (pool[t] = pool[t] || { velo: [], spin: [], ivb: [], absHb: [], whiff: [] });
    const velo = meanOf(nums(rows, r => r.rel_speed).filter(v => v > 0));
    const spin = meanOf(nums(rows, r => r.spin_rate));
    const ivb = meanOf(nums(rows, r => r.induced_vert_break));
    const absHb = meanOf(nums(rows, r => r.horz_break).map(Math.abs));
    const swings = rows.filter(r => isSwingRow(r)).length;
    const whiffs = rows.filter(r => isWhiff(r)).length;
    if (velo != null) P.velo.push(velo);
    if (spin != null) P.spin.push(spin);
    if (ivb != null) P.ivb.push(ivb);
    if (absHb != null) P.absHb.push(absHb);
    if (swings >= 5) P.whiff.push(whiffs / swings);
  });
  return pool;
}

// ── maxFastballVelo: the ONE definition of "Max FB" ──────────────────────
// Max rel_speed across ALL pitches tagged any true-fastball velo type
// (Fastball/Four-Seam/Sinker — no Cutter), NOT prof.fb.maxVelo, which is
// scoped to the single highest-usage fastball type and reads low whenever
// the hardest pitch of an outing wears a different fastball tag. Pass the
// UNFILTERED pitch set: the profile percentile bars deliberately bypass the
// 4%-noise filter here so a rare/mislabeled fastball isn't dropped. Used by
// both PitcherProfileOverview (Max FB bar) and PrintProfileReport (velo
// pill) so the two can never disagree again.
export function maxFastballVelo(rows) {
  const velos = rows
    .filter(p => isFastballVeloType(normalizePitch(p.tagged_pitch_type || p.pitch_type)))
    .map(p => p.rel_speed)
    .filter(v => v != null && v > 0);
  return velos.length ? Math.max(...velos) : null;
}

// ── buildLeaderboardRows: one row per qualified player with every metric ───
// tracked on that player's profile page. Unlike buildPitcherPool/
// buildHitterPool (which discard identity and only keep flat arrays for
// percentile ranking), this keeps name/team/N alongside every raw value so
// the League Leaderboard can display and sort by any of them. Metric keys
// and qualification thresholds are the SAME as the pool builders and the
// profile percentile cards (PitcherProfileOverview / BatterProfileOverview)
// — if you add a stat there, add it here too so the leaderboard stays in
// sync with what a person actually sees on a profile.
export function buildLeaderboardRows(allPitches, role) {
  const byPlayer = {};
  const nameField = role === 'pitcher' ? 'pitcher_name' : 'batter_name';
  const teamField = role === 'pitcher' ? 'pitcher_team' : 'batter_team';
  allPitches.forEach(p => {
    if (!p[nameField]) return;
    const k = canonicalNameKey(p[nameField]);
    if (!byPlayer[k]) byPlayer[k] = [];
    byPlayer[k].push(p);
  });

  const grid = buildXStatsGrid(allPitches);
  const leagueWoba = leagueAvgWoba(allPitches);
  const rows = [];

  Object.values(byPlayer).forEach(prs => {
    // Most-common team name across this player's rows — handles the rare
    // mid-season team-code correction without splitting one player in two.
    const teamCounts = {};
    prs.forEach(r => { const t = r[teamField]; if (t) teamCounts[t] = (teamCounts[t] || 0) + 1; });
    const team = Object.entries(teamCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const displayName = prs[0][nameField];

    if (role === 'pitcher') {
      if (prs.length < 20) return; // same qualification as buildPitcherPool
      const prof = pitcherProfile(prs);
      if (!prof) return;
      const rv = runValue(prs, leagueWoba, { invert: true });
      const xe = xERA(prs, grid, leagueWoba);
      const xs = xStatsForRows(prs, grid);
      rows.push({
        name: displayName, team, role: 'Pitcher', n: prs.length,
        runValue: rv, xERA: xe, xBA: xs?.xBA ?? null, xwOBA: xs?.xwOBA ?? null, xSLG: xs?.xSLG ?? null,
        babip: prof.babip ?? null,
        fbVelo: prof.fb?.avgVelo ?? null, maxVelo: maxFastballVelo(prs), fbSpin: prof.fb?.avgSpin ?? null,
        bbSpin: prof.bb?.avgSpin ?? null, putawayPct: prof.putawayPct ?? null, extension: prof.extensionMean ?? null,
        strikePct: prof.strikePct ?? null, fpsPct: prof.fpsPct ?? null, kPct: prof.kPct ?? null,
        bbPct: prof.bbPct ?? null, whiffPct: prof.whiffPct ?? null, chasePct: prof.chasePct ?? null,
        avgEVAgainst: prof.avgEVAgainst ?? null, avgLaunchAgainst: prof.avgLaunchAgainst ?? null,
        gbPct: prof.gbPct ?? null, fbPct: prof.fbPct ?? null, softPct: prof.softPct ?? null, hardPct: prof.hardPct ?? null,
      });
    } else {
      const prof = hitterTrackmanProfile(prs);
      if (!prof) return; // hitterTrackmanProfile enforces its own 10-BIP qualification
      const rv = runValue(prs, leagueWoba, { invert: false });
      const xs = xStatsForRows(prs, grid);
      rows.push({
        name: displayName, team, role: 'Hitter', n: prs.length,
        runValue: rv, xBA: xs?.xBA ?? null, xwOBA: xs?.xwOBA ?? null, xSLG: xs?.xSLG ?? null,
        iso: prof.iso ?? null, babip: prof.babip ?? null,
        avgEV: prof.avgEV ?? null, ev90: prof.ev90 ?? null, maxEV: prof.maxEV ?? null,
        barrelPct: prof.barrelPct ?? null, hardPct: prof.hardPct ?? null, softPct: prof.softPct ?? null,
        launchAngle: prof.avgLaunchAngle ?? null, laAtEv90: prof.laAtEv90 ?? null,
        airPullPct: prof.airPullPct ?? null, fbPct: prof.fbPct ?? null, ldPct: prof.ldPct ?? null, gbPct: prof.gbPct ?? null,
        contactPct: prof.contactPct ?? null, twoKContactPct: prof.twoKContactPct ?? null,
        swingPct: prof.swingPct ?? null, fpSwPct: prof.fpSwPct ?? null, kPct: prof.kPct ?? null, bbPct: prof.bbPct ?? null,
      });
    }
  });

  return rows;
}

// Metric catalogue shared by the leaderboard table and column picker.
// `invert` = true means LOWER raw values are better (colors/sorts accordingly
// when "best first" sorting is requested) — mirrors the same flag on the
// profile percentile-bar rowDefs.
export const PITCHER_LEADERBOARD_METRICS = [
  { key: 'runValue', label: 'Run Value', category: 'Run Prevention', decimals: 1, invert: false, signed: true },
  { key: 'xERA', label: 'xERA', category: 'Run Prevention', decimals: 2, invert: true },
  { key: 'xBA', label: 'xBA', category: 'Run Prevention', decimals: 3, invert: true, stat: true },
  { key: 'xwOBA', label: 'xwOBA', category: 'Run Prevention', decimals: 3, invert: true, stat: true },
  { key: 'xSLG', label: 'xSLG', category: 'Run Prevention', decimals: 3, invert: true, stat: true },
  { key: 'babip', label: 'BABIP', category: 'Run Prevention', decimals: 3, invert: true, stat: true },
  { key: 'fbVelo', label: 'Avg FB', category: 'Stuff', decimals: 1, invert: false, unit: ' mph' },
  { key: 'maxVelo', label: 'Max FB', category: 'Stuff', decimals: 1, invert: false, unit: ' mph' },
  { key: 'fbSpin', label: 'FB Spin', category: 'Stuff', decimals: 0, invert: false, unit: ' rpm' },
  { key: 'bbSpin', label: 'BB Spin', category: 'Stuff', decimals: 0, invert: false, unit: ' rpm' },
  { key: 'putawayPct', label: 'Putaway%', category: 'Stuff', decimals: 0, invert: false, pct: true },
  { key: 'extension', label: 'Extension', category: 'Stuff', decimals: 1, invert: false, unit: ' ft' },
  { key: 'strikePct', label: 'Strike%', category: 'Plate Discipline', decimals: 0, invert: false, pct: true },
  { key: 'fpsPct', label: 'FPS%', category: 'Plate Discipline', decimals: 0, invert: false, pct: true },
  { key: 'kPct', label: 'K%', category: 'Plate Discipline', decimals: 0, invert: false, pct: true },
  { key: 'bbPct', label: 'Free Pass%', category: 'Plate Discipline', decimals: 0, invert: true, pct: true },
  { key: 'whiffPct', label: 'Whiff%', category: 'Plate Discipline', decimals: 0, invert: false, pct: true },
  { key: 'chasePct', label: 'Chase%', category: 'Plate Discipline', decimals: 0, invert: false, pct: true },
  { key: 'avgEVAgainst', label: 'Avg EV against', category: 'Contact Quality', decimals: 1, invert: true, unit: ' mph' },
  { key: 'avgLaunchAgainst', label: 'Avg LA against', category: 'Contact Quality', decimals: 1, invert: true, unit: '°' },
  { key: 'gbPct', label: 'GB%', category: 'Contact Quality', decimals: 0, invert: false, pct: true },
  { key: 'fbPct', label: 'FB%', category: 'Contact Quality', decimals: 0, invert: true, pct: true },
  { key: 'softPct', label: 'Soft%', category: 'Contact Quality', decimals: 0, invert: false, pct: true },
  { key: 'hardPct', label: 'Hard%', category: 'Contact Quality', decimals: 0, invert: true, pct: true },
];

export const HITTER_LEADERBOARD_METRICS = [
  { key: 'runValue', label: 'Run Value', category: 'Expected Outcomes', decimals: 1, invert: false, signed: true },
  { key: 'xBA', label: 'xBA', category: 'Expected Outcomes', decimals: 3, invert: false, stat: true },
  { key: 'xwOBA', label: 'xwOBA', category: 'Expected Outcomes', decimals: 3, invert: false, stat: true },
  { key: 'xSLG', label: 'xSLG', category: 'Expected Outcomes', decimals: 3, invert: false, stat: true },
  { key: 'iso', label: 'ISO', category: 'Expected Outcomes', decimals: 3, invert: false, stat: true },
  { key: 'babip', label: 'BABIP', category: 'Expected Outcomes', decimals: 3, invert: false, stat: true },
  { key: 'avgEV', label: 'Avg EV', category: 'Contact Quality', decimals: 1, invert: false, unit: ' mph' },
  { key: 'ev90', label: 'EV90', category: 'Contact Quality', decimals: 1, invert: false, unit: ' mph' },
  { key: 'maxEV', label: 'Max EV', category: 'Contact Quality', decimals: 1, invert: false, unit: ' mph' },
  { key: 'barrelPct', label: 'Barrel%', category: 'Contact Quality', decimals: 0, invert: false, pct: true },
  { key: 'hardPct', label: 'Hard%', category: 'Contact Quality', decimals: 0, invert: false, pct: true },
  { key: 'softPct', label: 'Soft%', category: 'Contact Quality', decimals: 0, invert: true, pct: true },
  { key: 'launchAngle', label: 'Avg LA', category: 'Batted Ball Profile', decimals: 1, invert: false, unit: '°' },
  { key: 'laAtEv90', label: 'LA @ EV90', category: 'Batted Ball Profile', decimals: 1, invert: false, unit: '°' },
  { key: 'airPullPct', label: 'AirPull%', category: 'Batted Ball Profile', decimals: 0, invert: false, pct: true },
  { key: 'fbPct', label: 'FlyBall%', category: 'Batted Ball Profile', decimals: 0, invert: false, pct: true },
  { key: 'ldPct', label: 'Line Drive%', category: 'Batted Ball Profile', decimals: 0, invert: false, pct: true },
  { key: 'gbPct', label: 'GroundBall%', category: 'Batted Ball Profile', decimals: 0, invert: true, pct: true },
  { key: 'contactPct', label: 'Contact%', category: 'Plate Discipline', decimals: 0, invert: false, pct: true },
  { key: 'twoKContactPct', label: '2KContact%', category: 'Plate Discipline', decimals: 0, invert: false, pct: true },
  { key: 'swingPct', label: 'Swing%', category: 'Plate Discipline', decimals: 0, invert: false, pct: true },
  { key: 'fpSwPct', label: 'FPSw%', category: 'Plate Discipline', decimals: 0, invert: false, pct: true },
  { key: 'kPct', label: 'K%', category: 'Plate Discipline', decimals: 0, invert: true, pct: true },
  { key: 'bbPct', label: 'BB%', category: 'Plate Discipline', decimals: 0, invert: false, pct: true },
];
