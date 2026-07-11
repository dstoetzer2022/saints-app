import React, { useState, useMemo } from 'react';
import { isSwing, isWhiff, isValidBattedBall, sprayDistribution } from '@/lib/statsUtils';

const FONT = "\'Archivo\', system-ui, sans-serif";
const NAVY = '#0e253a';
const GOLD = '#c6b583';

const SIL_RHB = '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';
const SIL_LHB = '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';

const HIT_RESULTS = ['Single','Double','Triple','HomeRun'];

// ── Shared blue → white → red diverging color scale ─────────────────────────
function lerp(a,b,t) { return a + (b - a) * t; }
export function colorAt(t) {
  t = Math.max(0, Math.min(1, t));
  if (t <= 0.5) {
    const k = t / 0.5;
    return [lerp(47,242,k), lerp(99,242,k), lerp(166,242,k)];
  }
  const k = (t - 0.5) / 0.5;
  return [lerp(242,200,k), lerp(242,40,k), lerp(242,44,k)];
}
export function rgba(t, alpha) {
  const [r,g,b] = colorAt(t);
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${alpha.toFixed(2)})`;
}

// ============================================================================
// ZONE HEATMAP — back to the original, verified 3x3 + 4-shadow-zone geometry
// (the same getZone/zoneRows/inCellRect/shadowPoints logic that was correct
// before the continuous KDE raster was introduced). Each of the 13 regions
// shows its own pitch count, so the color can be checked against raw data
// directly instead of trusting an opaque continuous field.
// ============================================================================
const SZ   = { LEFT:-0.83, RIGHT:0.83, BOT:1.50, TOP:3.50 };         // rulebook zone
const BAND = 0.40;
const OUTB = { LEFT:SZ.LEFT-BAND, RIGHT:SZ.RIGHT+BAND, BOT:SZ.BOT-BAND, TOP:SZ.TOP+BAND };
const EXT  = { LEFT:-2.3, RIGHT:2.3, BOT:-0.4, TOP:4.9 };            // wider canvas field

// Canvas: 480x540, 130px side margins for the silhouette
const ZV = { W:480, H:540, plotX:100, plotY:140, plotW:280, plotH:260 };

function mapX(s, mirror) { const t=(s-EXT.LEFT)/(EXT.RIGHT-EXT.LEFT); return ZV.plotX+(mirror?1-t:t)*ZV.plotW; }
function mapY(h) { const t=(h-EXT.BOT)/(EXT.TOP-EXT.BOT); return ZV.plotY+(1-t)*ZV.plotH; }
function plateRect(x0,x1,y0,y1,mirror) {
  const sx0=mapX(x0,mirror), sx1=mapX(x1,mirror), sy0=mapY(y0), sy1=mapY(y1);
  return { x:Math.min(sx0,sx1), y:Math.min(sy0,sy1), w:Math.abs(sx1-sx0), h:Math.abs(sy1-sy0) };
}

function getZone(side, height) {
  const s=parseFloat(side), h=parseFloat(height);
  if (!isFinite(s)||!isFinite(h)) return null;
  if (s<OUTB.LEFT||s>OUTB.RIGHT||h<OUTB.BOT||h>OUTB.TOP) return null;
  const inX=s>=SZ.LEFT&&s<=SZ.RIGHT, inY=h>=SZ.BOT&&h<=SZ.TOP;
  if (inX&&inY) {
    const COL=(SZ.RIGHT-SZ.LEFT)/3, ROW=(SZ.TOP-SZ.BOT)/3;
    const col=s<(SZ.LEFT+COL)?0:s<(SZ.LEFT+2*COL)?1:2;
    const row=h<(SZ.BOT+ROW)?0:h<(SZ.BOT+2*ROW)?1:2;
    return row*3+col+1;
  }
  const left=s<(SZ.LEFT+SZ.RIGHT)/2, bot=h<(SZ.BOT+SZ.TOP)/2;
  if (left&&!bot) return 11;
  if (!left&&!bot) return 12;
  if (left&&bot) return 13;
  return 14;
}
function zoneRows(rows, zone) { return rows.filter(r=>getZone(r.plate_loc_side,r.plate_loc_height)===zone); }

function inCellRect(z, mirror) {
  const COL=(SZ.RIGHT-SZ.LEFT)/3, ROW=(SZ.TOP-SZ.BOT)/3;
  const col=(z-1)%3, rowFromBot=Math.floor((z-1)/3);
  return plateRect(SZ.LEFT+col*COL, SZ.LEFT+(col+1)*COL, SZ.BOT+rowFromBot*ROW, SZ.BOT+(rowFromBot+1)*ROW, mirror);
}

// L-shaped shadow corners — touching the core grid directly (no gap), so the
// whole 13-region shape reads as ONE cohesive zone instead of separate
// floating cards. This is the original geometry: each shadow zone is the
// outer band quadrant with the overlapping core-zone corner subtracted out.
function shadowPoints(zone, mirror) {
  const midX=(SZ.LEFT+SZ.RIGHT)/2, midY=(SZ.BOT+SZ.TOP)/2;
  let qx0,qx1,qy0,qy1;
  if(zone===11){qx0=OUTB.LEFT;qx1=midX;qy0=midY;qy1=OUTB.TOP;}
  if(zone===12){qx0=midX;qx1=OUTB.RIGHT;qy0=midY;qy1=OUTB.TOP;}
  if(zone===13){qx0=OUTB.LEFT;qx1=midX;qy0=OUTB.BOT;qy1=midY;}
  if(zone===14){qx0=midX;qx1=OUTB.RIGHT;qy0=OUTB.BOT;qy1=midY;}
  const ix0=Math.max(qx0,SZ.LEFT),ix1=Math.min(qx1,SZ.RIGHT);
  const iy0=Math.max(qy0,SZ.BOT),iy1=Math.min(qy1,SZ.TOP);
  const q=plateRect(qx0,qx1,qy0,qy1,mirror);
  const bite=plateRect(ix0,ix1,iy0,iy1,mirror);
  const qX0=q.x,qX1=q.x+q.w,qY0=q.y,qY1=q.y+q.h;
  const bX0=bite.x,bX1=bite.x+bite.w,bY0=bite.y,bY1=bite.y+bite.h;
  const biteLeft=Math.abs(bX0-qX0)<Math.abs(bX1-qX1);
  const biteTop=Math.abs(bY0-qY0)<Math.abs(bY1-qY1);
  let pts;
  if(biteLeft&&biteTop)       pts=[[qX0,bY1],[bX1,bY1],[bX1,qY0],[qX1,qY0],[qX1,qY1],[qX0,qY1]];
  else if(!biteLeft&&biteTop) pts=[[qX0,qY0],[bX0,qY0],[bX0,bY1],[qX1,bY1],[qX1,qY1],[qX0,qY1]];
  else if(biteLeft&&!biteTop) pts=[[qX0,qY0],[qX1,qY0],[qX1,qY1],[bX1,qY1],[bX1,bY0],[qX0,bY0]];
  else                        pts=[[qX0,qY0],[qX1,qY0],[qX1,bY0],[bX0,bY0],[bX0,qY1],[qX0,qY1]];
  const lx=biteLeft?qX1-18:qX0+18, ly=biteTop?qY1-13:qY0+15;
  return { path:'M '+pts.map(p=>p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' L ')+' Z', lx, ly };
}

// Simple per-region aggregation — no spatial kernel, no smoothing math.
// Every number here can be hand-checked against raw TrackmanPitch rows.
function zoneDamageStats(rows) {
  let swings=0, contacts=0, bip=0, evSum=0;
  for (const r of rows) {
    if (isSwing(r)) { swings++; if (!isWhiff(r)) contacts++; }
    if (r.pitch_call==='InPlay') {
      const ev=parseFloat(r.exit_speed);
      if (isFinite(ev)&&ev>30) { bip++; evSum+=ev; }
    }
  }
  return { n: rows.length, swings, contacts, bip, evSum };
}

const ALL_ZONES = [1,2,3,4,5,6,7,8,9,11,12,13,14];
const K_CONTACT = 6;  // pseudo-swings of shrinkage strength toward this batter's overall rate
const K_EV      = 4;  // pseudo-batted-balls of shrinkage strength
const LOW_SAMPLE_N = 3; // zones with fewer pitches than this get hatched as "thin sample"
const ZONE_LIFT = 16; // px the strike zone group is nudged up, off the plate tip

export function ZoneHeatmap({ rows, viewMode='pitcher', batterHand='' }) {
  const mirror = viewMode === 'pitcher';

  // Global rates (this batter, all pitches) used as the shrinkage prior
  let totalSwings=0, totalContacts=0, totalBip=0, totalEvSum=0;
  for (const r of rows) {
    if (isSwing(r)) { totalSwings++; if (!isWhiff(r)) totalContacts++; }
    if (r.pitch_call==='InPlay') {
      const ev=parseFloat(r.exit_speed);
      if (isFinite(ev)&&ev>30) { totalBip++; totalEvSum+=ev; }
    }
  }
  const globalContactRate = totalSwings>0 ? totalContacts/totalSwings : 0.65;
  const globalAvgEV       = totalBip>0    ? totalEvSum/totalBip      : 82;

  const zoneData = ALL_ZONES.map(z => {
    const zr = zoneRows(rows, z);
    const st = zoneDamageStats(zr);
    const contactRate = (st.contacts + K_CONTACT*globalContactRate) / (st.swings + K_CONTACT);
    const avgEV        = (st.evSum    + K_EV*globalAvgEV)            / (st.bip    + K_EV);
    const evNorm        = Math.max(0, Math.min(1, (avgEV-65)/35));
    const score          = 0.5*contactRate + 0.5*evNorm;
    return { z, st, score };
  });

  const maxN = Math.max(1, ...zoneData.map(zd => zd.st.n));
  const withData = zoneData.filter(zd => zd.st.n > 0);
  const pool = withData.length >= 2 ? withData : zoneData;
  let minS=Infinity, maxS=-Infinity;
  for (const zd of pool) { if (zd.score<minS) minS=zd.score; if (zd.score>maxS) maxS=zd.score; }
  const range = (maxS-minS) || 1;

  // Cells touch directly (no gaps, no per-cell rounding) so the whole 13-region
  // shape reads as one cohesive strike zone rather than scattered cards.
  const cells = [];
  const labelTexts = [];
  for (const zd of zoneData) {
    const { z, st, score } = zd;
    const t = Math.max(0, Math.min(1, (score-minS)/range));
    const coverage = st.n / maxN;
    const alpha = st.n === 0 ? 0.08 : Math.max(0.35, Math.min(0.92, 0.30 + 0.62*coverage));
    const fill = rgba(t, alpha);
    const isShadow = z >= 11;
    const lowSample = st.n > 0 && st.n < LOW_SAMPLE_N;

    if (isShadow) {
      const sp = shadowPoints(z, mirror);
      cells.push(<path key={'z'+z} d={sp.path} fill={fill} stroke="rgba(36,68,95,0.6)" strokeWidth={0.75} />);
      if (lowSample) cells.push(<path key={'zh'+z} d={sp.path} fill="url(#lowSampleHatch)" stroke="none" />);
      labelTexts.push(<text key={'zt'+z} x={sp.lx} y={sp.ly} textAnchor="middle" fontSize={9} fill="rgba(12,30,48,0.92)" stroke="rgba(232,238,245,0.6)" strokeWidth={2.2} paintOrder="stroke" fontFamily={FONT} fontWeight={800}>{st.n}p</text>);
    } else {
      const r = inCellRect(z, mirror);
      cells.push(<rect key={'z'+z} x={r.x} y={r.y} width={r.w} height={r.h} fill={fill} stroke="rgba(36,68,95,0.95)" strokeWidth={1} />);
      if (lowSample) cells.push(<rect key={'zh'+z} x={r.x} y={r.y} width={r.w} height={r.h} fill="url(#lowSampleHatch)" stroke="none" />);
      const cx=r.x+r.w/2, cy=r.y+r.h/2;
      labelTexts.push(<text key={'zt'+z} x={cx} y={cy} textAnchor="middle" fontSize={11} fill="rgba(12,30,48,0.92)" stroke="rgba(232,238,245,0.6)" strokeWidth={2.4} paintOrder="stroke" fontFamily={FONT} fontWeight={800}>{st.n}p</text>);
    }
  }

  const szb  = plateRect(SZ.LEFT, SZ.RIGHT, SZ.BOT, SZ.TOP, mirror);
  const pcx  = szb.x + szb.w/2;
  const ptop = szb.y + szb.h + 18;
  const pw = szb.w*0.55, ph = pw/2, plH = pw*0.55;

  const plateD = mirror
    ? `M ${pcx.toFixed(1)},${ptop.toFixed(1)} L ${(pcx+ph).toFixed(1)},${(ptop+plH*0.45).toFixed(1)} L ${(pcx+ph).toFixed(1)},${(ptop+plH).toFixed(1)} L ${(pcx-ph).toFixed(1)},${(ptop+plH).toFixed(1)} L ${(pcx-ph).toFixed(1)},${(ptop+plH*0.45).toFixed(1)} Z`
    : `M ${(pcx-ph).toFixed(1)},${ptop.toFixed(1)} L ${(pcx+ph).toFixed(1)},${ptop.toFixed(1)} L ${(pcx+ph).toFixed(1)},${(ptop+plH*0.55).toFixed(1)} L ${pcx.toFixed(1)},${(ptop+plH).toFixed(1)} L ${(pcx-ph).toFixed(1)},${(ptop+plH*0.55).toFixed(1)} Z`;

  const silW = 130, silH = Math.round(silW*500/213);
  const silY = ptop + plH + 4 - silH;
  const rhbX = mirror ? (ZV.W - silW) : 0;
  const lhbX = mirror ? 0 : (ZV.W - silW);

  const silhouette = batterHand && batterHand !== 'S' ? (
    batterHand === 'R'
      ? <image href={`data:image/png;base64,${SIL_RHB}`} x={rhbX} y={silY} width={silW} height={silH} preserveAspectRatio="xMidYMax meet" />
      : <image href={`data:image/png;base64,${SIL_LHB}`} x={lhbX} y={silY} width={silW} height={silH} preserveAspectRatio="xMidYMax meet" />
  ) : null;

  const viewLabel  = mirror ? "PITCHER\'S VIEW" : "CATCHER\'S VIEW";
  const leftLabel  = mirror ? '1B SIDE' : '3B SIDE';
  const rightLabel = mirror ? '3B SIDE' : '1B SIDE';

  return (
    <svg width="100%" viewBox={`0 0 ${ZV.W} ${ZV.H}`} style={{ display:'block' }} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="lowSampleHatch" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="7" stroke="rgba(232,238,245,0.4)" strokeWidth="2.5" />
        </pattern>
      </defs>
      {silhouette}
      {/* Strike zone group lifted slightly off the plate — plate/silhouette
          positions are computed from the original (unshifted) szb, so only
          the zone itself moves up, widening the gap to the plate tip. */}
      <g transform={`translate(0,-${ZONE_LIFT})`}>
        {cells}
        {labelTexts}
        <rect x={szb.x} y={szb.y} width={szb.w} height={szb.h} fill="none" stroke="rgba(232,238,245,0.85)" strokeWidth={2} />
        <text x={pcx} y={ZV.plotY-22} textAnchor="middle" fontSize={10} fill="rgba(198,181,131,0.75)" fontFamily={FONT} fontWeight={700} letterSpacing={1}>{viewLabel}</text>
        <text x={ZV.plotX+6} y={szb.y+szb.h/2} textAnchor="start" fontSize={8} fill="rgba(232,238,245,0.5)" fontFamily={FONT} fontWeight={600}>{leftLabel}</text>
        <text x={ZV.plotX+ZV.plotW-6} y={szb.y+szb.h/2} textAnchor="end" fontSize={8} fill="rgba(232,238,245,0.5)" fontFamily={FONT} fontWeight={600}>{rightLabel}</text>
      </g>
      <path d={plateD} fill="rgba(232,238,245,0.1)" stroke="rgba(232,238,245,0.55)" strokeWidth={1.2} strokeLinejoin="round" />
      {rows.length===0 && (
        <text x={ZV.W/2} y={ZV.H/2} textAnchor="middle" fontSize={12} fill="rgba(159,178,196,0.4)" fontFamily={FONT} fontStyle="italic">No pitch location data</text>
      )}
    </svg>
  );
}

// ============================================================================
// SPRAY CHART — unchanged from the prior working version
// ============================================================================
const RESULT_COLORS = { HomeRun:'#E24B4A', Triple:'#EF9F27', Double:'#c6b583', Single:'#2dba5a', Out:'#5f7488', Error:'#9fb2c4' };
function resultColor(pr) { return RESULT_COLORS[pr] || '#5f7488'; }
function isHit(pr) { return HIT_RESULTS.includes(pr); }
function evRadius(ev) { const e=parseFloat(ev); if(!isFinite(e)) return 4; return Math.max(3.5,Math.min(8,3.5+(e-60)/11)); }
function wedgeFillColor(pct, maxPct) {
  const t = maxPct > 0 ? Math.min(1, pct/maxPct) : 0;
  return rgba(t, 0.18 + t*0.62);
}

export function SprayChart({ rows, hand, dugout=false }) {
  const [mode,   setMode]   = useState('dots');
  const [filter, setFilter] = useState('all');
  const activeMode   = dugout ? 'mixed' : mode;
  const activeFilter = dugout ? 'all'   : filter;
  const dist    = useMemo(() => sprayDistribution(rows, hand), [rows, hand]);

  const W=440, H=370, homeX=W/2, homeY=H-28, MAXD=420, scale=(H-65)/MAXD;
  const flRad = 45*Math.PI/180;
  const hasHand = !!hand && dist.total > 0;

  const arc = d => {
    const r=d*scale;
    const x0=homeX-Math.sin(flRad)*r, y0=homeY-Math.cos(flRad)*r;
    const x1=homeX+Math.sin(flRad)*r, y1=homeY-Math.cos(flRad)*r;
    return <path key={'a'+d} d={`M${x0.toFixed(1)} ${y0.toFixed(1)} A${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`} fill="none" stroke="rgba(36,68,95,0.65)" strokeWidth={1} strokeDasharray="2 3" />;
  };
  const foul = (<>
    <line x1={homeX} y1={homeY} x2={homeX-Math.sin(flRad)*MAXD*scale} y2={homeY-Math.cos(flRad)*MAXD*scale} stroke="rgba(159,178,196,0.3)" strokeWidth={1.2} />
    <line x1={homeX} y1={homeY} x2={homeX+Math.sin(flRad)*MAXD*scale} y2={homeY-Math.cos(flRad)*MAXD*scale} stroke="rgba(159,178,196,0.3)" strokeWidth={1.2} />
  </>);
  const infD = 95*scale;
  const infield = <path d={`M${homeX} ${homeY} L${homeX+infD} ${homeY-infD} L${homeX} ${homeY-infD*1.414} L${homeX-infD} ${homeY-infD} Z`} fill="rgba(198,181,131,0.04)" stroke="rgba(36,68,95,0.55)" strokeWidth={1} />;
  const lfx = homeX-Math.sin(flRad)*MAXD*scale, rfx = homeX+Math.sin(flRad)*MAXD*scale;
  const sideLabels = (<>
    <text x={lfx+9} y={homeY-10} fontSize={9} fill="rgba(159,178,196,0.5)" fontFamily={FONT}>LF</text>
    <text x={rfx-15} y={homeY-10} fontSize={9} fill="rgba(159,178,196,0.5)" fontFamily={FONT}>RF</text>
  </>);

  const wedgeD = (b0,b1) => {
    const r=MAXD*scale, r0=b0*Math.PI/180, r1=b1*Math.PI/180;
    return `M${homeX} ${homeY} L${(homeX+Math.sin(r0)*r).toFixed(1)} ${(homeY-Math.cos(r0)*r).toFixed(1)} A${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${(homeX+Math.sin(r1)*r).toFixed(1)} ${(homeY-Math.cos(r1)*r).toFixed(1)} Z`;
  };
  const lblPos = (bDeg, frac=0.52) => {
    const lblR = MAXD*scale*frac;
    return { x:homeX+Math.sin(bDeg*Math.PI/180)*lblR, y:homeY-Math.cos(bDeg*Math.PI/180)*lblR };
  };

  let body;

  if (activeMode === 'mixed' && hasHand) {
    const maxPct = Math.max(dist.pullPct, dist.midPct, dist.oppoPct, 0.001);
    const lfIsPull = hand === 'R';
    const lfData = lfIsPull ? {label:'PULL',pct:dist.pullPct,n:dist.pull} : {label:'OPPO',pct:dist.oppoPct,n:dist.oppo};
    const rfData = lfIsPull ? {label:'OPPO',pct:dist.oppoPct,n:dist.oppo} : {label:'PULL',pct:dist.pullPct,n:dist.pull};
    const midData = {label:'MID',pct:dist.midPct,n:dist.middle};

    const wLbl = (d,bDeg) => d.n>0 ? (<g key={d.label}>
      <text x={lblPos(bDeg).x.toFixed(1)} y={lblPos(bDeg).y.toFixed(1)} textAnchor="middle" fontSize={15} fontWeight={800} fill="#e8eef5" fontFamily={FONT}>{Math.round(d.pct*100)}%</text>
      <text x={lblPos(bDeg).x.toFixed(1)} y={(lblPos(bDeg).y+14).toFixed(1)} textAnchor="middle" fontSize={10} fontWeight={700} fill={GOLD} fontFamily={FONT} letterSpacing={0.5}>{d.label}</text>
    </g>) : null;

    const valid = rows.filter(isValidBattedBall);
    const dots = valid.map((r,i) => {
      const rad=parseFloat(r.bearing)*Math.PI/180, d=parseFloat(r.hit_distance);
      return <circle key={i} cx={(homeX+Math.sin(rad)*d*scale).toFixed(1)} cy={(homeY-Math.cos(rad)*d*scale).toFixed(1)} r={evRadius(r.exit_speed).toFixed(1)} fill={resultColor(r.play_result)} fillOpacity={0.92} stroke="rgba(14,37,58,0.65)" strokeWidth={0.8} />;
    });

    body = (<>
      <path d={wedgeD(-45,-15)} fill={wedgeFillColor(lfData.pct,maxPct)}  stroke="rgba(36,68,95,0.3)" strokeWidth={0.5} />
      <path d={wedgeD(-15, 15)} fill={wedgeFillColor(midData.pct,maxPct)} stroke="rgba(36,68,95,0.3)" strokeWidth={0.5} />
      <path d={wedgeD( 15, 45)} fill={wedgeFillColor(rfData.pct,maxPct)}  stroke="rgba(36,68,95,0.3)" strokeWidth={0.5} />
      {[150,250,350,MAXD].map(arc)}{infield}{foul}{dots}
      {wLbl(lfData,-30)}{wLbl(midData,0)}{wLbl(rfData,30)}
      {sideLabels}
    </>);

  } else if (activeMode === 'zones' && hasHand) {
    const maxPct = Math.max(dist.pullPct, dist.midPct, dist.oppoPct, 0.001);
    const lfIsPull = hand === 'R';
    const lfData = lfIsPull ? {label:'PULL',pct:dist.pullPct,n:dist.pull} : {label:'OPPO',pct:dist.oppoPct,n:dist.oppo};
    const rfData = lfIsPull ? {label:'OPPO',pct:dist.oppoPct,n:dist.oppo} : {label:'PULL',pct:dist.pullPct,n:dist.pull};
    const midData = {label:'MID',pct:dist.midPct,n:dist.middle};
    const lbl = (d,p) => d.n>0 ? (<g key={d.label}>
      <text x={p.x.toFixed(1)} y={p.y.toFixed(1)} textAnchor="middle" fontSize={15} fontWeight={800} fill="#e8eef5" fontFamily={FONT}>{Math.round(d.pct*100)}%</text>
      <text x={p.x.toFixed(1)} y={(p.y+13).toFixed(1)} textAnchor="middle" fontSize={10} fontWeight={700} fill={GOLD} fontFamily={FONT} letterSpacing={0.5}>{d.label}</text>
      <text x={p.x.toFixed(1)} y={(p.y+24).toFixed(1)} textAnchor="middle" fontSize={9} fill="#9fb2c4" fontFamily={FONT}>{d.n} BBE</text>
    </g>) : null;
    body = (<>
      <path d={wedgeD(-45,-15)} fill={wedgeFillColor(lfData.pct,maxPct)}  stroke="rgba(36,68,95,0.4)" strokeWidth={0.75} />
      <path d={wedgeD(-15, 15)} fill={wedgeFillColor(midData.pct,maxPct)} stroke="rgba(36,68,95,0.4)" strokeWidth={0.75} />
      <path d={wedgeD( 15, 45)} fill={wedgeFillColor(rfData.pct,maxPct)}  stroke="rgba(36,68,95,0.4)" strokeWidth={0.75} />
      {[150,250,350,MAXD].map(arc)}{infield}{foul}
      {lbl(lfData,lblPos(-30))}{lbl(midData,lblPos(0))}{lbl(rfData,lblPos(30))}
      {sideLabels}
    </>);
  } else {
    const valid = rows.filter(isValidBattedBall).filter(r =>
      activeFilter==='hits' ? isHit(r.play_result) : activeFilter==='outs' ? !isHit(r.play_result) : true
    );
    body = (<>
      {[150,250,350,MAXD].map(arc)}{infield}{foul}
      {valid.map((r,i) => {
        const rad=parseFloat(r.bearing)*Math.PI/180, d=parseFloat(r.hit_distance);
        return <circle key={i} cx={(homeX+Math.sin(rad)*d*scale).toFixed(1)} cy={(homeY-Math.cos(rad)*d*scale).toFixed(1)} r={evRadius(r.exit_speed).toFixed(1)} fill={resultColor(r.play_result)} fillOpacity={0.85} stroke="rgba(14,37,58,0.8)" strokeWidth={0.8} />;
      })}
      {sideLabels}
    </>);
  }

  const btn = (active,onClick,label,disabled) => (
    <button onClick={onClick} disabled={disabled}
      style={{ background:active?GOLD:'transparent', color:active?NAVY:'#9fb2c4', border:'1px solid #24445f', padding:'3px 10px', borderRadius:4, fontSize:10, fontWeight:700, letterSpacing:0.5, cursor:disabled?'not-allowed':'pointer', fontFamily:FONT, opacity:disabled?0.4:1 }}>
      {label}
    </button>
  );

  const heatLegend = dugout && hasHand && (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:8, fontSize:11, color:'rgba(159,178,196,0.7)', fontFamily:FONT }}>
      <span>Rare</span>
      <div style={{ display:'flex', height:8, borderRadius:2, overflow:'hidden', width:100 }}>
        {[0,0.25,0.5,0.75,1].map((t,i) => <span key={i} style={{flex:1, background:rgba(t,0.85)}} />)}
      </div>
      <span>Frequent</span>
    </div>
  );

  if (dugout) {
    return (
      <div>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display:'block' }} xmlns="http://www.w3.org/2000/svg">{body}</svg>
        <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginTop:8, alignItems:'center' }}>
          {[['#E24B4A','HR'],['#EF9F27','3B'],['#c6b583','2B'],['#2dba5a','1B'],['#5f7488','Out']].map(([c,l]) => (
            <div key={l} style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'rgba(159,178,196,0.75)', fontFamily:FONT }}>
              <div style={{width:9,height:9,borderRadius:'50%',background:c}} />{l}
            </div>
          ))}
          <span style={{ fontSize:11, color:'rgba(159,178,196,0.4)', fontFamily:FONT }}>· dot size = EV</span>
        </div>
        {heatLegend}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom:8, flexWrap:'wrap' }}>
        <div style={{ display:'inline-flex', border:'1px solid #24445f', borderRadius:4, overflow:'hidden' }}>
          {btn(mode==='dots', ()=>setMode('dots'), 'Dots')}
          {btn(mode==='zones', ()=>hasHand&&setMode('zones'), 'Zones', !hasHand)}
        </div>
        {mode==='dots' && (<div style={{ display:'inline-flex', gap:4 }}>
          {btn(filter==='all', ()=>setFilter('all'), 'All')}
          {btn(filter==='hits', ()=>setFilter('hits'), 'Hits')}
          {btn(filter==='outs', ()=>setFilter('outs'), 'Outs')}
        </div>)}
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display:'block' }} xmlns="http://www.w3.org/2000/svg">{body}</svg>
    </div>
  );
}
