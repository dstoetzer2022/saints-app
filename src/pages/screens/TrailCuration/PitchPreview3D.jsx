import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { buildScene } from '@/lib/pitch3dEngine';

const FONT = "'Archivo', system-ui, sans-serif";

// Build a single-pitch pitcher object from a raw TrackmanPitch row
function buildSinglePitchPitcher(pitch, pitchType, trailColor) {
  const speed = pitch.rel_speed != null ? parseFloat(pitch.rel_speed) : 88;
  const ivb   = pitch.induced_vert_break != null ? parseFloat(pitch.induced_vert_break) : null;
  const hb    = pitch.horz_break != null ? parseFloat(pitch.horz_break) : null;
  const relH  = pitch.rel_height != null ? parseFloat(pitch.rel_height) : 6.0;
  const relS  = pitch.rel_side != null ? parseFloat(pitch.rel_side) : 0;
  const ext   = pitch.extension != null ? parseFloat(pitch.extension) : null;
  const plH   = pitch.plate_loc_height != null ? parseFloat(pitch.plate_loc_height) : null;
  const plS   = pitch.plate_loc_side != null ? parseFloat(pitch.plate_loc_side) : null;
  const spinAxis = pitch.spin_axis != null ? parseFloat(pitch.spin_axis) : null;

  const relY = ext != null ? 60.5 - ext : 54;
  const vy0 = -speed * 1.467, ay = 10.0;
  const dsc = vy0 * vy0 - 4 * (0.5 * ay) * relY;
  let tf = dsc > 0 ? (-vy0 - Math.sqrt(dsc)) / ay : 0.45;
  if (!(tf > 0 && tf < 1.2)) tf = 0.45;

  const ax = hb != null ? 2 * (hb / 12) / (tf * tf) : 0;
  const az = -32.174 + (ivb != null ? 2 * (ivb / 12) / (tf * tf) : 0);
  const targetZ = plH ?? 2.5;
  const targetX = plS ?? (relS + (hb != null ? hb / 12 : 0));
  const vz0 = (targetZ - relH - 0.5 * az * tf * tf) / tf;
  const vx0 = (targetX - relS - 0.5 * ax * tf * tf) / tf;

  const path = [];
  for (let i = 0; i <= 90; i++) {
    const t = (tf * i) / 90;
    path.push({
      d: relY + vy0 * t,
      h: relH + vz0 * t + 0.5 * az * t * t,
      s: relS + vx0 * t + 0.5 * ax * t * t,
    });
  }

  return {
    name: pitchType,
    throws: pitch.pitcher_hand?.[0]?.toUpperCase() || 'R',
    total: 1,
    pitches: [{
      type: pitchType,
      displayColor: trailColor,
      count: 1,
      speed: +speed.toFixed(1),
      spin: pitch.spin_rate != null ? Math.round(parseFloat(pitch.spin_rate)) : 0,
      spinAxis: spinAxis != null ? +spinAxis.toFixed(0) : null,
      ivb: ivb != null ? +ivb.toFixed(1) : 0,
      hb: hb != null ? +hb.toFixed(1) : 0,
      path,
      tflight: +tf.toFixed(3),
      usage: 1,
    }],
    allPitches: [],
  };
}

export default function PitchPreview3D({ pitch, pitchType, trailColor }) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !pitch) return;

    // Tear down previous scene immediately
    if (sceneRef.current) { sceneRef.current.dispose(); sceneRef.current = null; }

    const pitcher = buildSinglePitchPitcher(pitch, pitchType, trailColor);
    if (!pitcher.pitches.length) return;

    let cancelled = false;
    let rafId;

    // Delay one rAF so the container has finished layout and clientHeight is correct
    rafId = requestAnimationFrame(() => {
      if (cancelled || !mountRef.current) return;

      const scene3d = buildScene(THREE, mountRef.current, pitcher, { mode: 'avg', preview: true });
      scene3d.setCam('catcher');
      scene3d.select(0);
      scene3d.play();
      sceneRef.current = scene3d;

      scene3d.onDone = () => {
        setTimeout(() => {
          if (sceneRef.current === scene3d) {
            scene3d.select(0);
            scene3d.play();
          }
        }, 1200);
      };
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      if (sceneRef.current) { sceneRef.current.dispose(); sceneRef.current = null; }
    };
  }, [pitch?.id, pitchType]);

  return (
    <div style={{ background: '#06121a', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(198,181,131,.2)', position: 'relative' }}>
      <div ref={mountRef} style={{ width: '100%', height: 220 }} />
      <div style={{ position: 'absolute', top: 7, left: 8, fontSize: 10, fontWeight: 700, color: 'rgba(198,181,131,.7)', fontFamily: FONT, letterSpacing: 1, textTransform: 'uppercase' }}>
        Preview
      </div>
    </div>
  );
}