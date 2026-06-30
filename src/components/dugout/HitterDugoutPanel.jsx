import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { canonicalNameKey, normHand, isSwing, isWhiff } from '@/lib/statsUtils';
import { getPitchColor, normalizePitch } from '@/lib/ds';
import { ZoneHeatmap, SprayChart, rgba } from './HitterViz';

const FONT   = "'Archivo', system-ui, sans-serif";
const NAVY   = '#0e253a';
const NAVY_L = '#24445f';
const GOLD   = '#c8920c';
const GOLDM  = '#c6b583';
const TEXT   = '#e8eef5';
const TEXTD  = '#9fb2c4';
const TEXTF  = '#5f7488';
const GOOD   = '#2dba5a';

const SPEED_THEME = {
  fast:    { bg:'rgba(34,197,94,0.13)',  border:'rgba(45,186,90,0.65)',  glow:'0 0 18px rgba(45,186,90,0.35)',  text:'#4ade80' },
  average: { bg:'rgba(234,179,8,0.10)',  border:'rgba(234,179,8,0.55)', glow:'0 0 18px rgba(234,179,8,0.25)',  text:'#facc15' },
  slow:    { bg:'rgba(239,68,68,0.12)',  border:'rgba(239,68,68,0.55)', glow:'0 0 18px rgba(239,68,68,0.28)',  text:'#f87171' },
};
const AGGR_COLOR = { aggressive:'#4ade80', average:'#facc15', passive:'#94a3b8' };

const AB_RES  = ['Single','Double','Triple','HomeRun','Out','Error','FieldersChoice'];
const HIT_RES = ['Single','Double','Triple','HomeRun'];
const TB_MAP  = { Single:1, Double:2, Triple:3, HomeRun:4 };

function computeStats(rows) {
  let swings=0, whiffs=0, contacts=0, AB=0, H=0, tb=0;
  const evs = [];
  for (const r of rows) {
    if (isSwing(r))  swings++;
    if (isWhiff(r))  whiffs++;
    if (isSwing(r) && !isWhiff(r)) contacts++;
    if (r.pitch_call === 'InPlay') {
      const ev = parseFloat(r.exit_speed);
      if (isFinite(ev) && ev > 30) evs.push(ev);
      if (AB_RES.includes(r.play_result))  AB++;
      if (HIT_RES.includes(r.play_result)) { H++; tb += TB_MAP[r.play_result]||0; }
    }
  }
  return {
    pitches: rows.length, AB, H,
    avgEV:      evs.length ? evs.reduce((a,b)=>a+b,0)/evs.length : null,
    maxEV:      evs.length ? Math.max(...evs) : null,
    contactPct: swings ? (swings-whiffs)/swings : null,
    BA:  AB ? H/AB  : null,
    SLG: AB ? tb/AB : null,
  };
}

// ── Per-pitch-type breakdown ──────────────────────────────────────────────────
// NOTE: assumes the pitch-type field is r.pitch_type (falls back to
// r.tagged_pitch_type / r.auto_pitch_type if present under a different name).
// If pitch types come back blank in the live app, this field name is the
// first thing to check against the actual TrackmanPitch schema.
function computePitchTypeStats(rows) {
  const total = rows.length;
  const map = {};
  for (const r of rows) {
    const raw = r.pitch_type || r.tagged_pitch_type || r.auto_pitch_type || 'Other';
    const type = normalizePitch(raw) || raw;
    if (!map[type]) map[type] = { type, n:0, swings:0, whiffs:0, AB:0, tb:0 };
    const g = map[type];
    g.n++;
    if (isSwing(r)) g.swings++;
    if (isWhiff(r)) g.whiffs++;
    if (r.pitch_call === 'InPlay') {
      if (AB_RES.includes(r.play_result))  g.AB++;
      if (HIT_RES.includes(r.play_result)) g.tb += TB_MAP[r.play_result] || 0;
    }
  }
  return Object.values(map)
    .map(g => ({
      ...g,
      usagePct: total ? g.n/total : 0,
      whiffPct: g.swings ? g.whiffs/g.swings : null,
      slg:      g.AB     ? g.tb/g.AB         : null,
    }))
    .sort((a,b) => b.n - a.n);
}

const fmtAvg = v => v == null ? '—' : v.toFixed(3).replace(/^0/,'');
const fmtPct = v => v == null ? '—' : Math.round(v*100)+'%';
const fmtEV  = v => v == null ? '—' : v.toFixed(1);

function StatPill({ label, value, accent }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'4px 14px', borderRight:`1px solid ${NAVY_L}` }}>
      <span style={{ fontSize:18, fontWeight:800, color:accent||TEXT, fontFamily:FONT, fontVariantNumeric:'tabular-nums', lineHeight:1.15 }}>{value}</span>
      <span style={{ fontSize:9, letterSpacing:'1px', textTransform:'uppercase', color:TEXTF, fontWeight:700, marginTop:2, fontFamily:FONT }}>{label}</span>
    </div>
  );
}

// ── Section title — centered, large, readable from across the dugout ──────────
function SectionTitle({ children }) {
  return (
    <div style={{ fontSize:16, letterSpacing:'1.5px', textTransform:'uppercase', color:GOLDM, fontWeight:800, fontFamily:FONT, marginBottom:10, textAlign:'center' }}>
      {children}
    </div>
  );
}

// ── Pitch-type production table ───────────────────────────────────────────────
function PitchTypeTable({ rows }) {
  const stats = useMemo(() => computePitchTypeStats(rows), [rows]);

  if (!stats.length) {
    return <div style={{ color:TEXTF, fontSize:13, fontStyle:'italic', textAlign:'center' }}>No pitch data</div>;
  }

  return (
    <div style={{ width:'100%' }}>
      {/* Header row */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 52px 52px 56px', gap:6, padding:'0 4px 8px', borderBottom:`1px solid ${NAVY_L}`, marginBottom:4 }}>
        <span style={{ fontSize:10, fontWeight:800, letterSpacing:'0.8px', textTransform:'uppercase', color:TEXTF, fontFamily:FONT }}>Pitch</span>
        <span style={{ fontSize:10, fontWeight:800, letterSpacing:'0.8px', textTransform:'uppercase', color:TEXTF, fontFamily:FONT, textAlign:'right' }}>Use%</span>
        <span style={{ fontSize:10, fontWeight:800, letterSpacing:'0.8px', textTransform:'uppercase', color:TEXTF, fontFamily:FONT, textAlign:'right' }}>Whiff%</span>
        <span style={{ fontSize:10, fontWeight:800, letterSpacing:'0.8px', textTransform:'uppercase', color:TEXTF, fontFamily:FONT, textAlign:'right' }}>SLG</span>
      </div>
      {/* Rows */}
      <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
        {stats.map(g => {
          // Whiff% inverted: high whiff = bad for hitter = blue (cold).
          // SLG direct: high SLG = good for hitter = red (damage).
          // Both match the same blue-white-red scale used in Hot Zones.
          const whiffT = g.whiffPct != null ? 1 - Math.max(0, Math.min(1, g.whiffPct/0.45)) : null;
          const slgT   = g.slg      != null ? Math.max(0, Math.min(1, g.slg/0.700))         : null;
          return (
            <div key={g.type} style={{ display:'grid', gridTemplateColumns:'1fr 52px 52px 56px', gap:6, alignItems:'center', padding:'7px 4px', borderRadius:5 }}>
              <span style={{ display:'flex', alignItems:'center', gap:7, fontSize:14, fontWeight:700, color:TEXT, fontFamily:FONT, minWidth:0 }}>
                <span style={{ width:10, height:10, borderRadius:3, background:getPitchColor(g.type), flexShrink:0 }} />
                <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{g.type}</span>
              </span>
              <span style={{ fontSize:14, fontWeight:700, color:TEXTD, fontFamily:FONT, textAlign:'right', fontVariantNumeric:'tabular-nums' }}>{Math.round(g.usagePct*100)}%</span>
              <span style={{ fontSize:14, fontWeight:700, color:TEXT, fontFamily:FONT, textAlign:'right', fontVariantNumeric:'tabular-nums', background: whiffT!=null ? rgba(whiffT,0.32) : 'transparent', borderRadius:4, padding:'2px 5px' }}>{fmtPct(g.whiffPct)}</span>
              <span style={{ fontSize:14, fontWeight:800, color:TEXT, fontFamily:FONT, textAlign:'right', fontVariantNumeric:'tabular-nums', background: slgT!=null ? rgba(slgT,0.32) : 'transparent', borderRadius:4, padding:'2px 5px' }}>{g.slg!=null ? fmtAvg(g.slg) : '—'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Baserunner slot — speed-colored glow when occupied ────────────────────────
function BaseSlot({ base, runner }) {
  const LABELS = { '1B':'1st Base', '2B':'2nd Base', '3B':'3rd Base' };
  const isEmpty  = !runner;
  const isOnBase = runner?.is_on_base;
  const speed    = runner?.speed_rating;
  const theme    = (isOnBase && speed && SPEED_THEME[speed]) ? SPEED_THEME[speed] : null;

  return (
    <div style={{
      flex: 1, minWidth: 0,
      border:     `1px solid ${theme ? theme.border : isEmpty ? NAVY_L : GOLDM}`,
      borderRadius: 10,
      padding:    '14px 16px',
      background: theme ? theme.bg : isEmpty ? 'rgba(27,58,89,0.35)' : 'rgba(200,146,12,0.07)',
      display:    'flex', flexDirection:'column', gap:7,
      boxShadow:  theme ? theme.glow : 'none',
      transition: 'box-shadow 0.3s, border-color 0.3s, background 0.3s',
    }}>
      <div style={{ fontSize:15, letterSpacing:'2px', textTransform:'uppercase', fontWeight:900, color:theme ? theme.text : isEmpty ? TEXTF : GOLDM, fontFamily:FONT }}>
        {LABELS[base]}
      </div>

      {isEmpty ? (
        <div style={{ fontSize:15, color:TEXTF, fontStyle:'italic', fontFamily:FONT }}>Empty</div>
      ) : (
        <>
          <div style={{ fontSize:19, fontWeight:800, color:TEXT, fontFamily:FONT, lineHeight:1.2 }}>
            {runner.jersey_number ? <span style={{ color:GOLDM, marginRight:6 }}>#{runner.jersey_number}</span> : null}
            {runner.runner_name}
          </div>
          <div style={{ display:'flex', gap:7, flexWrap:'wrap', alignItems:'center' }}>
            {speed && (
              <span style={{ fontSize:13, fontWeight:800, padding:'4px 11px', borderRadius:5,
                background: theme ? theme.border.replace('0.65','0.18').replace('0.55','0.18') : 'rgba(255,255,255,0.08)',
                color: theme ? theme.text : TEXTD, border:`1px solid ${theme ? theme.border : 'transparent'}`, fontFamily:FONT }}>
                {speed}
              </span>
            )}
            {runner.aggression_rating && (
              <span style={{ fontSize:13, fontWeight:700, padding:'4px 11px', borderRadius:5,
                background:(AGGR_COLOR[runner.aggression_rating]||TEXTF)+'22',
                color:AGGR_COLOR[runner.aggression_rating]||TEXTD,
                border:`1px solid ${(AGGR_COLOR[runner.aggression_rating]||TEXTF)}44`, fontFamily:FONT }}>
                {runner.aggression_rating}
              </span>
            )}
            {runner.steal_attempts > 0 && (
              <span style={{ fontSize:13, color:GOLDM, fontWeight:700, fontFamily:FONT }}>
                {runner.steals_successful||0}/{runner.steal_attempts} SB
              </span>
            )}
          </div>
          {base==='1B' && runner.lead_size_1b && (
            <div style={{ fontSize:13, color:TEXTD, fontFamily:FONT }}>Lead: {runner.lead_size_1b}</div>
          )}
          {runner.notes && (
            <div style={{ fontSize:13, color:TEXTD, fontStyle:'italic', fontFamily:FONT }}>{runner.notes}</div>
          )}
        </>
      )}
    </div>
  );
}

export default function HitterDugoutPanel({ gameId }) {
  const [currentBatter, setCurrentBatter] = useState(null);
  const [batterRows,    setBatterRows]     = useState([]);
  const [runners,       setRunners]        = useState([]);
  const pollRef = useRef(null);

  const poll = useCallback(() => {
    if (!gameId) return;
    Promise.all([
      base44.entities.HitterObservation.filter({ game_id: gameId, is_current_batter: true }, '-updated_date', 1).catch(() => []),
      base44.entities.BaserunnerObservation.filter({ game_id: gameId, is_on_base: true }, 'runner_name', 20).catch(() => []),
    ]).then(([batters, runnerRows]) => {
      setCurrentBatter(batters?.[0] || null);
      setRunners(runnerRows || []);
    }).catch(() => {});
  }, [gameId]);

  useEffect(() => {
    if (!gameId) return;
    poll();
    pollRef.current = setInterval(poll, 10000);
    return () => clearInterval(pollRef.current);
  }, [gameId, poll]);

  useEffect(() => {
    if (!currentBatter?.hitter_name || !currentBatter?.hitter_team) { setBatterRows([]); return; }
    let cancelled = false;
    (async () => {
      const rows = await base44.entities.TrackmanPitch
        .filter({ batter_team: currentBatter.hitter_team }, '-date', 1000).catch(() => []);
      if (cancelled) return;
      const key = canonicalNameKey(currentBatter.hitter_name);
      setBatterRows((rows||[]).filter(r => canonicalNameKey(r.batter_name) === key));
    })();
    return () => { cancelled = true; };
  }, [currentBatter?.hitter_name, currentBatter?.hitter_team]);

  if (!gameId) return null;

  const hand      = normHand(currentBatter?.hitter_hand);
  const handLabel = hand === 'S' ? 'SHH' : hand ? hand+'HB' : null;
  const stats     = computeStats(batterRows);
  const hasData   = batterRows.length > 0;
  const runnerAt  = base => runners.find(r => r.current_base === base) || null;

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden', fontFamily:FONT, background:'#0c1e2d' }}>

      {/* ── BATTER HEADER ─────────────────────────────────────── */}
      <div style={{ background:NAVY, borderBottom:`1px solid ${NAVY_L}`, flexShrink:0, display:'flex', alignItems:'stretch', minHeight:68 }}>
        <div style={{ padding:'10px 20px', display:'flex', alignItems:'center', gap:12, flex:'0 0 auto' }}>
          {currentBatter ? (
            <>
              {currentBatter.jersey_number && (
                <div style={{ fontSize:34, fontWeight:900, color:GOLD, lineHeight:1, fontVariantNumeric:'tabular-nums', minWidth:56, textAlign:'center', flexShrink:0 }}>
                  #{currentBatter.jersey_number}
                </div>
              )}
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3, flexWrap:'wrap' }}>
                  <span style={{ fontSize:24, fontWeight:900, color:TEXT, letterSpacing:-0.5 }}>{currentBatter.hitter_name}</span>
                  {handLabel && <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:4, background:'rgba(200,146,12,0.18)', color:GOLDM }}>{handLabel}</span>}
                </div>
                <div style={{ fontSize:11, color:TEXTD, fontWeight:500 }}>{currentBatter.hitter_team||'—'} · Batter</div>
              </div>
            </>
          ) : (
            <div style={{ fontSize:14, color:'rgba(255,255,255,0.3)', fontStyle:'italic' }}>Waiting for batter…</div>
          )}
        </div>
        <div style={{ width:1, background:NAVY_L, flexShrink:0, alignSelf:'stretch', margin:'8px 0' }} />
        <div style={{ display:'flex', alignItems:'stretch', flex:1, overflow:'hidden' }}>
          <StatPill label="Pitches"  value={stats.pitches||'—'} />
          <StatPill label="AVG"      value={fmtAvg(stats.BA)} />
          <StatPill label="SLG"      value={fmtAvg(stats.SLG)} accent={GOLD} />
          <StatPill label="Avg EV"   value={fmtEV(stats.avgEV)} />
          <StatPill label="Max EV"   value={stats.maxEV ? Math.round(stats.maxEV)+'' : '—'} accent={stats.maxEV>=95 ? GOOD : undefined} />
          <StatPill label="Contact%" value={fmtPct(stats.contactPct)} />
        </div>
      </div>

      {/* ── VIZ BODY — Hot Zones | Pitch Type | Spray Chart ───── */}
      <div style={{ flex:1, display:'flex', minHeight:0, overflow:'hidden' }}>

        {/* LEFT — hot zones */}
        <div style={{ flex:'0 0 46%', maxWidth:'46%', borderRight:`1px solid ${NAVY_L}`, padding:'12px 14px', display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <SectionTitle>HOT ZONES</SectionTitle>
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', minHeight:0 }}>
            {hasData ? (
              <div style={{ width:'100%', maxWidth:600 }}>
                <ZoneHeatmap rows={batterRows} viewMode="pitcher" batterHand={hand} />
              </div>
            ) : (
              <div style={{ color:TEXTF, fontSize:13, fontStyle:'italic', textAlign:'center' }}>
                {currentBatter ? 'No Trackman data for this batter' : 'No batter active'}
              </div>
            )}
          </div>
          {/* Legend — blue (weak contact/EV) → white (moderate) → red (strong contact + high EV) */}
          <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:8, fontSize:12, color:TEXTF, flexShrink:0, justifyContent:'center' }}>
            <span>Weak</span>
            <div style={{ display:'flex', height:9, borderRadius:3, overflow:'hidden', width:140 }}>
              {['rgba(47,99,166,0.9)','rgba(144,170,205,0.9)','rgba(242,242,242,0.9)','rgba(221,138,140,0.9)','rgba(200,40,44,0.9)'].map((c,i)=><span key={i} style={{flex:1,background:c}}/>)}
            </div>
            <span>Damage</span>
          </div>
        </div>

        {/* CENTER — pitch type production table */}
        <div style={{ flex:'0 0 19%', maxWidth:'19%', borderRight:`1px solid ${NAVY_L}`, padding:'12px 14px', display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <SectionTitle>By Pitch Type</SectionTitle>
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', minHeight:0, overflow:'hidden' }}>
            {hasData ? <PitchTypeTable rows={batterRows} /> : (
              <div style={{ color:TEXTF, fontSize:13, fontStyle:'italic', textAlign:'center' }}>
                {currentBatter ? 'No Trackman data for this batter' : 'No batter active'}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — spray chart */}
        <div style={{ flex:'1 1 38%', padding:'12px 14px', display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <SectionTitle>Spray Chart</SectionTitle>
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', minHeight:0 }}>
            {hasData ? (
              <div style={{ width:'100%', maxWidth:380 }}>
                <SprayChart rows={batterRows} hand={hand} dugout={true} />
              </div>
            ) : (
              <div style={{ color:TEXTF, fontSize:13, fontStyle:'italic', textAlign:'center' }}>
                {currentBatter ? 'No Trackman data for this batter' : 'No batter active'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── BASERUNNER FOOTER — no header label, just the three cards ── */}
      <div style={{ flexShrink:0, borderTop:`2px solid ${GOLD}`, background:'rgba(14,37,58,0.75)', padding:'12px 16px' }}>
        <div style={{ display:'flex', gap:10 }}>
          <BaseSlot base="1B" runner={runnerAt('1B')} />
          <BaseSlot base="2B" runner={runnerAt('2B')} />
          <BaseSlot base="3B" runner={runnerAt('3B')} />
        </div>
      </div>
    </div>
  );
}
