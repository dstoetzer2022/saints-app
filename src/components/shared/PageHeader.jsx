import React from "react";

export default function PageHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: "24px" }}>
      <h1 style={{
        fontFamily: "var(--font-heading)",
        fontWeight: 700,
        fontSize: "28px",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "var(--text-primary)",
        lineHeight: 1,
        margin: 0,
      }}>
        {title}
      </h1>
      {subtitle && (
        <p style={{
          fontFamily: "var(--font-body)",
          fontSize: "13px",
          color: "var(--text-secondary)",
          marginTop: "4px",
          marginBottom: 0,
        }}>
          {subtitle}
        </p>
      )}
      <div style={{
        width: "40px",
        height: "1px",
        backgroundColor: "var(--accent-gold)",
        marginTop: "8px",
      }} />
    </div>
  );
}