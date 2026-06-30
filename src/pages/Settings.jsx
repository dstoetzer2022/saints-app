import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import SectionHeader from "@/components/shared/SectionHeader";

function ConfirmButton({ label, onConfirm }) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    await onConfirm();
    setLoading(false);
    setConfirming(false);
  }

  if (confirming) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--accent-red)" }}>Are you sure?</span>
        <button
          onClick={handleConfirm}
          disabled={loading}
          style={{ height: "32px", padding: "0 14px", borderRadius: "2px", backgroundColor: "var(--accent-red)", color: "#fff", fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: 500, border: "none", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}
        >
          {loading ? "Clearing..." : "Yes, clear"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          style={{ height: "32px", padding: "0 14px", borderRadius: "2px", backgroundColor: "var(--bg-raised)", color: "var(--text-secondary)", fontFamily: "var(--font-body)", fontSize: "13px", border: "1px solid var(--border-color)", cursor: "pointer" }}
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      style={{ height: "32px", padding: "0 14px", borderRadius: "2px", backgroundColor: "var(--bg-raised)", color: "var(--accent-red)", fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: 500, border: "1px solid var(--accent-red-dim)", cursor: "pointer" }}
    >
      {label}
    </button>
  );
}

function ToggleSetting({ label, storageKey, defaultValue = true }) {
  const [value, setValue] = useState(() => {
    const stored = localStorage.getItem(storageKey);
    return stored !== null ? stored === "true" : defaultValue;
  });

  function toggle() {
    const next = !value;
    setValue(next);
    localStorage.setItem(storageKey, String(next));
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--border-color)" }}>
      <span style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--text-primary)" }}>{label}</span>
      <button
        onClick={toggle}
        style={{
          width: "40px", height: "22px", borderRadius: "11px",
          backgroundColor: value ? "var(--accent-gold)" : "var(--bg-raised)",
          border: `1px solid ${value ? "var(--accent-gold-dim)" : "var(--border-bright)"}`,
          position: "relative", cursor: "pointer", transition: "all 200ms ease",
          flexShrink: 0,
        }}
      >
        <span style={{
          position: "absolute", top: "2px",
          left: value ? "20px" : "2px",
          width: "16px", height: "16px", borderRadius: "50%",
          backgroundColor: value ? "#05080F" : "var(--text-muted)",
          transition: "left 200ms ease",
        }} />
      </button>
    </div>
  );
}

async function clearEntity(entityName) {
  const records = await base44.entities[entityName].list();
  await Promise.all(records.map(r => base44.entities[entityName].delete(r.id)));
}

export default function Settings() {
  const appId = typeof window !== "undefined" ? window.location.hostname : "—";

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>

      {/* DATA */}
      <div>
        <SectionHeader title="Data" />
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--border-color)" }}>
            <div>
              <p style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--text-primary)", margin: 0 }}>Clear all games</p>
              <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--text-muted)", margin: 0, marginTop: "2px" }}>Removes all Game records and pitch data</p>
            </div>
            <ConfirmButton label="Clear Games" onConfirm={() => clearEntity("Game")} />
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--border-color)" }}>
            <div>
              <p style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--text-primary)", margin: 0 }}>Clear all observations</p>
              <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--text-muted)", margin: 0, marginTop: "2px" }}>Removes pitcher, hitter, catcher, and baserunner observations</p>
            </div>
            <ConfirmButton label="Clear Observations" onConfirm={async () => {
              await Promise.all([
                clearEntity("PitcherObservation"),
                clearEntity("HitterObservation"),
                clearEntity("CatcherObservation"),
                clearEntity("BaserunnerObservation"),
              ]);
            }} />
          </div>
          <div style={{ padding: "12px 0", borderBottom: "1px solid var(--border-color)" }}>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--text-secondary)", margin: 0, marginBottom: "6px" }}>App Host</p>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-muted)", backgroundColor: "var(--bg-raised)", padding: "4px 10px", borderRadius: "2px", border: "1px solid var(--border-color)" }}>
              {appId}
            </span>
          </div>
        </div>
      </div>

      {/* DISPLAY */}
      <div>
        <SectionHeader title="Display" />
        <ToggleSetting label="Compact table mode" storageKey="scouting_compact" defaultValue={false} />
        <ToggleSetting label="Show affiliate teams in filters" storageKey="show_affiliates" defaultValue={true} />
      </div>

      {/* ABOUT */}
      <div>
        <SectionHeader title="About" />
        <div style={{ padding: "20px", backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-color)", borderRadius: "4px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <span style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "20px", color: "var(--accent-gold)", letterSpacing: "0.1em" }}>⚾ BUMPDAY</span>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--text-primary)", margin: 0 }}>Saints Data Matrix — 2026 Season</p>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-secondary)", margin: 0 }}>v0.1.0</p>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>Built by Derek Stoetzer</p>
        </div>
      </div>

    </div>
  );
}