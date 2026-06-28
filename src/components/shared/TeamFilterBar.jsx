import React, { useRef } from "react";
import { useTeams } from "@/hooks/useTeam";

function initials(name) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").slice(0, 3).toUpperCase();
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

export default function TeamFilterBar({ selectedTeams, onChangeTeams }) {
  const { teams, loading } = useTeams();
  const scrollRef = useRef(null);

  const allSelected = !selectedTeams || selectedTeams.length === 0;

  function toggleTeam(code) {
    if (selectedTeams.includes(code)) {
      onChangeTeams(selectedTeams.filter(c => c !== code));
    } else {
      onChangeTeams([...selectedTeams, code]);
    }
  }

  if (loading) return null;

  return (
    <div
      ref={scrollRef}
      className="flex items-center no-scrollbar"
      style={{ gap: "6px", overflowX: "auto", scrollbarWidth: "none" }}
    >
      {/* All Teams pill */}
      <button
        onClick={() => onChangeTeams([])}
        style={{
          height: "28px",
          borderRadius: "20px",
          padding: "0 12px",
          fontSize: "11px",
          fontFamily: "var(--font-body)",
          fontWeight: 500,
          whiteSpace: "nowrap",
          flexShrink: 0,
          transition: "all 150ms ease",
          backgroundColor: allSelected ? "rgba(200, 168, 75, 0.12)" : "var(--bg-surface)",
          border: `1px solid ${allSelected ? "var(--accent-gold)" : "var(--border-color)"}`,
          color: allSelected ? "var(--text-primary)" : "var(--text-secondary)",
          cursor: "pointer",
        }}
      >
        All Teams
      </button>

      {teams.map(team => {
        const selected = selectedTeams.includes(team.code);
        const color = team.primary_color || "#4A5568";
        const rgb = color.startsWith("#") ? hexToRgb(color) : "74, 85, 104";
        return (
          <button
            key={team.code}
            onClick={() => toggleTeam(team.code)}
            style={{
              height: "28px",
              borderRadius: "20px",
              padding: "0 12px",
              fontSize: "11px",
              fontFamily: "var(--font-body)",
              fontWeight: 500,
              whiteSpace: "nowrap",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              gap: "5px",
              transition: "all 150ms ease",
              backgroundColor: selected ? `rgba(${rgb}, 0.2)` : "var(--bg-surface)",
              border: `1px solid ${selected ? color : "var(--border-color)"}`,
              color: selected ? "var(--text-primary)" : "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            <span
              style={{
                width: "14px",
                height: "14px",
                borderRadius: "50%",
                backgroundColor: "var(--bg-raised)",
                border: `1px solid ${color}44`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "6px",
                fontFamily: "var(--font-heading)",
                fontWeight: 700,
                color,
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              {team.logo_url ? (
                <img src={team.logo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} onError={e => { e.target.style.display = "none"; }} />
              ) : initials(team.name)}
            </span>
            {team.code}
          </button>
        );
      })}
    </div>
  );
}