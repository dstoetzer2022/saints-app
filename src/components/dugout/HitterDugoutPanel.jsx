import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { canonicalNameKey, normHand, isSwing, isWhiff, isValidBattedBall } from '@/lib/statsUtils';
import { ZoneHeatmap, SprayChart } from './HitterViz';

const FONT    = "'Archivo', system-ui, sans-serif";
const NAVY    = '#0e253a';
const NAVY_S  = '#16304a';
const NAVY_C  = '#1b3a59';
const NAVY_L  = '#24445f';
const GOLD    = '#c8920c';
const GOLDM   = '#c6b583';
const TEXT    = '#e8eef5';
const TEXTD   = '#9fb2c4';
const TEXTF   = '#5f7488';
const GOOD    = '#2dba5a';
const BAD     = '#e24b4a';

// ── stat helpers ──────────────────────────────────────────────────────────────
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
      if (AB_RES.includes(r.play_result)) AB++;
      if (HIT_RES.includes(r.play_result)) { H++; tb += TB_MAP[r.play_result] || 0; }
    }
  }
  const avgEV = evs.length ? evs.reduce((a,b)=>a+b,0)/evs.length : null;
  const maxEV = evs.length ? Math.max(...evs) : null;
  return {
    pitches: rows.length, swings, whiffs, AB, H, tb, avgEV, maxEV,
    contactPct: swings ? contacts/swings  : null,
    BA:         AB     ? H/AB             : null,
    SLG:        AB     ? tb/AB            : null,
  };
}

function fmtAvg(v)  { return v == null ? '—' : v.toFixed(3).replace(/^0/,''); }
function fmtPct(v)  { return v == null ? '—' : Math.round(v*100)+'%'; }
function fmtEV(v)   { return v == null ? '—' : v.toFixed(1); }

// ── Stat pill in header ───────────────────────────────────────────────────────
function StatPill({ label, value, accent }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'4px 14px', borderRight:`1px solid ${NAVY_L}` }}>
      <span style={{ fontSize:18, fontWeight:800, color: accent || TEXT, fontFamily:FONT, fontVariantNumeric:'tabular-nums', lineHeight:1.15 }}>{value}</span>
      <span style={{ fontSize:9, letterSpacing:'1px', textTransform:'uppercase', color:TEXTF, fontWeight:700, marginTop:2, fontFamily:FONT }}>{label}</span>
    </div>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────
function SectionTitle({ children, style }) {
  return (
    <div style={{ fontSize:9, letterSpacing:'1.5px', textTransform:'uppercase', color:GOLDM, fontWeight:700, fontFamily:FONT, marginBottom:8, ...style }}>
      {children}
    </div>
  );
}

// ── Speed / aggression badge colors ──────────────────────────────────────────
const SPEED_C = { fast:'#2dba5a', average:'#d97706', slow:BAD };
const AGGR_C  = { aggressive:'#2dba5a', average:'#d97706', passive:'#6b7280' };

// ── Single base slot ──────────────────────────────────────────────────────────
function BaseSlot({ base, runner }) {
  const LABELS = { '1B':'1st Base', '2B':'2nd Base', '3B':'3rd Base' };
  const isEmpty = !runner;
  return (
    <div style={{
      flex:1,
      border: `1px solid ${isEmpty ? NAVY_L : GOLD}`,
      borderRadius: 8,
      padding: '11px 14px',
      background: isEmpty ? `rgba(27,58,89,0.35)` : 'rgba(200,146,12,0.07)',
      display: 'flex', flexDirection:'column', gap:5,
      minWidth: 0,
    }}>
      {/* Base label */}
      <div style={{ fontSize:9, letterSpacing:'1.5px', textTransform:'uppercase', fontWeight:800, color: isEmpty ? TEXTF : GOLDM, fontFamily:FONT }}>
        {LABELS[base]}
      </div>

      {isEmpty ? (
        <div style={{ fontSize:12, color:TEXTF, fontStyle:'italic', fontFamily:FONT, marginTop:2 }}>Empty</div>
      ) : (
        <>
          {/* Name + jersey */}
          <div style={{ fontSize:15, fontWeight:800, color:TEXT, fontFamily:FONT, lineHeight:1.15 }}>
            {runner.jersey_number ? <span style={{ color:GOLDM, marginRight:5 }}>#{runner.jersey_number}</span> : null}
            {runner.runner_name}
          </div>
          {/* Badges row */}
          <div style={{ display:'flex', gap:5, flexWrap:'wrap', alignItems:'center' }}>
            {runner.speed_rating && (
              <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:3,
                background: (SPEED_C[runner.speed_rating]||TEXTF)+'22',
                color: SPEED_C[runner.speed_rating]||TEXTF,
                border:`1px solid ${(SPEED_C[runner.speed_rating]||TEXTF)}44`, fontFamily:FONT }}>
                {runner.speed_rating}
              </span>
            )}
            {runner.aggression_rating && (
              <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:3,
                background: (AGGR_C[runner.aggression_rating]||TEXTF)+'22',
                color: AGGR_C[runner.aggression_rating]||TEXTF,
                border:`1px solid ${(AGGR_C[runner.aggression_rating]||TEXTF)}44`, fontFamily:FONT }}>
                {runner.aggression_rating}
              </span>
            )}
            {(runner.steal_attempts > 0) && (
              <span style={{ fontSize:10, color:GOLDM, fontWeight:600, fontFamily:FONT }}>
                {runner.steals_successful||0}/{runner.steal_attempts} SB
              </span>
            )}
          </div>
          {/* Lead size (1B only) */}
          {base === '1B' && runner.lead_size_1b && (
            <div style={{ fontSize:10, color:TEXTD, fontFamily:FONT }}>Lead: {runner.lead_size_1b}</div>
          )}
          {/* Notes */}
          {runner.notes && (
            <div style={{ fontSize:10, color:TEXTD, fontStyle:'italic', fontFamily:FONT }}>{runner.notes}</div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function HitterDugoutPanel({ gameId }) {
  const [currentBatter, setCurrentBatter] = useState(null);
  const [batterRows,    setBatterRows]     = useState([]);
  const [runners,       setRunners]        = useState([]);   // is_on_base=true rows

  const pollRef = useRef(null);

  // Poll current batter + runners every 10s
  const poll = useCallback(() => {
    if (!gameId) return;
    Promise.all([
      base44.entities.HitterObservation.filter(
        { game_id: gameId, is_current_batter: true }, '-updated_date', 1
      ).catch(() => []),
      base44.entities.BaserunnerObservation.filter(
        { game_id: gameId, is_on_base: true }, 'runner_name', 20
      ).catch(() => []),
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

  // Fetch TrackmanPitch rows when batter changes
  useEffect(() => {
    if (!currentBatter?.hitter_name || !currentBatter?.hitter_team) { setBatterRows([]); return; }
    let cancelled = false;
    (async () => {
      const rows = await base44.entities.TrackmanPitch
        .filter({ batter_team: currentBatter.hitter_team }, '-date', 1000)
        .catch(() => []);
      if (cancelled) return;
      const key = canonicalNameKey(currentBatter.hitter_name);
      setBatterRows((rows || []).filter(r => canonicalNameKey(r.batter_name) === key));
    })();
    return () => { cancelled = true; };
  }, [currentBatter?.hitter_name, currentBatter?.hitter_team]);

  if (!gameId) return null;

  const hand       = normHand(currentBatter?.hitter_hand);
  const handLabel  = hand === 'S' ? 'SHH' : hand ? hand + 'HB' : null;
  const stats      = computeStats(batterRows);
  const hasData    = batterRows.length > 0;

  // Runner lookup by base
  const runnerAt = (base) => runners.find(r => r.current_base === base) || null;

  return (
    <div style={{
      display:'flex', flexDirection:'column',
      height:'100%', overflow:'hidden',
      fontFamily:FONT, background:'#0c1e2d',
    }}>

      {/* ── BATTER HEADER ───────────────────────────────────────── */}
      <div style={{
        background: NAVY, borderBottom:`1px solid ${NAVY_L}`,
        flexShrink:0, display:'flex', alignItems:'stretch',
        minHeight:64,
      }}>
        {/* Identity block */}
        <div style={{ padding:'10px 20px', display:'flex', alignItems:'center', gap:12, flex:'0 0 auto' }}>
          {currentBatter ? (
            <>
              {currentBatter.jersey_number && (
                <div style={{ fontSize:32, fontWeight:900, color:GOLD, lineHeight:1, fontVariantNumeric:'tabular-nums', minWidth:52, textAlign:'center', flexShrink:0 }}>
                  #{currentBatter.jersey_number}
                </div>
              )}
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3, flexWrap:'wrap' }}>
                  <span style={{ fontSize:22, fontWeight:900, color:TEXT, letterSpacing:-0.5 }}>
                    {currentBatter.hitter_name}
                  </span>
                  {handLabel && (
                    <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:4, background:'rgba(200,146,12,0.18)', color:GOLDM }}>
                      {handLabel}
                    </span>
                  )}
                </div>
                <div style={{ fontSize:11, color:TEXTD, fontWeight:500 }}>
                  {currentBatter.hitter_team || '—'} · Batter
                </div>
              </div>
            </>
          ) : (
            <div style={{ fontSize:14, color:'rgba(255,255,255,0.3)', fontStyle:'italic' }}>Waiting for batter…</div>
          )}
        </div>

        {/* Divider */}
        <div style={{ width:1, background:NAVY_L, flexShrink:0, alignSelf:'stretch', margin:'8px 0' }} />

        {/* Stat strip */}
        <div style={{ display:'flex', alignItems:'stretch', flex:1, overflow:'hidden' }}>
          <StatPill label="Pitches"   value={stats.pitches || '—'} />
          <StatPill label="AVG"       value={fmtAvg(stats.BA)} />
          <StatPill label="SLG"       value={fmtAvg(stats.SLG)} accent={GOLD} />
          <StatPill label="Avg EV"    value={stats.avgEV ? fmtEV(stats.avgEV) : '—'} />
          <StatPill label="Max EV"    value={stats.maxEV ? Math.round(stats.maxEV)+'' : '—'} accent={stats.maxEV >= 95 ? GOOD : undefined} />
          <StatPill label="Contact%"  value={fmtPct(stats.contactPct)} />
        </div>
      </div>

      {/* ── VIZ BODY (zone + spray, 50/50) ─────────────────────── */}
      <div style={{ flex:1, display:'flex', minHeight:0, overflow:'hidden' }}>

        {/* LEFT — zone heatmap */}
        <div style={{
          flex:'0 0 50%', maxWidth:'50%',
          borderRight:`1px solid ${NAVY_L}`,
          padding:'14px 16px',
          display:'flex', flexDirection:'column',
          overflow:'hidden',
        }}>
          <SectionTitle>Damage Zones · SLG</SectionTitle>
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', minHeight:0 }}>
            {hasData ? (
              <div style={{ width:'100%', maxWidth:380 }}>
                <ZoneHeatmap rows={batterRows} viewMode="pitcher" batterHand={hand} />
              </div>
            ) : (
              <div style={{ color:TEXTF, fontSize:13, fontStyle:'italic', textAlign:'center' }}>
                {currentBatter ? 'No Trackman data for this batter' : 'No batter active'}
              </div>
            )}
          </div>
          {/* Zone legend */}
          <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:8, fontSize:9, color:TEXTF, flexShrink:0 }}>
            <span>Weak</span>
            <div style={{ display:'flex', height:6, borderRadius:2, overflow:'hidden', width:120 }}>
              {[
                'rgba(20,54,86,0.85)','rgba(23,80,65,0.80)','rgba(85,79,10,0.82)',
                'rgba(140,79,11,0.86)','rgba(153,60,29,0.90)','rgba(163,45,45,0.94)'
              ].map((c,i) => <span key={i} style={{ flex:1, background:c }} />)}
            </div>
            <span>Damage</span>
          </div>
        </div>

        {/* RIGHT — spray chart */}
        <div style={{
          flex:'0 0 50%', maxWidth:'50%',
          padding:'14px 16px',
          display:'flex', flexDirection:'column',
          overflow:'hidden',
        }}>
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

      {/* ── BASERUNNER FOOTER ───────────────────────────────────── */}
      <div style={{
        flexShrink:0,
        borderTop:`2px solid ${GOLD}`,
        background:`rgba(14,37,58,0.7)`,
        padding:'12px 16px',
      }}>
        <SectionTitle style={{ marginBottom:10 }}>
          Live Runners
          <span style={{ marginLeft:8, fontWeight:500, color:TEXTF, letterSpacing:'.5px', textTransform:'none', fontSize:9 }}>
            · set from data tent via LiveScoutingHub
          </span>
        </SectionTitle>
        <div style={{ display:'flex', gap:10 }}>
          {/* Order: 3B | 2B | 1B — matches visual left-to-right of diamond from above */}
          <BaseSlot base="3B" runner={runnerAt('3B')} />
          <BaseSlot base="2B" runner={runnerAt('2B')} />
          <BaseSlot base="1B" runner={runnerAt('1B')} />
        </div>
      </div>
    </div>
  );
}
