import React from 'react';
import { canonicalNameKey } from '@/lib/statsUtils';
import {
  H_COLS, P_COLS, H_COLS_CONSOLIDATED, P_COLS_CONSOLIDATED, SPEED_FILL, SPEED_LABEL,
  N, raw, trueIP,
} from '@/lib/officialTeamStatsPdf';

// ── Comprehensive Team Report (landscape) ───────────────────────────────────
// Approved mockup, 2026-07-15 (v3), restructured per Derek's note (2026-07-16):
// Hitters and Pitchers are now two SEPARATE full pages instead of stacked on
// one — each table gets the entire landscape sheet, and is rotated 90° so
// the table's row-axis (19-23 rows, the tall dimension) runs along the
// page's WIDE physical dimension (10.2in) instead of its short one (7.7in).
// Rotating swaps which axis gets the bigger budget: unrotated, rows had to
// fit in 7.7in; rotated, they get 10.2in (+32%) while columns — far fewer
// of them — only need to fit in 7.7in instead of 10.2in. That's a better
// trade given rows, not columns, were the actual bottleneck.
//
// The rotation math (verified by hand via corner-coordinate geometry, not
// copied from an unverified snippet): build the page's content normally at
// PAGE_H × PAGE_W (i.e. swapped dimensions — a "portrait-shaped" canvas
// sized to the landscape page's height × width), position it with
// left: PAGE_W, transform-origin: top left, then rotate(90deg). That anchors
// the rotated box's four corners at exactly (0,0)-(PAGE_W,0)-(0,PAGE_H)-
// (PAGE_W,PAGE_H) — filling the real page bounds with no manual translate
// guessing. Print-only concern: this depends on .print-report-page having
// zero padding in print (it does — index.css forces padding:0 !important
// in @media print, margin instead coming from @page's own 0.4in).
const PAGE_W = '10.2in';
const PAGE_H = '7.7in';

const INK = '#1a1a1a';
const MUT = '#666';
const GOLD = '#b8860b';
const REPORT_FONT = "'Archivo', system-ui, sans-serif";
const LINE = '#e4e7ea';
const NAVY = '#0e253a';
const SCOUT_HEAD_BG = '#5c4a1e';
const SCOUT_CELL_BG = '#fbf6e8';
const SCOUT_CELL_BG_ALT = '#f6f0de';
const SCOUT_TEXT = '#5c4a1e';

const avg = arr => {
  const nums = (arr || []).filter(v => v != null && !isNaN(v));
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
};
const fmtS = v => v == null ? '—' : `${v.toFixed(2)}s`;

function joinRunner(name, runnerObs) {
  const key = canonicalNameKey(name);
  return runnerObs.find(o => canonicalNameKey(o.runner_name) === key) || null;
}
function joinCatcher(name, catcherObs) {
  const key = canonicalNameKey(name);
  const c = catcherObs.find(o => canonicalNameKey(o.catcher_name) === key);
  if (!c) return null;
  const tmPops = (c.trackman_pop_times || []).map(p => p.pop_time).filter(v => v != null);
  const popAvg = avg([c.warmup_pop_time, ...tmPops].filter(v => v != null));
  const attempts = c.steal_attempts || [];
  const caught = attempts.filter(a => (a.result || '').toLowerCase().includes('out') || (a.result || '').toLowerCase().includes('caught')).length;
  return { popAvg: fmtS(popAvg), sbCaught: attempts.length ? `${caught}/${attempts.length}` : '—' };
}
function joinPickoff(name, pitcherObs) {
  const key = canonicalNameKey(name);
  const p = pitcherObs.find(o => canonicalNameKey(o.pitcher_name) === key);
  if (!p) return null;
  const ttp1b = avg(p.time_to_plate_1b);
  const ttp2b = avg(p.time_to_plate_2b);
  const holds = [p.ucla_hold_start ? `1B:${p.ucla_hold_start}` : null, p.ucla_hold_2b ? `2B:${p.ucla_hold_2b}` : null].filter(Boolean).join(' ') || '—';
  const moves = (p.pickoff_moves || []).filter(Boolean).join(', ') || '—';
  return { ttp1b: fmtS(ttp1b), ttp2b: fmtS(ttp2b), holds, moves };
}

function shadeClass(kind, key, val) {
  const n = N(val);
  if (kind === 'hit') {
    if (key === 'AVG') return n >= .300 ? 'good' : (n > 0 && n <= .180) ? 'bad' : '';
    if (key === 'SLG') return n >= .450 ? 'good' : (n > 0 && n <= .250) ? 'bad' : '';
    if (key === 'OB') return n >= .400 ? 'good' : (n > 0 && n <= .220) ? 'bad' : '';
    // Power flag, per Derek's note (2026-07-16): 3+ HR always reads red,
    // regardless of the AVG/OBP/SLG percentile thresholds above.
    if (key === 'HR') return n >= 3 ? 'good' : '';
  } else {
    if (key === 'ERA') return (n > 0 && n <= 3.00) ? 'good' : n >= 6.50 ? 'bad' : '';
    if (key === 'BAVG') return (n > 0 && n <= .220) ? 'good' : n >= .320 ? 'bad' : '';
  }
  return '';
}
const SHADE_STYLE = { good: { background: '#f6ddd7', color: '#8a2314' }, bad: { background: '#dbe6f4', color: '#1c4a7a' } };

// Comfortable sizing — rotation freed up ~32% more row budget than the
// stacked-on-one-page layout had, so this isn't the squeeze-every-pixel
// sizing from that version.
const th = (label, extra) => <th key={label} style={{ fontSize: 7.5, fontWeight: 800, letterSpacing: 0.3, textTransform: 'uppercase', color: '#fff', background: NAVY, padding: '3px 5px', textAlign: 'right', whiteSpace: 'nowrap', ...extra }}>{label === 'OB' ? 'OBP' : label}</th>;
const scoutTh = label => <th key={label} style={{ fontSize: 7.5, fontWeight: 800, letterSpacing: 0.3, textTransform: 'uppercase', color: '#fff', background: SCOUT_HEAD_BG, padding: '3px 5px', textAlign: 'center', whiteSpace: 'nowrap' }}>{label}</th>;
const scoutTd = (content, alt) => <td style={{ fontSize: 8, fontWeight: 600, color: SCOUT_TEXT, background: alt ? SCOUT_CELL_BG_ALT : SCOUT_CELL_BG, padding: '2px 5px', borderBottom: `1px solid ${LINE}`, textAlign: 'center', whiteSpace: 'nowrap' }}>{content}</td>;

function HitterTable({ hitters, totals, runnerObs, catcherObs }) {
  const sorted = [...hitters].sort((a, b) => N(b.AB) - N(a.AB));
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
      <thead><tr>
        <th style={{ fontSize: 7.5, fontWeight: 800, color: '#fff', background: NAVY, padding: '3px 5px', textAlign: 'left' }}>#</th>
        <th style={{ fontSize: 7.5, fontWeight: 800, color: '#fff', background: NAVY, padding: '3px 5px', textAlign: 'left' }}>Batter</th>
        {H_COLS_CONSOLIDATED.map(c => th(c))}
        {['Speed', 'PO Att', 'Dirt Adv', 'C Pop', 'C SB'].map(scoutTh)}
      </tr></thead>
      <tbody>
        {sorted.map((h, i) => {
          const rd = joinRunner(h.name, runnerObs);
          const cd = joinCatcher(h.name, catcherObs);
          const alt = i % 2 === 1;
          const speedFill = rd?.speed_rating ? SPEED_FILL[rd.speed_rating] : null;
          return (
            <tr key={h.num + h.name} className="ctr-row" style={{ background: alt ? '#fafafa' : 'transparent' }}>
              <td style={{ fontSize: 8, color: '#999', padding: '2px 5px', borderBottom: `1px solid ${LINE}`, textAlign: 'center' }}>{h.num}</td>
              <td style={{
                fontSize: 8.5, fontWeight: 800, padding: '2px 5px', borderBottom: `1px solid ${LINE}`, whiteSpace: 'nowrap',
                background: speedFill || 'transparent', color: speedFill ? '#fff' : INK,
              }}>{h.name}</td>
              {H_COLS_CONSOLIDATED.map(c => {
                const sh = shadeClass('hit', c, h[c]);
                return (
                  <td key={c} style={{
                    fontSize: 8, padding: '2px 5px', borderBottom: `1px solid ${LINE}`, textAlign: 'right',
                    fontWeight: (c === 'AVG' || c === 'OB' || c === 'SLG') ? 800 : 400,
                    ...(sh ? SHADE_STYLE[sh] : {}),
                  }}>{raw(h[c])}</td>
                );
              })}
              <td style={{
                fontSize: 8, fontWeight: 800, padding: '2px 5px', borderBottom: `1px solid ${LINE}`, textAlign: 'center',
                background: speedFill || (alt ? SCOUT_CELL_BG_ALT : SCOUT_CELL_BG), color: speedFill ? '#fff' : SCOUT_TEXT,
              }}>{rd?.speed_rating ? SPEED_LABEL[rd.speed_rating] : '—'}</td>
              {scoutTd(rd?.pickoff_attempts ?? '—', alt)}
              {scoutTd(rd?.dirt_ball_advances ?? '—', alt)}
              {scoutTd(cd ? cd.popAvg : '—', alt)}
              {scoutTd(cd ? cd.sbCaught : '—', alt)}
            </tr>
          );
        })}
      </tbody>
      {(totals.hit || totals.hitOpp) && (
        <tfoot>
          {totals.hit && (() => { const t = {}; H_COLS.forEach((c, i) => t[c] = totals.hit[i]);
            return <tr>
              <td /><td style={{ fontSize: 8.5, fontWeight: 800, padding: '3px 5px', borderTop: `1.5px solid ${INK}` }}>Team</td>
              {H_COLS_CONSOLIDATED.map(c => <td key={c} style={{ fontSize: 8, fontWeight: 800, padding: '3px 5px', textAlign: 'right', borderTop: `1.5px solid ${INK}` }}>{raw(t[c])}</td>)}
              <td colSpan={5} style={{ borderTop: `1.5px solid ${INK}`, background: SCOUT_CELL_BG }} />
            </tr>; })()}
          {totals.hitOpp && (() => { const t = {}; H_COLS.forEach((c, i) => t[c] = totals.hitOpp[i]);
            return <tr>
              <td /><td style={{ fontSize: 8.5, fontWeight: 700, color: '#777', padding: '3px 5px' }}>Opp</td>
              {H_COLS_CONSOLIDATED.map(c => <td key={c} style={{ fontSize: 8, fontWeight: 700, color: '#777', padding: '3px 5px', textAlign: 'right' }}>{raw(t[c])}</td>)}
              <td colSpan={5} style={{ background: SCOUT_CELL_BG_ALT }} />
            </tr>; })()}
        </tfoot>
      )}
    </table>
  );
}

function PitcherTable({ pitchers, totals, pitcherObs }) {
  const sorted = [...pitchers].sort((a, b) => trueIP(b.IP) - trueIP(a.IP));
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
      <thead><tr>
        <th style={{ fontSize: 7.5, fontWeight: 800, color: '#fff', background: NAVY, padding: '3px 5px', textAlign: 'left' }}>#</th>
        <th style={{ fontSize: 7.5, fontWeight: 800, color: '#fff', background: NAVY, padding: '3px 5px', textAlign: 'left' }}>Pitcher</th>
        {P_COLS_CONSOLIDATED.map(c => th(c))}
        {['TTP 1B', 'TTP 2B', 'Holds', 'Pickoff Moves'].map(scoutTh)}
      </tr></thead>
      <tbody>
        {sorted.map((p, i) => {
          const pd = joinPickoff(p.name, pitcherObs);
          const alt = i % 2 === 1;
          return (
            <tr key={p.num + p.name} className="ctr-row" style={{ background: alt ? '#fafafa' : 'transparent' }}>
              <td style={{ fontSize: 8, color: '#999', padding: '2px 5px', borderBottom: `1px solid ${LINE}`, textAlign: 'center' }}>{p.num}</td>
              <td style={{ fontSize: 8.5, fontWeight: 800, color: INK, padding: '2px 5px', borderBottom: `1px solid ${LINE}`, whiteSpace: 'nowrap' }}>{p.name}</td>
              {P_COLS_CONSOLIDATED.map(c => {
                const sh = shadeClass('pit', c, p[c]);
                return (
                  <td key={c} style={{
                    fontSize: 8, padding: '2px 5px', borderBottom: `1px solid ${LINE}`, textAlign: 'right',
                    fontWeight: (c === 'ERA' || c === 'BAVG') ? 800 : 400,
                    ...(sh ? SHADE_STYLE[sh] : {}),
                  }}>{raw(p[c])}</td>
                );
              })}
              {scoutTd(pd ? pd.ttp1b : '—', alt)}
              {scoutTd(pd ? pd.ttp2b : '—', alt)}
              {scoutTd(pd ? pd.holds : '—', alt)}
              {scoutTd(pd ? pd.moves : '—', alt)}
            </tr>
          );
        })}
      </tbody>
      {(totals.pit || totals.pitOpp) && (
        <tfoot>
          {totals.pit && (() => { const t = {}; P_COLS.forEach((c, i) => t[c] = totals.pit[i]);
            return <tr>
              <td /><td style={{ fontSize: 8.5, fontWeight: 800, padding: '3px 5px', borderTop: `1.5px solid ${INK}` }}>Team</td>
              {P_COLS_CONSOLIDATED.map(c => <td key={c} style={{ fontSize: 8, fontWeight: 800, padding: '3px 5px', textAlign: 'right', borderTop: `1.5px solid ${INK}` }}>{raw(t[c])}</td>)}
              <td colSpan={4} style={{ borderTop: `1.5px solid ${INK}`, background: SCOUT_CELL_BG }} />
            </tr>; })()}
          {totals.pitOpp && (() => { const t = {}; P_COLS.forEach((c, i) => t[c] = totals.pitOpp[i]);
            return <tr>
              <td /><td style={{ fontSize: 8.5, fontWeight: 700, color: '#777', padding: '3px 5px' }}>Opp</td>
              {P_COLS_CONSOLIDATED.map(c => <td key={c} style={{ fontSize: 8, fontWeight: 700, color: '#777', padding: '3px 5px', textAlign: 'right' }}>{raw(t[c])}</td>)}
              <td colSpan={4} style={{ background: SCOUT_CELL_BG_ALT }} />
            </tr>; })()}
        </tfoot>
      )}
    </table>
  );
}

function Masthead({ team, rec, subtitle }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `2px solid ${INK}`, paddingBottom: 6, marginBottom: 10 }}>
      <div>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: GOLD }}>Comprehensive Team Report</div>
        <div style={{ fontSize: 19, fontWeight: 900, letterSpacing: -0.3, marginTop: 2 }}>{team.name}</div>
        {rec && <div style={{ fontSize: 9.5, color: MUT, fontWeight: 600, marginTop: 1 }}>{rec}</div>}
      </div>
      <div style={{ textAlign: 'right', fontSize: 9, color: MUT, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, lineHeight: 1.4 }}>
        {subtitle}<br />
        Printed {new Date().toLocaleDateString()}
      </div>
    </div>
  );
}

// Rotates its children 90° to fill a PAGE_W × PAGE_H landscape page. Content
// is laid out normally (top-down, left-right) inside a PAGE_H-wide ×
// PAGE_W-tall canvas — i.e. build for the "swapped" dimensions — and this
// wrapper rotates the whole thing into the real page bounds. See the
// geometry note at the top of this file for why these exact offsets anchor
// the rotated box at (0,0)-(PAGE_W,PAGE_H) with no gaps or overhang.
function RotatedLandscapePage({ children }) {
  return (
    <div style={{ position: 'relative', width: PAGE_W, height: PAGE_H, overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: 0, left: PAGE_W,
        width: PAGE_H, height: PAGE_W,
        transformOrigin: 'top left', transform: 'rotate(90deg)',
        fontFamily: REPORT_FONT, color: INK,
      }}>
        {children}
      </div>
    </div>
  );
}

// officialStats: { team, record, hitters, pitchers, totals }
// runnerObs/pitcherObs/catcherObs: already-deduped arrays from
// TeamReportBuilder's mergeByRunner/mergeByPitcher/mergeByCatcher.
export function ComprehensiveHitterPage({ team, officialStats, runnerObs, catcherObs }) {
  if (!officialStats) {
    return <div style={{ fontFamily: REPORT_FONT, color: MUT, fontSize: 12, padding: '20px 0' }}>No official stats PDF uploaded for {team.name}.</div>;
  }
  const { record, hitters, totals } = officialStats;
  const rec = [record?.overall, record?.home && `Home ${record.home}`, record?.away && `Away ${record.away}`, record?.conf && `Conf ${record.conf}`].filter(Boolean).join('  ·  ');
  return (
    <RotatedLandscapePage>
      <style>{`.ctr-row { page-break-inside: avoid; break-inside: avoid; }`}</style>
      <Masthead team={team} rec={rec} subtitle="Hitters &amp; Scouting" />
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase', color: '#333', borderBottom: '1px solid #ccc', paddingBottom: 3, margin: '0 0 4px' }}>
        Hitters <span style={{ fontSize: 7.5, color: MUT, fontWeight: 600, textTransform: 'none' }}>GP/GS/R/TB/GDP/SF/SH/fielding trimmed · baserunning + catcher pop merged in</span>
      </div>
      <HitterTable hitters={hitters} totals={totals} runnerObs={runnerObs} catcherObs={catcherObs} />
      <div style={{ fontSize: 7.5, color: MUT, marginTop: 5 }}>
        Gold-tinted columns are merged scouting data (baserunner / catcher observations), not official stats. Dash = no observation recorded.
      </div>
    </RotatedLandscapePage>
  );
}

export function ComprehensivePitcherPage({ team, officialStats, pitcherObs }) {
  if (!officialStats) {
    return <div style={{ fontFamily: REPORT_FONT, color: MUT, fontSize: 12, padding: '20px 0' }}>No official stats PDF uploaded for {team.name}.</div>;
  }
  const { record, pitchers, totals } = officialStats;
  const rec = [record?.overall, record?.home && `Home ${record.home}`, record?.away && `Away ${record.away}`, record?.conf && `Conf ${record.conf}`].filter(Boolean).join('  ·  ');
  return (
    <RotatedLandscapePage>
      <style>{`.ctr-row { page-break-inside: avoid; break-inside: avoid; }`}</style>
      <Masthead team={team} rec={rec} subtitle="Pitchers &amp; Scouting" />
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase', color: '#333', borderBottom: '1px solid #ccc', paddingBottom: 3, margin: '0 0 4px' }}>
        Pitchers <span style={{ fontSize: 7.5, color: MUT, fontWeight: 600, textTransform: 'none' }}>W/L/APP/GS/SV trimmed · pickoff/hold merged in</span>
      </div>
      <PitcherTable pitchers={pitchers} totals={totals} pitcherObs={pitcherObs} />
      <div style={{ fontSize: 7.5, color: MUT, marginTop: 5 }}>
        Gold-tinted columns are merged scouting data (pickoff observations), not official stats. Dash = no observation recorded.
      </div>
    </RotatedLandscapePage>
  );
}
