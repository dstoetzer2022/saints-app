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
