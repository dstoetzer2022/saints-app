import React from "react";

export default function SectionHeader({ title }) {
  return (
    <div style={{ borderBottom: "1px solid var(--accent-gold)", paddingBottom: "8px" }}>
      <h1 style={{
        fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "16px",
        textTransform: "uppercase", letterSpacing: "0.1em",
        color: "var(--accent-gold)", margin: 0,
      }}>
        {title}
      </h1>
    </div>
  );
}