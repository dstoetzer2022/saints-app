import React from 'react';

// ── Pitcher/Catcher Report table (Team Report combined flow) ───────────────
// Same trade-off as BaserunnerReportTable: new JSX rendering of the same
// data PitcherCatcherReport.jsx's standalone window-print already shows,
// in PrintProfileReport's visual language. The standalone modal is
// untouched. This version always merges across ALL games (no per-game
// selector) since a full team report is a season-level document, not tied
// to one game — the standalone modal keeps its game filter for that
// narrower use case.
const INK = '#1a1a1a';
const MUT = '#666';
const GOLD = '#b8860b';
const REPORT_FONT = "'Archivo', system-ui, sans-serif";
const LINE = '#eee';

function avg(arr) {
  if (!arr || !arr.length) return null;
  const nums = arr.filter(v => v != null && !isNaN(v));
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
const ttpColor = v => v == null ? '#111' : v <= 1.20 ? '#1a7a3a' : v >= 1.35 ? '#b53030' : '#111';
const popColor = v => v == null ? '#111' : v <= 1.90 ? '#1a7a3a' : v >= 2.10 ? '#b53030' : '#111';

function PitcherTable({ pitchers }) {
  if (!pitchers.length) return <p style={{ fontSize: 11, color: MUT, padding: '10px 0' }}>No pitcher observations for this team.</p>;
  const th = { fontSize: 8.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6, color: '#fff', background: '#0e253a', textAlign: 'left', padding: '5px 7px', whiteSpace: 'nowrap' };
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
      <thead><tr>
        {['#', 'Name', 'Hand', 'TTP 1B', 'TTP 2B', 'Slide', 'UCLA Hold', 'Pickoff Moves', 'Notes'].map(h => <th key={h} style={th}>{h}</th>)}
      </tr></thead>
      <tbody>
        {pitchers.map((p, i) => {
          const ttp1b = (p.time_to_plate_1b || []).filter(v => v != null);
          const ttp2b = (p.time_to_plate_2b || []).filter(v => v != null);
          const slide = (p.time_to_plate_slide || []).filter(v => v != null);
          const a1b = avg(ttp1b), a2b = avg(ttp2b), aSlide = avg(slide);
          const pickoffs = (p.pickoff_moves || []).filter(Boolean);
          const uclaHold = [p.ucla_hold_start ? `1B:${p.ucla_hold_start}` : null, p.ucla_hold_2b ? `2B:${p.ucla_hold_2b}` : null].filter(Boolean).join(' ') || '—';
          const td = { fontSize: 11, padding: '5px 7px', borderBottom: `1px solid ${LINE}`, verticalAlign: 'top', background: i % 2 === 1 ? '#fafafa' : 'transparent' };
          const ttpCell = (readings, val) => readings.length || val != null
            ? <>{val != null ? <span style={{ fontWeight: 900, color: ttpColor(val) }}>{val.toFixed(2)}s</span> : '—'}{readings.length > 1 && <span style={{ fontSize: 9, color: MUT }}> (n={readings.length})</span>}</>
            : '—';
          return (
            <tr key={p.id || i} className="pct-row">
              <td style={{ ...td, textAlign: 'center' }}>{p.jersey_number || '—'}</td>
              <td style={{ ...td, fontWeight: 800, color: INK, whiteSpace: 'nowrap' }}>{p.pitcher_name || '—'}</td>
              <td style={td}>{p.pitcher_hand ? (p.pitcher_hand[0]?.toUpperCase() === 'L' ? 'LHP' : 'RHP') : '—'}</td>
              <td style={{ ...td, textAlign: 'center' }}>{ttpCell(ttp1b, a1b)}</td>
              <td style={{ ...td, textAlign: 'center' }}>{ttpCell(ttp2b, a2b)}</td>
              <td style={{ ...td, textAlign: 'center' }}>{ttpCell(slide, aSlide)}</td>
              <td style={td}>{uclaHold}</td>
              <td style={td}>{pickoffs.length ? pickoffs.join(', ') : '—'}</td>
              <td style={{ ...td, fontStyle: 'italic', color: '#555' }}>{p.notes || (p.slide_step_notes ? `Slide: ${p.slide_step_notes}` : '')}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function CatcherTable({ catchers }) {
  if (!catchers.length) return <p style={{ fontSize: 11, color: MUT, padding: '10px 0' }}>No catcher observations for this team.</p>;
  const th = { fontSize: 8.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6, color: '#fff', background: '#0e253a', textAlign: 'left', padding: '5px 7px', whiteSpace: 'nowrap' };
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead><tr>
        {['#', 'Name', 'Bats', 'Warmup Pop', 'TM Pop Avg', 'Manual SB', 'Btwn-Inn Throw', 'Notes'].map(h => <th key={h} style={th}>{h}</th>)}
      </tr></thead>
      <tbody>
        {catchers.map((c, i) => {
          const tmPops = (c.trackman_pop_times || []).filter(p => p.pop_time != null);
          const avgTmPop = avg(tmPops.map(p => p.pop_time));
          const stealAttempts = c.steal_attempts || [];
          const caughtCount = stealAttempts.filter(s => (s.result || '').toLowerCase().includes('out') || (s.result || '').toLowerCase().includes('caught')).length;
          const avgStealPop = avg(stealAttempts.map(s => s.pop_time).filter(v => v != null));
          const biThrows = c.between_innings_throws || [];
          const avgBiTime = avg(biThrows.map(t => t.time).filter(v => v != null));
          const td = { fontSize: 11, padding: '5px 7px', borderBottom: `1px solid ${LINE}`, verticalAlign: 'top', background: i % 2 === 1 ? '#fafafa' : 'transparent' };
          return (
            <tr key={c.id || i} className="pct-row">
              <td style={{ ...td, textAlign: 'center' }}>{c.jersey_number || '—'}</td>
              <td style={{ ...td, fontWeight: 800, color: INK, whiteSpace: 'nowrap' }}>{c.catcher_name || '—'}</td>
              <td style={td}>{c.bats ? c.bats + 'HB' : '—'}</td>
              <td style={{ ...td, textAlign: 'center' }}>{c.warmup_pop_time != null ? <span style={{ fontWeight: 900, color: popColor(c.warmup_pop_time) }}>{c.warmup_pop_time.toFixed(2)}s</span> : '—'}</td>
              <td style={{ ...td, textAlign: 'center' }}>{tmPops.length ? <>{avgTmPop != null ? <span style={{ fontWeight: 900, color: popColor(avgTmPop) }}>{avgTmPop.toFixed(2)}s</span> : '—'} <span style={{ fontSize: 9, color: MUT }}>(n={tmPops.length})</span></> : '—'}</td>
              <td style={td}>{stealAttempts.length ? <>{caughtCount}/{stealAttempts.length} caught{avgStealPop != null && <> · <span style={{ fontWeight: 800, color: popColor(avgStealPop) }}>{avgStealPop.toFixed(2)}s</span></>}</> : '—'}</td>
              <td style={{ ...td, textAlign: 'center' }}>{biThrows.length ? <>{avgBiTime != null ? `${avgBiTime.toFixed(2)}s avg` : '—'} <span style={{ fontSize: 9, color: MUT }}>(n={biThrows.length})</span></> : '—'}</td>
              <td style={{ ...td, fontStyle: 'italic', color: '#555' }}>{[c.blocking_notes, c.notes].filter(Boolean).join(' · ')}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function PitcherCatcherReportTable({ team, pitchers, catchers }) {
  return (
    <div style={{ fontFamily: REPORT_FONT, color: INK }}>
      <style>{`.pct-row { page-break-inside: avoid; break-inside: avoid; }`}</style>
      <div style={{ borderBottom: `2.5px solid ${INK}`, paddingBottom: 10, marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2.5, textTransform: 'uppercase', color: GOLD }}>Pitcher / Catcher Report</div>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.4, marginTop: 3 }}>{team.name}</div>
      </div>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', color: MUT, marginBottom: 8 }}>Pitchers</div>
      <PitcherTable pitchers={pitchers} />
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', color: MUT, marginBottom: 8 }}>Catchers</div>
      <CatcherTable catchers={catchers} />
    </div>
  );
}
