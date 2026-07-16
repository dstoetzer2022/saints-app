// ── Official Team Stats PDF parser ──────────────────────────────────────────
// Ported from the standalone dugout_stat_sheet_3.html tool. Parses a
// PrestoSports "Print Version" coach stats export (the same text-table
// format CCL uses) into structured hitter/pitcher rows + team totals.
// Client-side only — nothing here touches Base44; callers decide what to
// do with the parsed result (currently: build a Team Report page, no save).
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// Column schemas — order matches the PrestoSports coach export exactly.
export const H_COLS = ['AVG', 'GP', 'GS', 'AB', 'R', 'H', '2B', '3B', 'HR', 'RBI', 'TB', 'SLG', 'BB', 'HBP', 'SO', 'GDP', 'OB', 'SF', 'SH', 'SB', 'CS', 'PO', 'A', 'E', 'FLD'];
export const P_COLS = ['ERA', 'W', 'L', 'APP', 'GS', 'CG', 'SHO', 'SV', 'IP', 'H', 'R', 'ER', 'BB', 'SO', '2B', '3B', 'HR', 'AB', 'BAVG', 'WP', 'HBP', 'BK', 'SFA', 'SHA'];

// Trimmed column set for the Comprehensive Team Report (landscape) — approved
// mockup (2026-07-15), refined per Derek's note (2026-07-16): AVG/OBP/SLG
// grouped together right after the name (slash-line style); pitcher table
// drops CG/SHO/BK/SFA/SHA/AB and moves BAVG next to ERA. Standalone Team
// Stats Sheet (portrait) keeps the full H_COLS/P_COLS above.
export const H_COLS_CONSOLIDATED = ['AVG', 'OB', 'SLG', 'AB', 'H', '2B', '3B', 'HR', 'RBI', 'BB', 'HBP', 'SO', 'SB', 'CS'];
export const P_COLS_CONSOLIDATED = ['ERA', 'BAVG', 'IP', 'H', 'R', 'ER', 'BB', 'SO', '2B', '3B', 'HR', 'WP', 'HBP'];

// Speed fill colors — the only place red/yellow/green scheming is used in
// the app (per Derek's instruction, 2026-07-15). speed_rating on
// BaserunnerObservation is stored lowercase ('fast'/'average'/'slow').
export const SPEED_FILL = { fast: '#1a7a3a', average: '#a8780a', slow: '#b53030' };
export const SPEED_LABEL = { fast: 'Fast', average: 'Average', slow: 'Slow' };

export const N = v => { if (v == null) return 0; v = String(v).trim(); if (v === '-' || v === '') return 0; return parseFloat(v.replace(/^\./, '0.')) || 0; };
// IP is recorded as whole.outs (x.1 = 1 out, x.2 = 2 outs), not decimal — convert to real innings.
export const trueIP = v => { const n = N(v); const whole = Math.trunc(n); const frac = Math.round((n - whole) * 10); return whole + (frac === 1 ? 1 / 3 : frac === 2 ? 2 / 3 : 0); };
export const raw = v => (v == null || v === '') ? '-' : String(v).trim();

// ── Extract raw text from a PDF File, reconstructing lines by y-position ──
export async function readPdf(file) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const c = await page.getTextContent();
    const rowsMap = {};
    c.items.forEach(it => {
      const y = Math.round(it.transform[5]);
      (rowsMap[y] = rowsMap[y] || []).push({ x: it.transform[4], s: it.str });
    });
    Object.keys(rowsMap).map(Number).sort((a, b) => b - a).forEach(y => {
      const line = rowsMap[y].sort((a, b) => a.x - b.x).map(o => o.s).join(' ').replace(/\s+/g, ' ');
      text += line + '\n';
    });
  }
  return text;
}

// ── Parse one team-stats text blob into {team, record, hitters, pitchers, totals} ──
export function parseStats(text) {
  const lines = text.split('\n');
  let team = '', record = {};
  for (const ln of lines) {
    let m = ln.match(/Baseball Statistics\s*-\s*(.+?)\s*$/); if (m && !team) team = m[1].trim();
    m = ln.match(/Record:\s*([\d-]+)/); if (m) record.overall = m[1];
    m = ln.match(/Home:\s*([\d-]+)/); if (m) record.home = m[1];
    m = ln.match(/Away:\s*([\d-]+)/); if (m) record.away = m[1];
    m = ln.match(/Conf:\s*([\d-]+)/); if (m) record.conf = m[1];
  }
  const hitters = [], pitchers = []; let totals = {};
  for (const ln of lines) {
    // Total / Opponents rows
    const tm = ln.match(/^\s*(Total|Opponents)\.{2,}\s*(.*)$/);
    if (tm) {
      const toks = tm[2].trim().split(/\s+/);
      if (toks.length >= 24 && /^\.\d|^\d\.\d|^1\.000/.test(toks[0])) {
        // hitter total starts with AVG (.xxx); pitcher total starts with ERA (n.nn)
        if (tm[1] === 'Total' && !totals.hit && /^\.\d/.test(toks[0])) totals.hit = toks;
        if (tm[1] === 'Total' && /^\d+\.\d\d$/.test(toks[0])) totals.pit = toks;
        if (tm[1] === 'Opponents' && /^\.\d/.test(toks[0])) totals.hitOpp = toks;
        if (tm[1] === 'Opponents' && /^\d+\.\d\d$/.test(toks[0])) totals.pitOpp = toks;
      }
      continue;
    }
    const m = ln.match(/^\s*(\d+)\s+(.*)$/);
    if (!m) continue;
    const [, num, rest] = m;
    const allToks = rest.trim().split(/\s+/);
    // Long names (e.g. "Noah Aguilar-Tanphanich") fill the fixed-width name
    // column and PrestoSports drops the dot-leader entirely for them — so
    // we can't rely on ".{2,}" between name and stats. Instead: take the
    // last N tokens as stats (N is fixed by column count) and whatever's
    // left is the name, regardless of whether a dot-leader is present.
    if (allToks.length >= 25) {
      const statToks = allToks.slice(-25);
      if (/^\.?\d{3}$|^1\.000$/.test(statToks[0])) {
        const name = allToks.slice(0, allToks.length - 25).join(' ').replace(/\.+$/, '').trim();
        if (name) {
          const o = { num, name }; H_COLS.forEach((c, i) => o[c] = statToks[i]); hitters.push(o);
          continue;
        }
      }
    }
    if (allToks.length >= 24) {
      const statToks = allToks.slice(-24);
      if (/^\d+\.\d\d$/.test(statToks[0])) {
        const name = allToks.slice(0, allToks.length - 24).join(' ').replace(/\.+$/, '').trim();
        if (name) {
          const o = { num, name }; P_COLS.forEach((c, i) => o[c] = statToks[i]); pitchers.push(o);
        }
      }
    }
  }
  return { team, record, hitters, pitchers, totals };
}

// ── Leader selection with sample-size gates ──
export function hitterLeaders(hitters) {
  // Gate: meaningful sample. Require AB >= max(15, 40% of team-leading AB) and GP>=5.
  const maxAB = Math.max(...hitters.map(h => N(h.AB)), 1);
  const gateAB = Math.max(15, Math.round(maxAB * 0.4));
  const pool = hitters.filter(h => N(h.AB) >= gateAB && N(h.GP) >= 5);
  // Rank by OPS (OB + SLG) — best all-around production
  const scored = pool.map(h => ({ h, ops: N(h.OB) + N(h.SLG) }));
  scored.sort((a, b) => b.ops - a.ops);
  return { list: scored.slice(0, 5), gate: `min ${gateAB} AB · 5+ GP` };
}
export function pitcherLeaders(pitchers) {
  // Gate: require IP >= max(10, 25% of team-leading IP) and APP>=3.
  const maxIP = Math.max(...pitchers.map(p => trueIP(p.IP)), 1);
  const gateIP = Math.max(10, Math.round(maxIP * 0.25));
  const pool = pitchers.filter(p => trueIP(p.IP) >= gateIP && N(p.APP) >= 3);
  // Rank by ERA asc, then K/9 desc as tiebreak
  const scored = pool.map(p => ({ p, era: N(p.ERA), k9: trueIP(p.IP) > 0 ? N(p.SO) / trueIP(p.IP) * 9 : 0 }));
  scored.sort((a, b) => a.era - b.era || b.k9 - a.k9);
  return { list: scored.slice(0, 5), gate: `min ${gateIP} IP · 3+ APP` };
}

// Convenience: File -> parsed data, one call.
export async function parseOfficialStatsPdf(file) {
  const text = await readPdf(file);
  const data = parseStats(text);
  if (!data.hitters.length && !data.pitchers.length) {
    throw new Error('Could not find stat rows. Is this the PrestoSports "Print Version" export?');
  }
  return data;
}
