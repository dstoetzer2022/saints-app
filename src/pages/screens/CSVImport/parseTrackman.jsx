// Parses a Trackman V3 CSV string into an array of row objects.
export function parseTrackmanCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  const headers = splitCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = splitCSVLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h.trim()] = (vals[i] ?? '').trim(); });
    return row;
  }).filter(r => r.Pitcher);
}

function splitCSVLine(line) {
  const vals = [];
  let cur = '', inQ = false;
  for (const c of line) {
    if (c === '"') { inQ = !inQ; }
    else if (c === ',' && !inQ) { vals.push(cur); cur = ''; }
    else cur += c;
  }
  vals.push(cur);
  return vals;
}

export function n(v) {
  const x = parseFloat(v);
  return isNaN(x) ? null : x;
}

export function countCategory(balls, strikes) {
  const b = parseInt(balls) || 0;
  const s = parseInt(strikes) || 0;
  if (s > b) return 'ahead';
  if (b > s) return 'behind';
  return 'even';
}

export function isInZone(plh, pls) {
  const h = parseFloat(plh);
  const s = parseFloat(pls);
  return !isNaN(h) && !isNaN(s) && h >= 1.5 && h <= 3.5 && s >= -0.83 && s <= 0.83;
}

export function std(arr) {
  if (!arr.length) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length);
}

export function mean(arr) {
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// Build arsenal aggregates for all pitchers from parsed rows
export function buildArsenals(rows, gameId) {
  // group by pitcher+pitchType
  const map = {};
  rows.forEach(r => {
    const key = `${r.Pitcher}||${r.PitcherTeam}||${r.TaggedPitchType || r.AutoPitchType || 'Unknown'}`;
    if (!map[key]) map[key] = { rows: [], pitcher: r.Pitcher, pitcherIdTrackman: r.PitcherId, pitcherTeam: r.PitcherTeam, pitcherHand: r.PitcherThrows, pitchType: r.TaggedPitchType || r.AutoPitchType || 'Unknown' };
    map[key].rows.push(r);
  });

  // total pitches per pitcher for usage %
  const pitcherTotals = {};
  rows.forEach(r => {
    const k = r.Pitcher;
    pitcherTotals[k] = (pitcherTotals[k] || 0) + 1;
  });

  return Object.values(map).map(({ rows: pr, pitcher, pitcherIdTrackman, pitcherTeam, pitcherHand, pitchType }) => {
    const velos = pr.map(r => n(r.RelSpeed)).filter(v => v !== null);
    const spins = pr.map(r => n(r.SpinRate)).filter(v => v !== null);
    const hbs = pr.map(r => n(r.HorzBreak)).filter(v => v !== null);
    const vbs = pr.map(r => n(r.InducedVertBreak)).filter(v => v !== null);
    const whiffs = pr.filter(r => r.PitchCall === 'StrikeSwinging').length;
    const zones = pr.filter(r => isInZone(r.PlateLocHeight, r.PlateLocSide)).length;
    const aheadC = pr.filter(r => countCategory(r.Balls, r.Strikes) === 'ahead').length;
    const evenC = pr.filter(r => countCategory(r.Balls, r.Strikes) === 'even').length;
    const behindC = pr.filter(r => countCategory(r.Balls, r.Strikes) === 'behind').length;

    return {
      game_id: gameId,
      pitcher_name: pitcher,
      pitcher_id_trackman: pitcherIdTrackman || null,
      pitcher_team: pitcherTeam,
      pitcher_hand: pitcherHand || null,
      pitch_type: pitchType,
      count: pr.length,
      total_pitches: pitcherTotals[pitcher] || pr.length,
      usage_pct: pr.length / (pitcherTotals[pitcher] || pr.length),
      velo_mean: mean(velos) ? +mean(velos).toFixed(1) : null,
      velo_max: velos.length ? +Math.max(...velos).toFixed(1) : null,
      velo_std: velos.length ? +std(velos).toFixed(2) : null,
      spin_mean: mean(spins) ? +mean(spins).toFixed(0) : null,
      spin_std: spins.length ? +std(spins).toFixed(0) : null,
      horz_break_mean: mean(hbs) ? +mean(hbs).toFixed(1) : null,
      horz_break_std: hbs.length ? +std(hbs).toFixed(2) : null,
      vert_break_mean: mean(vbs) ? +mean(vbs).toFixed(1) : null,
      vert_break_std: vbs.length ? +std(vbs).toFixed(2) : null,
      whiff_pct: pr.length ? +(whiffs / pr.length).toFixed(3) : null,
      zone_pct: pr.length ? +(zones / pr.length).toFixed(3) : null,
      ahead_count: aheadC,
      even_count: evenC,
      behind_count: behindC,
    };
  });
}

// Extract catcher pop-time rows
export function extractCatcherData(rows) {
  const byName = {};
  rows.forEach(r => {
    if (!r.PopTime || !r.Catcher) return;
    const pt = n(r.PopTime);
    if (pt === null) return;
    const key = r.Catcher;
    if (!byName[key]) byName[key] = { name: r.Catcher, catcherId: r.CatcherId, team: r.CatcherTeam, throws: r.CatcherThrows, pops: [] };
    byName[key].pops.push({
      pop_time: pt,
      throw_speed: n(r.ThrowSpeed),
      exchange_time: n(r.ExchangeTime),
      time_to_base: n(r.TimeToBase),
      inning: n(r.Inning),
      pitch_no: n(r.PitchNo),
    });
  });
  return Object.values(byName);
}