// Stats utility functions

// Replace curly/smart apostrophes and other single-quote variants with a
// straight apostrophe so "O'Regan" (U+2019) and "O'Regan" (U+0027) compare equal.
function normalizeApostrophe(s) {
  return s ? s.replace(/[\u2018\u2019\u02BC\u0060\u00B4]/g, "'") : s;
}

// Normalize pitcher name from "Last, First" (Trackman) or "First Last" to canonical "First Last".
// Used for DISPLAY. Apostrophe variants are folded to straight apostrophes so the
// rendered name is stable, but punctuation/casing are otherwise preserved.
export function normalizeName(name) {
  if (!name) return '';
  const trimmed = normalizeApostrophe(name.trim());
  if (trimmed.includes(',')) {
    const [last, first] = trimmed.split(',').map(s => s.trim());
    return `${first} ${last}`;
  }
  return trimmed;
}

// ── Nickname aliasing ─────────────────────────────────────────────────────────
// Maps common nickname → canonical given name so "Joe O'Regan" and
// "Joseph O'Regan" resolve to the same roster entry. Bidirectional pairs are
// expanded automatically; the VALUE side is the form every key normalizes to.
// Add new pairs here as you discover them in your data.
const NICKNAME_CANON = {
  joe: 'joseph', joey: 'joseph',
  mike: 'michael', mikey: 'michael',
  matt: 'matthew', matty: 'matthew',
  alex: 'alexander', xander: 'alexander',
  nick: 'nicholas',
  chris: 'christopher',
  tom: 'thomas', tommy: 'thomas',
  jake: 'jacob',
  zach: 'zachary', zack: 'zachary',
  will: 'william', bill: 'william', billy: 'william', willy: 'william',
  rob: 'robert', bob: 'robert', bobby: 'robert', robbie: 'robert',
  dan: 'daniel', danny: 'daniel',
  dave: 'david',
  jim: 'james', jimmy: 'james', jamie: 'james',
  ben: 'benjamin',
  sam: 'samuel', sammy: 'samuel',
  tony: 'anthony',
  charlie: 'charles', chuck: 'charles',
  ed: 'edward', eddie: 'edward',
  jon: 'jonathan', johnny: 'jonathan',
  josh: 'joshua',
  andy: 'andrew', drew: 'andrew',
  tim: 'timothy', timmy: 'timothy',
  greg: 'gregory',
  steve: 'steven', stevie: 'steven',
  pat: 'patrick',
  raf: 'rafael', rafa: 'rafael',
  gabe: 'gabriel',
  cal: 'calvin',
  nate: 'nathan',
  // AUDIT: removed nathaniel→nathan (distinct given names — merging them could
  // collapse two different players) and the isaac→isaac no-op.
};

// Generational suffixes are not last names. Without this, "Ken Griffey Jr."
// keyed as jr|kengriffey and two suffixed players could collide on "jr".
const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v', 'jr.', 'sr.']);


function canonFirst(first) {
  if (!first) return '';
  const f = first.toLowerCase();
  return NICKNAME_CANON[f] || f;
}

// Canonical dedup key: collapses "Last, First" vs "First Last", case,
// apostrophe variants, internal whitespace, diacritics, AND nicknames.
// Two strings referring to the same person produce the same key.
// Use this — not normalizeName().toLowerCase() — whenever grouping players.
export function canonicalNameKey(name) {
  if (!name) return '';
  let s = normalizeApostrophe(name.trim());
  // Split into first / last regardless of input order
  let first, last;
  if (s.includes(',')) {
    let [l, f] = s.split(',').map(p => p.trim());
    // Suffix may ride with either segment: "Griffey, Ken Jr." or "Griffey Jr., Ken"
    const dropTrailing = seg => {
      let ps = (seg || '').split(/\s+/).filter(Boolean);
      // a lone suffix token means the suffix WAS the whole segment ("Jr.") — drop it
      while (ps.length && SUFFIXES.has(ps[ps.length - 1].toLowerCase().replace(/\./g, ''))) {
        if (ps.length === 1 && !SUFFIXES.has(ps[0].toLowerCase().replace(/\./g, ''))) break;
        ps = ps.slice(0, -1);
      }
      return ps.join(' ');
    };
    last = dropTrailing(l); first = dropTrailing(f);
  } else {
    let parts = s.split(/\s+/).filter(Boolean);
    while (parts.length > 2 && SUFFIXES.has(parts[parts.length - 1].toLowerCase().replace(/\./g, ''))) {
      parts = parts.slice(0, -1);
    }
    if (parts.length < 2) {
      // single token — key on it alone
      return scrub(parts[0] || '');
    }
    last = parts[parts.length - 1];
    first = parts.slice(0, -1).join(' ');
  }
  return `${scrub(last)}|${scrub(canonFirst(first))}`;
}

// Strip diacritics, punctuation, and spaces; lowercase. "O'Regan" → "oregan".
function scrub(s) {
  if (!s) return '';
  return s
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');                        // drop apostrophes, hyphens, spaces
}

// Case-insensitive name match after canonicalizing both sides.
export function namesMatch(a, b) {
  return canonicalNameKey(a) === canonicalNameKey(b);
}

// Normalize any handedness representation ('R', 'L', 'S', 'Right', 'Left',
// 'Switch', 'RHB', 'LHB', mixed case, etc.) to exactly 'Right' | 'Left' |
// 'Switch' | ''. Different entities store this differently — Baserunner/
// Catcher observations use single-letter codes, TrackmanPitch stores full
// words — so always run values through this before display or comparison.
export function normalizeHandLabel(hand) {
  if (!hand) return '';
  const h = hand.trim().toLowerCase();
  if (h.startsWith('s')) return 'Switch';
  if (h.startsWith('l')) return 'Left';
  if (h.startsWith('r')) return 'Right';
  return '';
}

// ── Pitch-call classification (single source of truth) ────────────────────────
// Trackman V3 emits FoulBallNotFieldable / FoulBallFieldable instead of the V2
// "FoulBall"/"FoulTip". We accept every known spelling so the same code works on
// V2 and V3 exports. These read r.pitch_call (snake_case, stored) OR r.PitchCall
// (PascalCase, raw Trackman) so they work on both raw and normalized rows.
const FOUL_CALLS = ['FoulBall', 'FoulTip', 'FoulBallNotFieldable', 'FoulBallFieldable'];
const SWING_CALLS = ['StrikeSwinging', 'InPlay', ...FOUL_CALLS];
const STRIKE_CALLS = ['StrikeCalled', 'StrikeSwinging', 'InPlay', ...FOUL_CALLS];
const CONTACT_CALLS = ['InPlay', ...FOUL_CALLS]; // swings that made contact (not whiffs)

function callOf(r) {
  return (r && (r.pitch_call ?? r.PitchCall)) || '';
}

// A swing: batter offered (whiff, foul, or ball in play).
export function isSwing(r) { return SWING_CALLS.includes(callOf(r)); }
// A strike for Strike% purposes: called, swinging, foul, or in play.
export function isStrike(r) { return STRIKE_CALLS.includes(callOf(r)); }
// A whiff: swing and miss.
export function isWhiff(r) { return callOf(r) === 'StrikeSwinging'; }
// Contact: a swing that was not a whiff.
export function isContact(r) { return CONTACT_CALLS.includes(callOf(r)); }

// ── Fastball-family velocity membership (single source of truth) ──────────────
// For VELOCITY surfaces (Avg/Max FB, velo histogram, velo-by-outing/inning) the
// cutter is intentionally EXCLUDED — its velo sits between true fastballs and the
// breaking ball and skews the "fastball velocity" read. Use FB_VELO_TYPES for any
// velocity stat. Movement/usage groupings still treat the cutter as a fastball and
// should not use this set.
export const FB_VELO_TYPES = ['Fastball', 'Four-Seam', 'Sinker']; // no Cutter
export function isFastballVeloType(pitchType) {
  return FB_VELO_TYPES.includes(pitchType);
}

// ── Batted-ball + spray helpers (single source of truth) ──────────────────────
// Shared by the dugout hitter view / spray chart. Like the classifiers above,
// the field readers accept snake_case (stored) OR PascalCase (raw Trackman).
function _hitDistance(r) { return parseFloat(r && (r.hit_distance ?? r.Distance)); }
function _bearing(r)     { return parseFloat(r && (r.bearing ?? r.Bearing ?? r.Direction)); }
function _exitSpeed(r)   { return parseFloat(r && (r.exit_speed ?? r.ExitSpeed)); }
function _launchAngle(r) { return parseFloat(r && (r.launch_angle ?? r.Angle)); }

// A real ball in play for spray/EV purposes. Drops Trackman noise and check-swing
// nubbers (e.g. LA -75 / 0.5ft, 20mph / 8ft) that should never plot or count.
export function isValidBattedBall(r) {
  if (callOf(r) !== 'InPlay') return false;
  const d = _hitDistance(r), la = _launchAngle(r), ev = _exitSpeed(r);
  if (!isFinite(d) || !isFinite(la) || !isFinite(ev)) return false;
  if (d < 10) return false;             // sub-10ft = nubber/noise
  if (la < -45 || la > 90) return false; // implausible launch
  if (ev < 30) return false;            // sub-30mph EV not a real BIP
  return true;
}

// Spray third, handedness-aware. VERIFIED bearing convention against live data
// (RHB home runs cluster at negative bearing): bearing negative = LEFT field
// (3B side), positive = RIGHT field (1B side), catcher's perspective. Pull/oppo
// therefore flip by hand: RHB pull = LF (neg); LHB pull = RF (pos).
// Middle = |bearing| <= 15deg. hand is 'R' | 'L' | 'S'; switch/unknown -> null.
const SPRAY_MIDDLE_DEG = 15;
export function sprayThird(bearingVal, hand) {
  const b = parseFloat(bearingVal);
  if (!isFinite(b)) return null;
  if (Math.abs(b) <= SPRAY_MIDDLE_DEG) return 'middle';
  const toLeftField = b < 0;
  if (hand === 'R') return toLeftField ? 'pull' : 'oppo';
  if (hand === 'L') return toLeftField ? 'oppo' : 'pull';
  return null;
}

// Pull/middle/oppo distribution over a hitter's VALID batted balls. Each row
// is classified by its OWN batter_hand when present, falling back to the
// `hand` parameter for rows missing it. This is a no-op for single-hand
// callers (every row already matches the passed hand) and fixes the
// switch-hitter case, where a single fixed hand previously misclassified
// every ball hit from the minority side.
// BUGFIX (per audit): was previously applying ONE hand (from the caller) to
// every row regardless of who was actually batting on that pitch.
// Percentages exclude 'unknown' (switch/unrated hand or bad bearing).
// Gate a CatcherObservation.trackman_pop_times entry to a genuine 2B throw.
// (New helper, per audit.) trackman_pop_times has no explicit target-base
// field, unlike the manually-logged steal_attempts array — so a fast 3B
// throw can otherwise get counted as an implausibly great 2B pop time.
// time_to_base is a reliable proxy: 3B is roughly half the throw distance
// of 2B, so a throw with an unrealistically short flight time is almost
// certainly a 3B throw, not a fast 2B one. Verified against a real catcher
// whose 1.68s "best pop" was actually a 3B throw (true 2B times: 2.06/2.10).
// Rows missing time_to_base are kept (no evidence to exclude them on).
export function isSecondBasePop(row) {
  const t = parseFloat(row?.time_to_base);
  if (!Number.isFinite(t)) return true;
  return t >= 1.2;
}

export function sprayDistribution(rows, hand) {
  const valid = (rows || []).filter(isValidBattedBall);
  const t = { pull: 0, middle: 0, oppo: 0, unknown: 0 };
  for (const r of valid) {
    const rowHand = normHand(r.batter_hand) || hand;
    const z = sprayThird(_bearing(r), rowHand);
    if (z) t[z]++; else t.unknown++;
  }
  const total = t.pull + t.middle + t.oppo;
  return {
    ...t, total,
    pullPct: total ? t.pull / total : 0,
    midPct:  total ? t.middle / total : 0,
    oppoPct: total ? t.oppo / total : 0,
  };
}

// Normalize batter hand: "Right"/"R" -> "R", "Left"/"L" -> "L", switch -> "S".
export function normHand(h) {
  if (!h) return '';
  const s = String(h).toLowerCase();
  if (s.startsWith('r')) return 'R';
  if (s.startsWith('l')) return 'L';
  if (s.startsWith('s') || s.startsWith('b')) return 'S';
  return '';
}

export function mean(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function stdDev(arr) {
  if (!arr || arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((sum, val) => sum + Math.pow(val - m, 2), 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

// Circular mean of angles in degrees (e.g. spin_axis, a clock-face direction
// where 359° and 1° should average to 0°, not 180°).
export function circularMean(degs) {
  const valid = (degs || []).filter(d => d != null && Number.isFinite(d));
  if (!valid.length) return null;
  let sx = 0, sy = 0;
  for (const d of valid) { const r = d * Math.PI / 180; sx += Math.cos(r); sy += Math.sin(r); }
  return ((Math.atan2(sy / valid.length, sx / valid.length) * 180 / Math.PI) + 360) % 360;
}

export function percentile(value, pool) {
  // AUDIT: an empty pool used to render a plausible-looking "50th percentile".
  if (!pool || pool.length === 0 || value == null) return null;
  const sorted = [...pool].sort((a, b) => a - b);
  let count = 0;
  for (const v of sorted) {
    if (v < value) count++;
    else if (v === value) count += 0.5;
  }
  return Math.round((count / sorted.length) * 100);
}

// 13-zone location map: zones 1-9 are the in-zone 3x3 grid (row 0 = bottom,
// col 0 = left, zone = row*3+col+1), zones 11-14 are the four shadow-zone
// quadrants just outside the rulebook zone. Matches PitcherArsenal.zone_counts'
// intended convention (see schema description) and the zone math already used
// for hitter location plots in HitterViz.jsx — same rulebook zone bounds
// (matches the inZone check used elsewhere in the app: 1.5-3.5 ft height,
// ±0.83 ft side) and the same 0.40 ft shadow band, so a pitcher's zone_counts
// and a hitter's zone-based plots agree on what "zone 5" means.
const SZ9 = { LEFT: -0.83, RIGHT: 0.83, BOT: 1.50, TOP: 3.50 };
const SHADOW_BAND = 0.40;
const OUTB9 = { LEFT: SZ9.LEFT - SHADOW_BAND, RIGHT: SZ9.RIGHT + SHADOW_BAND, BOT: SZ9.BOT - SHADOW_BAND, TOP: SZ9.TOP + SHADOW_BAND };

export function getZone9(side, height) {
  const s = parseFloat(side), h = parseFloat(height);
  if (!Number.isFinite(s) || !Number.isFinite(h)) return null;
  if (s < OUTB9.LEFT || s > OUTB9.RIGHT || h < OUTB9.BOT || h > OUTB9.TOP) return null;
  const inX = s >= SZ9.LEFT && s <= SZ9.RIGHT, inY = h >= SZ9.BOT && h <= SZ9.TOP;
  if (inX && inY) {
    const COL = (SZ9.RIGHT - SZ9.LEFT) / 3, ROW = (SZ9.TOP - SZ9.BOT) / 3;
    const col = s < (SZ9.LEFT + COL) ? 0 : s < (SZ9.LEFT + 2 * COL) ? 1 : 2;
    const row = h < (SZ9.BOT + ROW) ? 0 : h < (SZ9.BOT + 2 * ROW) ? 1 : 2;
    return row * 3 + col + 1;
  }
  const left = s < (SZ9.LEFT + SZ9.RIGHT) / 2, bot = h < (SZ9.BOT + SZ9.TOP) / 2;
  if (left && !bot) return 11;
  if (!left && !bot) return 12;
  if (left && bot) return 13;
  return 14;
}

// Builds a {zoneId: count} map for a set of pitches, matching PitcherArsenal.zone_counts.
export function buildZoneCounts(rows) {
  const counts = {};
  for (const r of rows) {
    const z = getZone9(r.plate_loc_side, r.plate_loc_height);
    if (z == null) continue;
    counts[z] = (counts[z] || 0) + 1;
  }
  return counts;
}

export function getCountCategory(balls, strikes) {
  if (balls > strikes) return "behind";
  if (balls < strikes) return "ahead";
  return "even";
}

export function formatNum(val, decimals = 1) {
  if (val === null || val === undefined || isNaN(val)) return "—";
  return Number(val).toFixed(decimals);
}

export function formatPct(val, decimals = 1) {
  if (val === null || val === undefined || isNaN(val)) return "—";
  return Number(val).toFixed(decimals) + "%";
}

// Compute arsenal aggregation from pitch rows
export function aggregateArsenal(pitches, pitcherName, pitcherTeam, pitcherHand, gameId) {
  const byType = {};
  const total = pitches.length;

  for (const p of pitches) {
    const type = p.tagged_pitch_type || p.pitch_type || "Unknown";
    if (!byType[type]) byType[type] = { pitches: [] };
    byType[type].pitches.push(p);
  }

  return Object.entries(byType).map(([type, data]) => {
    const rows = data.pitches;
    const velos = rows.map(r => r.rel_speed).filter(v => v != null && !isNaN(v));
    const spins = rows.map(r => r.spin_rate).filter(v => v != null && !isNaN(v));
    const hBreaks = rows.map(r => r.horz_break).filter(v => v != null && !isNaN(v));
    const vBreaks = rows.map(r => r.induced_vert_break).filter(v => v != null && !isNaN(v));
    
    const swings = rows.filter(isSwing);
    const whiffs = rows.filter(isWhiff);
    const inZone = rows.filter(r => {
      const s0 = parseFloat(r.plate_loc_side);
      const v = parseFloat(r.plate_loc_height);
      // AUDIT: Math.abs(null)===0 previously let null side count as in-zone.
      return Number.isFinite(s0) && Number.isFinite(v) && Math.abs(s0) <= 0.83 && v >= 1.5 && v <= 3.5;
    });

    const ahead = rows.filter(r => r.count_category === "ahead").length;
    const even = rows.filter(r => r.count_category === "even").length;
    const behind = rows.filter(r => r.count_category === "behind").length;

    return {
      pitcher_name: pitcherName,
      pitcher_id_trackman: rows[0]?.pitcher_id_trackman || "",
      pitcher_team: pitcherTeam,
      pitcher_hand: pitcherHand || rows[0]?.pitcher_hand || "",
      game_id: gameId || "season",
      pitch_type: type,
      count: rows.length,
      usage_pct: total > 0 ? (rows.length / total) * 100 : 0,
      velo_mean: mean(velos),
      velo_std: stdDev(velos),
      velo_max: velos.length > 0 ? Math.max(...velos) : 0,
      spin_mean: mean(spins),
      spin_std: stdDev(spins),
      horz_break_mean: mean(hBreaks),
      horz_break_std: stdDev(hBreaks),
      vert_break_mean: mean(vBreaks),
      vert_break_std: stdDev(vBreaks),
      whiff_pct: swings.length > 0 ? (whiffs.length / swings.length) * 100 : 0,
      zone_pct: rows.length > 0 ? (inZone.length / rows.length) * 100 : 0,
      ahead_count: ahead,
      even_count: even,
      behind_count: behind,
      total_pitches: total
    };
  });
}

// Percentile color coding
export function getPercentileColor(pct) {
  if (pct >= 80) return "#22c55e";
  if (pct >= 60) return "#84cc16";
  if (pct >= 40) return "#eab308";
  if (pct >= 20) return "#f97316";
  return "#ef4444";
}

// Speed/aggression colors
export function getSpeedColor(rating) {
  if (rating === "fast") return "#22c55e";
  if (rating === "average") return "#eab308";
  return "#ef4444";
}

export function getAggressionColor(rating) {
  if (rating === "aggressive") return "#22c55e";
  if (rating === "average") return "#eab308";
  return "#ef4444";
}