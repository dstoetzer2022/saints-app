// ── Pitch 3D Engine — extracted verbatim from SaintsPitch3D ──────────────────
// Exports: buildScene, buildPitcherForScene, startPitchCycle

const PITCH_COLORS = {
  // Four-Seam / FF
  "Four-Seam":"#E24B4A","FourSeam":"#E24B4A","Fastball":"#E24B4A","FourSeamFastBall":"#E24B4A",
  // Sinker / SI
  "Sinker":"#BA7517","Two-Seam":"#BA7517","TwoSeamFastBall":"#BA7517",
  // Cutter / FC
  "Cutter":"#EF9F27",
  // Slider / SL
  "Slider":"#378ADD",
  // Sweeper / ST
  "Sweeper":"#534AB7",
  // Curveball / CB
  "Curveball":"#1D9E75","Curve":"#1D9E75",
  // Changeup / CH
  "Changeup":"#D4537E","ChangeUp":"#D4537E",
  // Splitter / FS
  "Splitter":"#993C1D","Split-Finger":"#993C1D",
  // Knuckleball
  "Knuckleball":"#888780",
};
export const colorFor = t => PITCH_COLORS[t] || "#888888";

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

// ── buildScene — verbatim from Pitch3DTab.jsx ─────────────────────────────────
export function buildScene(THREE, mount, pitcher, opts) {
  opts=opts||{};
  const W=mount.clientWidth||700,H=mount.clientHeight||480;
  const renderer=new THREE.WebGLRenderer({antialias:true});
  renderer.setSize(W,H);renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  mount.appendChild(renderer.domElement);
  const scene=new THREE.Scene();
  const skyCanvas=document.createElement("canvas");skyCanvas.width=8;skyCanvas.height=256;
  const sg=skyCanvas.getContext("2d");const grad=sg.createLinearGradient(0,0,0,256);
  grad.addColorStop(0,"#3f73b0");grad.addColorStop(0.5,"#74a3d4");grad.addColorStop(0.82,"#bcd6ee");grad.addColorStop(1,"#dfeaf3");
  sg.fillStyle=grad;sg.fillRect(0,0,8,256);
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(360,32,20),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(skyCanvas),side:THREE.BackSide,fog:false})));
  scene.fog=new THREE.Fog(0xbcd2e8,220,360);
  const camera=new THREE.PerspectiveCamera(33.6,W/H,0.1,900);
  scene.add(new THREE.AmbientLight(0xffffff,0.9));
  const sun=new THREE.DirectionalLight(0xfff6e8,0.8);sun.position.set(-30,50,40);scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfd4ec,0x3a6b3a,0.5));
  const stadium=new THREE.Group();scene.add(stadium);
  const grassDisc=new THREE.Mesh(new THREE.CircleGeometry(340,64),new THREE.MeshLambertMaterial({color:0x2f6e35}));
  grassDisc.rotation.x=-Math.PI/2;grassDisc.position.set(0,-0.05,-60.5);stadium.add(grassDisc);
  const FENCE_R=130,FENCE_H=3.4;
  for(let wa=-150;wa<=150;wa+=7.5){const rad=wa*Math.PI/180;
    const seg=new THREE.Mesh(new THREE.BoxGeometry(18,FENCE_H,0.6),new THREE.MeshLambertMaterial({color:0x14532d}));
    seg.position.set(Math.sin(rad)*FENCE_R,FENCE_H/2,-60.5-Math.cos(rad)*FENCE_R);seg.rotation.y=-rad;stadium.add(seg);
    const cap=new THREE.Mesh(new THREE.BoxGeometry(18,0.3,0.7),new THREE.MeshBasicMaterial({color:0xf2f0e6}));
    cap.position.set(Math.sin(rad)*FENCE_R,FENCE_H,-60.5-Math.cos(rad)*FENCE_R);cap.rotation.y=-rad;stadium.add(cap);}
  const eye=new THREE.Mesh(new THREE.BoxGeometry(70,30,0.8),new THREE.MeshLambertMaterial({color:0x14241a}));
  eye.position.set(0,6,-60.5-FENCE_R+0.3);stadium.add(eye);
  const BACK_R=30;
  for(let ba=-80;ba<=80;ba+=6){const br=ba*Math.PI/180;
    const bseg=new THREE.Mesh(new THREE.BoxGeometry(7,7,0.5),new THREE.MeshLambertMaterial({color:0x2b4a66}));
    bseg.position.set(Math.sin(br)*BACK_R,3.5,Math.cos(br)*BACK_R);bseg.rotation.y=Math.PI+br;stadium.add(bseg);
    const bcap=new THREE.Mesh(new THREE.BoxGeometry(7,0.3,0.7),new THREE.MeshBasicMaterial({color:0xf2f0e6}));
    bcap.position.set(Math.sin(br)*BACK_R,7,Math.cos(br)*BACK_R);bcap.rotation.y=Math.PI+br;stadium.add(bcap);}
  const DIRT=0x9c5a36,DIRT_DK=0x844a2c;
  const skin=new THREE.Mesh(new THREE.CircleGeometry(95,64,Math.PI*0.5-Math.PI*0.34,Math.PI*0.68),new THREE.MeshLambertMaterial({color:DIRT}));
  skin.rotation.x=-Math.PI/2;skin.position.set(0,0.002,0);scene.add(skin);
  const iGrass=new THREE.Mesh(new THREE.CircleGeometry(46,64,Math.PI*0.5-Math.PI*0.30,Math.PI*0.60),new THREE.MeshLambertMaterial({color:0x357a3c}));
  iGrass.rotation.x=-Math.PI/2;iGrass.position.set(0,0.004,-40);scene.add(iGrass);
  const pDirt=new THREE.Mesh(new THREE.CircleGeometry(9,48),new THREE.MeshLambertMaterial({color:DIRT}));
  pDirt.rotation.x=-Math.PI/2;pDirt.position.set(0,0.006,0);scene.add(pDirt);
  const mDirt=new THREE.Mesh(new THREE.CircleGeometry(9,48),new THREE.MeshLambertMaterial({color:DIRT}));
  mDirt.rotation.x=-Math.PI/2;mDirt.position.set(0,0.008,-60.5);scene.add(mDirt);
  const mound=new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.9,0.35,28),new THREE.MeshLambertMaterial({color:DIRT_DK}));
  mound.position.set(0,0.17,-60.5);scene.add(mound);
  const rubber=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.06,0.1),new THREE.MeshLambertMaterial({color:0xffffff}));
  rubber.position.set(0,0.36,-60.5);scene.add(rubber);
  const ps=new THREE.Shape();ps.moveTo(-0.708,-0.717);ps.lineTo(0.708,-0.717);ps.lineTo(0.708,0);ps.lineTo(0,0.717);ps.lineTo(-0.708,0);ps.closePath();
  const plate=new THREE.Mesh(new THREE.ShapeGeometry(ps),new THREE.MeshLambertMaterial({color:0xffffff,side:THREE.DoubleSide}));
  plate.rotation.x=-Math.PI/2;plate.position.set(0,0.014,0);scene.add(plate);
  const chalkMat=new THREE.LineBasicMaterial({color:0xeef0f2,transparent:true,opacity:0.5});
  [-1.9,1.9].forEach(bx=>{const box=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(bx-0.5,0.02,-1.5),new THREE.Vector3(bx+0.5,0.02,-1.5),new THREE.Vector3(bx+0.5,0.02,1.5),new THREE.Vector3(bx-0.5,0.02,1.5),new THREE.Vector3(bx-0.5,0.02,-1.5)]);scene.add(new THREE.Line(box,chalkMat));});
  const szW=1.417,szH=2.0;
  const szLines=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(szW,szH,0.02)),new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:0.95}));
  szLines.position.set(0,2.5,0);scene.add(szLines);
  const szFill=new THREE.Mesh(new THREE.PlaneGeometry(szW,szH),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.05,side:THREE.DoubleSide}));szFill.position.set(0,2.5,0);scene.add(szFill);
  const zoneMat=new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:0.3});
  for(let zi=1;zi<3;zi++){const xx=-szW/2+(szW/3)*zi;scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(xx,1.5,0.01),new THREE.Vector3(xx,3.5,0.01)]),zoneMat));const yy=1.5+(szH/3)*zi;scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-szW/2,yy,0.01),new THREE.Vector3(szW/2,yy,0.01)]),zoneMat));}
  const gMat=new THREE.LineBasicMaterial({color:0xc6b583,transparent:true,opacity:0.16});
  for(let gz=0;gz>=-64;gz-=5)scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-9,0.025,gz),new THREE.Vector3(9,0.025,gz)]),gMat));
  for(let gx=-9;gx<=9;gx+=3)scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(gx,0.025,0),new THREE.Vector3(gx,0.025,-64)]),gMat));
  function toPoints(path){return path.map(pt=>new THREE.Vector3(-pt.s,pt.h,-pt.d));}
  const list=(opts.list&&opts.list.length)?opts.list:pitcher.pitches;
  const built=list.map(p=>{const pts=toPoints(p.path);if(pts.length)pts[pts.length-1].z=0;const tf=(typeof p.tflight==="number"&&p.tflight>0)?p.tflight:0.45;return{p,pts,col:new THREE.Color(p.displayColor||colorFor(p.type)),tflight:tf,n:pts.length};});
  const SPEED_SCALE=0.9;
  const maxLen=Math.max(...built.map(b=>b.pts.length),1);
  const trailPos=new Float32Array(maxLen*3);
  const trailGeo=new THREE.BufferGeometry();trailGeo.setAttribute("position",new THREE.BufferAttribute(trailPos,3));trailGeo.setDrawRange(0,0);
  const trailLine=new THREE.Line(trailGeo,new THREE.LineBasicMaterial({transparent:true,opacity:1,linewidth:2}));trailLine.renderOrder=1;scene.add(trailLine);
  const ghosts=built.map(b=>{const curve=new THREE.CatmullRomCurve3(b.pts);const seg=Math.max(20,b.pts.length>>1);
    const core=new THREE.Mesh(new THREE.TubeGeometry(curve,seg,0.055,8,false),new THREE.MeshBasicMaterial({color:b.col,transparent:true,opacity:0.7,depthWrite:false}));core.renderOrder=0;
    const halo=new THREE.Mesh(new THREE.TubeGeometry(curve,seg,0.13,8,false),new THREE.MeshBasicMaterial({color:b.col,transparent:true,opacity:0,depthWrite:false}));halo.renderOrder=0;
    scene.add(core);scene.add(halo);return{core,halo};});
  const ball=new THREE.Mesh(new THREE.SphereGeometry(0.26,24,24),new THREE.MeshPhongMaterial({color:0xffffff,emissive:0x222222,emissiveIntensity:0.5,shininess:60}));
  ball.visible=false;ball.renderOrder=2;scene.add(ball);
  const spinner=new THREE.Group();ball.add(spinner);
  function makeSeam(R,tR){const pts=[];for(let u=0;u<=Math.PI*2+0.001;u+=Math.PI/120){const x=0.75*Math.cos(u)+0.25*Math.cos(3*u),y=0.75*Math.sin(u)-0.25*Math.sin(3*u),z=0.66*Math.sin(2*u);pts.push(new THREE.Vector3(x,y,z).normalize().multiplyScalar(R));}return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts,true),220,tR,6,true),new THREE.MeshBasicMaterial({color:0xc0392b}));}
  spinner.add(makeSeam(0.265,0.013));
  const glow1=new THREE.Mesh(new THREE.SphereGeometry(0.5,16,16),new THREE.MeshBasicMaterial({transparent:true,opacity:0.45,depthWrite:false}));ball.add(glow1);
  const glow2=new THREE.Mesh(new THREE.SphereGeometry(0.9,12,12),new THREE.MeshBasicMaterial({transparent:true,opacity:0.16,depthWrite:false}));ball.add(glow2);
  const ballLight=new THREE.PointLight(0xffffff,3,12);ball.add(ballLight);
  const tunnelBalls=built.map(b=>{const grp=new THREE.Group();grp.add(new THREE.Mesh(new THREE.SphereGeometry(0.24,18,18),new THREE.MeshPhongMaterial({color:0xffffff,emissive:0x222222,emissiveIntensity:0.5,shininess:60})));const sp=new THREE.Group();grp.add(sp);sp.add(makeSeam(0.245,0.012));grp.add(new THREE.Mesh(new THREE.SphereGeometry(0.42,14,14),new THREE.MeshBasicMaterial({color:b.col,transparent:true,opacity:0.32,depthWrite:false})));grp.visible=false;grp.renderOrder=2;scene.add(grp);return{grp,spinner:sp,spinAngle:0};});
  function spinAxisVec(deg,gyro){if(deg==null)deg=180;const clock=((deg/30+6)%12),tiltAng=clock*30*Math.PI/180,ax=Math.sin(tiltAng),ay=-Math.cos(tiltAng),hx=ay,hy=-ax,g=Math.max(0,Math.min(1,gyro||0));const v=new THREE.Vector3(hx*(1-g),hy*(1-g),g);if(v.lengthSq()<1e-6)v.set(1,0,0);return v.normalize();}
  function applySpin(grp,seamMesh,slot,p,dt){const sp=p.spin||2000,axisDeg=(p.spinAxis!=null)?p.spinAxis:180,ptype=(p.type||"").toLowerCase();let gyro=0;if(ptype.indexOf("cutter")>=0)gyro=0.55;else if(ptype.indexOf("slider")>=0)gyro=0.65;else if(ptype.indexOf("curve")>=0)gyro=0.15;const axisVec=spinAxisVec(axisDeg,gyro);if(slot._seamKey!==ptype){const poleLocal=new THREE.Vector3(0,0,1);const fourSeam=(ptype.indexOf("four")>=0)||(ptype==="fastball")||(ptype.indexOf("curve")>=0);const twoSeam=(ptype.indexOf("sink")>=0)||(ptype.indexOf("two")>=0);const target=fourSeam?axisVec.clone():twoSeam?new THREE.Vector3(axisVec.y,-axisVec.x,0):new THREE.Vector3(0,0,1);seamMesh.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(poleLocal,target.normalize()));slot._seamKey=ptype;}slot.spinAngle+=(sp/2400)*0.5*(dt||1);grp.quaternion.setFromAxisAngle(axisVec,slot.spinAngle);}
  let defaultVisible=null;if(opts.mode==="all")defaultVisible=built.map((_,i)=>i===0);
  const state={activeIdx:0,playing:false,clock:0,frame:0,done:false,visible:defaultVisible,mode:opts.mode||"avg",built,ghosts,ball,ballLight,spinner,seam:spinner.children[0],spinAngle:0,glow1,glow2,trailGeo,trailPos,trailLine,tunnelBalls,tunnel:false,camera,onDone:null};
  let theta=0,phi=0.2;const TARGET=new THREE.Vector3(0,3,-27),RAD={v:34};
  function orbit(){camera.up.set(0,1,0);camera.position.set(TARGET.x+RAD.v*Math.sin(theta)*Math.cos(phi),TARGET.y+RAD.v*Math.sin(phi),TARGET.z+RAD.v*Math.cos(theta)*Math.cos(phi));camera.lookAt(TARGET);}
  orbit();let preset=null,presetZoom=1;
  function applyPreset(){if(!preset)return;camera.up.set(0,1,0);const[lx,ly,lz]=preset.look,[ex,ey,ez]=preset.pos;camera.position.set(lx+(ex-lx)*presetZoom,ly+(ey-ly)*presetZoom,lz+(ez-lz)*presetZoom);camera.lookAt(lx,ly,lz);}
  function snapTo(pos,look){preset={pos,look};presetZoom=1;applyPreset();TARGET.set(look[0],look[1],look[2]);const[dx,dy,dz]=[pos[0]-look[0],pos[1]-look[1],pos[2]-look[2]];RAD.v=Math.sqrt(dx*dx+dy*dy+dz*dz);phi=Math.asin(Math.max(-1,Math.min(1,dy/RAD.v)));theta=Math.atan2(dx,dz);}
  state.setCam=(angle)=>{if(angle==="catcher"){snapTo([0,3.655,6.430],[0,-1.25,-54]);}};
  let dragging=false,lastX=0,lastY=0;
  const onDown=e=>{dragging=true;lastX=e.clientX;lastY=e.clientY;};const onUp=()=>{dragging=false;};
  const onMove=e=>{if(!dragging)return;if(preset)preset=null;theta-=(e.clientX-lastX)*0.007;phi=Math.max(0.05,Math.min(1.25,phi-(e.clientY-lastY)*0.005));lastX=e.clientX;lastY=e.clientY;orbit();};
  function zoomBy(f){if(preset){presetZoom=Math.max(0.25,Math.min(2.4,presetZoom*f));applyPreset();}else{RAD.v=Math.max(6,Math.min(90,RAD.v*f));orbit();}}
  state.zoom=dir=>zoomBy(dir<0?0.85:1.18);
  const onWheel=e=>{e.preventDefault();zoomBy(e.deltaY>0?1.08:0.92);};
  const onTStart=e=>{dragging=true;lastX=e.touches[0].clientX;lastY=e.touches[0].clientY;};const onTMove=e=>onMove({clientX:e.touches[0].clientX,clientY:e.touches[0].clientY});
  mount.addEventListener("mousedown",onDown);window.addEventListener("mouseup",onUp);window.addEventListener("mousemove",onMove);mount.addEventListener("wheel",onWheel,{passive:false});mount.addEventListener("touchstart",onTStart,{passive:true});window.addEventListener("touchend",onUp);window.addEventListener("touchmove",onTMove,{passive:true});
  let raf;
  // AUDIT: fixed 0.016s timestep made pitch-flight speed frame-rate dependent
  // (wrong on 30Hz/120Hz TVs, slow-motion under frame drops). Real delta now.
  let lastT=performance.now();
  function tick(){raf=requestAnimationFrame(tick);const nowT=performance.now();const dt=Math.min(0.05,(nowT-lastT)/1000);lastT=nowT;const active=state.built[state.activeIdx];if(!active){renderer.render(scene,camera);return;}
    for(let i=0;i<state.ghosts.length;i++){const g=state.ghosts[i];const shown=state.visible?state.visible[i]!==false:true;const isActive=i===state.activeIdx;g.core.visible=shown||isActive;const ghostOpacity=opts.preview?(state.playing?0.15:0.7):( isActive?1:(shown?0.6:0));g.core.material.opacity=ghostOpacity;g.halo.visible=isActive;g.halo.material.opacity=isActive?(state.playing?0.08:0.28):0;}
    state.trailLine.material.color.copy(active.col);state.trailLine.material.opacity=opts.preview?(state.playing?1:0.7):1;state.ball.material.emissive.copy(active.col);state.glow1.material.color.copy(active.col);state.ballLight.color.copy(active.col);
    if(state.tunnel){let anyShown=false,doneAll=true;if(state.playing&&!state.done)state.clock+=dt/SPEED_SCALE;for(let ti=0;ti<state.built.length;ti++){const tb=state.tunnelBalls[ti];const shownT=state.visible?state.visible[ti]!==false:true;const bt=state.built[ti];if(!shownT||!bt.pts.length){tb.grp.visible=false;continue;}anyShown=true;const progT=state.clock/bt.tflight;if(progT<1)doneAll=false;const tf=Math.min(Math.round(progT*(bt.n-1)),bt.n-1);tb.grp.position.copy(bt.pts[tf]);tb.grp.visible=true;applySpin(tb.spinner,tb.spinner.children[0],tb,bt.p,1);}state.ball.visible=false;if(state.playing&&doneAll&&anyShown){state.done=true;state.playing=false;if(state.onDone)state.onDone();}renderer.render(scene,camera);return;}
    if(state.playing&&!state.done){state.clock+=dt/SPEED_SCALE;const prog=state.clock/active.tflight;const f=Math.min(Math.round(prog*(active.n-1)),active.n-1);state.frame=f;state.ball.position.copy(active.pts[f]);state.ball.visible=true;for(let j=0;j<=f;j++){state.trailPos[j*3]=active.pts[j].x;state.trailPos[j*3+1]=active.pts[j].y;state.trailPos[j*3+2]=active.pts[j].z;}state.trailGeo.attributes.position.needsUpdate=true;state.trailGeo.setDrawRange(0,f+1);if(prog>=1){state.done=true;state.playing=false;if(state.onDone)state.onDone();}}
    if(state.ball.visible){const tt=Date.now()*0.003;state.glow1.material.opacity=state.playing?0.5:0.3+0.15*Math.sin(tt);state.glow2.material.opacity=state.playing?0.2:0.1+0.07*Math.sin(tt*0.7);state.ballLight.intensity=state.playing?3.2:1.6+0.8*Math.sin(tt);applySpin(state.spinner,state.seam,state,active.p,1);}
    renderer.render(scene,camera);}
  tick();
  const onResize=()=>{const w=mount.clientWidth,h=mount.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();};window.addEventListener("resize",onResize);onResize();
  state.play=()=>{const active=state.built[state.activeIdx];if(state.done||state.frame>=active.pts.length-1){state.clock=0;state.frame=0;state.done=false;state.ball.visible=false;state.trailGeo.setDrawRange(0,0);state.trailGeo.attributes.position.needsUpdate=true;}state.playing=true;};
  state.stop=()=>{state.playing=false;state.tunnel=false;for(let i=0;i<state.tunnelBalls.length;i++)state.tunnelBalls[i].grp.visible=false;};
  state.playTunnel=()=>{state.tunnel=true;state.clock=0;state.frame=0;state.done=false;state.ball.visible=false;state.trailGeo.setDrawRange(0,0);state.trailGeo.attributes.position.needsUpdate=true;state.playing=true;};
  state.select=i=>{state.activeIdx=i;state.clock=0;state.frame=0;state.done=false;state.ball.visible=false;state.trailGeo.setDrawRange(0,0);state.trailGeo.attributes.position.needsUpdate=true;if(state.mode==="all"){state.visible=state.built.map((_,j)=>j===i);state.playing=true;}};
  state.setVisible=v=>{state.visible=v;};state.setMode=m=>{state.mode=m;};
  state.dispose=()=>{cancelAnimationFrame(raf);
    // AUDIT: renderer.dispose() alone never freed geometries/materials/textures;
    // the dugout TV rebuilds the scene on every pitcher change and leaked GPU
    // memory across a 3-hour game.
    scene.traverse(o=>{if(o.geometry)o.geometry.dispose();const ms=Array.isArray(o.material)?o.material:(o.material?[o.material]:[]);ms.forEach(m=>{if(m.map)m.map.dispose();m.dispose&&m.dispose();});});
    mount.removeEventListener("mousedown",onDown);window.removeEventListener("mouseup",onUp);window.removeEventListener("mousemove",onMove);mount.removeEventListener("wheel",onWheel);mount.removeEventListener("touchstart",onTStart);window.removeEventListener("touchend",onUp);window.removeEventListener("touchmove",onTMove);window.removeEventListener("resize",onResize);renderer.dispose();if(mount.contains(renderer.domElement))mount.removeChild(renderer.domElement);};
  return state;
}

// ── buildPitcherForScene ──────────────────────────────────────────────────────
// Builds the pitcher object the engine needs from already-matched arsenal + trackman rows.
// arsenalRows: PitcherArsenal records (already filtered to this pitcher)
// trackmanRows: TrackmanPitch records (already filtered to this pitcher)
export function buildPitcherForScene(displayName, throws_, arsenalRows, trackmanRows) {
  // Use trackman rows if available (real physics), fall back to arsenal aggregates
  const rows = trackmanRows && trackmanRows.length ? trackmanRows : [];

  if (rows.length > 0) {
    // Build via real pitch rows — same logic as buildPitcher in Pitch3DTab
    const mine = rows;
    const throwHand = throws_ || (() => {
      for (const r of mine) {
        const t = r.pitcher_hand || "";
        if (t && t !== "Undefined") return t[0].toUpperCase();
      }
      return "R";
    })();

    const mean = (rs, ...keys) => {
      for (const k of keys) {
        const v = rs.map(r => N(r, k)).filter(x => x != null);
        if (v.length) return v.reduce((a, b) => a + b, 0) / v.length;
      }
      return null;
    };

    const groups = {};
    for (const r of mine) {
      const t = resolvePitchType(r);
      (groups[t] = groups[t] || []).push(r);
    }

    const pitches = [];
    for (const [type, rs] of Object.entries(groups)) {
      const speed = mean(rs, "rel_speed", "RelSpeed");
      const spin  = mean(rs, "spin_rate", "SpinRate");
      const ivb   = mean(rs, "induced_vert_break", "InducedVertBreak");
      const hb    = mean(rs, "horz_break", "HorzBreak");
      const ext   = mean(rs, "extension", "Extension");
      const relH  = mean(rs, "rel_height", "RelHeight");
      const relS  = mean(rs, "rel_side", "RelSide");
      const spinAxis = circularMeanDeg(rs.map(r => N(r, "spin_axis")).filter(v => v != null));

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

      pitches.push({
        type, count: rs.length,
        speed:  speed != null ? +speed.toFixed(1) : 0,
        spin:   spin  != null ? Math.round(spin)  : 0,
        ivb:    ivb   != null ? +ivb.toFixed(1)   : 0,
        hb:     hb    != null ? +hb.toFixed(1)    : 0,
        spinAxis: spinAxis != null ? +spinAxis.toFixed(0) : null,
        tilt: axisToTilt(spinAxis),
        path, tflight: +tf.toFixed(3),
        usage: mine.length ? rs.length / mine.length : null,
      });
    }

    // Filter ≤5% usage
    const totalMine = mine.length;
    const filtered = pitches.filter(p => totalMine > 0 && p.count / totalMine > 0.05);
    filtered.sort((a, b) => b.count - a.count);

    return { name: displayName, throws: throwHand, total: mine.length, pitches: filtered, allPitches: [] };
  }

  // Fallback: build from arsenal aggregate rows (season PitcherArsenal rows)
  if (arsenalRows && arsenalRows.length > 0) {
    const groups = {};
    arsenalRows.forEach(r => {
      const pt = r.pitch_type; if (!pt) return;
      (groups[pt] = groups[pt] || []).push(r);
    });
    const totalAll = arsenalRows.reduce((s, r) => s + (r.count || 0), 0) || 1;

    const pitches = Object.entries(groups).map(([type, rs]) => {
      const total = rs.reduce((s, r) => s + (r.count || 0), 0);
      // Weighted average by pitch count — season rows use _mean suffix field names
      const wavg = f => {
        const valid = rs.filter(r => r[f] != null && Number.isFinite(r[f]));
        if (!valid.length) return null;
        const wt = valid.reduce((s, r) => s + (r.count || 1), 0) || 1;
        return valid.reduce((s, r) => s + r[f] * (r.count || 1), 0) / wt;
      };
      // Circular weighted mean for spin axis (angles wrap at 360°)
      const wavgCircular = f => {
        const valid = rs.filter(r => r[f] != null && Number.isFinite(r[f]));
        if (!valid.length) return null;
        let sx = 0, sy = 0, wt = 0;
        for (const r of valid) {
          const w = r.count || 1;
          const rad = r[f] * Math.PI / 180;
          sx += Math.cos(rad) * w; sy += Math.sin(rad) * w; wt += w;
        }
        return ((Math.atan2(sy / wt, sx / wt) * 180 / Math.PI) + 360) % 360;
      };

      const speed    = wavg('velo_mean') ?? 88;
      const ivb      = wavg('vert_break_mean');
      const hb       = wavg('horz_break_mean');
      // Season rows store release fields as rel_height_mean / rel_side_mean / extension_mean
      const relH     = wavg('rel_height_mean') ?? 6.0;
      const relS     = wavg('rel_side_mean') ?? 0;
      const ext      = wavg('extension_mean');
      const spinAxis = wavgCircular('spin_axis_mean');

      const relY_ = ext != null ? 60.5 - ext : 54;
      const vy0_ = -speed * 1.467, ay_ = 10.0;
      const dsc_ = vy0_ * vy0_ - 4 * (0.5 * ay_) * relY_;
      let tf = dsc_ > 0 ? (-vy0_ - Math.sqrt(dsc_)) / ay_ : 0.45;
      if (!(tf > 0 && tf < 1.2)) tf = 0.45;
      const ax_ = hb != null ? 2 * (hb / 12) / (tf * tf) : 0;
      const az_ = -32.174 + (ivb != null ? 2 * (ivb / 12) / (tf * tf) : 0);
      const targetZ_ = 2.5, targetX_ = relS + (hb != null ? hb / 12 : 0);
      const vz0_ = (targetZ_ - relH - 0.5 * az_ * tf * tf) / tf;
      const vx0_ = (targetX_ - relS - 0.5 * ax_ * tf * tf) / tf;
      const path = [];
      for (let i = 0; i <= 90; i++) {
        const t = (tf * i) / 90;
        path.push({ d: relY_ + vy0_ * t, h: relH + vz0_ * t + 0.5 * az_ * t * t, s: relS + vx0_ * t + 0.5 * ax_ * t * t });
      }

      return {
        type, count: total,
        speed: +speed.toFixed(1),
        spin: Math.round(wavg('spin_mean') || 0),
        ivb: ivb != null ? +ivb.toFixed(1) : 0,
        hb:  hb  != null ? +hb.toFixed(1)  : 0,
        spinAxis: spinAxis != null ? +spinAxis.toFixed(0) : null,
        tilt: axisToTilt(spinAxis),
        path, tflight: +tf.toFixed(3),
        usage: total / totalAll,
      };
    });

    pitches.sort((a, b) => b.count - a.count);
    return { name: displayName, throws: throws_ || "R", total: totalAll, pitches, allPitches: [] };
  }

  return { name: displayName, throws: throws_ || "R", total: 0, pitches: [], allPitches: [] };
}

// ── startPitchCycle ───────────────────────────────────────────────────────────
// Animation-completion-driven cycle (waits for the flight animation to
// finish via scene3d.onDone, rather than a fixed interval) — used by
// DugoutView and the pitcher-profile pitch detail modal. For a single pitch
// (pitchCount === 1) this just auto-replays the same flight on a loop.
export function makeCycle(scene3d, pitchCount, onCycle, holdMs = 3000) {
  let idx = 0, timer = null, stopped = false;
  const clearTimer = () => { if (timer) { clearTimeout(timer); timer = null; } };
  function show(i) {
    if (stopped) return;
    idx = ((i % pitchCount) + pitchCount) % pitchCount;
    scene3d.activeIdx = idx;
    scene3d.select(idx);
    scene3d.setVisible(new Array(pitchCount).fill(true));
    scene3d.play();
    if (onCycle) onCycle(idx);
  }
  scene3d.onDone = () => {
    if (stopped) return;
    clearTimer();
    timer = setTimeout(() => { if (!stopped) show(idx + 1); }, Math.max(0, holdMs - 600));
  };
  scene3d.activeIdx = 0;
  show(0);
  return { stop() { stopped = true; clearTimer(); scene3d.onDone = null; } };
}

// Cycles through pitches in the scene, calling onIndexChange(i) each time.
// Returns { stop } to clean up.
export function startPitchCycle(scene3d, pitchCount, onIndexChange, intervalMs = 3000) {
  if (!scene3d || pitchCount <= 0) return { stop: () => {} };

  let idx = 0;
  scene3d.select(idx);
  scene3d.play();
  if (onIndexChange) onIndexChange(idx);

  const advance = () => {
    idx = (idx + 1) % pitchCount;
    scene3d.select(idx);
    scene3d.play();
    if (onIndexChange) onIndexChange(idx);
  };

  const timer = setInterval(advance, intervalMs);
  return { stop: () => clearInterval(timer) };
}