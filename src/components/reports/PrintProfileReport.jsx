import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { normalizePitch, getPitchColor } from '@/lib/ds';
import {
  zoneGrid, pitcherProfile, hitterTrackmanProfile, slashLine,
  platoonSplitRows, xStatsForRows,
} from '@/lib/profileStats';
import { isSwing, isWhiff } from '@/lib/statsUtils';

// Coach handout: one clean portrait letter page per player, rendered as a
// full-screen preview overlay (portal on document.body) with a native
// print-to-PDF button. Light palette throughout — the on-screen dark theme
// wastes ink and prints muddy. All numbers come from the same profileStats
// functions the on-screen profile uses; nothing is recomputed with different
// definitions. Min-N gating and the "(approx)" xStats caveat carry over.

const INK = '#1a1a1a';
const MUT = '#666';
const FAINT = '#999';
const EDGE = '#d8d4ca';
const CARD = '#f4f2ec';
const NAVY = '#1e3448';
const GOLD = '#b8860b';
const REPORT_FONT = "'Archivo', system-ui, sans-serif";

const pct = v => v == null ? '—' : (v * 100).toFixed(0) + '%';
const n1 = v => v == null ? '—' : Number(v).toFixed(1);
const n3 = v => { if (v == null) return '—'; const s = Number(v).toFixed(3); return s.startsWith('0.') ? s.slice(1) : s; };

// ── Print-safe zone grid (light palette: paper → gold / paper → red) ─────
function mix(a, b, t) {
  const h = x => [parseInt(x.slice(1, 3), 16), parseInt(x.slice(3, 5), 16), parseInt(x.slice(5, 7), 16)];
  const [r1, g1, b1] = h(a), [r2, g2, b2] = h(b);
  return `rgb(${Math.round(r1 + (r2 - r1) * t)},${Math.round(g1 + (g2 - g1) * t)},${Math.round(b1 + (b2 - b1) * t)})`;
}

function PrintZoneGrid({ cells, mode, label }) {
  if (!cells || cells.length !== 9) return null;
  const colorFor = c => {
    if (mode === 'usage') {
      if (c.usagePct == null || c.count === 0) return '#f2efe8';
      return mix('#f2efe8', '#c8920c', Math.min(1, c.usagePct / 25));
    }
    if (mode === 'swing') {
      if (c.lowN || c.count === 0) return '#f2efe8';
      return mix('#f2efe8', '#c8920c', Math.min(1, (c.swings / c.count) / 0.7));
    }
    if (c.lowN || c.whiffPct == null) return '#f2efe8';
    return mix('#f2efe8', '#d4534f', Math.min(1, c.whiffPct / 50));
  };
  const valueFor = c => {
    if (mode === 'usage') return c.count > 0 ? `${c.usagePct}%` : '—';
    if (mode === 'swing') return (c.lowN || c.count === 0) ? '—' : `${Math.round((c.swings / c.count) * 100)}%`;
    return (c.lowN || c.whiffPct == null) ? '—' : `${c.whiffPct}%`;
  };
  const textFor = (bg) => bg === '#f2efe8' ? FAINT : INK;
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, color: MUT, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 }}>{label}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, width: 132 }}>
        {cells.map((c, i) => {
          const bg = colorFor(c);
          return (
            <div key={i} style={{ background: bg, border: `0.5px solid ${EDGE}`, borderRadius: 3, width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: textFor(bg), fontVariantNumeric: 'tabular-nums' }}>{valueFor(c)}</span>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 8, color: FAINT, marginTop: 3 }}>Catcher's view · "—" = under min sample</div>
    </div>
  );
}

// ── Print spray chart (BIP by bearing × distance, light field) ───────────
function PrintSprayChart({ pitches }) {
  const W = 200, H = 190, CX = W / 2, CY = H - 12, MAX = 420;
  const bip = pitches.filter(p => p.pitch_call === 'InPlay' && p.bearing != null && p.hit_distance != null && p.hit_distance > 0);
  const toXY = (b, d) => {
    const r = Math.min(d / MAX, 1) * (H - 34);
    const rad = (b * Math.PI) / 180;
    return { x: CX + Math.sin(rad) * r, y: CY - Math.cos(rad) * r };
  };
  const arc = d => {
    const r = Math.min(d / MAX, 1) * (H - 34);
    const a = 45 * Math.PI / 180;
    const x1 = CX - Math.sin(a) * r, y1 = CY - Math.cos(a) * r;
    const x2 = CX + Math.sin(a) * r, y2 = CY - Math.cos(a) * r;
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
  };
  const foul = () => {
    const r = H - 34, a = 45 * Math.PI / 180;
    return { lx: CX - Math.sin(a) * r, rx: CX + Math.sin(a) * r, y: CY - Math.cos(a) * r };
  };
  const f = foul();
  const isHit = p => ['Single', 'Double', 'Triple', 'HomeRun'].includes(p.play_result);
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, color: MUT, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 }}>Spray chart (BIP)</div>
      <svg width={W} height={H} style={{ display: 'block' }}>
        <line x1={CX} y1={CY} x2={f.lx} y2={f.y} stroke={EDGE} strokeWidth="1" />
        <line x1={CX} y1={CY} x2={f.rx} y2={f.y} stroke={EDGE} strokeWidth="1" />
        {[150, 250, 350].map(d => <path key={d} d={arc(d)} fill="none" stroke="#e8e4d8" strokeWidth="1" />)}
        {bip.map((p, i) => {
          const { x, y } = toXY(p.bearing, p.hit_distance);
          const hit = isHit(p);
          return <circle key={i} cx={x} cy={y} r="3" fill={hit ? '#c8920c' : 'none'} stroke={hit ? '#8a6508' : FAINT} strokeWidth="1" />;
        })}
      </svg>
      <div style={{ fontSize: 8, color: FAINT }}>Gold = hit · open = out · arcs at 150/250/350 ft · n = {bip.length}</div>
    </div>
  );
}

// ── Print movement plot (HB × IVB, colored by pitch type) ────────────────
function PrintMovementPlot({ pitches }) {
  const W = 210, H = 170, pad = 22;
  const rows = pitches.filter(p => p.horz_break != null && p.induced_vert_break != null);
  const ext = 25;
  const sx = v => pad + ((v + ext) / (2 * ext)) * (W - 2 * pad);
  const sy = v => (H - pad) - ((v + ext) / (2 * ext)) * (H - 2 * pad);
  const types = [...new Set(rows.map(p => normalizePitch(p.tagged_pitch_type || p.pitch_type)))];
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, color: MUT, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 }}>Movement (HB × IVB, in)</div>
      <svg width={W} height={H} style={{ display: 'block' }}>
        <line x1={pad} y1={sy(0)} x2={W - pad} y2={sy(0)} stroke={EDGE} strokeWidth="1" />
        <line x1={sx(0)} y1={pad} x2={sx(0)} y2={H - pad} stroke={EDGE} strokeWidth="1" />
        {rows.map((p, i) => {
          const t = normalizePitch(p.tagged_pitch_type || p.pitch_type);
          return <circle key={i} cx={sx(Math.max(-ext, Math.min(ext, p.horz_break)))} cy={sy(Math.max(-ext, Math.min(ext, p.induced_vert_break)))} r="2.2" fill={getPitchColor(t)} fillOpacity="0.65" />;
        })}
        <text x={W - pad} y={sy(0) - 4} textAnchor="end" fontSize="8" fill={FAINT}>HB +</text>
        <text x={sx(0) + 4} y={pad + 6} fontSize="8" fill={FAINT}>IVB +</text>
      </svg>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
        {types.map(t => (
          <span key={t} style={{ fontSize: 8, color: MUT, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: getPitchColor(t), display: 'inline-block' }} />{t}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── FB velo by inning sparkline ──────────────────────────────────────────
function PrintVeloByInning({ pitches }) {
  const byInning = {};
  pitches.forEach(p => {
    const t = normalizePitch(p.tagged_pitch_type || p.pitch_type);
    if (!['Fastball', 'Four-Seam', 'Sinker'].includes(t)) return;
    if (p.rel_speed == null || p.rel_speed <= 0 || p.inning == null) return;
    (byInning[p.inning] = byInning[p.inning] || []).push(Number(p.rel_speed));
  });
  const innings = Object.keys(byInning).map(Number).sort((a, b) => a - b);
  if (innings.length < 2) return null;
  const avgs = innings.map(i => byInning[i].reduce((a, b) => a + b, 0) / byInning[i].length);
  const min = Math.min(...avgs) - 0.5, max = Math.max(...avgs) + 0.5;
  const W = 210, H = 54, pad = 6;
  const sx = i => pad + (i / (innings.length - 1)) * (W - 2 * pad);
  const sy = v => H - pad - ((v - min) / (max - min)) * (H - 2 * pad);
  const path = avgs.map((v, i) => `${i === 0 ? 'M' : 'L'} ${sx(i)} ${sy(v)}`).join(' ');
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, color: MUT, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 }}>Avg FB velo by inning</div>
      <svg width={W} height={H} style={{ display: 'block' }}>
        <path d={path} fill="none" stroke={GOLD} strokeWidth="1.5" />
        {avgs.map((v, i) => <circle key={i} cx={sx(i)} cy={sy(v)} r="2" fill={GOLD} />)}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: FAINT }}>
        {innings.map((inn, i) => <span key={inn}>{inn}: {avgs[i].toFixed(1)}</span>)}
      </div>
    </div>
  );
}

// ── Shared bits ──────────────────────────────────────────────────────────
function StatCard({ label, value }) {
  return (
    <div style={{ background: CARD, borderRadius: 4, padding: '5px 6px', textAlign: 'center' }}>
      <div style={{ fontSize: 8.5, color: MUT, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}

function SectionLabel({ children }) {
  return <div style={{ fontSize: 9, fontWeight: 700, color: MUT, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>{children}</div>;
}

const thS = { textAlign: 'left', fontSize: 8.5, fontWeight: 700, color: MUT, textTransform: 'uppercase', letterSpacing: 0.4, padding: '3px 6px', borderBottom: `1px solid ${EDGE}` };
const tdS = { fontSize: 10.5, padding: '3px 6px', borderBottom: `0.5px solid #eae6da`, fontVariantNumeric: 'tabular-nums' };

function SplitsTable({ splits, isPitcher }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead><tr>
        <th style={thS}>{isPitcher ? 'vs' : 'vs'}</th><th style={thS}>PA</th><th style={thS}>AVG</th><th style={thS}>OBP</th><th style={thS}>SLG</th><th style={thS}>K%</th><th style={thS}>Whiff%</th>
      </tr></thead>
      <tbody>
        {splits.map(s => (
          <tr key={s.label}>
            <td style={{ ...tdS, fontWeight: 700 }}>{s.label}</td>
            <td style={tdS}>{s.stats.pa || 0}</td>
            <td style={tdS}>{n3(s.stats.avg)}</td>
            <td style={tdS}>{n3(s.stats.obp)}</td>
            <td style={tdS}>{n3(s.stats.slg)}</td>
            <td style={tdS}>{s.stats.pa ? pct(s.stats.k / s.stats.pa) : '—'}</td>
            <td style={tdS}>{pct(s.stats.whiffPct)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ReportHeader({ player, team, school, isPitcher, hand }) {
  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `2.5px solid ${NAVY}`, paddingBottom: 6, marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        {player.jerseyNumber != null && player.jerseyNumber !== '' && (
          <span style={{ fontSize: 22, fontWeight: 900, color: GOLD, letterSpacing: -1, fontVariantNumeric: 'tabular-nums' }}>#{player.jerseyNumber}</span>
        )}
        <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.4 }}>{player.name}</span>
        <span style={{ fontSize: 10.5, color: MUT }}>
          {[isPitcher ? 'Pitcher' : 'Hitter', hand ? `${isPitcher ? 'Throws' : 'Bats'} ${hand}` : null, school].filter(Boolean).join(' · ')}
        </span>
      </div>
      <div style={{ fontSize: 10, color: MUT }}>{team?.name} · {today}</div>
    </div>
  );
}

function ReportFooter({ n, note }) {
  return (
    <div style={{ marginTop: 'auto', borderTop: `0.5px solid ${EDGE}`, paddingTop: 4, fontSize: 8.5, color: FAINT, display: 'flex', justifyContent: 'space-between' }}>
      <span>Saints Data Matrix · {note}</span>
      <span>n = {n} pitches</span>
    </div>
  );
}

// ── Page bodies ──────────────────────────────────────────────────────────
function HitterPage({ player, team, school, hand, pitches, hitterPool }) {
  const tm = useMemo(() => hitterTrackmanProfile(pitches), [pitches]);
  const sl = useMemo(() => slashLine(pitches), [pitches]);
  const zones = useMemo(() => zoneGrid(pitches, { swingOnly: true }), [pitches]);
  const splits = useMemo(() => platoonSplitRows(pitches, 'pitcher_hand'), [pitches]);
  const xs = useMemo(() => hitterPool?.xGrid ? xStatsForRows(pitches, hitterPool.xGrid) : null, [pitches, hitterPool]);

  const statRows = tm ? [
    ['xBA (approx)', xs ? n3(xs.xBA) : '—'], ['xwOBA (approx)', xs ? n3(xs.xwOBA) : '—'], ['xSLG (approx)', xs ? n3(xs.xSLG) : '—'],
    ['ISO', n3(tm.iso)], ['BABIP', n3(tm.babip)], ['Barrel% (approx)', pct(tm.barrelPct)],
    ['Hard%', pct(tm.hardPct)], ['Soft%', pct(tm.softPct)], ['Max EV', n1(tm.maxEV)],
    ['GB%', pct(tm.gbPct)], ['LD%', pct(tm.ldPct)], ['FB%', pct(tm.fbPct)],
    ['Avg LA', tm.avgLaunchAngle != null ? n1(tm.avgLaunchAngle) + '°' : '—'], ['Swing%', pct(tm.swingPct)], ['2K Contact%', pct(tm.twoKContactPct)],
  ] : [];

  return (
    <div className="print-report-page">
      <ReportHeader player={player} team={team} school={school} hand={hand} isPitcher={false} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5, marginBottom: 10 }}>
        <StatCard label="AVG / OBP / SLG" value={`${n3(sl.avg)} / ${n3(sl.obp)} / ${n3(sl.slg)}`} />
        <StatCard label="K% / BB%" value={tm ? `${pct(tm.kPct)} / ${pct(tm.bbPct)}` : '—'} />
        <StatCard label="Avg EV / EV90" value={tm ? `${n1(tm.avgEV)} / ${n1(tm.ev90)}` : '—'} />
        <StatCard label="Contact%" value={tm ? pct(tm.contactPct) : '—'} />
        <StatCard label="Chase%" value={tm ? pct(tm.chasePct) : '—'} />
      </div>
      <div style={{ display: 'flex', gap: 18, marginBottom: 12 }}>
        <PrintZoneGrid cells={zones} mode="swing" label="Swing% by zone" />
        <PrintZoneGrid cells={zones} mode="whiff" label="Whiff% by zone" />
        <PrintSprayChart pitches={pitches} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 12 }}>
        <div>
          <SectionLabel>Contact and batted-ball profile</SectionLabel>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
            {statRows.map(([l, v]) => (
              <tr key={l}><td style={{ ...tdS, color: MUT }}>{l}</td><td style={{ ...tdS, textAlign: 'right', fontWeight: 700 }}>{v}</td></tr>
            ))}
          </tbody></table>
        </div>
        <div>
          <SectionLabel>Platoon splits</SectionLabel>
          <SplitsTable splits={splits} isPitcher={false} />
        </div>
      </div>
      <ReportFooter n={pitches.length} note="xStats are approximations · low-sample cells shown as —" />
    </div>
  );
}

function PitcherPage({ player, team, school, hand, pitches }) {
  const prof = useMemo(() => pitcherProfile(pitches), [pitches]);
  const zones = useMemo(() => zoneGrid(pitches), [pitches]);
  const splits = useMemo(() => platoonSplitRows(pitches, 'batter_hand'), [pitches]);

  const arsenal = useMemo(() => {
    const byType = {};
    pitches.forEach(p => {
      const t = normalizePitch(p.tagged_pitch_type || p.pitch_type);
      (byType[t] = byType[t] || []).push(p);
    });
    return Object.entries(byType).sort((a, b) => b[1].length - a[1].length).map(([t, rows]) => {
      const velos = rows.map(r => r.rel_speed).filter(v => v != null && v > 0);
      const spins = rows.map(r => r.spin_rate).filter(v => v != null);
      const ivbs = rows.map(r => r.induced_vert_break).filter(v => v != null);
      const hbs = rows.map(r => r.horz_break).filter(v => v != null);
      const swings = rows.filter(r => isSwing(r.pitch_call)).length;
      const whiffs = rows.filter(r => isWhiff(r)).length;
      const m = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
      return {
        t, usage: rows.length / pitches.length, velo: m(velos), spin: m(spins),
        ivb: m(ivbs), hb: m(hbs), whiff: swings ? whiffs / swings : null,
      };
    });
  }, [pitches]);

  return (
    <div className="print-report-page">
      <ReportHeader player={player} team={team} school={school} hand={hand} isPitcher={true} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5, marginBottom: 10 }}>
        <StatCard label="FB velo (avg / max)" value={prof?.fb ? `${n1(prof.fb.avgVelo)} / ${n1(prof.fb.maxVelo)}` : '—'} />
        <StatCard label="K% / BB%" value={prof ? `${pct(prof.kPct)} / ${pct(prof.bbPct)}` : '—'} />
        <StatCard label="Whiff%" value={prof ? pct(prof.whiffPct) : '—'} />
        <StatCard label="Strike%" value={prof ? pct(prof.strikePct) : '—'} />
        <StatCard label="GB%" value={prof ? pct(prof.gbPct) : '—'} />
      </div>
      <div style={{ marginBottom: 10 }}>
        <SectionLabel>Arsenal</SectionLabel>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={thS}>Pitch</th><th style={thS}>Usage</th><th style={thS}>Velo</th><th style={thS}>Spin</th><th style={thS}>IVB</th><th style={thS}>HB</th><th style={thS}>Whiff%</th>
          </tr></thead>
          <tbody>
            {arsenal.map(a => (
              <tr key={a.t}>
                <td style={{ ...tdS, fontWeight: 700 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: getPitchColor(a.t), display: 'inline-block', marginRight: 5 }} />{a.t}
                </td>
                <td style={tdS}>{pct(a.usage)}</td>
                <td style={tdS}>{n1(a.velo)}</td>
                <td style={tdS}>{a.spin != null ? Math.round(a.spin) : '—'}</td>
                <td style={tdS}>{n1(a.ivb)}</td>
                <td style={tdS}>{n1(a.hb)}</td>
                <td style={tdS}>{pct(a.whiff)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: 22, marginBottom: 10, alignItems: 'flex-start' }}>
        <PrintZoneGrid cells={zones} mode="usage" label="Location by zone (usage)" />
        <PrintMovementPlot pitches={pitches} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 12 }}>
        <div><SectionLabel>Fatigue</SectionLabel><PrintVeloByInning pitches={pitches} /></div>
        <div><SectionLabel>Splits allowed</SectionLabel><SplitsTable splits={splits} isPitcher={true} /></div>
      </div>
      <ReportFooter n={pitches.length} note="low-sample cells shown as —" />
    </div>
  );
}

// ── Overlay shell ────────────────────────────────────────────────────────
export default function PrintProfileReport({ open, onClose, player, team, school, hand, isPitcher, pitches, hitterPool }) {
  useEffect(() => {
    if (!open) return;
    document.body.classList.add('print-report-open');
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('print-report-open');
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="print-report-overlay" style={{ position: 'fixed', inset: 0, zIndex: 2000, background: '#3f4348', overflowY: 'auto', padding: '56px 0 40px', fontFamily: REPORT_FONT, color: INK }}>
      <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1, display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '10px 20px', background: '#2b2e32' }}>
        <button onClick={() => window.print()} style={{ background: '#c6b583', border: 'none', color: '#1a1a1a', borderRadius: 6, padding: '8px 18px', fontSize: 12, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', cursor: 'pointer', fontFamily: REPORT_FONT }}>
          Print / Save PDF
        </button>
        <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #888', color: '#ccc', borderRadius: 6, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: REPORT_FONT }}>
          Close
        </button>
      </div>
      {isPitcher
        ? <PitcherPage player={player} team={team} school={school} hand={hand} pitches={pitches} />
        : <HitterPage player={player} team={team} school={school} hand={hand} pitches={pitches} hitterPool={hitterPool} />}
    </div>,
    document.body
  );
}
