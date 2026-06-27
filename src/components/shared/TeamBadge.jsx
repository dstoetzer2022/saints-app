import React from "react";
import { useTeam } from "@/hooks/useTeam";

function initials(name) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").slice(0, 3).toUpperCase();
}

export default function TeamBadge({ teamCode, size = "sm" }) {
  const { team } = useTeam(teamCode);

  const color = team?.primary_color || "#4A5568";
  const name = team?.name || teamCode || "Unknown";
  const logoUrl = team?.logo_url;

  const imgSize = size === "lg" ? 28 : size === "xs" ? 16 : 24;

  return (
    <span
      className="inline-flex items-center shrink-0"
      style={{
        gap: size === "xs" ? "4px" : "6px",
        borderLeft: `1px solid ${color}`,
        paddingLeft: size === "xs" ? "4px" : "6px",
      }}
    >
      {/* Logo circle */}
      <span
        className="rounded-full flex items-center justify-center shrink-0 overflow-hidden"
        style={{
          width: imgSize,
          height: imgSize,
          backgroundColor: "var(--bg-raised)",
          border: `1px solid ${color}33`,
          fontFamily: "var(--font-heading)",
          fontWeight: 700,
          fontSize: size === "lg" ? "9px" : "7px",
          color,
        }}
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={name}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
            onError={e => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }}
          />
        ) : null}
        <span
          style={{
            display: logoUrl ? "none" : "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
          }}
        >
          {initials(name)}
        </span>
      </span>

      {/* Team code */}
      {size !== "xs" && (
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: 500,
            fontSize: "12px",
            color: "var(--text-primary)",
            lineHeight: 1,
          }}
        >
          {team?.code || teamCode}
        </span>
      )}
    </span>
  );
}