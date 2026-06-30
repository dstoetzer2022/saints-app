export const PAPER = '#f4f2ec';
export const NAVY = '#0e253a';
export const GOLD = '#c6b583';
export const INK = '#1a1a1a';
export const BORDER = '#cdc8bd';
export const TINT = '#faf9f5';

export const TEAM_NAME_MAP = {
  ARR_SEC: 'Arroyo Seco Saints',
  SAN_LUI: 'San Luis Obispo Blues',
  SAN_BAR: 'Santa Barbara Foresters',
  SON_STO: 'Sonoma Stompers',
  WAL_CRE: 'Walnut Creek Crawdads',
  ORA_COU2: 'Orange County Riptide',
  CON_OAK: 'Conejo Oaks',
  MLB_ACA: 'MLB Academy Barons',
  PHI_BAS: 'Philippines Baseball Group',
  MEN_PAR: 'Menlo Park Legends',
  ALA_MER: 'Alameda Merchants',
  SAN_DIE_24: 'San Diego Bombers',
  SAN_FRA: 'San Francisco Seagulls',
  SAN_DIE: 'San Diego Waves',
  SAN_MAR: 'Santa Maria Indians',
};

// ── Canonical pitch type palette ─────────────────────────────────────────────
// Single source of truth for all pitch colors across the app.
export const PITCH_COLORS = {
  'Four-Seam':   '#E24B4A',
  Sinker:        '#BA7517',
  Cutter:        '#EF9F27',
  Slider:        '#378ADD',
  Sweeper:       '#534AB7',
  Curveball:     '#1D9E75',
  Knucklecurve:  '#0F6E56',
  ChangeUp:      '#D4537E',
  Splitter:      '#993C1D',
  Undefined:     '#888780',
  Other:         '#888780',
};

// Normalize raw Trackman pitch type strings to canonical display names.
export function normalizePitch(pt) {
  if (!pt) return 'Undefined';
  const lower = pt.toLowerCase().trim();
  if (['fourseamfastball','four-seam','4-seam','fastball','ff'].includes(lower)) return 'Four-Seam';
  if (['twoseamfastball','two-seam','2-seam','sinker','si'].includes(lower)) return 'Sinker';
  if (['cutter','fc'].includes(lower)) return 'Cutter';
  if (['slider','sl'].includes(lower)) return 'Slider';
  if (['sweeper','st'].includes(lower)) return 'Sweeper';
  if (['curveball','cb','cu','curve'].includes(lower)) return 'Curveball';
  if (['knucklecurve','kc','knuckle curve','knuckleball'].includes(lower)) return 'Knucklecurve';
  if (['changeup','ch','change up','cho'].includes(lower)) return 'ChangeUp';
  if (['splitter','fs','split'].includes(lower)) return 'Splitter';
  return pt;
}

// Universal color lookup — normalizes first, then looks up.
// All components should use this instead of local color maps.
export function getPitchColor(pt) {
  if (!pt) return PITCH_COLORS.Other;
  return PITCH_COLORS[normalizePitch(pt)] || PITCH_COLORS.Other;
}

// Legacy alias
export function pitchColor(pt) { return getPitchColor(pt); }

export const inputStyle = {
  border: `1.5px solid ${BORDER}`,
  borderRadius: 5,
  background: '#fff',
  color: INK,
  fontSize: 13,
  padding: '6px 9px',
  fontFamily: "'Archivo', sans-serif",
  width: '100%',
  outline: 'none',
};

export const labelStyle = {
  display: 'block',
  fontWeight: 600,
  fontSize: 12,
  color: NAVY,
  marginBottom: 4,
  letterSpacing: '0.02em',
};

export function fmt(v, d = 1) {
  if (v === null || v === undefined || isNaN(Number(v))) return '—';
  return Number(v).toFixed(d);
}

export function avg(arr) {
  const valid = arr.filter(v => v !== null && v !== undefined && !isNaN(v));
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}