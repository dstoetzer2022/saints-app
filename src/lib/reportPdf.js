// ─────────────────────────────────────────────────────────────────────────────
// reportPdf.js — shared PDF generation + print fallback for dugout scouting reports
//
// Two output paths driven off ONE spec so they never drift:
//   • generateReportPdf()  → real downloadable PDF (jsPDF + autotable, CDN-loaded)
//   • openPrintWindow()    → clean browser print fallback (self-contained HTML)
//
// jsPDF is loaded from CDN at runtime (no package.json / build-step change), so
// this drops straight into the Cloudflare Pages deploy via GitHub Desktop with
// nothing to `npm install`. First call fetches the scripts (~cached after).
//
// Landscape Letter. Saints navy/gold. Color-coded metrics. Repeating headers.
// ─────────────────────────────────────────────────────────────────────────────

// ── Print-safe palette (ink-friendly, matches the on-screen dark theme intent) ─
export const PC = {
  navy:  '#0e253a',
  navy2: '#1c3a56',
  gold:  '#c8920c',
  ink:   '#111111',
  muted: '#777777',
  faint: '#eeeeee',
  zebra: '#f6f7f9',
  green: '#1a7a3a',
  red:   '#b53030',
  amber: '#a8780a',
};

const CDN = {
  jspdf:     'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js',
  autotable: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.4/jspdf.plugin.autotable.min.js',
};

let _libPromise = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === '1') return resolve();
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)));
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => { s.dataset.loaded = '1'; resolve(); };
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

// Load jsPDF core + autotable plugin exactly once. Returns the jsPDF constructor.
export async function ensurePdfLib() {
  if (window.jspdf?.jsPDF && window.jspdf.jsPDF.API?.autoTable) {
    return window.jspdf.jsPDF;
  }
  if (!_libPromise) {
    _libPromise = (async () => {
      await loadScript(CDN.jspdf);
      await loadScript(CDN.autotable);
      // autotable attaches to jsPDF.API; give the browser a tick to wire it up
      let tries = 0;
      while (!(window.jspdf?.jsPDF?.API?.autoTable) && tries < 40) {
        await new Promise(r => setTimeout(r, 25));
        tries++;
      }
      if (!window.jspdf?.jsPDF) throw new Error('jsPDF failed to initialize');
      return window.jspdf.jsPDF;
    })().catch(err => { _libPromise = null; throw err; });
  }
  return _libPromise;
}

// hex "#rrggbb" → [r,g,b] for jsPDF
export function rgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// ── Core generator ───────────────────────────────────────────────────────────
// spec = {
//   filename, title, team, meta,
//   sections: [{ headerColor, label?, columns:[{header,width,align}], rows:[[cell,...]],
//                cellStyles?: fn(rowIdx,colIdx)->{textColor?} }],
//   legend?: string (plain text, colored dots not supported in the simple footer),
// }
// Each cell = { text, color?, bold?, italic?, align? } | string
export async function generateReportPdf(spec) {
  const JsPDF = await ensurePdfLib();
  const doc = new JsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const M = 46; // ~0.64in
  let y = 34;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...rgb(PC.muted));
  doc.text((spec.title || '').toUpperCase(), M, y);
  y += 16;
  doc.setFontSize(19);
  doc.setTextColor(...rgb(PC.ink));
  doc.text(spec.team || '', M, y);
  y += 13;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...rgb(PC.muted));
  doc.text(spec.meta || '', M, y);
  y += 8;
  doc.setDrawColor(...rgb(PC.ink));
  doc.setLineWidth(1.5);
  doc.line(M, y, pageW - M, y);
  y += 6;

  spec.sections.forEach((sec, si) => {
    if (sec.label) {
      // section bar
      const barColor = sec.headerColor || PC.navy;
      doc.setFillColor(...rgb(barColor));
      doc.rect(M, y, pageW - M * 2, 18, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text(sec.label.toUpperCase(), M + 8, y + 12.5);
      y += 22;
    }

    const head = [sec.columns.map(c => c.header)];
    const body = sec.rows.map(r => r.map(cell => (typeof cell === 'string' ? cell : cell.text)));

    doc.autoTable({
      startY: y,
      head,
      body,
      margin: { left: M, right: M },
      tableWidth: pageW - M * 2,
      styles: { font: 'helvetica', fontSize: 8, cellPadding: { top: 3.5, bottom: 3.5, left: 5, right: 5 }, lineColor: rgb(PC.faint), lineWidth: 0.5, textColor: rgb(PC.ink), valign: 'middle', overflow: 'linebreak' },
      headStyles: { fillColor: rgb(sec.headerColor || PC.navy), textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5, cellPadding: { top: 4, bottom: 4, left: 5, right: 5 }, lineWidth: { bottom: 1.5 }, lineColor: rgb(PC.gold) },
      alternateRowStyles: { fillColor: rgb(PC.zebra) },
      columnStyles: sec.columns.reduce((acc, c, i) => {
        acc[i] = { halign: c.align || 'left', cellWidth: c.width ? c.width : 'auto' };
        return acc;
      }, {}),
      didParseCell: (data) => {
        if (data.section !== 'body') return;
        const cell = sec.rows[data.row.index]?.[data.column.index];
        if (cell && typeof cell === 'object') {
          if (cell.color) data.cell.styles.textColor = rgb(cell.color);
          if (cell.fill) data.cell.styles.fillColor = rgb(cell.fill);
          if (cell.bold) data.cell.styles.fontStyle = cell.italic ? 'bolditalic' : 'bold';
          else if (cell.italic) data.cell.styles.fontStyle = 'italic';
          if (cell.align) data.cell.styles.halign = cell.align;
        }
      },
    });
    y = doc.lastAutoTable.finalY + (si < spec.sections.length - 1 ? 14 : 8);
  });

  if (spec.legend) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...rgb(PC.muted));
    const lines = doc.splitTextToSize(spec.legend, pageW - M * 2);
    doc.text(lines, M, y + 4);
  }

  doc.save(spec.filename || 'report.pdf');
}

// ── Print fallback ───────────────────────────────────────────────────────────
// Builds a self-contained HTML doc (inline styles, background colors forced on)
// and opens it in a new window that auto-invokes print(). Column/row content is
// passed as pre-rendered HTML strings so the two paths share the same source data.
export function openPrintWindow({ title, team, meta, sectionsHtml, legendHtml }) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>${title} — ${team}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;700;800;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: 'Archivo', system-ui, sans-serif; color: ${PC.ink}; padding: 20px 24px; font-size: 10.5px; }
  .rt-title { font-size: 8px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: ${PC.muted}; }
  .rt-team { font-size: 20px; font-weight: 900; letter-spacing: -0.4px; color: ${PC.ink}; margin: 2px 0 1px; }
  .rt-meta { font-size: 9px; color: ${PC.muted}; }
  hr.rt-rule { border: none; border-top: 2px solid ${PC.ink}; margin: 6px 0 10px; }
  .rt-bar { font-size: 9px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; color: #fff; padding: 6px 9px; border-radius: 3px; margin: 14px 0 6px; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  th { font-size: 7.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #fff; text-align: left; padding: 5px 6px; white-space: nowrap; border-bottom: 1.5px solid ${PC.gold}; }
  td { padding: 4.5px 6px; border-bottom: 0.5px solid ${PC.faint}; vertical-align: middle; font-size: 9px; }
  tr:nth-child(even) td { background: ${PC.zebra}; }
  tr { page-break-inside: avoid; break-inside: avoid; }
  td.c, th.c { text-align: center; }
  td.name { font-weight: 800; white-space: nowrap; }
  td.notes { font-style: italic; color: #555; }
  .dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }
  .n { font-size: 7.5px; color: #999; }
  .tag { display: inline-block; background: #eef2f6; border-radius: 3px; padding: 1px 5px; margin: 1px 2px 1px 0; font-size: 8.5px; font-weight: 600; color: #334; }
  .rt-legend { font-size: 7.5px; color: ${PC.muted}; margin-top: 10px; padding-top: 4px; border-top: 0.5px solid ${PC.faint}; line-height: 1.5; }
  @page { size: letter landscape; margin: 16mm 14mm; }
</style></head>
<body>
  <div class="rt-title">${title}</div>
  <div class="rt-team">${team}</div>
  <div class="rt-meta">${meta}</div>
  <hr class="rt-rule"/>
  ${sectionsHtml}
  ${legendHtml ? `<div class="rt-legend">${legendHtml}</div>` : ''}
  <script>window.onload=function(){setTimeout(function(){window.print();},250);}<\/script>
</body></html>`;
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}

// ── Shared metric helpers (single source of truth for both paths) ─────────────
export function ttpColor(v) {
  if (v == null) return PC.ink;
  if (v <= 1.25) return PC.green;
  if (v >= 1.40) return PC.red;
  return PC.ink;
}
export function popColor(v) {
  if (v == null) return PC.ink;
  if (v <= 1.95) return PC.green;
  if (v >= 2.15) return PC.red;
  return PC.ink;
}
export function stealPctColor(pct) {
  if (pct == null) return PC.ink;
  if (pct >= 70) return PC.green;
  if (pct >= 50) return PC.amber;
  return PC.red;
}
export function mean(arr) {
  const v = (arr || []).filter(x => x != null && !isNaN(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
// Pop-time cleaning: TrackMan capture includes botched exchanges (>2.6s) and
// impossibly-fast partials (<1.5s). Return the fastest CLEAN reading as "best"
// plus a trimmed average that drops the single slowest clean value (3+ samples).
export function cleanPops(readings) {
  const raw = (readings || []).filter(v => v != null && !isNaN(v));
  const valid = raw.filter(v => v >= 1.5 && v <= 2.6).sort((a, b) => a - b);
  if (!valid.length) {
    const best = raw.length ? Math.min(...raw) : null;
    return { best, avg: mean(raw), nValid: 0, nRaw: raw.length };
  }
  const core = valid.length >= 3 ? valid.slice(0, -1) : valid;
  return { best: valid[0], avg: mean(core), nValid: valid.length, nRaw: raw.length };
}
