import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { normalizeName } from '@/lib/statsUtils';
import { C, FONT } from '@/lib/darkTheme';
import {
  generateReportPdf, openPrintWindow, PC,
  ttpColor, popColor, mean, cleanPops,
} from '@/lib/reportPdf';

const dash = '\u2014';

const P_COLUMNS = [
  { header: '#',             width: 26,  align: 'center' },
  { header: 'PITCHER',       width: 120, align: 'left'   },
  { header: 'H',             width: 28,  align: 'center' },
  { header: 'TTP 1B',        width: 74,  align: 'center' },
  { header: 'TTP 2B',        width: 74,  align: 'center' },
  { header: 'SLIDE',         width: 74,  align: 'center' },
  { header: 'UCLA HOLD',     width: 96,  align: 'left'   },
  { header: 'PICKOFF MOVES', width: 118, align: 'left'   },
  { header: 'NOTES',         align: 'left' },
];

const C_COLUMNS = [
  { header: '#',           width: 26,  align: 'center' },
  { header: 'CATCHER',     width: 132, align: 'left'   },
  { header: 'B',           width: 24,  align: 'center' },
  { header: 'BEST POP',    width: 74,  align: 'center' },
  { header: 'AVG POP',     width: 74,  align: 'center' },
  { header: 'TM READINGS', width: 84,  align: 'center' },
  { header: 'CS / ATT',    width: 66,  align: 'center' },
  { header: 'WARMUP',      width: 66,  align: 'center' },
  { header: 'NOTES',       align: 'left' },
];

function ttpText(arr) {
  const vals = (arr || []).filter(v => v != null && !isNaN(v));
  if (!vals.length) return { text: dash };
  const a = mean(vals);
  return { avg: a, n: vals.length, color: ttpColor(a) };
}

function csCount(steal_attempts) {
  const sa = steal_attempts || [];
  const cs = sa.filter(s => {
    const r = (s.result || '').toLowerCase();
    return r.includes('out') || r.includes('caught');
  }).length;
  return { cs, att: sa.length };
}

export default function PitcherCatcherReport({ team, onClose }) {
  const [games, setGames] = useState([]);
  const [selectedGameId, setSelectedGameId] = useState('all');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [pitcherObs, setPitcherObs] = useState([]);
  const [catcherObs, setCatcherObs] = useState([]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      base44.entities.Game.list('-date', 100),
      base44.entities.PitcherObservation.filter({ pitcher_team: team.name }, 'pitcher_name', 500),
      base44.entities.CatcherObservation.filter({ catcher_team: team.name }, 'catcher_name', 200),
    ]).then(([g, po, co]) => {
      const relevant = g.filter(game =>
        game.home_team === team.name || game.away_team === team.name ||
        game.home_team_code === team.code || game.away_team_code === team.code
      );
      setGames(relevant);
      setPitcherObs(po);
      setCatcherObs(co);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [team.name, team.code]);

  const selectedGame = games.find(g => g.id === selectedGameId) || null;

  const filteredPitchers = selectedGameId === 'all' ? pitcherObs : pitcherObs.filter(o => o.game_id === selectedGameId);
  const filteredCatchers = selectedGameId === 'all' ? catcherObs : catcherObs.filter(o => o.game_id === selectedGameId);

  const mergedPitchers = (() => {
    const map = {};
    filteredPitchers.forEach(o => {
      const key = normalizeName(o.pitcher_name).toLowerCase();
      if (!map[key]) {
        map[key] = { ...o, time_to_plate_1b: [...(o.time_to_plate_1b || [])], time_to_plate_2b: [...(o.time_to_plate_2b || [])], time_to_plate_slide: [...(o.time_to_plate_slide || [])], pickoff_moves: [...(o.pickoff_moves || [])] };
      } else {
        map[key].time_to_plate_1b = [...map[key].time_to_plate_1b, ...(o.time_to_plate_1b || [])];
        map[key].time_to_plate_2b = [...map[key].time_to_plate_2b, ...(o.time_to_plate_2b || [])];
        map[key].time_to_plate_slide = [...map[key].time_to_plate_slide, ...(o.time_to_plate_slide || [])];
        map[key].pickoff_moves = [...new Set([...map[key].pickoff_moves, ...(o.pickoff_moves || [])])];
        if (!map[key].notes && o.notes) map[key].notes = o.notes;
        if (!map[key].ucla_hold_start && o.ucla_hold_start) map[key].ucla_hold_start = o.ucla_hold_start;
        if (!map[key].ucla_hold_2b && o.ucla_hold_2b) map[key].ucla_hold_2b = o.ucla_hold_2b;
        if (!map[key].jersey_number && o.jersey_number) map[key].jersey_number = o.jersey_number;
      }
    });
    return Object.values(map).sort((a, b) => {
      const na = parseInt(a.jersey_number) || 999;
      const nb = parseInt(b.jersey_number) || 999;
      return na - nb || (a.pitcher_name || '').localeCompare(b.pitcher_name || '');
    });
  })();

  const mergedCatchers = (() => {
    const map = {};
    filteredCatchers.forEach(o => {
      const key = normalizeName(o.catcher_name).toLowerCase();
      if (!map[key]) {
        map[key] = { ...o, steal_attempts: [...(o.steal_attempts || [])], between_innings_throws: [...(o.between_innings_throws || [])], trackman_pop_times: [...(o.trackman_pop_times || [])] };
      } else {
        map[key].steal_attempts = [...map[key].steal_attempts, ...(o.steal_attempts || [])];
        map[key].between_innings_throws = [...map[key].between_innings_throws, ...(o.between_innings_throws || [])];
        map[key].trackman_pop_times = [...map[key].trackman_pop_times, ...(o.trackman_pop_times || [])];
        if (!map[key].notes && o.notes) map[key].notes = o.notes;
        if (!map[key].blocking_notes && o.blocking_notes) map[key].blocking_notes = o.blocking_notes;
        if (!map[key].warmup_pop_time && o.warmup_pop_time) map[key].warmup_pop_time = o.warmup_pop_time;
        if (!map[key].bats && o.bats) map[key].bats = o.bats;
        if (!map[key].jersey_number && o.jersey_number) map[key].jersey_number = o.jersey_number;
      }
    });
    return Object.values(map).sort((a, b) => {
      const na = parseInt(a.jersey_number) || 999;
      const nb = parseInt(b.jersey_number) || 999;
      return na - nb || (a.catcher_name || '').localeCompare(b.catcher_name || '');
    });
  })();

  const metaLine = () => {
    const gl = selectedGame ? selectedGame.date + ' \u00b7 ' + selectedGame.away_team_code + ' @ ' + selectedGame.home_team_code : 'All games';
    return mergedPitchers.length + ' pitchers \u00b7 ' + mergedCatchers.length + ' catchers \u00b7 ' + gl + ' \u00b7 Printed ' + new Date().toLocaleDateString();
  };

  const canPrint = !loading && (mergedPitchers.length > 0 || mergedCatchers.length > 0);

  // ── PDF ──
  const handleDownloadPdf = async () => {
    setBusy(true); setErr(null);
    try {
      const pRows = mergedPitchers.map(p => {
        const hand = (p.pitcher_hand || '').slice(0, 1).toUpperCase() === 'L' ? 'LHP' : p.pitcher_hand ? 'RHP' : dash;
        const hold = [p.ucla_hold_start ? '1B:' + p.ucla_hold_start : null, p.ucla_hold_2b ? '2B:' + p.ucla_hold_2b : null].filter(Boolean).join(' ') || dash;
        const moves = (p.pickoff_moves || []).filter(Boolean);
        const ttpCell = (arr) => {
          const t = ttpText(arr);
          if (t.text === dash) return { text: dash, align: 'center' };
          return { text: t.avg.toFixed(2) + 's' + (t.n > 1 ? ' (n=' + t.n + ')' : ''), bold: true, color: t.color, align: 'center' };
        };
        return [
          { text: p.jersey_number || dash, bold: true, color: PC.muted, align: 'center' },
          { text: (p.pitcher_name || dash).trim(), bold: true },
          { text: hand, align: 'center' },
          ttpCell(p.time_to_plate_1b),
          ttpCell(p.time_to_plate_2b),
          ttpCell(p.time_to_plate_slide),
          { text: hold },
          { text: moves.length ? moves.join(', ') : dash },
          { text: p.notes || p.slide_step_notes || '', italic: true, color: '#555555' },
        ];
      });

      const cRows = mergedCatchers.map(c => {
        const pops = (c.trackman_pop_times || []).map(tp => tp.pop_time);
        const { best, avg, nValid, nRaw } = cleanPops(pops);
        const { cs, att } = csCount(c.steal_attempts);
        const bestCell = best != null ? { text: best.toFixed(2) + 's', bold: true, color: popColor(best), align: 'center' } : { text: dash, align: 'center' };
        const avgCell  = avg != null ? { text: avg.toFixed(2) + 's', color: popColor(avg), align: 'center' } : { text: dash, align: 'center' };
        const nText = nValid ? String(nValid) : (nRaw ? '0 of ' + nRaw : dash);
        const wu = c.warmup_pop_time;
        return [
          { text: c.jersey_number || dash, bold: true, color: PC.muted, align: 'center' },
          { text: (c.catcher_name || dash).trim(), bold: true },
          { text: c.bats || dash, align: 'center' },
          bestCell,
          avgCell,
          { text: nText, align: 'center' },
          { text: att ? cs + '/' + att : dash, align: 'center' },
          wu != null ? { text: wu.toFixed(2) + 's', color: popColor(wu), align: 'center' } : { text: dash, align: 'center' },
          { text: [c.blocking_notes, c.notes].filter(Boolean).join(' \u00b7 '), italic: true, color: '#555555' },
        ];
      });

      const sections = [];
      sections.push({
        headerColor: PC.navy2, label: 'Pitcher Times to Plate', columns: P_COLUMNS,
        rows: pRows.length ? pRows : [[{ text: 'No pitcher observations for this selection.', italic: true, color: PC.muted }, '', '', '', '', '', '', '', '']],
      });
      sections.push({
        headerColor: PC.navy2, label: 'Catcher Pop Times & Throwing', columns: C_COLUMNS,
        rows: cRows.length ? cRows : [[{ text: 'No catcher observations for this selection.', italic: true, color: PC.muted }, '', '', '', '', '', '', '', '']],
      });

      await generateReportPdf({
        filename: 'Pitcher_Catcher_Report_' + team.name.replace(/\s+/g, '_') + '.pdf',
        title: 'Pitcher & Catcher Scouting Report',
        team: team.name,
        meta: metaLine(),
        sections,
        legend: 'Pop / TTP color key:  \u25CF plus  \u25CF average  \u25CF below average.   Best Pop = fastest clean TrackMan reading (1.50\u20132.60s); Avg Pop trims the single slowest clean reading to discount botched exchanges.   TM Readings = clean samples used.   Saints Data Matrix \u00b7 Confidential Scouting Report',
      });
    } catch (e) {
      setErr('PDF generation failed \u2014 try Print instead.');
    } finally {
      setBusy(false);
    }
  };

  // ── Print fallback ──
  const handlePrint = () => {
    const pTts = P_COLUMNS.map(c => '<th class="' + (c.align === 'center' ? 'c' : '') + '">' + c.header + '</th>').join('');
    const cTts = C_COLUMNS.map(c => '<th class="' + (c.align === 'center' ? 'c' : '') + '">' + c.header + '</th>').join('');

    const ttpHtml = (arr) => {
      const t = ttpText(arr);
      if (t.text === dash) return dash;
      return '<span style="font-weight:800;color:' + t.color + '">' + t.avg.toFixed(2) + 's</span>' + (t.n > 1 ? ' <span class="n">(n=' + t.n + ')</span>' : '');
    };

    const pBody = mergedPitchers.length ? mergedPitchers.map(p => {
      const hand = (p.pitcher_hand || '').slice(0, 1).toUpperCase() === 'L' ? 'LHP' : p.pitcher_hand ? 'RHP' : dash;
      const hold = [p.ucla_hold_start ? '1B:' + p.ucla_hold_start : null, p.ucla_hold_2b ? '2B:' + p.ucla_hold_2b : null].filter(Boolean).join(' ') || dash;
      const moves = (p.pickoff_moves || []).filter(Boolean);
      const mv = moves.length ? moves.map(m => '<span class="tag">' + m + '</span>').join(' ') : dash;
      return '<tr>'
        + '<td class="c" style="font-weight:800;color:' + PC.muted + '">' + (p.jersey_number || dash) + '</td>'
        + '<td class="name">' + (p.pitcher_name || dash).trim() + '</td>'
        + '<td class="c">' + hand + '</td>'
        + '<td class="c">' + ttpHtml(p.time_to_plate_1b) + '</td>'
        + '<td class="c">' + ttpHtml(p.time_to_plate_2b) + '</td>'
        + '<td class="c">' + ttpHtml(p.time_to_plate_slide) + '</td>'
        + '<td>' + hold + '</td>'
        + '<td>' + mv + '</td>'
        + '<td class="notes">' + (p.notes || p.slide_step_notes || '') + '</td>'
        + '</tr>';
    }).join('') : '<tr><td colspan="9" style="font-style:italic;color:' + PC.muted + '">No pitcher observations for this selection.</td></tr>';

    const cBody = mergedCatchers.length ? mergedCatchers.map(c => {
      const pops = (c.trackman_pop_times || []).map(tp => tp.pop_time);
      const { best, avg, nValid, nRaw } = cleanPops(pops);
      const { cs, att } = csCount(c.steal_attempts);
      const bestCell = best != null ? '<span style="font-weight:800;color:' + popColor(best) + '">' + best.toFixed(2) + 's</span>' : dash;
      const avgCell  = avg != null ? '<span style="color:' + popColor(avg) + '">' + avg.toFixed(2) + 's</span>' : dash;
      const nText = nValid ? String(nValid) : (nRaw ? '0 <span class="n">of ' + nRaw + '</span>' : dash);
      const wu = c.warmup_pop_time;
      const wuCell = wu != null ? '<span style="color:' + popColor(wu) + '">' + wu.toFixed(2) + 's</span>' : dash;
      const notes = [c.blocking_notes, c.notes].filter(Boolean).join(' \u00b7 ');
      return '<tr>'
        + '<td class="c" style="font-weight:800;color:' + PC.muted + '">' + (c.jersey_number || dash) + '</td>'
        + '<td class="name">' + (c.catcher_name || dash).trim() + '</td>'
        + '<td class="c">' + (c.bats || dash) + '</td>'
        + '<td class="c">' + bestCell + '</td>'
        + '<td class="c">' + avgCell + '</td>'
        + '<td class="c">' + nText + '</td>'
        + '<td class="c">' + (att ? cs + '/' + att : dash) + '</td>'
        + '<td class="c">' + wuCell + '</td>'
        + '<td class="notes">' + notes + '</td>'
        + '</tr>';
    }).join('') : '<tr><td colspan="9" style="font-style:italic;color:' + PC.muted + '">No catcher observations for this selection.</td></tr>';

    const sectionsHtml =
      '<div class="rt-bar" style="background:' + PC.navy2 + '">Pitcher Times to Plate</div>'
      + '<table><thead><tr style="background:' + PC.navy2 + '">' + pTts + '</tr></thead><tbody>' + pBody + '</tbody></table>'
      + '<div class="rt-bar" style="background:' + PC.navy2 + '">Catcher Pop Times &amp; Throwing</div>'
      + '<table><thead><tr style="background:' + PC.navy2 + '">' + cTts + '</tr></thead><tbody>' + cBody + '</tbody></table>';

    const ok = openPrintWindow({
      title: 'Pitcher & Catcher Scouting Report',
      team: team.name,
      meta: metaLine(),
      sectionsHtml,
      legendHtml: 'Pop / TTP key: <span class="dot" style="background:' + PC.green + '"></span>plus &nbsp; <span class="dot" style="background:' + PC.amber + '"></span>average &nbsp; <span class="dot" style="background:' + PC.red + '"></span>below average &nbsp;\u00b7&nbsp; Best Pop = fastest clean TrackMan reading (1.50\u20132.60s); Avg Pop trims the slowest botched exchange &nbsp;\u00b7&nbsp; TM Readings = clean samples used &nbsp;\u00b7&nbsp; Saints Data Matrix \u00b7 Confidential',
    });
    if (!ok) setErr('Pop-up blocked \u2014 allow pop-ups for this site to print.');
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '32px 16px' }}>
      <div style={{ width: '100%', maxWidth: 680, background: C.base, borderRadius: 12, border: '1px solid ' + C.edge, overflow: 'hidden' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 24px', borderBottom: '1px solid ' + C.edge, background: C.surface }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: C.gold, fontFamily: FONT, marginBottom: 2 }}>Pitcher & Catcher Report</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: C.white, fontFamily: FONT, letterSpacing: -0.3 }}>{team.name}</div>
          </div>
          <button
            onClick={handleDownloadPdf}
            disabled={!canPrint || busy}
            style={{ background: C.gold, color: '#000', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 12, fontWeight: 800, cursor: !canPrint || busy ? 'not-allowed' : 'pointer', fontFamily: FONT, opacity: !canPrint || busy ? 0.5 : 1 }}
          >
            {busy ? 'Generating\u2026' : '\u2b07 Download PDF'}
          </button>
          <button
            onClick={handlePrint}
            disabled={!canPrint}
            style={{ background: 'none', color: C.cream, border: '1px solid ' + C.rim, borderRadius: 6, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: !canPrint ? 'not-allowed' : 'pointer', fontFamily: FONT, opacity: !canPrint ? 0.5 : 1 }}
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

        <div style={{ padding: '16px 24px', borderBottom: '1px solid ' + C.edge, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: C.muted, marginBottom: 5, fontFamily: FONT }}>Game</div>
            <select
              value={selectedGameId}
              onChange={e => setSelectedGameId(e.target.value)}
              style={{ width: '100%', background: C.surface, border: '1px solid ' + C.edge, color: C.cream, fontSize: 12, fontFamily: FONT, padding: '7px 10px', borderRadius: 5, outline: 'none' }}
            >
              <option value="all">All Games</option>
              {games.map(g => (
                <option key={g.id} value={g.id}>{g.date} — {g.away_team_code} @ {g.home_team_code}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ padding: '16px 24px 20px' }}>
          {err && (
            <div style={{ marginBottom: 14, padding: '8px 12px', borderRadius: 6, background: 'rgba(232,64,64,0.12)', border: '1px solid ' + C.red, color: C.red, fontSize: 12, fontFamily: FONT }}>{err}</div>
          )}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <div style={{ width: 22, height: 22, border: '3px solid ' + C.faint, borderTopColor: C.gold, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { label: 'Pitchers', value: mergedPitchers.length },
                { label: 'Catchers', value: mergedCatchers.length },
              ].map(s => (
                <div key={s.label} style={{ background: C.surface, border: '1px solid ' + C.edge, borderRadius: 7, padding: '10px 18px', textAlign: 'center', minWidth: 80 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: C.muted, fontFamily: FONT }}>{s.label}</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: s.value > 0 ? C.white : C.faint, fontFamily: FONT }}>{s.value}</div>
                </div>
              ))}
              {!canPrint && !loading && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', fontSize: 12, color: C.muted, fontFamily: FONT, fontStyle: 'italic' }}>
                  No observations found for this selection.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
