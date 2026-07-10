import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { normalizePitch, getPitchColor } from '@/lib/ds';
import {
  zoneGrid, pitcherProfile, hitterTrackmanProfile, slashLine,
  platoonSplitRows, xStatsForRows, percentileRank,
} from '@/lib/profileStats';
import { isSwing, isWhiff, sprayDistribution, normHand } from '@/lib/statsUtils';
import { ZoneHeatmap as DugoutZoneHeatmap, rgba as divergingRgba } from '@/components/dugout/HitterViz';

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

// ── Print spray chart — mirrors the profile SprayChart's field graphics
// (outfield grass, fence arc, distance rings, infield dirt, mound, plate)
// and its EV color / hit-type shape encoding, re-inked for white paper.
// The dugout "mixed" mode's pull/middle/oppo wedges sit on top: three ±45°
// sectors shaded by share of BBE (same sprayDistribution/sprayThird
// classifiers), with % + label at each sector's centroid. Wedges only render
// for a known R/L hand — switch or unknown hands would mislabel pull/oppo. ──
function PrintSprayChart({ pitches, hand }) {
  const W = 250, H = 235, CX = W / 2, CY = H - 14, MAX = 420;
  const R = H - 44;
  const bip = pitches.filter(p => p.pitch_call === 'InPlay' && p.bearing != null && p.hit_distance != null && p.hit_distance > 0);
  const nh = normHand(hand);
  const dist = sprayDistribution(pitches, nh);
  const showWedges = (nh === 'R' || nh === 'L') && dist.total > 0;
  const toXY = (b, d) => {
    const r = Math.min(d / MAX, 1) * R;
    const rad = (b * Math.PI) / 180;
    return { x: CX + Math.sin(rad) * r, y: CY - Math.cos(rad) * r };
  };
  const arc = d => {
    const r = Math.min(d / MAX, 1) * R;
    const a = 45 * Math.PI / 180;
    return `M ${CX - Math.sin(a) * r} ${CY - Math.cos(a) * r} A ${r} ${r} 0 0 1 ${CX + Math.sin(a) * r} ${CY - Math.cos(a) * r}`;
  };
  const foulPt = side => {
    const a = side * 45 * Math.PI / 180;
    return { x: CX + Math.sin(a) * R, y: CY - Math.cos(a) * R };
  };
  const lf = foulPt(-1), rf = foulPt(1);
  const base = 90 / MAX * R;
  const dPts = [
    [CX, CY], [CX - base * 0.707, CY - base * 0.707],
    [CX, CY - base * 1.414], [CX + base * 0.707, CY - base * 0.707],
  ].map(p => p.join(',')).join(' ');

  // Pull/mid/oppo wedges (±45..±15 = LF/RF sectors, ±15 = middle)
  const wedgeD = (b0, b1) => {
    const r0 = b0 * Math.PI / 180, r1 = b1 * Math.PI / 180;
    return `M ${CX} ${CY} L ${CX + Math.sin(r0) * R} ${CY - Math.cos(r0) * R} A ${R} ${R} 0 0 1 ${CX + Math.sin(r1) * R} ${CY - Math.cos(r1) * R} Z`;
  };
  const lblPos = bDeg => ({ x: CX + Math.sin(bDeg * Math.PI / 180) * R * 0.62, y: CY - Math.cos(bDeg * Math.PI / 180) * R * 0.62 });
  const maxPct = Math.max(dist.pullPct, dist.midPct, dist.oppoPct, 0.001);
  const lfIsPull = nh === 'R';
  const lfData = lfIsPull ? { label: 'PULL', pct: dist.pullPct, n: dist.pull } : { label: 'OPPO', pct: dist.oppoPct, n: dist.oppo };
  const rfData = lfIsPull ? { label: 'OPPO', pct: dist.oppoPct, n: dist.oppo } : { label: 'PULL', pct: dist.pullPct, n: dist.pull };
  const midData = { label: 'MID', pct: dist.midPct, n: dist.middle };
  const wedgeFill = p => divergingRgba(maxPct > 0 ? Math.min(1, p / maxPct) : 0, 0.14 + Math.min(1, p / maxPct) * 0.30);
  const wLbl = (d, bDeg) => d.n > 0 ? (
    <g key={d.label}>
      <text x={lblPos(bDeg).x} y={lblPos(bDeg).y} textAnchor="middle" fontSize="13" fontWeight="800" fill={INK} stroke="rgba(255,255,255,0.75)" strokeWidth="2.5" paintOrder="stroke" fontFamily={REPORT_FONT}>{Math.round(d.pct * 100)}%</text>
      <text x={lblPos(bDeg).x} y={lblPos(bDeg).y + 11} textAnchor="middle" fontSize="8" fontWeight="700" fill="#8a6508" stroke="rgba(255,255,255,0.75)" strokeWidth="2" paintOrder="stroke" fontFamily={REPORT_FONT} letterSpacing="0.5">{d.label}</text>
    </g>
  ) : null;

  const points = bip.map(p => {
    const ev = p.exit_speed;
    const color = ev >= 95 ? '#E24B4A' : ev >= 80 ? '#EF9F27' : ev > 0 ? '#1D9E75' : '#888780';
    const la = p.launch_angle;
    const shape = la == null ? 'circle' : la < 10 ? 'square' : la < 25 ? 'diamond' : la < 50 ? 'circle' : 'triangle';
    return { ...toXY(p.bearing, p.hit_distance), color, shape };
  });
  const dot = (p, i) => {
    const r = 3.2;
    if (p.shape === 'square') return <rect key={i} x={p.x - r} y={p.y - r} width={r * 2} height={r * 2} fill={p.color} fillOpacity="0.85" stroke="rgba(0,0,0,.3)" strokeWidth="0.5" />;
    if (p.shape === 'diamond') return <polygon key={i} points={`${p.x},${p.y - r} ${p.x + r},${p.y} ${p.x},${p.y + r} ${p.x - r},${p.y}`} fill={p.color} fillOpacity="0.85" stroke="rgba(0,0,0,.3)" strokeWidth="0.5" />;
    if (p.shape === 'triangle') return <polygon key={i} points={`${p.x},${p.y - r} ${p.x + r},${p.y + r} ${p.x - r},${p.y + r}`} fill={p.color} fillOpacity="0.75" stroke="rgba(0,0,0,.3)" strokeWidth="0.5" />;
    return <circle key={i} cx={p.x} cy={p.y} r={r} fill={p.color} fillOpacity="0.85" stroke="rgba(0,0,0,.3)" strokeWidth="0.5" />;
  };

  return (
    <div style={{ width: '100%' }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: MUT, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 }}>Spray chart · pull/mid/oppo (BIP)</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
        <path d={`M ${CX} ${CY} L ${lf.x} ${lf.y} A ${R} ${R} 0 0 1 ${rf.x} ${rf.y} Z`} fill="rgba(29,158,117,.10)" />
        {showWedges && (<>
          <path d={wedgeD(-45, -15)} fill={wedgeFill(lfData.pct)} stroke="#c9c3b4" strokeWidth="0.5" />
          <path d={wedgeD(-15, 15)} fill={wedgeFill(midData.pct)} stroke="#c9c3b4" strokeWidth="0.5" />
          <path d={wedgeD(15, 45)} fill={wedgeFill(rfData.pct)} stroke="#c9c3b4" strokeWidth="0.5" />
        </>)}
        <line x1={CX} y1={CY} x2={lf.x} y2={lf.y} stroke="#b9b4a6" strokeWidth="1" />
        <line x1={CX} y1={CY} x2={rf.x} y2={rf.y} stroke="#b9b4a6" strokeWidth="1" />
        <path d={arc(MAX)} fill="none" stroke="#8a8577" strokeWidth="1.5" />
        {[200, 300, 370].map(d => <path key={d} d={arc(d)} fill="none" stroke="#d5d0c2" strokeWidth="1" strokeDasharray="4 3" />)}
        {[200, 300, 370].map(d => {
          const { x, y } = toXY(0, d);
          return <text key={d} x={x} y={y - 3} textAnchor="middle" fontSize="7.5" fill={FAINT} fontFamily={REPORT_FONT}>{d}</text>;
        })}
        <polygon points={dPts} fill="rgba(180,140,80,.18)" stroke="#c2ac86" strokeWidth="1" />
        <circle cx={CX} cy={CY - base * 1.414 + (base * 1.414) * 0.57} r="4" fill="rgba(180,140,80,.35)" stroke="#c2ac86" strokeWidth="0.75" />
        <polygon points={`${CX},${CY - 6} ${CX + 4},${CY - 2.5} ${CX + 4},${CY + 2.5} ${CX - 4},${CY + 2.5} ${CX - 4},${CY - 2.5}`} fill="#555" />
        {[...points].sort((a, b) => a.shape === 'circle' ? 1 : -1).map(dot)}
        {showWedges && (<>{wLbl(lfData, -30)}{wLbl(midData, 0)}{wLbl(rfData, 30)}</>)}
        <text x={12} y={CY - 34} fontSize="8" fontWeight="700" fill={FAINT} fontFamily={REPORT_FONT}>LF</text>
        <text x={W - 12} y={CY - 34} textAnchor="end" fontSize="8" fontWeight="700" fill={FAINT} fontFamily={REPORT_FONT}>RF</text>
        <text x={CX} y={16} textAnchor="middle" fontSize="8" fontWeight="700" fill={FAINT} fontFamily={REPORT_FONT}>CF</text>
      </svg>
      <div style={{ fontSize: 8, color: FAINT, marginTop: 2 }}>
        <span style={{ color: '#E24B4A' }}>●</span> 95+ <span style={{ color: '#EF9F27' }}>●</span> 80–94 <span style={{ color: '#1D9E75' }}>●</span> &lt;80 mph · ■ GB ◆ LD ● FB ▲ PU · n = {bip.length}
      </div>
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

// pools (optional): { avg, obp, slg, kPct, whiffPct } league arrays — when
// provided, stat cells get the same diverging percentile shading as the main
// stats table (K% and Whiff% inverted: lower is better for hitters).
function SplitsTable({ splits, isPitcher, pools }) {
  const cell = (raw, key, inv) => pools ? divergingCell(raw, pools[key], inv) : {};
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead><tr>
        <th style={thS}>{isPitcher ? 'vs' : 'vs'}</th><th style={thS}>PA</th><th style={thS}>AVG</th><th style={thS}>OBP</th><th style={thS}>SLG</th><th style={thS}>K%</th><th style={thS}>Whiff%</th>
      </tr></thead>
      <tbody>
        {splits.map(s => {
          const kPct = s.stats.pa ? s.stats.k / s.stats.pa : null;
          return (
            <tr key={s.label}>
              <td style={{ ...tdS, fontWeight: 700 }}>{s.label}</td>
              <td style={tdS}>{s.stats.pa || 0}</td>
              <td style={{ ...tdS, ...cell(s.stats.avg, 'avg', false) }}>{n3(s.stats.avg)}</td>
              <td style={{ ...tdS, ...cell(s.stats.obp, 'obp', false) }}>{n3(s.stats.obp)}</td>
              <td style={{ ...tdS, ...cell(s.stats.slg, 'slg', false) }}>{n3(s.stats.slg)}</td>
              <td style={{ ...tdS, ...cell(kPct, 'kPct', true) }}>{kPct != null ? pct(kPct) : '—'}</td>
              <td style={{ ...tdS, ...cell(s.stats.whiffPct, 'whiffPct', true) }}>{pct(s.stats.whiffPct)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ReportHeader({ player, team, school, isPitcher, hand }) {
  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `2.5px solid ${NAVY}`, paddingBottom: 6, marginBottom: 8 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          {player.jerseyNumber != null && player.jerseyNumber !== '' && (
            <span style={{ fontSize: 24, fontWeight: 900, color: GOLD, letterSpacing: -1, fontVariantNumeric: 'tabular-nums' }}>#{player.jerseyNumber}</span>
          )}
          <span style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.5 }}>{player.name}</span>
        </div>
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
// Diverging cell background: percentile vs the league hitter pool, mapped
// onto the same blue-white-red scale the dugout heatmap uses (rgba from
// HitterViz — one implementation, fix-at-source). invert=true flips metrics
// where lower is better (K%, GB%, Soft%). No pool / no value → no color.
function divergingCell(raw, pool, invert = false) {
  if (raw == null || !pool || pool.length < 4) return {};
  let t = percentileRank(pool, raw) / 100;
  if (invert) t = 1 - t;
  return { background: divergingRgba(t, 0.5) };
}

// Family-grouped vs-pitch-type table. Families per Derek's spec:
// Fastballs = Four-Seam / Sinker / Cutter; Breaking = Slider / Sweeper /
// Curveball (Knucklecurve folded in — it's a curveball variant and would
// otherwise silently drop); Offspeed = ChangeUp / Splitter. Each family gets
// a bold cumulative row computed over ALL its raw rows (not an average of
// the variation rows), then one row per variation seen. 'Undefined' and any
// unmapped raw type strings are excluded entirely. Same shared classifiers
// and rulebook OOZ bounds as the profile's VsPitchType.
const PITCH_FAMILIES = [
  { label: 'Fastballs', types: ['Four-Seam', 'Sinker', 'Cutter'] },
  { label: 'Breaking', types: ['Slider', 'Sweeper', 'Curveball', 'Knucklecurve'] },
  { label: 'Offspeed', types: ['ChangeUp', 'Splitter'] },
];

function pitchTypeLine(rs, allN) {
  const ooz = p => p.plate_loc_height != null && (p.plate_loc_height < 1.5 || p.plate_loc_height > 3.5 || p.plate_loc_side < -0.83 || p.plate_loc_side > 0.83);
  // NOTE: shared isSwing/isWhiff take the ROW (they read r.pitch_call
  // internally) — passing the call string silently classifies nothing.
  const swings = rs.filter(r => isSwing(r)).length;
  const whiffs = rs.filter(r => isWhiff(r)).length;
  const chases = rs.filter(r => ooz(r) && isSwing(r)).length;
  const oozN = rs.filter(r => ooz(r)).length;
  const evs = rs.filter(r => r.pitch_call === 'InPlay' && r.exit_speed > 0).map(r => r.exit_speed);
  const contact = rs.filter(r => ['FoulBall', 'FoulTip', 'FoulBallNotFieldable', 'FoulBallFieldable', 'InPlay'].includes(r.pitch_call)).length;
  return {
    n: rs.length,
    swingPct: rs.length ? swings / rs.length : null,
    whiffPct: swings ? whiffs / swings : null,
    chasePct: oozN ? chases / oozN : null,
    contactPct: swings ? contact / swings : null,
    avgEV: evs.length ? evs.reduce((a, b) => a + b, 0) / evs.length : null,
  };
}

function PrintVsPitchType({ pitches }) {
  const families = useMemo(() => {
    const byType = {};
    pitches.forEach(p => {
      const t = normalizePitch(p.tagged_pitch_type || p.pitch_type);
      (byType[t] = byType[t] || []).push(p);
    });
    return PITCH_FAMILIES.map(fam => {
      const famRows = fam.types.flatMap(t => byType[t] || []);
      if (!famRows.length) return null;
      return {
        label: fam.label,
        total: pitchTypeLine(famRows),
        variations: fam.types
          .filter(t => byType[t]?.length)
          .map(t => ({ t, line: pitchTypeLine(byType[t]) })),
      };
    }).filter(Boolean);
  }, [pitches]);

  if (!families.length) return null;
  const cTh = { ...thS, padding: '2px 4px', fontSize: 8 };
  const cTd = { ...tdS, padding: '2px 4px', fontSize: 9.5 };
  const statCells = (line, bold = false) => (
    <>
      <td style={{ ...cTd, fontWeight: bold ? 700 : 400 }}>{pct(line.swingPct)}</td>
      <td style={{ ...cTd, fontWeight: (line.whiffPct != null && line.whiffPct >= 0.30) || bold ? 700 : 400, color: line.whiffPct != null && line.whiffPct >= 0.30 ? '#c0392b' : INK }}>{pct(line.whiffPct)}</td>
      <td style={{ ...cTd, fontWeight: bold ? 700 : 400 }}>{pct(line.chasePct)}</td>
      <td style={{ ...cTd, fontWeight: (line.contactPct != null && line.contactPct >= 0.80) || bold ? 700 : 400, color: line.contactPct != null && line.contactPct >= 0.80 ? '#1e8449' : INK }}>{pct(line.contactPct)}</td>
      <td style={{ ...cTd, fontWeight: bold ? 700 : 400 }}>{n1(line.avgEV)}</td>
    </>
  );
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead><tr>
        <th style={cTh}>Pitch (n)</th><th style={cTh}>Swing%</th><th style={cTh}>Whiff%</th><th style={cTh}>Chase%</th><th style={cTh}>Contact%</th><th style={cTh}>Avg EV</th>
      </tr></thead>
      <tbody>
        {families.map(fam => (
          <React.Fragment key={fam.label}>
            <tr style={{ background: CARD }}>
              <td style={{ ...cTd, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>
                {fam.label} <span style={{ color: FAINT, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>({fam.total.n})</span>
              </td>
              {statCells(fam.total, true)}
            </tr>
            {fam.variations.map(({ t, line }) => (
              <tr key={t}>
                <td style={{ ...cTd, whiteSpace: 'nowrap', paddingLeft: 12 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: getPitchColor(t), display: 'inline-block', marginRight: 4 }} />
                  {t} <span style={{ color: FAINT }}>({line.n})</span>
                </td>
                {statCells(line)}
              </tr>
            ))}
          </React.Fragment>
        ))}
      </tbody>
    </table>
  );
}

function HitterPage({ player, team, school, hand, pitches, hitterPool }) {
  const tm = useMemo(() => hitterTrackmanProfile(pitches), [pitches]);
  const sl = useMemo(() => slashLine(pitches), [pitches]);
  const splits = useMemo(() => platoonSplitRows(pitches, 'pitcher_hand'), [pitches]);
  const xs = useMemo(() => hitterPool?.xGrid ? xStatsForRows(pitches, hitterPool.xGrid) : null, [pitches, hitterPool]);
  const P = hitterPool || {};

  // [label, display, raw, pool, invert]
  const statRows = tm ? [
    ['xBA (approx)', xs ? n3(xs.xBA) : '—', xs?.xBA, P.xBA, false],
    ['xwOBA (approx)', xs ? n3(xs.xwOBA) : '—', xs?.xwOBA, P.xwOBA, false],
    ['xSLG (approx)', xs ? n3(xs.xSLG) : '—', xs?.xSLG, P.xSLG, false],
    ['ISO', n3(tm.iso), tm.iso, P.iso, false],
    ['BABIP', n3(tm.babip), tm.babip, P.babip, false],
    ['Barrel% (approx)', pct(tm.barrelPct), tm.barrelPct, P.barrelPct, false],
    ['Hard%', pct(tm.hardPct), tm.hardPct, P.hardPct, false],
    ['Soft%', pct(tm.softPct), tm.softPct, P.softPct, true],
    ['Max EV', n1(tm.maxEV), tm.maxEV, P.maxEV, false],
    ['GB%', pct(tm.gbPct), tm.gbPct, P.gbPct, true],
    ['LD%', pct(tm.ldPct), tm.ldPct, P.ldPct, false],
    ['FB%', pct(tm.fbPct), tm.fbPct, P.fbPct, false],
    ['Avg LA', tm.avgLaunchAngle != null ? n1(tm.avgLaunchAngle) + '°' : '—', tm.avgLaunchAngle, P.launchAngle, false],
    ['Swing%', pct(tm.swingPct), tm.swingPct, P.swingPct, false],
    ['2K Contact%', pct(tm.twoKContactPct), tm.twoKContactPct, P.twoKContactPct, false],
  ] : [];

  return (
    <div className="print-report-page">
      <ReportHeader player={player} team={team} school={school} hand={hand} isPitcher={false} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5, marginBottom: 8 }}>
        <StatCard label="AVG / OBP / SLG" value={`${n3(sl.avg)} / ${n3(sl.obp)} / ${n3(sl.slg)}`} />
        <StatCard label="K% / BB%" value={tm ? `${pct(tm.kPct)} / ${pct(tm.bbPct)}` : '—'} />
        <StatCard label="Avg EV / EV90" value={tm ? `${n1(tm.avgEV)} / ${n1(tm.ev90)}` : '—'} />
        <StatCard label="Contact%" value={tm ? pct(tm.contactPct) : '—'} />
        <StatCard label="Chase%" value={tm ? pct(tm.chasePct) : '—'} />
      </div>
      <div style={{ display: 'flex', gap: 14, marginBottom: 8, alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <SectionLabel>Hot zones (damage)</SectionLabel>
          <DugoutZoneHeatmap rows={pitches} viewMode="pitcher" batterHand={hand === 'Left' ? 'L' : hand === 'Right' ? 'R' : (hand || '')} />
        </div>
        <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <PrintSprayChart pitches={pitches} hand={hand} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 10 }}>
        <div>
          <SectionLabel>Contact and batted-ball profile · vs CCL percentile</SectionLabel>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
            {statRows.map(([l, v, raw, pool, inv]) => (
              <tr key={l}>
                <td style={{ ...tdS, color: MUT, padding: '2.5px 6px' }}>{l}</td>
                <td style={{ ...tdS, textAlign: 'right', fontWeight: 700, padding: '2.5px 6px', ...divergingCell(raw, pool, inv) }}>{v}</td>
              </tr>
            ))}
          </tbody></table>
          <div style={{ fontSize: 8, color: FAINT, marginTop: 3 }}>Cell color = CCL percentile · blue = below league, red = above (flipped where lower is better)</div>
        </div>
        <div>
          <SectionLabel>Platoon splits · vs CCL percentile</SectionLabel>
          <SplitsTable splits={splits} isPitcher={false} pools={{ avg: P.avg, obp: P.obp, slg: P.slg, kPct: P.kPct, whiffPct: P.whiffPct }} />
          <div style={{ marginTop: 8 }}>
            <SectionLabel>Vs pitch type · by family</SectionLabel>
            <PrintVsPitchType pitches={pitches} />
          </div>
        </div>
      </div>
      <ReportFooter n={pitches.length} note="xStats are approximations · low-sample cells shown as — / hatched" />
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
      const swings = rows.filter(r => isSwing(r)).length;
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
