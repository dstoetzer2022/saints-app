import React from 'react';

const ArmSlotCard = ({ avgVertRelAngle, avgHorzRelAngle, avgRelHeight, avgRelSide, pitcherHand }) => {
  const CX = 130;
  const CY = 130;
  const R = 95;
  const isRight = pitcherHand === "Right";
  const color = isRight ? "#185FA5" : "#3B6D11";

  // Arm angle: 90 = overhand, 0 = sidearm
  // Use absolute values of both angles since vert_rel_angle is negative by Trackman convention
  const armAngle = Math.round(
    90 - Math.abs(Math.atan2(Math.abs(avgHorzRelAngle), Math.abs(avgVertRelAngle)) * 180 / Math.PI)
  );
  const angleRad = (armAngle * Math.PI) / 180;

  // Slot label
  const slotLabel = armAngle >= 75 ? "overhand"
    : armAngle >= 55 ? "high ¾"
    : armAngle >= 35 ? "¾"
    : armAngle >= 18 ? "low ¾"
    : "sidearm";

  // Tip X: RHP arm is on LEFT side of SVG (catcher's POV), so we subtract cos from CX
  // Tip Y: arm goes UP in SVG space, so we subtract sin from CY
  // (SVG Y axis increases downward, so subtracting puts us in the upper half)
  const rawTipX = isRight
    ? CX - Math.cos(angleRad) * R
    : CX + Math.cos(angleRad) * R;
  const rawTipY = CY - Math.sin(angleRad) * R;

  // Apply rel_side shift: positive rel_side for RHP means arm-side (further left in SVG)
  const sideClamp = Math.max(-4, Math.min(4, avgRelSide));
  // RHP: positive rel_side shifts dot further LEFT (negative SVG X direction)
  // LHP: positive rel_side (which would be negative/glove-side) shifts RIGHT
  const sideShiftX = isRight ? -(sideClamp / 4) * 28 : (sideClamp / 4) * 28;
  const shiftedX = rawTipX + sideShiftX;
  const shiftedY = rawTipY;

  // Normalize back onto the rim
  const dx = shiftedX - CX;
  const dy = shiftedY - CY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const tipX = CX + (dx / dist) * R;
  const tipY = CY + (dy / dist) * R;

  // Arm curve points
  const shoulderX = isRight ? CX - 32 : CX + 32;
  const shoulderY = CY + 20;
  const bodyX = isRight ? CX - 10 : CX + 10;
  const bodyY = CY + 70;
  const midX = (shoulderX + tipX) / 2 + (isRight ? -18 : 18);
  const midY = (shoulderY + tipY) / 2 + 10;

  // Label position near dot
  const labelX = tipX + (isRight ? -14 : 14);
  const labelAnchor = isRight ? "end" : "start";

  // Slot label positions (left side for RHP, right side for LHP)
  const slots = [
    { key: "oh",  y: 46,  label: "overhand" },
    { key: "h34", y: 82,  label: "high ¾" },
    { key: "34",  y: 130, label: "¾" },
    { key: "l34", y: 178, label: "low ¾" },
    { key: "sa",  y: 210, label: "sidearm" },
  ];
  const slotX = isRight
    ? [90, 52, 36, 52, 90]
    : [170, 208, 224, 208, 170];
  const slotAnchor = "middle";

  const sideSign = avgRelSide >= 0 ? "+" : "";

  return (
    <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "1.25rem" }}>
      <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-secondary)", margin: "0 0 8px" }}>Arm slot</p>
      <span style={{ display: "inline-block", fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 20, marginBottom: 10, background: isRight ? "#e6f1fb" : "#EAF3DE", color: isRight ? "#0C447C" : "#27500A" }}>
        {isRight ? "RHP" : "LHP"}
      </span>

      <svg viewBox="0 0 260 260" style={{ width: "100%", maxWidth: 180, display: "block", margin: "0 auto" }}>
        <circle cx={CX} cy={CY} r={R} fill="var(--color-background-secondary)" stroke="var(--color-border-secondary)" strokeWidth={1} />
        <line x1={CX} y1={CY - R} x2={CX} y2={CY + R} stroke="var(--color-border-secondary)" strokeWidth={0.5} strokeDasharray="4,3" />
        <line x1={CX - R} y1={CY} x2={CX + R} y2={CY} stroke="var(--color-border-secondary)" strokeWidth={0.5} strokeDasharray="4,3" />
        <text x={CX} y={CY - R - 8} textAnchor="middle" fontSize={9} fill="var(--color-text-secondary)">12</text>
        <text x={CX + R + 8} y={CY + 4} textAnchor="start" fontSize={9} fill="var(--color-text-secondary)">3</text>
        <text x={CX} y={CY + R + 14} textAnchor="middle" fontSize={9} fill="var(--color-text-secondary)">6</text>
        <text x={CX - R - 8} y={CY + 4} textAnchor="end" fontSize={9} fill="var(--color-text-secondary)">9</text>

        {slots.map((s, i) => (
          <text key={s.key} x={slotX[i]} y={s.y} textAnchor={slotAnchor} fontSize={8} fill="var(--color-text-tertiary)">{s.label}</text>
        ))}

        <circle cx={CX} cy={CY} r={3} fill="var(--color-text-secondary)" opacity={0.4} />

        {/* Head */}
        <circle cx={isRight ? CX - 28 : CX + 28} cy={CY + 5} r={10} fill={color} fillOpacity={0.35} />
        <circle cx={isRight ? CX - 28 : CX + 28} cy={CY + 5} r={7} fill={color} fillOpacity={0.6} />

        {/* Body stub */}
        <line x1={bodyX} y1={bodyY} x2={shoulderX} y2={shoulderY} stroke={color} strokeWidth={5} strokeLinecap="round" opacity={0.2} />

        {/* Arm curve */}
        <path d={`M ${shoulderX} ${shoulderY} Q ${midX} ${midY} ${tipX} ${tipY}`} fill="none" stroke={color} strokeWidth={5} strokeLinecap="round" />

        {/* Release dot */}
        <circle cx={tipX} cy={tipY} r={10} fill={color} opacity={0.12} />
        <circle cx={tipX} cy={tipY} r={6} fill={color} />

        {/* Dashed line back to center */}
        <line x1={tipX} y1={tipY} x2={CX} y2={CY} stroke={color} strokeWidth={1} strokeDasharray="3,3" opacity={0.35} />

        {/* Angle label */}
        <text x={labelX} y={tipY - 12} textAnchor={labelAnchor} fontSize={10} fontWeight={500} fill={color}>{armAngle}°</text>
      </svg>

      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <div style={{ flex: 1, background: "var(--color-background-secondary)", borderRadius: 8, padding: "8px 12px" }}>
          <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: "0 0 2px" }}>Arm angle</p>
          <p style={{ fontSize: 17, fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>{armAngle}° <span style={{ fontSize: 11, color: "var(--color-text-secondary)", fontWeight: 400 }}>{slotLabel}</span></p>
        </div>
        <div style={{ flex: 1, background: "var(--color-background-secondary)", borderRadius: 8, padding: "8px 12px" }}>
          <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: "0 0 2px" }}>Rel height</p>
          <p style={{ fontSize: 17, fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>{avgRelHeight.toFixed(2)} <span style={{ fontSize: 11, color: "var(--color-text-secondary)", fontWeight: 400 }}>ft</span></p>
        </div>
        <div style={{ flex: 1, background: "var(--color-background-secondary)", borderRadius: 8, padding: "8px 12px" }}>
          <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: "0 0 2px" }}>Rel side</p>
          <p style={{ fontSize: 17, fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>{sideSign}{avgRelSide.toFixed(1)} <span style={{ fontSize: 11, color: "var(--color-text-secondary)", fontWeight: 400 }}>ft</span></p>
        </div>
      </div>
    </div>
  );
};

export default ArmSlotCard;