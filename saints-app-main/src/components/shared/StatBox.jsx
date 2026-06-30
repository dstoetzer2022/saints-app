import React from "react";

export default function StatBox({ label, value, sub, accent = false, destructive = false }) {
  return (
    <div style={{ textAlign: "center" }}>
      <p style={{
        fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "11px",
        textTransform: "uppercase", letterSpacing: "0.1em",
        color: "var(--text-secondary)", marginBottom: "4px",
      }}>{label}</p>
      <p style={{
        fontFamily: "var(--font-mono)", fontSize: "28px", fontWeight: 400,
        color: destructive ? "var(--accent-red)" : accent ? "var(--accent-red)" : "var(--text-primary)",
        lineHeight: 1,
      }}>
        {value ?? "—"}
      </p>
      {sub && (
        <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>{sub}</p>
      )}
    </div>
  );
}