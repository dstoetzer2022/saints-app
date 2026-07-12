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
