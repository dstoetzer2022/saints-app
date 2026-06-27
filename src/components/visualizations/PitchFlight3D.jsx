import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';

// ── Pitch type resolution ──────────────────────────────────
const PITCH_COLORS = {
  'Four-Seam':  '#e84545',
  'Sinker':     '#ff8c42',
  'Cutter':     '#f5a623',
  'Slider':     '#c77dff',
  'Sweeper':    '#7cc242',
  'Curveball':  '#3b82f6',
  'Changeup':   '#14b8a6',
  'Splitter':   '#0ea5a5',
  'Fastball':   '#e84545',
  'Other':      '#9ca3af',
};

function normType(raw) {
  if (!raw) return 'Other';
  const s = String(raw).toLowerCase().replace(/[- _]/g, '');
  if (['fourseam','4seam','ff','fourseamfastball','foursf'].includes(s)) return 'Four-Seam';
  if (['sinker','twoseam','2seam','si','twosfastball'].includes(s)) return 'Sinker';
  if (['fastball','fb'].includes(s)) return 'Fastball';
  if (['slider','sl'].includes(s)) return 'Slider';
  if (['sweeper'].includes(s)) return 'Sweeper';
  if (['curveball','cu','cb'].includes(s)) return 'Curveball';
  if (['cutter','fc','cut'].includes(s)) return 'Cutter';
  if (['changeup','ch','change','changeuppitch'].includes(s)) return 'Changeup';
  if (['splitter','fs','split'].includes(s)) return 'Splitter';
  if (['knuckleball','kn'].includes(s)) return 'Other';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function resolvePitchType(row) {
  let pt = normType(row.TaggedPitchType) || normType(row.AutoPitchType) || 'Other';
  // Smart split: "Fastball" generic → check movement
  if (pt === 'Fastball') {
    const ivb = Number(row.InducedVertBreak);
    const hb  = Math.abs(Number(row.HorzBreak));
    if (!isNaN(ivb) && !isNaN(hb) && ivb < 12 && hb > 12) pt = 'Sinker';
    else if (!isNaN(ivb)) pt = 'Four-Seam';
  }
  return pt;
}

// map DB row → Trackman field object
function dbToRow(p) {
  return {
    Pitcher: p.pitcher_name,
    PitcherThrows: p.pitcher_hand,
    PitcherTeam: p.pitcher_team,
    TaggedPitchType: p.tagged_pitch_type || p.pitch_type,
    AutoPitchType: p.pitch_type,
    RelSpeed: p.rel_speed,
    SpinRate: p.spin_rate,
    SpinAxis: p.spin_axis,
    HorzBreak: p.horz_break,
    InducedVertBreak: p.induced_vert_break,
    PlateLocHeight: p.plate_loc_height,
    PlateLocSide: p.plate_loc_side,
    RelHeight: p.rel_height,
    RelSide: p.rel_side,
    Extension: p.extension,
    ExitSpeed: p.exit_speed,
    PitchCall: p.pitch_call,
    KorBB: p.kor_bb,
    PlayResult: p.play_result,
    Inning: p.inning,
    Balls: p.balls,
    Strikes: p.strikes,
    Date: p.date,
    PitchNo: p.pitch_no,
    // polynomial coefficients
    PitchTrajectoryXc0: p.pitch_traj_xc0, PitchTrajectoryXc1: p.pitch_traj_xc1, PitchTrajectoryXc2: p.pitch_traj_xc2,
    PitchTrajectoryYc0: p.pitch_traj_yc0, PitchTrajectoryYc1: p.pitch_traj_yc1, PitchTrajectoryYc2: p.pitch_traj_yc2,
    PitchTrajectoryZc0: p.pitch_traj_zc0, PitchTrajectoryZc1: p.pitch_traj_zc1, PitchTrajectoryZc2: p.pitch_traj_zc2,
  };
}

// ── Trajectory computation ─────────────────────────────────
function computePolyTrajectory(row, steps = 90) {
  const xc = [row.PitchTrajectoryXc0, row.PitchTrajectoryXc1, row.PitchTrajectoryXc2].map(Number);
  const yc = [row.PitchTrajectoryYc0, row.PitchTrajectoryYc1, row.PitchTrajectoryYc2].map(Number);
  const zc = [row.PitchTrajectoryZc0, row.PitchTrajectoryZc1, row.PitchTrajectoryZc2].map(Number);
  if (xc.some(isNaN) || yc.some(isNaN) || zc.some(isNaN)) return null;
  // Estimate flight time: Y goes from ~0 to ~60.5 ft
  const vy0 = yc[1];
  const ay  = 2 * yc[2];
  // solve yc0 + yc1*t + yc2*t^2 = 60.5
  const disc = vy0 * vy0 - 4 * yc[2] * (yc[0] - 60.5);
  const tf = disc >= 0 ? (-vy0 + Math.sqrt(disc)) / (2 * yc[2]) : 0.45;
  const tflight = Math.max(0.3, Math.min(tf, 0.6));
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * tflight;
    const x = xc[0] + xc[1] * t + xc[2] * t * t;
    const y = yc[0] + yc[1] * t + yc[2] * t * t;
    const z = zc[0] + zc[1] * t + zc[2] * t * t;
    // Three.js: x=lateral, y=height, z=depth (negative = toward plate)
    pts.push(new THREE.Vector3(x, z, -y));
  }
  return pts;
}

function computeKinematicTrajectory(row, steps = 90) {
  const speed  = Number(row.RelSpeed) || 88;
  const rh     = Number(row.RelHeight) || 6.0;
  const rs     = Number(row.RelSide)   || 0;
  const ext    = Number(row.Extension) || 6.0;
  const ivb    = Number(row.InducedVertBreak) || 8;
  const hb     = Number(row.HorzBreak) || 0;
  const plateH = Number(row.PlateLocHeight) || 2.5;
  const plateS = Number(row.PlateLocSide)   || 0;

  const startZ = -(60.5 - ext);   // z in Three.js: release point depth
  const endZ   = 0;               // home plate
  const dist   = 60.5 - ext;      // feet to travel

  const vms   = speed * 0.3048 / 0.9144 * 0.3048; // mph→ft/s: *1.467
  const vy0   = -speed * 1.467;   // ft/s, negative = toward plate
  const ay    = 10;               // gravity drag net
  // time to reach plate from quadratic: dist = |vy0|*t - 0.5*ay*t^2
  // approximate: t ≈ dist / (speed*1.467)
  const tflight = dist / (speed * 1.467);

  // break → acceleration
  const ax = (2 * hb) / (tflight * tflight * 12); // hb in inches → ft; a = 2s/t^2
  const az = (2 * ivb) / (tflight * tflight * 12); // az positive = up

  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * tflight;
    const x = rs + 0.5 * ax * t * t;
    const z = rh + 0.5 * az * t * t - 0.5 * 32.174 * t * t + ivb / 12 * (t / tflight);
    const depth = startZ - (i / steps) * Math.abs(startZ);
    pts.push(new THREE.Vector3(x, z, depth));
  }
  // nudge endpoint to actual plate location
  const last = pts[pts.length - 1];
  last.x = plateS;
  last.y = plateH;
  last.z = 0;
  return pts;
}

function getMeanTrajectory(rows, steps = 90) {
  const validRows = rows.filter(r => r.RelSpeed);
  if (!validRows.length) return null;
  // try poly first
  const polyRows = validRows.filter(r => r.PitchTrajectoryYc0 != null);
  if (polyRows.length >= 3) {
    // average coefficients
    const mean = (arr, key) => arr.reduce((s, r) => s + (Number(r[key]) || 0), 0) / arr.length;
    const avgRow = {
      PitchTrajectoryXc0: mean(polyRows, 'PitchTrajectoryXc0'), PitchTrajectoryXc1: mean(polyRows, 'PitchTrajectoryXc1'), PitchTrajectoryXc2: mean(polyRows, 'PitchTrajectoryXc2'),
      PitchTrajectoryYc0: mean(polyRows, 'PitchTrajectoryYc0'), PitchTrajectoryYc1: mean(polyRows, 'PitchTrajectoryYc1'), PitchTrajectoryYc2: mean(polyRows, 'PitchTrajectoryYc2'),
      PitchTrajectoryZc0: mean(polyRows, 'PitchTrajectoryZc0'), PitchTrajectoryZc1: mean(polyRows, 'PitchTrajectoryZc1'), PitchTrajectoryZc2: mean(polyRows, 'PitchTrajectoryZc2'),
    };
    const pts = computePolyTrajectory(avgRow, steps);
    if (pts) return pts;
  }
  // kinematic fallback — average key params
  const avg = (key) => validRows.reduce((s, r) => s + (Number(r[key]) || 0), 0) / validRows.length;
  const meanRow = {
    RelSpeed: avg('RelSpeed'), RelHeight: avg('RelHeight'), RelSide: avg('RelSide'),
    Extension: avg('Extension'), InducedVertBreak: avg('InducedVertBreak'), HorzBreak: avg('HorzBreak'),
    PlateLocHeight: avg('PlateLocHeight'), PlateLocSide: avg('PlateLocSide'),
  };
  return computeKinematicTrajectory(meanRow, steps);
}

// ── Arsenal stats ──────────────────────────────────────────
function spinAxisToClock(axis) {
  if (axis == null || isNaN(axis)) return '—';
  const deg = ((Number(axis) % 360) + 360) % 360;
  const hours = (deg / 30);
  const h = Math.floor(hours) % 12 || 12;
  const m = Math.round((hours % 1) * 60);
  return `${h}:${m.toString().padStart(2, '0')}`;
}

function buildArsenal(rows) {
  const map = {};
  rows.forEach(r => {
    const pt = resolvePitchType(r);
    if (!map[pt]) map[pt] = [];
    map[pt].push(r);
  });
  return Object.entries(map)
    .map(([pt, ptRows]) => {
      const total = rows.length;
      const n = ptRows.length;
      const velos = ptRows.map(r => Number(r.RelSpeed)).filter(v => !isNaN(v) && v > 0);
      const spins = ptRows.map(r => Number(r.SpinRate)).filter(v => !isNaN(v) && v > 0);
      const ivbs  = ptRows.map(r => Number(r.InducedVertBreak)).filter(v => !isNaN(v));
      const hbs   = ptRows.map(r => Number(r.HorzBreak)).filter(v => !isNaN(v));
      const exts  = ptRows.map(r => Number(r.Extension)).filter(v => !isNaN(v) && v > 0);
      const axes  = ptRows.map(r => Number(r.SpinAxis)).filter(v => !isNaN(v) && v > 0);
      const swings = ptRows.filter(r => ['StrikeSwinging','FoulBall','FoulTip','FoulBallNotFieldable','FoulBallFieldable','InPlay'].includes(r.PitchCall)).length;
      const whiffs = ptRows.filter(r => r.PitchCall === 'StrikeSwinging').length;
      const strikes = ptRows.filter(r => ['StrikeCalled','StrikeSwinging','FoulBall','FoulTip','FoulBallNotFieldable','FoulBallFieldable','InPlay'].includes(r.PitchCall)).length;
      const mean = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
      return {
        pt, n, total,
        usagePct: (n / total * 100).toFixed(1),
        veloMean: mean(velos)?.toFixed(1) ?? '—',
        veloMax: velos.length ? Math.max(...velos).toFixed(1) : '—',
        spinMean: mean(spins)?.toFixed(0) ?? '—',
        ivbMean: mean(ivbs)?.toFixed(1) ?? '—',
        hbMean: mean(hbs)?.toFixed(1) ?? '—',
        extMean: mean(exts)?.toFixed(1) ?? '—',
        tilt: axes.length ? spinAxisToClock(mean(axes)) : '—',
        strikePct: n ? (strikes / n * 100).toFixed(1) : '—',
        whiffPct: swings ? (whiffs / swings * 100).toFixed(1) : '—',
      };
    })
    .sort((a, b) => b.n - a.n);
}

function buildOverall(rows) {
  const total = rows.length;
  if (!total) return null;
  const strikes = rows.filter(r => ['StrikeCalled','StrikeSwinging','FoulBall','FoulTip','FoulBallNotFieldable','FoulBallFieldable','InPlay'].includes(r.PitchCall)).length;
  const inZone = rows.filter(r => {
    const h = Number(r.PlateLocHeight), s = Number(r.PlateLocSide);
    return !isNaN(h) && !isNaN(s) && h >= 1.5 && h <= 3.5 && s >= -0.83 && s <= 0.83;
  }).length;
  const swings = rows.filter(r => ['StrikeSwinging','FoulBall','FoulTip','FoulBallNotFieldable','FoulBallFieldable','InPlay'].includes(r.PitchCall)).length;
  const whiffs = rows.filter(r => r.PitchCall === 'StrikeSwinging').length;
  const firstPitches = {};
  rows.forEach(r => {
    const key = `${r.Inning}-${r.Balls}-${r.Strikes}`;
    if (Number(r.Balls) === 0 && Number(r.Strikes) === 0) {
      if (!firstPitches[key]) firstPitches[key] = r;
    }
  });
  const fp = Object.values(firstPitches);
  const fpStrikes = fp.filter(r => ['StrikeCalled','StrikeSwinging','FoulBall','FoulTip','FoulBallNotFieldable','FoulBallFieldable','InPlay'].includes(r.PitchCall)).length;
  const paEnds = rows.filter(r => r.KorBB || r.PlayResult);
  const ks = rows.filter(r => r.KorBB === 'Strikeout' || r.PitchCall === 'StrikeoutSwinging' || r.PitchCall === 'StrikeoutLooking').length;
  const bbs = rows.filter(r => r.KorBB === 'Walk' || r.KorBB === 'HBP').length;
  const evs = rows.map(r => Number(r.ExitSpeed)).filter(v => !isNaN(v) && v > 0);
  const bf = new Set(rows.map(r => `${r.Inning}-${r.Batter || r.Date}-${r.PitchNo}`)).size;

  const pct = (a, b) => b ? (a / b * 100).toFixed(1) + '%' : '—';
  const m = arr => arr.length ? (arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(1) : '—';
  return {
    total,
    strikePct: pct(strikes, total),
    zonePct: pct(inZone, total),
    fpStrikePct: pct(fpStrikes, fp.length),
    whiffPct: pct(whiffs, swings),
    avgEV: evs.length ? m(evs) + ' mph' : '—',
  };
}

// ── Three.js Scene ─────────────────────────────────────────
function buildScene(renderer, canvasW, canvasH) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xbcd2e8, 220, 360);

  // Sky dome
  const skyGeo = new THREE.SphereGeometry(360, 32, 16);
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 4; skyCanvas.height = 256;
  const skyCtx = skyCanvas.getContext('2d');
  const grad = skyCtx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#3f73b0');
  grad.addColorStop(0.4, '#74a3d4');
  grad.addColorStop(0.75, '#bcd6ee');
  grad.addColorStop(1, '#dfeaf3');
  skyCtx.fillStyle = grad;
  skyCtx.fillRect(0, 0, 4, 256);
  const skyTex = new THREE.CanvasTexture(skyCanvas);
  skyTex.mapping = THREE.EquirectangularReflectionMapping;
  const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  // Lighting
  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const dir = new THREE.DirectionalLight(0xfff6e8, 0.8);
  dir.position.set(-30, 50, 40);
  scene.add(dir);
  scene.add(new THREE.HemisphereLight(0xbfd4ec, 0x3a6b3a, 0.5));

  // Ground
  const groundGeo = new THREE.CircleGeometry(340, 64);
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x2f6e35 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, -60.5);
  scene.add(ground);

  // Outfield fence
  const fenceSegments = 36;
  const fenceRadius = 130;
  for (let i = 0; i < fenceSegments; i++) {
    const startAngle = (-150 + i * (300 / fenceSegments)) * Math.PI / 180;
    const endAngle   = (-150 + (i + 1) * (300 / fenceSegments)) * Math.PI / 180;
    const cx = fenceRadius * Math.sin((startAngle + endAngle) / 2);
    const cz = -60.5 - fenceRadius * Math.cos((startAngle + endAngle) / 2);
    const len = fenceRadius * 2 * Math.PI * (300 / 360) / fenceSegments + 0.1;
    const fence = new THREE.Mesh(
      new THREE.BoxGeometry(len, 3.4, 0.3),
      new THREE.MeshLambertMaterial({ color: 0x14532d })
    );
    fence.position.set(cx, 1.7, cz);
    fence.rotation.y = -(startAngle + endAngle) / 2;
    scene.add(fence);
  }

  // Batter's eye
  const byePanel = new THREE.Mesh(
    new THREE.BoxGeometry(28, 12, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x14241a })
  );
  byePanel.position.set(0, 6, -60.5 - 130);
  scene.add(byePanel);

  // Home plate (pentagon)
  const plateShape = new THREE.Shape();
  const pw = 0.708; // 17in/2 in ft
  plateShape.moveTo(-pw, 0.17);
  plateShape.lineTo( pw, 0.17);
  plateShape.lineTo( pw, -0.17);
  plateShape.lineTo(0, -0.5);
  plateShape.lineTo(-pw, -0.17);
  plateShape.lineTo(-pw, 0.17);
  const plateGeo = new THREE.ShapeGeometry(plateShape);
  const plateMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const plate = new THREE.Mesh(plateGeo, plateMat);
  plate.rotation.x = -Math.PI / 2;
  plate.position.set(0, 0.01, 0);
  scene.add(plate);

  // Pitcher's mound
  const moundGeo = new THREE.CylinderGeometry(4.5, 5, 0.6, 32);
  const moundMat = new THREE.MeshLambertMaterial({ color: 0xc8a882 });
  const mound = new THREE.Mesh(moundGeo, moundMat);
  mound.position.set(0, 0.3, -60.5);
  scene.add(mound);
  // rubber
  const rubberGeo = new THREE.BoxGeometry(0.5, 0.05, 0.1);
  const rubberMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const rubber = new THREE.Mesh(rubberGeo, rubberMat);
  rubber.position.set(0, 0.625, -60.5);
  scene.add(rubber);

  // Strike zone wireframe
  const szGeo = new THREE.BoxGeometry(1.417, 2.0, 0.1);
  const szEdges = new THREE.EdgesGeometry(szGeo);
  const szLine = new THREE.LineSegments(szEdges, new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 }));
  szLine.position.set(0, 2.5, 0.2);
  scene.add(szLine);

  return scene;
}

// ── Main component ─────────────────────────────────────────
const GOLD = '#c6b583';
const DARK = '#07111c';

export default function PitchFlight3D({ pitches: dbPitches }) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const animFrameRef = useRef(null);
  const ballRef = useRef(null);
  const trajLinesRef = useRef({});
  const allDotsRef = useRef([]);
  const ballProgressRef = useRef(0);
  const isPlayingRef = useRef(false);
  const activeTrajRef = useRef(null);
  const dragRef = useRef({ active: false, lastX: 0, lastY: 0, theta: 0.2, phi: 0.3 });

  const [camMode, setCamMode] = useState('catcher'); // 'catcher' | 'pitcher'
  const [displayMode, setDisplayMode] = useState('arsenal'); // 'arsenal' | 'all'
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeType, setActiveType] = useState(null);
  const [hiddenTypes, setHiddenTypes] = useState(new Set());
  const [ready, setReady] = useState(false);

  // Map DB → Trackman rows
  const rows = useMemo(() => dbPitches.map(dbToRow), [dbPitches]);

  // Resolve pitch type per row
  const rowsWithType = useMemo(() => rows.map(r => ({ ...r, _pt: resolvePitchType(r) })), [rows]);

  // Arsenal grouping
  const arsenalData = useMemo(() => buildArsenal(rowsWithType), [rowsWithType]);
  const overallStats = useMemo(() => buildOverall(rowsWithType), [rowsWithType]);
  const pitchTypes = useMemo(() => arsenalData.map(a => a.pt), [arsenalData]);

  // Mean trajectories per type
  const meanTrajectories = useMemo(() => {
    const result = {};
    arsenalData.forEach(({ pt }) => {
      const ptRows = rowsWithType.filter(r => r._pt === pt);
      result[pt] = getMeanTrajectory(ptRows);
    });
    return result;
  }, [arsenalData, rowsWithType]);

  // Set first active type
  useEffect(() => {
    if (pitchTypes.length && !activeType) setActiveType(pitchTypes[0]);
  }, [pitchTypes]);

  // ── Three.js init & render loop ──
  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const W = container.clientWidth || 700;
    const H = 480;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = false;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = buildScene(renderer, W, H);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(56, W / H, 0.1, 800);
    camera.position.set(0, 4.5, 4);
    camera.lookAt(0, 2.5, -55);
    cameraRef.current = camera;

    // Ball
    const ballGeo = new THREE.SphereGeometry(0.12, 16, 12);
    const ballMat = new THREE.MeshPhongMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.4 });
    const ball = new THREE.Mesh(ballGeo, ballMat);
    ball.visible = false;
    scene.add(ball);
    ballRef.current = ball;

    setReady(true);

    // Animate
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);

      // Ball animation
      if (isPlayingRef.current && activeTrajRef.current) {
        const traj = activeTrajRef.current;
        ballProgressRef.current += 2.5 / traj.length;
        if (ballProgressRef.current >= 1) ballProgressRef.current = 0;
        const idx = Math.floor(ballProgressRef.current * (traj.length - 1));
        const pt = traj[idx];
        if (pt) { ball.position.copy(pt); ball.visible = true; }
      } else if (!isPlayingRef.current) {
        ball.visible = false;
      }

      renderer.render(scene, camera);
    };
    animate();

    // Resize
    const onResize = () => {
      const w = container.clientWidth || 700;
      renderer.setSize(w, H);
      camera.aspect = w / H;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(animFrameRef.current);
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, []);

  // ── Drag to orbit ──
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const onDown = e => { dragRef.current.active = true; dragRef.current.lastX = e.clientX; dragRef.current.lastY = e.clientY; };
    const onUp   = () => { dragRef.current.active = false; };
    const onMove = e => {
      if (!dragRef.current.active || !cameraRef.current) return;
      const dx = e.clientX - dragRef.current.lastX;
      const dy = e.clientY - dragRef.current.lastY;
      dragRef.current.lastX = e.clientX;
      dragRef.current.lastY = e.clientY;
      dragRef.current.theta -= dx * 0.005;
      dragRef.current.phi   = Math.max(0.05, Math.min(1.4, dragRef.current.phi + dy * 0.005));
      applyDragCamera();
    };
    el.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('mousemove', onMove);
    return () => { el.removeEventListener('mousedown', onDown); window.removeEventListener('mouseup', onUp); window.removeEventListener('mousemove', onMove); };
  }, []);

  function applyDragCamera() {
    const cam = cameraRef.current;
    if (!cam) return;
    const { theta, phi } = dragRef.current;
    const r = camMode === 'pitcher' ? 8 : 7;
    const base = camMode === 'pitcher' ? new THREE.Vector3(0, 6, -65) : new THREE.Vector3(0, 4.5, 4);
    // offset from base
    cam.position.x = base.x + r * Math.sin(phi) * Math.sin(theta);
    cam.position.y = base.y + r * Math.cos(phi) * 0.3;
    cam.position.z = base.z + r * Math.cos(phi) * Math.cos(theta) * 0.3;
    cam.lookAt(camMode === 'pitcher' ? 0 : 0, 2.5, camMode === 'pitcher' ? 0 : -55);
  }

  // ── Camera preset ──
  useEffect(() => {
    const cam = cameraRef.current;
    if (!cam) return;
    if (camMode === 'catcher') {
      cam.position.set(0, 4.5, 4);
      cam.lookAt(0, 2.5, -55);
    } else {
      cam.position.set(0, 6, -65);
      cam.lookAt(0, 3, 0);
    }
    dragRef.current.theta = 0;
    dragRef.current.phi = 0.3;
  }, [camMode]);

  // ── Build / rebuild trajectory lines ──
  useEffect(() => {
    if (!sceneRef.current || !ready) return;
    const scene = sceneRef.current;

    // Remove old lines
    Object.values(trajLinesRef.current).forEach(obj => scene.remove(obj));
    trajLinesRef.current = {};
    allDotsRef.current.forEach(obj => scene.remove(obj));
    allDotsRef.current = [];

    if (displayMode === 'arsenal') {
      Object.entries(meanTrajectories).forEach(([pt, traj]) => {
        if (!traj) return;
        const color = new THREE.Color(PITCH_COLORS[pt] || '#9ca3af');
        const points = traj;
        const tubeGeo = new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(points), 60, 0.025, 6, false
        );
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: hiddenTypes.has(pt) ? 0 : 0.85 });
        const tube = new THREE.Mesh(tubeGeo, mat);
        scene.add(tube);
        trajLinesRef.current[pt] = tube;
      });
    } else {
      // All pitches mode — dots at plate location
      const callColor = { StrikeCalled: '#2fb46b', StrikeSwinging: '#2fb46b', FoulBall: '#7aa5d8', FoulTip: '#7aa5d8', FoulBallNotFieldable: '#7aa5d8', FoulBallFieldable: '#7aa5d8', InPlay: '#e8643c' };
      rowsWithType.forEach(r => {
        const h = Number(r.PlateLocHeight), s = Number(r.PlateLocSide);
        if (isNaN(h) || isNaN(s)) return;
        const color = new THREE.Color(callColor[r.PitchCall] || '#e0a82e');
        if (!hiddenTypes.has(r._pt)) {
          // draw individual trajectory
          const traj = computeKinematicTrajectory(r);
          if (traj && traj.length > 2) {
            const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(traj), 40, 0.018, 4, false);
            const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4 });
            const mesh = new THREE.Mesh(geo, mat);
            scene.add(mesh);
            allDotsRef.current.push(mesh);
          }
          const dotGeo = new THREE.SphereGeometry(0.06, 8, 6);
          const dotMat = new THREE.MeshBasicMaterial({ color });
          const dot = new THREE.Mesh(dotGeo, dotMat);
          dot.position.set(s, h, 0.15);
          scene.add(dot);
          allDotsRef.current.push(dot);
        }
      });
    }
  }, [meanTrajectories, rowsWithType, displayMode, hiddenTypes, ready]);

  // ── Update line visibility on toggle ──
  useEffect(() => {
    Object.entries(trajLinesRef.current).forEach(([pt, mesh]) => {
      if (mesh.material) mesh.material.opacity = hiddenTypes.has(pt) ? 0 : 0.85;
    });
  }, [hiddenTypes]);

  // ── Active trajectory for ball ──
  useEffect(() => {
    if (activeType && meanTrajectories[activeType]) {
      activeTrajRef.current = meanTrajectories[activeType];
    }
  }, [activeType, meanTrajectories]);

  // ── Play/Pause sync ──
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  const toggleType = pt => {
    setHiddenTypes(prev => {
      const next = new Set(prev);
      if (next.has(pt)) next.delete(pt); else next.add(pt);
      return next;
    });
  };

  const togglePlay = () => {
    if (!isPlaying) ballProgressRef.current = 0;
    setIsPlaying(p => !p);
  };

  if (!dbPitches.length) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>No Trackman pitch data available for 3D visualization.</div>;
  }

  return (
    <div style={{ color: '#f0ece0', fontFamily: "'Archivo', sans-serif" }}>
      {/* Overall metrics row */}
      {overallStats && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {[
            ['Total Pitches', overallStats.total],
            ['Strike%', overallStats.strikePct],
            ['Zone%', overallStats.zonePct],
            ['FPS%', overallStats.fpStrikePct],
            ['Whiff%', overallStats.whiffPct],
            ['Avg EV', overallStats.avgEV],
          ].map(([label, val]) => (
            <div key={label} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 14px', textAlign: 'center', minWidth: 80, flex: 1 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'monospace' }}>{val}</div>
            </div>
          ))}
        </div>
      )}

      {/* 3D Canvas + controls */}
      <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#1a2e44', border: '1px solid rgba(255,255,255,0.1)', marginBottom: 20 }}>
        <div ref={mountRef} style={{ width: '100%', height: 480, cursor: 'grab' }} />

        {/* Overlay controls */}
        <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', flexDirection: 'column', gap: 6, zIndex: 10 }}>
          {/* Camera toggle */}
          <button onClick={() => setCamMode(m => m === 'catcher' ? 'pitcher' : 'catcher')} style={btnStyle}>
            {camMode === 'catcher' ? '🎯 Catcher View' : '⚾ Pitcher View'}
          </button>
          {/* Mode toggle */}
          <button onClick={() => setDisplayMode(m => m === 'arsenal' ? 'all' : 'arsenal')} style={btnStyle}>
            {displayMode === 'arsenal' ? '📊 Arsenal' : '🔵 All Pitches'}
          </button>
          {/* Play/Pause */}
          <button onClick={togglePlay} style={{ ...btnStyle, background: isPlaying ? 'rgba(198,181,131,0.25)' : 'rgba(198,181,131,0.12)' }}>
            {isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>
        </div>

        {/* Pitch type panel */}
        <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', flexDirection: 'column', gap: 5, zIndex: 10 }}>
          {arsenalData.map(({ pt, n, total, veloMean }) => (
            <button key={pt} onClick={() => { setActiveType(pt); toggleType(pt); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '5px 10px',
                background: activeType === pt ? 'rgba(255,255,255,0.15)' : 'rgba(10,20,30,0.72)',
                border: `1px solid ${activeType === pt ? GOLD : 'rgba(255,255,255,0.12)'}`,
                borderRadius: 6, cursor: 'pointer', fontFamily: "'Archivo', sans-serif",
                opacity: hiddenTypes.has(pt) ? 0.38 : 1, transition: 'all 0.12s',
              }}>
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: PITCH_COLORS[pt] || '#9ca3af', flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#f0ece0', minWidth: 70, textAlign: 'left' }}>{pt}</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontFamily: 'monospace' }}>{veloMean}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Arsenal stats table */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 20px', overflowX: 'auto' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 3, height: 12, background: GOLD, borderRadius: 2 }} />
          Arsenal Breakdown
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {['Type', 'N', 'Use%', 'Velo', 'Max', 'Spin', 'iVB', 'HB', 'Ext', 'Tilt', 'Strike%', 'Whiff%'].map(h => (
                <th key={h} style={{ padding: '5px 8px', fontWeight: 700, fontSize: 9, textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', textAlign: h === 'Type' ? 'left' : 'right', borderBottom: '1px solid rgba(255,255,255,0.07)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {arsenalData.map(a => (
              <tr key={a.pt} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '6px 8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: PITCH_COLORS[a.pt] || '#9ca3af', flexShrink: 0 }} />
                    <span style={{ fontWeight: 700, color: '#f0ece0' }}>{a.pt}</span>
                  </div>
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>{a.n}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: GOLD, fontFamily: 'monospace', fontWeight: 700 }}>{a.usagePct}%</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: '#f0ece0', fontFamily: 'monospace' }}>{a.veloMean}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: '#f0ece0', fontFamily: 'monospace' }}>{a.veloMax}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: '#f0ece0', fontFamily: 'monospace' }}>{a.spinMean}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: '#f0ece0', fontFamily: 'monospace' }}>{a.ivbMean}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: '#f0ece0', fontFamily: 'monospace' }}>{a.hbMean}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: '#f0ece0', fontFamily: 'monospace' }}>{a.extMean}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: '#f0ece0', fontFamily: 'monospace' }}>{a.tilt}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: '#f0ece0', fontFamily: 'monospace' }}>{a.strikePct}%</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: '#f0ece0', fontFamily: 'monospace' }}>{a.whiffPct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const btnStyle = {
  background: 'rgba(10,20,30,0.78)',
  border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: 6,
  padding: '6px 12px',
  fontSize: 12,
  fontWeight: 700,
  color: '#f0ece0',
  cursor: 'pointer',
  fontFamily: "'Archivo', sans-serif",
  backdropFilter: 'blur(8px)',
  whiteSpace: 'nowrap',
};