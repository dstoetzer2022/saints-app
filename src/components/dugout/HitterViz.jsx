import React, { useState, useMemo } from 'react';
import { isSwing, isWhiff, isValidBattedBall, sprayThird, sprayDistribution, normHand } from '@/lib/statsUtils';
import { getPitchColor, normalizePitch } from '@/lib/ds';

const FONT = "'Archivo', system-ui, sans-serif";
const NAVY = '#0e253a';
const GOLD = '#c6b583';

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
  return {
    pitches: rows.length, swings, whiffs, AB, H,
    whiffPct: swings ? whiffs / swings : 0,
    SLG: AB ? tb / AB : 0,
  };
}

// ============================================================================
// ZONE HEATMAP
// ZV expanded to W=310 to accommodate batter silhouette in side margins.
// plotX shifted from 22→47 (25px extra on each side).
// batterHand prop: 'R' | 'L' | 'S' | '' — draws silhouette when provided.
// viewMode always 'pitcher' in DugoutView; toggle lives in standalone/hub only.
// ============================================================================
const SZ = { LEFT: -0.83, RIGHT: 0.83, BOT: 1.50, TOP: 3.50 };
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

// Expanded canvas: 25px side margins for batter silhouette
const ZV = { W: 310, H: 300, plotX: 47, plotY: 36, plotW: 216, plotH: 200 };

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
  const iy0 = Math.max(qy0, SZ.BOT), iy1 = Math.min(qy1, SZ.TOP);
  const q = plateRect(qx0, qx1, qy0, qy1, mirror);
  const bite = plateRect(ix0, ix1, iy0, iy1, mirror);
  const qX0 = q.x, qX1 = q.x + q.w, qY0 = q.y, qY1 = q.y + q.h;
  const bX0 = bite.x, bX1 = bite.x + bite.w, bY0 = bite.y, bY1 = bite.y + bite.h;
  const biteLeft = Math.abs(bX0 - qX0) < Math.abs(bX1 - qX1);
  const biteTop = Math.abs(bY0 - qY0) < Math.abs(bY1 - qY1);
  let pts;
  if (biteLeft && biteTop)       pts = [[qX0, bY1], [bX1, bY1], [bX1, qY0], [qX1, qY0], [qX1, qY1], [qX0, qY1]];
  else if (!biteLeft && biteTop) pts = [[qX0, qY0], [bX0, qY0], [bX0, bY1], [qX1, bY1], [qX1, qY1], [qX0, qY1]];
  else if (biteLeft && !biteTop) pts = [[qX0, qY0], [qX1, qY0], [qX1, qY1], [bX1, qY1], [bX1, bY0], [qX0, bY0]];
  else                           pts = [[qX0, qY0], [qX1, qY0], [qX1, bY0], [bX0, bY0], [bX0, qY1], [qX0, qY1]];
  const lx = biteLeft ? qX1 - 16 : qX0 + 16;
  const ly = biteTop ? qY1 - 13 : qY0 + 15;
  return { path: 'M ' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L ') + ' Z', lx, ly };
}

// ── Batter silhouette (pitcher's POV)
// From pitcher's view looking in: RHB is on pitcher's LEFT (low negative plate_loc_side),
// so RHB silhouette sits in the left margin (x=0..47).
// LHB is on pitcher's RIGHT → right margin (x=263..310).
// Switch hitters (S): show nothing (cannot predict side).
function BatterSilhouette({ hand }) {
  const FILL   = 'rgba(232,238,245,0.22)';
  const STROKE = 'rgba(232,238,245,0.45)';
  const SW = 1.2;
  if (!hand || hand === 'S') return null;
  const isRHB = hand === 'R';

  // Batter body anchor: cx is center of the 47px side margin
  const cx = isRHB ? 24 : 286;
  // The bat tip points inward toward the zone
  const batTipX = isRHB ? ZV.plotX : ZV.plotX + ZV.plotW; // 47 or 263
  const batRootX = isRHB ? cx + 8 : cx - 8;
  const batY = 178;

  return (
    <g>
      {/* Head */}
      <circle cx={cx} cy={162} r={9} fill={FILL} stroke={STROKE} strokeWidth={SW} />
      {/* Torso */}
      <path
        d={`M ${cx - 10} 172 L ${cx + 10} 172 L ${cx + 7} 208 L ${cx - 7} 208 Z`}
        fill={FILL} stroke={STROKE} strokeWidth={SW}
      />
      {/* Bat — thin rect from body to zone edge */}
      <rect
        x={Math.min(batRootX, batTipX)} y={batY - 2}
        width={Math.abs(batRootX - batTipX)} height={5}
        rx={2} fill="rgba(232,238,245,0.5)" stroke={STROKE} strokeWidth={SW}
      />
      {/* Front leg (closer to plate) */}
      <rect
        x={isRHB ? cx : cx - 8} y={208}
        width={7} height={30} rx={2}
        fill={FILL} stroke={STROKE} strokeWidth={SW}
      />
      {/* Back leg */}
      <rect
        x={isRHB ? cx - 9 : cx + 2} y={208}
        width={6} height={26} rx={2}
        fill="rgba(232,238,245,0.14)" stroke="rgba(232,238,245,0.32)" strokeWidth={SW}
      />
      {/* Hand label */}
      <text
        x={cx} y={252}
        textAnchor="middle" fontSize={8}
        fill="rgba(232,238,245,0.42)" fontFamily={FONT} fontWeight={700} letterSpacing={0.8}
      >
        {hand}HB
      </text>
    </g>
  );
}

export function ZoneHeatmap({ rows, viewMode = 'pitcher', batterHand = '' }) {
  const mirror = viewMode === 'catcher';
  const cells = [];
  for (const z of [11, 12, 13, 14]) {
    const sp = shadowPoints(z, mirror);
    const zr = zoneRows(rows, z), st = calcStats(zr), col = slgColor(st.SLG, st.AB);
    cells.push(<path key={'s' + z} d={sp.path} fill={col.fill} stroke="rgba(36,68,95,0.6)" strokeWidth={0.75} />);
    if (zr.length > 0) {
      const slgStr = st.AB ? st.SLG.toFixed(3).replace(/^0/, '') : '';
      if (slgStr) cells.push(<text key={'st' + z} x={sp.lx} y={sp.ly} textAnchor="middle" fontSize={9} fill={col.text} fontFamily={FONT} fontWeight={700}>{slgStr}</text>);
      cells.push(<text key={'sp' + z} x={sp.lx} y={sp.ly + (slgStr ? 9 : 3)} textAnchor="middle" fontSize={7} fill={col.text} opacity={0.75} fontFamily={FONT}>{zr.length}p</text>);
    }
  }
  for (let z = 1; z <= 9; z++) {
    const r = inCellRect(z, mirror);
    const zr = zoneRows(rows, z), st = calcStats(zr), col = slgColor(st.SLG, st.AB);
    cells.push(<rect key={'c' + z} x={r.x} y={r.y} width={r.w} height={r.h} fill={col.fill} stroke="rgba(36,68,95,0.95)" strokeWidth={1} />);
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    if (zr.length > 0) {
      const slgStr = st.AB ? st.SLG.toFixed(3).replace(/^0/, '') : '';
      if (slgStr) cells.push(<text key={'ct' + z} x={cx} y={cy - 3} textAnchor="middle" fontSize={10} fill={col.text} fontFamily={FONT} fontWeight={700}>{slgStr}</text>);
      cells.push(<text key={'cp' + z} x={cx} y={cy + (slgStr ? 8 : 3)} textAnchor="middle" fontSize={8} fill={col.text} opacity={0.75} fontFamily={FONT}>{zr.length}p</text>);
    }
  }
  const szb = plateRect(SZ.LEFT, SZ.RIGHT, SZ.BOT, SZ.TOP, mirror);
  const pcx = szb.x + szb.w / 2, ptop = szb.y + szb.h + 24, pw = szb.w * 0.55, ph = pw / 2, plH = pw * 0.5;
  return (
    <svg width="100%" viewBox={`0 0 ${ZV.W} ${ZV.H}`} style={{ display: 'block' }} xmlns="http://www.w3.org/2000/svg">
      {batterHand && <BatterSilhouette hand={batterHand} />}
      {cells}
      <rect x={szb.x} y={szb.y} width={szb.w} height={szb.h} fill="none" stroke="rgba(198,181,131,0.65)" strokeWidth={1.5} />
      <path d={`M ${(pcx - ph).toFixed(1)},${ptop.toFixed(1)} L ${(pcx + ph).toFixed(1)},${ptop.toFixed(1)} L ${(pcx + ph).toFixed(1)},${(ptop + plH * 0.55).toFixed(1)} L ${pcx.toFixed(1)},${(ptop + plH).toFixed(1)} L ${(pcx - ph).toFixed(1)},${(ptop + plH * 0.55).toFixed(1)} Z`} fill="rgba(232,238,245,0.06)" stroke="rgba(232,238,245,0.4)" strokeWidth={1.1} strokeLinejoin="round" />
      <text x={pcx} y={ZV.plotY - 10} textAnchor="middle" fontSize={9} fill="rgba(198,181,131,0.7)" fontFamily={FONT} fontWeight={600} letterSpacing={1}>{mirror ? "CATCHER'S VIEW" : "PITCHER'S VIEW"}</text>
    </svg>
  );
}

// ============================================================================
// SPRAY CHART
// New prop: `dugout={true}` — hides mode/filter toggles, always renders dots,
// shows pull/mid/oppo distribution bar below the field.
// ============================================================================
const RESULT_COLORS = { HomeRun: '#E24B4A', Triple: '#EF9F27', Double: '#c6b583', Single: '#2dba5a', Out: '#5f7488', Error: '#9fb2c4' };
function resultColor(pr) { return RESULT_COLORS[pr] || '#5f7488'; }
function isHit(pr) { return HIT_RESULTS.includes(pr); }
function evRadius(ev) { const e = parseFloat(ev); if (!isFinite(e)) return 3.5; return Math.max(3, Math.min(7, 3 + (e - 60) / 12)); }

export function SprayChart({ rows, hand, dugout = false }) {
  const [mode, setMode] = useState('dots');
  const [filter, setFilter] = useState('all');

  // In dugout mode, always dots + all
  const activeMode   = dugout ? 'dots' : mode;
  const activeFilter = dugout ? 'all'  : filter;

  const dist = useMemo(() => sprayDistribution(rows, hand), [rows, hand]);
  const W = 300, H = 260, homeX = W / 2, homeY = H - 26, MAXD = 420, scale = (H - 60) / MAXD;
  const flRad = 45 * Math.PI / 180;
  const hasHand = !!hand && dist.total > 0;

  const arc = (d) => {
    const r = d * scale, x0 = homeX - Math.sin(flRad) * r, y0 = homeY - Math.cos(flRad) * r, x1 = homeX + Math.sin(flRad) * r, y1 = homeY - Math.cos(flRad) * r;
    return <path key={'a' + d} d={`M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`} fill="none" stroke="rgba(36,68,95,0.7)" strokeWidth={1} strokeDasharray="2 3" />;
  };
  const foul = (
    <>
      <line x1={homeX} y1={homeY} x2={homeX - Math.sin(flRad) * MAXD * scale} y2={homeY - Math.cos(flRad) * MAXD * scale} stroke="rgba(159,178,196,0.35)" strokeWidth={1.2} />
      <line x1={homeX} y1={homeY} x2={homeX + Math.sin(flRad) * MAXD * scale} y2={homeY - Math.cos(flRad) * MAXD * scale} stroke="rgba(159,178,196,0.35)" strokeWidth={1.2} />
    </>
  );
  const infD = 95 * scale;
  const infield = <path d={`M ${homeX} ${homeY} L ${homeX + infD} ${homeY - infD} L ${homeX} ${homeY - infD * 1.414} L ${homeX - infD} ${homeY - infD} Z`} fill="rgba(198,181,131,0.04)" stroke="rgba(36,68,95,0.6)" strokeWidth={1} />;

  // LF / RF labels
  const lfx = homeX - Math.sin(flRad) * MAXD * scale;
  const rfx = homeX + Math.sin(flRad) * MAXD * scale;
  const sideY = homeY - 10;
  const sideLabels = (
    <>
      <text x={lfx + 8} y={sideY} fontSize={8} fill="rgba(159,178,196,0.5)" fontFamily={FONT}>LF</text>
      <text x={rfx - 14} y={sideY} fontSize={8} fill="rgba(159,178,196,0.5)" fontFamily={FONT}>RF</text>
    </>
  );

  let body;
  if (activeMode === 'zones' && hasHand) {
    const maxPct = Math.max(dist.pullPct, dist.midPct, dist.oppoPct, 0.001);
    const wedgeFill = (pct) => `rgba(198,181,131,${(0.10 + (pct / maxPct) * 0.55).toFixed(2)})`;
    const wedge = (b0, b1) => {
      const r = MAXD * scale, r0 = b0 * Math.PI / 180, r1 = b1 * Math.PI / 180;
      return `M ${homeX} ${homeY} L ${(homeX + Math.sin(r0) * r).toFixed(1)} ${(homeY - Math.cos(r0) * r).toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${(homeX + Math.sin(r1) * r).toFixed(1)} ${(homeY - Math.cos(r1) * r).toFixed(1)} Z`;
    };
    const lfIsPull = hand === 'R';
    const lfData = lfIsPull ? { label: 'PULL', pct: dist.pullPct, n: dist.pull } : { label: 'OPPO', pct: dist.oppoPct, n: dist.oppo };
    const rfData = lfIsPull ? { label: 'OPPO', pct: dist.oppoPct, n: dist.oppo } : { label: 'PULL', pct: dist.pullPct, n: dist.pull };
    const midData = { label: 'MID', pct: dist.midPct, n: dist.middle };
    const lblR = MAXD * scale * 0.62;
    const pos = (b) => ({ x: homeX + Math.sin(b * Math.PI / 180) * lblR, y: homeY - Math.cos(b * Math.PI / 180) * lblR });
    const lbl = (d, p) => d.n > 0 ? (
      <g key={d.label}>
        <text x={p.x.toFixed(1)} y={p.y.toFixed(1)} textAnchor="middle" fontSize={14} fontWeight={800} fill="#e8eef5" fontFamily={FONT}>{Math.round(d.pct * 100)}%</text>
        <text x={p.x.toFixed(1)} y={(p.y + 12).toFixed(1)} textAnchor="middle" fontSize={8} fontWeight={700} fill={GOLD} fontFamily={FONT} letterSpacing={0.5}>{d.label}</text>
        <text x={p.x.toFixed(1)} y={(p.y + 22).toFixed(1)} textAnchor="middle" fontSize={8} fill="#9fb2c4" fontFamily={FONT}>{d.n} BBE</text>
      </g>
    ) : null;
    body = (
      <>
        <path d={wedge(-45, -15)} fill={wedgeFill(lfData.pct)} stroke="rgba(36,68,95,0.5)" strokeWidth={0.75} />
        <path d={wedge(-15, 15)} fill={wedgeFill(midData.pct)} stroke="rgba(36,68,95,0.5)" strokeWidth={0.75} />
        <path d={wedge(15, 45)} fill={wedgeFill(rfData.pct)} stroke="rgba(36,68,95,0.5)" strokeWidth={0.75} />
        {[150, 250, 350, MAXD].map(arc)}{infield}{foul}
        {lbl(lfData, pos(-30))}{lbl(midData, pos(0))}{lbl(rfData, pos(30))}
        {sideLabels}
      </>
    );
  } else {
    const valid = rows.filter(isValidBattedBall).filter(r => activeFilter === 'hits' ? isHit(r.play_result) : activeFilter === 'outs' ? !isHit(r.play_result) : true);
    body = (
      <>
        {[150, 250, 350, MAXD].map(arc)}{infield}{foul}
        {valid.map((r, i) => {
          const rad = parseFloat(r.bearing) * Math.PI / 180, d = parseFloat(r.hit_distance);
          return <circle key={i} cx={(homeX + Math.sin(rad) * d * scale).toFixed(1)} cy={(homeY - Math.cos(rad) * d * scale).toFixed(1)} r={evRadius(r.exit_speed).toFixed(1)} fill={resultColor(r.play_result)} fillOpacity={0.82} stroke="rgba(14,37,58,0.8)" strokeWidth={1} />;
        })}
        {sideLabels}
      </>
    );
  }

  const btn = (active, onClick, label, disabled) => (
    <button onClick={onClick} disabled={disabled} style={{ background: active ? GOLD : 'transparent', color: active ? NAVY : '#9fb2c4', border: '1px solid #24445f', padding: '3px 10px', borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: FONT, opacity: disabled ? 0.4 : 1 }}>{label}</button>
  );

  // Distribution bar (shown in dugout mode or dots mode when hand is known)
  const showDistBar = hasHand && (dugout || activeMode === 'dots');
  const distBar = showDistBar ? (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', height: 20, borderRadius: 4, overflow: 'hidden', border: '1px solid rgba(36,68,95,0.8)' }}>
        <div style={{ width: `${(dist.pullPct * 100).toFixed(1)}%`, background: '#c8920c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: NAVY, transition: 'width .2s' }}>
          {dist.pullPct >= 0.12 ? Math.round(dist.pullPct * 100) + '%' : ''}
        </div>
        <div style={{ width: `${(dist.midPct * 100).toFixed(1)}%`, background: '#6b8ca8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: NAVY }}>
          {dist.midPct >= 0.12 ? Math.round(dist.midPct * 100) + '%' : ''}
        </div>
        <div style={{ flex: 1, background: '#3d6b8a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#e8eef5' }}>
          {dist.oppoPct >= 0.12 ? Math.round(dist.oppoPct * 100) + '%' : ''}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3, fontSize: 9, color: 'rgba(159,178,196,0.7)', fontFamily: FONT }}>
        <span>Pull ({dist.pull})</span>
        <span>Middle ({dist.middle})</span>
        <span>Oppo ({dist.oppo})</span>
      </div>
    </div>
  ) : null;

  if (dugout) {
    return (
      <div>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }} xmlns="http://www.w3.org/2000/svg">{body}</svg>
        {distBar}
        {/* Result legend */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
          {[['#E24B4A','HR'],['#EF9F27','3B'],['#c6b583','2B'],['#2dba5a','1B'],['#5f7488','Out']].map(([c,l]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: 'rgba(159,178,196,0.7)', fontFamily: FONT }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: c }} />
              {l}
            </div>
          ))}
          <span style={{ fontSize: 9, color: 'rgba(159,178,196,0.5)', fontFamily: FONT }}>· size = EV</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', border: '1px solid #24445f', borderRadius: 4, overflow: 'hidden' }}>
          {btn(mode === 'dots', () => setMode('dots'), 'Dots')}
          {btn(mode === 'zones', () => hasHand && setMode('zones'), 'Zones', !hasHand)}
        </div>
        {mode === 'dots' && (
          <div style={{ display: 'inline-flex', gap: 4 }}>
            {btn(filter === 'all', () => setFilter('all'), 'All')}
            {btn(filter === 'hits', () => setFilter('hits'), 'Hits')}
            {btn(filter === 'outs', () => setFilter('outs'), 'Outs')}
          </div>
        )}
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }} xmlns="http://www.w3.org/2000/svg">{body}</svg>
      {distBar}
    </div>
  );
}
