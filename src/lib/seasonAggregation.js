// ── Season Aggregation ────────────────────────────────────────────────────────
// Reads all TrackmanPitch rows for a pitcher across every game,
// groups by canonical pitch type, and writes PitcherArsenal + PitcherSeasonRates.
//
// AUDIT FIXES (2026-07):
//  • strike% now uses the shared statsUtils isStrike (BallinDirt/BallIntentional
//    were previously counted as strikes; V2 foul spellings now handled).
//  • chase%/zone% denominators exclude pitches with missing plate location.
//  • All fetches paginate via fetchAll (no more silent 500-row truncation).
//  • Per-pitcher rebuild is CREATE-then-DELETE: new rows are written and
//    verified BEFORE stale rows are removed, so a mid-rebuild failure can
//    leave harmless duplicates (cleaned next run) but never a wiped pitcher.
//  • Stale-row cleanup matches on canonicalNameKey, so variant spellings
//    (curly apostrophes, "First Last") no longer leave orphan season rows.

import { base44 } from '@/api/base44Client';
import { getLeaguePitches } from '@/lib/leagueCache';
import { savePools } from '@/lib/poolCache';
import { isStrike, isSwing, isWhiff, canonicalNameKey, normHand, buildZoneCounts, toTrackmanName } from '@/lib/statsUtils';
import { canonPitchType } from '@/lib/ds';
import { fetchAllFiltered } from '@/lib/fetchAll';
import { applyArsenalCorrection, correctMistaggedPitches } from '@/lib/arsenalCorrection';

// ── Name normalization ────────────────────────────────────────────────────────
function normalizeApostrophe(s) {
  return s ? s.replace(/[\u2018\u2019\u02BC\u0060\u00B4]/g, "'") : s;
}


const isPlaceholder = name =>
  !name || canonicalNameKey(name) === 'last|first' || name.trim() === 'Last, First';

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

// Finite-location gate: pitches without plate location are excluded from BOTH
// zone% and chase% denominators (previously they inflated chase% as "OOZ").
function hasLoc(r) {
  return Number.isFinite(parseFloat(r.plate_loc_height)) && Number.isFinite(parseFloat(r.plate_loc_side));
}
function inZone(r) {
  const h = parseFloat(r.plate_loc_height), s = parseFloat(r.plate_loc_side);
  return Number.isFinite(h) && Number.isFinite(s) && h >= 1.5 && h <= 3.5 && s >= -0.83 && s <= 0.83;
}

// ── Fetch ALL TrackmanPitch rows for a pitcher (paginated, both name forms) ──
async function fetchAllPitches(lastFirstName) {
  const key = canonicalNameKey(lastFirstName);
  const normName = normalizeApostrophe(lastFirstName);
  const firstLastForm = normName.includes(',')
    ? normName.split(',').map(s => s.trim()).reverse().join(' ')
    : normName;
  const curlyName = normName.replace(/'/g, '\u2019');
  const curlyFirstLast = firstLastForm.replace(/'/g, '\u2019');

  const forms = [...new Set([normName, firstLastForm, curlyName, curlyFirstLast])];
  const batches = await Promise.all(
    forms.map(f => fetchAllFiltered(base44.entities.TrackmanPitch, { pitcher_name: f }, '-created_date'))
  );

  const seen = new Set();
  const combined = [];
  for (const batch of batches) {
    for (const r of batch) {
      if (seen.has(r.id)) continue;
      // Cross-check the canonical key so a shared surname variant never leaks in.
      if (canonicalNameKey(r.pitcher_name) !== key) continue;
      seen.add(r.id); combined.push(r);
    }
  }
  return combined;
}

// ── Core builder ──────────────────────────────────────────────────────────────
export async function rebuildPitcherSeason(lastFirstName, teamTrackmanCode, teamFullName, onProgress, validTeamCodes) {
  if (isPlaceholder(lastFirstName)) return;

  if (onProgress) onProgress(`Fetching pitches for ${lastFirstName}…`);

  const fetched = await fetchAllPitches(lastFirstName);
  if (!fetched.length) return;

  // Similarity-based arsenal correction (UCLA method, in-memory only):
  // merges duplicate labels for the same physical pitch before grouping.
  const merged = applyArsenalCorrection(fetched);
  const { data: rows, changes: retagged } = correctMistaggedPitches(merged.data);
  const relabeled = merged.changes + retagged;
  if (relabeled && onProgress) {
    onProgress(`Arsenal correction: relabeled ${relabeled} pitches for ${lastFirstName}…`);
  }

  const total = rows.length;
  const myKey = canonicalNameKey(lastFirstName);

  // Group by canonical pitch type
  const groups = {};
  for (const r of rows) {
    const raw = r.tagged_pitch_type || r.pitch_type || '';
    const pt = canonPitchType(raw) || 'Unknown';
    (groups[pt] = groups[pt] || []).push(r);
  }

  // Snapshot existing rows BEFORE writing, so we can delete exactly the stale
  // set afterwards (create-then-delete; see header note).
  const existingArsenal = (await fetchAllFiltered(
    base44.entities.PitcherArsenal, { game_id: 'season' }, '-created_date', { max: 5000 }
  )).filter(r => canonicalNameKey(r.pitcher_name) === myKey);
  const existingRates = (await fetchAllFiltered(
    base44.entities.PitcherSeasonRates, {}, '-created_date', { max: 3000 }
  )).filter(r => canonicalNameKey(r.pitcher_name) === myKey);

  // AUDIT: exhibition/all-star game team codes (e.g. "202_CCL", "202_CCL1")
  // are never registered as real Teams. If the code driving this rebuild
  // isn't a known registered code, don't let it clobber the pitcher's real
  // season team label — keep whatever is already on file.
  let effectiveTeamCode = teamTrackmanCode;
  let effectiveTeamFullName = teamFullName;
  if (validTeamCodes && !validTeamCodes.has(teamTrackmanCode)) {
    const priorTeam = existingRates[0]?.pitcher_team || existingArsenal[0]?.pitcher_team;
    if (priorTeam) { effectiveTeamCode = priorTeam; effectiveTeamFullName = priorTeam; }
  }

  // Build arsenal rows (usage_pct stored as whole-number 0-100 on season rows)
  const arsenalRows = Object.entries(groups).map(([pitch_type, rs]) => {
    const count = rs.length;
    const get = field => rs.map(r => r[field] != null ? parseFloat(r[field]) : null);
    const strikeCount = rs.filter(isStrike).length; // shared classifier — fixes BallinDirt bug
    const strike_pct = rs.length > 0 ? (strikeCount / rs.length) * 100 : null;

    let ahead_count = 0, even_count = 0, behind_count = 0, first_pitch_count = 0, two_strike_count = 0;
    let lhh_count = 0, lhh_strike_count = 0, rhh_count = 0, rhh_strike_count = 0;
    for (const r of rs) {
      const b = r.balls ?? 0, s = r.strikes ?? 0;
      if (s > b) ahead_count++;
      else if (b > s) behind_count++;
      else even_count++;
      if (b === 0 && s === 0) first_pitch_count++;
      if (s === 2) two_strike_count++;

      const hand = normHand(r.batter_hand);
      if (hand === 'L') { lhh_count++; if (isStrike(r)) lhh_strike_count++; }
      else if (hand === 'R') { rhh_count++; if (isStrike(r)) rhh_strike_count++; }
      // Switch-hitters (normHand 'S') aren't counted in either split — the
      // side they actually batted from isn't in this row, only their
      // switch-hitter status, so guessing would misattribute the pitch.
    }

    // Per-type whiff% and zone% — these previously only existed as OVERALL
    // PitcherSeasonRates fields, never broken out by pitch type, even though
    // PitcherArsenal has always had whiff_pct/zone_pct columns for it.
    const typeSwings = rs.filter(isSwing);
    const typeWhiffs = rs.filter(isWhiff);
    const typeLocated = rs.filter(hasLoc);
    const whiff_pct = typeSwings.length ? (typeWhiffs.length / typeSwings.length) * 100 : null;
    const zone_pct = typeLocated.length ? (typeLocated.filter(inZone).length / typeLocated.length) * 100 : null;

    const record = {
      pitcher_name: lastFirstName,
      pitcher_team: effectiveTeamCode,
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
      first_pitch_count,
      two_strike_count,
      lhh_count,
      lhh_strike_count,
      rhh_count,
      rhh_strike_count,
      whiff_pct,
      zone_pct,
      zone_counts: buildZoneCounts(rs),
    };
    record.strike_pct = strike_pct; // explicit assignment (known silent-drop failure mode)
    return record;
  }).filter(r => r.usage_pct > 2); // drop noise <2%

  // ── Season rates (shared classifiers + location-gated denominators) ────────
  const div = (num, denom) => denom > 0 ? Math.round(100 * num / denom) : null;

  const fp     = rows.filter(r => r.balls === 0 && r.strikes === 0);
  const swings = rows.filter(isSwing);
  const located = rows.filter(hasLoc);
  const ooz    = located.filter(r => !inZone(r));

  const rates = {
    strike_pct:             div(rows.filter(isStrike).length, total),
    first_pitch_strike_pct: div(fp.filter(isStrike).length, fp.length),
    csw_pct:                div(rows.filter(r => r.pitch_call === 'StrikeCalled' || isWhiff(r)).length, total),
    whiff_pct:              div(rows.filter(isWhiff).length, swings.length),
    zone_pct:               div(located.filter(inZone).length, located.length),
    chase_pct:              div(ooz.filter(isSwing).length, ooz.length),
  };

  // ── CREATE new rows first ───────────────────────────────────────────────────
  for (let i = 0; i < arsenalRows.length; i += 50) {
    await base44.entities.PitcherArsenal.bulkCreate(arsenalRows.slice(i, i + 50));
  }
  const newRates = await base44.entities.PitcherSeasonRates.create({
    pitcher_name: lastFirstName,
    pitcher_team: effectiveTeamCode,
    total_pitches: total,
    updated_date: new Date().toISOString(),
    ...rates,
  });

  // Verify the new arsenal rows landed before touching the old ones.
  let verified = arsenalRows.length === 0;
  if (arsenalRows.length > 0) {
    const verify = await base44.entities.PitcherArsenal.filter(
      { game_id: 'season', pitcher_name: lastFirstName }, '-created_date', 100
    ).catch(() => []);
    const existingIds = new Set(existingArsenal.map(r => r.id));
    const fresh = (verify || []).filter(r => !existingIds.has(r.id));
    verified = fresh.length >= arsenalRows.length;
    if (verify.length > 0 && !('spin_axis_mean' in verify[0])) {
      console.error(`[seasonAggregation] spin_axis_mean MISSING on stored row for ${lastFirstName} — schema may not include the field`);
    }
  }

  // ── DELETE the stale snapshot only after a verified write ──────────────────
  if (verified) {
    await Promise.all(existingArsenal.map(r => base44.entities.PitcherArsenal.delete(r.id).catch(() => {})));
    await Promise.all(
      existingRates
        .filter(r => !newRates || r.id !== newRates.id)
        .map(r => base44.entities.PitcherSeasonRates.delete(r.id).catch(() => {}))
    );
  } else {
    console.error(`[seasonAggregation] write verification failed for ${lastFirstName} — old rows kept (duplicates possible until next rebuild)`);
  }
}

// ── Collect ALL distinct pitcher+team pairs from TrackmanPitch ────────────────
async function fetchAllDistinctPitchers(nameToCode) {
  const seen = new Set();
  const pairs = [];
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const [g1, g2] = await Promise.all([
    fetchAllFiltered(base44.entities.Game, { status: 'complete' }, '-date'),
    fetchAllFiltered(base44.entities.Game, { status: 'imported' }, '-date'),
  ]);
  const games = [...g1, ...g2];

  for (const game of games) {
    const rows = await fetchAllFiltered(
      base44.entities.TrackmanPitch, { game_id: game.id }, 'pitcher_name'
    );
    for (const r of rows) {
      if (!r.pitcher_name || isPlaceholder(r.pitcher_name)) continue;
      const k = canonicalNameKey(r.pitcher_name);
      if (seen.has(k)) continue;
      seen.add(k);
      const fullTeamName = r.pitcher_team || '';
      const teamCode = nameToCode[fullTeamName] || fullTeamName;
      pairs.push({ name: toTrackmanName(r.pitcher_name), teamCode, teamFullName: fullTeamName });
    }
    await sleep(100);
  }

  return pairs;
}

// ── Rebuild season stats for a specific set of pitcher names ─────────────────
// Used by CSV import to rebuild ONLY the pitchers who appeared in the imported
// files, instead of hammering the API with a full-league rebuild every import.
export async function rebuildPitchersByName(pitcherEntries, allTeams, onProgress) {
  const nameToCode = {};
  const validTeamCodes = new Set();
  (allTeams || []).forEach(t => { if (t.trackman_code) { nameToCode[t.name] = t.trackman_code; validTeamCodes.add(t.trackman_code); } });

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const seen = new Set();
  let done = 0;
  const unique = (pitcherEntries || []).filter(({ name }) => {
    const k = canonicalNameKey(name);
    if (!name || seen.has(k)) return false;
    seen.add(k); return true;
  });

  for (const { name, team } of unique) {
    const lastFirst = toTrackmanName(name);
    const teamCode = nameToCode[team] || team || '';
    if (onProgress) onProgress(`Rebuilding ${lastFirst} (${done + 1}/${unique.length})…`);
    try {
      await rebuildPitcherSeason(lastFirst, teamCode, team, null, validTeamCodes);
    } catch (e) {
      await sleep(1000);
      try { await rebuildPitcherSeason(lastFirst, teamCode, team, null, validTeamCodes); } catch (e2) { /* skip */ }
    }
    done++;
    await sleep(200);
  }
  if (onProgress) onProgress(`Done — rebuilt ${done} pitchers.`);
  return done;
}

// ── Snapshot one team's pitchers (called before a game) ───────────────────────
export async function snapshotTeamSeasonStats(teamTrackmanCode, allTeams) {
  const codeToName = {}, nameToCode = {};
  (allTeams || []).forEach(t => {
    if (t.trackman_code) { codeToName[t.trackman_code] = t.name; nameToCode[t.name] = t.trackman_code; }
  });

  const [completeGames, importedGames] = await Promise.all([
    fetchAllFiltered(base44.entities.Game, { status: 'complete' }, '-date'),
    fetchAllFiltered(base44.entities.Game, { status: 'imported' }, '-date'),
  ]);
  const games = [...completeGames, ...importedGames];

  const seen = new Set();
  const pairs = [];
  for (const game of games) {
    const rows = await fetchAllFiltered(
      base44.entities.TrackmanPitch,
      { game_id: game.id, pitcher_team: codeToName[teamTrackmanCode] || teamTrackmanCode },
      '-created_date'
    );
    for (const r of rows) {
      if (!r.pitcher_name || isPlaceholder(r.pitcher_name)) continue;
      const lastFirst = toTrackmanName(r.pitcher_name);
      const k = canonicalNameKey(lastFirst);
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

// ── Full-league rebuild (manual button only) ─────────────────────────────────
export async function rebuildAllPitcherSeasons(allTeams, onProgress) {
  const codeToName = {};
  const nameToCode = {};
  const validTeamCodes = new Set();
  (allTeams || []).forEach(t => {
    if (t.trackman_code) { codeToName[t.trackman_code] = t.name; nameToCode[t.name] = t.trackman_code; validTeamCodes.add(t.trackman_code); }
  });

  // NO GLOBAL WIPE — per-pitcher create-then-delete in rebuildPitcherSeason.
  if (onProgress) onProgress('Scanning pitchers…');
  const pairs = await fetchAllDistinctPitchers(nameToCode);

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let done = 0;
  for (const { name, teamCode, teamFullName } of pairs) {
    if (onProgress) onProgress(`Rebuilding ${name} (${done + 1}/${pairs.length})…`);
    try {
      await rebuildPitcherSeason(name, teamCode, teamFullName, null, validTeamCodes);
    } catch (e) {
      await sleep(1000);
      try { await rebuildPitcherSeason(name, teamCode, teamFullName, null, validTeamCodes); } catch (e2) { /* skip */ }
    }
    done++;
    await sleep(200);
  }

  if (onProgress) onProgress(`Rebuilt ${done} pitchers — snapshotting league pools…`);
  // Phase 4.1: force-refresh the league cache (bypassing its 10-min TTL) so
  // the precomputed pool snapshot reflects the rebuild that just finished,
  // then persist it. A failed snapshot must never fail the rebuild itself —
  // savePools() already swallows errors internally and returns false; every
  // profile falls back to building pools from the live league pull exactly
  // as before if this step is skipped or the LeaguePool entity isn't set up
  // yet (schema pending sign-off).
  try {
    const freshLeaguePitches = await getLeaguePitches({ force: true });
    const saved = await savePools(freshLeaguePitches);
    if (onProgress) onProgress(saved ? `Done — rebuilt ${done} pitchers, pools snapshotted.` : `Done — rebuilt ${done} pitchers (pool snapshot skipped).`);
  } catch {
    if (onProgress) onProgress(`Done — rebuilt ${done} pitchers (pool snapshot skipped).`);
  }
  return done;
}
