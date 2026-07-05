import React, { useMemo } from 'react';
import { normalizePitch, getPitchColor } from '@/lib/ds';
import PercentileBar from '@/components/shared/PercentileBar';
import {
  pitcherProfile, percentileRank, fmtStat,
  cswKbb, releasePoints, extensionBreakdown, spinDirectionByType, rollingGameTrend,
  leagueMovementProfile,
} from '@/lib/profileStats';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, ScatterChart, Scatter, ZAxis, Legend
} from 'recharts';
import { isSwing, isStrike, isWhiff, isContact, isFastballVeloType } from '@/lib/statsUtils';
import { C, FONT } from '@/lib/darkTheme';
import MovementScatterCircular from '@/components/charts/MovementScatterCircular';
import LocationContourPlot from '@/components/charts/LocationContourPlot';
import BattedBallContactPanel from '@/components/shared/BattedBallContactPanel';
import PlatoonSplitsTable from '@/components/shared/PlatoonSplitsTable';

const pColor = pt => getPitchColor(pt);

// ── Shared helpers ─────────────────────────────────────────────
const FONT_STYLE = { fontFamily: FONT };
const mean = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
const pct = v => v == null ? '—' : (v * 100).toFixed(0) + '%';
const n1 = v => v == null ? '—' : v.toFixed(1);
const n0 = v => v == null ? '—' : Math.round(v).toString();

function sHead(label, sub) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${C.edge}` }}>
      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2.5, textTransform: 'uppercase', color: C.gold, ...FONT_STYLE }}>{label}</span>
      {sub && <span style={{ fontSize: 11, color: C.muted, ...FONT_STYLE }}>{sub}</span>}
    </div>
  );
}

function Card({ children, style }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.edge}`, borderRadius: 9, padding: '14px 16px', ...style }}>
      {children}
    </div>
  );
}

// ── Stat Pills row ─────────────────────────────────────────────
function StatPills({ items }) {
  const valid = items.filter(Boolean);
  if (!valid.length) return null;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
      {valid.map(it => (
        <div key={it.label} style={{
          background: C.surface, border: `1px solid ${C.edge}`, borderRadius: 7,
          padding: '8px 12px', minWidth: 64, textAlign: 'center',
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, ...FONT_STYLE }}>{it.label}</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: it.gold ? C.gold : C.white, marginTop: 2, fontVariantNumeric: 'tabular-nums', ...FONT_STYLE }}>{it.value}</div>
        </div>
      ))}
    </div>
  );
}

// ── Percentile section ─────────────────────────────────────────
function PitcherPercentiles({ pitches, pitcherPool }) {
  const prof = useMemo(() => pitcherProfile(pitches), [pitches]);
  if (!prof || !pitcherPool) return null;
  const P = pitcherPool;
  const n = P.qualifiedN;

  const rows = [
    { label: 'Avg FB', value: prof.fb?.avgVelo != null ? n1(prof.fb.avgVelo) : null, raw: prof.fb?.avgVelo, pool: P.fbVelo, invert: false },
    { label: 'Max FB', value: prof.fb?.maxVelo != null ? n1(prof.fb.maxVelo) : null, raw: prof.fb?.maxVelo, pool: P.maxVelo, invert: false },
    { label: 'FB Spin', value: prof.fb?.avgSpin != null ? n0(prof.fb.avgSpin) : null, raw: prof.fb?.avgSpin, pool: P.fbSpin, invert: false },
    { label: 'BB Spin', value: prof.bb?.avgSpin != null ? n0(prof.bb.avgSpin) : null, raw: prof.bb?.avgSpin, pool: P.bbSpin, invert: false },
    { label: 'K%', value: pct(prof.kPct), raw: prof.kPct, pool: P.kPct, invert: false },
    { label: 'Free pass%', value: pct(prof.bbPct), raw: prof.bbPct, pool: P.bbPct, invert: true },
    { label: 'Hard%', value: pct(prof.hardPct), raw: prof.hardPct, pool: P.hardPct, invert: true },
    { label: 'Soft%', value: pct(prof.softPct), raw: prof.softPct, pool: P.softPct, invert: false },
    { label: 'GB%', value: pct(prof.gbPct), raw: prof.gbPct, pool: P.gbPct, invert: false },
    { label: 'Whiff%', value: pct(prof.whiffPct), raw: prof.whiffPct, pool: P.whiffPct, invert: false },
    { label: 'BABIP', value: prof.babip != null ? fmtStat(prof.babip) : null, raw: prof.babip, pool: P.babip, invert: true },
  ].filter(r => r.value != null && r.value !== '—');

  if (!rows.length) return null;
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 32px' }}>
        {rows.map(row => {
          const rank = percentileRank(row.pool, row.raw);
          const display = row.invert && rank != null ? 100 - rank : rank;
          return <PercentileBar key={row.label} label={row.label} value={row.value} percentile={display} />;
        })}
      </div>
      <div style={{ fontSize: 10, color: C.muted, marginTop: 8, ...FONT_STYLE }}>vs {n} qualified CCL pitchers</div>
    </div>
  );
}

// ── Velocity Bands histogram ───────────────────────────────────
function VeloHistogram({ pitches }) {
  const data = useMemo(() => {
    const fbRows = pitches.filter(p => {
      const pt = normalizePitch(p.tagged_pitch_type || p.pitch_type);
      return isFastballVeloType(pt);
    });
    const velos = fbRows.map(r => r.rel_speed).filter(v => v != null && v > 0);
    if (velos.length < 5) return null;
    const minV = Math.floor(Math.min(...velos));
    const maxV = Math.ceil(Math.max(...velos));
    const bands = [];
    for (let v = minV; v <= maxV; v++) bands.push({ velo: v, count: 0 });
    velos.forEach(v => {
      const i = Math.min(Math.round(v) - minV, bands.length - 1);
      if (i >= 0) bands[i].count++;
    });
    return bands;
  }, [pitches]);

  if (!data) return null;
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, ...FONT_STYLE }}>FB family velocity distribution</div>
      <ResponsiveContainer width="100%" height={100}>
        <BarChart data={data} margin={{ top: 2, right: 8, bottom: 2, left: 0 }}>
          <XAxis dataKey="velo" tick={{ fontSize: 9, fill: C.muted }} interval={2} />
          <YAxis tick={{ fontSize: 9, fill: C.muted }} width={22} />
          <Bar dataKey="count" fill={C.gold} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Arsenal detail table ───────────────────────────────────────
function ArsenalTable({ pitches }) {
  const total = pitches.length;
  const detail = useMemo(() => {
    const map = {};
    pitches.forEach(p => {
      const pt = normalizePitch(p.tagged_pitch_type || p.pitch_type);
      if (!map[pt]) map[pt] = [];
      map[pt].push(p);
    });
    return Object.entries(map)
      .sort((a, b) => b[1].length - a[1].length)
      .map(([pt, rows]) => {
        const velos = rows.map(r => r.rel_speed).filter(v => v != null && v > 0);
        const spins = rows.map(r => r.spin_rate).filter(v => v != null);
        const swings = rows.filter(isSwing).length;
        const whiffs = rows.filter(isWhiff).length;
        const strikes = rows.filter(isStrike).length;
        const inZone = rows.filter(r => r.plate_loc_height >= 1.5 && r.plate_loc_height <= 3.5 && r.plate_loc_side >= -0.83 && r.plate_loc_side <= 0.83);
        const zSwings = inZone.filter(isSwing).length;
        const zWhiffs = inZone.filter(isWhiff).length;
        const ooz = rows.filter(r => r.plate_loc_height != null && (r.plate_loc_height < 1.5 || r.plate_loc_height > 3.5 || r.plate_loc_side < -0.83 || r.plate_loc_side > 0.83));
        const chases = ooz.filter(isSwing).length;
        const bip = rows.filter(r => r.pitch_call === 'InPlay' && r.exit_speed > 0);
        const evs = bip.map(r => r.exit_speed).filter(v => v != null);
        return {
          pt, count: rows.length, usage: rows.length / total,
          color: pColor(pt),
          avgVelo: mean(velos), maxVelo: velos.length ? Math.max(...velos) : null,
          avgSpin: mean(spins),
          strikePct: rows.length ? strikes / rows.length : null,
          whiffPct: swings ? whiffs / swings : null,
          zonePct: rows.length ? inZone.length / rows.length : null,
          zSwingPct: inZone.length ? zSwings / inZone.length : null,
          zWhiffPct: zSwings ? zWhiffs / zSwings : null,
          chasePct: ooz.length ? chases / ooz.length : null,
          avgEV: mean(evs),
        };
      });
  }, [pitches]);

  if (!detail.length) return null;
  const isFB = pt => ['Fastball','Four-Seam','Sinker','Cutter'].includes(pt);
  const th = { padding: '6px 8px', fontSize: 9, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, textAlign: 'right', whiteSpace: 'nowrap', ...FONT_STYLE };
  const td = { padding: '7px 8px', fontSize: 12, textAlign: 'right', color: C.cream, fontVariantNumeric: 'tabular-nums', borderBottom: `0.5px solid ${C.edge}`, ...FONT_STYLE };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            {['Pitch','Use%','Velo','Max','Spin','Str%','Whiff%','Zone%','Z-Sw%','Z-Wh%','Chase%','EV'].map((h, i) => (
              <th key={h} style={{ ...th, textAlign: i === 0 ? 'left' : 'right' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {detail.map(d => (
            <tr key={d.pt} style={{ background: 'transparent' }}>
              <td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: d.color, marginRight: 6 }} />
                {d.pt}
              </td>
              <td style={td}>{(d.usage * 100).toFixed(0)}%</td>
              <td style={{ ...td, fontWeight: 700, color: C.white }}>{n1(d.avgVelo)}</td>
              <td style={{ ...td, color: C.muted }}>{isFB(d.pt) && d.maxVelo != null ? n1(d.maxVelo) : '—'}</td>
              <td style={td}>{n0(d.avgSpin)}</td>
              <td style={td}>{pct(d.strikePct)}</td>
              <td style={{ ...td, color: d.whiffPct != null && d.whiffPct >= 0.28 ? C.green : C.cream }}>{pct(d.whiffPct)}</td>
              <td style={td}>{pct(d.zonePct)}</td>
              <td style={td}>{pct(d.zSwingPct)}</td>
              <td style={td}>{pct(d.zWhiffPct)}</td>
              <td style={td}>{pct(d.chasePct)}</td>
              <td style={td}>{n1(d.avgEV)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Count splits table ─────────────────────────────────────────
function CountSplitsTable({ pitches }) {
  const { res, totals, types } = useMemo(() => {
    const bucket = p => {
      const b = p.balls ?? 0, s = p.strikes ?? 0;
      if (s > b) return 'ahead'; if (b > s) return 'behind'; return 'even';
    };
    const res = { ahead: {}, even: {}, behind: {} };
    const totals = { ahead: 0, even: 0, behind: 0 };
    pitches.forEach(p => {
      const bk = bucket(p);
      const pt = normalizePitch(p.tagged_pitch_type || p.pitch_type);
      res[bk][pt] = (res[bk][pt] || 0) + 1;
      totals[bk]++;
    });
    const types = [...new Set([...Object.keys(res.ahead),...Object.keys(res.even),...Object.keys(res.behind)])];
    return { res, totals, types };
  }, [pitches]);

  if (!types.length) return null;
  const getPct = (bk, t) => totals[bk] > 0 ? Math.round((res[bk][t] || 0) / totals[bk] * 100) + '%' : '—';
  const th = { padding: '5px 10px', fontSize: 9, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, ...FONT_STYLE };
  const td = { padding: '6px 10px', fontSize: 12, color: C.cream, textAlign: 'center', borderBottom: `0.5px solid ${C.edge}`, fontVariantNumeric: 'tabular-nums', ...FONT_STYLE };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: 'left' }}>Count</th>
            {types.map(t => (
              <th key={t} style={{ ...th, textAlign: 'center' }}>
                <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: pColor(t), marginRight: 4 }} />{t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[['ahead', 'Ahead'], ['even', 'Even'], ['behind', 'Behind']].map(([k, lbl]) => (
            <tr key={k}>
              <td style={{ ...td, textAlign: 'left', fontWeight: 700, color: C.white }}>
                {lbl} <span style={{ color: C.muted, fontWeight: 400 }}>({totals[k]})</span>
              </td>
              {types.map(t => <td key={t} style={td}>{getPct(k, t)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Handedness splits ─────────────────────────────────────────
function HandednessSplits({ pitches }) {
  const { vsR, vsL, types } = useMemo(() => {
    const vsR = {}, vsL = {};
    let rTotal = 0, lTotal = 0;
    pitches.forEach(p => {
      const pt = normalizePitch(p.tagged_pitch_type || p.pitch_type);
      const side = p.batter_hand;
      if (side === 'Right') { vsR[pt] = (vsR[pt] || 0) + 1; rTotal++; }
      else if (side === 'Left') { vsL[pt] = (vsL[pt] || 0) + 1; lTotal++; }
    });
    const types = [...new Set([...Object.keys(vsR),...Object.keys(vsL)])];
    return { vsR: { types: vsR, total: rTotal }, vsL: { types: vsL, total: lTotal }, types };
  }, [pitches]);

  if (!types.length || (!vsR.total && !vsL.total)) return null;
  const getPct = (side, t) => side.total > 0 ? Math.round((side.types[t] || 0) / side.total * 100) + '%' : '—';

  // Horizontal segmented bars
  const MixBar = ({ side, label }) => {
    if (!side.total) return null;
    const order = types.map(t => ({ t, c: side.types[t] || 0 })).sort((a, b) => b.c - a.c).filter(x => x.c > 0);
    return (
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, marginBottom: 4, ...FONT_STYLE }}>
          {label} <span style={{ color: C.muted, fontWeight: 400 }}>({side.total})</span>
        </div>
        <div style={{ display: 'flex', height: 20, borderRadius: 4, overflow: 'hidden', border: `1px solid ${C.edge}` }}>
          {order.map(({ t, c }) => (
            <div key={t} title={`${t} ${Math.round(c / side.total * 100)}%`}
              style={{ width: (c / side.total * 100) + '%', background: pColor(t), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', overflow: 'hidden' }}>
              {c / side.total > 0.12 ? t.slice(0, 2) : ''}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 3, flexWrap: 'wrap' }}>
          {order.map(({ t, c }) => (
            <span key={t} style={{ fontSize: 10, color: C.muted, ...FONT_STYLE }}>
              <b style={{ color: pColor(t) }}>{t.slice(0, 2)}</b> {Math.round(c / side.total * 100)}%
            </span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      <MixBar side={vsR} label="vs RHH" />
      <MixBar side={vsL} label="vs LHH" />
    </div>
  );
}

// ── Contact Allowed section ───────────────────────────────────
function ContactSection({ pitches }) {
  const { bip, sprayPts, evValues, gbPct, ldPct, fbPct, puPct, hardPct, avgEV, babip } = useMemo(() => {
    const bip = pitches.filter(p => p.pitch_call === 'InPlay' && p.exit_speed > 0);
    const sprayPts = [];
    let gb = 0, ld = 0, fb = 0, pu = 0, hard = 0, evSum = 0, evCount = 0;
    let bipHits = 0, hrN = 0;
    const evValues = [];
    bip.forEach(p => {
      const la = p.launch_angle, ev = p.exit_speed, bearing = p.bearing, dist = p.hit_distance;
      const laType = la == null ? null : la < 10 ? 'GB' : la < 25 ? 'LD' : la < 50 ? 'FB' : 'PU';
      if (laType === 'GB') gb++; else if (laType === 'LD') ld++; else if (laType === 'FB') fb++; else if (laType === 'PU') pu++;
      if (ev != null && ev >= 95) hard++;
      if (ev != null) { evSum += ev; evCount++; evValues.push(ev); }
      if (bearing != null && dist != null) sprayPts.push({ bearing, dist, type: laType, exit_speed: ev });
      if (['Single','Double','Triple'].includes(p.play_result)) bipHits++;
      if (p.play_result === 'HomeRun') hrN++;
    });
    const bipN = bip.length;
    const babipDen = bipN - hrN;
    return {
      bip, sprayPts, evValues,
      gbPct: bipN ? gb / bipN : null,
      ldPct: bipN ? ld / bipN : null,
      fbPct: bipN ? fb / bipN : null,
      puPct: bipN ? pu / bipN : null,
      hardPct: evCount ? hard / evCount : null,
      avgEV: evCount ? evSum / evCount : null,
      babip: babipDen > 0 ? bipHits / babipDen : null,
    };
  }, [pitches]);

  if (bip.length < 5) return null;

  // EV box plot
  const sorted = [...evValues].sort((a, b) => a - b);
  const q = p => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  const stats = { min: sorted[0], q1: q(0.25), med: q(0.5), q3: q(0.75), max: sorted[sorted.length - 1], avg: mean(evValues) };
  const span = (stats.max - stats.min) || 1;
  const pos = v => ((v - stats.min) / span) * 100;

  // Spray chart SVG — EV-based coloring on dark background
  const SIZE = 190;
  const cxS = SIZE / 2, cyS = SIZE - 10, R = SIZE - 28;
  const evColor = (p) => {
    const ev = p.exit_speed;
    if (ev >= 95) return '#E24B4A';
    if (ev >= 80) return '#EF9F27';
    if (ev > 0)   return '#1D9E75';
    return '#888780';
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 240px' }}>
          {/* Batted ball type bar */}
          <div style={{ fontSize: 10, color: C.muted, marginBottom: 5, ...FONT_STYLE }}>Batted-ball type</div>
          <div style={{ display: 'flex', height: 20, borderRadius: 4, overflow: 'hidden', border: `1px solid ${C.edge}` }}>
            {[['GB', gbPct, '#8c6d3f'], ['LD', ldPct, '#2c7a4b'], ['FB', fbPct, '#2c6080'], ['PU', puPct, '#9a9a9a']]
              .filter(([, p]) => p != null && p > 0)
              .map(([lbl, p, col]) => (
                <div key={lbl} style={{ width: (p * 100) + '%', background: col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff' }}>
                  {p >= 0.1 ? lbl : ''}
                </div>
              ))}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
            {[['GB', gbPct, '#c49a5a'], ['LD', ldPct, '#4ab87a'], ['FB', fbPct, '#4a95c0'], ['PU', puPct, '#aaaaaa']]
              .filter(([, p]) => p != null)
              .map(([lbl, p, col]) => (
                <span key={lbl} style={{ fontSize: 10, color: C.muted, ...FONT_STYLE }}>
                  <b style={{ color: col }}>{lbl}</b> {(p * 100).toFixed(0)}%
                </span>
              ))}
          </div>

          {/* EV box plot */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 6, ...FONT_STYLE }}>Exit velo distribution</div>
            <div style={{ position: 'relative', height: 34, marginBottom: 4 }}>
              <div style={{ position: 'absolute', top: 16, left: 0, right: 0, height: 2, background: C.edge }} />
              <div style={{ position: 'absolute', top: 10, left: pos(stats.q1) + '%', width: (pos(stats.q3) - pos(stats.q1)) + '%', height: 14, background: 'rgba(44,123,182,.35)', border: `1.5px solid #2c7bb6`, borderRadius: 3 }} />
              <div style={{ position: 'absolute', top: 8, left: pos(stats.med) + '%', width: 2.5, height: 18, background: C.white }} />
              <div style={{ position: 'absolute', top: 12, left: `calc(${pos(stats.avg)}% - 4px)`, width: 8, height: 8, borderRadius: '50%', background: C.gold, border: `1.5px solid ${C.base}` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.muted, ...FONT_STYLE }}>
              <span>{stats.min.toFixed(0)}</span>
              <span style={{ color: C.white, fontWeight: 700 }}>med {stats.med.toFixed(0)}</span>
              <span>{stats.max.toFixed(0)} mph</span>
            </div>
          </div>

          {/* Summary stats */}
          <div style={{ display: 'flex', gap: 14, marginTop: 12, flexWrap: 'wrap', fontSize: 11, color: C.cream, ...FONT_STYLE }}>
            <span><b style={{ color: C.gold }}>BABIP</b> {babip != null ? fmtStat(babip) : '—'}</span>
            <span><b style={{ color: C.gold }}>Hard%</b> {pct(hardPct)}</span>
            <span><b style={{ color: C.gold }}>Avg EV</b> {n1(avgEV)}</span>
            <span><b style={{ color: C.muted }}>n={bip.length}</b></span>
          </div>
        </div>

        {/* Spray chart */}
        {sprayPts.length > 0 && (
          <div style={{ flex: '0 0 auto' }}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, textAlign: 'center', ...FONT_STYLE }}>Spray (contact allowed)</div>
            <svg width={SIZE} height={SIZE} style={{ display: 'block', background: 'rgba(0,0,0,.25)', borderRadius: 7 }}>
              {/* Outfield grass */}
              <path d={`M ${cxS - R*0.71} ${cyS - R*0.71} A ${R} ${R} 0 0 1 ${cxS + R*0.71} ${cyS - R*0.71} Z`}
                fill="rgba(29,158,117,.12)" />
              {/* Foul lines */}
              <line x1={cxS} y1={cyS} x2={cxS - R*0.71} y2={cyS - R*0.71} stroke="rgba(255,255,255,.2)" strokeWidth={1} />
              <line x1={cxS} y1={cyS} x2={cxS + R*0.71} y2={cyS - R*0.71} stroke="rgba(255,255,255,.2)" strokeWidth={1} />
              {/* Wall arc */}
              <path d={`M ${cxS - R*0.71} ${cyS - R*0.71} A ${R} ${R} 0 0 1 ${cxS + R*0.71} ${cyS - R*0.71}`}
                fill="none" stroke="rgba(255,255,255,.25)" strokeWidth={1.5} />
              {/* Distance arc ~300ft */}
              {(() => { const r2 = R * 0.71; return <path d={`M ${cxS - r2*0.71} ${cyS - r2*0.71} A ${r2} ${r2} 0 0 1 ${cxS + r2*0.71} ${cyS - r2*0.71}`} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={1} strokeDasharray="3 3" />; })()}
              {/* Infield diamond */}
              <rect x={cxS-14} y={cyS-30} width={28} height={28} fill="rgba(180,140,80,.15)" stroke="rgba(255,255,255,.2)" strokeWidth={1}
                transform={`rotate(45 ${cxS} ${cyS-16})`} />
              {/* Home plate */}
              <polygon points={`${cxS},${cyS-6} ${cxS+4},${cyS-2} ${cxS+4},${cyS+2} ${cxS-4},${cyS+2} ${cxS-4},${cyS-2}`}
                fill="rgba(255,255,255,.6)" />
              {/* LF/RF labels */}
              <text x={8} y={cyS - R*0.71 + 10} fontSize={8} fontWeight={700} fill="rgba(255,255,255,.35)" fontFamily="'Archivo',sans-serif">LF</text>
              <text x={SIZE - 8} y={cyS - R*0.71 + 10} textAnchor="end" fontSize={8} fontWeight={700} fill="rgba(255,255,255,.35)" fontFamily="'Archivo',sans-serif">RF</text>
              {/* Dots */}
              {sprayPts.map((p, i) => {
                const rad = (p.bearing * Math.PI) / 180;
                const d = Math.min(p.dist, 420) / 420;
                const px = cxS + Math.sin(rad) * d * R * 0.71;
                const py = cyS - Math.cos(rad) * d * R * 0.71;
                return <circle key={i} cx={px} cy={py} r={3.5} fill={evColor(p)} fillOpacity={0.85} stroke="rgba(0,0,0,.3)" strokeWidth={0.5} />;
              })}
            </svg>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 4, fontSize: 9, color: C.muted, ...FONT_STYLE }}>
              <span><b style={{ color: '#E24B4A' }}>●</b> 95+</span>
              <span><b style={{ color: '#EF9F27' }}>●</b> 80–94</span>
              <span><b style={{ color: '#1D9E75' }}>●</b> &lt;80</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Prop bar (swing/take, etc.) ───────────────────────────────
function PropBar({ segments }) {
  const total = segments.reduce((s, x) => s + (x.value || 0), 0) || 1;
  return (
    <div>
      <div style={{ display: 'flex', height: 18, borderRadius: 4, overflow: 'hidden', border: `1px solid ${C.edge}` }}>
        {segments.filter(s => s.value > 0).map((s, i) => (
          <div key={i} style={{ width: (s.value / total * 100) + '%', background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff' }} title={`${s.label}: ${s.value}`}>
            {s.value / total >= 0.1 ? Math.round(s.value / total * 100) + '%' : ''}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 3, flexWrap: 'wrap' }}>
        {segments.map((s, i) => <span key={i} style={{ fontSize: 10, color: C.muted, ...FONT_STYLE }}><b style={{ color: s.color }}>{s.label}</b> {s.value}</span>)}
      </div>
    </div>
  );
}

// ── Trends section ─────────────────────────────────────────────
function TrendsSection({ pitches }) {
  const { outingData, inningData, swings, takes, whiffs, contact, putaway, twoKCount, twoKWhiffPct } = useMemo(() => {
    const normType = pt => normalizePitch(pt);
    // FB velocity excludes the cutter (see FB_VELO_TYPES); movement/usage do not.
    const isFBVeloRow = r => isFastballVeloType(normType(r.tagged_pitch_type || r.pitch_type));
    const isBIP = r => r.pitch_call === 'InPlay';

    // Group by game
    const byGame = {};
    pitches.forEach(p => { const g = p.game_id || 'g'; (byGame[g] = byGame[g] || []).push(p); });
    const games = Object.keys(byGame).sort();
    const outingData = games.length >= 2 ? games.map((g, i) => {
      const rows = byGame[g];
      const fbVelos = rows.filter(isFBVeloRow).map(r => r.rel_speed).filter(v => v != null && v > 0);
      const strikes = rows.filter(isStrike).length;
      return {
        label: 'G' + (i + 1),
        fbVelo: mean(fbVelos),
        strikePct: rows.length ? strikes / rows.length : null,
      };
    }) : null;

    // Group by inning
    const byInning = {};
    pitches.forEach(p => { const inn = p.inning; if (inn != null) (byInning[inn] = byInning[inn] || []).push(p); });
    const innings = Object.keys(byInning).map(Number).sort((a, b) => a - b);
    const inningData = innings.length >= 2 ? innings.map(inn => {
      const rows = byInning[inn];
      const fbVelos = rows.filter(isFBVeloRow).map(r => r.rel_speed).filter(v => v != null && v > 0);
      const strikes = rows.filter(isStrike).length;
      return { label: 'I' + inn, fbVelo: mean(fbVelos), strikePct: rows.length ? strikes / rows.length : null };
    }) : null;

    // Overall swing/take
    const swings = pitches.filter(isSwing).length;
    const takes = pitches.length - swings;
    const whiffs = pitches.filter(isWhiff).length;
    const contact = pitches.filter(isContact).length;

    // Two-strike putaway
    const twoK = pitches.filter(r => r.strikes === 2);
    const twoKWhiffs = twoK.filter(isWhiff).length;
    const twoKSwings = twoK.filter(isSwing).length;
    const putaway = twoK.length ? pitches.filter(r => r.strikes === 2 && r.kor_bb === 'Strikeout').length / twoK.length : null;
    return { outingData, inningData, swings, takes, whiffs, contact, putaway, twoKCount: twoK.length, twoKWhiffPct: twoKSwings ? twoKWhiffs / twoKSwings : null };
  }, [pitches]);

  if (!outingData && !inningData) return null;

  const tickStyle = { fontSize: 9, fill: C.muted };
  const lineStyle = { fontSize: 11 };
  const chartMargin = { top: 6, right: 10, bottom: 2, left: -8 };

  return (
    <div>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        {outingData && (
          <div style={{ flex: '1 1 260px' }}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 2, ...FONT_STYLE }}>FB velo by outing</div>
            <ResponsiveContainer width="100%" height={100}>
              <LineChart data={outingData} margin={chartMargin}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.edge} />
                <XAxis dataKey="label" tick={tickStyle} />
                <YAxis tick={tickStyle} width={28} domain={['auto','auto']} />
                <Tooltip contentStyle={{ ...lineStyle, background: C.surface, border: `1px solid ${C.edge}`, color: C.cream }} formatter={v => v != null ? [v.toFixed(1), 'velo'] : ['—', 'velo']} />
                <Line type="monotone" dataKey="fbVelo" stroke={C.gold} strokeWidth={2} dot={{ r: 3, fill: C.gold }} />
              </LineChart>
            </ResponsiveContainer>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 2, marginTop: 8, ...FONT_STYLE }}>Strike% by outing</div>
            <ResponsiveContainer width="100%" height={100}>
              <LineChart data={outingData} margin={chartMargin}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.edge} />
                <XAxis dataKey="label" tick={tickStyle} />
                <YAxis tick={tickStyle} width={28} domain={[0,1]} tickFormatter={v => Math.round(v*100)} />
                <Tooltip contentStyle={{ ...lineStyle, background: C.surface, border: `1px solid ${C.edge}`, color: C.cream }} formatter={v => v != null ? [(v*100).toFixed(0)+'%', 'Strike%'] : ['—', 'Strike%']} />
                <Line type="monotone" dataKey="strikePct" stroke="#2c7a4b" strokeWidth={2} dot={{ r: 3, fill: '#2c7a4b' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {inningData && (
          <div style={{ flex: '1 1 260px' }}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 2, ...FONT_STYLE }}>FB velo by inning</div>
            <ResponsiveContainer width="100%" height={100}>
              <LineChart data={inningData} margin={chartMargin}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.edge} />
                <XAxis dataKey="label" tick={tickStyle} />
                <YAxis tick={tickStyle} width={28} domain={['auto','auto']} />
                <Tooltip contentStyle={{ ...lineStyle, background: C.surface, border: `1px solid ${C.edge}`, color: C.cream }} formatter={v => v != null ? [v.toFixed(1), 'velo'] : ['—','velo']} />
                <Line type="monotone" dataKey="fbVelo" stroke="#2c6080" strokeWidth={2} dot={{ r: 3, fill: '#2c6080' }} />
              </LineChart>
            </ResponsiveContainer>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 2, marginTop: 8, ...FONT_STYLE }}>Strike% by inning</div>
            <ResponsiveContainer width="100%" height={100}>
              <LineChart data={inningData} margin={chartMargin}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.edge} />
                <XAxis dataKey="label" tick={tickStyle} />
                <YAxis tick={tickStyle} width={28} domain={[0,1]} tickFormatter={v => Math.round(v*100)} />
                <Tooltip contentStyle={{ ...lineStyle, background: C.surface, border: `1px solid ${C.edge}`, color: C.cream }} formatter={v => v != null ? [(v*100).toFixed(0)+'%','Strike%'] : ['—','Strike%']} />
                <Line type="monotone" dataKey="strikePct" stroke={C.gold} strokeWidth={2} dot={{ r: 3, fill: C.gold }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 16 }}>
        <div style={{ flex: '1 1 220px' }}>
          <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, ...FONT_STYLE }}>Swing vs take</div>
          <PropBar segments={[{ label: 'Swing', value: swings, color: '#e06040' }, { label: 'Take', value: takes, color: '#7aaaca' }]} />
          <div style={{ fontSize: 10, color: C.muted, margin: '10px 0 4px', ...FONT_STYLE }}>On swings</div>
          <PropBar segments={[{ label: 'Contact', value: contact, color: '#3aaa6a' }, { label: 'Whiff', value: whiffs, color: '#e06040' }]} />
        </div>
        <div style={{ flex: '1 1 220px' }}>
          <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, ...FONT_STYLE }}>Two-strike K-pitch rate</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: C.white, ...FONT_STYLE }}>{pct(putaway)}</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 3, ...FONT_STYLE }}>
            {twoKCount} two-strike pitches · {pct(twoKWhiffPct)} whiff/swing
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Scout notes ───────────────────────────────────────────────
function ScoutNotes({ pitcherObs }) {
  if (!pitcherObs.length) return null;
  const allTtp1b = pitcherObs.flatMap(o => o.time_to_plate_1b || []).filter(v => v != null);
  const allTtp2b = pitcherObs.flatMap(o => o.time_to_plate_2b || []).filter(v => v != null);
  const uclaStart = pitcherObs.map(o => o.ucla_hold_start).filter(Boolean)[0];
  const pickMoves = pitcherObs.map(o => o.notes).filter(Boolean)[0];

  const ttpStat = arr => arr.length ? { avg: (mean(arr)).toFixed(2), best: Math.min(...arr).toFixed(2) } : null;
  const s1 = ttpStat(allTtp1b), s2 = ttpStat(allTtp2b);

  const UCLA_SEGS = ['U', 'C', 'L', 'A'];
  const active = uclaStart ? new Set(uclaStart.split('-').map(s => s.trim()).filter(s => UCLA_SEGS.includes(s))) : new Set();

  const row = (label, value, highlight) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `0.5px solid ${C.edge}` }}>
      <span style={{ fontSize: 11, color: C.muted, ...FONT_STYLE }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 800, color: highlight ? C.gold : C.cream, ...FONT_STYLE }}>{value}</span>
    </div>
  );

  return (
    <div style={{ background: 'rgba(200,146,12,.07)', border: '1px solid rgba(200,146,12,.18)', borderRadius: 8, padding: '14px 16px' }}>
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: C.gold, marginBottom: 10, ...FONT_STYLE }}>Pitcher Obs</div>
      {s1 && row('TTP 1B', `Avg ${s1.avg}s · Best ${s1.best}s`, parseFloat(s1.avg) <= 1.20)}
      {s2 && row('TTP 2B', `Avg ${s2.avg}s · Best ${s2.best}s`, parseFloat(s2.avg) <= 1.20)}
      {uclaStart && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 5, ...FONT_STYLE }}>UCLA Hold</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            {UCLA_SEGS.map((seg, i) => (
              <React.Fragment key={seg}>
                {i > 0 && <div style={{ width: 8, height: 1, background: C.rim }} />}
                <div style={{
                  width: 26, height: 24, borderRadius: 3,
                  background: active.has(seg) ? 'rgba(200,146,12,.14)' : C.raised,
                  border: `1px solid ${active.has(seg) ? 'rgba(200,146,12,.35)' : C.rim}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 900, color: active.has(seg) ? C.gold : C.muted, ...FONT_STYLE
                }}>{seg}</div>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
      {pickMoves && <div style={{ fontSize: 11, color: C.muted, fontStyle: 'italic', marginTop: 8, ...FONT_STYLE }}>"{pickMoves}"</div>}
    </div>
  );
}

// ── Savant-parity: Release point scatter ────────────────────────
function ReleasePointPlot({ pitches }) {
  const groups = releasePoints(pitches);
  if (!groups.length) return <div style={{ color: C.muted, fontSize: 12 }}>No release-point data.</div>;
  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <ScatterChart margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
          <CartesianGrid stroke={C.faint} />
          <XAxis type="number" dataKey="x" name="rel side" unit="ft" tick={{ fill: C.muted, fontSize: 10 }} stroke={C.faint} />
          <YAxis type="number" dataKey="y" name="rel height" unit="ft" tick={{ fill: C.muted, fontSize: 10 }} stroke={C.faint} />
          <Tooltip contentStyle={{ background: C.raised, border: `1px solid ${C.edge}`, fontSize: 11 }} cursor={{ strokeDasharray: '3 3' }} />
          {groups.map(g => (
            <Scatter key={g.type} name={g.type} data={g.points} fill={g.color} opacity={0.8} />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
        {groups.map(g => (
          <div key={g.type} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: C.muted }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: g.color, display: 'inline-block' }} />
            {g.type}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Savant-parity: Extension ─────────────────────────────────────
function ExtensionCard({ pitches }) {
  const { seasonMean, byType } = extensionBreakdown(pitches);
  if (seasonMean == null) return <div style={{ color: C.muted, fontSize: 12 }}>No extension data.</div>;
  return (
    <div>
      <div style={{ fontSize: 26, fontWeight: 900, color: C.gold, ...FONT_STYLE }}>{seasonMean.toFixed(1)} ft</div>
      <div style={{ fontSize: 10, color: C.muted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.6 }}>Season avg extension</div>
      {byType.map(t => (
        <div key={t.type} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${C.edge}` }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.cream }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: pColor(t.type), display: 'inline-block' }} />
            {t.type}
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.white, fontVariantNumeric: 'tabular-nums' }}>{t.mean.toFixed(1)} ft</span>
        </div>
      ))}
    </div>
  );
}

// ── Savant-parity: Spin direction wheel ──────────────────────────
// Null-gated per pitch type: renders "no spin data" rather than a misleading
// blank/zero wheel when spin_axis is missing (confirmed Chabot venue gap).
function SpinWheel({ type, axisDeg, color }) {
  const rad = axisDeg != null ? (axisDeg - 90) * Math.PI / 180 : null; // 0deg = 12 o'clock
  const cx = 40, cy = 40, r = 30;
  const tipX = rad != null ? cx + r * Math.cos(rad) : null;
  const tipY = rad != null ? cy + r * Math.sin(rad) : null;
  return (
    <div style={{ textAlign: 'center' }}>
      <svg viewBox="0 0 80 80" width={72} height={72}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.edge} strokeWidth={1} />
        <line x1={cx} y1={cy - r} x2={cx} y2={cy + r} stroke={C.faint} strokeWidth={0.5} />
        <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke={C.faint} strokeWidth={0.5} />
        {tipX != null ? (
          <>
            <line x1={cx} y1={cy} x2={tipX} y2={tipY} stroke={color} strokeWidth={3} />
            <circle cx={cx} cy={cy} r={3} fill={color} />
          </>
        ) : (
          <text x={cx} y={cy + 4} textAnchor="middle" fontSize={9} fill={C.muted}>no data</text>
        )}
      </svg>
      <div style={{ fontSize: 10, color: C.cream, fontWeight: 700 }}>{type}</div>
      <div style={{ fontSize: 9, color: C.muted }}>{axisDeg != null ? `${Math.round(axisDeg / 30)}:00` : '—'}</div>
    </div>
  );
}
function SpinDirectionSection({ pitches }) {
  const byType = spinDirectionByType(pitches).slice(0, 6);
  if (!byType.length) return <div style={{ color: C.muted, fontSize: 12 }}>No spin data.</div>;
  const allNull = byType.every(t => t.nullGated);
  return (
    <div>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        {byType.map(t => <SpinWheel key={t.type} type={t.type} axisDeg={t.axisDeg} color={t.color} />)}
      </div>
      {allNull && (
        <div style={{ fontSize: 10, color: C.muted, marginTop: 10, fontStyle: 'italic' }}>
          Spin axis isn't reported for any pitch here — likely a venue-side Trackman gap (confirmed at Chabot College Field), not a data error for this pitcher.
        </div>
      )}
    </div>
  );
}

// ── Savant-parity: Location heatmap (pitch-type filterable) ─────
// ── Savant-parity: Rolling trend chart ───────────────────────────
function RollingTrendSection({ pitches }) {
  const trend = rollingGameTrend(pitches);
  if (trend.length < 3) return <div style={{ color: C.muted, fontSize: 12 }}>Need at least 3 games for a trend line.</div>;
  const data = trend.map(g => ({
    game: new Date(g.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    Velo: g.veloMean != null ? +g.veloMean.toFixed(1) : null,
    'Whiff%': g.whiffPct,
    'Chase%': g.chasePct,
  }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
        <CartesianGrid stroke={C.faint} />
        <XAxis dataKey="game" tick={{ fill: C.muted, fontSize: 10 }} stroke={C.faint} />
        <YAxis yAxisId="left" tick={{ fill: C.muted, fontSize: 10 }} stroke={C.faint} />
        <YAxis yAxisId="right" orientation="right" tick={{ fill: C.muted, fontSize: 10 }} stroke={C.faint} />
        <Tooltip contentStyle={{ background: C.raised, border: `1px solid ${C.edge}`, fontSize: 11 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line yAxisId="left" type="monotone" dataKey="Velo" stroke={C.gold} dot={false} strokeWidth={2} connectNulls />
        <Line yAxisId="right" type="monotone" dataKey="Whiff%" stroke={C.green} dot={false} strokeWidth={2} connectNulls />
        <Line yAxisId="right" type="monotone" dataKey="Chase%" stroke={C.red} dot={false} strokeWidth={2} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Main export ───────────────────────────────────────────────
export default function PitcherProfileOverview({ pitches, pitcherObs, pitcherPool, leaguePitches }) {
  const filteredPitches = useMemo(() => {
    const total = pitches.length;
    if (!total) return pitches;
    const counts = {};
    pitches.forEach(p => { const pt = normalizePitch(p.tagged_pitch_type || p.pitch_type); counts[pt] = (counts[pt] || 0) + 1; });
    return pitches.filter(p => {
      const pt = normalizePitch(p.tagged_pitch_type || p.pitch_type);
      return counts[pt] / total > 0.04;
    });
  }, [pitches]);

  if (!filteredPitches.length && !pitcherObs.length) {
    return <p style={{ color: C.muted, textAlign: 'center', padding: 40, ...FONT_STYLE }}>No data found for this pitcher.</p>;
  }

  const hasData = filteredPitches.length >= 5;
  const hasPercentiles = filteredPitches.length >= 20 && pitcherPool;

  // Quick headline stats
  // Use ALL pitches (pre-4% filter) for Max FB so rare pitch tags aren't excluded.
  // FB velocity excludes the cutter (FB_VELO_TYPES) — its velo skews the fastball read.
  const allFbPitches = pitches.filter(p => isFastballVeloType(normalizePitch(p.tagged_pitch_type || p.pitch_type)));
  const fbPitches = filteredPitches.filter(p => isFastballVeloType(normalizePitch(p.tagged_pitch_type || p.pitch_type)));
  // Guard rel_speed > 0 to exclude bad Trackman reads (0 mph values)
  const fbVelos = fbPitches.map(p => p.rel_speed).filter(v => v != null && v > 0);
  const allFbVelos = allFbPitches.map(p => p.rel_speed).filter(v => v != null && v > 0);
  const strikesN = filteredPitches.filter(isStrike).length;
  const whiffsN = filteredPitches.filter(isWhiff).length;
  const swingsN = filteredPitches.filter(isSwing).length;
  const fps = filteredPitches.filter(p => p.balls === 0 && p.strikes === 0);
  const fpsStrikes = fps.filter(isStrike).length;
  const { cswPct, kbbPct } = cswKbb(filteredPitches);
  const leagueAvg = leagueMovementProfile(leaguePitches);

  return (
    <div style={FONT_STYLE}>
      {/* Stat pills */}
      {hasData && (
        <StatPills items={[
          fbVelos.length ? { label: 'Avg FB', value: n1(mean(fbVelos)), gold: true } : null,
          allFbVelos.length ? { label: 'Max FB', value: n1(Math.max(...allFbVelos)) } : null,
          filteredPitches.length ? { label: 'Strike%', value: pct(strikesN / filteredPitches.length) } : null,
          fps.length ? { label: 'FPS%', value: pct(fpsStrikes / fps.length) } : null,
          swingsN ? { label: 'Whiff%', value: pct(whiffsN / swingsN) } : null,
          cswPct != null ? { label: 'CSW%', value: `${cswPct}%` } : null,
          kbbPct != null ? { label: 'K-BB%', value: `${kbbPct}%` } : null,
          { label: 'Pitches', value: filteredPitches.length.toString() },
        ]} />
      )}

      {/* Percentiles */}
      {hasPercentiles && (
        <>
          {sHead('Percentiles', 'vs CCL')}
          <Card style={{ marginBottom: 18 }}>
            <PitcherPercentiles pitches={filteredPitches} pitcherPool={pitcherPool} />
          </Card>
        </>
      )}

      {/* Arsenal + Movement side by side */}
      {hasData && (
        <>
          {sHead('Arsenal · Movement', `${filteredPitches.length} pitches`)}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
            <Card style={{ flex: '1 1 340px' }}>
              <MovementScatterCircular pitches={filteredPitches} leagueAvg={leagueAvg} />
              <VeloHistogram pitches={filteredPitches} />
            </Card>
            <Card style={{ flex: '2 1 400px', overflow: 'hidden', padding: '14px 0' }}>
              <div style={{ padding: '0 16px 10px', fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8 }}>By Pitch Type</div>
              <ArsenalTable pitches={filteredPitches} />
            </Card>
          </div>
        </>
      )}

      {/* Savant-parity: Release point + Extension */}
      {hasData && (
        <>
          {sHead('Release Point · Extension')}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
            <Card style={{ flex: '2 1 380px' }}>
              <ReleasePointPlot pitches={filteredPitches} />
            </Card>
            <Card style={{ flex: '1 1 220px' }}>
              <ExtensionCard pitches={filteredPitches} />
            </Card>
          </div>
        </>
      )}

      {/* Savant-parity: Spin direction */}
      {hasData && (
        <>
          {sHead('Spin Direction', 'clock face, by pitch type')}
          <Card style={{ marginBottom: 18 }}>
            <SpinDirectionSection pitches={filteredPitches} />
          </Card>
        </>
      )}

      {/* Savant-parity: Location density contour, per pitch type */}
      {hasData && (
        <>
          {sHead('Pitch Location', 'KDE density contour, by pitch type')}
          <Card style={{ marginBottom: 18 }}>
            <LocationContourPlot groups={
              Object.entries(filteredPitches.reduce((m, p) => {
                const pt = normalizePitch(p.tagged_pitch_type || p.pitch_type);
                (m[pt] = m[pt] || []).push(p);
                return m;
              }, {})).sort((a, b) => b[1].length - a[1].length).map(([label, pitches]) => ({ label, pitches }))
            } />
          </Card>
        </>
      )}

      {/* Savant-parity: Rolling trend */}
      {filteredPitches.length >= 30 && (
        <>
          {sHead('Season Trend', 'by game')}
          <Card style={{ marginBottom: 18 }}>
            <RollingTrendSection pitches={filteredPitches} />
          </Card>
        </>
      )}

      {/* Count + Handedness splits */}
      {hasData && (
        <>
          {sHead('Count Splits · Handedness')}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
            <Card style={{ flex: '1 1 280px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>Selection by Count</div>
              <CountSplitsTable pitches={filteredPitches} />
            </Card>
            <Card style={{ flex: '1 1 240px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>Usage by Handedness</div>
              <HandednessSplits pitches={filteredPitches} />
            </Card>
          </div>
        </>
      )}

      {/* Contact against */}
      {hasData && (
        <>
          {sHead('Contact Against')}
          <Card style={{ marginBottom: 18 }}>
            <ContactSection pitches={filteredPitches} />
          </Card>
        </>
      )}

      {/* Savant-parity: Batted ball profile, contact quality, EV histogram */}
      {hasData && (
        <>
          {sHead('Batted Ball & Contact Quality')}
          <Card style={{ marginBottom: 18 }}>
            <BattedBallContactPanel rows={filteredPitches} />
          </Card>
        </>
      )}

      {/* Savant-parity: Platoon splits (allowed, vs RHH/LHH) */}
      {hasData && (
        <>
          {sHead('Platoon Splits', 'allowed, vs batter handedness')}
          <Card style={{ marginBottom: 18 }}>
            <PlatoonSplitsTable rows={filteredPitches} side="batter_hand" />
          </Card>
        </>
      )}

      {/* Trends */}
      {filteredPitches.length >= 10 && (
        <>
          {sHead('Trends & Approach')}
          <Card style={{ marginBottom: 18 }}>
            <TrendsSection pitches={filteredPitches} />
          </Card>
        </>
      )}

      {/* Scout notes */}
      {pitcherObs.length > 0 && (
        <>
          {sHead('Scout Notes')}
          <ScoutNotes pitcherObs={pitcherObs} />
        </>
      )}
    </div>
  );
}
