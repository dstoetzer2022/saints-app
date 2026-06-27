import React from "react";

export default function EmptyState({ icon: Icon, headline, subtext }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "48px 24px", gap: "8px", textAlign: "center",
    }}>
      {Icon && <Icon style={{ width: "36px", height: "36px", color: "var(--text-muted)", marginBottom: "4px" }} />}
      <p style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "16px", color: "var(--text-secondary)", margin: 0 }}>
        {headline}
      </p>
      {subtext && (
        <p style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
          {subtext}
        </p>
      )}
    </div>
  );
}