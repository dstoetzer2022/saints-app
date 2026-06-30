// Trackman V3 CSV Parser
import { getCountCategory } from './statsUtils';

// Common Trackman V3 column mappings
const COLUMN_MAP = {
  "PitchNo": "pitch_no",
  "Date": "date",
  "Time": "time",
  "Pitcher": "pitcher_name",
  "PitcherId": "pitcher_id_trackman",
  "PitcherTeam": "pitcher_team",
  "PitcherThrows": "pitcher_hand",
  "Batter": "batter_name",
  "BatterId": "batter_id_trackman",
  "BatterTeam": "batter_team",
  "BatterSide": "batter_hand",
  "Inning": "inning",
  "Top/Bottom": "top_bottom",
  "Outs": "outs",
  "Balls": "balls",
  "Strikes": "strikes",
  "AutoPitchType": "pitch_type",
  "PitchCall": "pitch_call",
  "TaggedPitchType": "tagged_pitch_type",
  "RelSpeed": "rel_speed",
  "SpinRate": "spin_rate",
  "SpinAxis": "spin_axis",
  "HorzBreak": "horz_break",
  "InducedVertBreak": "induced_vert_break",
  "PlateLocHeight": "plate_loc_height",
  "PlateLocSide": "plate_loc_side",
  "ZoneSpeed": "zone_speed",
  "VertRelAngle": "vert_rel_angle",
  "HorzRelAngle": "horz_rel_angle",
  "RelHeight": "rel_height",
  "RelSide": "rel_side",
  "Extension": "extension",
  "ExitSpeed": "exit_speed",
  "Angle": "launch_angle",
  "Distance": "hit_distance",
  "Bearing": "bearing",
  "HangTime": "hang_time",
  "PlayResult": "play_result",
  "KorBB": "kor_bb",
  "OutsOnPlay": "outs",
  "PAofInning": "pa_result",
  "Notes": "notes"
};

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseTrackmanCSV(csvText) {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { pitches: [], errors: ["File is empty or has no data rows"] };

  const headers = parseCSVLine(lines[0]);
  const pitches = [];
  const errors = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < 5) continue;

    const row = {};
    headers.forEach((header, idx) => {
      const mapped = COLUMN_MAP[header.trim()];
      if (mapped && values[idx] !== undefined) {
        const val = values[idx].trim();
        const numFields = [
          "pitch_no", "inning", "outs", "balls", "strikes",
          "rel_speed", "spin_rate", "spin_axis", "horz_break", "induced_vert_break",
          "plate_loc_height", "plate_loc_side", "zone_speed",
          "vert_rel_angle", "horz_rel_angle", "rel_height", "rel_side", "extension",
          "exit_speed", "launch_angle", "hit_distance", "bearing", "hang_time"
        ];
        if (numFields.includes(mapped)) {
          const num = parseFloat(val);
          row[mapped] = isNaN(num) ? null : num;
        } else {
          row[mapped] = val || null;
        }
      }
    });

    if (!row.pitcher_name && !row.batter_name) continue;

    // Compute count category
    if (row.balls != null && row.strikes != null) {
      row.count_category = getCountCategory(row.balls, row.strikes);
    }

    pitches.push(row);
  }

  return { pitches, errors, totalRows: lines.length - 1 };
}

// Extract game info from parsed pitches
export function extractGameInfo(pitches, fileName) {
  if (pitches.length === 0) return null;
  
  const teams = new Set();
  pitches.forEach(p => {
    if (p.pitcher_team) teams.add(p.pitcher_team);
    if (p.batter_team) teams.add(p.batter_team);
  });
  
  const teamCodes = [...teams];
  const date = pitches[0]?.date || new Date().toISOString().split('T')[0];

  return {
    date,
    home_team_code: teamCodes[0] || "UNKNOWN",
    away_team_code: teamCodes[1] || teamCodes[0] || "UNKNOWN",
    trackman_file_name: fileName,
    total_pitches: pitches.length,
    status: "imported"
  };
}