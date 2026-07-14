import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import * as THREE from "three";
import { isStrike as sharedIsStrike, isSwing as sharedIsSwing } from "@/lib/statsUtils";
import { base44 } from "@/api/base44Client";
import { Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { buildScene } from "@/lib/pitch3dEngine";
import { getPitchColor } from "@/lib/ds";

// ── Saints palette ────────────────────────────────────────────────────────────
const NAVY    = "#0e253a";
const NAVY_2  = "#1c3a56";
const GOLD    = "#c6b583";
const GOLD_DK = "#9a8a5c";
const CARD    = "#ffffff";
const INK     = "#0e253a";
const INK_SOFT= "#5c6b7a";
const LINE    = "#d8d2c4";
const LINE_SOFT="#e8e3d8";
const FONT    = "'Archivo','Helvetica Neue',Arial,sans-serif";

// ── Pitch colors ──────────────────────────────────────────────────────────────
const colorFor = t => getPitchColor(t);

const RESULT_COLORS = {
  "Strike":"#2fb46b","Ball":"#e0a82e","Foul":"#7aa5d8",
  "InPlay":"#e8643c","HBP":"#c77dff","Other":"#9aa5b1",
};
const colorForResult = r => RESULT_COLORS[r] || RESULT_COLORS.Other;

// ── Field accessor: works with Base44 snake_case rows ─────────────────────────
function N(r, key) {
  let v = parseFloat(r[key]);
  if (Number.isFinite(v)) return v;
  const snake = key.replace(/([A-Z])/g, m => "_" + m.toLowerCase()).replace(/^_/, "");
  v = parseFloat(r[snake]);
  if (Number.isFinite(v)) return v;
  return null;
}

function S(r, camel, snake) {
  return r[camel] || r[snake] || "";
}

// ── Pitch type resolution ─────────────────────────────────────────────────────
const TYPE_NORM = {
  "changeup":"Changeup","change up":"Changeup","ch":"Changeup",
  "four-seam":"Four-Seam","fourseam":"Four-Seam","4-seam":"Four-Seam","ff":"Four-Seam",
  "fourseamfastball":"Four-Seam","four seam fastball":"Four-Seam","four seam":"Four-Seam",
  "fastball":"Four-Seam","fb":"Four-Seam",
  "two-seam":"Sinker","twoseam":"Sinker","2-seam":"Sinker","si":"Sinker","sinker":"Sinker",
  "twoseamfastball":"Sinker","two seam fastball":"Sinker","two seam":"Sinker",
  "slider":"Slider","sl":"Slider","sweeper":"Sweeper",
  "curveball":"Curveball","cu":"Curveball","curve":"Curveball",
  "cutter":"Cutter","fc":"Cutter",
  "splitter":"Splitter","split-finger":"Splitter","fs":"Splitter",
  "knuckleball":"Knuckleball",
};
function normType(x) {
  if (!x) return "";
  return TYPE_NORM[x.trim().toLowerCase()] || x.trim();
}
function resolvePitchType(r) {
  const tag = normType(S(r, "TaggedPitchType", "tagged_pitch_type"));
  const auto = normType(S(r, "AutoPitchType", "pitch_type"));
  if (!tag || tag === "Undefined") return auto || "Undefined";
  if (tag === "Fastball") {
    if (auto === "Four-Seam" || auto === "Sinker") return auto;
    const ivb = N(r, "InducedVertBreak");
    const hb  = N(r, "HorzBreak");
    if (ivb != null && hb != null) return (ivb < 12 && Math.abs(hb) > 12) ? "Sinker" : "Four-Seam";
    return "Four-Seam";
  }
  return tag;
}

// ── Result classification ─────────────────────────────────────────────────────
function classifyResult(r) {
  const c = S(r,"PitchCall","pitch_call").toLowerCase();
  const kbb = S(r,"KorBB","kor_bb").toLowerCase();
  if (c.includes("hitbypitch")||c.includes("hbp")) return "HBP";
  if (c.includes("inplay")) return "InPlay";
  if (c.includes("foul")) return "Foul";
  if (c.includes("swinging")||c.includes("strikecalled")||c==="strike"||kbb.includes("strikeout")) return "Strike";
  if (c.includes("ball")) return "Ball";
  return "Other";
}
function prettyResult(r) {
  const call = S(r,"PitchCall","pitch_call").trim();
  const map = {
    StrikeCalled:"Called Strike",StrikeSwinging:"Swinging Strike",
    BallCalled:"Ball",BallinDirt:"Ball (dirt)",FoulBall:"Foul",
    FoulBallNotFieldable:"Foul",FoulBallFieldable:"Foul",
    InPlay:"In Play",HitByPitch:"Hit By Pitch",
  };
  let base = map[call] || call || "—";
  const pr = S(r,"PlayResult","play_result").trim();
  if (pr && pr !== "Undefined") base += " · " + pr;
  return base;
}

// ── Spin helpers ──────────────────────────────────────────────────────────────
function circularMeanDeg(degs) {
  const v = degs.filter(d => d != null);
  if (!v.length) return null;
  let sx=0,sy=0;
  for (const d of v) { const r=d*Math.PI/180; sx+=Math.cos(r); sy+=Math.sin(r); }
  return ((Math.atan2(sy/v.length,sx/v.length)*180/Math.PI)+360)%360;
}
function axisToTilt(deg) {
  if (deg==null) return null;
  let clock=((deg/30)+6)%12;
  let h=Math.floor(clock); if(h===0)h=12;
  let m=Math.round((clock-Math.floor(clock))*60);
  if(m===60){h=(h%12)+1;m=0;}
  return `${h}:${m.toString().padStart(2,"0")}`;
}

// ── Path builder from a single raw row ───────────────────────────────────────
function pathFromRow(r) {
  const sp  = N(r,"rel_speed")   ?? N(r,"RelSpeed")   ?? 88;
  const ext = N(r,"extension")   ?? N(r,"Extension");
  const ivb = N(r,"induced_vert_break") ?? N(r,"InducedVertBreak");
  const hb  = N(r,"horz_break")  ?? N(r,"HorzBreak");
  const z0  = N(r,"rel_height")  ?? N(r,"RelHeight")  ?? 6.0;
  const x0  = N(r,"rel_side")    ?? N(r,"RelSide")    ?? 0;

  const plateSide   = N(r,"plate_loc_side")   ?? N(r,"PlateLocSide");
  const plateHeight = N(r,"plate_loc_height") ?? N(r,"PlateLocHeight");

  const relY = ext != null ? 60.5 - ext : 54;

  const vy0 = -sp * 1.467;
  const ay  = 10.0;
  const dsc = vy0 * vy0 - 4 * (0.5 * ay) * relY;
  let tflight = dsc > 0 ? (-vy0 - Math.sqrt(dsc)) / ay : 0.45;
  if (!(tflight > 0 && tflight < 1.2)) tflight = 0.45;

  const ax = hb  != null ? 2 * (hb  / 12) / (tflight * tflight) : 0;
  const az = -32.174 + (ivb != null ? 2 * (ivb / 12) / (tflight * tflight) : 0);

  const targetZ = plateHeight ?? 2.5;
  const vz0 = (targetZ - z0 - 0.5 * az * tflight * tflight) / tflight;

  const targetX = plateSide ?? (x0 + (hb != null ? hb / 12 : 0));
  const vx0 = (targetX - x0 - 0.5 * ax * tflight * tflight) / tflight;

  const path = [];
  for (let i = 0; i <= 90; i++) {
    const t = (tflight * i) / 90;
    path.push({
      d: relY + vy0 * t,
      h: z0  + vz0 * t + 0.5 * az * t * t,
      s: x0  + vx0 * t + 0.5 * ax * t * t,
    });
  }
  return { path, tflight: +tflight.toFixed(3) };
}

// ── Build pitcher object from raw Base44 TrackmanPitch rows ───────────────────
function buildPitcher(rows, name) {
  const mine = rows.filter(r => (r.pitcher_name || r.Pitcher || "") === name);
  if (!mine.length) return null;

  const throws_ = (() => {
    for (const r of mine) {
      const t = r.pitcher_hand || r.PitcherThrows || "";
      if (t && t !== "Undefined") return t[0].toUpperCase();
    }
    const sides = mine.map(r => N(r,"rel_side")).filter(v=>v!=null);
    return sides.length ? ((sides.reduce((a,b)=>a+b,0)/sides.length)>=0?"R":"L") : "?";
  })();

  const mean = (rs, ...keys) => {
    for (const k of keys) {
      const v = rs.map(r=>N(r,k)).filter(x=>x!=null);
      if (v.length) return v.reduce((a,b)=>a+b,0)/v.length;
    }
    return null;
  };

  const groups = {};
  for (const r of mine) {
    const t = resolvePitchType(r);
    (groups[t] = groups[t]||[]).push(r);
  }

  const pitches = [];
  for (const [type, rs] of Object.entries(groups)) {
    const speed  = mean(rs,"rel_speed","RelSpeed");
    const spin   = mean(rs,"spin_rate","SpinRate");
    const ivb    = mean(rs,"induced_vert_break","InducedVertBreak");
    const hb     = mean(rs,"horz_break","HorzBreak");
    const ext    = mean(rs,"extension","Extension");
    const relH   = mean(rs,"rel_height","RelHeight");
    const relS   = mean(rs,"rel_side","RelSide");
    const spinAxis = circularMeanDeg(rs.map(r=>N(r,"spin_axis")).filter(v=>v!=null));

    // Average path using mean physics
    const sp_ = speed ?? 88;
    const relY_ = ext != null ? 60.5 - ext : 54;
    const vy0_ = -sp_ * 1.467, ay_ = 10.0;
    const dsc_ = vy0_ * vy0_ - 4 * (0.5 * ay_) * relY_;
    let tf = dsc_ > 0 ? (-vy0_ - Math.sqrt(dsc_)) / ay_ : 0.45;
    if (!(tf > 0 && tf < 1.2)) tf = 0.45;
    const z0_ = relH ?? 6.0, x0_ = relS ?? 0;
    const ax_ = hb != null ? 2 * (hb / 12) / (tf * tf) : 0;
    const az_ = -32.174 + (ivb != null ? 2 * (ivb / 12) / (tf * tf) : 0);
    const avgPlateH = mean(rs, "plate_loc_height", "PlateLocHeight");
    const avgPlateS = mean(rs, "plate_loc_side",   "PlateLocSide");
    const targetZ_ = avgPlateH ?? 2.5;
    const targetX_ = avgPlateS ?? (x0_ + (hb != null ? hb / 12 : 0));
    const vz0_ = (targetZ_ - z0_ - 0.5 * az_ * tf * tf) / tf;
    const vx0_ = (targetX_ - x0_ - 0.5 * ax_ * tf * tf) / tf;
    const path = [];
    for (let i = 0; i <= 90; i++) {
      const t = (tf * i) / 90;
      path.push({ d: relY_ + vy0_ * t, h: z0_ + vz0_ * t + 0.5 * az_ * t * t, s: x0_ + vx0_ * t + 0.5 * ax_ * t * t });
    }

    // AUDIT: previous inline lists omitted FoulBallFieldable and all V2 foul
    // spellings — Strike%/Whiff% here undercounted. Shared classifiers now.
    const isStrikeR = r => sharedIsStrike(r);
    const isSwingR  = r => sharedIsSwing(r);
    const tStrikes = rs.filter(isStrikeR).length;
    const tSwings  = rs.filter(isSwingR).length;
    const tWhiffs  = rs.filter(r=>(r.pitch_call||r.PitchCall||"")==="StrikeSwinging").length;
    const tEVs = rs.filter(r=>(r.pitch_call||r.PitchCall||"")==="InPlay").map(r=>N(r,"exit_speed")).filter(v=>v!=null);

    const members = rs.map((r,mi)=>{
      const mp = pathFromRow(r);
      const balls_   = N(r,"balls");
      const strikes_ = N(r,"strikes");
      return {
        idx:mi,
        pitchNo: N(r,"pitch_no"),
        speed: N(r,"rel_speed") ?? 0,
        count: (balls_!=null&&strikes_!=null)?`${balls_}-${strikes_}`:null,
        result: classifyResult(r),
        resultLabel: prettyResult(r),
        path:mp.path, tflight:mp.tflight,
      };
    });

    pitches.push({
      type, count:rs.length,
      speed:  speed!=null?+speed.toFixed(1):0,
      maxSpeed: members.length?+Math.max(...members.map(m=>m.speed)).toFixed(1):0,
      spin:   spin!=null?Math.round(spin):0,
      ivb:    ivb!=null?+ivb.toFixed(1):0,
      hb:     hb!=null?+hb.toFixed(1):0,
      spinAxis: spinAxis!=null?+spinAxis.toFixed(0):null,
      tilt:   axisToTilt(spinAxis),
      path, tflight:+tf.toFixed(3),
      usage: mine.length ? rs.length/mine.length : null,
      strikePct:rs.length?tStrikes/rs.length:null,
      whiffPct:rs.length?tWhiffs/rs.length:null,
      avgEV:tEVs.length?tEVs.reduce((a,b)=>a+b,0)/tEVs.length:null,
      members,
    });
  }
  // Remove pitch types thrown ≤5% of the time
  const totalMine = mine.length;
  const filteredPitches = pitches.filter(p => totalMine > 0 && p.count / totalMine > 0.05);
  pitches.length = 0;
  filteredPitches.forEach(p => pitches.push(p));

  pitches.sort((a,b)=>b.count-a.count);

  const seq = [...mine].sort((a,b)=>{
    const an=N(a,"pitch_no"),bn=N(b,"pitch_no");
    return (an!=null&&bn!=null)?an-bn:0;
  });
  const allPitches = seq.map((r,idx)=>{
    const {path,tflight}=pathFromRow(r);
    const balls_   = N(r,"balls");
    const strikes_ = N(r,"strikes");
    return {
      n:idx+1,
      pitchNo:N(r,"pitch_no"),
      type:resolvePitchType(r),
      speed: N(r,"rel_speed") ?? 0,
      spin:  Math.round(N(r,"spin_rate") ?? 0),
      ivb:   +((N(r,"induced_vert_break") ?? 0).toFixed(1)),
      hb:    +((N(r,"horz_break") ?? 0).toFixed(1)),
      spinAxis: N(r,"spin_axis"),
      tilt:  axisToTilt(N(r,"spin_axis")),
      count: (balls_!=null&&strikes_!=null)?`${balls_}-${strikes_}`:null,
      inning:N(r,"inning"),
      result:classifyResult(r),
      resultLabel:prettyResult(r),
      batter:(r.batter_name||"").trim()||null,
      batterSide:(r.batter_hand||"").trim()?((r.batter_hand||"").trim()[0].toUpperCase()+"HH"):null,
      pa:N(r,"pa_of_inning"),
      path,tflight,
    };
  });

  return { name, throws:throws_, total:mine.length, pitches, allPitches };
}

// ── SpinDial ──────────────────────────────────────────────────────────────────
function SpinDial({ tilt, axisDeg, color, size=58 }) {
  let ang=0;
  if(tilt&&/^\d+:\d+$/.test(tilt)){const[h,m]=tilt.split(":").map(Number);ang=((h%12)+m/60)*30;}
  else if(axisDeg!=null){ang=((axisDeg/30+6)%12)*30;}
  const r=size/2,cx=r,cy=r,len=r-9,rad=(ang-90)*Math.PI/180;
  const x2=cx+len*Math.cos(rad),y2=cy+len*Math.sin(rad);
  const ticks=[];
  for(let i=0;i<12;i++){const a=(i*30-90)*Math.PI/180,r1=r-3,r2=i%3===0?r-7:r-5;ticks.push({x1:cx+r1*Math.cos(a),y1:cy+r1*Math.sin(a),x2:cx+r2*Math.cos(a),y2:cy+r2*Math.sin(a),major:i%3===0});}
  return(
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{flexShrink:0}}>
      <circle cx={cx} cy={cy} r={r-1} fill="#fff" stroke={LINE} strokeWidth="1.5"/>
      {ticks.map((t,i)=><line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={t.major?GOLD_DK:LINE} strokeWidth={t.major?1.6:1}/>)}
      <line x1={cx} y1={cy} x2={x2} y2={y2} stroke={color} strokeWidth="2.6" strokeLinecap="round"/>
      <circle cx={cx} cy={cy} r="3" fill={color}/><circle cx={x2} cy={y2} r="2.6" fill={color}/>
    </svg>
  );
}

// ── LiveScene — uses shared pitch3dEngine (same as dugout view) ───────────────
function LiveScene({pitcher,mode,list,activeIdx,playing,tunnelMode,camAngle,visibleArr,rebuildKey,onDone,sceneApiRef}){
  const mountRef=useRef(null);const stRef=useRef(null);
  useEffect(()=>{
    const el=mountRef.current;if(!el||!pitcher)return;
    let cancelled=false;let rafId;
    rafId=requestAnimationFrame(()=>{
      if(cancelled||!mountRef.current)return;
      const st=buildScene(THREE,mountRef.current,pitcher,{mode,list});
      st.setCam('catcher');
      st.onDone=()=>onDone?.();
      if(mode!=="all"&&visibleArr)st.setVisible(visibleArr);
      st.select(activeIdx||0);
      stRef.current=st;
      if(sceneApiRef)sceneApiRef.current={zoom:d=>st.zoom(d)};
    });
    return()=>{cancelled=true;cancelAnimationFrame(rafId);stRef.current?.dispose();stRef.current=null;if(sceneApiRef)sceneApiRef.current=null;};
  },[pitcher,mode,rebuildKey]);
  useEffect(()=>{if(!tunnelMode)stRef.current?.select(activeIdx);},[activeIdx]);
  useEffect(()=>{if(mode!=="all")stRef.current?.setVisible(visibleArr);},[visibleArr,mode]);
  useEffect(()=>{const s=stRef.current;if(!s)return;if(playing){tunnelMode?s.playTunnel():s.play();}else s.stop();},[playing,tunnelMode]);
  useEffect(()=>{stRef.current?.setCam(camAngle);},[camAngle]);
  return <div ref={mountRef} style={{width:"100%",height:"100%",cursor:"grab"}}/>;
}

// ── Main component — self-fetching ────────────────────────────────────────────
// ── Trail Curation helpers ────────────────────────────────────────────────────
const TRAIL_COLORS_MAP = {
  fastball:'#E24B4A',fourseam:'#E24B4A',sinker:'#BA7517',twoseam:'#BA7517',
  cutter:'#EF9F27',slider:'#378ADD',sweeper:'#534AB7',curveball:'#1D9E75',
  knucklecurve:'#0F6E56',changeup:'#D4537E',splitter:'#993C1D',
};
function trailColorFor(type) {
  if (!type) return '#888780';
  const key = type.trim().toLowerCase().replace(/[\s_\-]/g,'');
  return TRAIL_COLORS_MAP[key] || '#888780';
}
function toLastFirst(name) {
  if (!name) return '';
  if (name.includes(',')) return name.trim();
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name.trim();
  return `${parts[parts.length-1]}, ${parts.slice(0,-1).join(' ')}`;
}
const fmt1c = v => v != null ? Number(v).toFixed(1) : '—';
const fmtIntc = v => v != null ? Math.round(v) : '—';

// ── Main ────────────────────────────────────────────────────────────────────
export default function Pitch3DTab({ pitcherName, gameId, canvasOnly }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!pitcherName) return;
    setLoading(true); setError(null);
    const filter = { pitcher_name: pitcherName };
    if (gameId) filter.game_id = gameId;
    base44.entities.TrackmanPitch.filter(filter, "-pitch_no", 500)
      .then(data => { setRows(data || []); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [pitcherName, gameId]);

  // Curated trails (set via the Trail Curation tab on the player profile) —
  // when present for this pitcher, these REPLACE the auto-computed
  // average-per-type trails below as what the 3D view actually displays.
  const [curatedTrails, setCuratedTrails] = useState([]);
  useEffect(() => {
    if (!pitcherName) { setCuratedTrails([]); return; }
    let cancelled = false;
    base44.entities.CuratedDugoutTrail
      .filter({ pitcher_name: toLastFirst(pitcherName), active: true }, 'display_order', 50)
      .then(rows => { if (!cancelled) setCuratedTrails(rows || []); })
      .catch(() => { if (!cancelled) setCuratedTrails([]); });
    return () => { cancelled = true; };
  }, [pitcherName]);

  const pitcher = useMemo(() => {
    if (!rows.length || !pitcherName) return null;
    return buildPitcher(rows, pitcherName);
  }, [rows, pitcherName]);

  // Build trail entries directly from curated rows using the same flight-path
  // physics (pathFromRow) the auto-computed trails use, so curated and
  // auto-computed trails render identically — just sourced from a hand-picked
  // example pitch instead of a season-average.
  const curatedArsenal = useMemo(() => {
    if (!curatedTrails.length) return null;
    return curatedTrails.map(t => {
      const { path, tflight } = pathFromRow(t);
      return {
        type: t.display_label || t.pitch_type,
        count: 1, usage: null, strikePct: null, whiffPct: null, avgEV: null,
        speed: t.rel_speed != null ? +parseFloat(t.rel_speed).toFixed(1) : 0,
        maxSpeed: t.rel_speed != null ? +parseFloat(t.rel_speed).toFixed(1) : 0,
        spin: t.spin_rate != null ? Math.round(parseFloat(t.spin_rate)) : 0,
        ivb: t.induced_vert_break != null ? +parseFloat(t.induced_vert_break).toFixed(1) : 0,
        hb:  t.horz_break != null ? +parseFloat(t.horz_break).toFixed(1) : 0,
        spinAxis: t.spin_axis != null ? +parseFloat(t.spin_axis).toFixed(0) : null,
        tilt: axisToTilt(t.spin_axis != null ? parseFloat(t.spin_axis) : null),
        path, tflight,
        members: [{ idx:0, pitchNo: t.source_pitch_no, speed: t.rel_speed != null ? parseFloat(t.rel_speed) : 0, count:null, result:'Other', resultLabel:'Curated', path, tflight }],
      };
    });
  }, [curatedTrails]);

  const [aIdx, setAIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState(false);

  const [hiddenSet, setHiddenSet] = useState(()=>new Set());
  const [mode, setMode] = useState("avg");
  const [pIdx2, setPIdx2] = useState(0);
  const [pickByType, setPickByType] = useState({});
  const [pickerOpenType, setPickerOpenType] = useState(null);
  const [tunnelMode, setTunnelMode] = useState(false);
  const sceneApiRef = useRef(null);

  useEffect(()=>{setAIdx(0);setPlaying(false);setDone(false);setHiddenSet(new Set());setMode("avg");setPIdx2(0);setPickByType({});setPickerOpenType(null);setTunnelMode(false);},[pitcherName]);
  const camAngle = "catcher";

  // Curated trails take priority when they exist for this pitcher;
  // otherwise fall back to the season-average arsenal as before.
  const arsenalRaw = curatedArsenal ?? (pitcher?.pitches ?? []);
  const arsenal = useMemo(()=>arsenalRaw.map(p=>{const pick=pickByType[p.type];if(pick!=null&&p.members?.[pick]){const m=p.members[pick];return{...p,path:m.path,tflight:m.tflight};}return p;}),[arsenalRaw,pickByType]);
  const allPitches = pitcher?.allPitches ?? [];
  const visibleArr = useMemo(()=>arsenal.map((_,i)=>!hiddenSet.has(i)),[arsenal.length,hiddenSet]);
  const isAll = mode==="all";
  const pitch = arsenal[Math.min(aIdx,Math.max(0,arsenal.length-1))];
  const ap = allPitches[Math.min(pIdx2,Math.max(0,allPitches.length-1))];
  const a = isAll?ap:pitch;
  const hex = a?colorFor(a.type):NAVY;
  const nShown = visibleArr.filter(Boolean).length;
  const tunnelActive = tunnelMode&&!isAll&&nShown>=2;
  const toggleTrail = i=>setHiddenSet(prev=>{const n=new Set(prev);if(n.has(i))n.delete(i);else n.add(i);return n;});
  const stepPitch = delta=>{setPIdx2(prev=>Math.min(allPitches.length-1,Math.max(0,prev+delta)));setPlaying(false);setDone(false);};

  if (loading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:400,fontFamily:FONT,color:INK_SOFT,gap:10}}>
      <div style={{width:20,height:20,border:`2px solid ${GOLD}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      Loading pitch data…
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  if (error) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:400,fontFamily:FONT,color:"#c0392b",fontSize:13}}>Error loading pitches: {error}</div>;
  if (!pitcher || !arsenal.length) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",fontFamily:FONT,color:INK_SOFT,fontSize:13}}>No Trackman data found for {pitcherName}.</div>;

  // Canvas-only mode: just the 3D viewport, no controls bar, no sidebar
  if (canvasOnly) {
    return (
      <div style={{width:"100%",height:"100%",position:"relative",background:"#0a1410"}}>
        <LiveScene
          key={pitcherName+":avg:canvas"}
          pitcher={pitcher}
          mode="avg"
          list={arsenal}
          activeIdx={Math.min(aIdx,arsenal.length-1)}
          playing={playing}
          tunnelMode={false}
          camAngle="catcher"
          visibleArr={visibleArr}
          rebuildKey={JSON.stringify(pickByType)}
          onDone={()=>{setPlaying(false);setDone(true);}}
          sceneApiRef={sceneApiRef}
        />
        <div style={{position:"absolute",bottom:8,left:"50%",transform:"translateX(-50%)",fontSize:9,color:GOLD_DK,pointerEvents:"none",background:"rgba(255,255,255,.7)",padding:"2px 8px",borderRadius:4}}>drag · scroll to zoom</div>
      </div>
    );
  }

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",fontFamily:FONT,background:"#f4f1ea",minHeight:0}}>
      {/* Controls bar */}
      <div style={{padding:"10px 16px",background:NAVY_2,borderBottom:`3px solid ${GOLD}`,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap",flexShrink:0}}>
        <div style={{marginLeft:"auto",display:"flex",gap:4}}>
          {[["+", -1],["–",1]].map(([label,dir])=>(
            <button key={label} onClick={()=>sceneApiRef.current?.zoom(dir)} style={{width:28,height:28,borderRadius:6,cursor:"pointer",fontFamily:FONT,fontSize:16,fontWeight:900,color:"#fff",border:"1px solid rgba(255,255,255,.25)",background:"rgba(14,37,58,.72)",display:"flex",alignItems:"center",justifyContent:"center"}}>{label}</button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{flex:1,display:"flex",minHeight:0,overflow:"hidden"}}>
        {/* 3D viewport */}
        <div style={{flex:1,position:"relative",background:"#0a1410",minWidth:0}}>
          <LiveScene
            key={pitcherName+":"+mode}
            pitcher={pitcher}
            mode={mode}
            list={isAll?allPitches:arsenal}
            activeIdx={isAll?Math.min(pIdx2,allPitches.length-1):Math.min(aIdx,arsenal.length-1)}
            playing={playing}
            tunnelMode={tunnelActive}
            camAngle={camAngle}
            visibleArr={visibleArr}
            rebuildKey={isAll?"all":JSON.stringify(pickByType)}
            onDone={()=>{setPlaying(false);setDone(true);}}
            sceneApiRef={sceneApiRef}
          />
          <div style={{position:"absolute",bottom:8,left:"50%",transform:"translateX(-50%)",fontSize:9,color:GOLD_DK,pointerEvents:"none",background:"rgba(255,255,255,.7)",padding:"2px 8px",borderRadius:4}}>drag · scroll / +– to zoom</div>
        </div>

        {/* Sidebar */}
        <div style={{width:310,background:CARD,borderLeft:`1px solid ${LINE}`,display:"flex",flexDirection:"column",flexShrink:0,overflow:"hidden"}}>
          {a&&(
            <div style={{padding:"12px 14px 10px",borderBottom:`1px solid ${LINE_SOFT}`,flexShrink:0}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <span style={{width:11,height:11,borderRadius:"50%",background:hex,flexShrink:0,boxShadow:`0 0 0 3px ${hex}22`}}/>
                <span style={{fontSize:15,fontWeight:900,color:INK}}>{a.type}</span>
                <span style={{marginLeft:"auto",fontSize:9,color:GOLD_DK,fontWeight:700}}>{isAll?`#${a.n} of ${allPitches.length}`:`×${a.count}`}</span>
              </div>
              {isAll&&(
                <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
                  {a.count&&<span style={{fontSize:10,fontWeight:800,color:NAVY,background:LINE_SOFT,borderRadius:4,padding:"2px 6px"}}>{a.count}</span>}
                  {a.inning!=null&&<span style={{fontSize:9,color:INK_SOFT,background:"#f4f4f2",borderRadius:4,padding:"2px 6px"}}>Inn {a.inning}</span>}
                  <span style={{fontSize:9,fontWeight:700,color:"#fff",background:colorForResult(a.result),borderRadius:4,padding:"2px 6px"}}>{a.resultLabel}</span>
                  {a.batterSide&&<span style={{fontSize:9,color:INK_SOFT,background:"#f4f4f2",borderRadius:4,padding:"2px 6px"}}>vs {a.batterSide}</span>}
                </div>
              )}
              <button onClick={()=>{if(playing)setPlaying(false);else{setDone(false);setPlaying(true);}}} style={{width:"100%",padding:"10px 0",borderRadius:8,cursor:"pointer",marginBottom:10,fontFamily:FONT,fontSize:12,fontWeight:800,letterSpacing:1,color:"#fff",border:"none",background:playing?"#c0392b":tunnelActive?NAVY:done?GOLD_DK:hex,boxShadow:`0 2px 8px ${(playing?"#c0392b":tunnelActive?NAVY:hex)}40`}}>
                {playing?"⏹  STOP":tunnelActive?`▶  THROW ${nShown} PITCHES`:done?"↺  REPLAY":"▶  THROW PITCH"}
              </button>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <div style={{flex:1,display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
                  {[["VELO",`${a.speed}`,"mph"],["SPIN",`${a.spin}`,"rpm"],["IVB",`${a.ivb>0?"+":""}${(a.ivb??0).toFixed(1)}`,"in"],["HB",`${a.hb>0?"+":""}${(a.hb??0).toFixed(1)}`,"in"]].map(([k,v,u])=>(
                    <div key={k} style={{background:"#f7f6f2",borderRadius:6,padding:"5px 7px"}}>
                      <div style={{fontSize:7.5,color:GOLD_DK,fontWeight:800,letterSpacing:0.8}}>{k}</div>
                      <div style={{fontSize:14,fontWeight:900,color:INK,lineHeight:1.1}}>{v}<span style={{fontSize:7.5,color:INK_SOFT,fontWeight:600,marginLeft:2}}>{u}</span></div>
                    </div>
                  ))}
                </div>
                {(a.tilt||a.spinAxis!=null)&&(
                  <div style={{textAlign:"center"}}>
                    <SpinDial tilt={a.tilt} axisDeg={a.spinAxis} color={hex} size={54}/>
                    <div style={{fontSize:11,fontWeight:900,color:INK,marginTop:2}}>{a.tilt||"—"}</div>
                    <div style={{fontSize:7.5,color:GOLD_DK,fontWeight:700,letterSpacing:0.5}}>TILT</div>
                  </div>
                )}
              </div>
            </div>
          )}
          {isAll&&(
            <div style={{padding:"8px 12px",borderBottom:`1px solid ${LINE_SOFT}`,flexShrink:0,background:"#fbfaf7"}}>
              <div style={{display:"flex",gap:5,marginBottom:6}}>
                <button onClick={()=>stepPitch(-1)} disabled={pIdx2<=0} style={{flex:1,padding:"7px 0",borderRadius:6,cursor:pIdx2<=0?"not-allowed":"pointer",fontFamily:FONT,fontSize:11,fontWeight:800,border:`1px solid ${LINE}`,background:pIdx2<=0?"#f0f0ee":"#fff",color:pIdx2<=0?"#bbb":NAVY}}>‹ Prev</button>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minWidth:56}}>
                  <span style={{fontSize:12,fontWeight:900,color:INK}}>{pIdx2+1}</span>
                  <span style={{fontSize:7.5,color:INK_SOFT}}>of {allPitches.length}</span>
                </div>
                <button onClick={()=>stepPitch(1)} disabled={pIdx2>=allPitches.length-1} style={{flex:1,padding:"7px 0",borderRadius:6,cursor:pIdx2>=allPitches.length-1?"not-allowed":"pointer",fontFamily:FONT,fontSize:11,fontWeight:800,border:`1px solid ${LINE}`,background:pIdx2>=allPitches.length-1?"#f0f0ee":"#fff",color:pIdx2>=allPitches.length-1?"#bbb":NAVY}}>Next ›</button>
              </div>
              <input type="range" min={0} max={Math.max(0,allPitches.length-1)} value={pIdx2} onChange={e=>{setPIdx2(+e.target.value);setPlaying(false);setDone(false);}} style={{width:"100%",accentColor:hex,cursor:"pointer",display:"block"}}/>
            </div>
          )}
          <div style={{flex:1,overflowY:"auto",padding:12}}>
            {!isAll?(
              <>
                <button onClick={()=>{setTunnelMode(t=>!t);setPlaying(false);setDone(false);}} style={{width:"100%",padding:"7px 9px",marginBottom:10,borderRadius:7,cursor:"pointer",fontFamily:FONT,fontSize:10,fontWeight:800,textAlign:"left",border:`1px solid ${tunnelMode?NAVY:LINE}`,background:tunnelMode?NAVY:"#fff",color:tunnelMode?"#fff":INK,display:"flex",alignItems:"center",gap:7}}>
                  <span style={{width:14,height:14,borderRadius:3,flexShrink:0,fontSize:9,fontWeight:900,border:`2px solid ${tunnelMode?GOLD:LINE}`,background:tunnelMode?GOLD:"transparent",display:"flex",alignItems:"center",justifyContent:"center",color:NAVY}}>{tunnelMode?"✓":""}</span>
                  Tunnel mode
                  <span style={{marginLeft:"auto",fontSize:8,color:tunnelMode?GOLD:INK_SOFT,fontWeight:600}}>{tunnelMode?`${nShown} checked`:"off"}</span>
                </button>
                <div style={{fontSize:9,color:GOLD_DK,letterSpacing:1.5,textTransform:"uppercase",fontWeight:800,marginBottom:7}}>Arsenal · {arsenal.length}</div>
                {arsenal.map((p,i)=>{
                  const c=colorFor(p.type);const active=Math.min(aIdx,arsenal.length-1)===i;const shown=!hiddenSet.has(i);const picked=pickByType[p.type]!=null;
                  return(
                    <div key={i} style={{marginBottom:5,borderRadius:7,overflow:"hidden",border:`1px solid ${active?c:LINE}`,background:active?"#fff":"#fafafa",boxShadow:active?`0 1px 5px ${c}22`:"none"}}>
                      <div style={{display:"flex",alignItems:"stretch"}}>
                        <button onClick={()=>toggleTrail(i)} style={{flexShrink:0,width:28,border:"none",cursor:"pointer",background:shown?c:"#eee",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:10,fontWeight:900}}>{shown?"✓":""}</button>
                        <button onClick={()=>{setAIdx(i);setPlaying(false);setDone(false);}} style={{flex:1,textAlign:"left",padding:"6px 9px",border:"none",cursor:"pointer",background:"transparent",fontFamily:FONT,color:active?INK:INK_SOFT}}>
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                            <span style={{display:"flex",alignItems:"center",gap:6}}><span style={{width:7,height:7,borderRadius:"50%",background:c,flexShrink:0}}/><span style={{fontWeight:800,fontSize:11}}>{p.type}</span></span>
                            <span style={{fontSize:10,fontWeight:700,color:active?INK:INK_SOFT}}>{p.speed}<span style={{fontSize:7.5,color:INK_SOFT,marginLeft:1}}>mph</span>{/fast|four|two|sink/i.test(p.type)&&p.maxSpeed>0&&<span style={{marginLeft:3,color:GOLD_DK}}>T{p.maxSpeed}</span>}</span>
                          </div>
                        </button>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,borderTop:`1px solid ${LINE_SOFT}`,background:LINE_SOFT}}>
                        {[["Usage",p.usage==null?"—":`${Math.round(p.usage*100)}%`],["Strike%",p.strikePct==null?"—":`${Math.round(p.strikePct*100)}%`],["Whiff%",p.whiffPct==null?"—":`${Math.round(p.whiffPct*100)}%`],["Avg EV",p.avgEV==null?"—":`${p.avgEV.toFixed(0)}`]].map(([k,v])=>(
                          <div key={k} style={{background:active?"#fff":"#fafafa",textAlign:"center",padding:"4px 2px"}}>
                            <div style={{fontSize:11,fontWeight:900,color:INK,lineHeight:1}}>{v}</div>
                            <div style={{fontSize:7,fontWeight:800,color:GOLD_DK,letterSpacing:0.3,marginTop:2}}>{k}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{borderTop:`1px solid ${LINE_SOFT}`,padding:"4px 6px",background:"#fbfaf7"}}>
                        <button onClick={()=>setPickerOpenType(pickerOpenType===p.type?null:p.type)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"3px 5px",borderRadius:4,cursor:"pointer",fontFamily:FONT,fontSize:8.5,fontWeight:700,border:`1px solid ${picked?c:LINE}`,background:picked?`${c}14`:"#fff",color:picked?INK:INK_SOFT}}>
                          <span>{picked?`Pitch #${p.members[pickByType[p.type]]?.pitchNo??(pickByType[p.type]+1)}`:"Trajectory: averaged"}</span>
                          <span style={{fontSize:7}}>{pickerOpenType===p.type?"▲":"▼"}</span>
                        </button>
                        {pickerOpenType===p.type&&(
                          <div style={{marginTop:4,maxHeight:130,overflowY:"auto",display:"flex",flexDirection:"column",gap:2}}>
                            <button onClick={()=>{setPickByType(prev=>{const n={...prev};delete n[p.type];return n;});setPlaying(false);setDone(false);}} style={{textAlign:"left",padding:"4px 6px",borderRadius:4,cursor:"pointer",fontFamily:FONT,fontSize:9,fontWeight:700,border:`1px solid ${!picked?c:LINE}`,background:!picked?`${c}14`:"#fff",color:INK}}>Averaged path (default)</button>
                            {p.members?.map(m=>{const on=pickByType[p.type]===m.idx;return(<button key={m.idx} onClick={()=>{setPickByType(prev=>({...prev,[p.type]:m.idx}));setPlaying(false);setDone(false);}} style={{display:"flex",alignItems:"center",gap:5,padding:"4px 6px",borderRadius:4,cursor:"pointer",fontFamily:FONT,fontSize:9,textAlign:"left",border:`1px solid ${on?c:LINE}`,background:on?`${c}14`:"#fff",color:INK_SOFT}}><span style={{width:5,height:5,borderRadius:"50%",background:colorForResult(m.result),flexShrink:0}}/><span style={{fontWeight:700,color:INK}}>{m.speed}</span><span>mph</span>{m.count&&<span style={{color:GOLD_DK}}>{m.count}</span>}<span style={{marginLeft:"auto",fontSize:7.5,color:INK_SOFT}}>{m.result==="InPlay"?"IP":m.result?.slice(0,4)}</span></button>);})}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            ):(
              <>
                <div style={{fontSize:9,color:GOLD_DK,letterSpacing:1.5,textTransform:"uppercase",fontWeight:800,marginBottom:7}}>Pitches by at-bat</div>
                {(()=>{const groups=[];let cur=null;allPitches.forEach((p,i)=>{const key=`${p.inning}|${p.pa}|${p.batter}`;if(!cur||cur.key!==key){cur={key,batter:p.batter,inning:p.inning,side:p.batterSide,pitches:[]};groups.push(cur);}cur.pitches.push({p,i});});return groups.map(g=>(
                  <div key={g.key} style={{marginBottom:5}}>
                    <div style={{display:"flex",alignItems:"center",gap:5,padding:"4px 7px",marginBottom:2,background:"#eef1f4",borderRadius:5,borderLeft:`3px solid ${NAVY}`}}>
                      <span style={{fontSize:10,fontWeight:800,color:NAVY,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{g.batter||"Unknown"}</span>
                      {g.side&&<span style={{fontSize:8,color:INK_SOFT,fontWeight:700}}>{g.side}</span>}
                      {g.inning!=null&&<span style={{fontSize:8,color:GOLD_DK,fontWeight:700}}>Inn {g.inning}</span>}
                    </div>
                    {g.pitches.map(({p,i})=>{const active=i===Math.min(pIdx2,allPitches.length-1);const tc=colorFor(p.type);const rc=colorForResult(p.result);return(<button key={i} onClick={()=>{setPIdx2(i);setPlaying(false);setDone(false);}} style={{width:"100%",textAlign:"left",padding:"5px 8px",marginBottom:2,display:"flex",alignItems:"center",gap:7,background:active?"#fff":"#fafafa",border:`1px solid ${active?tc:LINE}`,boxShadow:active?`inset 3px 0 0 ${tc}`:"none",borderRadius:6,cursor:"pointer",fontFamily:FONT,color:active?INK:INK_SOFT}}><span style={{fontSize:8.5,color:GOLD_DK,fontWeight:700,minWidth:14,flexShrink:0}}>{p.n}</span><span style={{width:7,height:7,borderRadius:"50%",background:tc,flexShrink:0}}/><span style={{fontSize:10,fontWeight:700,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.type} <span style={{fontWeight:400,color:INK_SOFT}}>{p.speed}</span></span>{p.count&&<span style={{fontSize:8.5,color:GOLD_DK,fontWeight:700,flexShrink:0}}>{p.count}</span>}<span style={{fontSize:7.5,fontWeight:700,color:"#fff",background:rc,borderRadius:3,padding:"2px 5px",flexShrink:0}}>{p.result==="InPlay"?"IP":p.result?.slice(0,4)}</span></button>);})}
                  </div>
                ));})()}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}