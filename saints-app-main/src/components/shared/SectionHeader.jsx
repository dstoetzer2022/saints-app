import React from "react";

export default function SectionHeader({ title }) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <span style={{
        fontFamily: "var(--font-heading)",
        fontWeight: 700,
        fontSize: "14px",
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        color: "var(--text-primary)",
      }}>
        {title}
      </span>
      <div style={{ width: "32px", height: "2px", backgroundColor: "var(--accent-gold)", marginTop: "4px" }} />
    </div>
  );
}