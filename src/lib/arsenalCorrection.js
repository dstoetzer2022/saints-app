// ── Similarity-Based Arsenal Correction ──────────────────────────────────────
// Port of UCLA's arsenal_correction.R. Per pitcher, computes centroids
// (velo / IVB / HB / spin) for each canonical pitch type and merges pairs
// whose centroids are within ALL thresholds — i.e. two labels that describe
// the same pitch. The rarer label is relabeled to the more common one.
//
// Applied at SEASON AGGREGATION time (rebuildPitcherSeason) — in-memory only;
// this module never writes to the database. Idempotent: once labels are
// merged, no similar pair remains, so re-running is a no-op.
//
// Manual overrides (coach-reviewed) always beat the heuristic: if a pitcher
// has an entry in MANUAL_ARSENAL_OVERRIDES, ONLY those merges are applied and
// auto-detection is skipped for that pitcher.

import { canonicalNameKey } from '@/lib/statsUtils';
import { canonPitchType } from '@/lib/ds';

export const ARSENAL_CORRECTION_DEFAULTS = {
  veloThreshold: 4,    // mph
  ivbThreshold: 4,     // inches
  hbThreshold: 4,      // inches
  spinThreshold: 400,  // RPM (only enforced when both centroids have spin)
  minCount: 5,         // ignore pitch types rarer than this
  minTotal: 30,        // skip pitchers with fewer total pitches
};

// Coach-reviewed forced merges. Reviewed by Derek 2026-07-12:
// Segovia's "Cutter" is part of his slider cluster, and his "ChangeUp" and
// "Splitter" are the same pitch (a split) — keep the Splitter label.
export const MANUAL_ARSENAL_OVERRIDES = {
  [canonicalNameKey('Segovia, Edwin')]: [
    { from: 'Cutter', to: 'Slider' },
    { from: 'ChangeUp', to: 'Splitter' },
  ],
};

const num = v => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};
const meanOf = arr => {
  const v = arr.filter(x => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

const EXCLUDED_LABELS = new Set(['undefined', 'unknown', 'other', '']);
const isCorrectable = pt => pt && !EXCLUDED_LABELS.has(String(pt).toLowerCase());

// ── Per-pitcher merge detection (auto) ───────────────────────────────────────
// rows: TrackmanPitch rows for ONE pitcher. Returns [{from, to, deltas}].
export function computeMergesForPitcher(rows, opts = {}) {
  const o = { ...ARSENAL_CORRECTION_DEFAULTS, ...opts };
  if (!rows || rows.length < o.minTotal) return [];

  // Centroids per canonical pitch type (alphabetical, matching R's group_by).
  // Undefined/Unknown labels are excluded: they're mixtures of multiple real
  // pitch types, so their centroids are meaningless for similarity merging.
  const byType = {};
  for (const r of rows) {
    const pt = canonPitchType(r.tagged_pitch_type || r.pitch_type);
    if (!isCorrectable(pt)) continue;
    (byType[pt] = byType[pt] || []).push(r);
  }
  const centroids = Object.keys(byType).sort().map(pt => {
    const rs = byType[pt];
    return {
      type: pt,
      count: rs.length,
      velo: meanOf(rs.map(r => num(r.rel_speed))),
      ivb: meanOf(rs.map(r => num(r.induced_vert_break))),
      hb: meanOf(rs.map(r => num(r.horz_break))),
      spin: meanOf(rs.map(r => num(r.spin_rate))),
    };
  }).filter(c =>
    c.count >= o.minCount && c.velo != null && c.ivb != null && c.hb != null
  );

  if (centroids.length < 2) return [];

  const merges = [];
  for (let i = 0; i < centroids.length - 1; i++) {
    for (let j = i + 1; j < centroids.length; j++) {
      const a = centroids[i], b = centroids[j];
      const veloDiff = Math.abs(a.velo - b.velo);
      const ivbDiff = Math.abs(a.ivb - b.ivb);
      const hbDiff = Math.abs(a.hb - b.hb);
      const spinDiff = (a.spin != null && b.spin != null)
        ? Math.abs(a.spin - b.spin) : null;

      const similar3d = veloDiff < o.veloThreshold &&
        ivbDiff < o.ivbThreshold && hbDiff < o.hbThreshold;
      const isSimilar = spinDiff != null
        ? (similar3d && spinDiff < o.spinThreshold)
        : similar3d; // fall back to 3D when spin is null-gated

      if (isSimilar) {
        const [loser, keeper] = a.count > b.count ? [b, a] : [a, b];
        merges.push({
          from: loser.type, to: keeper.type,
          count: loser.count,
          veloDiff, ivbDiff, hbDiff, spinDiff,
        });
      }
    }
  }
  return merges;
}

// Resolve merge chains (A→B, B→C ⇒ A→C) into a flat rename map.
function buildRenameMap(merges) {
  const map = {};
  for (const m of merges) map[m.from] = m.to;
  const resolve = (t, seen = new Set()) => {
    while (map[t] != null && !seen.has(t)) { seen.add(t); t = map[t]; }
    return t;
  };
  const flat = {};
  for (const from of Object.keys(map)) flat[from] = resolve(from);
  return flat;
}

// ── Apply correction to a single pitcher's rows (in-memory) ──────────────────
// Returns { data, changes, merges }. Rows are shallow-copied only when
// relabeled; tagged_pitch_type gets the canonical target label and the
// original label is preserved untouched in pitch_type.
export function applyArsenalCorrection(rows, opts = {}) {
  if (!rows || !rows.length) return { data: rows || [], changes: 0, merges: [] };

  const key = canonicalNameKey(rows[0].pitcher_name || '');
  const override = MANUAL_ARSENAL_OVERRIDES[key];
  // Coach overrides replace auto-detection entirely for that pitcher.
  const merges = override ? override : computeMergesForPitcher(rows, opts);
  if (!merges.length) return { data: rows, changes: 0, merges: [] };

  const rename = buildRenameMap(merges);
  let changes = 0;
  const data = rows.map(r => {
    const pt = canonPitchType(r.tagged_pitch_type || r.pitch_type);
    const to = rename[pt];
    if (to == null || to === pt) return r;
    changes++;
    return { ...r, tagged_pitch_type: to };
  });
  return { data, changes, merges };
}

// ── Pass 2: per-pitch mistag correction ──────────────────────────────────────
// Catches individually mistagged pitches (fat-fingered tags, Trackman
// auto-class errors) via conservative nearest-centroid reassignment.
// A pitch is relabeled ONLY when BOTH are true:
//   1. It is a clear outlier vs its own tagged type (RMS z >= outlierZ), and
//   2. It fits another established type tightly (RMS z <= nearZ).
// Cluster stats are ROBUST (median + scaled MAD, not mean/std): mistagged
// pitches inside a cluster would inflate a std dev enough to hide themselves
// (e.g. fastballs tagged as sliders widen the "slider" spread), but they
// cannot drag a median. MAD * 1.4826 estimates sigma for normal data.
// Types need >= minTypeCount pitches to participate (stable centroids),
// spreads are floored so tight clusters can't inflate z-scores, and pitches
// missing velo/IVB/HB are skipped. Run AFTER applyArsenalCorrection.
export const MISTAG_DEFAULTS = {
  outlierZ: 3.0,       // must be at least this far from own type
  nearZ: 1.5,          // and at least this close to the target type
  sparseNearZ: 1.0,    // tighter bar for the sparse-type fallback below —
                        // no "outlier from own type" double-confirmation
                        // available, so the target match has to be tighter.
  spinVetoZ: 3.0,       // veto reassignment if spin flagrantly contradicts target
  minTypeCount: 10,    // both source and target types need this many pitches
  stdFloors: { velo: 1.5, ivb: 2.0, hb: 2.0, spin: 150 },
};

const METRICS = [
  ['velo', r => num(r.rel_speed)],
  ['ivb', r => num(r.induced_vert_break)],
  ['hb', r => num(r.horz_break)],
];

const medianOf = arr => {
  const s = [...arr].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
};

// Per-type robust stats (median, floored scaled-MAD) for a set of a single
// pitcher's rows. Exported so callers outside the correction pass itself
// (e.g. flagging a curated trail whose frozen physical values no longer fit
// its label) can reuse the EXACT same stats the mistag pass reasons from,
// instead of a parallel reimplementation that could quietly drift from it.
export function buildTypeStats(rows, opts = {}) {
  const o = { ...MISTAG_DEFAULTS, ...opts };
  const byType = {};
  for (const r of rows) {
    const pt = canonPitchType(r.tagged_pitch_type || r.pitch_type);
    if (!isCorrectable(pt)) continue;
    (byType[pt] = byType[pt] || []).push(r);
  }
  const stats = {};
  for (const [pt, rs] of Object.entries(byType)) {
    if (rs.length < o.minTypeCount) continue;
    const s = {};
    let ok = true;
    for (const [k, get] of METRICS) {
      const v = rs.map(get).filter(x => x != null);
      if (v.length < o.minTypeCount) { ok = false; break; }
      const med = medianOf(v);
      const mad = medianOf(v.map(x => Math.abs(x - med))) * 1.4826;
      s[k] = { center: med, spread: Math.max(mad, o.stdFloors[k]) };
    }
    const sv = rs.map(r => num(r.spin_rate)).filter(x => x != null);
    if (ok && sv.length >= o.minTypeCount) {
      const med = medianOf(sv);
      const mad = medianOf(sv.map(x => Math.abs(x - med))) * 1.4826;
      s.spin = { center: med, spread: Math.max(mad, o.stdFloors.spin) };
    }
    if (ok) stats[pt] = s;
  }
  return stats;
}

// RMS z-distance of one pitch (any object with rel_speed/induced_vert_break/
// horz_break) from a single type's stats, as built by buildTypeStats. Returns
// null if the probe is missing any of the three metrics.
export function zDistToType(probe, typeStats) {
  if (!typeStats) return null;
  let sum = 0;
  for (const [k, get] of METRICS) {
    const v = get(probe);
    if (v == null) return null;
    sum += ((v - typeStats[k].center) / typeStats[k].spread) ** 2;
  }
  return Math.sqrt(sum / METRICS.length);
}

export function correctMistaggedPitches(rows, opts = {}) {
  const o = { ...MISTAG_DEFAULTS, ...opts };
  if (!rows || !rows.length) return { data: rows || [], changes: 0, details: [] };

  const stats = buildTypeStats(rows, o);
  const types = Object.keys(stats);
  if (types.length < 2) return { data: rows, changes: 0, details: [] };

  const zDist = (r, s) => zDistToType(r, s);
  const nearestOtherType = (r, exclude) => {
    let best = null, dBest = Infinity;
    for (const t of types) {
      if (t === exclude) continue;
      const d = zDist(r, stats[t]);
      if (d != null && d < dBest) { dBest = d; best = t; }
    }
    return { best, dBest };
  };
  const spinVetoed = (r, targetType) => {
    const spin = num(r.spin_rate);
    const ts = stats[targetType].spin;
    return spin != null && ts && Math.abs(spin - ts.center) / ts.spread > o.spinVetoZ;
  };

  let changes = 0;
  const details = [];
  const data = rows.map(r => {
    const own = canonPitchType(r.tagged_pitch_type || r.pitch_type);

    if (stats[own]) {
      // Standard path: both source and target have >= minTypeCount, so we
      // get the full two-sided check (outlier from own type AND fits a
      // target tightly).
      const dOwn = zDist(r, stats[own]);
      if (dOwn == null || dOwn < o.outlierZ) return r;
      const { best, dBest } = nearestOtherType(r, own);
      if (best == null || dBest > o.nearZ) return r;
      if (spinVetoed(r, best)) return r;
      changes++;
      details.push({ from: own, to: best, zOwn: +dOwn.toFixed(2), zNew: +dBest.toFixed(2),
        velo: num(r.rel_speed), ivb: num(r.induced_vert_break), hb: num(r.horz_break) });
      return { ...r, tagged_pitch_type: best };
    }

    // Sparse-type fallback: `own` didn't clear minTypeCount, so
    // buildTypeStats never gave it robust stats — there simply aren't
    // enough of its own peers to prove this pitch is an outlier among
    // them. Previously that meant these pitches were skipped entirely, no
    // matter how implausible the tag: a handful of one-off mistags parked
    // under a rare/wrong label (or a label the pitcher doesn't actually
    // throw) could never be caught, since the type could never reach 10
    // "real" pitches when most or all of its pitches are mistags to begin
    // with. Instead: check straight against the established types with a
    // TIGHTER bar (sparseNearZ, not nearZ) — we're not getting the normal
    // double-confirmation from the outlier-from-own-type test, so the
    // target fit has to be closer to justify reassignment on its own.
    if (!isCorrectable(own)) return r;
    const { best, dBest } = nearestOtherType(r, own);
    if (best == null || dBest > o.sparseNearZ) return r;
    if (spinVetoed(r, best)) return r;
    changes++;
    details.push({ from: own, to: best, zOwn: null, zNew: +dBest.toFixed(2), sparse: true,
      velo: num(r.rel_speed), ivb: num(r.induced_vert_break), hb: num(r.horz_break) });
    return { ...r, tagged_pitch_type: best };
  });
  return { data, changes, details };
}
