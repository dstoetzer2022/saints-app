import React, { useMemo, useState } from 'react';
import { normalizePitch, getPitchColor } from '@/lib/ds';
import PercentileBar from '@/components/shared/PercentileBar';
import {
  pitcherProfile, percentileRank, fmtStat,
  cswKbb, releasePoints, extensionBreakdown, spinDirectionByType, rollingGameTrend,
  leagueMovementProfile, runValue, xERA, xStatsForRows,
} from '@/lib/profileStats';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, ScatterChart, Scatter, ZAxis, Legend
} from 'recharts';
import { isSwing, isStrike, isWhiff, isContact, isFastballVeloType } from '@/lib/statsUtils';
import { C, FONT } from '@/lib/darkTheme';
import MovementScatterCircular from '@/components/charts/MovementScatterCircular';
import LocationContourPlot from '@/components/charts/LocationContourPlot';
import SprayChart from '@/components/charts/SprayChart';
import { CCL_PARK_DIMENSIONS } from '@/lib/profileStats';
import BattedBallContactPanel from '@/components/shared/BattedBallContactPanel';
import PlatoonSplitsTable from '@/components/shared/PlatoonSplitsTable';
import XHRParkTable from '@/components/shared/XHRParkTable';

const pColor = pt => getPitchColor(pt);

// ── Shared helpers ─────────────────────────────────────────────
const FONT_STYLE = { fontFamily: FONT };
const mean = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
const pct = v => v == null ? '—' : (v * 100).toFixed(0) + '%';
const n1 = v => v == null ? '—' : v.toFixed(1);
const n0 = v => v == null ? '—' : Math.round(v).toString();

function sHead(label, sub) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 9, paddingBottom: 6, borderBottom: `1px solid ${C.edge}` }}>
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



// ── Percentile section ─────────────────────────────────────────
function PitcherPercentiles({ pitches, allPitches, pitcherPool }) {
  const prof = useMemo(() => pitcherProfile(pitches), [pitches]);
  if (!prof || !pitcherPool) return null;
  const P = pitcherPool;
  const n = P.qualifiedN;

  // AUDIT: Max FB must match the stat-pill value above, which intentionally
  // uses ALL pitches (bypassing the 4%-noise filter) so a rare/mislabeled
  // fastball tag isn't dropped. Percentile ranking still uses the same pool,
  // just the raw value being ranked is computed the same way as the pill.
  const maxFbSource = allPitches || pitches;
  const maxFbVelos = maxFbSource
    .filter(p => isFastballVeloType(normalizePitch(p.tagged_pitch_type || p.pitch_type)))
    .map(p => p.rel_speed)
    .filter(v => v != null && v > 0);
  const maxFbVelo = maxFbVelos.length ? Math.max(...maxFbVelos) : null;

  const rv = P.xGrid ? runValue(pitches, P.leagueWoba, { invert: true }) : null;
  const xe = P.xGrid ? xERA(pitches, P.xGrid, P.leagueWoba) : null;
  const xs = P.xGrid ? xStatsForRows(pitches, P.xGrid) : null;

  const rowDefs = [
    // Run Prevention
    { label: 'Run Value', value: rv != null ? (rv >= 0 ? '+' : '') + rv.toFixed(1) : null, raw: rv, pool: P.runValue, invert: false },
    { label: 'xERA', value: xe != null ? xe.toFixed(2) : null, raw: xe, pool: P.xERA, invert: true },
    { label: 'xBA', value: xs?.xBA != null ? fmtStat(xs.xBA) : null, raw: xs?.xBA, pool: P.xBAAgainst, invert: true },
    { label: 'xwOBA', value: xs?.xwOBA != null ? fmtStat(xs.xwOBA) : null, raw: xs?.xwOBA, pool: P.xwOBAAgainst, invert: true },
    { label: 'xSLG', value: xs?.xSLG != null ? fmtStat(xs.xSLG) : null, raw: xs?.xSLG, pool: P.xSLGAgainst, invert: true },
    { label: 'BABIP', value: prof.babip != null ? fmtStat(prof.babip) : null, raw: prof.babip, pool: P.babip, invert: true },
    // Stuff
    { label: 'Avg FB', value: prof.fb?.avgVelo != null ? n1(prof.fb.avgVelo) : null, raw: prof.fb?.avgVelo, pool: P.fbVelo, invert: false },
    { label: 'Max FB', value: maxFbVelo != null ? n1(maxFbVelo) : null, raw: maxFbVelo, pool: P.maxVelo, invert: false },
    { label: 'FB Spin', value: prof.fb?.avgSpin != null ? n0(prof.fb.avgSpin) : null, raw: prof.fb?.avgSpin, pool: P.fbSpin, invert: false },
    { label: 'BB Spin', value: prof.bb?.avgSpin != null ? n0(prof.bb.avgSpin) : null, raw: prof.bb?.avgSpin, pool: P.bbSpin, invert: false },
    { label: 'Putaway%', value: pct(prof.putawayPct), raw: prof.putawayPct, pool: P.putawayPct, invert: false },
    { label: 'Extension', value: prof.extensionMean != null ? prof.extensionMean.toFixed(1) + ' ft' : null, raw: prof.extensionMean, pool: P.extension, invert: false },
    // Plate Discipline
    { label: 'Strike%', value: pct(prof.strikePct), raw: prof.strikePct, pool: P.strikePct, invert: false },
    { label: 'FPS%', value: pct(prof.fpsPct), raw: prof.fpsPct, pool: P.fpsPct, invert: false },
    { label: 'K%', value: pct(prof.kPct), raw: prof.kPct, pool: P.kPct, invert: false },
    { label: 'Free Pass%', value: pct(prof.bbPct), raw: prof.bbPct, pool: P.bbPct, invert: true },
    { label: 'Whiff%', value: pct(prof.whiffPct), raw: prof.whiffPct, pool: P.whiffPct, invert: false },
    { label: 'Chase%', value: pct(prof.chasePct), raw: prof.chasePct, pool: P.chasePct, invert: false },
    // Contact Quality
    { label: 'Avg EV against', value: n1(prof.avgEVAgainst), raw: prof.avgEVAgainst, pool: P.avgEVAgainst, invert: true },
    { label: 'Avg LA against', value: prof.avgLaunchAgainst != null ? n1(prof.avgLaunchAgainst) + '°' : null, raw: prof.avgLaunchAgainst, pool: P.avgLaunchAgainst, invert: true },
    { label: 'GB%', value: pct(prof.gbPct), raw: prof.gbPct, pool: P.gbPct, invert: false },
    { label: 'FB%', value: pct(prof.fbPct), raw: prof.fbPct, pool: P.fbPct, invert: true },
    { label: 'Soft%', value: pct(prof.softPct), raw: prof.softPct, pool: P.softPct, invert: false },
    { label: 'Hard%', value: pct(prof.hardPct), raw: prof.hardPct, pool: P.hardPct, invert: true },
  ];

  const byLabel = Object.fromEntries(rowDefs.map(r => [r.label, r]));
  const CATEGORIES = [
    { title: 'Run Prevention', labels: ['Run Value', 'xERA', 'xBA', 'xwOBA', 'xSLG', 'BABIP'] },
    { title: 'Stuff', labels: ['Avg FB', 'Max FB', 'FB Spin', 'BB Spin', 'Putaway%', 'Extension'] },
    { title: 'Plate Discipline', labels: ['Strike%', 'FPS%', 'K%', 'Free Pass%', 'Whiff%', 'Chase%'] },
    { title: 'Contact Quality', labels: ['Avg EV against', 'Avg LA against', 'GB%', 'FB%', 'Soft%', 'Hard%'] },
  ];

  const sections = CATEGORIES
    .map(cat => ({ ...cat, rows: cat.labels.map(l => byLabel[l]).filter(r => r && r.value != null && r.value !== '—') }))
    .filter(cat => cat.rows.length);

  if (!sections.length) return null;
  return (
    <div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {sections.map(cat => (
          <Card key={cat.title} style={{ flex: '1 1 230px', padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
              <span style={{ width: 3, height: 10, borderRadius: 2, background: C.gold, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.3, textTransform: 'uppercase', color: C.gold, ...FONT_STYLE }}>
                {cat.title}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {cat.rows.map(row => {
                const rank = percentileRank(row.pool, row.raw);
                const display = row.invert && rank != null ? 100 - rank : rank;
                return <PercentileBar key={row.label} label={row.label} value={row.value} percentile={display} labelWidth={118} />;
              })}
            </div>
          </Card>
        ))}
      </div>
      <div style={{ fontSize: 10, color: C.muted, marginTop: 8, ...FONT_STYLE }}>vs {n} qualified CCL pitchers</div>
    </div>
  );
}

// ── Arsenal detail table ───────────────────────────────────────
function ArsenalTable({ pitches }) {
  const total = pitches.length;
  const { seasonMean: seasonExt, byType: extByType } = useMemo(() => extensionBreakdown(pitches), [pitches]);
  const extMap = useMemo(() => Object.fromEntries((extByType || []).map(t => [t.type, t.mean])), [extByType]);
  const { detail, rTotal, lTotal } = useMemo(() => {
    const map = {};
    let rTotal = 0, lTotal = 0;
    pitches.forEach(p => {
      const pt = normalizePitch(p.tagged_pitch_type || p.pitch_type);
      if (!map[pt]) map[pt] = [];
      map[pt].push(p);
      if (p.batter_hand === 'Right') rTotal++;
      else if (p.batter_hand === 'Left') lTotal++;
    });
    const detail = Object.entries(map)
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
        const rCount = rows.filter(r => r.batter_hand === 'Right').length;
        const lCount = rows.filter(r => r.batter_hand === 'Left').length;
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
          extension: extMap[pt],
          rUsage: rCount, lUsage: lCount,
        };
      });
    return { detail, rTotal, lTotal };
  }, [pitches, extMap, total]);

  if (!detail.length) return null;
  const isFB = pt => ['Fastball','Four-Seam','Sinker','Cutter'].includes(pt);
  const th = { padding: '6px 8px', fontSize: 9, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, textAlign: 'right', whiteSpace: 'nowrap', ...FONT_STYLE };
  const td = { padding: '7px 8px', fontSize: 12, textAlign: 'right', color: C.cream, fontVariantNumeric: 'tabular-nums', borderBottom: `0.5px solid ${C.edge}`, ...FONT_STYLE };
  const hasHandSplit = rTotal > 0 && lTotal > 0;

  return (
    <div>
      {seasonExt != null && (
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, ...FONT_STYLE }}>
          Season avg extension <b style={{ color: C.gold, fontSize: 13 }}>{seasonExt.toFixed(1)} ft</b>
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              {[
                'Pitch', 'Use%',
                ...(hasHandSplit ? ['vs R', 'vs L'] : []),
                'Velo', 'Max', 'Spin', 'Ext', 'Str%', 'Whiff%', 'Zone%', 'Z-Sw%', 'Z-Wh%', 'Chase%', 'EV',
              ].map((h, i) => (
                <th key={h} style={{ ...th, textAlign: i === 0 ? 'left' : 'right' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {detail.map((d, i) => (
              <tr
                key={d.pt}
                style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.018)', transition: 'background 0.1s' }}
                onMouseEnter={e => { e.currentTarget.style.background = C.raised; }}
                onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.018)'; }}
              >
                <td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: d.color, marginRight: 6 }} />
                  {d.pt}
                </td>
                <td style={td}>{(d.usage * 100).toFixed(0)}%</td>
                {hasHandSplit && (
                  <>
                    <td style={td}>{rTotal ? Math.round(d.rUsage / rTotal * 100) + '%' : '—'}</td>
                    <td style={td}>{lTotal ? Math.round(d.lUsage / lTotal * 100) + '%' : '—'}</td>
                  </>
                )}
                <td style={{ ...td, fontWeight: 700, color: C.white }}>{n1(d.avgVelo)}</td>
                <td style={{ ...td, color: C.muted }}>{isFB(d.pt) && d.maxVelo != null ? n1(d.maxVelo) : '—'}</td>
                <td style={td}>{n0(d.avgSpin)}</td>
                <td style={td}>{d.extension != null ? d.extension.toFixed(1) : '—'}</td>
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
  const th = { padding: '6px 10px', fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.6, background: C.surface, ...FONT_STYLE };
  const td = { padding: '7px 10px', fontSize: 12, color: C.cream, textAlign: 'center', borderBottom: `0.5px solid ${C.edge}`, fontVariantNumeric: 'tabular-nums', ...FONT_STYLE };
  const rows = [['ahead', 'Ahead'], ['even', 'Even'], ['behind', 'Behind']];

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
          {rows.map(([k, lbl], i) => (
            <tr
              key={k}
              style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.018)', transition: 'background 0.1s' }}
              onMouseEnter={e => { e.currentTarget.style.background = C.raised; }}
              onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.018)'; }}
            >
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

// ── Pitch mix by batter handedness (feeds into Platoon Splits cards) ──
function pitchMixByHand(pitches) {
  const byHand = { RHH: {}, LHH: {} };
  const totals = { RHH: 0, LHH: 0 };
  pitches.forEach(p => {
    const pt = normalizePitch(p.tagged_pitch_type || p.pitch_type);
    const key = p.batter_hand === 'Right' ? 'RHH' : p.batter_hand === 'Left' ? 'LHH' : null;
    if (!key) return;
    byHand[key][pt] = (byHand[key][pt] || 0) + 1;
    totals[key]++;
  });
  const result = {};
  for (const key of ['RHH', 'LHH']) {
    if (!totals[key]) continue;
    const order = Object.entries(byHand[key])
      .map(([t, c]) => ({ t, c, color: pColor(t) }))
      .sort((a, b) => b.c - a.c);
    result[key] = { total: totals[key], order };
  }
  return result;
}

// ── Contact Allowed + Batted Ball & Contact Quality, combined ─
function ContactSection({ pitches }) {
  const { bip, hardPct, avgEV, babip } = useMemo(() => {
    const bip = pitches.filter(p => p.pitch_call === 'InPlay' && p.exit_speed > 0);
    let hard = 0, evSum = 0, evCount = 0, bipHits = 0, hrN = 0;
    bip.forEach(p => {
      const ev = p.exit_speed;
      if (ev != null && ev >= 95) hard++;
      if (ev != null) { evSum += ev; evCount++; }
      if (['Single','Double','Triple'].includes(p.play_result)) bipHits++;
      if (p.play_result === 'HomeRun') hrN++;
    });
    const bipN = bip.length;
    const babipDen = bipN - hrN;
    return {
      bip,
      hardPct: evCount ? hard / evCount : null,
      avgEV: evCount ? evSum / evCount : null,
      babip: babipDen > 0 ? bipHits / babipDen : null,
    };
  }, [pitches]);

  if (bip.length < 5) return null;

  return (
    <div>
      {/* Summary pills */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 16, fontSize: 11, color: C.cream, ...FONT_STYLE }}>
        <span><b style={{ color: C.gold }}>BABIP</b> {babip != null ? fmtStat(babip) : '—'}</span>
        <span><b style={{ color: C.gold }}>Hard%</b> {pct(hardPct)}</span>
        <span><b style={{ color: C.gold }}>Avg EV</b> {n1(avgEV)}</span>
        <span><b style={{ color: C.muted }}>n={bip.length}</b></span>
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '2 1 380px' }}>
          <BattedBallContactPanel rows={pitches} />
        </div>
        <div style={{ flex: '1 1 240px', maxWidth: 300 }}>
          <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, textAlign: 'center', ...FONT_STYLE }}>Spray (contact allowed)</div>
          <SprayChart pitches={pitches} park={CCL_PARK_DIMENSIONS.ARR_SEC} parkLabel={`Brookside \u00b7 ${CCL_PARK_DIMENSIONS.ARR_SEC.cf}' CF`} />
        </div>
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
      <ResponsiveContainer width="100%" aspect={1}>
        <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke={C.faint} />
          <XAxis
            type="number" dataKey="x" name="rel side" unit="ft"
            domain={[-4, 4]} ticks={[-4, -3, -2, -1, 0, 1, 2, 3, 4]}
            tick={{ fill: C.muted, fontSize: 10 }} stroke={C.faint}
          />
          <YAxis
            type="number" dataKey="y" name="rel height" unit="ft"
            domain={[0, 8]} ticks={[0, 1, 2, 3, 4, 5, 6, 7, 8]}
            tick={{ fill: C.muted, fontSize: 10 }} stroke={C.faint}
          />
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
        <YAxis
          yAxisId="left" domain={[60, 100]} ticks={[60, 65, 70, 75, 80, 85, 90, 95, 100]}
          tick={{ fill: C.muted, fontSize: 10 }} stroke={C.faint}
        />
        <YAxis
          yAxisId="right" orientation="right" domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]}
          tick={{ fill: C.muted, fontSize: 10 }} stroke={C.faint}
        />
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

  const leagueAvg = leagueMovementProfile(leaguePitches);

  return (
    <div style={FONT_STYLE}>
      {/* Percentiles */}
      {hasPercentiles && (
        <>
          {sHead('Percentiles', 'vs CCL')}
          <div style={{ marginBottom: 14 }}>
            <PitcherPercentiles pitches={filteredPitches} allPitches={pitches} pitcherPool={pitcherPool} />
          </div>
        </>
      )}

      {/* Savant-parity: Location density contour + spin direction, combined per pitch type */}
      {hasData && (
        <>
          {sHead('Pitch Location · Spin', 'KDE density contour with spin clock, by pitch type')}
          <Card style={{ marginBottom: 18 }}>
            <LocationContourPlot groups={
              (() => {
                const byType = filteredPitches.reduce((m, p) => {
                  const pt = normalizePitch(p.tagged_pitch_type || p.pitch_type);
                  (m[pt] = m[pt] || []).push(p);
                  return m;
                }, {});
                const spinByType = Object.fromEntries(spinDirectionByType(filteredPitches).map(s => [s.type, s]));
                return Object.entries(byType)
                  .sort((a, b) => b[1].length - a[1].length)
                  .map(([label, pitches]) => ({
                    label, pitches,
                    axisDeg: spinByType[label]?.axisDeg,
                    color: spinByType[label]?.color,
                    spinGated: spinByType[label]?.nullGated,
                  }));
              })()
            } />
          </Card>
        </>
      )}

      {/* Movement + Release Point side by side, arsenal table below */}
      {hasData && (
        <>
          {sHead('Movement · Release Point', `${filteredPitches.length} pitches`)}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
            <Card style={{ flex: '1 1 340px' }}>
              <MovementScatterCircular pitches={filteredPitches} leagueAvg={leagueAvg} />
            </Card>
            <Card style={{ flex: '1 1 340px' }}>
              <ReleasePointPlot pitches={filteredPitches} />
            </Card>
          </div>
          <Card style={{ marginBottom: 18, overflow: 'hidden', padding: '14px 0' }}>
            <div style={{ padding: '0 16px 10px', fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8 }}>By Pitch Type</div>
            <ArsenalTable pitches={filteredPitches} />
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

      {/* Count splits */}
      {hasData && (
        <>
          {sHead('Count Splits', 'pitch selection by count')}
          <Card style={{ marginBottom: 18 }}>
            <CountSplitsTable pitches={filteredPitches} />
          </Card>
        </>
      )}

      {/* Contact against — batted ball profile, contact quality, and spray, combined */}
      {hasData && (
        <>
          {sHead('Contact Against', 'batted ball profile & contact quality')}
          <Card style={{ marginBottom: 18 }}>
            <ContactSection pitches={filteredPitches} />
          </Card>
        </>
      )}

      {/* Savant-parity: Platoon splits, results + pitch mix, by batter handedness */}
      {hasData && (
        <>
          {sHead('Platoon Splits', 'results & pitch mix, vs batter handedness')}
          <Card style={{ marginBottom: 18 }}>
            <PlatoonSplitsTable rows={filteredPitches} side="batter_hand" pitchMixByLabel={pitchMixByHand(filteredPitches)} />
          </Card>
        </>
      )}

      {/* xHR: would-be home runs allowed by CCL park (distance-only approximation) */}
      {hasData && (
        <>
          {sHead('xHR Against by Park', 'approx, distance-only')}
          <Card style={{ marginBottom: 18 }}>
            <XHRParkTable rows={filteredPitches} direction="against" />
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
