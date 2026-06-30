import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { CalendarDays, Zap, Target, Activity, Shield, Check, Crosshair } from "lucide-react";
import TeamBadge from "@/components/shared/TeamBadge";
import MetricCell from "@/components/shared/MetricCell";
import EmptyState from "@/components/shared/EmptyState";
import SectionHeader from "@/components/shared/SectionHeader";
import { useTeams } from "@/hooks/useTeam";

const STATUS_STYLES = {
  imported: { border: "1px solid #2A4A6A", color: "#4A8AB0", bg: "#2A4A6A15", label: "Imported" },
  complete:  { border: "1px solid #1A5A7A", color: "#2A9ABF", bg: "#1A5A7A15", label: "Complete" },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.imported;
  return (
    <span style={{
      height: "18px", borderRadius: "2px", padding: "0 6px",
      display: "inline-flex", alignItems: "center",
      fontSize: "10px", fontFamily: "var(--font-body)", fontWeight: 500,
      textTransform: "uppercase", letterSpacing: "0.05em",
      border: s.border, color: s.color, backgroundColor: s.bg,
    }}>{s.label}</span>
  );
}

function KpiCard({ label, value, icon: Icon }) {
  const isEmpty = !value && value !== 0;
  return (
    <div style={{
      flex: "1 1 0",
      minWidth: "120px",
      padding: "16px",
      backgroundColor: "var(--bg-surface)",
      border: "1px solid var(--border-color)",
      borderTop: "2px solid var(--accent-gold)",
      borderRadius: "4px",
      display: "flex",
      flexDirection: "column",
      gap: "6px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "var(--font-body)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-secondary)" }}>
          {label}
        </span>
        {Icon && <Icon style={{ width: "14px", height: "14px", color: "var(--text-muted)" }} />}
      </div>
      <span style={{
        fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "32px", lineHeight: 1,
        color: isEmpty || value === 0 ? "var(--text-muted)" : "var(--text-primary)",
      }}>
        {value === 0 || isEmpty ? "—" : value}
      </span>
    </div>
  );
}

export default function Dashboard() {
  const [games, setGames] = useState([]);
  const [pitcherObs, setPitcherObs] = useState([]);
  const [hitterObs, setHitterObs] = useState([]);
  const [arsenal, setArsenal] = useState([]);
  const [pitchCount, setPitchCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { teams } = useTeams();

  useEffect(() => {
    async function load() {
      try {
        const [gamesData, pitcherData, hitterData, arsenalData] = await Promise.all([
          base44.entities.Game.list("-date", 50),
          base44.entities.PitcherObservation.list("-created_date", 500),
          base44.entities.HitterObservation.list("-created_date", 500),
          base44.entities.PitcherArsenal.filter({ scope: "season" }, "-k_bb_pct", 10),
        ]);
        setGames(gamesData);
        setPitcherObs(pitcherData);
        setHitterObs(hitterData);
        setArsenal(arsenalData);
        const total = gamesData.reduce((s, g) => s + (g.total_pitches || 0), 0);
        setPitchCount(total);
      } catch (e) { console.error(e); }
      setLoading(false);
    }
    load();
  }, []);

  const distinctPitchers = useMemo(() => new Set(pitcherObs.map(o => o.pitcher_name)).size, [pitcherObs]);
  const distinctHitters = useMemo(() => new Set(hitterObs.map(o => o.hitter_name)).size, [hitterObs]);
  const teamsFaced = useMemo(() => {
    const s = new Set();
    pitcherObs.forEach(o => o.pitcher_team && s.add(o.pitcher_team));
    hitterObs.forEach(o => o.hitter_team && s.add(o.hitter_team));
    return s.size;
  }, [pitcherObs, hitterObs]);

  const teamsWithObs = useMemo(() => {
    const s = new Set();
    pitcherObs.forEach(o => o.pitcher_team && s.add(o.pitcher_team));
    hitterObs.forEach(o => o.hitter_team && s.add(o.hitter_team));
    return s;
  }, [pitcherObs, hitterObs]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "256px" }}>
        <div style={{ width: "24px", height: "24px", borderRadius: "50%", border: "2px solid var(--border-color)", borderTopColor: "var(--accent-gold)", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* KPI bar */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <KpiCard label="Games Logged" value={games.length} icon={CalendarDays} />
        <KpiCard label="Pitchers Scouted" value={distinctPitchers} icon={Zap} />
        <KpiCard label="Hitters Scouted" value={distinctHitters} icon={Target} />
        <KpiCard label="Pitch Records" value={pitchCount} icon={Activity} />
        <KpiCard label="Teams Faced" value={teamsFaced} icon={Shield} />
      </div>

      {/* Two column layout */}
      <div style={{ display: "flex", gap: "20px", alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* Left column — 60% */}
        <div style={{ flex: "3 1 400px", display: "flex", flexDirection: "column", gap: "24px", minWidth: 0 }}>
          {/* Recent Games */}
          <div>
            <SectionHeader title="Recent Games" />
            {games.length === 0 ? (
              <EmptyState icon={CalendarDays} headline="No games logged yet" subtext="Import a Trackman CSV to get started" />
            ) : (
              <div style={{ border: "1px solid var(--border-color)", borderRadius: "4px", overflow: "hidden" }}>
                {games.slice(0, 5).map((game, i) => (
                  <div key={game.id} style={{
                    display: "flex", alignItems: "center", gap: "12px",
                    padding: "0 14px", height: "48px",
                    backgroundColor: i % 2 === 0 ? "var(--bg-surface)" : "var(--bg-base)",
                    borderBottom: i < 4 ? "1px solid var(--border-color)" : undefined,
                  }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-secondary)", width: "72px", flexShrink: 0 }}>{game.date}</span>
                    <TeamBadge teamCode={game.away_team_code} />
                    <span style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--text-muted)" }}>@</span>
                    <TeamBadge teamCode={game.home_team_code} />
                    <div style={{ flex: 1 }} />
                    <StatusBadge status={game.status} />
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)", flexShrink: 0 }}>{game.total_pitches || 0}p</span>
                  </div>
                ))}
              </div>
            )}
            {games.length > 0 && (
              <Link to="/games" style={{ display: "inline-flex", alignItems: "center", gap: "4px", marginTop: "8px", fontSize: "12px", color: "var(--accent-gold)", textDecoration: "none", fontFamily: "var(--font-body)" }}>
                View all games →
              </Link>
            )}
          </div>

          {/* Top Pitchers */}
          <div>
            <SectionHeader title="Top Pitchers This Season" />
            {arsenal.length === 0 ? (
              <EmptyState icon={Zap} headline="No arsenal data yet" subtext="Import Trackman data and run arsenal aggregation to see rankings" />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-color)", borderRadius: "4px" }}>
                  <thead>
                    <tr style={{ backgroundColor: "var(--bg-raised)", borderBottom: "1px solid rgba(200,168,75,0.3)" }}>
                      {["Pitcher", "Team", "Pitches", "Velo", "Whiff%", "Zone%", "K-BB%"].map(h => (
                        <th key={h} style={{ padding: "6px 8px", textAlign: h === "Pitcher" || h === "Team" ? "left" : "right", fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {arsenal.map((row, i) => (
                      <tr key={row.id} style={{ borderBottom: i < arsenal.length - 1 ? "1px solid var(--border-color)" : undefined }}>
                        <td style={{ padding: "0 8px", height: "36px", fontFamily: "var(--font-body)", fontWeight: 500, fontSize: "13px", color: "var(--text-primary)", whiteSpace: "nowrap" }}>{row.pitcher_name}</td>
                        <td style={{ padding: "0 8px" }}><TeamBadge teamCode={row.pitcher_team} size="xs" /></td>
                        <td style={{ padding: "0 8px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-secondary)" }}>{row.total_pitches || row.count || "—"}</td>
                        <td style={{ padding: "0 8px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-primary)" }}>{row.velo_mean ? row.velo_mean.toFixed(1) : "—"}</td>
                        <MetricCell value={row.whiff_pct} metric="whiff_pct" />
                        <MetricCell value={row.zone_pct} metric="zone_pct" />
                        <MetricCell value={row.k_bb_pct} metric="k_bb_pct" />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right column — 40% */}
        <div style={{ flex: "2 1 280px", display: "flex", flexDirection: "column", gap: "24px", minWidth: 0 }}>
          {/* Scouting Coverage */}
          <div>
            <SectionHeader title="Scouting Coverage" />
            <div style={{ padding: "12px 14px", backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-color)", borderRadius: "4px", marginBottom: "10px" }}>
              <span style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "22px", color: "var(--text-primary)" }}>
                {teamsWithObs.size}
              </span>
              <span style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--text-secondary)", marginLeft: "6px" }}>
                / {teams.length} teams scouted
              </span>
            </div>
            <div style={{ border: "1px solid var(--border-color)", borderRadius: "4px", overflow: "hidden" }}>
              {teams.map((team, i) => {
                const scouted = teamsWithObs.has(team.code);
                return (
                  <div key={team.code} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "0 12px", height: "36px",
                    backgroundColor: i % 2 === 0 ? "var(--bg-surface)" : "var(--bg-base)",
                    borderBottom: i < teams.length - 1 ? "1px solid var(--border-color)" : undefined,
                  }}>
                    <TeamBadge teamCode={team.code} />
                    {scouted
                      ? <Check style={{ width: "14px", height: "14px", color: "var(--accent-gold)" }} />
                      : <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-muted)" }}>—</span>
                    }
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Observations */}
          <div>
            <SectionHeader title="Recent Observations" />
            {pitcherObs.length === 0 ? (
              <EmptyState icon={Crosshair} headline="No observations logged yet" subtext="Use the Scouting page to log pitcher and hitter observations" />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {pitcherObs.slice(0, 5).map(o => (
                  <div key={o.id} style={{
                    padding: "10px 12px",
                    backgroundColor: "var(--bg-surface)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "4px",
                    display: "flex", flexDirection: "column", gap: "4px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontFamily: "var(--font-body)", fontWeight: 500, fontSize: "13px", color: "var(--text-primary)" }}>{o.pitcher_name}</span>
                      <TeamBadge teamCode={o.pitcher_team} size="xs" />
                      {o.time_to_plate_1b && (
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-secondary)" }}>
                          R1: {o.time_to_plate_1b}s
                        </span>
                      )}
                    </div>
                    {o.notes && (
                      <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--text-muted)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {o.notes.slice(0, 60)}{o.notes.length > 60 ? "…" : ""}
                      </p>
                    )}
                  </div>
                ))}
                <Link to="/scouting" style={{ fontSize: "12px", color: "var(--accent-gold)", textDecoration: "none", fontFamily: "var(--font-body)", marginTop: "2px" }}>
                  View all observations →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}