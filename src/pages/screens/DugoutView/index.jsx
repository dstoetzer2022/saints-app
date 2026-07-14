import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { base44 } from '@/api/base44Client';
import { buildScene, buildPitcherForScene, colorFor, makeCycle } from '@/lib/pitch3dEngine';
import { normalizePitch } from '@/lib/ds';
import { isStrike, isSwing as isSwingRow, isWhiff, normHand, buildZoneCounts } from '@/lib/statsUtils';
import { fetchAllFiltered } from '@/lib/fetchAll';
import { applyArsenalCorrection, correctMistaggedPitches } from '@/lib/arsenalCorrection';
import { dugoutVideoUrl } from '@/lib/cloudinaryVideo';
import HitterDugoutPanel from '@/components/dugout/HitterDugoutPanel';
import { colorAt } from '@/components/dugout/HitterViz';

const FONT = "'Archivo', system-ui, sans-serif";
const pitchHex = t => colorFor(t || '');

function toLastFirst(name) {
  if (!name) return '';
  if (name.includes(',')) return name.trim();
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name.trim();
  return `${parts[parts.length - 1]}, ${parts.slice(0, -1).join(' ')}`;
}
function canonicalKey(name) {
  if (!name) return '';
  const lf = toLastFirst(name);
  const [last, first] = lf.split(',').map(s => s.trim().toLowerCase());
  return `${last || ''}|${first || ''}`;
}

const sign = v => v == null ? '—' : (v >= 0 ? '+' : '') + Number(v).toFixed(1);
const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

// ── Team logo ─────────────────────────────────────────────────
function TeamLogo({ logoUrl, teamName, size = 54 }) {
  const [failed, setFailed] = useState(false);
  const initials = teamName ? teamName.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase() : '?';
  const st = { width: size, height: size, borderRadius: '50%', background: '#13314e', border: '2px solid #b8860b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#c6b583', fontFamily: FONT, fontWeight: 800, flexShrink: 0, objectFit: 'contain' };
  if (failed || !logoUrl) return <div style={st}>{initials}</div>;
  return <img src={logoUrl} alt={teamName} onError={() => setFailed(true)} style={st} />;
}

// ── Cycle controller ──────────────────────────────────────────
// ── Build pitcher from curated trails ─────────────────────────
function buildPitcherFromCurated(pitcherName, pitcherHand, trails) {
  const pitches = trails.map(t => {
    const speed = t.rel_speed != null ? parseFloat(t.rel_speed) : 88;
    const ivb = t.induced_vert_break != null ? parseFloat(t.induced_vert_break) : null;
    const hb = t.horz_break != null ? parseFloat(t.horz_break) : null;
    const relH = t.rel_height != null ? parseFloat(t.rel_height) : 6.0;
    const relS = t.rel_side != null ? parseFloat(t.rel_side) : 0;
    const ext = t.extension != null ? parseFloat(t.extension) : null;
    const plH = t.plate_loc_height != null ? parseFloat(t.plate_loc_height) : null;
    const plS = t.plate_loc_side != null ? parseFloat(t.plate_loc_side) : null;
    const spinAxis = t.spin_axis != null ? parseFloat(t.spin_axis) : null;
    const relY_ = ext != null ? 60.5 - ext : 54;
    const vy0_ = -speed * 1.467, ay_ = 10.0;
    const dsc_ = vy0_ * vy0_ - 4 * (0.5 * ay_) * relY_;
    let tf = dsc_ > 0 ? (-vy0_ - Math.sqrt(dsc_)) / ay_ : 0.45;
    if (!(tf > 0 && tf < 1.2)) tf = 0.45;
    const ax_ = hb != null ? 2 * (hb / 12) / (tf * tf) : 0;
    const az_ = -32.174 + (ivb != null ? 2 * (ivb / 12) / (tf * tf) : 0);
    const targetZ_ = plH ?? 2.5, targetX_ = plS ?? (relS + (hb != null ? hb / 12 : 0));
    const vz0_ = (targetZ_ - relH - 0.5 * az_ * tf * tf) / tf;
    const vx0_ = (targetX_ - relS - 0.5 * ax_ * tf * tf) / tf;
    const path = [];
    for (let i = 0; i <= 90; i++) {
      const ts = (tf * i) / 90;
      path.push({ d: relY_ + vy0_ * ts, h: relH + vz0_ * ts + 0.5 * az_ * ts * ts, s: relS + vx0_ * ts + 0.5 * ax_ * ts * ts });
    }
    return {
      type: t.pitch_type, displayColor: t.trail_color || '#888888', count: 1,
      speed: +speed.toFixed(1), spin: t.spin_rate != null ? Math.round(parseFloat(t.spin_rate)) : 0,
      spinAxis: spinAxis != null ? +spinAxis.toFixed(0) : null,
      ivb: ivb != null ? +ivb.toFixed(1) : 0, hb: hb != null ? +hb.toFixed(1) : 0,
      path, tflight: +tf.toFixed(3), usage: 1 / trails.length,
    };
  });
  return { name: pitcherName, throws: pitcherHand?.[0]?.toUpperCase() || 'R', total: trails.length, pitches, allPitches: [] };
}

// ── 3D canvas ─────────────────────────────────────────────────
function DugoutPitch3D({ arsenal, pitcherName, pitcherHand, curatedTrails, onActiveIdx }) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cycleRef = useRef(null);
  const isCurated = curatedTrails && curatedTrails.length > 0;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    if (cycleRef.current) { cycleRef.current.stop(); cycleRef.current = null; }
    if (sceneRef.current) { sceneRef.current.dispose(); sceneRef.current = null; }
    const pitcher = isCurated
      ? buildPitcherFromCurated(pitcherName, pitcherHand, curatedTrails)
      : buildPitcherForScene(pitcherName, pitcherHand, arsenal, []);
    if (!pitcher || !pitcher.pitches.length) { if (onActiveIdx) onActiveIdx(0); return; }
    if (onActiveIdx) onActiveIdx(0);
    const scene3d = buildScene(THREE, mount, pitcher, { mode: 'avg' });
    scene3d.setCam('catcher');
    sceneRef.current = scene3d;
    cycleRef.current = makeCycle(scene3d, pitcher.pitches.length, onActiveIdx, 5000);
    return () => {
      if (cycleRef.current) { cycleRef.current.stop(); cycleRef.current = null; }
      if (sceneRef.current) { sceneRef.current.dispose(); sceneRef.current = null; }
    };
  }, [pitcherName, curatedTrails.map(t => t.id || t.pitch_type).join(','), isCurated ? curatedTrails.length : arsenal.map(a => a.pitch_type).join(',')]);

  return <div ref={mountRef} style={{ width: '100%', height: '100%', cursor: 'grab' }} />;
}

// ── UI panels ─────────────────────────────────────────────────
function Panel({ children, style }) {
  return (
    <div style={{ background: 'linear-gradient(160deg, #13314e 0%, #0e253a 100%)', border: '1px solid rgba(198,181,131,.18)', borderRadius: 12, padding: '14px 16px', ...style }}>
      {children}
    </div>
  );
}
// ── Header stat pill (season rates, moved up from the old RatesPanel) ──
function statTier(value, avgThresh, goodThresh) {
  if (value == null) return null;
  return Math.max(0, Math.min(1, (value - avgThresh) / (goodThresh - avgThresh)));
}
function HeaderStatPill({ label, value, suffix = '%', avg: avgThresh, good, last }) {
  const t = statTier(value, avgThresh, good);
  const bg = t != null ? (() => { const [r, g, b] = colorAt(t); return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},.22)`; })() : 'transparent';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2px 12px', borderRight: last ? 'none' : '1px solid #1c3f5e', background: bg, transition: 'background 0.3s' }}>
      <span style={{ fontSize: 18, fontWeight: 800, color: '#eae5d8', fontFamily: FONT, fontVariantNumeric: 'tabular-nums', lineHeight: 1.15 }}>
        {value == null ? '—' : `${Math.round(value)}${suffix}`}
      </span>
      <span style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: '#7d93a6', fontWeight: 700, marginTop: 2, fontFamily: FONT }}>{label}</span>
    </div>
  );
}

function PanelHeading({ children }) {
  return <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: '#c6b583', marginBottom: 12, fontFamily: FONT }}>{children}</div>;
}

function ArsenalPanel({ arsenal, activeIdx, curatedColorMap }) {
  return (
    <Panel style={{ flex: '0 0 auto' }}>
      <PanelHeading>Season Arsenal — by usage</PanelHeading>
      {arsenal.length === 0 && <div style={{ fontSize: 13, color: '#7d93a6', fontStyle: 'italic', fontFamily: FONT }}>No season data yet</div>}
      {arsenal.length > 0 && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 52px 58px 56px 52px 52px 54px', gap: '0 6px', paddingBottom: 6, borderBottom: '0.5px solid rgba(255,255,255,.08)', marginBottom: 2 }}>
            {['Pitch', 'Usage', 'Velo', 'Spin', 'HB', 'IVB', 'Strike%'].map(h => (
              <div key={h} style={{ fontSize: 10, fontWeight: 800, color: '#7d93a6', textTransform: 'uppercase', letterSpacing: 1, fontFamily: FONT, textAlign: h === 'Pitch' ? 'left' : 'right' }}>{h}</div>
            ))}
          </div>
          {arsenal.map((p, i) => {
            const col = (curatedColorMap && curatedColorMap[p.pitch_type]) || pitchHex(p.pitch_type);
            const isActive = i === activeIdx;
            const usagePct = p.usage_pct == null ? null : (p.usage_pct > 1 ? p.usage_pct : p.usage_pct * 100);
            const isFB = ['Fastball', 'FourSeamFastBall', 'Four-Seam', 'FF', 'Sinker', 'TwoSeamFastBall', 'Two-Seam', 'SI'].includes(p.pitch_type);
            return (
              <div key={p.pitch_type} style={{ display: 'grid', gridTemplateColumns: '1.4fr 52px 58px 56px 52px 52px 54px', gap: '0 6px', padding: '9px 8px', borderRadius: 7, marginBottom: 2, background: isActive ? 'rgba(198,181,131,.14)' : 'transparent', boxShadow: isActive ? 'inset 3px 0 0 #b8860b' : 'none', transition: 'background 0.3s, box-shadow 0.3s', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <div style={{ width: 9, height: 9, borderRadius: '50%', background: col, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#eae5d8', fontFamily: FONT }}>{p.pitch_type}</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(usagePct || 0, 100)}%`, height: '100%', background: col, borderRadius: 3 }} />
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#aab', fontFamily: FONT }}>{usagePct != null ? Math.round(usagePct) + '%' : '—'}</div>
                <div style={{ textAlign: 'right', fontFamily: FONT, fontVariantNumeric: 'tabular-nums' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{p.velo_mean != null ? Number(p.velo_mean).toFixed(1) : '—'}</div>
                  {isFB && p.velo_max != null && <div style={{ fontSize: 10, fontWeight: 600, color: '#f59e0b' }}>▲{Number(p.velo_max).toFixed(1)}</div>}
                </div>
                <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#c6b583', fontFamily: FONT, fontVariantNumeric: 'tabular-nums' }}>{p.spin_mean != null ? Math.round(p.spin_mean) : '—'}</div>
                <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#94a3b8', fontFamily: FONT, fontVariantNumeric: 'tabular-nums' }}>{sign(p.horz_break_mean)}</div>
                <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#94a3b8', fontFamily: FONT, fontVariantNumeric: 'tabular-nums' }}>{sign(p.vert_break_mean)}</div>
                <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#4ade80', fontFamily: FONT, fontVariantNumeric: 'tabular-nums' }}>{p.strike_pct != null ? Number(p.strike_pct).toFixed(1) + '%' : '—'}</div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function StatBar({ label, value, good, avg: avgThresh }) {
  const pct = value == null ? null : Math.round(value);
  // Continuous blue → white → red scale, anchored to the same good/avg
  // thresholds the bars already used — avg threshold = blue, good threshold = red.
  const t = pct == null ? 0.5 : Math.max(0, Math.min(1, (pct - avgThresh) / (good - avgThresh)));
  const [cr, cg, cb] = colorAt(t);
  const color = pct == null ? '#555' : `rgb(${Math.round(cr)},${Math.round(cg)},${Math.round(cb)})`;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <div style={{ width: 92, textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#8a9aaa', fontFamily: FONT, flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, height: 16, background: 'rgba(255,255,255,.07)', borderRadius: 8, position: 'relative', overflow: 'visible' }}>
        {pct != null && (
          <>
            <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: color, borderRadius: 8, transition: 'width 0.4s ease' }} />
            <div style={{ position: 'absolute', right: `${100 - Math.min(pct, 100)}%`, top: '50%', transform: 'translate(50%, -50%)', width: 24, height: 24, borderRadius: '50%', background: '#0e253a', border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color, fontFamily: FONT }}>{pct}</div>
          </>
        )}
      </div>
      <div style={{ width: 42, textAlign: 'right', fontSize: 15, fontWeight: 800, color: pct == null ? '#555' : color, fontFamily: FONT, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
        {pct == null ? '—' : `${pct}%`}
      </div>
    </div>
  );
}

function RatesPanel({ rates }) {
  const r = rates || {};
  const ROWS = [
    { label: 'Strike%',      value: r.strike_pct,             good: 64, avg: 58 },
    { label: '1st-Pitch K%', value: r.first_pitch_strike_pct, good: 60, avg: 52 },
    { label: 'CSW%',         value: r.csw_pct,                good: 30, avg: 24 },
    { label: 'Whiff%',       value: r.whiff_pct,              good: 28, avg: 21 },
    { label: 'Zone%',        value: r.zone_pct,               good: 52, avg: 45 },
    { label: 'Chase%',       value: r.chase_pct,              good: 30, avg: 24 },
  ];
  return (
    <Panel style={{ flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <PanelHeading style={{ margin: 0 }}>Season Rates</PanelHeading>
        {r.total_pitches != null && (
          <span style={{ fontSize: 10, fontWeight: 700, color: '#7d93a6', fontFamily: FONT }}>{r.total_pitches} pitches</span>
        )}
      </div>
      {ROWS.map(row => <StatBar key={row.label} label={row.label} value={row.value} good={row.good} avg={row.avg} />)}
    </Panel>
  );
}

function NowShowing({ pitch, colorOverride }) {
  if (!pitch) return null;
  const col = colorOverride || pitch.trail_color || pitchHex(pitch.pitch_type);
  return (
    <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 10, background: 'rgba(8,20,30,.82)', border: `1px solid ${col}55`, borderRadius: 8, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 7 }}>
      <div style={{ width: 9, height: 9, borderRadius: '50%', background: col, flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: '#8a9aaa', textTransform: 'uppercase', fontFamily: FONT }}>Now Showing</div>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#eae5d8', fontFamily: FONT }}>{pitch.pitch_type}</div>
      </div>
    </div>
  );
}

function Legend({ arsenal, colorOverrides }) {
  if (!arsenal.length) return null;
  return (
    <div style={{ position: 'absolute', bottom: 12, left: 12, zIndex: 10, background: 'rgba(8,20,30,.8)', border: '0.5px solid rgba(198,181,131,.2)', borderRadius: 8, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      {arsenal.map(p => {
        const col = (colorOverrides && colorOverrides[p.pitch_type]) || p._color || pitchHex(p.pitch_type);
        return (
          <div key={p.pitch_type} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: col, flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#c6c0b2', fontFamily: FONT }}>{p.pitch_type}</span>
          </div>
        );
      })}
    </div>
  );
}

function ModeBadge({ isCurated }) {
  return (
    <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, background: isCurated ? '#0F6E56' : '#888780', color: isCurated ? '#E1F5EE' : '#F1EFE8', borderRadius: 6, padding: '4px 9px', fontSize: 12, fontWeight: 700, fontFamily: FONT }}>
      {isCurated ? '✓ Curated' : 'Auto'}
    </div>
  );
}

// ── Pitch Metrics Board — one row per pitch type: chip, location heatmap,
// stat strip, hand-split bars. Replaces the old ChipFooter/StatFooter pair
// (previously two separate strips you had to visually align by eye).
// Font sizes match the approved mockup: pitch-type label and metric numbers
// are the primary scan targets and are sized well above the support text.
const ZONE_GRID_ORDER = [7, 8, 9, 4, 5, 6, 1, 2, 3]; // top-left→bottom-right render order; zone 1-9 numbering is bottom-left→top-right

function pctBar(hex, count, denom) {
  if (!denom) return null;
  return Math.round((count / denom) * 100);
}

function PitchHeatmap({ zoneCounts, colorHex }) {
  const counts = ZONE_GRID_ORDER.map(z => (zoneCounts && zoneCounts[z]) || 0);
  const max = Math.max(...counts, 1);
  return (
    <div style={{ width: 62, flexShrink: 0, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(3, 1fr)', gap: 2, padding: 6, background: 'rgba(255,255,255,.03)', borderRadius: 6 }}>
      {counts.map((c, i) => (
        <div key={i} style={{ borderRadius: 2, background: `${colorHex}${Math.round((c / max) * 0.85 * 255 + (c ? 25 : 0)).toString(16).padStart(2, '0')}` }} />
      ))}
    </div>
  );
}

function HandSplitStrip({ pitch }) {
  const rhhPct = pctBar(null, pitch?.rhh_count, pitch?.rhh_count + pitch?.lhh_count) ?? pctBar(null, pitch?.rhh_count, pitch?.count);
  const lhhPct = pctBar(null, pitch?.lhh_count, pitch?.rhh_count + pitch?.lhh_count) ?? pctBar(null, pitch?.lhh_count, pitch?.count);
  const hasData = (pitch?.rhh_count || 0) + (pitch?.lhh_count || 0) > 0;
  return (
    <div style={{ width: 168, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 3, justifyContent: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700 }}>
        <span style={{ width: 26, color: '#eae5d8', fontWeight: 800 }}>RHH</span>
        <div style={{ flex: 1, height: 11, background: 'rgba(255,255,255,.06)', borderRadius: 5, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 5, width: `${hasData ? rhhPct : 0}%`, background: '#93c5fd' }} />
        </div>
        <span style={{ width: 38, textAlign: 'right', color: '#eae5d8', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{hasData ? `${rhhPct}%` : '—'}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700 }}>
        <span style={{ width: 26, color: '#eae5d8', fontWeight: 800 }}>LHH</span>
        <div style={{ flex: 1, height: 11, background: 'rgba(255,255,255,.06)', borderRadius: 5, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 5, width: `${hasData ? lhhPct : 0}%`, background: '#a78bfa' }} />
        </div>
        <span style={{ width: 38, textAlign: 'right', color: '#eae5d8', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{hasData ? `${lhhPct}%` : '—'}</span>
      </div>
    </div>
  );
}

function PitchMetricsRow({ pitch, isActive, colorHex }) {
  const usagePct = pitch.usage_pct == null ? null : (pitch.usage_pct > 1 ? pitch.usage_pct : pitch.usage_pct * 100);
  const cells = [
    { label: 'velo', value: pitch.velo_mean != null ? Number(pitch.velo_mean).toFixed(1) : '—' },
    { label: 'ivb / hb', value: `${sign(pitch.vert_break_mean)} / ${sign(pitch.horz_break_mean)}` },
    { label: 'strike%', value: pitch.strike_pct != null ? Number(pitch.strike_pct).toFixed(0) + '%' : '—', color: '#4ade80' },
    { label: 'whiff%', value: pitch.whiff_pct != null ? Number(pitch.whiff_pct).toFixed(0) + '%' : '—' },
  ];
  return (
    <div style={{
      display: 'flex', gap: 16, alignItems: 'stretch', borderRadius: 10, padding: 18,
      background: isActive ? 'rgba(198,146,12,.06)' : 'rgba(255,255,255,.02)',
      border: isActive ? '1px solid #c6b583' : '1px solid rgba(255,255,255,.06)',
      transition: 'background 0.3s, border 0.3s',
    }}>
      <div style={{ width: 130, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 8, padding: '10px 4px', background: `${colorHex}33`, border: `1px solid ${colorHex}` }}>
        <div style={{ fontSize: 32, fontWeight: 900, lineHeight: 1.1, letterSpacing: '-0.5px', color: colorHex, fontFamily: FONT }}>{abbrPitch(pitch.pitch_type)}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#c6b583', fontFamily: FONT, lineHeight: 1.2 }}>{usagePct != null ? Math.round(usagePct) + '%' : '—'}</div>
      </div>
      <PitchHeatmap zoneCounts={pitch.zone_counts} colorHex={colorHex} />
      <div style={{ flex: 1, display: 'flex', gap: 6, minWidth: 0 }}>
        {cells.map(c => (
          <div key={c.label} style={{ flex: 1, textAlign: 'center', padding: '12px 4px', borderRadius: 7, background: 'rgba(198,146,12,.08)', border: '1px solid rgba(198,146,12,.25)' }}>
            <div style={{ fontSize: 27, fontWeight: 900, lineHeight: 1.1, letterSpacing: '-0.3px', color: c.color || '#f0d68a', fontFamily: FONT }}>{c.value}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#c6b583', fontFamily: FONT, textTransform: 'uppercase', letterSpacing: 0.4, lineHeight: 1.3, marginTop: 4 }}>{c.label}</div>
          </div>
        ))}
      </div>
      <HandSplitStrip pitch={pitch} />
    </div>
  );
}

function PitchMetricsBoard({ pitches, activePitchType, colorOverrides }) {
  if (!pitches.length) return null;
  const sorted = [...pitches].sort((a, b) => (b.usage_pct || 0) - (a.usage_pct || 0));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {sorted.map((p, i) => {
        const colorHex = (colorOverrides && colorOverrides[p.pitch_type]) || p._color || pitchHex(p.pitch_type);
        const isActive = normalizePitch(p.pitch_type) === normalizePitch(activePitchType);
        return <PitchMetricsRow key={p.pitch_type + i} pitch={p} isActive={isActive} colorHex={colorHex} />;
      })}
    </div>
  );
}

// ── Video panel — plays the clip for the currently active pitch type ──
function VideoPanel({ videoUrl, pitchType, orientation }) {
  const [failed, setFailed] = useState(false);
  const src = failed ? videoUrl : dugoutVideoUrl(videoUrl, orientation);
  return (
    <div style={{ flex: 1, background: '#050d13', border: '1px solid rgba(198,181,131,.15)', borderRadius: 10, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
      {src ? (
        <video
          key={pitchType + src}
          src={src}
          autoPlay muted loop playsInline
          onError={() => { if (!failed) setFailed(true); }}
          style={{ width: '100%', height: '100%', objectFit: failed ? 'contain' : 'cover' }}
        />
      ) : (
        <div style={{ color: 'rgba(198,181,131,.35)', fontSize: 13, fontFamily: FONT, fontStyle: 'italic' }}>
          {pitchType ? `No clip for ${pitchType}` : 'No pitch active'}
        </div>
      )}
    </div>
  );
}


// ── Count Splits Panel ────────────────────────────────────────
// Abbreviated pitch type label
function abbrPitch(pt) {
  const map = { 'Four-Seam': 'FF', Fastball: 'FF', Sinker: 'SI', Cutter: 'CT', Slider: 'SL', Sweeper: 'SW', Curveball: 'CB', Knucklecurve: 'KC', ChangeUp: 'CH', Changeup: 'CH', Splitter: 'FS' };
  return map[pt] || pt.slice(0, 2).toUpperCase();
}

function CountSplitsPanel({ arsenal }) {
  const splits = arsenal
    .filter(p => p.pitch_type && ((p.ahead_count || 0) + (p.even_count || 0) + (p.behind_count || 0) + (p.first_pitch_count || 0)) > 0)
    .sort((a, b) => (b.ahead_count || 0) + (b.even_count || 0) + (b.behind_count || 0)
                  - ((a.ahead_count || 0) + (a.even_count || 0) + (a.behind_count || 0)));

  if (!splits.length) return null;

  const totals = {
    firstPitch: splits.reduce((s, p) => s + (p.first_pitch_count || 0), 0),
    ahead:  splits.reduce((s, p) => s + (p.ahead_count  || 0), 0),
    even:   splits.reduce((s, p) => s + (p.even_count   || 0), 0),
    behind: splits.reduce((s, p) => s + (p.behind_count || 0), 0),
    twoStrike: splits.reduce((s, p) => s + (p.two_strike_count || 0), 0),
  };

  const rows = [
    { label: '1ST PITCH', sub: '0-0 count',     key: 'first_pitch_count', total: totals.firstPitch, accent: '#93c5fd', dim: 'rgba(147,197,253,.12)' },
    { label: 'AHEAD',  sub: 'More strikes',  key: 'ahead_count',  total: totals.ahead,  accent: '#4ade80', dim: 'rgba(74,222,128,.12)' },
    { label: 'EVEN',   sub: 'Balls = strikes', key: 'even_count',   total: totals.even,   accent: '#c6b583', dim: 'rgba(198,181,131,.12)' },
    { label: 'BEHIND', sub: 'More balls',    key: 'behind_count', total: totals.behind, accent: '#f87171', dim: 'rgba(248,113,113,.12)' },
    // Cross-cuts the four buckets above rather than replacing one (0-2/1-2
    // count as both "Ahead" and "2 Strikes" — see PitcherArsenal.two_strike_count's
    // own field description) — violet keeps it visually distinct as an
    // overlapping "putaway chances" lens rather than a 5th exclusive bucket.
    { label: '2 STRIKES', sub: 'Putaway chances', key: 'two_strike_count', total: totals.twoStrike, accent: '#a78bfa', dim: 'rgba(167,139,250,.14)' },
  ].filter(r => r.total > 0);

  return (
    <div style={{ flexShrink: 0, padding: '0 16px 14px', display: 'flex', gap: 10 }}>
      {rows.map(({ label, sub, key, total, accent, dim }) => {
        const ordered = [...splits]
          .filter(p => (p[key] || 0) > 0)
          .sort((a, b) => (b[key] || 0) - (a[key] || 0));
        return (
          <div key={label} style={{ flex: 1, background: dim, border: `1px solid ${accent}30`, borderRadius: 10, padding: '10px 12px', minWidth: 0 }}>
            {/* Count situation label */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 900, color: accent, letterSpacing: 1.5, fontFamily: FONT }}>{label}</span>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,.3)', fontFamily: FONT, fontWeight: 600 }}>{total} pitches</span>
            </div>
            {/* Segmented bar — tall and bold */}
            <div style={{ display: 'flex', height: 36, borderRadius: 6, overflow: 'hidden', marginBottom: 10, gap: 1 }}>
              {ordered.map(p => {
                const pct = total > 0 ? (p[key] || 0) / total : 0;
                if (pct < 0.02) return null;
                const col = pitchHex(p.pitch_type);
                return (
                  <div key={p.pitch_type} style={{ flex: pct, background: col, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 0, overflow: 'hidden', borderRadius: 3 }}>
                    {pct >= 0.10 && <>
                      <span style={{ fontSize: 15, fontWeight: 900, color: '#fff', fontFamily: FONT, lineHeight: 1, textShadow: '0 1px 4px rgba(0,0,0,.7)' }}>{abbrPitch(p.pitch_type)}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.85)', fontFamily: FONT, lineHeight: 1, marginTop: 2, textShadow: '0 1px 4px rgba(0,0,0,.7)' }}>{Math.round(pct * 100)}%</span>
                    </>}
                    {pct >= 0.05 && pct < 0.10 && (
                      <span style={{ fontSize: 12, fontWeight: 900, color: 'rgba(255,255,255,.9)', fontFamily: FONT, textShadow: '0 1px 3px rgba(0,0,0,.7)' }}>{Math.round(pct * 100)}%</span>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Pitch legend row */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {ordered.map(p => {
                const pct = total > 0 ? (p[key] || 0) / total : 0;
                if (pct < 0.03) return null;
                const col = pitchHex(p.pitch_type);
                return (
                  <div key={p.pitch_type} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: col, flexShrink: 0 }} />
                    <span style={{ fontSize: 14, fontWeight: 800, color: col, fontFamily: FONT }}>{abbrPitch(p.pitch_type)}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,.55)', fontFamily: FONT }}>{Math.round(pct * 100)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function DugoutView({ setScreen }) {
  const [allTeams, setAllTeams] = useState([]);
  const [pitcherObs, setPitcherObs] = useState(null);
  const [seasonArsenal, setSeasonArsenal] = useState([]);
  const [seasonRates, setSeasonRates] = useState(null);
  const [curatedTrails, setCuratedTrails] = useState([]);
  const [liveGameId, setLiveGameId] = useState(null);
  const [dugoutMode, setDugoutMode] = useState('pitcher'); // 'pitcher' | 'hitter' — controlled remotely
  const [orientation, setOrientation] = useState('horizontal'); // 'horizontal' | 'vertical' — controlled remotely
  const [activeArsenalIdx, setActiveArsenalIdx] = useState(0);

  const livePollingRef = useRef(null);
  const teamByName = useCallback(name => allTeams.find(t => t.name === name), [allTeams]);
  const teamByCode = useCallback(code => allTeams.find(t => t.trackman_code === code || t.code === code), [allTeams]);

  // Load season data for a given pitcher name (as stored in PitcherObservation)
  const loadSeasonData = useCallback(async (pitcherName, teamTrackmanCode, teamFullName) => {
    if (!pitcherName) { setSeasonArsenal([]); setSeasonRates(null); setCuratedTrails([]); return; }
    const lastFirst = toLastFirst(pitcherName);
    const key = canonicalKey(pitcherName);

    // Curated trails may be stored with full team name OR trackman code — try both
    const [arsenalRaw, ratesRaw, curatedByCode, curatedByName, videoClipsRaw] = await Promise.all([
      base44.entities.PitcherArsenal.filter(
        { game_id: 'season', pitcher_name: lastFirst, pitcher_team: teamTrackmanCode },
        '-created_date', 50
      ).catch(() => []),
      base44.entities.PitcherSeasonRates.filter(
        { pitcher_name: lastFirst, pitcher_team: teamTrackmanCode },
        '-updated_date', 5
      ).catch(() => []),
      base44.entities.CuratedDugoutTrail.filter(
        { pitcher_name: lastFirst, pitcher_team: teamTrackmanCode, active: true },
        'display_order', 50
      ).catch(() => []),
      teamFullName && teamFullName !== teamTrackmanCode
        ? base44.entities.CuratedDugoutTrail.filter(
            { pitcher_name: lastFirst, pitcher_team: teamFullName, active: true },
            'display_order', 50
          ).catch(() => [])
        : Promise.resolve([]),
      // Video clips live in their own entity, decoupled from PitcherArsenal —
      // season rows get wiped/regenerated on every Trackman resync, which was
      // silently deleting attached video_url values. This table survives that.
      base44.entities.PitcherVideoClip.filter(
        { pitcher_name: lastFirst, pitcher_team: teamTrackmanCode }, null, 50
      ).catch(() => []),
    ]);

    // Fallback: broader search by canonical key if exact query missed
    let arsenal = arsenalRaw || [];
    let ratesArr = ratesRaw || [];
    if (!arsenal.length) {
      const broader = await base44.entities.PitcherArsenal.filter({ game_id: 'season' }, '-created_date', 500).catch(() => []);
      arsenal = broader.filter(r => canonicalKey(r.pitcher_name) === key);
    }
    if (!ratesArr.length) {
      const broader = await base44.entities.PitcherSeasonRates.list('-updated_date', 200).catch(() => []);
      ratesArr = broader.filter(r => canonicalKey(r.pitcher_name) === key);
    }

    // Last resort: compute live from TrackmanPitch if still no arsenal rows
    // This handles pitchers whose aggregation hasn't run yet
    if (!arsenal.length) {
      // AUDIT: shared classifiers (V2+V3 spellings); location-gated denominators.
      const inZone = r => { const h = parseFloat(r.plate_loc_height), s = parseFloat(r.plate_loc_side); return Number.isFinite(h) && Number.isFinite(s) && h >= 1.5 && h <= 3.5 && s >= -0.83 && s <= 0.83; };
      const hasLoc = r => Number.isFinite(parseFloat(r.plate_loc_height)) && Number.isFinite(parseFloat(r.plate_loc_side));

      // Try both name forms against TrackmanPitch — paginated (was capped at 500)
      const firstLastForm = lastFirst.includes(',') ? lastFirst.split(',').map(s=>s.trim()).reverse().join(' ') : lastFirst;
      const [tp1, tp2] = await Promise.all([
        fetchAllFiltered(base44.entities.TrackmanPitch, { pitcher_name: lastFirst }, '-created_date'),
        firstLastForm !== lastFirst
          ? fetchAllFiltered(base44.entities.TrackmanPitch, { pitcher_name: firstLastForm }, '-created_date')
          : Promise.resolve([]),
      ]);
      const allRows = [...(tp1||[]), ...(tp2||[])].filter((r,i,a) => a.findIndex(x=>x.id===r.id)===i);

      // This fallback only fires when PitcherArsenal has no season rows for
      // this pitcher yet (aggregation hasn't run), which means it's reading
      // raw tagged_pitch_type directly — the same correction rebuildPitcherSeason
      // applies before building those rows needs to happen here too, or a
      // pitcher who's missed a rebuild would show his RAW mistagged arsenal
      // on the dugout TV instead of a corrected one. In-memory only.
      const { data: mergedRows } = applyArsenalCorrection(allRows);
      const { data: correctedRows } = correctMistaggedPitches(mergedRows);

      if (correctedRows.length) {
        const total = correctedRows.length;
        const groups = {};
        for (const r of correctedRows) {
          const pt = normalizePitch(r.tagged_pitch_type || r.pitch_type || 'Unknown');
          (groups[pt] = groups[pt] || []).push(r);
        }
        // AUDIT: old safeMean filtered x>0, which dropped every negative
        // horz_break / induced_vert_break (all glove-side break, all curveball
        // IVB) — the fallback arsenal showed wildly wrong movement on the TV.
        const finiteMean = arr => { const v=arr.map(Number).filter(Number.isFinite); return v.length?v.reduce((a,b)=>a+b,0)/v.length:null; };
        const posMean    = arr => { const v=arr.map(Number).filter(x=>Number.isFinite(x)&&x>0); return v.length?v.reduce((a,b)=>a+b,0)/v.length:null; };
        arsenal = Object.entries(groups).map(([pitch_type, rs]) => {
          const velos = rs.map(r=>parseFloat(r.rel_speed)).filter(v=>v>0);
          const strikes = rs.filter(isStrike).length;
          const swings = rs.filter(isSwingRow).length;
          const whiffs = rs.filter(isWhiff).length;
          let ahead_count=0, even_count=0, behind_count=0, first_pitch_count=0, two_strike_count=0;
          let lhh_count=0, lhh_strike_count=0, rhh_count=0, rhh_strike_count=0;
          for (const r of rs) {
            const b=r.balls??0, s=r.strikes??0;
            if (b===0 && s===0) first_pitch_count++;
            if (s>b) ahead_count++; else if (b>s) behind_count++; else even_count++;
            if (s===2) two_strike_count++;
            const hand = normHand(r.batter_hand);
            if (hand==='L') { lhh_count++; if (isStrike(r)) lhh_strike_count++; }
            else if (hand==='R') { rhh_count++; if (isStrike(r)) rhh_strike_count++; }
          }
          return {
            pitch_type, count: rs.length,
            usage_pct: rs.length/total*100,
            total_pitches: total,
            velo_mean: posMean(velos),
            velo_max: velos.length?Math.max(...velos):null,
            spin_mean: posMean(rs.map(r=>parseFloat(r.spin_rate))),
            horz_break_mean: finiteMean(rs.map(r=>parseFloat(r.horz_break))),
            vert_break_mean: finiteMean(rs.map(r=>parseFloat(r.induced_vert_break))),
            strike_pct: rs.length?strikes/rs.length*100:null,
            whiff_pct: swings?whiffs/swings*100:null,
            zone_pct: total?rs.filter(inZone).length/rs.length*100:null,
            ahead_count, even_count, behind_count, first_pitch_count, two_strike_count,
            lhh_count, lhh_strike_count, rhh_count, rhh_strike_count,
            zone_counts: buildZoneCounts(rs),
          };
        }).filter(r=>r.usage_pct>2).sort((a,b)=>b.usage_pct-a.usage_pct);

        // Also compute rates
        if (!ratesArr.length) {
          const fp = allRows.filter(r=>r.balls===0&&r.strikes===0);
          const swingsAll = allRows.filter(isSwingRow);
          const located = allRows.filter(hasLoc);
          const ooz = located.filter(r=>!inZone(r));
          const div = (n,d) => d>0?Math.round(100*n/d):null;
          ratesArr = [{ total_pitches: total,
            strike_pct: div(allRows.filter(isStrike).length, total),
            first_pitch_strike_pct: div(fp.filter(isStrike).length, fp.length),
            csw_pct: div(allRows.filter(r=>r.pitch_call==='StrikeCalled'||isWhiff(r)).length, total),
            whiff_pct: div(allRows.filter(isWhiff).length, swingsAll.length),
            zone_pct: div(located.filter(inZone).length, located.length),
            chase_pct: div(ooz.filter(isSwingRow).length, ooz.length),
          }];
        }
      }
    }

    // Merge curated results (prefer whichever has entries)
    const curatedRaw = (curatedByCode && curatedByCode.length > 0) ? curatedByCode : (curatedByName || []);

    let videoClips = videoClipsRaw || [];
    if (!videoClips.length) {
      const broader = await base44.entities.PitcherVideoClip.list(null, 500).catch(() => []);
      videoClips = broader.filter(r => canonicalKey(r.pitcher_name) === key);
    }
    const videoByType = {};
    for (const v of videoClips) videoByType[normalizePitch(v.pitch_type)] = v;
    arsenal = arsenal.map(r => {
      const vc = videoByType[normalizePitch(r.pitch_type)];
      return vc ? { ...r, video_url: vc.video_url, video_thumbnail_url: vc.video_thumbnail_url || r.video_thumbnail_url } : r;
    });

    // Dedupe by pitch type — season rows can have duplicates from repeated
    // aggregation runs. arsenal is already newest-first, so keep first-seen.
    const seenTypes = new Set();
    arsenal = arsenal.filter(r => {
      const t = normalizePitch(r.pitch_type);
      if (seenTypes.has(t)) return false;
      seenTypes.add(t);
      return true;
    });

    setSeasonArsenal([...arsenal].sort((a, b) => (b.usage_pct || 0) - (a.usage_pct || 0)));
    setActiveArsenalIdx(0);
    // AUDIT: previously `ratesArr[0] || prev` kept the LAST pitcher's rates on
    // the TV under the new pitcher's name when the new one had no rates row.
    setSeasonRates(ratesArr[0] || null);
    setCuratedTrails(curatedRaw);
  }, []);

  // Live polling — auto-started on mount
  const poll = useCallback(async () => {
    const [liveGames, obsResults] = await Promise.all([
      base44.entities.Game.filter({ status: 'in-progress' }, '-date', 1).catch(() => []),
      base44.entities.PitcherObservation.filter({ is_current_pitcher: true }, '-updated_date', 1).catch(() => []),
    ]);
    const gameId = liveGames?.[0]?.id || null;
    setLiveGameId(gameId);
    // Display mode is controlled REMOTELY (e.g. Live Scout writes Game.dugout_display_mode).
    // The TV only reads it. Default to 'pitcher' when unset. Never error the view on a missing field.
    const mode = liveGames?.[0]?.dugout_display_mode;
    if (mode === 'hitter' || mode === 'pitcher') setDugoutMode(mode);
    const orient = liveGames?.[0]?.dugout_orientation;
    if (orient === 'horizontal' || orient === 'vertical') setOrientation(orient);

    if (obsResults && obsResults.length > 0) {
      const obs = obsResults[0];
      const team = teamByName(obs.pitcher_team) || teamByCode(obs.pitcher_team);
      const teamCode = team?.trackman_code || obs.pitcher_team;
      const teamFullName = team?.name || obs.pitcher_team;
      setPitcherObs(prev => {
        // Only reload season data if pitcher changed
        if (!prev || prev.pitcher_name !== obs.pitcher_name) {
          loadSeasonData(obs.pitcher_name, teamCode, teamFullName);
        }
        return { ...obs, pitcher_team_code: teamCode };
      });
    }
  }, [teamByName, teamByCode, loadSeasonData]);

  // Load teams then start polling
  useEffect(() => {
    base44.entities.Team.list('name', 100).then(ts => setAllTeams(ts || []));
  }, []);

  useEffect(() => {
    if (allTeams.length === 0) return; // wait for teams to resolve
    // Phase 4.6: pause polling while the tab is hidden — the mounted dugout
    // iPad keeps burning battery/requests otherwise. Resume with an
    // immediate poll on visibility so the display catches up instantly.
    const start = () => {
      if (livePollingRef.current) return;
      poll(); // immediate first poll
      livePollingRef.current = setInterval(poll, 10000);
    };
    const stop = () => {
      if (livePollingRef.current) { clearInterval(livePollingRef.current); livePollingRef.current = null; }
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility); };
  }, [poll, allTeams.length]);

  // Derived values
  const pitcherDisplayName = pitcherObs?.pitcher_name || null;
  const pitcherHand = pitcherObs?.pitcher_hand || '';
  const handLabel = pitcherHand ? (pitcherHand[0]?.toUpperCase() === 'L' ? 'LHP' : 'RHP') : null;
  const pitcherTeamName = pitcherObs?.pitcher_team || '';
  const resolvedTeam = teamByName(pitcherTeamName) || teamByCode(pitcherTeamName);
  const teamLogoUrl = resolvedTeam?.logo_url || null;
  const teamDisplayName = resolvedTeam?.name || pitcherTeamName;

  const [playerRecord, setPlayerRecord] = useState(null);
  useEffect(() => {
    setPlayerRecord(null);
    if (!pitcherObs?.pitcher_name) return;
    const n = pitcherObs.pitcher_name.trim();
    const lastFirst = n.includes(',') ? n : (() => { const p = n.split(/\s+/); return p.length > 1 ? `${p[p.length-1]}, ${p.slice(0,-1).join(' ')}` : n; })();
    base44.entities.Player.filter({ name: lastFirst }, '-created_date', 1)
      .then(rows => { if (rows?.length) setPlayerRecord(rows[0]); })
      .catch(() => {});
  }, [pitcherObs?.pitcher_name]);

  const ttp1b = pitcherObs?.time_to_plate_1b || [];
  const ttp2b = pitcherObs?.time_to_plate_2b || [];
  const ttpSlide = pitcherObs?.time_to_plate_slide || [];
  const ttpVal = (() => {
    if (ttp1b.length) return avg(ttp1b);
    if (ttp2b.length) return avg(ttp2b);
    if (ttpSlide.length) return avg(ttpSlide);
    return null;
  })();

  // Single shared index (activeArsenalIdx) drives the 3D trail, the chip
  // footer, the stat footer, and the video — all four stay in sync automatically.
  const activePitchType = curatedTrails.length > 0
    ? (curatedTrails[activeArsenalIdx]?.display_label || curatedTrails[activeArsenalIdx]?.pitch_type)
    : seasonArsenal[activeArsenalIdx]?.pitch_type;
  // Video and rate stats live on the season PitcherArsenal row regardless of
  // whether the 3D trail is currently rendering from curated trails or season avgs.
  // Normalize both sides — curated trails may still carry a pre-canonicalization
  // label (e.g. "Fastball") that wouldn't otherwise match the season row's "Four-Seam".
  const activeStatPitch = seasonArsenal.find(p => normalizePitch(p.pitch_type) === normalizePitch(activePitchType)) || null;
  const activeVideoUrl = activeStatPitch?.video_url || null;

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'linear-gradient(160deg, #08151f 0%, #0c2030 100%)', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: FONT }}>

      {/* Nav bar */}
      <div style={{ padding: '8px 16px', background: '#0e253a', borderBottom: '2px solid #b8860b', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => setScreen('HOME')} style={{ background: 'rgba(255,255,255,.07)', border: '0.5px solid rgba(255,255,255,.15)', borderRadius: 6, color: '#c6b583', fontSize: 16, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>‹</button>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(198,181,131,0.5)', fontFamily: FONT }}>DUGOUT VIEW</span>
        </div>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#4ade80', letterSpacing: 1, fontFamily: FONT }}>● LIVE</div>
      </div>

      {/* PITCHER TAB */}
      {dugoutMode === 'pitcher' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>

          {/* Pitcher header */}
          <div style={{ padding: '14px 20px 12px', borderBottom: '2px solid #b8860b', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(14,37,58,.6)' }}>
            {!pitcherObs ? (
              <div style={{ fontSize: 16, color: 'rgba(255,255,255,.25)', fontStyle: 'italic', fontFamily: FONT }}>Waiting for active pitcher…</div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <TeamLogo logoUrl={teamLogoUrl} teamName={teamDisplayName} size={54} />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontSize: 30, fontWeight: 800, color: '#f4f2ec', fontFamily: FONT, lineHeight: 1.1 }}>{pitcherDisplayName}</div>
                      <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: 2, color: '#b8860b', background: 'rgba(184,134,11,0.15)', border: '0.5px solid rgba(184,134,11,0.4)', borderRadius: 4, padding: '2px 6px', fontFamily: FONT }}>SEASON</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#c6b583', textTransform: 'uppercase', letterSpacing: 1.5, fontFamily: FONT, marginTop: 2 }}>
                      {teamDisplayName || '—'} · {handLabel || 'RHP'}{playerRecord?.school ? <span style={{ color: 'rgba(198,181,131,.55)', fontWeight: 600, letterSpacing: 1 }}> · {playerRecord.school}</span> : null}
                    </div>
                  </div>
                </div>
                {/* AUDIT (mockup-approved): stat pills WRAP into rows on portrait
                    monitors instead of overflowX:auto — a non-touch TV had no
                    way to scroll a clipped row. */}
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: orientation === 'vertical' ? 'wrap' : 'nowrap', rowGap: orientation === 'vertical' ? 6 : 0, overflowX: 'visible' }}>
                  {ttpVal != null && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2px 12px', borderRight: '1px solid #1c3f5e' }}>
                      <span style={{ fontSize: 18, fontWeight: 800, color: '#eae5d8', fontFamily: FONT, fontVariantNumeric: 'tabular-nums', lineHeight: 1.15 }}>{ttpVal.toFixed(2)}s</span>
                      <span style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: '#7d93a6', fontWeight: 700, marginTop: 2, fontFamily: FONT }}>Time to Plate</span>
                    </div>
                  )}
                  <HeaderStatPill label="Strike%"      value={seasonRates?.strike_pct}             avg={58} good={64} />
                  <HeaderStatPill label="1st-K%"       value={seasonRates?.first_pitch_strike_pct} avg={52} good={60} />
                  <HeaderStatPill label="CSW%"         value={seasonRates?.csw_pct}                avg={24} good={30} />
                  <HeaderStatPill label="Whiff%"       value={seasonRates?.whiff_pct}               avg={21} good={28} />
                  <HeaderStatPill label="Zone%"        value={seasonRates?.zone_pct}                avg={45} good={52} />
                  <HeaderStatPill label="Chase%"       value={seasonRates?.chase_pct}               avg={24} good={30} />
                  {seasonArsenal.length > 0 && seasonArsenal[0]?.total_pitches && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2px 12px' }}>
                      <span style={{ fontSize: 18, fontWeight: 800, color: '#eae5d8', fontFamily: FONT, fontVariantNumeric: 'tabular-nums', lineHeight: 1.15 }}>{seasonArsenal[0].total_pitches}</span>
                      <span style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: '#7d93a6', fontWeight: 700, marginTop: 2, fontFamily: FONT }}>Season Pitches</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Body: 3D + video — side-by-side (horizontal) or stacked (vertical, for portrait monitors) */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 16px 10px', minHeight: 0, overflow: orientation === 'vertical' ? 'auto' : 'hidden' }}>
              {/* AUDIT (mockup-approved): the 3D/video row now fills whatever
                  space remains on the monitor via flex-grow instead of sizing
                  to fixed 220px/340px — viewport-relative, not device-specific. */}
              <div style={{ flex: 1, display: 'flex', flexDirection: orientation === 'vertical' ? 'column' : 'row', gap: 12, minHeight: 0 }}>
                {/* 3D canvas */}
                <div style={{
                  flex: orientation === 'vertical' ? '1 1 140px' : '1 1 0',
                  order: orientation === 'vertical' ? 2 : 0,
                  minWidth: 0, position: 'relative', borderRadius: 12, overflow: 'hidden',
                  border: '1px solid rgba(198,181,131,.15)', background: 'linear-gradient(160deg, #06121a 0%, #0a1e2c 100%)',
                }}>
                  {pitcherObs && (curatedTrails.length > 0 || seasonArsenal.length > 0) ? (
                    <>
                      <DugoutPitch3D
                        key={pitcherDisplayName + ':' + (curatedTrails.length > 0 ? 'curated' + curatedTrails.length : 'season')}
                        arsenal={seasonArsenal}
                        pitcherName={pitcherDisplayName}
                        pitcherHand={pitcherHand}
                        curatedTrails={curatedTrails}
                        onActiveIdx={setActiveArsenalIdx}
                      />
                      <ModeBadge isCurated={curatedTrails.length > 0} />
                    </>
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.2)', fontSize: 14, fontFamily: FONT, fontStyle: 'italic', textAlign: 'center', padding: 24 }}>
                      {!pitcherObs ? 'Waiting for active pitcher…' : 'No season data — set pitcher active in Live Scout'}
                    </div>
                  )}
                </div>
                {/* Video */}
                <div style={{
                  flex: orientation === 'vertical' ? '1.3 1 160px' : '1 1 0',
                  order: orientation === 'vertical' ? 1 : 0,
                  minWidth: 0, display: 'flex',
                }}>
                  <VideoPanel videoUrl={activeVideoUrl} pitchType={activePitchType} orientation={orientation} />
                </div>
              </div>

              {/* Pitch metrics board — one row per pitch type: chip, heatmap, stats, hand splits.
                  flexShrink:0 + maxHeight/overflowY are load-bearing: this board is much taller
                  than the old ChipFooter/StatFooter strip it replaced, and the 3D canvas + video
                  panel above it (flex:1, in a parent with overflow:hidden in horizontal mode) MUST
                  keep their space regardless of how many pitch types a pitcher has. Without this,
                  a 4-5 pitch arsenal pushes the board tall enough to squeeze the 3D/video row to
                  zero height — the actual bug this comment is here to prevent regressing again. */}
              <div style={{ flexShrink: 0, maxHeight: orientation === 'vertical' ? '38vh' : '46vh', overflowY: 'auto' }}>
                <PitchMetricsBoard
                  pitches={seasonArsenal}
                  activePitchType={activePitchType}
                  colorOverrides={curatedTrails.length > 0 ? curatedTrails.reduce((m, t) => { m[t.display_label || t.pitch_type] = t.trail_color; return m; }, {}) : null}
                />
              </div>
            </div>
            {/* Count splits — full width below, always visible */}
            <CountSplitsPanel arsenal={seasonArsenal} />
          </div>
        </div>
      )}

      {/* HITTER TAB — controlled remotely via Game.dugout_display_mode */}
      {dugoutMode === 'hitter' && (
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <HitterDugoutPanel gameId={liveGameId} orientation={orientation} />
        </div>
      )}
    </div>
  );
}