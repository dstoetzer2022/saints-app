import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Crosshair, Zap, Target, Users } from "lucide-react";
import TeamBadge from "@/components/shared/TeamBadge";
import EmptyState from "@/components/shared/EmptyState";
import TeamFilterBar from "@/components/shared/TeamFilterBar";

const TABS = ["PITCHERS", "HITTERS", "CATCHERS", "BASERUNNERS"];

const GRADE_COLORS = {
  plus_plus: { bg: "#C8A84B22", border: "#C8A84B", color: "#C8A84B" },
  plus:       { bg: "#1A7A3A22", border: "#2AB04A", color: "#2AB04A" },
  average:    { bg: "#1E2E4522", border: "#2A4060", color: "#7A9BBF" },
  below:      { bg: "#8A700022", border: "#C8A800", color: "#C8A800" },
  well_below: { bg: "#7A1A1A22", border: "#C83030", color: "#C83030" },
};

function GradeBadge({ label, value }) {
  if (!value) return null;
  const style = GRADE_COLORS[value] || GRADE_COLORS.average;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "3px",
      height: "18px", borderRadius: "2px", padding: "0 6px",
      fontSize: "10px", fontFamily: "var(--font-body)", fontWeight: 500,
      textTransform: "uppercase", letterSpacing: "0.04em",
      backgroundColor: style.bg, border: `1px solid ${style.border}`, color: style.color,
    }}>
      {label && <span style={{ color: "var(--text-muted)", marginRight: "2px" }}>{label}:</span>}
      {value.replace("_", "+")}
    </span>
  );
}

function ApproachBadge({ value }) {
  if (!value) return null;
  const map = {
    chase: { bg: "#7A1A1A22", border: "#C83030", color: "#C83030" },
    disciplined: { bg: "#1A7A3A22", border: "#2AB04A", color: "#2AB04A" },
    average: { bg: "#1E2E4522", border: "#2A4060", color: "#7A9BBF" },
  };
  const s = map[value] || map.average;
  return (
    <span style={{
      height: "18px", borderRadius: "2px", padding: "0 6px",
      display: "inline-flex", alignItems: "center",
      fontSize: "10px", fontFamily: "var(--font-body)", fontWeight: 500,
      textTransform: "uppercase", letterSpacing: "0.04em",
      backgroundColor: s.bg, border: `1px solid ${s.border}`, color: s.color,
    }}>{value}</span>
  );
}

function RatingBadge({ value, type }) {
  if (!value) return null;
  const speed = { fast: { color: "#2AB04A", border: "#1A7A3A" }, average: { color: "#7A9BBF", border: "#2A4060" }, slow: { color: "#C83030", border: "#7A1A1A" } };
  const aggr = { aggressive: { color: "#C8A84B", border: "#8A6E28" }, average: { color: "#7A9BBF", border: "#2A4060" }, passive: { color: "#C87A00", border: "#7A4A00" } };
  const map = type === "speed" ? speed : aggr;
  const s = map[value] || { color: "var(--text-secondary)", border: "var(--border-color)" };
  return (
    <span style={{
      height: "18px", borderRadius: "2px", padding: "0 6px",
      display: "inline-flex", alignItems: "center",
      fontSize: "10px", fontFamily: "var(--font-body)", fontWeight: 500,
      textTransform: "uppercase", letterSpacing: "0.04em",
      backgroundColor: s.color + "22", border: `1px solid ${s.border}`, color: s.color,
    }}>{value}</span>
  );
}

function HandBadge({ value }) {
  if (!value) return null;
  return (
    <span style={{
      height: "18px", width: "20px", borderRadius: "2px",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontSize: "10px", fontFamily: "var(--font-heading)", fontWeight: 700,
      backgroundColor: "var(--bg-raised)", border: "1px solid var(--border-bright)",
      color: "var(--text-secondary)",
    }}>{value}</span>
  );
}

function ObsCard({ children }) {
  return (
    <div style={{
      padding: "14px",
      backgroundColor: "var(--bg-surface)",
      border: "1px solid var(--border-color)",
      borderRadius: "4px",
      display: "flex", flexDirection: "column", gap: "8px",
    }}>
      {children}
    </div>
  );
}

function PitcherCard({ obs }) {
  return (
    <ObsCard>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <span style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "14px", color: "var(--text-primary)" }}>{obs.pitcher_name}</span>
        <TeamBadge teamCode={obs.pitcher_team} size="xs" />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
        {obs.time_to_plate_1b != null && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-secondary)", backgroundColor: "var(--bg-raised)", padding: "2px 6px", borderRadius: "2px" }}>
            R1: {obs.time_to_plate_1b}s
          </span>
        )}
        {obs.time_to_plate_2b != null && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-secondary)", backgroundColor: "var(--bg-raised)", padding: "2px 6px", borderRadius: "2px" }}>
            R2: {obs.time_to_plate_2b}s
          </span>
        )}
        {obs.has_slide_step && (
          <span style={{ height: "18px", borderRadius: "2px", padding: "0 6px", display: "inline-flex", alignItems: "center", fontSize: "10px", fontFamily: "var(--font-body)", fontWeight: 500, textTransform: "uppercase", backgroundColor: "#003087", border: "1px solid #2A4060", color: "#7A9BBF" }}>
            Slide Step
          </span>
        )}
        {obs.ucla_hold_start && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--accent-gold)" }}>
            Hold: {obs.ucla_hold_start}{obs.ucla_hold_end && obs.ucla_hold_end !== obs.ucla_hold_start ? `→${obs.ucla_hold_end}` : ""}
          </span>
        )}
      </div>
      {obs.pickoff_moves && obs.pickoff_moves.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
          {obs.pickoff_moves.map((m, i) => (
            <span key={i} style={{ height: "16px", borderRadius: "2px", padding: "0 5px", display: "inline-flex", alignItems: "center", fontSize: "10px", fontFamily: "var(--font-body)", backgroundColor: "var(--bg-raised)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
              {m}
            </span>
          ))}
        </div>
      )}
      {obs.notes && (
        <p style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>{obs.notes}</p>
      )}
    </ObsCard>
  );
}

function HitterCard({ obs }) {
  return (
    <ObsCard>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "14px", color: "var(--text-primary)" }}>{obs.hitter_name}</span>
          <HandBadge value={obs.hitter_hand} />
        </div>
        <TeamBadge teamCode={obs.hitter_team} size="xs" />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
        {obs.ab_count != null && <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-secondary)", backgroundColor: "var(--bg-raised)", padding: "2px 6px", borderRadius: "2px" }}>{obs.ab_count} AB</span>}
        {obs.xbh_count != null && <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-secondary)", backgroundColor: "var(--bg-raised)", padding: "2px 6px", borderRadius: "2px" }}>{obs.xbh_count} XBH</span>}
        <ApproachBadge value={obs.approach} />
      </div>
      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
        {obs.bat_speed_grade && <GradeBadge label="Bat" value={obs.bat_speed_grade} />}
        {obs.contact_grade && <GradeBadge label="Cnt" value={obs.contact_grade} />}
        {obs.power_grade && <GradeBadge label="Pwr" value={obs.power_grade} />}
      </div>
      {obs.notes && (
        <p style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>{obs.notes}</p>
      )}
    </ObsCard>
  );
}

function CatcherCard({ obs }) {
  return (
    <ObsCard>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <span style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "14px", color: "var(--text-primary)" }}>{obs.catcher_name}</span>
        <TeamBadge teamCode={obs.catcher_team} size="xs" />
      </div>
      {obs.warmup_pop_time != null && (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-secondary)" }}>
          Warmup pop: {obs.warmup_pop_time}s
        </span>
      )}
      {obs.steal_attempts && obs.steal_attempts.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          <span style={{ fontFamily: "var(--font-heading)", fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Steal Attempts</span>
          {obs.steal_attempts.map((a, i) => (
            <div key={i} style={{ display: "flex", gap: "8px", fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-secondary)" }}>
              <span>{a.base}</span>
              {a.pop_time != null && <span>{a.pop_time}s</span>}
              <span style={{ color: a.result === "out" ? "#2AB04A" : a.result === "safe" ? "#C83030" : "var(--text-muted)" }}>{a.result}</span>
            </div>
          ))}
        </div>
      )}
      {obs.notes && <p style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>{obs.notes}</p>}
    </ObsCard>
  );
}

function BaserunnerCard({ obs }) {
  return (
    <ObsCard>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <span style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "14px", color: "var(--text-primary)" }}>{obs.runner_name}</span>
        <TeamBadge teamCode={obs.runner_team} size="xs" />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        <RatingBadge value={obs.speed_rating} type="speed" />
        <RatingBadge value={obs.aggression_rating} type="aggression" />
        {obs.pickoff_attempts > 0 && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-secondary)", backgroundColor: "var(--bg-raised)", padding: "2px 6px", borderRadius: "2px" }}>
            {obs.pickoff_attempts} pickoff{obs.pickoff_attempts !== 1 ? "s" : ""}
          </span>
        )}
        {obs.dirt_ball_advances > 0 && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-secondary)", backgroundColor: "var(--bg-raised)", padding: "2px 6px", borderRadius: "2px" }}>
            {obs.dirt_ball_advances} dirt adv
          </span>
        )}
      </div>
      {obs.notes && <p style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>{obs.notes}</p>}
    </ObsCard>
  );
}

export default function Scouting() {
  const [activeTab, setActiveTab] = useState("PITCHERS");
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [pitcherObs, setPitcherObs] = useState([]);
  const [hitterObs, setHitterObs] = useState([]);
  const [catcherObs, setCatcherObs] = useState([]);
  const [runnerObs, setRunnerObs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [p, h, c, r] = await Promise.all([
          base44.entities.PitcherObservation.list("-created_date", 500),
          base44.entities.HitterObservation.list("-created_date", 500),
          base44.entities.CatcherObservation.list("-created_date", 200),
          base44.entities.BaserunnerObservation.list("-created_date", 200),
        ]);
        setPitcherObs(p);
        setHitterObs(h);
        setCatcherObs(c);
        setRunnerObs(r);
      } catch (e) { console.error(e); }
      setLoading(false);
    }
    load();
  }, []);

  function filterByTeam(obs, teamField) {
    if (!selectedTeams.length) return obs;
    return obs.filter(o => selectedTeams.includes(o[teamField]));
  }

  const filteredPitchers = filterByTeam(pitcherObs, "pitcher_team");
  const filteredHitters = filterByTeam(hitterObs, "hitter_team");
  const filteredCatchers = filterByTeam(catcherObs, "catcher_team");
  const filteredRunners = filterByTeam(runnerObs, "runner_team");

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border-color)", gap: "0" }}>
        {TABS.map(tab => {
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                height: "40px", padding: "0 16px",
                fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "13px",
                textTransform: "uppercase", letterSpacing: "0.08em",
                color: active ? "var(--accent-gold)" : "var(--text-secondary)",
                backgroundColor: "transparent",
                border: "none",
                borderBottom: active ? "2px solid var(--accent-gold)" : "2px solid transparent",
                cursor: "pointer",
                transition: "all 150ms ease",
                marginBottom: "-1px",
              }}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Team filter */}
      <TeamFilterBar selectedTeams={selectedTeams} onChangeTeams={setSelectedTeams} />

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "200px" }}>
          <div style={{ width: "24px", height: "24px", borderRadius: "50%", border: "2px solid var(--border-color)", borderTopColor: "var(--accent-gold)", animation: "spin 0.8s linear infinite" }} />
        </div>
      ) : (
        <>
          {activeTab === "PITCHERS" && (
            filteredPitchers.length === 0
              ? <EmptyState icon={Zap} headline="No pitcher observations yet" subtext="Log observations from the game view or observation forms" />
              : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "12px" }}>
                  {filteredPitchers.map(o => <PitcherCard key={o.id} obs={o} />)}
                </div>
          )}
          {activeTab === "HITTERS" && (
            filteredHitters.length === 0
              ? <EmptyState icon={Target} headline="No hitter observations yet" subtext="Log hitter observations from the observation forms" />
              : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "12px" }}>
                  {filteredHitters.map(o => <HitterCard key={o.id} obs={o} />)}
                </div>
          )}
          {activeTab === "CATCHERS" && (
            filteredCatchers.length === 0
              ? <EmptyState icon={Users} headline="No catcher observations yet" subtext="Log catcher observations including pop times and steal attempts" />
              : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "12px" }}>
                  {filteredCatchers.map(o => <CatcherCard key={o.id} obs={o} />)}
                </div>
          )}
          {activeTab === "BASERUNNERS" && (
            filteredRunners.length === 0
              ? <EmptyState icon={Crosshair} headline="No baserunner observations yet" subtext="Log baserunner speed and aggression observations" />
              : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "12px" }}>
                  {filteredRunners.map(o => <BaserunnerCard key={o.id} obs={o} />)}
                </div>
          )}
        </>
      )}
    </div>
  );
}