import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
} 

export const isIframe = window.self !== window.top;

/* ============================================================================
   SAINTS SCOUT ENGINE — BASE44 DATA BRIDGE
   Field names match the ACTUAL entity schemas as of June 2026.
   ============================================================================ */

export const CCL_TEAM_REGISTRY = {
  "SAN_LUI":    { name: "San Luis Obispo Blues",     logo: "https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817534/7u38z54jtr0h1o14_1_pmqyld.png" },
  "MEN_PAR":    { name: "Menlo Park Legends",         logo: "https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817780/logo-cmyk_limfsa.png" },
  "SON_STO":    { name: "Sonoma Stompers",             logo: "https://res.cloudinary.com/dpsbfigoq/image/upload/v1781818906/Sonoma_Stompers_Logo_y5svcw.png" },
  "WAL_CRE":    { name: "Walnut Creek Crawdads",      logo: "https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817534/uvrxcl0c44hrmvu6_bb3aqf.png" },
  "SAN_FRA4":   { name: "San Francisco Seagulls",     logo: "https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817730/images__1_-removebg-preview_if8az0.png" },
  "MLB_ACA":    { name: "MLB Academy Barons",          logo: "https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817534/channels4_profile_mniouy.png" },
  "ARR_SEC":    { name: "Arroyo Seco Saints",          logo: "https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817534/av99z9xmev36zy31_qm53uc.png" },
  "CON_OAK":    { name: "Conejo Oaks",                 logo: "https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817534/y5kt81hflbi56t76_dp2lgi.png" },
  "ORA_COU2":   { name: "Orange County Riptide",      logo: "https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817534/04r7l3jmpy9v0slb_cauron.png" },
  "SAN_BAR":    { name: "Santa Barbara Foresters",    logo: "https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817534/l6tqvygf63u3wvho_dllalk.png" },
  "SAN_DIE25":  { name: "San Diego Waves",             logo: "https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817534/vtzblkk57y33zsf1_f6lijk.png" },
  "SAN_DIE_24": { name: "San Diego Bombers",           logo: "https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817534/236yprqvgl4acuaq_aterpu.png" },
  "ALA_MER":    { name: "Alameda Merchants",           logo: "https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817576/merchantslogo_qqc6md.webp" },
  "PHI_BAS":    { name: "Philippines Baseball Group",  logo: "https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817534/lrhijpxhfifva748_czq1yd.png" },
  "SAN_MAR6":   { name: "Santa Maria Indians",         logo: "https://res.cloudinary.com/dpsbfigoq/image/upload/v1781817534/Chief_Wahoo__mascot_character.svg_l1zxwq.png" },
};

export const SCOUT_LOGO_MAP = Object.fromEntries(
  Object.values(CCL_TEAM_REGISTRY).map(({ name, logo }) => [name, logo])
);

export const TRACKMAN_CODE_TO_NAME = Object.fromEntries(
  Object.entries(CCL_TEAM_REGISTRY).map(([code, { name }]) => [code, name])
);

/* ── Base44 TrackmanPitch row → Trackman PascalCase ─────────────────────── */
export function mapBase44Row(r) {
  return {
    PitchNo:            r.pitch_no,
    Date:               r.date,
    Time:               r.time,
    Pitcher:            r.pitcher_name,
    PitcherId:          r.pitcher_id_trackman,
    PitcherThrows:      r.pitcher_hand,
    PitcherTeam:        r.pitcher_team,
    Batter:             r.batter_name,
    BatterId:           r.batter_id_trackman,
    BatterSide:         r.batter_hand,
    BatterTeam:         r.batter_team,
    // Catcher fields — stored in TrackmanPitch if schema has them
    Catcher:            r.catcher_name || "",
    CatcherThrows:      "Right",
    CatcherTeam:        r.catcher_team || "",
    Inning:             r.inning,
    "Top/Bottom":       r.top_bottom,
    Outs:               r.outs,
    Balls:              r.balls,
    Strikes:            r.strikes,
    PAofInning:         r.pa_of_inning,
    PitchofPA:          r.pitch_of_pa,
    TaggedPitchType:    r.tagged_pitch_type || r.pitch_type,
    AutoPitchType:      r.auto_pitch_type   || r.pitch_type,
    PitchCall:          r.pitch_call,
    KorBB:              r.kor_bb,
    PlayResult:         r.play_result,
    TaggedHitType:      r.tagged_hit_type,
    RelSpeed:           r.rel_speed,
    SpinRate:           r.spin_rate,
    SpinAxis:           r.spin_axis,
    Tilt:               r.tilt,
    InducedVertBreak:   r.induced_vert_break,
    HorzBreak:          r.horz_break,
    VertBreak:          r.vert_break,
    PlateLocHeight:     r.plate_loc_height,
    PlateLocSide:       r.plate_loc_side,
    ZoneSpeed:          r.zone_speed,
    RelHeight:          r.rel_height,
    RelSide:            r.rel_side,
    Extension:          r.extension,
    VertRelAngle:       r.vert_rel_angle,
    HorzRelAngle:       r.horz_rel_angle,
    ExitSpeed:          r.exit_speed,
    Angle:              r.launch_angle,
    Direction:          r.bearing,
    Distance:           r.hit_distance,
    HangTime:           r.hang_time,
    // Pop time fields — present if stored on TrackmanPitch
    PopTime:            r.pop_time,
    ExchangeTime:       r.exchange_time,
    ThrowSpeed:         r.throw_speed,
    TimeToBase:         r.time_to_base,
    Stadium:            r.stadium,
    GameID:             r.game_id,
    // Polynomial trajectory coefficients
    PitchTrajectoryXc0: r.pitch_trajectory_xc0,
    PitchTrajectoryXc1: r.pitch_trajectory_xc1,
    PitchTrajectoryXc2: r.pitch_trajectory_xc2,
    PitchTrajectoryYc0: r.pitch_trajectory_yc0,
    PitchTrajectoryYc1: r.pitch_trajectory_yc1,
    PitchTrajectoryYc2: r.pitch_trajectory_yc2,
    PitchTrajectoryZc0: r.pitch_trajectory_zc0,
    PitchTrajectoryZc1: r.pitch_trajectory_zc1,
    PitchTrajectoryZc2: r.pitch_trajectory_zc2,
    // Engine scope tags
    __game: r.game_id,
    __team: TRACKMAN_CODE_TO_NAME[r.pitcher_team] || r.pitcher_team,
  };
}

/* ── Build the teams object the Scout Engine expects ─────────────────────── */
export async function buildTeamsFromBase44(base44, { gameId = null } = {}) {
  const out = {};
  for (const { name } of Object.values(CCL_TEAM_REGISTRY)) {
    out[name] = { name, rawRows: [], pitcherObs: [], catcherObs: [], runnerObs: [], boxHitting: [], boxPitching: [] };
  }
  const ensure = (name) => {
    if (!name) return null;
    if (!out[name]) out[name] = { name, rawRows: [], pitcherObs: [], catcherObs: [], runnerObs: [], boxHitting: [], boxPitching: [] };
    return out[name];
  };

  try {
    // 1) Trackman pitches
    const tmRows = await base44.entities.TrackmanPitch.filter(
      gameId ? { game_id: gameId } : {}, "-date", 2000
    );
    for (const raw of tmRows) {
      const row = mapBase44Row(raw);
      const teamName = TRACKMAN_CODE_TO_NAME[row.PitcherTeam] || row.PitcherTeam;
      const bucket = ensure(teamName);
      if (bucket) { row.__team = teamName; bucket.rawRows.push(row); }
    }

    // 2) Pitcher observations — mapped to actual schema field names
    const pObs = await base44.entities.PitcherObservation.filter(
      gameId ? { game_id: gameId } : {}, "-created_date", 500
    );
    for (const o of pObs) {
      const teamName = TRACKMAN_CODE_TO_NAME[o.pitcher_team] || o.pitcher_team;
      const bucket = ensure(teamName);
      if (!bucket) continue;
      bucket.pitcherObs.push({
        _id:            o.id,
        name:           o.pitcher_name || "",
        throws:         o.pitcher_hand || "",
        number:         o.jersey_number || "",
        // actual schema: time_to_plate_1b / time_to_plate_2b (arrays of numbers)
        ttp1Readings:   o.time_to_plate_1b || [],
        ttp2Readings:   o.time_to_plate_2b || [],
        // actual schema: slide_step_type (enum), slide_step_notes
        slideStep:      o.slide_step_type || "",
        slideStepNotes: o.slide_step_notes || "",
        // actual schema: pickoff_moves (array of strings)
        pickoffMoves:   (o.pickoff_moves || []).join(", "),
        // actual schema: ucla_hold_start + ucla_hold_end
        ucla:           [o.ucla_hold_start, o.ucla_hold_end].filter(Boolean).join("→"),
        uclaStart:      o.ucla_hold_start || "",
        uclaEnd:        o.ucla_hold_end || "",
        notes:          o.notes || "",
        isCurrent:      o.is_current_pitcher ?? true,
      });
    }

    // 3) Catcher observations — mapped to actual schema field names
    const cObs = await base44.entities.CatcherObservation.filter(
      gameId ? { game_id: gameId } : {}, "-created_date", 500
    );
    for (const o of cObs) {
      const teamName = TRACKMAN_CODE_TO_NAME[o.catcher_team] || o.catcher_team;
      const bucket = ensure(teamName);
      if (!bucket) continue;
      // actual schema: steal_attempts[{pop_time, base, result}]
      // actual schema: trackman_pop_times[{pop_time, throw_speed, exchange_time, time_to_base, inning}]
      const allPops = [
        ...(o.trackman_pop_times || []).map(p => ({ ...p, source: "trackman" })),
        ...(o.steal_attempts     || []).map(p => ({ ...p, source: "scout" })),
      ];
      bucket.catcherObs.push({
        _id:            o.id,
        name:           o.catcher_name || "",
        number:         o.jersey_number || "",
        trackmanPops:   o.trackman_pop_times || [],
        stealAttempts:  o.steal_attempts || [],
        allPops,
        betweenInnings: o.between_innings_throws || [],
        warmupPop:      o.warmup_pop_time || "",
        notes:          o.notes || "",
      });
    }

    // 4) Baserunner observations — mapped to actual schema field names
    const rObs = await base44.entities.BaserunnerObservation.filter(
      gameId ? { game_id: gameId } : {}, "-created_date", 500
    );
    for (const o of rObs) {
      const teamName = TRACKMAN_CODE_TO_NAME[o.runner_team] || o.runner_team;
      const bucket = ensure(teamName);
      if (!bucket) continue;
      bucket.runnerObs.push({
        _id:              o.id,
        name:             o.runner_name || "",
        number:           o.jersey_number || "",
        bats:             o.bats || "",
        position:         o.position || "",
        speed:            o.speed_rating || "",
        aggression:       o.aggression_rating || "",
        pickoffAttempts:  o.pickoff_attempts || 0,
        // actual schema field is dirt_ball_advances (not dirtball_advances)
        dirtballAdvances: o.dirt_ball_advances || 0,
        notes:            o.notes || "",
      });
    }
  } catch (e) {
    console.error("Scout Engine data load error:", e);
  }

  return out;
}

/* ── Debounced autosave — field names match actual schemas ───────────────── */
const _saveTimers = {};
export function saveObservation(base44, kind, record) {
  const id = record._id;
  if (!id) return;
  const entityName = kind === "pitcher" ? "PitcherObservation"
                   : kind === "catcher" ? "CatcherObservation"
                   : "BaserunnerObservation";

  const patch = kind === "pitcher" ? {
    pitcher_hand:      record.throws,
    jersey_number:     record.number,
    time_to_plate_1b:  record.ttp1Readings,
    time_to_plate_2b:  record.ttp2Readings,
    slide_step_type:   record.slideStep,
    slide_step_notes:  record.slideStepNotes,
    pickoff_moves:     typeof record.pickoffMoves === "string"
                         ? record.pickoffMoves.split(",").map(s => s.trim()).filter(Boolean)
                         : record.pickoffMoves || [],
    ucla_hold_start:   record.uclaStart,
    ucla_hold_end:     record.uclaEnd,
    notes:             record.notes,
    is_current_pitcher: record.isCurrent,
  } : kind === "catcher" ? {
    jersey_number:           record.number,
    trackman_pop_times:      record.trackmanPops,
    steal_attempts:          record.stealAttempts,
    between_innings_throws:  record.betweenInnings,
    warmup_pop_time:         record.warmupPop,
    notes:                   record.notes,
  } : {
    jersey_number:     record.number,
    bats:              record.bats,
    position:          record.position,
    speed_rating:      record.speed,
    aggression_rating: record.aggression,
    pickoff_attempts:  record.pickoffAttempts,
    dirt_ball_advances: record.dirtballAdvances,
    notes:             record.notes,
  };

  clearTimeout(_saveTimers[id]);
  _saveTimers[id] = setTimeout(() => {
    base44.entities[entityName].update(id, patch)
      .catch(e => console.error("Autosave failed:", e));
  }, 500);
}