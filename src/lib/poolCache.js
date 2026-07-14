// ── Precomputed league percentile pools (Phase 4.1) ─────────────────────────
// Profiles previously had to block on the full ~40k-row league TrackmanPitch
// pull before they could render a single percentile bar, because the pitcher/
// hitter/arsenal pools are derived from the entire league. This module
// serializes those pools (plus the league movement profile used for the
// movement-plot rings) into ONE small LeaguePool entity row, written at the
// end of a season rebuild. A profile then needs only the player's own rows +
// this row to paint — the league pull still happens, but in the background,
// for name-variant recovery and the Compare tab.
//
// Graceful degradation: until the LeaguePool entity exists (schema pending
// sign-off), loadPools() returns null and every consumer falls back to the
// current behavior of building pools from the league pull. savePools() is a
// no-op-with-warning in the same situation. Nothing here mutates existing
// data — the entity is written only via explicit rebuild.
import { base44 } from '@/api/base44Client';
import { buildPitcherPool, buildHitterPool, buildArsenalPool, leagueMovementProfile } from '@/lib/profileStats';

const POOL_KEY = 'current';

// Round floats to 4 decimals recursively — pools are arrays of long floats
// and rounding cuts the JSON payload roughly in half with no effect on
// percentile ranks at the precision anything in the app displays.
function roundDeep(x) {
  if (typeof x === 'number') return Number.isFinite(x) ? Math.round(x * 1e4) / 1e4 : x;
  if (Array.isArray(x)) return x.map(roundDeep);
  if (x && typeof x === 'object') {
    const out = {};
    for (const k of Object.keys(x)) out[k] = roundDeep(x[k]);
    return out;
  }
  return x;
}

export function buildPoolPayload(leaguePitches) {
  return roundDeep({
    pitcherPool: buildPitcherPool(leaguePitches),
    hitterPool: buildHitterPool(leaguePitches),
    arsenalPool: buildArsenalPool(leaguePitches),
    movement: leagueMovementProfile(leaguePitches),
    rowCount: leaguePitches.length,
    builtAt: new Date().toISOString(),
  });
}

// Upsert the single 'current' row. Returns true on success, false when the
// entity doesn't exist yet or the write fails — callers surface this as a
// status line, never as a thrown error (a failed pool save must not fail a
// rebuild that already succeeded).
export async function savePools(leaguePitches) {
  try {
    const payload = JSON.stringify(buildPoolPayload(leaguePitches));
    const existing = await base44.entities.LeaguePool.filter({ pool_key: POOL_KEY });
    if (existing && existing[0]) {
      await base44.entities.LeaguePool.update(existing[0].id, { payload });
    } else {
      await base44.entities.LeaguePool.create({ pool_key: POOL_KEY, payload });
    }
    return true;
  } catch (err) {
    console.warn('[saints] pool save skipped (LeaguePool entity missing or write failed):', err?.message || err);
    return false;
  }
}

// Load + parse the precomputed pools. Null on ANY failure (entity missing,
// row missing, parse error) so consumers can fall back cleanly.
export async function loadPools() {
  try {
    const rows = await base44.entities.LeaguePool.filter({ pool_key: POOL_KEY });
    if (!rows || !rows[0]?.payload) return null;
    const parsed = JSON.parse(rows[0].payload);
    // Minimal shape validation — a malformed payload must not take down
    // every profile in the app.
    if (!parsed?.pitcherPool || !parsed?.hitterPool || !parsed?.arsenalPool) return null;
    return parsed;
  } catch {
    return null;
  }
}
