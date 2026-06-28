import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import SectionHeader from "@/components/ui/SectionHeader";

const inputStyle = {
  width: "100%",
  padding: "8px",
  backgroundColor: "var(--bg-raised)",
  border: "1px solid var(--border-color)",
  borderRadius: "4px",
  color: "var(--text-primary)",
  fontFamily: "var(--font-body)",
  fontSize: "14px",
  boxSizing: "border-box",
};

const labelStyle = {
  fontFamily: "var(--font-body)",
  fontSize: "13px",
  color: "var(--text-secondary)",
  display: "block",
  marginBottom: "4px",
};

export { inputStyle, labelStyle };

export function FormField({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

export function useGameOptions() {
  const [games, setGames] = useState([]);
  useEffect(() => {
    base44.entities.Game.list("-date", 50).then(setGames);
  }, []);
  return games;
}

export function useTeamOptions() {
  const [teams, setTeams] = useState([]);
  useEffect(() => {
    base44.entities.Team.list("name", 100).then(setTeams);
  }, []);
  return teams;
}

export function GameSelect({ value, onChange, games }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={inputStyle}>
      <option value="">— Select game —</option>
      {games.map(g => (
        <option key={g.id} value={g.id}>
          {g.date} · {g.away_team_code} @ {g.home_team_code}
        </option>
      ))}
    </select>
  );
}

export function TeamSelect({ value, onChange, teams, placeholder = "— Select team —" }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={inputStyle}>
      <option value="">{placeholder}</option>
      {teams.map(t => (
        <option key={t.code} value={t.code}>{t.name} ({t.code})</option>
      ))}
    </select>
  );
}

export function SubmitButton({ label = "Save", loading }) {
  return (
    <button
      type="submit"
      disabled={loading}
      style={{
        padding: "8px 16px", borderRadius: "4px",
        fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "14px",
        textTransform: "uppercase", letterSpacing: "0.08em",
        backgroundColor: loading ? "var(--accent-gold-dim)" : "var(--accent-gold)",
        color: "#05080F", border: "none",
        cursor: loading ? "not-allowed" : "pointer",
        alignSelf: "flex-start",
      }}
    >
      {loading ? "Saving..." : label}
    </button>
  );
}

export function ObsForm({ title, onSubmit, children }) {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSubmit();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message || "Save failed.");
    }
    setSaving(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <SectionHeader title={title} />
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {children({ saving })}
        {error && <p style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--accent-red)", margin: 0 }}>{error}</p>}
        {success && <p style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "#2AB04A", margin: 0 }}>Saved successfully.</p>}
      </form>
    </div>
  );
}