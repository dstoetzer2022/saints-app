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
  isaac: 'isaac',
  cal: 'calvin',
  nate: 'nathan', nathaniel: 'nathan',
};

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
    [last, first] = s.split(',').map(p => p.trim());
  } else {
    const parts = s.split(/\s+/);
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

export function percentile(value, pool) {
  if (!pool || pool.length === 0) return 50;
  const sorted = [...pool].sort((a, b) => a - b);
  let count = 0;
  for (const v of sorted) {
    if (v < value) count++;
    else if (v === value) count += 0.5;
  }
  return Math.round((count / sorted.length) * 100);
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
      const h = Math.abs(r.plate_loc_side);
      const v = r.plate_loc_height;
      return h != null && v != null && h <= 0.83 && v >= 1.5 && v <= 3.5;
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