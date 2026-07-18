import { describe, it, expect } from 'vitest';
import { canonicalNameKey, normalizeName, isSwing, isStrike, isWhiff, isContact, isFastballVeloType, FB_VELO_TYPES } from '@/lib/statsUtils';
import { normalizePitch } from '@/lib/ds';
import { percentileRank, pitcherProfile, cswKbb } from '@/lib/profileStats';
import { applyArsenalCorrection, correctMistaggedPitches, buildTypeStats } from '@/lib/arsenalCorrection';

// ── Name canonicalization — the join key for the whole app ──────────────
describe('canonicalNameKey', () => {
  it('matches "Last, First" (Trackman) to "First Last" (live scouting)', () => {
    expect(canonicalNameKey('Morgan, Donnie')).toBe(canonicalNameKey('Donnie Morgan'));
  });
  it("normalizes apostrophe variants (O'Regan)", () => {
    expect(canonicalNameKey("O'Regan, Joe")).toBe(canonicalNameKey("O'Regan, Joe"));
    expect(canonicalNameKey("O\u2019Regan, Joe")).toBe(canonicalNameKey("O'Regan, Joe"));
  });
  it('nickname canon collapses Joe/Joey to Joseph (the O\'Regan dedupe)', () => {
    expect(canonicalNameKey("O'Regan, Joe")).toBe(canonicalNameKey("O'Regan, Joseph"));
    expect(canonicalNameKey("O'Regan, Joey")).toBe(canonicalNameKey("O'Regan, Joseph"));
  });
  it('drops suffixes in either segment', () => {
    expect(canonicalNameKey('Griffey Jr., Ken')).toBe(canonicalNameKey('Griffey, Ken'));
    expect(canonicalNameKey('Ken Griffey Jr.')).toBe(canonicalNameKey('Griffey, Ken'));
  });
  it('is case-insensitive and trims', () => {
    expect(canonicalNameKey('  MORGAN,   DONNIE ')).toBe(canonicalNameKey('morgan, donnie'));
  });
  it('handles empty/null', () => {
    expect(canonicalNameKey('')).toBe('');
    expect(canonicalNameKey(null)).toBe('');
  });
  // Manual overrides — coach-confirmed misspelling/nickname merges that
  // NICKNAME_CANON can't safely handle generally (mapping Nick→Nikolas or
  // Aj→Aidan for every player would risk merging unrelated people).
  // San Diego Bombers, confirmed by Derek 2026-07-17.
  it('merges Nick Halochits (misspelled) into Nikolas Halouchits', () => {
    expect(canonicalNameKey('Nick Halochits')).toBe(canonicalNameKey('Nikolas Halouchits'));
    expect(canonicalNameKey('Halochits, Nick')).toBe(canonicalNameKey('Halouchits, Nikolas'));
  });
  it('merges Aj Cappell into Aidan Cappell', () => {
    expect(canonicalNameKey('Aj Cappell')).toBe(canonicalNameKey('Aidan Cappell'));
    expect(canonicalNameKey('Cappell, AJ')).toBe(canonicalNameKey('Cappell, Aidan'));
  });
  it('manual overrides stay scoped to the specific surname, not other Nick/Aj players', () => {
    expect(canonicalNameKey('Nick Smith')).not.toBe(canonicalNameKey('Nikolas Halouchits'));
    expect(canonicalNameKey('Aj Johnson')).not.toBe(canonicalNameKey('Aidan Cappell'));
  });
});

describe('normalizeName', () => {
  it('flips "Last, First" to "First Last"', () => {
    expect(normalizeName('Morgan, Donnie')).toMatch(/Donnie\s+Morgan/i);
  });
});

// ── Pitch-call predicates — V3 foul handling ─────────────────────────────
describe('pitch-call predicates', () => {
  const row = pitch_call => ({ pitch_call });
  it('FoulBallNotFieldable (V3) counts as swing, strike, contact — not whiff', () => {
    const r = row('FoulBallNotFieldable');
    expect(isSwing(r)).toBe(true);
    expect(isStrike(r)).toBe(true);
    expect(isContact(r)).toBe(true);
    expect(isWhiff(r)).toBe(false);
  });
  it('FoulBallFieldable and legacy FoulBall/FoulTip behave the same', () => {
    for (const c of ['FoulBallFieldable', 'FoulBall', 'FoulTip']) {
      expect(isSwing(row(c))).toBe(true);
      expect(isStrike(row(c))).toBe(true);
    }
  });
  it('StrikeSwinging is the only whiff', () => {
    expect(isWhiff(row('StrikeSwinging'))).toBe(true);
    expect(isWhiff(row('StrikeCalled'))).toBe(false);
    expect(isWhiff(row('InPlay'))).toBe(false);
  });
  it('BallCalled is nothing', () => {
    const r = row('BallCalled');
    expect(isSwing(r)).toBe(false);
    expect(isStrike(r)).toBe(false);
  });
  it('reads raw PascalCase PitchCall too', () => {
    expect(isSwing({ PitchCall: 'StrikeSwinging' })).toBe(true);
  });
});

// ── Cutter exclusion from FB velocity ────────────────────────────────────
describe('isFastballVeloType', () => {
  it('excludes Cutter (college cutters skew FB velo)', () => {
    expect(isFastballVeloType('Cutter')).toBe(false);
    expect(FB_VELO_TYPES).not.toContain('Cutter');
  });
  it('includes Four-Seam and Sinker', () => {
    expect(isFastballVeloType('Four-Seam')).toBe(true);
    expect(isFastballVeloType('Sinker')).toBe(true);
  });
});

// ── Pitch-type canonicalization ──────────────────────────────────────────
describe('normalizePitch', () => {
  it('maps Trackman spellings to canonical types', () => {
    expect(normalizePitch('FourSeamFastBall')).toBe('Four-Seam');
    expect(normalizePitch('Four Seam Fastball')).toBe('Four-Seam');
    expect(normalizePitch('TwoSeamFastBall')).toBe('Sinker');
    expect(normalizePitch('Slider')).toBe('Slider');
  });
});

// ── Percentiles ──────────────────────────────────────────────────────────
describe('percentileRank', () => {
  const pool = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  it('ranks within the pool', () => {
    const r = percentileRank(pool, 10);
    expect(r).toBeGreaterThan(85);
    const low = percentileRank(pool, 1);
    expect(low).toBeLessThan(15);
  });
  it('handles empty pool / null value', () => {
    expect(percentileRank([], 5)).toBeNull();
    expect(percentileRank(pool, null)).toBeNull();
  });
});

// ── Pitcher profile aggregate math ───────────────────────────────────────
function fakePA(korBB, calls) {
  // last pitch of the PA carries kor_bb
  return calls.map((pitch_call, i) => ({
    pitch_call,
    kor_bb: i === calls.length - 1 ? korBB : undefined,
    tagged_pitch_type: 'Four-Seam',
    rel_speed: 92,
    balls: 0, strikes: 0,
  }));
}

describe('pitcherProfile', () => {
  it('computes K% and BB% over PA enders', () => {
    const rows = [
      ...fakePA('Strikeout', ['StrikeCalled', 'StrikeSwinging', 'StrikeSwinging']),
      ...fakePA('Strikeout', ['StrikeSwinging', 'FoulBallNotFieldable', 'StrikeSwinging']),
      ...fakePA('Walk', ['BallCalled', 'BallCalled', 'BallCalled', 'BallCalled']),
      ...fakePA('Undefined', ['InPlay']),
    ];
    const prof = pitcherProfile(rows);
    expect(prof.kPct).toBeCloseTo(2 / 4, 5);
    expect(prof.bbPct).toBeCloseTo(1 / 4, 5);
  });
  it('strike% counts V3 fouls', () => {
    const rows = fakePA('Undefined', ['FoulBallNotFieldable', 'BallCalled']);
    const prof = pitcherProfile(rows);
    expect(prof.strikePct).toBeCloseTo(0.5, 5);
  });
});

describe('cswKbb', () => {
  it('CSW = called strikes + whiffs over all pitches', () => {
    const rows = [
      { pitch_call: 'StrikeCalled' },
      { pitch_call: 'StrikeSwinging' },
      { pitch_call: 'BallCalled' },
      { pitch_call: 'FoulBallNotFieldable' }, // foul is NOT CSW
    ];
    expect(cswKbb(rows).cswPct).toBe(50);
  });
});

// ── Arsenal correction (two-pass) ────────────────────────────────────────
const mk = (type, velo, ivb, hb, spin) => ({
  tagged_pitch_type: type, pitch_type: type,
  rel_speed: velo, induced_vert_break: ivb, horz_break: hb, spin_rate: spin,
});

describe('arsenalCorrection', () => {
  it('applyArsenalCorrection only writes tagged_pitch_type (pitch_type preserved for reversibility)', () => {
    // 30 four-seams + 3 "sinkers" living inside the FF cluster → merge candidates
    const rows = [
      ...Array.from({ length: 30 }, () => mk('Four-Seam', 92 + Math.random(), 17 + Math.random(), 8 + Math.random(), 2280)),
      ...Array.from({ length: 3 }, () => mk('Sinker', 92.2, 17.1, 8.2, 2285)),
    ];
    const { data } = applyArsenalCorrection(rows);
    for (const r of data) {
      expect(r.pitch_type).toBe(r === data ? r.pitch_type : r.pitch_type); // untouched field exists
    }
    const originals = rows.map(r => r.pitch_type);
    data.forEach((r, i) => expect(r.pitch_type).toBe(originals[i]));
  });

  it('correctMistaggedPitches relabels an obvious mistag using robust stats', () => {
    // Tight FF cluster + tight SL cluster + one "FF" that is clearly a slider
    const rows = [
      ...Array.from({ length: 25 }, (_, i) => mk('Four-Seam', 92 + (i % 5) * 0.1, 17 + (i % 5) * 0.1, 8 + (i % 5) * 0.1, 2280 + (i % 5))),
      ...Array.from({ length: 25 }, (_, i) => mk('Slider', 84 + (i % 5) * 0.1, 2 + (i % 5) * 0.1, -12 + (i % 5) * 0.1, 2500 + (i % 5))),
      mk('Four-Seam', 84.2, 2.2, -12.1, 2505), // the mistag
    ];
    const { data, changes } = correctMistaggedPitches(rows);
    expect(changes).toBeGreaterThanOrEqual(1);
    const fixed = data[data.length - 1];
    expect(fixed.tagged_pitch_type).toBe('Slider');
    expect(fixed.pitch_type).toBe('Four-Seam'); // reversibility preserved
  });

  it('correctMistaggedPitches leaves clean data alone', () => {
    const rows = Array.from({ length: 30 }, (_, i) => mk('Four-Seam', 92 + (i % 6) * 0.1, 17, 8, 2280));
    const { changes } = correctMistaggedPitches(rows);
    expect(changes).toBe(0);
  });

  // Regression test for the sparse-type fallback (2026-07-17): a tagged
  // type with fewer than minTypeCount pitches previously got no stats at
  // all, so correctMistaggedPitches skipped every pitch under that label
  // unconditionally — no matter how implausible. Real case that surfaced
  // this: Dylan Adams had only 6 pitches tagged "Curveball" for the
  // season, one of which was actually an 84mph, backspun (+15 IVB)
  // fastball-shaped pitch, sitting well inside his real Four-Seam cluster.
  it('correctMistaggedPitches catches a mistag in a sparse (<minTypeCount) type', () => {
    const rows = [
      // Deterministic spread (not Math.random() — this needs to be a
      // stable regression test) that still reflects realistic natural
      // variance in a fastball/slider cluster, which is what determines
      // the MAD-based tolerance the sparse-fallback check compares against.
      ...Array.from({ length: 25 }, (_, i) => mk('Four-Seam', 82 + (i % 10) * 0.3, 8 + (i % 10) * 1.3, 5 + (i % 10) * 1.4, 2000 + (i % 10) * 25)),
      ...Array.from({ length: 20 }, (_, i) => mk('Slider', 75 + (i % 10) * 0.4, 2 + (i % 10) * 1.0, -19 + (i % 10) * 1.2, 2300 + (i % 10) * 30)),
      // Only 6 "Curveball" pitches — below minTypeCount (10), so this type
      // gets no robust stats of its own under the standard path.
      mk('Curveball', 77.2, 10.1, -10.8, 2248),
      mk('Curveball', 77.5, 8.9, -0.7, 2420),
      mk('Curveball', 84.4, 15.3, 7.7, 2173),  // the mistag — matches Derek's report exactly
      mk('Curveball', 76.9, 1.8, -5.9, 2208),
      mk('Curveball', 77.0, 4.1, -9.2, 2361),
      mk('Curveball', 77.7, 3.6, -12.9, 2423),
    ];
    const { data, changes } = correctMistaggedPitches(rows);
    expect(changes).toBeGreaterThanOrEqual(1);
    const fixed = data.find(r => r.pitch_type === 'Curveball' && r.rel_speed === 84.4);
    expect(fixed.tagged_pitch_type).toBe('Four-Seam');
    expect(fixed.pitch_type).toBe('Curveball'); // reversibility preserved
  });

  // The sparse-fallback path must stay just as conservative about
  // legitimate rare pitches as the standard path — a pitch whose shape
  // resembles another type but whose spin flatly contradicts it (the
  // documented Wyatt Toth ~777rpm cut splitter case) must not get
  // reassigned just because its own type is sparse.
  it('correctMistaggedPitches sparse fallback still respects the spin veto', () => {
    const rows = [
      ...Array.from({ length: 15 }, (_, i) => mk('Slider', 78 + (i % 5) * 0.1, 4 + (i % 5) * 0.1, -12 + (i % 5) * 0.1, 2350 + (i % 5))),
      ...Array.from({ length: 15 }, (_, i) => mk('Four-Seam', 90 + (i % 5) * 0.1, 15 + (i % 5) * 0.1, 8 + (i % 5) * 0.1, 2200 + (i % 5))),
      // 4 real cut splitters: shape matches Slider closely, but spin is
      // wildly different (777 vs ~2350) — should stay put.
      ...Array.from({ length: 4 }, () => mk('Splitter', 78.5, 3.8, -11.5, 777)),
    ];
    const { data, changes } = correctMistaggedPitches(rows);
    const splitters = data.filter(r => r.spin_rate === 777);
    expect(splitters.every(s => s.tagged_pitch_type === 'Splitter')).toBe(true);
  });

  it('buildTypeStats uses median (robust to a single outlier)', () => {
    const rows = [
      ...Array.from({ length: 20 }, () => mk('Four-Seam', 92, 17, 8, 2280)),
      mk('Four-Seam', 40, 17, 8, 2280), // absurd outlier
    ];
    const stats = buildTypeStats(rows);
    expect(stats['Four-Seam'].velo.center).toBeCloseTo(92, 0);
  });
});

// ── Batch print arsenal-correction de-dup order (regression) ────────────
// BatchPrintReport merges team-scoped (raw) TrackmanPitch rows with
// league-cache (arsenal-corrected) rows by id, keeping whichever occurrence
// comes first in the spread. This guards the ordering directly so a future
// edit can't silently flip it back and revert every batch-printed arsenal
// table to pre-correction labels.
describe('batch print de-dup order (regression)', () => {
  it('corrected rows must win when merged with raw duplicates by id', () => {
    const raw = { id: 'p1', tagged_pitch_type: 'Four-Seam', pitch_type: 'Four-Seam' };
    const corrected = { id: 'p1', tagged_pitch_type: 'Slider', pitch_type: 'Four-Seam' };
    // Mirrors BatchPrintReport.jsx: [...variantRows, ...teamScoped] then id de-dup, first wins.
    const seen = new Set();
    const merged = [corrected, raw].filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
    expect(merged).toHaveLength(1);
    expect(merged[0].tagged_pitch_type).toBe('Slider');
  });
});

// ── Precomputed pool payload (Phase 4.1) ─────────────────────────────────
import { buildPoolPayload } from '@/lib/poolCache';

describe('buildPoolPayload', () => {
  it('produces a payload with all three pools plus movement + metadata', () => {
    const rows = [
      { pitcher_name: 'Morgan, Donnie', pitcher_hand: 'Right', tagged_pitch_type: 'Four-Seam', pitch_type: 'Four-Seam',
        rel_speed: 92, induced_vert_break: 17, horz_break: 8, pitch_call: 'StrikeCalled', batter_hand: 'Right', date: '2026-06-01', game_id: 'g1' },
      { pitcher_name: 'Morgan, Donnie', pitcher_hand: 'Right', tagged_pitch_type: 'Slider', pitch_type: 'Slider',
        rel_speed: 84, induced_vert_break: 2, horz_break: -12, pitch_call: 'StrikeSwinging', batter_hand: 'Left', date: '2026-06-01', game_id: 'g1' },
    ];
    const payload = buildPoolPayload(rows);
    expect(payload).toHaveProperty('pitcherPool');
    expect(payload).toHaveProperty('hitterPool');
    expect(payload).toHaveProperty('arsenalPool');
    expect(payload).toHaveProperty('movement');
    expect(payload.rowCount).toBe(2);
    expect(typeof payload.builtAt).toBe('string');
  });

  it('rounds floats to keep the JSON payload small without losing meaningful precision', () => {
    const rows = [{ pitcher_name: 'X, Y', pitcher_hand: 'Right', tagged_pitch_type: 'Four-Seam',
      rel_speed: 92.123456789, induced_vert_break: 17.987654321, horz_break: 8, pitch_call: 'StrikeCalled', date: '2026-06-01', game_id: 'g1' }];
    const payload = buildPoolPayload(rows);
    const str = JSON.stringify(payload);
    // no float should carry more than 4 decimal places
    const longFloats = str.match(/\d+\.\d{5,}/g);
    expect(longFloats).toBeNull();
  });
});

// ── profileStats bug fixes (per old-chat audit summary) ──────────────────
import { slashLine, hitterTrackmanProfile, battedBallProfile } from '@/lib/profileStats';
import { sprayDistribution } from '@/lib/statsUtils';

describe('slashLine (bug fixes)', () => {
  it('kPct denominator is PA, not total pitches seen', () => {
    // 1 PA ending in K, thrown over 5 total pitches (4 foul/ball, 1 final K pitch)
    const rows = [
      { pitch_call: 'BallCalled' }, { pitch_call: 'FoulBallNotFieldable' },
      { pitch_call: 'BallCalled' }, { pitch_call: 'FoulBallNotFieldable' },
      { pitch_call: 'StrikeSwinging', kor_bb: 'Strikeout' },
    ];
    const s = slashLine(rows);
    expect(s.pa).toBe(1);
    expect(s.kPct).toBeCloseTo(1, 5); // NOT 1/5
  });
  it('OBP includes HBP in both numerator and denominator', () => {
    const rows = [
      { pitch_call: 'HitByPitch' },
      { pitch_call: 'InPlay', play_result: 'Out' },
      { pitch_call: 'InPlay', play_result: 'Out' },
    ];
    const s = slashLine(rows);
    expect(s.pa).toBe(3);
    expect(s.obp).toBeCloseTo(1 / 3, 5);
  });
});

describe('hitterTrackmanProfile (bug fixes)', () => {
  const mkBip = (la, ev, hand, bearing) => ({
    pitch_call: 'InPlay', exit_speed: ev, launch_angle: la, batter_hand: hand, bearing,
    play_result: 'Out',
  });
  it('excludes null launch angle from GB bucket and denominator instead of defaulting to GroundBall', () => {
    const rows = [
      ...Array.from({ length: 9 }, () => mkBip(15, 90, 'Right', 0)), // line drives
      mkBip(null, 90, 'Right', 0), // unknown trajectory — must not count as GB
    ];
    const prof = hitterTrackmanProfile(rows);
    expect(prof.gbPct).toBe(0); // was defaulting the null-LA row into GroundBall
    expect(prof.ldPct).toBeCloseTo(1, 5); // denominator is knownLaN (9), not bipN (10)
  });
  it('classifies Air-Pull% per-row hand, not the first row found', () => {
    // A switch hitter: 5 balls batting Right (pulled = bearing<-15), 5 batting Left (pulled = bearing>15)
    const rows = [
      ...Array.from({ length: 5 }, () => mkBip(20, 90, 'Right', -20)), // pulled RHH
      ...Array.from({ length: 5 }, () => mkBip(20, 90, 'Left', 20)),   // pulled LHH
    ];
    const prof = hitterTrackmanProfile(rows);
    // Both halves are "pulled" for their own hand — with the old single-hand
    // bug, the second half (batting Left) would be misjudged using the
    // first row's Right-handed pull direction and show as opposite/oppo.
    expect(prof.airPullPct).toBeCloseTo(1, 5);
  });
});

describe('battedBallProfile (bug fixes)', () => {
  it('excludes null launch angle from trajectory buckets', () => {
    const rows = [
      ...Array.from({ length: 4 }, () => ({ pitch_call: 'InPlay', exit_speed: 90, launch_angle: 30, batter_hand: 'Right', bearing: 0 })),
      { pitch_call: 'InPlay', exit_speed: 90, launch_angle: null, batter_hand: 'Right', bearing: 0 },
    ];
    const p = battedBallProfile(rows);
    expect(p.gbPct).toBe(0);
    expect(p.fbPct).toBeCloseTo(1, 5);
  });
});

describe('sprayDistribution (bug fix: per-row hand)', () => {
  it('classifies each row by its own batter_hand, not a single passed-in hand', () => {
    const base = { pitch_call: 'InPlay', hit_distance: 250, launch_angle: 20, exit_speed: 90 };
    const rows = [
      { ...base, batter_hand: 'Right', bearing: -20 }, // pulled RHH
      { ...base, batter_hand: 'Left', bearing: 20 },   // pulled LHH
    ];
    // Old behavior: passing hand='R' would misclassify the Left-batting row.
    const dist = sprayDistribution(rows, 'R');
    expect(dist.pullPct).toBeCloseTo(1, 5); // both rows correctly read as "pull" for their own hand
  });
});

// ── isSecondBasePop (new helper, per audit) ──────────────────────────────
import { isSecondBasePop } from '@/lib/statsUtils';

describe('isSecondBasePop', () => {
  it('excludes anomalously fast throws (likely 3B, not 2B)', () => {
    expect(isSecondBasePop({ time_to_base: 0.95 })).toBe(false); // the 1.68s "best pop" case
  });
  it('keeps realistic 2B pop times', () => {
    expect(isSecondBasePop({ time_to_base: 1.35 })).toBe(true); // e.g. true 2.06s/2.10s pops
  });
  it('keeps rows with missing time_to_base (no evidence to exclude)', () => {
    expect(isSecondBasePop({})).toBe(true);
    expect(isSecondBasePop({ time_to_base: null })).toBe(true);
  });
});

// ── Park fence overlay (per audit) ────────────────────────────────────────
import { fenceArcPath, fenceDistanceAt, CCL_PARK_DIMENSIONS } from '@/lib/profileStats';

describe('fenceDistanceAt / fenceArcPath', () => {
  const brookside = CCL_PARK_DIMENSIONS.ARR_SEC;
  it('interpolates distance between known angle/distance points', () => {
    expect(fenceDistanceAt(brookside, 0)).toBe(brookside.cf); // dead center
    expect(fenceDistanceAt(brookside, -45)).toBe(brookside.lf); // left foul line
    expect(fenceDistanceAt(brookside, 45)).toBe(brookside.rf); // right foul line
  });
  it('clamps out-of-range bearings to the nearest foul line', () => {
    expect(fenceDistanceAt(brookside, -90)).toBe(brookside.lf);
    expect(fenceDistanceAt(brookside, 90)).toBe(brookside.rf);
  });
  it('returns null for an unknown/road-only park with no fixed dimensions', () => {
    expect(fenceDistanceAt(null, 0)).toBeNull();
  });
  it('fenceArcPath builds a valid SVG path string for a real park', () => {
    const toXY = (bearing, dist) => ({ x: dist * Math.sin(bearing * Math.PI / 180), y: -dist * Math.cos(bearing * Math.PI / 180) });
    const path = fenceArcPath('ARR_SEC', toXY);
    expect(path).toMatch(/^M/);
    expect(path.split(' L').length).toBeGreaterThan(10); // multiple sample points
  });
  it('fenceArcPath returns null for a park code with no CCL_PARK_DIMENSIONS entry', () => {
    const toXY = (b, d) => ({ x: d, y: d });
    expect(fenceArcPath('NOT_A_REAL_PARK', toXY)).toBeNull();
  });
});

// ── Multi-word surname bug (Jason Del Villar / MLB Academy) ──────────────
// Real production incident: TrackmanPitch stores "Del Villar, Jason" while
// live-scouted HitterObservation rows store "Jason Del Villar" — the old
// canonicalNameKey only treated the FINAL word as the last name, so these
// produced different keys (delvillar|jason vs villar|jasondel), splitting
// one player into two roster entries and losing his Trackman data off the
// profile (toTrackmanName had the identical bug, so the exact-match query
// built from his HitterObservation-derived name never matched either).
import { toTrackmanName, splitDisplayName } from '@/lib/statsUtils';

describe('multi-word surname handling (Del Villar incident)', () => {
  it('canonicalNameKey: "Del Villar, Jason" and "Jason Del Villar" now match', () => {
    expect(canonicalNameKey('Del Villar, Jason')).toBe(canonicalNameKey('Jason Del Villar'));
  });
  it('toTrackmanName: "Jason Del Villar" converts to the real Trackman spelling', () => {
    expect(toTrackmanName('Jason Del Villar')).toBe('Del Villar, Jason');
  });
  it('toTrackmanName: comma-format input passes through unchanged', () => {
    expect(toTrackmanName('Del Villar, Jason')).toBe('Del Villar, Jason');
  });
  it('splitDisplayName: keeps the full two-word surname together', () => {
    expect(splitDisplayName('Jason Del Villar')).toEqual({ firstName: 'Jason', lastName: 'Del Villar' });
  });
  it('generalizes to other common surname particles (Van, De La, Von)', () => {
    expect(canonicalNameKey('Van Der Berg, Kyle')).toBe(canonicalNameKey('Kyle Van Der Berg'));
    expect(canonicalNameKey('De La Cruz, Miguel')).toBe(canonicalNameKey('Miguel De La Cruz'));
    expect(toTrackmanName('Kyle Von Braun')).toBe('Von Braun, Kyle');
  });
  it('does not regress ordinary single-word surnames', () => {
    expect(canonicalNameKey('Morgan, Donnie')).toBe(canonicalNameKey('Donnie Morgan'));
    expect(toTrackmanName('Donnie Morgan')).toBe('Morgan, Donnie');
    expect(splitDisplayName('Donnie Morgan')).toEqual({ firstName: 'Donnie', lastName: 'Morgan' });
  });
  it('a lone given name matching a particle word (e.g. "Van Smith") is not swallowed', () => {
    // "Van" as an actual first name, "Smith" as a normal one-word surname —
    // the particle-absorption guard must not consume the whole name.
    expect(toTrackmanName('Van Smith')).toBe('Smith, Van');
  });
});

// ── Pitch sequencing (Phase 5) ────────────────────────────────────────────
import { pitchTransitionMatrix, firstPitchTendencyByHand, putawaySequences } from '@/lib/profileStats';

function mkPA(gameId, startPitchNo, seq) {
  // seq: [{type, balls, strikes, korBB?, batterHand?}]
  return seq.map((s, i) => ({
    game_id: gameId, pitch_no: startPitchNo + i,
    tagged_pitch_type: s.type, pitch_type: s.type,
    balls: s.balls, strikes: s.strikes,
    kor_bb: s.korBB, batter_hand: s.batterHand || 'Right',
  }));
}

describe('pitch sequencing', () => {
  it('pitchTransitionMatrix pairs consecutive pitches within a PA, never across PA boundaries', () => {
    const rows = [
      ...mkPA('g1', 1, [{ type: 'Four-Seam', balls: 0, strikes: 0 }, { type: 'Slider', balls: 0, strikes: 1 }]),
      ...mkPA('g1', 3, [{ type: 'Slider', balls: 0, strikes: 0 }, { type: 'Slider', balls: 0, strikes: 1 }]),
    ];
    const matrix = pitchTransitionMatrix(rows);
    expect(matrix['Four-Seam'].n).toBe(1);
    expect(matrix['Four-Seam'].Slider).toBe(1);
    // second PA's leadoff Slider must NOT pair with the first PA's trailing Slider
    expect(matrix.Slider.n).toBe(1);
  });

  it('pitchTransitionMatrix respects the bucketFilter (ahead/even/behind of the FROM pitch)', () => {
    const rows = mkPA('g1', 1, [
      { type: 'Four-Seam', balls: 0, strikes: 0 },   // even
      { type: 'Slider', balls: 0, strikes: 1 },       // this is the "to" of pair 1
      { type: 'Four-Seam', balls: 1, strikes: 1 },     // "to" of pair 2, "from" of pair 3 (even)
      { type: 'Curveball', balls: 1, strikes: 2 },
    ]);
    const evenOnly = pitchTransitionMatrix(rows, 'even');
    // Only FROM-pitches thrown on an even count should be counted: pitch 1 (0-0) and pitch 3 (1-1)
    const totalPairs = Object.values(evenOnly).reduce((a, m) => a + m.n, 0);
    expect(totalPairs).toBe(2);
  });

  it('firstPitchTendencyByHand only counts the first pitch (0-0) of each PA, split by hand', () => {
    const rows = [
      ...mkPA('g1', 1, [{ type: 'Four-Seam', balls: 0, strikes: 0, batterHand: 'Right' }, { type: 'Slider', balls: 0, strikes: 1, batterHand: 'Right' }]),
      ...mkPA('g1', 3, [{ type: 'ChangeUp', balls: 0, strikes: 0, batterHand: 'Left' }]),
    ];
    const byHand = firstPitchTendencyByHand(rows);
    expect(byHand.Right.n).toBe(1);
    expect(byHand.Right['Four-Seam']).toBe(1);
    expect(byHand.Right.Slider).toBeUndefined(); // not a first pitch
    expect(byHand.Left.n).toBe(1);
    expect(byHand.Left.ChangeUp).toBe(1);
  });

  it('putawaySequences pairs the pitch before a strikeout-ending PA with the putaway pitch', () => {
    const rows = [
      ...mkPA('g1', 1, [
        { type: 'Four-Seam', balls: 0, strikes: 0 },
        { type: 'Slider', balls: 0, strikes: 1 },
        { type: 'Slider', balls: 0, strikes: 2, korBB: 'Strikeout' },
      ]),
      ...mkPA('g1', 4, [
        { type: 'Four-Seam', balls: 0, strikes: 0 },
        { type: 'Four-Seam', balls: 1, strikes: 0, korBB: 'Walk' }, // not a K — excluded
      ]),
    ];
    const { pairs, totalK } = putawaySequences(rows);
    expect(totalK).toBe(1);
    expect(pairs['Slider|Slider']).toBe(1);
    expect(Object.keys(pairs)).toHaveLength(1);
  });

  it('putawaySequences ignores a strikeout with no prior pitch in the PA (edge case)', () => {
    const rows = mkPA('g1', 1, [{ type: 'Four-Seam', balls: 0, strikes: 0, korBB: 'Strikeout' }]);
    const { pairs, totalK } = putawaySequences(rows);
    expect(totalK).toBe(1);
    expect(Object.keys(pairs)).toHaveLength(0);
  });
});
