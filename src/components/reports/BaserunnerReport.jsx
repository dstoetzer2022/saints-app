import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { normalizeName } from '@/lib/statsUtils';
import { C, FONT } from '@/lib/darkTheme';
import {
  generateReportPdf, openPrintWindow, PC,
  stealPctColor,
} from '@/lib/reportPdf';

const SPEED = {
  fast:    { c: '#0f5f2a', fill: '#c9ebd5', label: 'FAST' },
  average: { c: '#7a5800', fill: '#fbeecb', label: 'AVG'  },
  slow:    { c: '#8a2020', fill: '#f6d4d4', label: 'SLOW' },
};
const AGGR = {
  aggressive: { c: '#0f5f2a', fill: '#c9ebd5', label: 'AGGR' },
  average:    { c: '#7a5800', fill: '#fbeecb', label: 'AVG'  },
  passive:    { c: '#8a2020', fill: '#f6d4d4', label: 'PASS' },
};

const dash = '\u2014';

// Column layout shared by PDF + print (widths in pt for landscape letter)
const COLUMNS = [
  { header: '#',              key: 'jersey', width: 26,  align: 'center' },
  { header: 'RUNNER',         key: 'name',   width: 112, align: 'left'   },
  { header: 'POS',            key: 'pos',    width: 32,  align: 'center' },
  { header: 'B',              key: 'bats',   width: 24,  align: 'center' },
  { header: 'SPEED',          key: 'speed',  width: 68,  align: 'center' },
  { header: 'AGGRESSION',     key: 'aggr',   width: 74,  align: 'center' },
  { header: 'LEAD @ 1B',      key: 'lead',   width: 78,  align: 'left'   },
  { header: 'SB',             key: 'sb',     width: 66,  align: 'center' },
  { header: 'PICKOFFS',       key: 'po',     width: 58,  align: 'center' },
  { header: 'DIRT-BALL ADV',  key: 'dirt',   width: 76,  align: 'center' },
  { header: 'SCOUTING NOTES', key: 'notes',  align: 'left' },
];

function num(v) { return v != null && !isNaN(v) ? Math.round(v) : 0; }

export default function BaserunnerReport({ team, onClose }) {
  const [obs, setObs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    base44.entities.BaserunnerObservation
      .filter({ runner_team: team.name }, 'runner_name', 500)
      .then(data => {
        const map = {};
        data.forEach(o => {
          const key = normalizeName(o.runner_name).toLowerCase();
          if (!map[key]) {
            map[key] = { ...o };
          } else {
            const e = map[key];
            if (!e.speed_rating && o.speed_rating) e.speed_rating = o.speed_rating;
            if (!e.aggression_rating && o.aggression_rating) e.aggression_rating = o.aggression_rating;
            if (!e.lead_size_1b && o.lead_size_1b) e.lead_size_1b = o.lead_size_1b;
            if (!e.position && o.position) e.position = o.position;
            if (!e.jersey_number && o.jersey_number) e.jersey_number = o.jersey_number;
            e.steal_attempts     = num(e.steal_attempts)     + num(o.steal_attempts);
            e.steals_successful  = num(e.steals_successful)  + num(o.steals_successful);
            e.pickoff_attempts   = num(e.pickoff_attempts)   + num(o.pickoff_attempts);
            e.dirt_ball_advances = num(e.dirt_ball_advances) + num(o.dirt_ball_advances);
            if (o.notes && !e.notes) e.notes = o.notes;
          }
        });
        const sorted = Object.values(map).sort((a, b) => {
          const na = parseInt(a.jersey_number) || 999;
          const nb = parseInt(b.jersey_number) || 999;
          return na - nb || (a.runner_name || '').localeCompare(b.runner_name || '');
        });
        setObs(sorted);
        setLoading(false);
      }).catch(() => setLoading(false));
  }, [team.name]);

  const sbInfo = (o) => {
    const sa = num(o.steal_attempts), ss = num(o.steals_successful);
    if (!sa) return { text: dash, pct: null };
    const pct = Math.round(ss / sa * 100);
    return { sa, ss, pct };
  };

  const metaLine = () => {
    const sbAtt = obs.reduce((a, o) => a + num(o.steal_attempts), 0);
    const sbSuc = obs.reduce((a, o) => a + num(o.steals_successful), 0);
    const fast  = obs.filter(o => o.speed_rating === 'fast').length;
    const aggr  = obs.filter(o => o.aggression_rating === 'aggressive').length;
    return obs.length + ' runners \u00b7 SB ' + sbSuc + '/' + sbAtt + ' \u00b7 ' + fast + ' fast \u00b7 ' + aggr + ' aggressive \u00b7 Printed ' + new Date().toLocaleDateString();
  };

  const handleDownloadPdf = async () => {
    setBusy(true); setErr(null);
    try {
      const rows = obs.map(o => {
        const sp = SPEED[o.speed_rating];
        const ag = AGGR[o.aggression_rating];
        const sb = sbInfo(o);
        return [
          { text: o.jersey_number || dash, bold: true, color: PC.muted, align: 'center' },
          { text: (o.runner_name || dash).trim(), bold: true },
          { text: o.position || dash, align: 'center' },
          { text: o.bats || dash, align: 'center' },
          sp ? { text: sp.label, color: sp.c, fill: sp.fill, bold: true, align: 'center' } : { text: dash, align: 'center' },
          ag ? { text: ag.label, color: ag.c, fill: ag.fill, bold: true, align: 'center' } : { text: dash, align: 'center' },
          { text: (o.lead_size_1b || dash).trim() },
          sb.text === dash ? { text: dash, align: 'center' }
            : { text: sb.ss + '/' + sb.sa + ' (' + sb.pct + '%)', bold: true, align: 'center', color: stealPctColor(sb.pct) },
          { text: num(o.pickoff_attempts) ? String(num(o.pickoff_attempts)) : dash, align: 'center' },
          { text: num(o.dirt_ball_advances) ? String(num(o.dirt_ball_advances)) : dash, align: 'center' },
          { text: o.notes ? o.notes : '', italic: true, color: '#555555' },
        ];
      });
      await generateReportPdf({
        filename: 'Baserunner_Report_' + team.name.replace(/\s+/g, '_') + '.pdf',
        title: 'Baserunner Scouting Report',
        team: team.name,
        meta: metaLine(),
        sections: [{ headerColor: PC.navy, columns: COLUMNS, rows }],
        legend: 'Speed / Aggression key:  \u25CF plus  \u25CF average  \u25CF below average.   SB shown as success/attempts (success %).   Pickoffs = pickoff attempts drawn \u00b7 Dirt-Ball Adv = advances on balls in the dirt.   Saints Data Matrix \u00b7 Confidential Scouting Report',
      });
    } catch (e) {
      setErr('PDF generation failed \u2014 try Print instead.');
    } finally {
      setBusy(false);
    }
  };

  const handlePrint = () => {
    const rowsHtml = obs.map(o => {
      const sp = SPEED[o.speed_rating];
      const ag = AGGR[o.aggression_rating];
      const sb = sbInfo(o);
      const spCell = sp ? '<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-weight:800;font-size:8.5px;background:' + sp.fill + ';color:' + sp.c + '">' + sp.label + '</span>' : dash;
      const agCell = ag ? '<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-weight:800;font-size:8.5px;background:' + ag.fill + ';color:' + ag.c + '">' + ag.label + '</span>' : dash;
      const sbCell = sb.text === dash ? dash
        : sb.ss + '/' + sb.sa + ' <span style="color:' + stealPctColor(sb.pct) + ';font-weight:800">(' + sb.pct + '%)</span>';
      return '<tr>'
        + '<td class="c" style="font-weight:800;color:' + PC.muted + '">' + (o.jersey_number || dash) + '</td>'
        + '<td class="name">' + (o.runner_name || dash).trim() + '</td>'
        + '<td class="c">' + (o.position || dash) + '</td>'
        + '<td class="c">' + (o.bats || dash) + '</td>'
        + '<td class="c">' + spCell + '</td>'
        + '<td class="c">' + agCell + '</td>'
        + '<td>' + (o.lead_size_1b || dash).trim() + '</td>'
        + '<td class="c" style="font-weight:800">' + sbCell + '</td>'
        + '<td class="c">' + (num(o.pickoff_attempts) || dash) + '</td>'
        + '<td class="c">' + (num(o.dirt_ball_advances) || dash) + '</td>'
        + '<td class="notes">' + (o.notes || '') + '</td>'
        + '</tr>';
    }).join('');

    const ths = COLUMNS.map(c => '<th class="' + (c.align === 'center' ? 'c' : '') + '">' + c.header + '</th>').join('');
    const sectionsHtml = '<table><thead><tr style="background:' + PC.navy + '">' + ths + '</tr></thead><tbody>' + rowsHtml + '</tbody></table>';

    const ok = openPrintWindow({
      title: 'Baserunner Scouting Report',
      team: team.name,
      meta: metaLine(),
      sectionsHtml,
      legendHtml: 'Speed / Aggression key: <span class="dot" style="background:' + PC.green + '"></span>plus &nbsp; <span class="dot" style="background:' + PC.amber + '"></span>average &nbsp; <span class="dot" style="background:' + PC.red + '"></span>below average &nbsp;\u00b7&nbsp; SB = success/attempts (%) &nbsp;\u00b7&nbsp; Pickoffs = pickoff attempts drawn \u00b7 Dirt-Ball Adv = advances on balls in the dirt &nbsp;\u00b7&nbsp; Saints Data Matrix \u00b7 Confidential',
    });
    if (!ok) setErr('Pop-up blocked \u2014 allow pop-ups for this site to print.');
  };

  const disabled = loading || obs.length === 0;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '32px 16px' }}>
      <div style={{ width: '100%', maxWidth: 820, background: C.base, borderRadius: 12, border: '1px solid ' + C.edge, overflow: 'hidden' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 24px', borderBottom: '1px solid ' + C.edge, background: C.surface }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: C.gold, fontFamily: FONT, marginBottom: 2 }}>
              Baserunner Report
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: C.white, fontFamily: FONT, letterSpacing: -0.3 }}>{team.name}</div>
          </div>
          <button
            onClick={handleDownloadPdf}
            disabled={disabled || busy}
            style={{ background: C.gold, color: '#000', border: 'none', borderRadius: 6, padding: '8px 18px', fontSize: 12, fontWeight: 800, cursor: disabled || busy ? 'not-allowed' : 'pointer', fontFamily: FONT, letterSpacing: 0.3, opacity: disabled || busy ? 0.5 : 1 }}
          >
            {busy ? 'Generating\u2026' : '\u2b07 Download PDF'}
          </button>
          <button
            onClick={handlePrint}
            disabled={disabled}
            style={{ background: 'none', color: C.cream, border: '1px solid ' + C.rim, borderRadius: 6, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: FONT, opacity: disabled ? 0.5 : 1 }}
          >
            {'\ud83d\udda8 Print'}
          </button>
          <button
            onClick={onClose}
            style={{ background: 'none', border: '1px solid ' + C.edge, borderRadius: 6, padding: '8px 14px', fontSize: 12, fontWeight: 700, color: C.muted, cursor: 'pointer', fontFamily: FONT }}
          >
            Close
          </button>
        </div>

        <div style={{ padding: '20px 24px 32px' }}>
          {err && (
            <div style={{ marginBottom: 14, padding: '8px 12px', borderRadius: 6, background: 'rgba(232,64,64,0.12)', border: '1px solid ' + C.red, color: C.red, fontSize: 12, fontFamily: FONT }}>{err}</div>
          )}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
              <div style={{ width: 24, height: 24, border: '3px solid ' + C.faint, borderTopColor: C.gold, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : obs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: C.muted, fontFamily: FONT, fontSize: 14 }}>
              No baserunner observations found for {team.name}.
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                {[
                  { label: 'Runners', value: obs.length },
                  { label: 'SB Att',  value: obs.reduce((a, o) => a + num(o.steal_attempts), 0) },
                  { label: 'SB Suc',  value: obs.reduce((a, o) => a + num(o.steals_successful), 0) },
                  { label: 'Fast',    value: obs.filter(o => o.speed_rating === 'fast').length },
                  { label: 'Aggressive', value: obs.filter(o => o.aggression_rating === 'aggressive').length },
                ].map(s => (
                  <div key={s.label} style={{ background: C.surface, border: '1px solid ' + C.edge, borderRadius: 7, padding: '8px 14px', textAlign: 'center', minWidth: 60 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: C.muted, fontFamily: FONT }}>{s.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: C.white, fontVariantNumeric: 'tabular-nums', fontFamily: FONT }}>{s.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: C.muted, fontFamily: FONT, marginBottom: 8 }}>
                {obs.length} runner{obs.length !== 1 ? 's' : ''} ready {'\u2014'} landscape, one page per team. Download a PDF for the dugout binder or Print directly.
              </div>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
