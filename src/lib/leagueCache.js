// ── League pitch cache ────────────────────────────────────────────────────────
// Extracted from PlayerProfile.jsx so it's a single module-level singleton
// shared by every importer. Previously this only existed inside PlayerProfile,
// so the very first profile opened each session had to pay for the full
// paginated league pull before it could render anything. Now HomeScreen can
// call warmLeagueCache() on mount to kick the fetch off in the background —
// by the time someone opens a profile, the cache is usually already warm.
import { base44 } from '@/api/base44Client';
import { fetchAllList } from '@/lib/fetchAll';

let _leagueCache = { rows: null, at: 0, promise: null };
const LEAGUE_TTL_MS = 10 * 60 * 1000;
const LEAGUE_MAX_ROWS = 40000; // safety cap; ~full CCL season of pitch rows

export function getLeaguePitches() {
  const now = Date.now();
  if (_leagueCache.rows && now - _leagueCache.at < LEAGUE_TTL_MS) return Promise.resolve(_leagueCache.rows);
  if (_leagueCache.promise) return _leagueCache.promise;
  _leagueCache.promise = fetchAllList(base44.entities.TrackmanPitch, 'created_date', { max: LEAGUE_MAX_ROWS })
    .then(rows => { _leagueCache = { rows, at: Date.now(), promise: null }; return rows; })
    .catch(() => { _leagueCache.promise = null; return _leagueCache.rows || []; });
  return _leagueCache.promise;
}

// Fire-and-forget warmup — call from HomeScreen on mount. Never throws.
export function warmLeagueCache() {
  getLeaguePitches().catch(() => {});
}
