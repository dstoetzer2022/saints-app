import React from "react";

export default function GlassCard({ children, className = "", noPadding = false, accentColor = null }) {
  return (
    <div
      className={className}
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-color)",
        borderRadius: "4px",
        padding: noPadding ? 0 : "16px",
        borderTop: accentColor ? `2px solid ${accentColor}` : undefined,
      }}
    >
      {children}
    </div>
  );
}