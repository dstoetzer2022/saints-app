import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { normalizeName } from '@/lib/statsUtils';

const C = {
  base:    '#080f17',
  surface: '#0d1a26',
  edge:    '#192c3e',
  gold:    '#c8920c',
  cream:   '#edeae0',
  muted:   '#5a7080',
  faint:   '#253545',
  white:   '#f8f8f4',
};
const FONT = "'Archivo', system-ui, sans-serif";

function avg(arr) {
  if (!arr || !arr.length) return null;
  const nums = arr.filter(v => v != null && !isNaN(v));
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function ttpColor(val) {
  if (val == null) return '#111';
  if (val <= 1.20) return '#1a7a3a';
  if (val >= 1.35) return '#b53030';
  return '#111';
}

function popColor(val) {
  if (val == null) return '#111';
  if (val <= 1.90) return '#1a7a3a';
  if (val >= 2.10) return '#b53030';
  return '#111';
}

// ── Build HTML — dense one-row-per-player tables instead of stacked cards ────
// Individual readings (every pop time, every steal attempt, every throw) are
// still fully captured in the database via the live scouting tools — this
// printed report shows averages + counts so a roster fits on a couple pages
// instead of one page (or more) per player.

function buildPitcherTable(pitchers) {
  if (!pitchers.length) return '<p class="empty">No pitcher observations for this team/game.</p>';

  const rows = pitchers.map(p => {
    const allTtp1b = (p.time_to_plate_1b || []).filter(v => v != null);
    const allTtp2b = (p.time_to_plate_2b || []).filter(v => v != null);
    const allSlide = (p.time_to_plate_slide || []).filter(v => v != null);
    const avg1b = avg(allTtp1b);
    const avg2b = avg(allTtp2b);
    const avgSlide = avg(allSlide);
    const pickoffs = (p.pickoff_moves || []).filter(Boolean);

    const ttpCell = (readings, avgVal) => {
      if (!readings.length && avgVal == null) return '—';
      const avgStr = avgVal != null ? `<span style="font-weight:900;color:${ttpColor(avgVal)}">${avgVal.toFixed(2)}s</span>` : '—';
      return readings.length > 1 ? `${avgStr} <span class="n">(n=${readings.length})</span>` : avgStr;
    };

    const uclaHold = [
      p.ucla_hold_start ? `1B:${p.ucla_hold_start}` : null,
      p.ucla_hold_2b    ? `2B:${p.ucla_hold_2b}` : null,
    ].filter(Boolean).join(' ') || '—';

    return `<tr>
      <td class="num">${p.jersey_number || '—'}</td>
      <td class="name">${p.pitcher_name || '—'}</td>
      <td>${p.pitcher_hand ? p.pitcher_hand + 'HP' : '—'}</td>
      <td class="num">${ttpCell(allTtp1b, avg1b)}</td>
      <td class="num">${ttpCell(allTtp2b, avg2b)}</td>
      <td class="num">${ttpCell(allSlide, avgSlide)}</td>
      <td>${uclaHold}</td>
      <td>${pickoffs.length ? pickoffs.map(m => `<span class="tag">${m}</span>`).join(' ') : '—'}</td>
      <td class="notes">${p.notes || (p.slide_step_notes ? `Slide: ${p.slide_step_notes}` : '')}</td>
    </tr>`;
  }).join('');

  return `<table class="roster">
    <thead><tr>
      <th class="num">#</th><th>Name</th><th>Hand</th>
      <th class="num">TTP 1B</th><th class="num">TTP 2B</th><th class="num">Slide</th>
      <th>UCLA Hold</th><th>Pickoff Moves</th><th>Notes</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function buildCatcherTable(catchers) {
  if (!catchers.length) return '<p class="empty">No catcher observations for this team/game.</p>';

  const rows = catchers.map(c => {
    const tmPops = (c.trackman_pop_times || []).filter(p => p.pop_time != null);
    const avgTmPop = avg(tmPops.map(p => p.pop_time));
    const stealAttempts = c.steal_attempts || [];
    const caughtCount = stealAttempts.filter(s => (s.result || '').toLowerCase().includes('out') || (s.result||'').toLowerCase().includes('caught')).length;
    const avgStealPop = avg(stealAttempts.map(s => s.pop_time).filter(v => v != null));
    const biThrows = c.between_innings_throws || [];
    const avgBiTime = avg(biThrows.map(t => t.time).filter(v => v != null));

    const tmPopCell = tmPops.length
      ? `<span style="font-weight:900;color:${popColor(avgTmPop)}">${avgTmPop != null ? avgTmPop.toFixed(2)+'s' : '—'}</span> <span class="n">(n=${tmPops.length})</span>`
      : '—';
    const stealCell = stealAttempts.length
      ? `${caughtCount}/${stealAttempts.length} caught${avgStealPop != null ? ` · <span style="font-weight:800;color:${popColor(avgStealPop)}">${avgStealPop.toFixed(2)}s</span>` : ''}`
      : '—';
    const biCell = biThrows.length
      ? `${avgBiTime != null ? avgBiTime.toFixed(2)+'s avg' : '—'} <span class="n">(n=${biThrows.length})</span>`
      : '—';

    return `<tr>
      <td class="num">${c.jersey_number || '—'}</td>
      <td class="name">${c.catcher_name || '—'}</td>
      <td>${c.bats ? c.bats + 'HB' : '—'}</td>
      <td class="num">${c.warmup_pop_time != null ? `<span style="font-weight:900;color:${popColor(c.warmup_pop_time)}">${c.warmup_pop_time.toFixed(2)}s</span>` : '—'}</td>
      <td class="num">${tmPopCell}</td>
      <td>${stealCell}</td>
      <td class="num">${biCell}</td>
      <td class="notes">${[c.blocking_notes, c.notes].filter(Boolean).join(' · ') || ''}</td>
    </tr>`;
  }).join('');

  return `<table class="roster">
    <thead><tr>
      <th class="num">#</th><th>Name</th><th>Bats</th>
      <th class="num">Warmup Pop</th><th class="num">TM Pop Avg</th>
      <th>Manual SB</th><th class="num">Btwn-Inn Throw</th><th>Notes</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function buildFullHtml({ pitchers, catchers, game, teamName }) {
  const gameLabel = game
    ? `${game.date} &nbsp;·&nbsp; ${game.away_team_code} @ ${game.home_team_code}`
    : 'All Games';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Pitcher & Catcher Report — ${teamName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;700;800;900&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Archivo', sans-serif; background: #fff; color: #111; padding: 24px 28px; font-size: 11px; }
    .doc-header { margin-bottom: 16px; }
    .doc-title { font-size: 9px; font-weight: 800; letter-spacing: 2.5px; text-transform: uppercase; color: #888; margin-bottom: 4px; }
    .doc-team { font-size: 20px; font-weight: 900; color: #000; letter-spacing: -0.5px; }
    .doc-meta { font-size: 11px; color: #777; margin-top: 3px; }
    hr.doc-rule { border: none; border-top: 2.5px solid #000; margin: 12px 0 16px; }
    .section-header {
      font-size: 9.5px; font-weight: 900; letter-spacing: 2.5px; text-transform: uppercase;
      color: #fff; background: #0e253a; padding: 6px 12px; border-radius: 4px;
      margin: 18px 0 8px;
    }
    table.roster { width: 100%; border-collapse: collapse; }
    table.roster thead { display: table-header-group; } /* repeats on every printed page */
    table.roster th {
      font-size: 8.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px;
      color: #fff; background: #1c3a56; text-align: left; padding: 5px 7px; white-space: nowrap;
    }
    table.roster th.num, table.roster td.num { text-align: center; }
    table.roster td { padding: 5px 7px; border-bottom: 1px solid #eee; vertical-align: top; font-size: 10.5px; }
    table.roster tr:nth-child(even) td { background: #fafafa; }
    table.roster tr { page-break-inside: avoid; break-inside: avoid; }
    td.name { font-weight: 800; color: #000; white-space: nowrap; }
    td.notes { font-style: italic; color: #555; }
    .n { font-size: 9px; color: #999; }
    .tag { display: inline-block; background: #eef2f6; border-radius: 3px; padding: 1px 6px; margin: 1px 2px 1px 0; font-size: 10px; font-weight: 600; color: #334; }
    .empty { color: #888; font-style: italic; padding: 8px 0; font-size: 11px; }
    @page { margin: 14mm 16mm; }
    .page-footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 9px; color: #bbb; letter-spacing: 1.5px; text-transform: uppercase; padding: 6px 0; border-top: 1px solid #eee; background: #fff; }
  </style>
</head>
<body>
  <div class="page-footer">Saints Data Matrix &nbsp;·&nbsp; Confidential Scouting Report</div>

  <div class="doc-header">
    <div class="doc-title">Pitcher &amp; Catcher Scouting Report</div>
    <div class="doc-team">${teamName}</div>
    <div class="doc-meta">${gameLabel} &nbsp;·&nbsp; Printed ${new Date().toLocaleDateString()}</div>
  </div>
  <hr class="doc-rule"/>

  <div class="section-header">Pitcher Report</div>
  ${buildPitcherTable(pitchers)}

  <div class="section-header">Catcher Report</div>
  ${buildCatcherTable(catchers)}

  <script>window.onload = function(){ window.print(); }<\/script>
</body>
</html>`;
}

// ── Main component ────────────────────────────────────────────

export default function PitcherCatcherReport({ team, onClose }) {
  const [games, setGames] = useState([]);
  const [selectedGameId, setSelectedGameId] = useState('all');
  const [_selectedTeam, _setSelectedTeam] = useState(team.name);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // All pitcher/catcher obs for this team
  const [pitcherObs, setPitcherObs] = useState([]);
  const [catcherObs, setCatcherObs] = useState([]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      base44.entities.Game.list('-date', 100),
      base44.entities.PitcherObservation.filter({ pitcher_team: team.name }, 'pitcher_name', 500),
      base44.entities.CatcherObservation.filter({ catcher_team: team.name }, 'catcher_name', 200),
    ]).then(([g, po, co]) => {
      // Only games that involve this team
      const relevant = g.filter(game =>
        game.home_team === team.name || game.away_team === team.name ||
        game.home_team_code === team.code || game.away_team_code === team.code
      );
      setGames(relevant);
      setPitcherObs(po);
      setCatcherObs(co);
      setLoading(false);
    });
  }, [team.name, team.code]);

  const selectedGame = games.find(g => g.id === selectedGameId) || null;

  // Filter by game if selected
  const filteredPitchers = selectedGameId === 'all'
    ? pitcherObs
    : pitcherObs.filter(o => o.game_id === selectedGameId);
  const filteredCatchers = selectedGameId === 'all'
    ? catcherObs
    : catcherObs.filter(o => o.game_id === selectedGameId);

  // Deduplicate pitchers (merge across games when "all")
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
      }
    });
    return Object.values(map).sort((a, b) => {
      const na = parseInt(a.jersey_number) || 999;
      const nb = parseInt(b.jersey_number) || 999;
      return na - nb || (a.pitcher_name || '').localeCompare(b.pitcher_name || '');
    });
  })();

  // Deduplicate catchers
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
      }
    });
    return Object.values(map).sort((a, b) => {
      const na = parseInt(a.jersey_number) || 999;
      const nb = parseInt(b.jersey_number) || 999;
      return na - nb || (a.catcher_name || '').localeCompare(b.catcher_name || '');
    });
  })();

  const handlePrint = () => {
    setGenerating(true);
    const html = buildFullHtml({
      pitchers: mergedPitchers,
      catchers: mergedCatchers,
      game: selectedGame,
      teamName: team.name,
    });
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    setTimeout(() => setGenerating(false), 500);
  };

  const canPrint = !loading && (mergedPitchers.length > 0 || mergedCatchers.length > 0);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '32px 16px' }}>
      <div style={{ width: '100%', maxWidth: 640, background: C.base, borderRadius: 12, border: `1px solid ${C.edge}`, overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 24px', borderBottom: `1px solid ${C.edge}`, background: C.surface }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: C.gold, fontFamily: FONT, marginBottom: 2 }}>Pitcher & Catcher Report</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: C.white, fontFamily: FONT, letterSpacing: -0.3 }}>{team.name}</div>
          </div>
          <button
            onClick={handlePrint}
            disabled={!canPrint || generating}
            style={{ background: C.gold, color: '#000', border: 'none', borderRadius: 6, padding: '8px 18px', fontSize: 12, fontWeight: 800, cursor: !canPrint ? 'not-allowed' : 'pointer', fontFamily: FONT, opacity: !canPrint ? 0.5 : 1 }}
          >
            {generating ? '…' : '🖨 Print'}
          </button>
          <button
            onClick={onClose}
            style={{ background: 'none', border: `1px solid ${C.edge}`, borderRadius: 6, padding: '8px 14px', fontSize: 12, fontWeight: 700, color: C.muted, cursor: 'pointer', fontFamily: FONT }}
          >
            Close
          </button>
        </div>

        {/* Filters */}
        <div style={{ padding: '16px 24px', borderBottom: `1px solid ${C.edge}`, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: C.muted, marginBottom: 5, fontFamily: FONT }}>Game</div>
            <select
              value={selectedGameId}
              onChange={e => setSelectedGameId(e.target.value)}
              style={{ width: '100%', background: C.surface, border: `1px solid ${C.edge}`, color: C.cream, fontSize: 12, fontFamily: FONT, padding: '7px 10px', borderRadius: 5, outline: 'none' }}
            >
              <option value="all">All Games</option>
              {games.map(g => (
                <option key={g.id} value={g.id}>{g.date} — {g.away_team_code} @ {g.home_team_code}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Preview counts */}
        <div style={{ padding: '16px 24px 20px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <div style={{ width: 22, height: 22, border: `3px solid ${C.faint}`, borderTopColor: C.gold, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { label: 'Pitchers', value: mergedPitchers.length },
                { label: 'Catchers', value: mergedCatchers.length },
              ].map(s => (
                <div key={s.label} style={{ background: C.surface, border: `1px solid ${C.edge}`, borderRadius: 7, padding: '10px 18px', textAlign: 'center', minWidth: 80 }}>
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