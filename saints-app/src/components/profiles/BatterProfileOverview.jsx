import React, { useMemo, useState } from 'react';
import { normalizePitch, getPitchColor } from '@/lib/ds';
import PercentileBar from '@/components/shared/PercentileBar';
import CoachNoteBox from '@/components/profiles/CoachNoteBox';
import { hitterTrackmanProfile, percentileRank, fmtStat, rollingGameTrend, runValue, xStatsForRows } from '@/lib/profileStats';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, Legend, LabelList
} from 'recharts';
import { isSwing, isWhiff, isContact, isFastballVeloType, isSwing as sharedIsSwing } from '@/lib/statsUtils';
import { C, FONT } from '@/lib/darkTheme';
import LocationContourPlot from '@/components/charts/LocationContourPlot';
import SprayChart from '@/components/charts/SprayChart';
import BattedBallContactPanel from '@/components/shared/BattedBallContactPanel';
import PlatoonSplitsTable from '@/components/shared/PlatoonSplitsTable';
import XHRParkTable from '@/components/shared/XHRParkTable';

const FONT_STYLE = { fontFamily: FONT };

const mean = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
const pct = v => v == null ? '—' : (v * 100).toFixed(0) + '%';
const n1 = v => v == null ? '—' : v.toFixed(1);
const n3 = v => { if (v == null) return '—'; const s = v.toFixed(3); return s.startsWith('0.') ? s.slice(1) : s; };

const pColor = pt => getPitchColor(pt);

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


function HitterPercentiles({ pitches, hitterPool }) {
  const tm = useMemo(() => hitterTrackmanProfile(pitches), [pitches]);
  if (!tm || !hitterPool) return null;
  const P = hitterPool;
  const n = P.qualifiedN;

  const rv = P.xGrid ? runValue(pitches, P.leagueWoba, { invert: false }) : null;
  const xs = P.xGrid ? xStatsForRows(pitches, P.xGrid) : null;

  const rowDefs = [
    // Expected outcomes
    { label: 'Run Value', value: rv != null ? (rv >= 0 ? '+' : '') + rv.toFixed(1) : null, raw: rv, pool: P.runValue, invert: false },
    { label: 'xBA', value: xs?.xBA != null ? n3(xs.xBA) : null, raw: xs?.xBA, pool: P.xBA, invert: false },
    { label: 'xwOBA', value: xs?.xwOBA != null ? n3(xs.xwOBA) : null, raw: xs?.xwOBA, pool: P.xwOBA, invert: false },
    { label: 'xSLG', value: xs?.xSLG != null ? n3(xs.xSLG) : null, raw: xs?.xSLG, pool: P.xSLG, invert: false },
    { label: 'ISO', value: n3(tm.iso), raw: tm.iso, pool: P.iso, invert: false },
    { label: 'BABIP', value: n3(tm.babip), raw: tm.babip, pool: P.babip, invert: false },
    // Contact quality
    { label: 'Avg EV', value: n1(tm.avgEV), raw: tm.avgEV, pool: P.avgEV, invert: false },
    { label: 'EV90', value: n1(tm.ev90), raw: tm.ev90, pool: P.ev90, invert: false },
    { label: 'Max EV', value: n1(tm.maxEV), raw: tm.maxEV, pool: P.maxEV, invert: false },
    { label: 'Barrel%', value: pct(tm.barrelPct), raw: tm.barrelPct, pool: P.barrelPct, invert: false },
    { label: 'Hard%', value: pct(tm.hardPct), raw: tm.hardPct, pool: P.hardPct, invert: false },
    { label: 'Soft%', value: pct(tm.softPct), raw: tm.softPct, pool: P.softPct, invert: true },
    // Batted ball profile
    { label: 'Avg LA', value: tm.avgLaunchAngle != null ? n1(tm.avgLaunchAngle) + '°' : null, raw: tm.avgLaunchAngle, pool: P.launchAngle, invert: false },
    { label: 'LA @ EV90', value: tm.laAtEv90 != null ? n1(tm.laAtEv90) + '°' : null, raw: tm.laAtEv90, pool: P.laAtEv90, invert: false },
    { label: 'AirPull%', value: pct(tm.airPullPct), raw: tm.airPullPct, pool: P.airPullPct, invert: false },
    { label: 'FlyBall%', value: pct(tm.fbPct), raw: tm.fbPct, pool: P.fbPct, invert: false },
    { label: 'Line Drive%', value: pct(tm.ldPct), raw: tm.ldPct, pool: P.ldPct, invert: false },
    { label: 'GroundBall%', value: pct(tm.gbPct), raw: tm.gbPct, pool: P.gbPct, invert: true },
    // Plate discipline
    { label: 'Contact%', value: pct(tm.contactPct), raw: tm.contactPct, pool: P.contactPct, invert: false },
    { label: '2KContact%', value: pct(tm.twoKContactPct), raw: tm.twoKContactPct, pool: P.twoKContactPct, invert: false },
    { label: 'Swing%', value: pct(tm.swingPct), raw: tm.swingPct, pool: P.swingPct, invert: false },
    { label: 'FPSw%', value: pct(tm.fpSwPct), raw: tm.fpSwPct, pool: P.fpSwPct, invert: false },
    { label: 'K%', value: pct(tm.kPct), raw: tm.kPct, pool: P.kPct, invert: true },
    { label: 'BB%', value: pct(tm.bbPct), raw: tm.bbPct, pool: P.bbPct, invert: false },
  ];

  const byLabel = Object.fromEntries(rowDefs.map(r => [r.label, r]));
  const CATEGORIES = [
    { title: 'Expected Outcomes', labels: ['Run Value', 'xBA', 'xwOBA', 'xSLG', 'ISO', 'BABIP'] },
    { title: 'Contact Quality', labels: ['Avg EV', 'EV90', 'Max EV', 'Barrel%', 'Hard%', 'Soft%'] },
    { title: 'Batted Ball Profile', labels: ['Avg LA', 'LA @ EV90', 'AirPull%', 'FlyBall%', 'Line Drive%', 'GroundBall%'] },
    { title: 'Plate Discipline', labels: ['Contact%', '2KContact%', 'Swing%', 'FPSw%', 'K%', 'BB%'] },
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
      <div style={{ fontSize: 10, color: C.muted, marginTop: 8, ...FONT_STYLE }}>vs {n} qualified CCL hitters (Trackman)</div>
    </div>
  );
}

// ── Plate discipline ──────────────────────────────────────────
function PropBar({ segments, height = 20 }) {
  const total = segments.reduce((s, x) => s + (x.value || 0), 0) || 1;
  return (
    <div>
      <div style={{ display: 'flex', height, borderRadius: height / 2, overflow: 'hidden', background: C.faint }}>
        {segments.filter(s => s.value > 0).map((s, i) => (
          <div key={i} style={{ width: (s.value / total * 100) + '%', background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#fff' }}>
            {s.value / total >= 0.09 ? Math.round(s.value / total * 100) + '%' : ''}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 5, flexWrap: 'wrap' }}>
        {segments.map((s, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, color: C.muted, ...FONT_STYLE }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, display: 'inline-block', flexShrink: 0 }} />
            {s.label} <b style={{ color: C.cream }}>{s.value}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

// A single value + thin calibration gauge (0-100 scale), grouped by zone context.
function StatGauge({ label, value, tone = 'neutral' }) {
  const v = value != null ? Math.round(value * 100) : null;
  const barColor = tone === 'bad' ? C.red : tone === 'good' ? C.green : C.gold;
  return (
    <div style={{ minWidth: 76 }}>
      <div style={{ fontSize: 9, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, ...FONT_STYLE }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 900, color: C.white, fontVariantNumeric: 'tabular-nums', margin: '2px 0 5px', ...FONT_STYLE }}>{v != null ? v + '%' : '—'}</div>
      <div style={{ height: 4, borderRadius: 2, background: C.faint, overflow: 'hidden' }}>
        <div style={{ width: (v || 0) + '%', height: '100%', background: barColor, borderRadius: 2 }} />
      </div>
    </div>
  );
}

function PlateDiscipline({ pitches }) {
  const { swings, takes, whiffs, contact, zSwingPct, zWhiffPct, chasePct, ozWhiffPct } = useMemo(() => {
    const isSwing = c => sharedIsSwing({ pitch_call: c }); // AUDIT: shared classifier
    const inZone = p => p.plate_loc_height >= 1.5 && p.plate_loc_height <= 3.5 && p.plate_loc_side >= -0.83 && p.plate_loc_side <= 0.83;
    const ooz = pitches.filter(p => p.plate_loc_height != null && !inZone(p));
    const inZ = pitches.filter(p => p.plate_loc_height != null && inZone(p));
    const swings = pitches.filter(p => isSwing(p.pitch_call)).length;
    const takes = pitches.length - swings;
    const whiffs = pitches.filter(p => p.pitch_call === 'StrikeSwinging').length;
    const contact = pitches.filter(p => ['FoulBall','FoulTip','FoulBallNotFieldable','FoulBallFieldable','InPlay'].includes(p.pitch_call)).length;
    const zSwings = inZ.filter(p => isSwing(p.pitch_call)).length;
    const zWhiffs = inZ.filter(p => p.pitch_call === 'StrikeSwinging').length;
    const chaseSwings = ooz.filter(p => isSwing(p.pitch_call)).length;
    const ozWhiffs = ooz.filter(p => p.pitch_call === 'StrikeSwinging').length;
    return {
      swings, takes, whiffs, contact,
      zSwingPct: inZ.length ? zSwings / inZ.length : null,
      zWhiffPct: zSwings ? zWhiffs / zSwings : null,
      chasePct: ooz.length ? chaseSwings / ooz.length : null,
      ozWhiffPct: chaseSwings ? ozWhiffs / chaseSwings : null,
    };
  }, [pitches]);

  const swingPct = pitches.length ? swings / pitches.length : 0;

  return (
    <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
      {/* Decision funnel: all pitches -> swing/take -> (of swings) contact/whiff */}
      <div style={{ flex: '1 1 260px' }}>
        <div style={{ fontSize: 10, color: C.muted, marginBottom: 5, ...FONT_STYLE }}>All pitches ({pitches.length})</div>
        <PropBar segments={[{ label: 'Swing', value: swings, color: '#e06040' }, { label: 'Take', value: takes, color: '#7aaaca' }]} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0 5px' }}>
          <span style={{ width: 14, height: 10, borderLeft: `2px solid ${C.edge}`, borderBottom: `2px solid ${C.edge}`, borderBottomLeftRadius: 6, flexShrink: 0 }} />
          <span style={{ fontSize: 10, color: C.muted, ...FONT_STYLE }}>Of {swings} swings</span>
        </div>
        <div style={{ width: Math.max(35, swingPct * 100) + '%', paddingLeft: 22 }}>
          <PropBar segments={[{ label: 'Contact', value: contact, color: '#3aaa6a' }, { label: 'Whiff', value: whiffs, color: '#e06040' }]} />
        </div>
      </div>

      {/* Zone command: in-zone discipline vs chase discipline */}
      <div style={{ flex: '1 1 260px', display: 'flex', gap: 22 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <span style={{ width: 3, height: 9, borderRadius: 2, background: C.gold, display: 'inline-block' }} />
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: C.gold, ...FONT_STYLE }}>In Zone</span>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <StatGauge label="Z-Swing" value={zSwingPct} tone="neutral" />
            <StatGauge label="Z-Whiff" value={zWhiffPct} tone="bad" />
          </div>
        </div>
        <div style={{ width: 1, background: C.edge, alignSelf: 'stretch' }} />
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <span style={{ width: 3, height: 9, borderRadius: 2, background: C.muted, display: 'inline-block' }} />
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: C.muted, ...FONT_STYLE }}>Chase</span>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <StatGauge label="Chase%" value={chasePct} tone="bad" />
            <StatGauge label="O-Whiff" value={ozWhiffPct} tone="bad" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── vs Pitch Type table ───────────────────────────────────────
function VsPitchType({ pitches }) {
  const rows = useMemo(() => {
    const byType = {};
    pitches.forEach(p => {
      const pt = normalizePitch(p.tagged_pitch_type || p.pitch_type);
      if (!byType[pt]) byType[pt] = [];
      byType[pt].push(p);
    });
    const isSwing = c => sharedIsSwing({ pitch_call: c }); // AUDIT: shared classifier
    const ooz = p => p.plate_loc_height != null && (p.plate_loc_height < 1.5 || p.plate_loc_height > 3.5 || p.plate_loc_side < -0.83 || p.plate_loc_side > 0.83);
    return Object.entries(byType)
      .filter(([, rs]) => rs.length >= 3)
      .sort((a, b) => b[1].length - a[1].length)
      .map(([pt, rs]) => {
        const swings = rs.filter(r => isSwing(r.pitch_call)).length;
        const whiffs = rs.filter(r => r.pitch_call === 'StrikeSwinging').length;
        const chases = rs.filter(r => ooz(r) && isSwing(r.pitch_call)).length;
        const oozN = rs.filter(r => ooz(r)).length;
        const bip = rs.filter(r => r.pitch_call === 'InPlay' && r.exit_speed > 0);
        const evs = bip.map(r => r.exit_speed).filter(v => v != null);
        const hard = evs.filter(v => v >= 95).length;
        const contact = rs.filter(r => ['FoulBall','FoulTip','FoulBallNotFieldable','FoulBallFieldable','InPlay'].includes(r.pitch_call)).length;
        return {
          pt, count: rs.length,
          swingPct: rs.length ? swings / rs.length : null,
          whiffPct: swings ? whiffs / swings : null,
          chasePct: oozN ? chases / oozN : null,
          contactPct: swings ? contact / swings : null,
          avgEV: mean(evs),
          hardPct: evs.length ? hard / evs.length : null,
        };
      });
  }, [pitches]);

  if (!rows.length) return null;
  const th = { padding: '5px 8px', fontSize: 9, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, whiteSpace: 'nowrap', ...FONT_STYLE };
  const td = { padding: '6px 8px', fontSize: 12, color: C.cream, textAlign: 'right', borderBottom: `0.5px solid ${C.edge}`, fontVariantNumeric: 'tabular-nums', ...FONT_STYLE };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            {['Pitch','Seen','Swing%','Whiff% ↑bad','Chase%','Contact%','Avg EV','Hard%'].map((h, i) => (
              <th key={h} style={{ ...th, textAlign: i < 2 ? 'left' : 'right' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(d => (
            <tr key={d.pt}>
              <td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: pColor(d.pt), marginRight: 6 }} />
                {d.pt}
              </td>
              <td style={{ ...td, textAlign: 'left', color: C.muted }}>{d.count}</td>
              <td style={td}>{pct(d.swingPct)}</td>
              <td style={{ ...td, color: d.whiffPct != null && d.whiffPct >= 0.30 ? C.red : C.cream }}>{pct(d.whiffPct)}</td>
              <td style={td}>{pct(d.chasePct)}</td>
              <td style={{ ...td, color: d.contactPct != null && d.contactPct >= 0.80 ? C.green : C.cream }}>{pct(d.contactPct)}</td>
              <td style={td}>{n1(d.avgEV)}</td>
              <td style={td}>{pct(d.hardPct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Hitter Trends ─────────────────────────────────────────────
function HitterTrends({ pitches }) {
  const { veloBuckets, twoKSeg, twoKCount, twoKContactPct } = useMemo(() => {
    const isSwing = c => sharedIsSwing({ pitch_call: c }); // AUDIT: shared classifier
    const isContact = c => ['FoulBall','FoulTip','FoulBallNotFieldable','FoulBallFieldable','InPlay'].includes(c);
    // FB contact% by velo bucket (cutter excluded from the FB-velocity definition)
    const fbRows = pitches.filter(p => {
      const pt = normalizePitch(p.tagged_pitch_type || p.pitch_type);
      return isFastballVeloType(pt);
    });
    const swungFB = fbRows.filter(r => isSwing(r.pitch_call));
    let veloBuckets = null;
    if (swungFB.length >= 4) {
      const buckets = { '<85': [], '85-88': [], '88-91': [], '91+': [] };
      swungFB.forEach(r => {
        const v = r.rel_speed; if (v == null || v <= 0) return;
        const k = v < 85 ? '<85' : v < 88 ? '85-88' : v < 91 ? '88-91' : '91+';
        buckets[k].push(r);
      });
      veloBuckets = Object.entries(buckets).filter(([, rs]) => rs.length > 0).map(([k, rs]) => ({
        label: k,
        contactPct: rs.length ? rs.filter(r => isContact(r.pitch_call)).length / rs.length : 0,
        n: rs.length,
      }));
    }
    // Two-strike outcomes
    const twoK = pitches.filter(r => r.strikes === 2);
    let twoKSeg = null, twoKContactPct = null;
    if (twoK.length >= 3) {
      const take = twoK.filter(r => !isSwing(r.pitch_call)).length;
      const whiff = twoK.filter(r => r.pitch_call === 'StrikeSwinging').length;
      const foul = twoK.filter(r => ['FoulBall','FoulTip','FoulBallNotFieldable','FoulBallFieldable'].includes(r.pitch_call)).length;
      const inPlay = twoK.filter(r => r.pitch_call === 'InPlay').length;
      twoKSeg = [
        { label: 'Take', value: take, color: '#7aaaca' },
        { label: 'Whiff', value: whiff, color: '#e06040' },
        { label: 'Foul', value: foul, color: '#d4a030' },
        { label: 'In play', value: inPlay, color: '#3aaa6a' },
      ];
      twoKContactPct = (foul + inPlay) / twoK.length;
    }
    return { veloBuckets, twoKSeg, twoKCount: twoK.length, twoKContactPct };
  }, [pitches]);

  if (!veloBuckets && !twoKSeg) return null;
  const tickStyle = { fontSize: 9, fill: C.muted };

  return (
    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
      {veloBuckets && (
        <div style={{ flex: '1 1 240px' }}>
          <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, ...FONT_STYLE }}>Contact% vs FB by velocity</div>
          <ResponsiveContainer width="100%" height={110}>
            <BarChart data={veloBuckets} margin={{ top: 16, right: 8, bottom: 2, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.edge} />
              <XAxis dataKey="label" tick={tickStyle} />
              <YAxis tick={tickStyle} width={28} domain={[0, 1]} tickFormatter={v => Math.round(v * 100)} />
              <Tooltip contentStyle={{ background: C.surface, border: `1px solid ${C.edge}`, color: C.cream, fontSize: 11 }}
                formatter={(v, n, p) => [(v * 100).toFixed(0) + `% (n=${p.payload.n})`, 'Contact']} />
              <Bar dataKey="contactPct" fill={C.gold} radius={[3, 3, 0, 0]}>
                <LabelList dataKey="contactPct" position="top" formatter={v => Math.round(v * 100) + '%'} style={{ fill: C.cream, fontSize: 10, fontWeight: 700 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {twoKSeg && (
        <div style={{ flex: '1 1 220px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 5 }}>
            <span style={{ fontSize: 10, color: C.muted, ...FONT_STYLE }}>Two-strike approach ({twoKCount})</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: C.gold, ...FONT_STYLE }}>{pct(twoKContactPct)} contact</span>
          </div>
          <PropBar segments={twoKSeg} />
        </div>
      )}
    </div>
  );
}

// ── Scout notes ───────────────────────────────────────────────
function ScoutNotes({ catcherObs, runnerObs }) {
  const hasCatcher = catcherObs.length > 0;
  const hasRunner = runnerObs.length > 0;
  if (!hasCatcher && !hasRunner) return null;

  // Catcher
  const popTimes = catcherObs.flatMap(o => [o.warmup_pop_time, ...(o.pop_times || [])].filter(v => v != null));
  const armGrade = catcherObs.map(o => o.arm).filter(Boolean)[0];
  const exchange = catcherObs.map(o => o.exchange).filter(Boolean)[0];
  const stealAttempts = catcherObs.reduce((a, o) => a + (o.steal_attempts || 0), 0);

  // Runner
  const speedRating = runnerObs.map(o => o.speed_rating).filter(Boolean)[0];
  const aggrRating = runnerObs.map(o => o.aggression_rating).filter(Boolean)[0];
  const stealsSucc = runnerObs.reduce((a, o) => a + (o.steals_successful || 0), 0);
  const stealsTotal = runnerObs.reduce((a, o) => a + (o.steal_attempts || 0), 0);
  const notes = runnerObs.map(o => o.notes).filter(Boolean)[0];

  const SPEED_COLOR = { fast: C.green, average: C.amber, slow: C.red };
  const AGGR_COLOR = { aggressive: C.green, average: C.amber, passive: C.muted };

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {hasCatcher && (
        <div style={{ flex: '1 1 220px', background: 'rgba(44,123,182,.07)', border: '1px solid rgba(44,123,182,.2)', borderRadius: 8, padding: '12px 14px' }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: '#6aace0', marginBottom: 8, ...FONT_STYLE }}>Catcher</div>
          {popTimes.length > 0 && (
            <div style={{ marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: C.muted, ...FONT_STYLE }}>Pop time: </span>
              <span style={{ fontSize: 13, fontWeight: 800, color: C.cream, ...FONT_STYLE }}>
                {Math.min(...popTimes).toFixed(2)}s best · {(mean(popTimes)).toFixed(2)}s avg
              </span>
            </div>
          )}
          {armGrade && <div style={{ fontSize: 11, color: C.muted, ...FONT_STYLE }}>Arm: <b style={{ color: C.cream }}>{armGrade}</b></div>}
          {exchange && <div style={{ fontSize: 11, color: C.muted, ...FONT_STYLE }}>Exchange: <b style={{ color: C.cream }}>{exchange}</b></div>}
          {stealAttempts > 0 && <div style={{ fontSize: 11, color: C.muted, ...FONT_STYLE }}>Steal attempts: <b style={{ color: C.cream }}>{stealAttempts}</b></div>}
        </div>
      )}
      {hasRunner && (
        <div style={{ flex: '1 1 220px', background: 'rgba(200,146,12,.07)', border: '1px solid rgba(200,146,12,.18)', borderRadius: 8, padding: '12px 14px' }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: C.gold, marginBottom: 8, ...FONT_STYLE }}>Baserunner</div>
          {speedRating && (
            <div style={{ marginBottom: 4, fontSize: 11, color: C.muted, ...FONT_STYLE }}>
              Speed: <b style={{ color: SPEED_COLOR[speedRating] || C.cream }}>{speedRating}</b>
            </div>
          )}
          {aggrRating && (
            <div style={{ marginBottom: 4, fontSize: 11, color: C.muted, ...FONT_STYLE }}>
              Aggression: <b style={{ color: AGGR_COLOR[aggrRating] || C.cream }}>{aggrRating}</b>
            </div>
          )}
          {stealsTotal > 0 && (
            <div style={{ marginBottom: 4, fontSize: 11, color: C.muted, ...FONT_STYLE }}>
              Steals: <b style={{ color: C.cream }}>{stealsSucc}/{stealsTotal}</b>
            </div>
          )}
          {notes && <div style={{ fontSize: 11, color: C.muted, fontStyle: 'italic', marginTop: 6, ...FONT_STYLE }}>"{notes}"</div>}
        </div>
      )}
    </div>
  );
}

// ── Savant-parity: Rolling trend (exit velo, whiff%, chase%) ─────
function HitterRollingTrendSection({ pitches }) {
  const trend = rollingGameTrend(pitches);
  if (trend.length < 3) return <div style={{ color: C.muted, fontSize: 12 }}>Need at least 3 games for a trend line.</div>;
  const data = trend.map(g => {
    const gameRows = pitches.filter(p => p.game_id === g.gameId);
    const evs = gameRows.map(p => parseFloat(p.exit_speed)).filter(Number.isFinite);
    return {
      game: new Date(g.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      'Exit velo': evs.length ? +(evs.reduce((a, b) => a + b, 0) / evs.length).toFixed(1) : null,
      'Whiff%': g.whiffPct,
      'Chase%': g.chasePct,
    };
  });
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
        <CartesianGrid stroke={C.faint} />
        <XAxis dataKey="game" tick={{ fill: C.muted, fontSize: 10 }} stroke={C.faint} />
        <YAxis yAxisId="left" tick={{ fill: C.muted, fontSize: 10 }} stroke={C.faint} />
        <YAxis yAxisId="right" orientation="right" tick={{ fill: C.muted, fontSize: 10 }} stroke={C.faint} />
        <Tooltip contentStyle={{ background: C.raised, border: `1px solid ${C.edge}`, fontSize: 11 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line yAxisId="left" type="monotone" dataKey="Exit velo" stroke={C.gold} dot={false} strokeWidth={2} connectNulls />
        <Line yAxisId="right" type="monotone" dataKey="Whiff%" stroke={C.green} dot={false} strokeWidth={2} connectNulls />
        <Line yAxisId="right" type="monotone" dataKey="Chase%" stroke={C.red} dot={false} strokeWidth={2} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── KDE zones by outcome ─────────────────────────────────────
function HitterKdeZones({ pitches }) {
  const groups = useMemo(() => {
    const swings = pitches.filter(p => isSwing(p));
    const whiffs = pitches.filter(p => p.pitch_call === 'StrikeSwinging');
    const inPlayAll = pitches.filter(p => p.pitch_call === 'InPlay');
    const inPlayOuts = pitches.filter(p => p.pitch_call === 'InPlay' && p.play_result === 'Out');
    const hits = pitches.filter(p => ['Single', 'Double', 'Triple', 'HomeRun'].includes(p.play_result));
    const xbh = pitches.filter(p => ['Double', 'Triple', 'HomeRun'].includes(p.play_result));
    const hardHit = pitches.filter(p => p.pitch_call === 'InPlay' && p.exit_speed != null && p.exit_speed >= 95);

    return [
      { label: 'All Pitches', pitches: pitches },
      { label: 'Swings', pitches: swings },
      { label: 'Whiffs', pitches: whiffs },
      { label: 'Balls In Play', pitches: inPlayAll },
      { label: 'In-Play Outs', pitches: inPlayOuts },
      { label: 'Hits', pitches: hits },
      { label: 'Extra Base Hits', pitches: xbh },
      { label: 'Hard-Hit Zone (EV≥95)', pitches: hardHit },
    ].filter(g => g.pitches.length > 0);
  }, [pitches]);

  if (!groups.length) return null;
  return (
    <div style={{ overflowX: 'auto' }}>
      <LocationContourPlot groups={groups} cellWidth={140} cellHeight={178} gap={12} wrap="nowrap" minPoints={10} />
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────
// ── Sub-tab bar (parity with PitcherProfileOverview, mockup v3) ──
const HITTER_PANES = [
  ['overview', 'Overview'],
  ['contact', 'Contact'],
  ['discipline', 'Discipline & Trends'],
  ['splits', 'Splits'],
  ['notes', 'Notes'],
];

function SubTabBar({ pane, setPane }) {
  return (
    <div className="no-print" style={{ display: 'flex', gap: 7, marginBottom: 18, overflowX: 'auto', paddingBottom: 2 }}>
      {HITTER_PANES.map(([key, label]) => (
        <button key={key} onClick={() => setPane(key)} style={{
          flexShrink: 0, cursor: 'pointer', fontFamily: FONT,
          border: `1px solid ${pane === key ? C.gold : C.edge}`,
          background: pane === key ? 'rgba(200,146,12,0.1)' : C.surface,
          color: pane === key ? C.gold : C.muted,
          borderRadius: 8, fontSize: 11.5, fontWeight: 800, padding: '8px 16px',
        }}>
          {label}
        </button>
      ))}
    </div>
  );
}

const EmptyPane = ({ children }) => (
  <p style={{ color: C.muted, textAlign: 'center', padding: 40, fontSize: 12, ...FONT_STYLE }}>{children}</p>
);

export default function BatterProfileOverview({ pitches, runnerObs, catcherObs, hitterPool, playerNameKey }) {
  const [pane, setPane] = useState('overview');

  if (!pitches.length && !runnerObs.length && !catcherObs.length) {
    return <p style={{ color: C.muted, textAlign: 'center', padding: 40, ...FONT_STYLE }}>No data found for this player.</p>;
  }

  const hasTrackman = pitches.length >= 5;
  const hasPercentiles = pitches.length >= 10 && hitterPool;

  return (
    <div style={FONT_STYLE}>
      <SubTabBar pane={pane} setPane={setPane} />

      {/* ── OVERVIEW: percentiles + location zones ── */}
      {pane === 'overview' && (
        <>
          {hasPercentiles && (
            <>
              {sHead('Percentiles', 'vs CCL')}
              <div style={{ marginBottom: 14 }}>
                <HitterPercentiles pitches={pitches} hitterPool={hitterPool} />
              </div>
            </>
          )}
          {hasTrackman && (
            <>
              {sHead('Location Zones', 'KDE density by outcome')}
              <Card style={{ marginBottom: 18 }}>
                <HitterKdeZones pitches={pitches} />
              </Card>
            </>
          )}
          {!hasTrackman && !hasPercentiles && <EmptyPane>Not enough pitch data in this scope.</EmptyPane>}
        </>
      )}

      {/* ── CONTACT: batted-ball profile + spray + xHR ── */}
      {pane === 'contact' && (
        hasTrackman ? (
          <>
            {sHead('Contact Profile', `${pitches.filter(p => p.pitch_call === 'InPlay' && p.exit_speed > 0).length} balls in play`)}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
              <Card style={{ flex: '2 1 280px' }}>
                <BattedBallContactPanel rows={pitches} />
              </Card>
              <Card style={{ flex: '1 1 220px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 8, ...FONT_STYLE }}>Spray chart</div>
                <SprayChart pitches={pitches} />
              </Card>
            </div>
            {sHead('xHR by Park', 'approx, distance-only')}
            <Card style={{ marginBottom: 18 }}>
              <XHRParkTable rows={pitches} direction="for" />
            </Card>
          </>
        ) : <EmptyPane>Not enough pitch data in this scope.</EmptyPane>
      )}

      {/* ── DISCIPLINE & TRENDS: the combined discipline / trends / season-trend card ── */}
      {pane === 'discipline' && (
        hasTrackman ? (
          <>
            {sHead('Plate Discipline & Trends', `${pitches.length} pitches seen`)}
            <Card style={{ marginBottom: 18 }}>
              <PlateDiscipline pitches={pitches} />

              {pitches.length >= 8 && (
                <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.edge}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                    <span style={{ width: 3, height: 10, borderRadius: 2, background: C.gold, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.3, textTransform: 'uppercase', color: C.gold, ...FONT_STYLE }}>Contact vs Velo &amp; Two-Strike Approach</span>
                  </div>
                  <HitterTrends pitches={pitches} />
                </div>
              )}

              {pitches.length >= 30 && (
                <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.edge}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                    <span style={{ width: 3, height: 10, borderRadius: 2, background: C.gold, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.3, textTransform: 'uppercase', color: C.gold, ...FONT_STYLE }}>Season Trend (by game)</span>
                  </div>
                  <HitterRollingTrendSection pitches={pitches} />
                </div>
              )}
            </Card>
          </>
        ) : <EmptyPane>Not enough pitch data in this scope.</EmptyPane>
      )}

      {/* ── SPLITS: platoon + vs pitch type ── */}
      {pane === 'splits' && (
        hasTrackman ? (
          <>
            {sHead('Platoon Splits', 'vs pitcher handedness')}
            <Card style={{ marginBottom: 18 }}>
              <PlatoonSplitsTable rows={pitches} side="pitcher_hand" />
            </Card>
            {sHead('vs Pitch Type')}
            <Card style={{ marginBottom: 18, padding: '14px 0' }}>
              <VsPitchType pitches={pitches} />
            </Card>
          </>
        ) : <EmptyPane>Not enough pitch data in this scope.</EmptyPane>
      )}

      {/* ── NOTES: scout observations + coach annotations ── */}
      {pane === 'notes' && (
        <>
          {(catcherObs.length > 0 || runnerObs.length > 0) && (
            <>
              {sHead('Scout Notes')}
              <ScoutNotes catcherObs={catcherObs} runnerObs={runnerObs} />
            </>
          )}
          {playerNameKey && <CoachNoteBox playerNameKey={playerNameKey} />}
          {catcherObs.length === 0 && runnerObs.length === 0 && !playerNameKey && <EmptyPane>No scout notes for this player.</EmptyPane>}
        </>
      )}
    </div>
  );
}
