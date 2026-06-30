import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { getPitchColor } from '@/lib/ds';

const pitchHex = t => getPitchColor(t);

// Build bezier trajectory from release to plate (catcher's coords: +x=right, +y=up, z from camera to mound)
function buildPath(arsenal_row, steps = 80) {
  const hb    = (arsenal_row.horz_break_mean || 0) / 12; // inches → feet
  const ivb   = (arsenal_row.vert_break_mean || 0) / 12;
  const relH  = arsenal_row.rel_height   != null ? arsenal_row.rel_height   : 5.8;
  const relS  = arsenal_row.rel_side     != null ? arsenal_row.rel_side     : 0;
  // Mound (release) at z = -5, plate at z = 1.4
  const rz = -5, pz = 1.4;
  const rx = -relS;      // rel_side: positive = arm side, negate for catcher's-eye (+x = 3B side)
  const ry = relH;
  // Plate arrival: gravity drops ~2.5ft, hb adds horizontal movement
  const px = rx + hb;
  const py = ry - 2.5 + ivb;
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // quadratic bezier with control point at midpoint
    const cpx = (rx + px) / 2 + hb * 0.6;
    const cpy = (ry + py) / 2 + ivb * 0.4;
    const cpz = (rz + pz) / 2;
    const x = (1-t)*(1-t)*rx + 2*(1-t)*t*cpx + t*t*px;
    const y = (1-t)*(1-t)*ry + 2*(1-t)*t*cpy + t*t*py;
    const z = (1-t)*(1-t)*rz + 2*(1-t)*t*cpz + t*t*pz;
    points.push(new THREE.Vector3(x, y, z));
  }
  return points;
}

export default function PitcherCanvas3D({ arsenal, activeIdx }) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);

  // Build/rebuild scene when arsenal changes
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !arsenal || arsenal.length === 0) return;

    // Cleanup previous
    if (sceneRef.current) {
      sceneRef.current.dispose();
      sceneRef.current = null;
    }

    const W = mount.clientWidth || 600;
    const H = mount.clientHeight || 400;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x08141c);
    scene.fog = new THREE.FogExp2(0x08141c, 0.045);

    // Fixed catcher's-eye camera — NEVER moves
    const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 200);
    camera.position.set(0, 2.7, 4.2);
    camera.lookAt(0, 2.4, -5);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const dir = new THREE.DirectionalLight(0xfff8e8, 0.8);
    dir.position.set(5, 10, 4);
    scene.add(dir);

    // Ground disc
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(28, 48),
      new THREE.MeshLambertMaterial({ color: 0x0c2536 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    scene.add(ground);

    // Home plate at z=1.4
    const plateMat = new THREE.MeshLambertMaterial({ color: 0xf0ede4 });
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.708 * 2, 0.03, 0.5), plateMat);
    plate.position.set(0, 0.015, 1.4);
    scene.add(plate);

    // Strike zone — translucent gold rectangle centered at (0, 2.5, 1.4)
    const szW = 1.66, szH = 2.0;
    const szGeo = new THREE.PlaneGeometry(szW, szH);
    const szMat = new THREE.MeshBasicMaterial({ color: 0xb8860b, transparent: true, opacity: 0.08, side: THREE.DoubleSide });
    const szMesh = new THREE.Mesh(szGeo, szMat);
    szMesh.position.set(0, 2.5, 1.42);
    scene.add(szMesh);

    // Strike zone edges
    const szEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(szW, szH, 0.01)),
      new THREE.LineBasicMaterial({ color: 0xc6b583, transparent: true, opacity: 0.7 })
    );
    szEdges.position.set(0, 2.5, 1.42);
    scene.add(szEdges);

    // Mound bump
    const mound = new THREE.Mesh(
      new THREE.CylinderGeometry(1.0, 1.2, 0.25, 32),
      new THREE.MeshLambertMaterial({ color: 0x1a3a2a })
    );
    mound.position.set(0, 0.12, -5);
    scene.add(mound);

    // Build tube trails for all pitches
    const trailMeshes = [];
    const ballMeshes = [];
    const pathArrays = [];

    arsenal.forEach((p, i) => {
      const path = buildPath(p);
      pathArrays.push(path);
      const color = new THREE.Color(pitchHex(p.pitch_type));

      const curve = new THREE.CatmullRomCurve3(path);
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 60, 0.045, 6, false),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.32 })
      );
      scene.add(tube);
      trailMeshes.push(tube);

      // Ball for this pitch
      const ballGroup = new THREE.Group();
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 16, 16),
        new THREE.MeshPhongMaterial({ color: 0xfafaf5, shininess: 60 })
      );
      ballGroup.add(sphere);
      // Seam ring
      const seam = new THREE.Mesh(
        new THREE.TorusGeometry(0.11, 0.018, 6, 24),
        new THREE.MeshBasicMaterial({ color: 0xcc2222 })
      );
      seam.rotation.x = Math.PI / 4;
      ballGroup.add(seam);
      // Glow
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 10, 10),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, depthWrite: false })
      );
      ballGroup.add(glow);
      ballGroup.visible = false;
      scene.add(ballGroup);
      ballMeshes.push(ballGroup);
    });

    // Animation state
    let animFrame = 0;
    let currentActive = -1;
    let ballT = 0;
    let raf;

    const STEPS = 80;
    const BALL_SPEED = 1 / 55; // fraction per frame at 60fps

    const setActive = (idx) => {
      trailMeshes.forEach((t, i) => {
        t.material.opacity = i === idx ? 0.95 : 0.32;
      });
      ballMeshes.forEach((b, i) => { b.visible = i === idx; });
      currentActive = idx;
      ballT = 0;
    };

    setActive(0);

    function animate() {
      raf = requestAnimationFrame(animate);
      animFrame++;

      // Advance ball along path
      if (currentActive >= 0 && pathArrays[currentActive]) {
        ballT += BALL_SPEED;
        if (ballT >= 1) {
          // Advance to next pitch
          const next = (currentActive + 1) % arsenal.length;
          setActive(next);
        } else {
          const pts = pathArrays[currentActive];
          const idx = Math.min(Math.floor(ballT * pts.length), pts.length - 1);
          ballMeshes[currentActive].position.copy(pts[idx]);
          // Spin seam
          ballMeshes[currentActive].children[1].rotation.z += 0.22;
        }
      }

      renderer.render(scene, camera);
    }
    animate();

    const onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    sceneRef.current = {
      dispose: () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', onResize);
        renderer.dispose();
        if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      },
      setActiveIdx: (idx) => setActive(idx),
    };

    return () => {
      if (sceneRef.current) { sceneRef.current.dispose(); sceneRef.current = null; }
    };
  }, [arsenal]);

  // When activeIdx changes from parent (cycle), sync to scene
  useEffect(() => {
    if (sceneRef.current && activeIdx != null) {
      sceneRef.current.setActiveIdx(activeIdx);
    }
  }, [activeIdx]);

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />;
}