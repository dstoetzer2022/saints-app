// ── Live Scout dark theme ────────────────────────────────────────────────
// Approved mockups, 2026-07-15 (v1/v2/v3): PitcherScoutPanel, CatcherScoutPanel,
// RunnerScoutPanel, and SubstitutionForm previously pulled NAVY/GOLD/BORDER/TINT
// from src/lib/ds.js — a light "paper" palette meant for print reports — and
// rendered as stark white cards inside LiveScoutingHub's dark navy shell. That
// mismatch (not any single control) was the main "hard to look at" driver.
// This file is a parallel dark palette for those four components only; ds.js
// itself is untouched since it's shared by print reports and other screens
// that still need the light theme.
export const NAVY_DARK = '#07111c';
export const GOLD = '#c6b583';
export const CREAM = '#f0ece0';
export const LINE = 'rgba(198,181,131,0.15)';
export const LINE_SOFT = 'rgba(198,181,131,0.13)';
export const PANEL = 'rgba(255,255,255,0.045)';
export const PANEL_HI = 'rgba(255,255,255,0.07)';
export const GREEN = '#4ade80';
export const RED = '#f87171';
export const AMBER = '#facc15';
export const FONT = "'Archivo', sans-serif";

// Minimum comfortable tap target in a dugout, not at a desk.
export const TAP = 44;

export const darkInputStyle = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 7,
  color: CREAM,
  fontSize: 14,
  padding: '11px 13px',
  fontFamily: FONT,
  width: '100%',
  outline: 'none',
  minHeight: TAP,
  boxSizing: 'border-box',
};

export const darkLabelStyle = {
  display: 'block',
  fontWeight: 800,
  fontSize: 10,
  color: 'rgba(255,255,255,0.4)',
  textTransform: 'uppercase',
  letterSpacing: '0.8px',
  marginBottom: 8,
};

export const darkSectionBoxStyle = {
  background: 'rgba(0,0,0,0.18)',
  border: `1px solid ${LINE_SOFT}`,
  borderRadius: 10,
  padding: '14px 16px',
  marginBottom: 14,
};

export const darkSectionHeadStyle = {
  fontWeight: 800,
  fontSize: 10.5,
  color: GOLD,
  textTransform: 'uppercase',
  letterSpacing: 1,
  marginBottom: 12,
};
