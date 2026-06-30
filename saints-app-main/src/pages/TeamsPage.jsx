import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { X } from "lucide-react";
import EmptyState from "@/components/shared/EmptyState";
import { Shield } from "lucide-react";

function initials(name) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").slice(0, 3).toUpperCase();
}

const DIVISION_COLORS = {
  North:     { bg: "#003087", color: "#7A9BBF" },
  South:     { bg: "#1A3A1A", color: "#2AB04A" },
  Affiliate: { bg: "#2A2A1A", color: "#C8A84B" },
};

function DivisionBadge({ division }) {
  if (!division) return null;
  const s = DIVISION_COLORS[division] || DIVISION_COLORS.Affiliate;
  return (
    <span style={{
      height: "18px", borderRadius: "2px", padding: "0 6px",
      display: "inline-flex", alignItems: "center",
      fontSize: "10px", fontFamily: "var(--font-body)", fontWeight: 500,
      textTransform: "uppercase", letterSpacing: "0.04em",
      backgroundColor: s.bg, color: s.color,
    }}>{division}</span>
  );
}

function TeamDetailPanel({ team, obsCounts, onClose }) {
  const primary = team.primary_color || "#4A5568";
  return (
    <div style={{
      position: "fixed", top: 0, right: 0, bottom: 0, width: "360px", zIndex: 50,
      backgroundColor: "var(--bg-surface)",
      borderLeft: "1px solid var(--border-color)",
      display: "flex", flexDirection: "column",
      boxShadow: "-8px 0 32px rgba(0,0,0,0.5)",
    }}>
      <div style={{
        height: "52px", display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 20px", borderBottom: "1px solid var(--border-color)",
        borderTop: `3px solid ${primary}`,
      }}>
        <span style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "16px", color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {team.name}
        </span>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)" }}>
          <X style={{ width: "18px", height: "18px" }} />
        </button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Logo */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={{
            width: "80px", height: "80px", borderRadius: "8px",
            backgroundColor: "var(--bg-raised)",
            border: `2px solid ${primary}44`,
            display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden",
            fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "18px", color: primary,
          }}>
            {team.logo_url
              ? <img src={team.logo_url} alt={team.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} onError={e => e.target.style.display = "none"} />
              : initials(team.name)
            }
          </div>
        </div>

        {/* Fields */}
        {[
          { label: "Code", value: team.code },
          { label: "City", value: team.city },
          { label: "Venue", value: team.venue },
          { label: "Division", value: <DivisionBadge division={team.division} /> },
          { label: "Membership", value: team.is_full_member
              ? <span style={{ color: "var(--accent-gold)", fontWeight: 600 }}>Full Member</span>
              : <span style={{ color: "var(--text-muted)" }}>Affiliate</span>
          },
          { label: "Pitcher Obs", value: obsCounts.pitcher },
          { label: "Hitter Obs", value: obsCounts.hitter },
          { label: "Catcher Obs", value: obsCounts.catcher },
          { label: "Baserunner Obs", value: obsCounts.runner },
        ].map(row => (
          <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
            <span style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--text-secondary)" }}>{row.label}</span>
            <span style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--text-primary)" }}>{row.value ?? "—"}</span>
          </div>
        ))}

        {/* Color swatches */}
        <div>
          <span style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "8px" }}>Brand Colors</span>
          <div style={{ display: "flex", gap: "8px" }}>
            {[team.primary_color, team.secondary_color, team.accent_color].filter(Boolean).map((c, i) => (
              <div key={i} title={c} style={{ width: "24px", height: "24px", borderRadius: "50%", backgroundColor: c, border: "1px solid var(--border-bright)" }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TeamsPage() {
  const [teams, setTeams] = useState([]);
  const [pitcherObs, setPitcherObs] = useState([]);
  const [hitterObs, setHitterObs] = useState([]);
  const [catcherObs, setCatcherObs] = useState([]);
  const [runnerObs, setRunnerObs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [t, p, h, c, r] = await Promise.all([
        base44.entities.Team.list("name", 100),
        base44.entities.PitcherObservation.list("-created_date", 500),
        base44.entities.HitterObservation.list("-created_date", 500),
        base44.entities.CatcherObservation.list("-created_date", 200),
        base44.entities.BaserunnerObservation.list("-created_date", 200),
      ]);
      setTeams(t);
      setPitcherObs(p);
      setHitterObs(h);
      setCatcherObs(c);
      setRunnerObs(r);
      setLoading(false);
    }
    load();
  }, []);

  function getObsCounts(code) {
    return {
      pitcher: pitcherObs.filter(o => o.pitcher_team === code).length,
      hitter: hitterObs.filter(o => o.hitter_team === code).length,
      catcher: catcherObs.filter(o => o.catcher_team === code).length,
      runner: runnerObs.filter(o => o.runner_team === code).length,
    };
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "256px" }}>
        <div style={{ width: "24px", height: "24px", borderRadius: "50%", border: "2px solid var(--border-color)", borderTopColor: "var(--accent-gold)", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  if (teams.length === 0) {
    return <EmptyState icon={Shield} headline="No teams configured" subtext="Add team records in the database to populate this view" />;
  }

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "12px" }}>
        {teams.map(team => {
          const primary = team.primary_color || "#4A5568";
          const counts = getObsCounts(team.code);
          const totalObs = counts.pitcher + counts.hitter + counts.catcher + counts.runner;
          return (
            <div
              key={team.id}
              onClick={() => setSelected(team)}
              style={{
                padding: "16px",
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border-color)",
                borderTop: `2px solid ${primary}`,
                borderRadius: "4px",
                cursor: "pointer",
                display: "flex", flexDirection: "column", gap: "12px",
                transition: "all 150ms ease",
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = "var(--bg-raised)"}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = "var(--bg-surface)"}
            >
              {/* Logo + Name */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{
                  width: "48px", height: "48px", borderRadius: "6px",
                  backgroundColor: "var(--bg-raised)",
                  border: `1px solid ${primary}44`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  overflow: "hidden", flexShrink: 0,
                  fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "11px", color: primary,
                }}>
                  {team.logo_url
                    ? <img src={team.logo_url} alt={team.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} onError={e => e.target.style.display = "none"} />
                    : initials(team.name)
                  }
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "18px", color: "var(--text-primary)", margin: 0, lineHeight: 1.1 }}>{team.name}</p>
                  {team.city && <p style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--text-secondary)", margin: 0, marginTop: "2px" }}>{team.city}</p>}
                </div>
              </div>

              {/* Badges row */}
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                <DivisionBadge division={team.division} />
                {team.is_full_member
                  ? <span style={{ height: "18px", borderRadius: "2px", padding: "0 6px", display: "inline-flex", alignItems: "center", fontSize: "10px", fontFamily: "var(--font-body)", fontWeight: 500, textTransform: "uppercase", backgroundColor: "rgba(200,168,75,0.1)", border: "1px solid rgba(200,168,75,0.4)", color: "var(--accent-gold)" }}>Full Member</span>
                  : <span style={{ height: "18px", borderRadius: "2px", padding: "0 6px", display: "inline-flex", alignItems: "center", fontSize: "10px", fontFamily: "var(--font-body)", fontWeight: 500, textTransform: "uppercase", backgroundColor: "var(--bg-raised)", border: "1px solid var(--border-color)", color: "var(--text-muted)" }}>Affiliate</span>
                }
                {/* Color swatches */}
                <div style={{ display: "flex", gap: "4px", marginLeft: "auto" }}>
                  {[team.primary_color, team.secondary_color].filter(Boolean).map((c, i) => (
                    <div key={i} style={{ width: "16px", height: "16px", borderRadius: "50%", backgroundColor: c, border: "1px solid var(--border-color)" }} />
                  ))}
                </div>
              </div>

              {/* Venue + obs count */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                {team.venue && <span style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>{team.venue}</span>}
                {totalObs > 0 && (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--accent-gold)", flexShrink: 0 }}>{totalObs} obs</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Slide-in panel */}
      {selected && (
        <>
          <div
            style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 49 }}
            onClick={() => setSelected(null)}
          />
          <TeamDetailPanel
            team={selected}
            obsCounts={getObsCounts(selected.code)}
            onClose={() => setSelected(null)}
          />
        </>
      )}
    </div>
  );
}