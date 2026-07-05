// Single source of truth for the Data Repository / reports dark palette.
// Previously this object was copy-pasted into 9 separate files, which is how
// the muted-color WCAG contrast fix (see below) only ever landed in one of
// them. Import C from here instead of redeclaring it locally.
export const C = {
  base:    '#080f17',
  surface: '#0d1a26',
  raised:  '#111f2e',
  edge:    '#192c3e',
  rim:     '#1e3448',
  gold:    '#c8920c',
  goldDim: '#8a6308',
  cream:   '#edeae0',
  muted:   '#7d93a6', // was #5a7080 — 3.4:1 on surface, below WCAG AA for small text
  faint:   '#253545',
  white:   '#f8f8f4',
  green:   '#21c55d',
  amber:   '#e8a800',
  red:     '#e84040',
};

export const FONT = "'Archivo', system-ui, sans-serif";
