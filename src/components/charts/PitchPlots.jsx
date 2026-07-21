import React, { useMemo } from 'react';
import { pitchColor, normalizePitch } from '@/lib/ds';

const NAVY = '#0e253a';
const CHART_BG = '#ffffff';

const HIT_COLORS = {
  GB: '#8c6d3f',
  LD: '#2c7a4b',
  FB: '#2c6080',
  PU: '#9a9a9a',
};

function bipType(launch_angle) {
  if (launch_angle == null) return 'GB';
  if (launch_angle < 10) return 'GB';
  if (launch_angle < 25) return 'LD';
  if (launch_angle < 50) return 'FB';
  return 'PU';
}

// ── Shared helpers ──────────────────────────────────────────
function usePitchTypes(pitches) {
  return useMemo(() => {
    const map = {};
    pitches.forEach(p => {
      const pt = normalizePitch(p.tagged_pitch_type || p.pitch_type);
      if (!map[pt]) map[pt] = [];
      map[pt].push(p);
    });
    return map;
  }, [pitches]);
}

function Legend({ types, colorFn }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 8 }}>
      {Object.keys(types).map(pt => (
        <div key={pt} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#5a5a5a' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: (colorFn || pitchColor)(pt), flexShrink: 0 }} />
          {pt}
        </div>
      ))}
    </div>
  );
}

function ChartLabel({ children, sub }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: NAVY, letterSpacing: 0.3, textTransform: 'uppercase' }}>{children}</span>
      {sub && <span style={{ fontSize: 10.5, color: '#999', marginLeft: 6 }}>{sub}</span>}
    </div>
  );
}

// ── Movement Plot ───────────────────────────────────────────
export function MovementPlot({ pitches }) {
  const types = usePitchTypes(pitches);
  const W = 300, H = 260;
  const PAD = 36;
  const iW = W - PAD * 2, iH = H - PAD * 2;
  const RANGE = 25;
  const toSVG = (hb, ivb) => ({
    x: PAD + ((hb + RANGE) / (RANGE * 2)) * iW,
    y: PAD + ((RANGE - ivb) / (RANGE * 2)) * iH,
  });
  const cx = PAD + iW / 2;
  const cy = PAD + iH / 2;

  const total = pitches.length;
  const points = Object.entries(types).map(([pt, rows]) => {
    const hbs = rows.map(r => r.horz_break).filter(v => v != null);
    const ivbs = rows.map(r => r.induced_vert_break).filter(v => v != null);
    if (!hbs.length || !ivbs.length) return null;
    const hbMean = hbs.reduce((a, b) => a + b, 0) / hbs.length;
    const ivbMean = ivbs.reduce((a, b) => a + b, 0) / ivbs.length;
    return { pt, count: rows.length, ...toSVG(hbMean, ivbMean), hbMean, ivbMean };
  }).filter(Boolean);

  // Sort: least frequent first → most frequent last (renders on top)
  const sortedPoints = [...points].sort((a, b) => a.count - b.count);

  return (
    <div>
      <ChartLabel sub={`(HB × iVB, catcher's view · ${total} pitches)`}>Movement Profile</ChartLabel>
      <svg width={W} height={H} style={{ display: 'block', overflow: 'visible', background: CHART_BG, borderRadius: 6 }}>
        {/* Grid */}
        {[-20, -10, 0, 10, 20].map(v => {
          const { x } = toSVG(v, 0);
          const { y } = toSVG(0, v);
          return (
            <g key={v}>
              <line x1={x} y1={PAD} x2={x} y2={H - PAD} stroke="#eee" strokeWidth={1} strokeDasharray="3 3" />
              <line x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="#eee" strokeWidth={1} strokeDasharray="3 3" />
            </g>
          );
        })}
        {/* Reference lines */}
        <line x1={cx} y1={PAD} x2={cx} y2={H - PAD} stroke="#bbb" strokeWidth={1.5} />
        <line x1={PAD} y1={cy} x2={W - PAD} y2={cy} stroke="#bbb" strokeWidth={1.5} />
        {/* Axis labels */}
        <text x={cx} y={H - 6} textAnchor="middle" fontSize={9} fill="#999">Horizontal Break (in)</text>
        <text x={8} y={cy} textAnchor="middle" fontSize={9} fill="#999" transform={`rotate(-90,8,${cy})`}>iVB (in)</text>
        {/* Tick labels */}
        <text x={PAD} y={H - PAD + 14} textAnchor="middle" fontSize={8} fill="#bbb">-{RANGE}</text>
        <text x={W - PAD} y={H - PAD + 14} textAnchor="middle" fontSize={8} fill="#bbb">{RANGE}</text>
        <text x={PAD - 4} y={PAD + 4} textAnchor="end" fontSize={8} fill="#bbb">{RANGE}</text>
        <text x={PAD - 4} y={H - PAD + 4} textAnchor="end" fontSize={8} fill="#bbb">-{RANGE}</text>
        {/* Points: least frequent underneath, most frequent on top */}
        {sortedPoints.map(({ pt, x, y, hbMean, ivbMean }) => (
          <g key={pt}>
            <circle cx={x} cy={y} r={9} fill={pitchColor(pt)} fillOpacity={0.72} />
            <text x={x} y={y + 4} textAnchor="middle" fontSize={8} fontWeight="800" fill="#fff">{pt.slice(0, 2)}</text>
            <title>{pt}: HB {hbMean.toFixed(1)}", iVB {ivbMean.toFixed(1)}"</title>
          </g>
        ))}
      </svg>
      <Legend types={types} />
    </div>
  );
}

// ── Release Point ───────────────────────────────────────────
export function ReleasePointPlot({ pitches }) {
  const types = usePitchTypes(pitches);
  const W = 280, H = 220, PAD = 32;
  const iW = W - PAD * 2, iH = H - PAD * 2;

  const relSides = pitches.map(p => p.rel_side).filter(v => v != null);
  const relHeights = pitches.map(p => p.rel_height).filter(v => v != null);
  if (!relSides.length) return null;

  const xMin = Math.min(...relSides) - 0.2, xMax = Math.max(...relSides) + 0.2;
  const yMin = Math.max(0, Math.min(...relHeights) - 0.2), yMax = Math.min(8, Math.max(...relHeights) + 0.2);

  const toSVG = (rs, rh) => ({
    x: PAD + ((rs - xMin) / (xMax - xMin || 1)) * iW,
    y: PAD + ((yMax - rh) / (yMax - yMin || 1)) * iH,
  });

  return (
    <div>
      <ChartLabel>Release Point</ChartLabel>
      <svg width={W} height={H} style={{ display: 'block', overflow: 'visible', background: CHART_BG, borderRadius: 6 }}>
        <rect x={PAD} y={PAD} width={iW} height={iH} fill="none" stroke="#ddd" strokeWidth={1} />
        <text x={W / 2} y={H - 4} textAnchor="middle" fontSize={9} fill="#999">RelSide (ft)</text>
        <text x={8} y={H / 2} textAnchor="middle" fontSize={9} fill="#999" transform={`rotate(-90,8,${H / 2})`}>RelHeight (ft)</text>
        {pitches.map((p, i) => {
          if (p.rel_side == null || p.rel_height == null) return null;
          const pt = normalizePitch(p.tagged_pitch_type || p.pitch_type);
          const { x, y } = toSVG(p.rel_side, p.rel_height);
          return <circle key={i} cx={x} cy={y} r={2.5} fill={pitchColor(pt)} fillOpacity={0.7} />;
        })}
      </svg>
      <Legend types={types} />
    </div>
  );
}

// ── Strike Zone Plot ────────────────────────────────────────
const DARK_PITCH_COLORS = {
  Fastball:  '#ff6b6b',
  Sinker:    '#ff6b6b',
  Slider:    '#55efc4',
  Cutter:    '#74b9ff',
  Changeup:  '#74b9ff',
  ChangeUp:  '#74b9ff',
  Splitter:  '#55efc4',
  Curveball: '#ffeaa7',
  Sweeper:   '#a29bfe',
  Knuckleball: '#fd79a8',
};
function darkPitchColor(pt) {
  if (DARK_PITCH_COLORS[pt]) return DARK_PITCH_COLORS[pt];
  // Brighten fallback: use a saturated variant
  const base = pitchColor(pt);
  return base;
}

export function StrikeZonePlot({ pitches }) {
  const types = usePitchTypes(pitches);
  const W = 260, H = 260, PAD = 30;
  const iW = W - PAD * 2, iH = H - PAD * 2;

  const xMin = -2, xMax = 2, yMin = 0, yMax = 5;
  const toSVG = (pls, plh) => ({
    x: PAD + ((pls - xMin) / (xMax - xMin)) * iW,
    y: PAD + ((yMax - plh) / (yMax - yMin)) * iH,
  });

  const szLeft = toSVG(-0.83, 3.5), szRight = toSVG(0.83, 1.5);
  const szW = szRight.x - szLeft.x, szH = szRight.y - szLeft.y;

  // 3x3 inner grid lines
  const gridCols = [1, 2].map(i => szLeft.x + (szW / 3) * i);
  const gridRows = [1, 2].map(i => szLeft.y + (szH / 3) * i);

  // Home plate shape (centered below strike zone)
  const plateX = W / 2;
  const plateY = toSVG(0, 1.0).y;
  const pw = 20, ph = 10;
  const platePath = `M ${plateX - pw} ${plateY - ph} L ${plateX + pw} ${plateY - ph} L ${plateX + pw} ${plateY} L ${plateX} ${plateY + ph} L ${plateX - pw} ${plateY} Z`;

  return (
    <div>
      <ChartLabel>Strike Zone</ChartLabel>
      <svg width={W} height={H} style={{ display: 'block', overflow: 'visible', background: '#111111', borderRadius: 6 }}>
        {/* "catcher's view" label */}
        <text x={W / 2} y={PAD - 10} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.4)">catcher's view</text>
        {/* Outer plot border */}
        <rect x={PAD} y={PAD} width={iW} height={iH} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
        {/* Strike zone */}
        <rect x={szLeft.x} y={szLeft.y} width={szW} height={szH} fill="none" stroke="#ffffff" strokeWidth={1.8} />
        {/* 3x3 inner grid */}
        {gridCols.map(x => (
          <line key={x} x1={x} y1={szLeft.y} x2={x} y2={szRight.y} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
        ))}
        {gridRows.map(y => (
          <line key={y} x1={szLeft.x} y1={y} x2={szRight.x} y2={y} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
        ))}
        {/* Home plate */}
        <path d={platePath} fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth={1} />
        {/* Bottom label */}
        <text x={W / 2} y={H - 6} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.35)">Plate Side (ft)</text>
        {/* Pitch dots */}
        {pitches.map((p, i) => {
          if (p.plate_loc_side == null || p.plate_loc_height == null) return null;
          const pt = normalizePitch(p.tagged_pitch_type || p.pitch_type);
          const { x, y } = toSVG(p.plate_loc_side, p.plate_loc_height);
          return <circle key={i} cx={x} cy={y} r={2.5} fill={darkPitchColor(pt)} fillOpacity={0.85} />;
        })}
      </svg>
      <Legend types={types} colorFn={darkPitchColor} />
    </div>
  );
}

// ── Spray Chart ─────────────────────────────────────────────
export function SprayChart({ pitches }) {
  // Only InPlay pitches with valid bearing + hit_distance
  const bip = pitches.filter(p =>
    p.pitch_call === 'InPlay' &&
    typeof p.bearing === 'number' &&
    typeof p.hit_distance === 'number' &&
    p.hit_distance > 0
  );

  const W = 220, H = 200, PAD = 14;
  const CENTER_X = W / 2;
  const CENTER_Y = H - PAD;
  const maxD = 420;
  const SCALE = (H - PAD * 2) / maxD;

  const arcR = (H - PAD * 2) * 0.82;
  const startX = CENTER_X - Math.cos(Math.PI / 4) * arcR;
  const startY = CENTER_Y - Math.sin(Math.PI / 4) * arcR;
  const endX = CENTER_X + Math.cos(Math.PI / 4) * arcR;
  const endY = CENTER_Y - Math.sin(Math.PI / 4) * arcR;

  return (
    <div>
      <div style={{ fontSize: 10, color: '#888', textAlign: 'center', marginBottom: 4 }}>Spray chart</div>
      {bip.length === 0 ? (
        <div style={{ fontSize: 12, color: '#999', padding: '16px 0', fontStyle: 'italic', textAlign: 'center' }}>No ball-in-play data</div>
      ) : (
        <>
          <svg width={W} height={H} style={{ display: 'block', margin: '0 auto', overflow: 'visible' }}>
            {/* Outfield arc */}
            <path
              d={`M ${startX} ${startY} A ${arcR} ${arcR} 0 0 1 ${endX} ${endY} L ${CENTER_X} ${CENTER_Y} Z`}
              fill="#f3f6f1"
              stroke="#cdd8cd"
              strokeWidth={1.5}
            />
            {/* Foul lines */}
            <line x1={CENTER_X} y1={CENTER_Y} x2={startX} y2={startY} stroke="#cdd8cd" strokeWidth={1.5} />
            <line x1={CENTER_X} y1={CENTER_Y} x2={endX} y2={endY} stroke="#cdd8cd" strokeWidth={1.5} />
            {/* Infield diamond */}
            {(() => {
              const dd = 30;
              return (
                <polygon
                  points={`${CENTER_X},${CENTER_Y - dd} ${CENTER_X + dd},${CENTER_Y} ${CENTER_X},${CENTER_Y + dd} ${CENTER_X - dd},${CENTER_Y}`}
                  fill="none"
                  stroke="#cdd8cd"
                  strokeWidth={1.2}
                />
              );
            })()}
            {/* Batted balls */}
            {bip.map((p, i) => {
              const rad = (p.bearing * Math.PI) / 180;
              const d = Math.min(p.hit_distance, maxD) / maxD;
              const x = CENTER_X + Math.sin(rad) * d * (H - PAD * 2);
              const y = CENTER_Y - Math.cos(rad) * d * (H - PAD * 2);
              const type = bipType(p.launch_angle);
              const color = HIT_COLORS[type];
              return (
                <circle key={i} cx={x} cy={y} r={4} fill={color} fillOpacity={0.8} stroke="#fff" strokeWidth={0.5}>
                  <title>{type} · {Math.round(p.hit_distance)}ft · LA {p.launch_angle != null ? p.launch_angle.toFixed(0) + '°' : '?'} · EV {p.exit_speed != null ? p.exit_speed.toFixed(0) + ' mph' : '?'}</title>
                </circle>
              );
            })}
          </svg>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', marginTop: 6, justifyContent: 'center' }}>
            {Object.entries(HIT_COLORS).map(([ht, c]) => (
              <div key={ht} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#666' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
                {ht}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}