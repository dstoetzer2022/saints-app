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
  // AUDIT: suffixed Trackman codes observed in live data / code list
  SAN_FRA4: 'San Francisco Seagulls',
  SAN_DIE25: 'San Diego Waves',
  SAN_MAR6: 'Santa Maria Indians',
  ORA_COU: 'Orange County Riptide',
};

// ── Canonical pitch type palette ─────────────────────────────────────────────
// Single source of truth for all pitch colors across the app.
export const PITCH_COLORS = {
  'Four-Seam':   '#E24B4A',
  Sinker:        '#BA7517',
  Cutter:        '#EF9F27',
  Slider:        '#D4537E',
  Sweeper:       '#534AB7',
  Curveball:     '#1D9E75',
  Knucklecurve:  '#0F6E56',
  ChangeUp:      '#378ADD',
  Splitter:      '#993C1D',
  Undefined:     '#888780',
  Other:         '#888780',
};

// ── Pitch-type canonicalization (SINGLE SOURCE for the whole app) ────────────
// AUDIT: seasonAggregation previously kept its own TYPE_MAP that diverged from
// normalizePitch (e.g. "Four Seam Fastball" with spaces canonicalized in one
// but not the other). Both now share this separator-stripping map.
const TYPE_MAP = {
  fourseamfastball: 'Four-Seam', fourseam: 'Four-Seam', '4seam': 'Four-Seam', fastball: 'Four-Seam', ff: 'Four-Seam',
  oneseamfastball: 'Sinker', twoseamfastball: 'Sinker', twoseam: 'Sinker', '2seam': 'Sinker', sinker: 'Sinker', si: 'Sinker',
  cutter: 'Cutter', fc: 'Cutter',
  slider: 'Slider', sl: 'Slider',
  sweeper: 'Sweeper', st: 'Sweeper',
  curveball: 'Curveball', curve: 'Curveball', cb: 'Curveball', cu: 'Curveball',
  knucklecurve: 'Knucklecurve', kc: 'Knucklecurve',
  knuckleball: 'Knucklecurve', knuckle: 'Knucklecurve',
  changeup: 'ChangeUp', change: 'ChangeUp', ch: 'ChangeUp', cho: 'ChangeUp',
  splitter: 'Splitter', splitfinger: 'Splitter', split: 'Splitter', fs: 'Splitter',
};

// Canonicalize a raw type string; returns the trimmed raw string when unknown.
export function canonPitchType(raw) {
  if (!raw) return null;
  const key = String(raw).replace(/[\s_\-]/g, '').toLowerCase();
  return TYPE_MAP[key] || String(raw).trim();
}

// Normalize raw Trackman pitch type strings to canonical display names.
export function normalizePitch(pt) {
  if (!pt) return 'Undefined';
  return canonPitchType(pt) || 'Undefined';
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