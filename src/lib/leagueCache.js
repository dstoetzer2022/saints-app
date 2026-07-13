// ── League pitch cache ────────────────────────────────────────────────────────
// Extracted from PlayerProfile.jsx so it's a single module-level singleton
// shared by every importer. Previously this only existed inside PlayerProfile,
// so the very first profile opened each session had to pay for the full
// paginated league pull before it could render anything. Now HomeScreen can
// call warmLeagueCache() on mount to kick the fetch off in the background —
// by the time someone opens a profile, the cache is usually already warm.
import { base44 } from '@/api/base44Client';
import { fetchAllList } from '@/lib/fetchAll';
import { canonicalNameKey } from '@/lib/statsUtils';
import { applyArsenalCorrection, correctMistaggedPitches } from '@/lib/arsenalCorrection';

let _leagueCache = { rows: null, at: 0, promise: null };
const LEAGUE_TTL_MS = 10 * 60 * 1000;
const LEAGUE_MAX_ROWS = 40000; // safety cap; ~full CCL season of pitch rows

// Runs the SAME two-pass arsenal correction (type-merge, then per-pitch
// mistag) that rebuildPitcherSeason uses for PitcherArsenal — but here,
// applied once centrally so every consumer of getLeaguePitches() sees
// corrected tagged_pitch_type values: movement plots, arsenal tables, count
// splits, and the pitcher/hitter/arsenal percentile pools all read through
// this cache, and previously only the season-aggregate rows benefited from
// correction while raw per-pitch views (like the movement plot) did not.
// In-memory only — never writes to the database, matching that module's
// contract. Grouped by canonicalNameKey so name-variant rows (e.g. "O'Regan,
// Joe" vs "O'Regan, Joseph") get corrected together as one arsenal.

export function getLeaguePitches() {
  const now = Date.now();
  if (_leagueCache.rows && now - _leagueCache.at < LEAGUE_TTL_MS) return Promise.resolve(_leagueCache.rows);
  if (_leagueCache.promise) return _leagueCache.promise;
  _leagueCache.promise = fetchAllList(base44.entities.TrackmanPitch, 'created_date', { max: LEAGUE_MAX_ROWS })
    .then(rows => {
      const corrected = correctLeagueRowsFlat(rows);
      _leagueCache = { rows: corrected, at: Date.now(), promise: null };
      return corrected;
    })
    .catch(() => { _leagueCache.promise = null; return _leagueCache.rows || []; });
  return _leagueCache.promise;
}

// Groups by pitcher, runs both correction passes per group, flattens back to
// the original row order. Rows are shallow-copied only when their
// tagged_pitch_type actually changes (same contract as applyArsenalCorrection
// / correctMistaggedPitches individually) — untouched rows are the same
// object reference, so this is cheap for the common case.
function correctLeagueRowsFlat(rows) {
  const byPitcher = new Map();
  const order = []; // pitcher_name key per row, parallel to `rows`, to reassemble in original order
  for (const r of rows) {
    const key = r.pitcher_name ? canonicalNameKey(r.pitcher_name) : null;
    order.push(key);
    if (key == null) continue;
    if (!byPitcher.has(key)) byPitcher.set(key, []);
    byPitcher.get(key).push(r);
  }

  const correctedGroups = new Map(); // key -> corrected rows array, same order as input group
  for (const [key, group] of byPitcher.entries()) {
    const merged = applyArsenalCorrection(group);
    const { data: corrected } = correctMistaggedPitches(merged.data);
    correctedGroups.set(key, corrected);
  }

  const cursors = new Map(); // key -> next index to pull from that group's corrected array
  return rows.map((r, i) => {
    const key = order[i];
    if (key == null) return r;
    const idx = cursors.get(key) || 0;
    cursors.set(key, idx + 1);
    return correctedGroups.get(key)[idx];
  });
}

// Fire-and-forget warmup — call from HomeScreen on mount. Never throws.
export function warmLeagueCache() {
  getLeaguePitches().catch(() => {});
}
