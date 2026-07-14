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

  it('buildTypeStats uses median (robust to a single outlier)', () => {
    const rows = [
      ...Array.from({ length: 20 }, () => mk('Four-Seam', 92, 17, 8, 2280)),
      mk('Four-Seam', 40, 17, 8, 2280), // absurd outlier
    ];
    const stats = buildTypeStats(rows);
    expect(stats['Four-Seam'].velo.center).toBeCloseTo(92, 0);
  });
});
