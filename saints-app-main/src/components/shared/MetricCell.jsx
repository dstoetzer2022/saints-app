import React from "react";

const GREEN = "#1A7A3A";
const YELLOW = "#8A7000";
const RED = "#7A1A1A";
const GOLD = "#C8A84B";

// Full-opacity colors for border/text
const GREEN_BRIGHT = "#2AB04A";
const YELLOW_BRIGHT = "#C8A800";
const RED_BRIGHT = "#C83030";
const GOLD_BRIGHT = "#C8A84B";

function getColor(metric, value) {
  if (value === null || value === undefined || isNaN(Number(value))) return null;
  const v = Number(value);

  switch (metric) {
    case "k_bb_pct": {
      const pct = v * 100;
      if (pct < 0) return [RED, RED_BRIGHT];
      if (pct < 5) return [YELLOW, YELLOW_BRIGHT];
      if (pct < 10) return [GREEN, GREEN_BRIGHT];
      return [GOLD, GOLD_BRIGHT];
    }
    case "whiff_pct": {
      if (v < 20) return [RED, RED_BRIGHT];
      if (v < 27) return [YELLOW, YELLOW_BRIGHT];
      if (v < 35) return [GREEN, GREEN_BRIGHT];
      return [GOLD, GOLD_BRIGHT];
    }
    case "zone_pct": {
      if (v < 42) return [RED, RED_BRIGHT];
      if (v < 48) return [YELLOW, YELLOW_BRIGHT];
      if (v < 55) return [GREEN, GREEN_BRIGHT];
      return [YELLOW, YELLOW_BRIGHT];
    }
    case "ab_per_xbh": {
      if (v < 5) return [RED, RED_BRIGHT];
      if (v < 8) return [YELLOW, YELLOW_BRIGHT];
      return [GREEN, GREEN_BRIGHT];
    }
    case "slug_pct": {
      if (v > 0.45) return [RED, RED_BRIGHT];
      if (v > 0.35) return [YELLOW, YELLOW_BRIGHT];
      return [GREEN, GREEN_BRIGHT];
    }
    case "hard_hit_pct": {
      if (v > 0.40) return [RED, RED_BRIGHT];
      if (v > 0.30) return [YELLOW, YELLOW_BRIGHT];
      return [GREEN, GREEN_BRIGHT];
    }
    default:
      return null;
  }
}

function formatValue(metric, value) {
  if (value === null || value === undefined || isNaN(Number(value))) return null;
  const v = Number(value);
  switch (metric) {
    case "k_bb_pct": return (v * 100).toFixed(1) + "%";
    case "whiff_pct": return v.toFixed(1) + "%";
    case "zone_pct": return v.toFixed(1) + "%";
    case "ab_per_xbh": return v.toFixed(1);
    case "slug_pct": return v.toFixed(3);
    case "hard_hit_pct": return (v * 100).toFixed(1) + "%";
    default: return String(v);
  }
}

export default function MetricCell({ value, metric, nullDisplay = "—", className = "" }) {
  const isNull = value === null || value === undefined || (typeof value === "number" && isNaN(value));

  if (isNull) {
    return (
      <td
        className={className}
        style={{
          textAlign: "right",
          padding: "0 8px",
          height: "28px",
          fontFamily: "var(--font-mono)",
          fontSize: "12px",
          color: "var(--text-muted)",
        }}
      >
        {nullDisplay}
      </td>
    );
  }

  const colors = getColor(metric, value);
  const display = formatValue(metric, value);
  const [bgColor, textColor] = colors || [null, "var(--text-primary)"];

  return (
    <td
      className={className}
      style={{
        textAlign: "right",
        padding: "0 8px",
        height: "28px",
        fontFamily: "var(--font-mono)",
        fontSize: "12px",
        color: bgColor ? textColor : "var(--text-primary)",
        backgroundColor: bgColor ? bgColor + "1F" : "transparent",
        borderLeft: bgColor ? `2px solid ${textColor}` : undefined,
      }}
    >
      {display}
    </td>
  );
}