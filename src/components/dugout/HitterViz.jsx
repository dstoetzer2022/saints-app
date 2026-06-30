import React, { useState, useMemo } from 'react';
import { isSwing, isWhiff, isValidBattedBall, sprayThird, sprayDistribution, normHand } from '@/lib/statsUtils';
import { getPitchColor, normalizePitch } from '@/lib/ds';

const FONT = "\'Archivo\', system-ui, sans-serif";
const NAVY = '#0e253a';
const GOLD = '#c6b583';

// Batter silhouette — navy-tinted JD Martinez stance photo (RHB)
// For LHB the SVG applies a horizontal mirror transform
const SILHOUETTE_B64 = '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';

// ── Shared stat compute ──────────────────────────────────────────────────────
const AB_RESULTS = ['Single', 'Double', 'Triple', 'HomeRun', 'Out', 'Error', 'FieldersChoice'];
const HIT_RESULTS = ['Single', 'Double', 'Triple', 'HomeRun'];
const TB = { Single: 1, Double: 2, Triple: 3, HomeRun: 4 };

function calcStats(rows) {
  let swings = 0, whiffs = 0, AB = 0, H = 0, tb = 0;
  for (const r of rows) {
    if (isSwing(r)) swings++;
    if (isWhiff(r)) whiffs++;
    if (r.pitch_call === 'InPlay') {
      const pr = r.play_result;
      if (AB_RESULTS.includes(pr)) AB++;
      if (HIT_RESULTS.includes(pr)) { H++; tb += (TB[pr] || 0); }
    }
  }
  return { pitches: rows.length, swings, whiffs, AB, H, whiffPct: swings ? whiffs / swings : 0, SLG: AB ? tb / AB : 0 };
}

// ============================================================================
// ZONE HEATMAP
// ZV expanded to W=340 to accommodate the batter silhouette (60px each side).
// mirror convention: mirror=true → pitcher's view (positive side → LEFT of SVG)
//                   mirror=false → catcher's view
// The label & silhouette code always use viewMode='pitcher' in DugoutView.
// ============================================================================
const SZ   = { LEFT: -0.83, RIGHT: 0.83, BOT: 1.50, TOP: 3.50 };
const BAND = 0.40;
const OUTB = { LEFT: SZ.LEFT - BAND, RIGHT: SZ.RIGHT + BAND, BOT: SZ.BOT - BAND, TOP: SZ.TOP + BAND };

function getZone(side, height) {
  const s = parseFloat(side), h = parseFloat(height);
  if (!isFinite(s) || !isFinite(h)) return null;
  if (s < OUTB.LEFT || s > OUTB.RIGHT || h < OUTB.BOT || h > OUTB.TOP) return null;
  const inX = s >= SZ.LEFT && s <= SZ.RIGHT, inY = h >= SZ.BOT && h <= SZ.TOP;
  if (inX && inY) {
    const COL = (SZ.RIGHT - SZ.LEFT) / 3, ROW = (SZ.TOP - SZ.BOT) / 3;
    const col = s < (SZ.LEFT + COL) ? 0 : s < (SZ.LEFT + 2 * COL) ? 1 : 2;
    const row = h < (SZ.BOT + ROW) ? 0 : h < (SZ.BOT + 2 * ROW) ? 1 : 2;
    return row * 3 + col + 1;
  }
  const left = s < (SZ.LEFT + SZ.RIGHT) / 2, bot = h < (SZ.BOT + SZ.TOP) / 2;
  if (left && !bot) return 11;
  if (!left && !bot) return 12;
  if (left && bot) return 13;
  return 14;
}
function zoneRows(rows, zone) { return rows.filter(r => getZone(r.plate_loc_side, r.plate_loc_height) === zone); }

function slgColor(slg, n) {
  if (!n || n < 1) return { fill: 'rgba(27,58,89,0.35)', text: 'rgba(159,178,196,0.5)' };
  if (slg === 0)   return { fill: 'rgba(20,54,86,0.85)',  text: '#9fc4ff' };
  if (slg < 0.250) return { fill: 'rgba(23,80,65,0.80)',  text: '#5dcaa5' };
  if (slg < 0.450) return { fill: 'rgba(85,79,10,0.82)',  text: '#e8d070' };
  if (slg < 0.650) return { fill: 'rgba(140,79,11,0.86)', text: '#f5c542' };
  if (slg < 0.900) return { fill: 'rgba(153,60,29,0.90)', text: '#f0997b' };
  return { fill: 'rgba(163,45,45,0.94)', text: '#f29595' };
}

// Expanded canvas with 60px silhouette margins
const ZV = { W: 340, H: 310, plotX: 60, plotY: 36, plotW: 220, plotH: 210 };

// CORRECTED mirror: pitcher's view = mirror=true so positive side → LEFT (pitcher's left)
function mapX(s, mirror) { const t = (s - OUTB.LEFT) / (OUTB.RIGHT - OUTB.LEFT); return ZV.plotX + (mirror ? 1 - t : t) * ZV.plotW; }
function mapY(h) { const t = (h - OUTB.BOT) / (OUTB.TOP - OUTB.BOT); return ZV.plotY + (1 - t) * ZV.plotH; }
function plateRect(x0, x1, y0, y1, mirror) {
  const sx0 = mapX(x0, mirror), sx1 = mapX(x1, mirror), sy0 = mapY(y0), sy1 = mapY(y1);
  return { x: Math.min(sx0, sx1), y: Math.min(sy0, sy1), w: Math.abs(sx1 - sx0), h: Math.abs(sy1 - sy0) };
}
function inCellRect(z, mirror) {
  const COL = (SZ.RIGHT - SZ.LEFT) / 3, ROW = (SZ.TOP - SZ.BOT) / 3;
  const col = (z - 1) % 3, rowFromBot = Math.floor((z - 1) / 3);
  return plateRect(SZ.LEFT + col * COL, SZ.LEFT + (col + 1) * COL, SZ.BOT + rowFromBot * ROW, SZ.BOT + (rowFromBot + 1) * ROW, mirror);
}
function shadowPoints(zone, mirror) {
  const midX = (SZ.LEFT + SZ.RIGHT) / 2, midY = (SZ.BOT + SZ.TOP) / 2;
  let qx0, qx1, qy0, qy1;
  if (zone === 11) { qx0 = OUTB.LEFT; qx1 = midX; qy0 = midY; qy1 = OUTB.TOP; }
  if (zone === 12) { qx0 = midX; qx1 = OUTB.RIGHT; qy0 = midY; qy1 = OUTB.TOP; }
  if (zone === 13) { qx0 = OUTB.LEFT; qx1 = midX; qy0 = OUTB.BOT; qy1 = midY; }
  if (zone === 14) { qx0 = midX; qx1 = OUTB.RIGHT; qy0 = OUTB.BOT; qy1 = midY; }
  const ix0 = Math.max(qx0, SZ.LEFT), ix1 = Math.min(qx1, SZ.RIGHT);
  const iy0 = Math.max(qy0, SZ.BOT),  iy1 = Math.min(qy1, SZ.TOP);
  const q = plateRect(qx0, qx1, qy0, qy1, mirror);
  const bite = plateRect(ix0, ix1, iy0, iy1, mirror);
  const qX0=q.x, qX1=q.x+q.w, qY0=q.y, qY1=q.y+q.h;
  const bX0=bite.x, bX1=bite.x+bite.w, bY0=bite.y, bY1=bite.y+bite.h;
  const biteLeft = Math.abs(bX0-qX0) < Math.abs(bX1-qX1);
  const biteTop  = Math.abs(bY0-qY0) < Math.abs(bY1-qY1);
  let pts;
  if (biteLeft && biteTop)       pts=[[qX0,bY1],[bX1,bY1],[bX1,qY0],[qX1,qY0],[qX1,qY1],[qX0,qY1]];
  else if (!biteLeft && biteTop) pts=[[qX0,qY0],[bX0,qY0],[bX0,bY1],[qX1,bY1],[qX1,qY1],[qX0,qY1]];
  else if (biteLeft && !biteTop) pts=[[qX0,qY0],[qX1,qY0],[qX1,qY1],[bX1,qY1],[bX1,bY0],[qX0,bY0]];
  else                           pts=[[qX0,qY0],[qX1,qY0],[qX1,bY0],[bX0,bY0],[bX0,qY1],[qX0,qY1]];
  const lx = biteLeft ? qX1 - 18 : qX0 + 18;
  const ly = biteTop  ? qY1 - 13 : qY0 + 15;
  return { path: 'M ' + pts.map(p => p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' L ')+' Z', lx, ly };
}

export function ZoneHeatmap({ rows, viewMode = 'pitcher', batterHand = '' }) {
  // CORRECTED: pitcher's view uses mirror=true
  const mirror = viewMode === 'pitcher';
  const cells = [];
  for (const z of [11,12,13,14]) {
    const sp = shadowPoints(z, mirror);
    const zr = zoneRows(rows,z), st = calcStats(zr), col = slgColor(st.SLG, st.AB);
    cells.push(<path key={'s'+z} d={sp.path} fill={col.fill} stroke="rgba(36,68,95,0.6)" strokeWidth={0.75} />);
    if (zr.length > 0) {
      const slgStr = st.AB ? st.SLG.toFixed(3).replace(/^0/,'') : '';
      if (slgStr) cells.push(<text key={'st'+z} x={sp.lx} y={sp.ly} textAnchor="middle" fontSize={9} fill={col.text} fontFamily={FONT} fontWeight={700}>{slgStr}</text>);
      cells.push(<text key={'sp'+z} x={sp.lx} y={sp.ly+(slgStr?9:3)} textAnchor="middle" fontSize={7} fill={col.text} opacity={0.75} fontFamily={FONT}>{zr.length}p</text>);
    }
  }
  for (let z=1; z<=9; z++) {
    const r = inCellRect(z, mirror);
    const zr = zoneRows(rows,z), st = calcStats(zr), col = slgColor(st.SLG, st.AB);
    cells.push(<rect key={'c'+z} x={r.x} y={r.y} width={r.w} height={r.h} fill={col.fill} stroke="rgba(36,68,95,0.95)" strokeWidth={1} />);
    const cx=r.x+r.w/2, cy=r.y+r.h/2;
    if (zr.length > 0) {
      const slgStr = st.AB ? st.SLG.toFixed(3).replace(/^0/,'') : '';
      if (slgStr) cells.push(<text key={'ct'+z} x={cx} y={cy-3} textAnchor="middle" fontSize={10} fill={col.text} fontFamily={FONT} fontWeight={700}>{slgStr}</text>);
      cells.push(<text key={'cp'+z} x={cx} y={cy+(slgStr?8:3)} textAnchor="middle" fontSize={8} fill={col.text} opacity={0.75} fontFamily={FONT}>{zr.length}p</text>);
    }
  }
  const szb = plateRect(SZ.LEFT, SZ.RIGHT, SZ.BOT, SZ.TOP, mirror);
  const pcx = szb.x+szb.w/2;
  const ptop = szb.y+szb.h+22;
  const pw = szb.w*0.55, ph=pw/2, plH=pw*0.5;
  // Home plate: flat side toward zone (top), point at bottom — standard pitcher's-view display
  const plateD = `M ${(pcx-ph).toFixed(1)},${ptop.toFixed(1)} L ${(pcx+ph).toFixed(1)},${ptop.toFixed(1)} L ${(pcx+ph).toFixed(1)},${(ptop+plH*0.55).toFixed(1)} L ${pcx.toFixed(1)},${(ptop+plH).toFixed(1)} L ${(pcx-ph).toFixed(1)},${(ptop+plH*0.55).toFixed(1)} Z`;

  // Batter silhouette — real photo processed to navy silhouette
  // RHB: left margin (pitcher's left). LHB: right margin (mirrored).
  const imgH = 148, imgW = 60, imgY = ptop - imgH + 14;
  const silhouette = batterHand && batterHand !== 'S' ? (
    batterHand === 'R' ? (
      <image href={`data:image/png;base64,${SILHOUETTE_B64}`}
        x={0} y={imgY} width={imgW} height={imgH}
        preserveAspectRatio="xMidYMax meet" />
    ) : (
      <g transform={`scale(-1,1) translate(-${ZV.W},0)`}>
        <image href={`data:image/png;base64,${SILHOUETTE_B64}`}
          x={0} y={imgY} width={imgW} height={imgH}
          preserveAspectRatio="xMidYMax meet" />
      </g>
    )
  ) : null;

  const handLabelX = batterHand === 'R' ? 30 : ZV.W - 30;

  return (
    <svg width="100%" viewBox={`0 0 ${ZV.W} ${ZV.H}`} style={{ display: 'block' }} xmlns="http://www.w3.org/2000/svg">
      {silhouette}
      {cells}
      <rect x={szb.x} y={szb.y} width={szb.w} height={szb.h} fill="none" stroke="rgba(198,181,131,0.65)" strokeWidth={1.5} />
      <path d={plateD} fill="rgba(232,238,245,0.06)" stroke="rgba(232,238,245,0.4)" strokeWidth={1.1} strokeLinejoin="round" />
      <text x={pcx} y={ZV.plotY-10} textAnchor="middle" fontSize={9} fill="rgba(198,181,131,0.7)" fontFamily={FONT} fontWeight={600} letterSpacing={1}>
        {viewMode === 'pitcher' ? "PITCHER\'S VIEW" : "CATCHER\'S VIEW"}
      </text>
      {batterHand && batterHand !== 'S' && (
        <text x={handLabelX} y={ptop+plH+14} textAnchor="middle" fontSize={8} fill="rgba(232,238,245,0.4)" fontFamily={FONT} fontWeight={600} letterSpacing={0.8}>
          {batterHand}HB
        </text>
      )}
    </svg>
  );
}

// ============================================================================
// SPRAY CHART
// dugout=true: overlays distribution wedges (semi-transparent) + dots on top
//              so you get direction context AND individual BBE dots.
// ============================================================================
const RESULT_COLORS = { HomeRun: '#E24B4A', Triple: '#EF9F27', Double: '#c6b583', Single: '#2dba5a', Out: '#5f7488', Error: '#9fb2c4' };
function resultColor(pr) { return RESULT_COLORS[pr] || '#5f7488'; }
function isHit(pr) { return HIT_RESULTS.includes(pr); }
function evRadius(ev) { const e=parseFloat(ev); if(!isFinite(e)) return 3.5; return Math.max(3,Math.min(7,3+(e-60)/12)); }

export function SprayChart({ rows, hand, dugout = false }) {
  const [mode,   setMode]   = useState('dots');
  const [filter, setFilter] = useState('all');

  const activeMode   = dugout ? 'mixed' : mode;
  const activeFilter = dugout ? 'all'   : filter;

  const dist    = useMemo(() => sprayDistribution(rows, hand), [rows, hand]);
  const W=300, H=260, homeX=W/2, homeY=H-26, MAXD=420, scale=(H-60)/MAXD;
  const flRad   = 45*Math.PI/180;
  const hasHand = !!hand && dist.total > 0;

  const arc = (d) => {
    const r=d*scale, x0=homeX-Math.sin(flRad)*r, y0=homeY-Math.cos(flRad)*r, x1=homeX+Math.sin(flRad)*r, y1=homeY-Math.cos(flRad)*r;
    return <path key={'a'+d} d={`M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`} fill="none" stroke="rgba(36,68,95,0.7)" strokeWidth={1} strokeDasharray="2 3" />;
  };
  const foul = (<>
    <line x1={homeX} y1={homeY} x2={homeX-Math.sin(flRad)*MAXD*scale} y2={homeY-Math.cos(flRad)*MAXD*scale} stroke="rgba(159,178,196,0.35)" strokeWidth={1.2} />
    <line x1={homeX} y1={homeY} x2={homeX+Math.sin(flRad)*MAXD*scale} y2={homeY-Math.cos(flRad)*MAXD*scale} stroke="rgba(159,178,196,0.35)" strokeWidth={1.2} />
  </>);
  const infD = 95*scale;
  const infield = <path d={`M ${homeX} ${homeY} L ${homeX+infD} ${homeY-infD} L ${homeX} ${homeY-infD*1.414} L ${homeX-infD} ${homeY-infD} Z`} fill="rgba(198,181,131,0.04)" stroke="rgba(36,68,95,0.6)" strokeWidth={1} />;
  const lfx = homeX-Math.sin(flRad)*MAXD*scale, rfx = homeX+Math.sin(flRad)*MAXD*scale;
  const sideLabels = (<>
    <text x={lfx+8} y={homeY-10} fontSize={8} fill="rgba(159,178,196,0.5)" fontFamily={FONT}>LF</text>
    <text x={rfx-14} y={homeY-10} fontSize={8} fill="rgba(159,178,196,0.5)" fontFamily={FONT}>RF</text>
  </>);

  // Wedge helpers
  const wedgeD = (b0, b1) => {
    const r=MAXD*scale, r0=b0*Math.PI/180, r1=b1*Math.PI/180;
    return `M ${homeX} ${homeY} L ${(homeX+Math.sin(r0)*r).toFixed(1)} ${(homeY-Math.cos(r0)*r).toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${(homeX+Math.sin(r1)*r).toFixed(1)} ${(homeY-Math.cos(r1)*r).toFixed(1)} Z`;
  };
  const lblPos = (bDeg, rFrac=0.58) => {
    const lblR=MAXD*scale*rFrac;
    return { x: homeX+Math.sin(bDeg*Math.PI/180)*lblR, y: homeY-Math.cos(bDeg*Math.PI/180)*lblR };
  };

  let body;

  if (activeMode === 'mixed' && hasHand) {
    // ── DUGOUT mode: wedge background + dots foreground ──────────────────
    const maxPct = Math.max(dist.pullPct, dist.midPct, dist.oppoPct, 0.001);
    const wFill  = pct => `rgba(198,181,131,${(0.07+(pct/maxPct)*0.28).toFixed(2)})`;
    const lfIsPull = hand === 'R';
    const lfData = lfIsPull ? {label:'PULL',pct:dist.pullPct,n:dist.pull} : {label:'OPPO',pct:dist.oppoPct,n:dist.oppo};
    const rfData = lfIsPull ? {label:'OPPO',pct:dist.oppoPct,n:dist.oppo} : {label:'PULL',pct:dist.pullPct,n:dist.pull};
    const midData = {label:'MID',pct:dist.midPct,n:dist.middle};

    const wedgeLbl = (d, bDeg) => d.n > 0 ? (
      <g key={d.label}>
        <text x={lblPos(bDeg).x.toFixed(1)} y={lblPos(bDeg).y.toFixed(1)} textAnchor="middle" fontSize={13} fontWeight={800} fill="#e8eef5" fontFamily={FONT}>{Math.round(d.pct*100)}%</text>
        <text x={lblPos(bDeg).x.toFixed(1)} y={(lblPos(bDeg).y+12).toFixed(1)} textAnchor="middle" fontSize={9} fontWeight={700} fill={GOLD} fontFamily={FONT} letterSpacing={0.5}>{d.label}</text>
      </g>
    ) : null;

    const valid = rows.filter(isValidBattedBall);
    const dots  = valid.map((r,i) => {
      const rad=parseFloat(r.bearing)*Math.PI/180, d=parseFloat(r.hit_distance);
      return <circle key={i} cx={(homeX+Math.sin(rad)*d*scale).toFixed(1)} cy={(homeY-Math.cos(rad)*d*scale).toFixed(1)} r={evRadius(r.exit_speed).toFixed(1)} fill={resultColor(r.play_result)} fillOpacity={0.88} stroke="rgba(14,37,58,0.7)" strokeWidth={0.8} />;
    });

    body = (<>
      <path d={wedgeD(-45,-15)} fill={wFill(lfData.pct)}  stroke="rgba(36,68,95,0.4)" strokeWidth={0.5} />
      <path d={wedgeD(-15, 15)} fill={wFill(midData.pct)} stroke="rgba(36,68,95,0.4)" strokeWidth={0.5} />
      <path d={wedgeD( 15, 45)} fill={wFill(rfData.pct)}  stroke="rgba(36,68,95,0.4)" strokeWidth={0.5} />
      {[150,250,350,MAXD].map(arc)}{infield}{foul}
      {dots}
      {wedgeLbl(lfData,-30)}{wedgeLbl(midData,0)}{wedgeLbl(rfData,30)}
      {sideLabels}
    </>);

  } else if (activeMode === 'zones' && hasHand) {
    const maxPct = Math.max(dist.pullPct,dist.midPct,dist.oppoPct,0.001);
    const wFill  = pct => `rgba(198,181,131,${(0.10+(pct/maxPct)*0.55).toFixed(2)})`;
    const lfIsPull = hand==='R';
    const lfData  = lfIsPull ? {label:'PULL',pct:dist.pullPct,n:dist.pull}  : {label:'OPPO',pct:dist.oppoPct,n:dist.oppo};
    const rfData  = lfIsPull ? {label:'OPPO',pct:dist.oppoPct,n:dist.oppo} : {label:'PULL',pct:dist.pullPct,n:dist.pull};
    const midData = {label:'MID',pct:dist.midPct,n:dist.middle};
    const lbl = (d,p) => d.n>0 ? (<g key={d.label}>
      <text x={p.x.toFixed(1)} y={p.y.toFixed(1)} textAnchor="middle" fontSize={14} fontWeight={800} fill="#e8eef5" fontFamily={FONT}>{Math.round(d.pct*100)}%</text>
      <text x={p.x.toFixed(1)} y={(p.y+12).toFixed(1)} textAnchor="middle" fontSize={8} fontWeight={700} fill={GOLD} fontFamily={FONT} letterSpacing={0.5}>{d.label}</text>
      <text x={p.x.toFixed(1)} y={(p.y+22).toFixed(1)} textAnchor="middle" fontSize={8} fill="#9fb2c4" fontFamily={FONT}>{d.n} BBE</text>
    </g>) : null;
    body = (<>
      <path d={wedgeD(-45,-15)} fill={wFill(lfData.pct)}  stroke="rgba(36,68,95,0.5)" strokeWidth={0.75} />
      <path d={wedgeD(-15, 15)} fill={wFill(midData.pct)} stroke="rgba(36,68,95,0.5)" strokeWidth={0.75} />
      <path d={wedgeD( 15, 45)} fill={wFill(rfData.pct)}  stroke="rgba(36,68,95,0.5)" strokeWidth={0.75} />
      {[150,250,350,MAXD].map(arc)}{infield}{foul}
      {lbl(lfData,lblPos(-30))}{lbl(midData,lblPos(0))}{lbl(rfData,lblPos(30))}
      {sideLabels}
    </>);
  } else {
    const valid = rows.filter(isValidBattedBall).filter(r=>activeFilter==='hits'?isHit(r.play_result):activeFilter==='outs'?!isHit(r.play_result):true);
    body = (<>
      {[150,250,350,MAXD].map(arc)}{infield}{foul}
      {valid.map((r,i)=>{const rad=parseFloat(r.bearing)*Math.PI/180,d=parseFloat(r.hit_distance);return <circle key={i} cx={(homeX+Math.sin(rad)*d*scale).toFixed(1)} cy={(homeY-Math.cos(rad)*d*scale).toFixed(1)} r={evRadius(r.exit_speed).toFixed(1)} fill={resultColor(r.play_result)} fillOpacity={0.82} stroke="rgba(14,37,58,0.8)" strokeWidth={1} />;})};
      {sideLabels}
    </>);
  }

  const btn = (active, onClick, label, disabled) => (
    <button onClick={onClick} disabled={disabled} style={{ background: active?GOLD:'transparent', color: active?NAVY:'#9fb2c4', border: '1px solid #24445f', padding: '3px 10px', borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, cursor: disabled?'not-allowed':'pointer', fontFamily: FONT, opacity: disabled?0.4:1 }}>{label}</button>
  );

  // Legend row shown in non-dugout mode
  const legend = !dugout && (
    <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginTop:6 }}>
      {[['#E24B4A','HR'],['#EF9F27','3B'],['#c6b583','2B'],['#2dba5a','1B'],['#5f7488','Out']].map(([c,l])=>(
        <div key={l} style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'rgba(159,178,196,0.7)', fontFamily:FONT }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background:c }} />{l}
        </div>
      ))}
      <span style={{ fontSize:11, color:'rgba(159,178,196,0.5)', fontFamily:FONT }}>· size = EV</span>
    </div>
  );

  if (dugout) {
    // Dugout: no controls, just the mixed chart + result legend
    return (
      <div>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display:'block' }} xmlns="http://www.w3.org/2000/svg">{body}</svg>
        <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginTop:8 }}>
          {[['#E24B4A','HR'],['#EF9F27','3B'],['#c6b583','2B'],['#2dba5a','1B'],['#5f7488','Out']].map(([c,l])=>(
            <div key={l} style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'rgba(159,178,196,0.75)', fontFamily:FONT }}>
              <div style={{ width:9, height:9, borderRadius:'50%', background:c }} />{l}
            </div>
          ))}
          <span style={{ fontSize:11, color:'rgba(159,178,196,0.45)', fontFamily:FONT }}>· size = EV</span>
        </div>
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
        {mode==='dots' && (
          <div style={{ display:'inline-flex', gap:4 }}>
            {btn(filter==='all', ()=>setFilter('all'), 'All')}
            {btn(filter==='hits', ()=>setFilter('hits'), 'Hits')}
            {btn(filter==='outs', ()=>setFilter('outs'), 'Outs')}
          </div>
        )}
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display:'block' }} xmlns="http://www.w3.org/2000/svg">{body}</svg>
      {legend}
    </div>
  );
}
