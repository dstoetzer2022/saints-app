// ── Season Aggregation ────────────────────────────────────────────────────────
// Reads all TrackmanPitch rows for a pitcher across every game,
// groups by canonical pitch type, and writes PitcherArsenal + PitcherSeasonRates.

import { base44 } from '@/api/base44Client';

// ── Pitch-type canonicalization ───────────────────────────────────────────────
// MUST match the output of normalizePitch() in ds.js — used as pitch_type in PitcherArsenal
const TYPE_MAP = {
  fourseamfastball: 'Four-Seam', fourseam: 'Four-Seam', fastball: 'Four-Seam', ff: 'Four-Seam',
  twoseamfastball: 'Sinker', twoseam: 'Sinker', sinker: 'Sinker', si: 'Sinker',
  cutter: 'Cutter', fc: 'Cutter',
  slider: 'Slider', sl: 'Slider',
  sweeper: 'Sweeper', st: 'Sweeper',
  curveball: 'Curveball', curve: 'Curveball', cu: 'Curveball',
  knucklecurve: 'Knucklecurve', kc: 'Knucklecurve',
  changeup: 'ChangeUp', change: 'ChangeUp', ch: 'ChangeUp', cho: 'ChangeUp',
  splitter: 'Splitter', splitfinger: 'Splitter', fs: 'Splitter',
  knuckleball: 'Knucklecurve', knuckle: 'Knucklecurve',
};

function canonPitchType(raw) {
  if (!raw) return null;
  const key = raw.replace(/[\s_\-]/g, '').toLowerCase();
  return TYPE_MAP[key] || raw.trim();
}

// ── Name normalization ────────────────────────────────────────────────────────
function normalizeApostrophe(s) {
  // Replace curly/smart apostrophes and other single-quote variants with straight apostrophe
  return s ? s.replace(/[\u2018\u2019\u02BC\u0060\u00B4]/g, "'") : s;
}

function toLastFirst(name) {
  if (!name) return '';
  name = normalizeApostrophe(name.trim());
  if (name.includes(',')) return name;
  const parts = name.split(/\s+/);
  if (parts.length < 2) return name;
  const last = parts[parts.length - 1];
  const first = parts.slice(0, parts.length - 1).join(' ');
  return `${last}, ${first}`;
}

function canonicalKey(name) {
  if (!name) return '';
  const lf = toLastFirst(normalizeApostrophe(name));
  const [last, first] = lf.split(',').map(s => s.trim().toLowerCase());
  return `${last || ''}|${first || ''}`;
}

const isPlaceholder = name => !name || canonicalKey(name) === 'first|last' || name.trim() === 'Last, First';

// ── Circular mean of angles in degrees ───────────────────────────────────────
function circularMean(degs) {
  const valid = degs.filter(d => d != null && Number.isFinite(d));
  if (!valid.length) return null;
  let sx = 0, sy = 0;
  for (const d of valid) { const r = d * Math.PI / 180; sx += Math.cos(r); sy += Math.sin(r); }
  return ((Math.atan2(sy / valid.length, sx / valid.length) * 180 / Math.PI) + 360) % 360;
}

function safeMean(arr) {
  const v = arr.filter(x => x != null && Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

function safeMax(arr) {
  const v = arr.filter(x => x != null && Number.isFinite(x));
  return v.length ? Math.max(...v) : null;
}

// ── FIX A1: Fetch ALL TrackmanPitch rows for a pitcher ────────────────────────
// Filters by pitcher_name directly (exact match as stored), then cross-checks
// with normalized key to handle variant spellings. Also tries the alternate
// "First Last" form so we catch both storage conventions.
async function fetchAllPitches(lastFirstName, teamFullName) {
  const key = canonicalKey(lastFirstName);
  // Normalize apostrophes in both directions so DB query matches stored value
  const normName = normalizeApostrophe(lastFirstName);
  const firstLastForm = normName.includes(',')
    ? normName.split(',').map(s => s.trim()).reverse().join(' ')
    : normName;
  // Also try with curly apostrophe in case CSV stored it that way
  const curlyName = normName.replace(/'/g, '\u2019');
  const curlyFirstLast = firstLastForm.replace(/'/g, '\u2019');

  const [batch1, batch2, batch3, batch4] = await Promise.all([
    base44.entities.TrackmanPitch.filter({ pitcher_name: normName }, '-created_date', 500).catch(() => []),
    firstLastForm !== normName
      ? base44.entities.TrackmanPitch.filter({ pitcher_name: firstLastForm }, '-created_date', 500).catch(() => [])
      : Promise.resolve([]),
    curlyName !== normName
      ? base44.entities.TrackmanPitch.filter({ pitcher_name: curlyName }, '-created_date', 500).catch(() => [])
      : Promise.resolve([]),
    curlyFirstLast !== firstLastForm
      ? base44.entities.TrackmanPitch.filter({ pitcher_name: curlyFirstLast }, '-created_date', 500).catch(() => [])
      : Promise.resolve([]),
  ]);

  const seen = new Set();
  const combined = [];
  for (const r of [...(batch1||[]), ...(batch2||[]), ...(batch3||[]), ...(batch4||[])]) {
    if (!seen.has(r.id)) { seen.add(r.id); combined.push(r); }
  }

  // If any batch hit the 500 cap, paginate per-game
  if ([batch1,batch2,batch3,batch4].some(b => (b||[]).length >= 500)) {
    const [g1, g2] = await Promise.all([
      base44.entities.Game.filter({ status: 'complete' }, '-date', 200).catch(() => []),
      base44.entities.Game.filter({ status: 'imported' }, '-date', 200).catch(() => []),
    ]);
    for (const game of [...(g1||[]), ...(g2||[])]) {
      const rows = await base44.entities.TrackmanPitch.filter({ game_id: game.id }, '-created_date', 500).catch(() => []);
      for (const r of rows) {
        if (seen.has(r.id)) continue;
        if (canonicalKey(r.pitcher_name) !== key) continue;
        seen.add(r.id); combined.push(r);
      }
    }
  }

  return combined;
}

// ── Core builder ──────────────────────────────────────────────────────────────
export async function rebuildPitcherSeason(lastFirstName, teamTrackmanCode, teamFullName, onProgress) {
  if (isPlaceholder(lastFirstName)) return;

  if (onProgress) onProgress(`Fetching pitches for ${lastFirstName}…`);

  const rows = await fetchAllPitches(lastFirstName, teamFullName);
  if (!rows.length) return;

  const total = rows.length;

  // Group by canonical pitch type
  const groups = {};
  for (const r of rows) {
    const raw = r.tagged_pitch_type || r.pitch_type || '';
    const pt = canonPitchType(raw) || 'Unknown';
    (groups[pt] = groups[pt] || []).push(r);
  }

  const STRIKE_CALLS = ['StrikeCalled', 'StrikeSwinging', 'FoulBallNotFieldable', 'FoulBallFieldable', 'InPlay'];

  // Build arsenal rows (usage_pct stored as whole-number 0-100)
  const arsenalRows = Object.entries(groups).map(([pitch_type, rs]) => {
    const count = rs.length;
    const get = field => rs.map(r => r[field] != null ? parseFloat(r[field]) : null);
    const strikeCount = rs.filter(r => STRIKE_CALLS.includes(r.pitch_call)).length;
    const strike_pct = rs.length > 0 ? (strikeCount / rs.length) * 100 : null;

    // Count situation buckets: pitcher ahead = more strikes than balls
    let ahead_count = 0, even_count = 0, behind_count = 0;
    for (const r of rs) {
      const b = r.balls ?? 0, s = r.strikes ?? 0;
      if (s > b) ahead_count++;
      else if (b > s) behind_count++;
      else even_count++;
    }

    const record = {
      pitcher_name: lastFirstName,
      pitcher_team: teamTrackmanCode,
      game_id: 'season',
      pitch_type,
      count,
      usage_pct: count / total * 100,  // whole number 0-100
      total_pitches: total,
      velo_mean: safeMean(get('rel_speed')),
      velo_max: safeMax(get('rel_speed')),
      spin_mean: safeMean(get('spin_rate')),
      horz_break_mean: safeMean(get('horz_break')),
      vert_break_mean: safeMean(get('induced_vert_break')),
      rel_height_mean: safeMean(get('rel_height')),
      rel_side_mean: safeMean(get('rel_side')),
      extension_mean: safeMean(get('extension')),
      spin_axis_mean: circularMean(get('spin_axis')),
      ahead_count,
      even_count,
      behind_count,
    };
    record.strike_pct = strike_pct;
    return record;
  }).filter(r => r.usage_pct > 2); // drop noise <2%

  // Per-pitcher cleanup — delete existing rows for this pitcher then rewrite
  const myKey = canonicalKey(lastFirstName);
  const existingArsenal = await base44.entities.PitcherArsenal.filter(
    { game_id: 'season', pitcher_name: lastFirstName }, '-created_date', 100
  ).catch(() => []);
  if (existingArsenal.length) {
    await Promise.all(existingArsenal.map(r => base44.entities.PitcherArsenal.delete(r.id).catch(() => {})));
  }

  // Create new season arsenal rows
  for (let i = 0; i < arsenalRows.length; i += 50) {
    await base44.entities.PitcherArsenal.bulkCreate(arsenalRows.slice(i, i + 50));
  }

  // Verification: re-query one row and confirm spin_axis_mean was persisted
  if (arsenalRows.length > 0) {
    const verify = await base44.entities.PitcherArsenal.filter(
      { game_id: 'season', pitcher_name: lastFirstName }, '-created_date', 1
    ).catch(() => []);
    if (verify.length > 0 && !('spin_axis_mean' in verify[0])) {
      console.error(`[seasonAggregation] spin_axis_mean MISSING on stored row for ${lastFirstName} — schema may not include the field`);
    }
  }

  // ── Season rates ──────────────────────────────────────────────────────────
  const isStrike = r => r.pitch_call !== 'BallCalled' && r.pitch_call !== 'HitByPitch' && r.pitch_call;
  const isSwing  = r => ['StrikeSwinging', 'FoulBallNotFieldable', 'FoulBallFieldable', 'InPlay'].includes(r.pitch_call);
  const inZone   = r => {
    const h = parseFloat(r.plate_loc_height), s = parseFloat(r.plate_loc_side);
    return Number.isFinite(h) && Number.isFinite(s) && h >= 1.5 && h <= 3.5 && s >= -0.83 && s <= 0.83;
  };

  // null when denom===0, never 0
  const div = (num, denom) => denom > 0 ? Math.round(100 * num / denom) : null;

  const fp     = rows.filter(r => r.balls === 0 && r.strikes === 0);
  const swings = rows.filter(isSwing);
  const ooz    = rows.filter(r => !inZone(r));

  const rates = {
    strike_pct:             div(rows.filter(isStrike).length, total),
    first_pitch_strike_pct: div(fp.filter(isStrike).length, fp.length),
    csw_pct:                div(rows.filter(r => r.pitch_call === 'StrikeCalled' || r.pitch_call === 'StrikeSwinging').length, total),
    whiff_pct:              div(rows.filter(r => r.pitch_call === 'StrikeSwinging').length, swings.length),
    zone_pct:               div(rows.filter(inZone).length, total),
    chase_pct:              div(ooz.filter(isSwing).length, ooz.length),
  };

  // Delete existing rates rows for this pitcher
  const existingRates = await base44.entities.PitcherSeasonRates.filter(
    { pitcher_name: lastFirstName }, '-created_date', 10
  ).catch(() => []);
  if (existingRates.length) {
    await Promise.all(existingRates.map(r => base44.entities.PitcherSeasonRates.delete(r.id).catch(() => {})));
  }

  await base44.entities.PitcherSeasonRates.create({
    pitcher_name: lastFirstName,
    pitcher_team: teamTrackmanCode,
    total_pitches: total,
    updated_date: new Date().toISOString(),
    ...rates,
  });
}

// ── Collect ALL distinct pitcher+team pairs from TrackmanPitch ────────────────
// Iterates every complete game and collects distinct pitcher+team pairs.
// ── Collect ALL distinct pitcher+team pairs from TrackmanPitch ────────────────
// Scans TrackmanPitch directly in pages rather than going through Game records,
// which is more reliable and doesn't depend on game status fields.
async function fetchAllDistinctPitchers(nameToCode) {
  const seen = new Set();
  const pairs = [];
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // Get all games first
  const [g1, g2] = await Promise.all([
    base44.entities.Game.filter({ status: 'complete' }, '-date', 300).catch(() => []),
    base44.entities.Game.filter({ status: 'imported' }, '-date', 300).catch(() => []),
  ]);
  const games = [...(g1||[]), ...(g2||[])];

  // For each game, fetch its pitchers
  for (const game of games) {
    let rows = [];
    try {
      rows = await base44.entities.TrackmanPitch.filter({ game_id: game.id }, 'pitcher_name', 500);
    } catch(e) {
      await sleep(600);
      try { rows = await base44.entities.TrackmanPitch.filter({ game_id: game.id }, 'pitcher_name', 500); }
      catch(e2) { continue; }
    }
    for (const r of rows) {
      if (!r.pitcher_name || isPlaceholder(r.pitcher_name)) continue;
      const k = canonicalKey(toLastFirst(r.pitcher_name));
      if (seen.has(k)) continue;
      seen.add(k);
      const fullTeamName = r.pitcher_team || '';
      const teamCode = nameToCode[fullTeamName] || fullTeamName;
      pairs.push({ name: toLastFirst(r.pitcher_name), teamCode, teamFullName: fullTeamName });
    }
    await sleep(100);
  }

  return pairs;
}

// ── Snapshot one team's pitchers (called before a game) ───────────────────────
// Rebuilds season stats only for pitchers from a specific team (by trackman code).
// Much faster than a full league rebuild — scopes to games where that team pitched.
export async function snapshotTeamSeasonStats(teamTrackmanCode, allTeams) {
  const codeToName = {}, nameToCode = {};
  (allTeams || []).forEach(t => {
    if (t.trackman_code) { codeToName[t.trackman_code] = t.name; nameToCode[t.name] = t.trackman_code; }
  });

  const [completeGames, importedGames] = await Promise.all([
    base44.entities.Game.filter({ status: 'complete' }, '-date', 200).catch(() => []),
    base44.entities.Game.filter({ status: 'imported' }, '-date', 200).catch(() => []),
  ]);
  const games = [...(completeGames || []), ...(importedGames || [])];

  // Collect distinct pitchers for this team
  const seen = new Set();
  const pairs = [];
  for (const game of games) {
    const rows = await base44.entities.TrackmanPitch.filter(
      { game_id: game.id, pitcher_team: codeToName[teamTrackmanCode] || teamTrackmanCode },
      '-created_date', 500
    ).catch(() => []);
    for (const r of rows) {
      if (!r.pitcher_name || isPlaceholder(r.pitcher_name)) continue;
      const lastFirst = toLastFirst(r.pitcher_name);
      const k = canonicalKey(lastFirst);
      if (seen.has(k)) continue;
      seen.add(k);
      pairs.push({ name: lastFirst, teamCode: teamTrackmanCode, teamFullName: codeToName[teamTrackmanCode] || teamTrackmanCode });
    }
  }

  for (const { name, teamCode, teamFullName } of pairs) {
    await rebuildPitcherSeason(name, teamCode, teamFullName, null);
  }
  return pairs.length;
}

// ── FIX A4: Derive distinct pitchers from TrackmanPitch (source of truth) ─────
export async function rebuildAllPitcherSeasons(allTeams, onProgress) {
  // Build team lookups
  const codeToName = {};   // trackman_code -> full name
  const nameToCode = {};   // full name -> trackman_code
  (allTeams || []).forEach(t => {
    if (t.trackman_code) { codeToName[t.trackman_code] = t.name; nameToCode[t.name] = t.trackman_code; }
  });

  // STEP 1: NO GLOBAL WIPE. We upsert per-pitcher in Step 3.
  // This means a failed discovery run never destroys existing data.

  // STEP 2: Collect all distinct pitcher+team pairs from TrackmanPitch
  if (onProgress) onProgress('Scanning pitchers…');
  const pairs = await fetchAllDistinctPitchers(nameToCode);

  // STEP 3: Rebuild each pitcher individually (delete-then-rewrite per pitcher)
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let done = 0;
  for (const { name, teamCode, teamFullName } of pairs) {
    if (onProgress) onProgress(`Rebuilding ${name} (${done + 1}/${pairs.length})…`);
    try {
      await rebuildPitcherSeason(name, teamCode, teamFullName, null);
    } catch(e) {
      await sleep(1000);
      try { await rebuildPitcherSeason(name, teamCode, teamFullName, null); } catch(e2) { /* skip */ }
    }
    done++;
    await sleep(200);
  }

  if (onProgress) onProgress(`Done — rebuilt ${done} pitchers.`);
  return done;
}