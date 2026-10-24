import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import './style.css';

/* ================= OPTIONAL GLB ASSETS (put files in public/assets/models/) ================= */
const ASSETS = {
  base: '/assets/models/',
  player: null, // e.g. { file: 'sedan.glb', len: 4.5, yaw: 0 }
  cars: [], // e.g. [{ file: 'van.glb', len: 5.4, yaw: 0, for: ['minibus'] }, { file: 'taxi.glb', len: 4.5, yaw: 0, for: ['taxi', 'sedan'] }]
  person: null // e.g. { file: 'person.glb', h: 1.75, yaw: 0, walk: 'walk' }
};
const gltfLoader = new GLTFLoader(), modelCache = new Map(), mixers = [];
function loadGLB(f) {
  if (!modelCache.has(f)) modelCache.set(f, gltfLoader.loadAsync(ASSETS.base + f).catch(e => { console.warn('[assets] could not load', f, e?.message || e); return null; }));
  return modelCache.get(f);
}
function fitModel(src, target, yaw = 0, byHeight = false) {
  const m = SkeletonUtils.clone(src.scene), wrap = new THREE.Group(); m.rotation.y = yaw; wrap.add(m);
  const sz = new THREE.Box3().setFromObject(wrap).getSize(new THREE.Vector3());
  m.scale.setScalar(target / (byHeight ? sz.y : Math.max(sz.x, sz.z)));
  wrap.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(wrap), c = b.getCenter(new THREE.Vector3());
  m.position.set(-c.x, -b.min.y, -c.z);
  wrap.traverse(o => { if (o.isMesh) { o.castShadow = true; o.layers.set(1); } });
  return wrap;
}
function skinVehicle(g, type, player) {
  const list = ASSETS.cars.filter(c => !c.for || c.for.includes(type));
  const A = player ? ASSETS.player : list.length ? list[Math.floor(Math.random() * list.length)] : null;
  if (!A) return;
  loadGLB(A.file).then(src => {
    if (!src) return;
    g.children.forEach(c => { if (!c.userData.keep) c.visible = false; });
    g.add(fitModel(src, A.len || g.userData.l, A.yaw || 0));
  });
}
function skinPerson(p) {
  const A = ASSETS.person; if (!A) return;
  loadGLB(A.file).then(src => {
    if (!src) return;
    p.children.forEach(c => c.visible = false);
    const m = fitModel(src, A.h || 1.75, A.yaw || 0, true); p.add(m);
    if (src.animations.length) {
      const mx = new THREE.AnimationMixer(m.children[0]);
      const clip = src.animations.find(a => new RegExp(A.walk || 'walk', 'i').test(a.name)) || src.animations[0];
      mx.clipAction(clip).play(); mixers.push(mx);
    }
  });
}

/* ================= HELPERS & CONFIG ================= */
const rand = (a, b) => a + Math.random() * (b - a);
const irand = (a, b) => Math.floor(rand(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = THREE.MathUtils.clamp, damp = THREE.MathUtils.damp;
const $ = id => document.getElementById(id);
const RATE = 1500; // ₦ per $1
const fmtN = n => '₦' + Math.round(n).toLocaleString('en-NG');
const fmtD = n => '$' + n.toFixed(2);
function rng(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hash = (a, b) => (Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663)) >>> 0;

const B = 160; // city block pitch (road centre to road centre)
// Ibadan, Oyo State: stylised districts (street names approximate, grid is not a true map)
const DISTRICTS = [
  { name: 'Dugbe', streets: ['Dugbe Road', 'Oba Adebimpe Road', 'Ayeye Road', 'Alesinloye Road'], h: [8, 24], walls: [0, 1, 3], tint: 0xffffff, ground: 'dirt', crowd: 1, stallP: 0.9, lm: 'cocoa' },
  { name: 'Mokola', streets: ['Mokola Road', 'Sabo Road', 'Iwo Road', 'Ojoo Road'], h: [5, 12], walls: [2, 0], tint: 0xf2d9c0, ground: 'dirt', crowd: 0.9, stallP: 0.8, rust: true },
  { name: 'Challenge', streets: ['Challenge Road', 'Iwo Road', 'Ife Road', 'Orita Challenge Road'], h: [5, 12], walls: [0, 2, 4], tint: 0xe8d0b0, ground: 'dirt', crowd: 1, stallP: 0.95, rust: true },
  { name: 'Ring Road', streets: ['Ring Road', 'Queen Elizabeth Road', 'Gbagi Road', 'Ibadan-Lagos Expressway'], h: [8, 22], walls: [3, 1], tint: 0xffffff, ground: 'dirt', crowd: 0.9, stallP: 0.7 },
  { name: 'Bodija', streets: ['Bodija Road', 'Samonda Road', 'Oyo Road', 'Secretariat Road'], h: [5, 14], walls: [3, 0], tint: 0xf4ecdc, ground: 'grass', crowd: 0.6, stallP: 0.5, rust: true },
  { name: 'Sango (UI)', streets: ['Sango Road', 'University Road', 'Agbowo Road', 'Eleyele Road'], h: [6, 16], walls: [1, 3, 4], tint: 0xe6efe0, ground: 'grass', crowd: 0.8, stallP: 0.5, palm: true },
  { name: 'Agodi', streets: ['Agodi Gate Road', 'Secretariat Road', 'Adamasingba Road', 'Oyo Road'], h: [8, 20], walls: [3, 4], tint: 0xeef2ff, ground: 'grass', crowd: 0.5, stallP: 0.3 },
  { name: 'Mapo / Oke Are', streets: ['Mapo Road', 'Oke Are Road', 'Oke Ado Road', 'Molete Road'], h: [5, 11], walls: [2, 0, 1], tint: 0xe3c9a6, ground: 'dirt', crowd: 0.8, stallP: 0.7, rust: true, lm: ['mapo', 'bower'] }
];
const ND = DISTRICTS.length;
const distAtTile = (ci, cj) => DISTRICTS[(((Math.floor(ci / 3) * 2 + Math.floor(cj / 3) * 3) % ND) + ND) % ND];
const distAt = (x, z) => distAtTile(Math.floor(x / B), Math.floor(z / B));
const roadName = (axis, idx, st) => { const L = st.streets.length; return st.streets[(((idx + (axis === 'x' ? 1 : 0)) % L) + L) % L]; };
const SITE_NAMES = ['Naija Oil', 'Oyo Petrol', 'Ibadan Fuels', 'Oluyole Gas', 'Unity Oil'];

const CARS = {
  cab: { name: 'Ibadan Cab', type: 'taxi', price: 0, maxV: 52, acc: 24, tank: 30, burn: 1, fare: 1 },
  hatch: { name: 'City Hatch', type: 'hatch', price: 60000, maxV: 48, acc: 22, tank: 28, burn: 0.7, fare: 0.9 },
  sedan: { name: 'Comfort Sedan', type: 'sedan', price: 150000, maxV: 56, acc: 27, tank: 35, burn: 0.85, fare: 1.15 },
  suv: { name: 'Executive SUV', type: 'suv', price: 400000, maxV: 54, acc: 25, tank: 55, burn: 1.3, fare: 1.5 },
  sports: { name: 'Sport Coupe', type: 'sports', price: 900000, maxV: 70, acc: 34, tank: 40, burn: 1.6, fare: 1.8 }
};
const PAINTS = [['Yellow', 0xf5c518], ['Black', 0x15171a], ['White', 0xf1f1f1], ['Red', 0xd7192d],
  ['Blue', 0x1f5fbf], ['Green', 0x1f8a4c], ['Silver', 0xa7adb3]];
const WX = {
  clear: { n: 'Clear', i: '☀️', near: 90, far: 330, light: 1, rain: 0, grip: 1, haze: 0 },
  cloudy: { n: 'Cloudy', i: '⛅', near: 70, far: 270, light: 0.7, rain: 0, grip: 1, haze: 0 },
  rain: { n: 'Rain', i: '🌧️', near: 40, far: 200, light: 0.5, rain: 1, grip: 0.7, haze: 0 },
  storm: { n: 'Storm', i: '⛈️', near: 25, far: 140, light: 0.3, rain: 1.6, grip: 0.55, haze: 0 },
  harmattan: { n: 'Harmattan haze', i: '🌫️', near: 20, far: 150, light: 0.75, rain: 0, grip: 0.95, haze: 1 }
};
const WX_KEYS = Object.keys(WX);

const SAVE_KEY = 'sl-racer-taxi-v1';
const S = { ngn: 5000, usd: 0, fuel: 18, car: 'cab', color: 0xf5c518, owned: { cab: 1 }, damage: 0, rides: 0, stars: 5, history: [] };
try { Object.assign(S, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch {}
if (!CARS[S.car]) S.car = 'cab';
if (!Array.isArray(S.history)) S.history = [];
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch {} };

/* ================= SCENE ================= */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7fb8e6);
scene.fog = new THREE.Fog(0xbcdcf0, 90, 330);
const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 700);
camera.layers.enable(1); // layer 1 = detail (cars, people, trees…) hidden from the map camera
const mapCam = new THREE.PerspectiveCamera(50, 1, 1, 2500);
mapCam.layers.set(0); mapCam.layers.enable(2);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.body.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xdfefff, 0x50634a, 1.6);
const sun = new THREE.DirectionalLight(0xfff2dc, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -35, right: 35, top: 35, bottom: -35, far: 140 });
sun.shadow.bias = -0.0004;
scene.add(hemi, sun, sun.target);

/* ================= TEXTURES & MATERIALS ================= */
function canvasTex(w, h, draw, rx = 1, ry = 1) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry); t.anisotropy = 8; return t;
}
const speckle = (g, w, h, base) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < w * h / 5; i++) {
    g.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.08)';
    g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
  }
};
const mat = (color, roughness = 0.7, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const glassMat = mat(0x142435, 0.15, 0.5), darkMat = mat(0x1d2024, 0.8), tireMat = mat(0x15171a, 0.9);
const rimMat = mat(0xc4ccd3, 0.25, 0.85), roofMat = mat(0x6d7075, 0.9), trunkMat = mat(0x5a3d26);
const leafMats = [mat(0x2f7a3c), mat(0x3b8d3f), mat(0x2a6b36)];
const poleMat = mat(0x6b737b, 0.5, 0.6), chromeMat = mat(0xd8dde2, 0.2, 0.9), curbMat = mat(0x9a9a96, 0.9);
const acMat = mat(0x9aa0a6, 0.6, 0.3), whiteMat = mat(0xf1ede2, 0.8), stoneMat = mat(0xb9a98c, 0.9), hillMat = mat(0x5f7d3a, 1);
const rustMat = new THREE.MeshStandardMaterial({
  roughness: 0.85, metalness: 0.2,
  map: canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#8a4b2a'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 8) { g.fillStyle = x % 16 ? 'rgba(0,0,0,.25)' : 'rgba(255,170,110,.18)'; g.fillRect(x, 0, 4, h); }
    for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(${90 + Math.random() * 60},${40 + Math.random() * 30},20,.25)`; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
  }, 4, 4)
});
const lampMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff1c0, emissiveIntensity: 0.8 });
const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffee, emissiveIntensity: 0.7 });

const roadTex = canvasTex(512, 512, (g, w, h) => {
  speckle(g, w, h, '#34373c');
  g.fillStyle = '#e8b923'; g.fillRect(249, 0, 4, h); g.fillRect(259, 0, 4, h);
  g.fillStyle = '#f2f0e4';
  for (const x of [128, 384]) { g.fillRect(x - 2, 0, 4, 128); g.fillRect(x - 2, 256, 4, 128); }
  g.fillRect(10, 0, 5, h); g.fillRect(497, 0, 5, h);
}, 1, 9);
const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.92 });
const interMat = new THREE.MeshStandardMaterial({
  roughness: 0.92,
  map: canvasTex(256, 256, (g, w, h) => {
    speckle(g, w, h, '#34373c'); g.fillStyle = '#f2f0e4';
    for (let p = 20; p < 240; p += 28) { g.fillRect(p, 0, 14, 40); g.fillRect(p, 216, 14, 40); g.fillRect(0, p, 40, 14); g.fillRect(216, p, 40, 14); }
  })
});
const groundMat = c => new THREE.MeshStandardMaterial({ map: canvasTex(256, 256, (g, w, h) => speckle(g, w, h, c), 160, 160), roughness: 1 });
const GROUND = { grass: groundMat('#3f8a47'), dirt: groundMat('#9a5d3b') }; // red laterite soil
const winTexes = ['#c9b79c', '#8d98a3', '#a86f5a', '#d8d4cb', '#5d6b7a'].map(wall =>
  canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = wall; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      g.fillStyle = Math.random() < 0.3 ? '#ffe7a0' : '#25384c'; g.fillRect(x * 32 + 6, y * 32 + 7, 20, 18);
    }
  }));
const textSign = (t, bg, fg = '#fff', w = 256, h = 64) => new THREE.MeshBasicMaterial({
  map: canvasTex(w, h, (g, W, H) => {
    g.fillStyle = bg; g.fillRect(0, 0, W, H); g.fillStyle = fg;
    g.font = `bold ${Math.round(H * 0.6)}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, W / 2, H / 2 + 2);
  })
});
const signMats = [['CAFÉ', '#c0392b'], ['PHARMACY', '#1e8449'], ['BANK', '#1f4e8c'], ['HOTEL', '#6c3483'],
  ['PEPPER SOUP', '#d68910'], ['SUYA', '#b03a2e'], ['TELECOM', '#117a8b'], ['AMALA', '#6b4a1e'], ['POS', '#0f766e']].map(([t, c]) => textSign(t, c));
const AWN = [0xc0392b, 0x2980b9, 0x27ae60, 0xe67e22, 0x8e44ad];
const layerAll = o => { o.traverse(c => c.layers.set(1)); return o; };

/* ================= VEHICLES ================= */
const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.26, 18).rotateZ(Math.PI / 2);
const hubGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.28, 12).rotateZ(Math.PI / 2);
const plateGeo = new THREE.PlaneGeometry(0.5, 0.12);
const archGeo = new THREE.TorusGeometry(0.47, 0.05, 6, 14, Math.PI).rotateY(Math.PI / 2);
const pipeGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.25, 8).rotateX(Math.PI / 2);
const amber = () => new THREE.MeshStandardMaterial({ color: 0x6b4a00, emissive: 0xffa000, emissiveIntensity: 0 });
const plateMats = Array.from({ length: 6 }, () => {
  const L = 'ABCDEFGHJKLMNPRSTUVWXYZ', r = () => L[Math.floor(Math.random() * L.length)];
  const txt = r() + r() + r() + ' ' + (100 + Math.floor(Math.random() * 899));
  return new THREE.MeshStandardMaterial({
    roughness: 0.5,
    map: canvasTex(128, 64, (g, w, h) => {
      g.fillStyle = '#f4f4f0'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#223'; g.lineWidth = 4; g.strokeRect(3, 3, w - 6, h - 6);
      g.fillStyle = '#1b2a6b'; g.font = 'bold 30px Arial'; g.textAlign = 'center'; g.fillText(txt, w / 2, 43);
    })
  });
});
const SPECS = {
  sports: [1.9, 4.3, 0.45, 0.42, 0.4], sedan: [1.8, 4.5, 0.55, 0.5, 0.45], taxi: [1.8, 4.5, 0.55, 0.5, 0.45],
  police: [1.85, 4.6, 0.55, 0.5, 0.45], suv: [1.95, 4.7, 0.8, 0.7, 0.6], hatch: [1.75, 3.9, 0.55, 0.55, 0.55]
};

function makeVehicle(type, color) {
  const g = new THREE.Group(), tails = [], wheels = [], sigL = [], sigR = [], flash = [];
  const paint = mat(color, 0.3, 0.45);
  const add = (geo, m, x, y, z, sh = false) => {
    const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = sh; g.add(o); return o;
  };
  const box = (w, h, l) => new THREE.BoxGeometry(w, h, l);
  let w, l, wz, bh = 0, topY = 0;
  const P = { my: 1.3, mz: -0.5, ms: 1, ly: 0.85, fz: 0, rz: 0, py: 0.5 };

  if (type === 'truck') {
    w = 2.5; l = 10; wz = [-3.4, 2.2, 3.6];
    Object.assign(P, { my: 2.6, mz: -4.7, ms: 1.8, ly: 1.0, fz: -5.0, rz: 4.82, py: 0.9 });
    add(box(2.3, 2.4, 2.2), paint, 0, 1.9, -3.9, true);
    add(box(2.2, 1, 0.1), glassMat, 0, 2.4, -5.02);
    add(box(2.5, 2.8, 6.6), mat(0xe6e6e6, 0.8), 0, 2.3, 1.5, true);
    add(box(2.4, 0.4, 9.6), darkMat, 0, 0.7, 0, true);
    add(box(2.3, 0.1, 0.5), paint, 0, 3.15, -4.95);
    add(box(1.5, 0.8, 0.06), darkMat, 0, 1.2, -5.04);
    add(box(2.4, 0.35, 0.3), chromeMat, 0, 0.6, -5.1);
    for (const s of [-1, 1]) {
      add(new THREE.CylinderGeometry(0.1, 0.1, 2.6, 8), chromeMat, s * 1.25, 3.0, -3.0);
      add(box(0.6, 0.6, 1.1), chromeMat, s * 1.3, 0.8, -1.0);
      add(box(0.5, 0.5, 0.04), darkMat, s * 1.0, 0.35, 4.2);
      for (const z of [-1.5, 0, 1.5, 3, 4.5]) add(box(0.04, 0.08, 0.2), amber(), s * 1.26, 0.95, z);
    }
    for (const x of [-0.6, 0, 0.6]) add(box(0.03, 2.6, 0.03), darkMat, x, 2.3, 4.84);
  } else if (type === 'bus') { // yellow "danfo"
    w = 2.6; l = 11; wz = [-3.6, 3.3];
    Object.assign(P, { my: 2.6, mz: -5.3, ms: 1.8, ly: 1.0, fz: -5.5, rz: 5.5, py: 0.9 });
    add(box(2.6, 2.7, 11), paint, 0, 1.8, 0, true);
    add(box(2.62, 0.3, 10.2), mat(0x111111, 0.6), 0, 1.3, 0);
    add(box(2.64, 0.9, 10), glassMat, 0, 2.4, 0);
    add(box(2.4, 1.1, 0.04), glassMat, 0, 2.45, -5.51);
    add(box(1.8, 0.3, 0.04), lampMat, 0, 3.0, -5.52);
    add(box(1.6, 0.3, 2.2), mat(0xbfc4c9), 0, 3.3, 2.5);
    for (let k = -4; k <= 4; k++) for (const s of [-1, 1]) add(box(0.04, 0.9, 0.08), darkMat, s * 1.32, 2.4, k * 1.1);
    for (const z of [-4.1, -0.6]) add(box(0.05, 2, 1.1), glassMat, 1.31, 1.6, z);
    add(box(2.6, 0.3, 0.2), chromeMat, 0, 0.55, -5.6);
  } else if (type === 'minibus') { // Hiace-style "korope"
    w = 1.9; l = 5.4; wz = [-1.7, 1.7]; topY = 2.2;
    Object.assign(P, { my: 1.7, mz: -2.0, ms: 1.2, ly: 0.9, fz: -2.7, rz: 2.7, py: 0.6 });
    add(box(1.9, 1.6, 5.4), paint, 0, 1.25, 0, true);
    add(box(1.92, 0.22, 5.2), mat(0x111111, 0.6), 0, 0.85, 0);
    add(box(1.92, 0.6, 4.2), glassMat, 0, 1.75, 0.45);
    add(box(1.7, 0.7, 0.06), glassMat, 0, 1.7, -2.71);
    add(box(1.5, 0.08, 3), chromeMat, 0, 2.08, 0.6);
    for (const s of [-1, 1]) add(box(0.03, 1.1, 0.03), darkMat, s * 0.96, 1.25, 0.1);
  } else if (type === 'pickup') {
    w = 1.95; l = 5.2; wz = [-1.6, 1.6]; topY = 1.97;
    Object.assign(P, { my: 1.5, mz: -0.95, ms: 1, ly: 0.95, fz: -2.6, rz: 2.6, py: 0.6 });
    add(box(w, 0.7, l), paint, 0, 0.85, 0, true);
    add(box(w - 0.2, 0.8, 1.7), glassMat, 0, 1.55, -0.7, true);
    add(box(w - 0.35, 0.08, 1.5), paint, 0, 1.97, -0.7);
    for (const s of [-1, 1]) add(box(0.1, 0.5, 2.5), paint, s * (w / 2 - 0.05), 1.45, 1.35);
    add(box(w, 0.5, 0.1), paint, 0, 1.45, 2.55);
    add(box(w - 0.1, 0.14, 0.2), chromeMat, 0, 0.55, -2.6);
  } else if (type === 'keke') { // tricycle
    w = 1.35; l = 2.8; wz = [0]; topY = 1.9;
    Object.assign(P, { my: 1.35, mz: -0.75, ms: 0.8, ly: 0.8, fz: -1.4, rz: 1.4, py: 0.5 });
    add(box(1.3, 0.7, 2.0), paint, 0, 0.8, 0.45, true);
    add(box(0.7, 0.6, 0.8), paint, 0, 0.75, -1.0, true);
    add(box(1.4, 0.08, 2.1), mat(0x111111, 0.6), 0, 1.95, 0.4);
    for (const x of [-0.65, 0.65]) for (const z of [-0.5, 1.3]) add(box(0.05, 1.0, 0.05), darkMat, x, 1.45, z);
    add(box(1.2, 0.8, 0.05), glassMat, 0, 1.45, -0.55);
    add(box(1.1, 0.2, 0.7), darkMat, 0, 1.05, 1.0);
  } else if (type === 'okada') { // motorcycle taxi with rider
    w = 0.8; l = 2.0; wz = [0]; topY = 1.5;
    Object.assign(P, { my: 1.2, mz: -0.7, ms: 0.8, ly: 0.95, fz: -0.9, rz: 0.95, py: 0.55 });
    add(box(0.3, 0.45, 1.5), darkMat, 0, 0.65, 0, true);
    add(box(0.36, 0.3, 0.6), paint, 0, 0.98, -0.3, true);
    add(box(0.34, 0.14, 0.95), darkMat, 0, 0.95, 0.5);
    add(box(0.8, 0.05, 0.05), chromeMat, 0, 1.2, -0.62);
    add(box(0.1, 0.5, 0.1), chromeMat, 0, 0.9, -0.7);
    for (let k = 0; k < (Math.random() < 0.5 ? 2 : 1); k++) {
      const r = makePerson(Math.random() < 0.8 ? 'M' : 'F', irand(0, 1)); dressPerson(r);
      r.position.set(0, 0.2, 0.05 + k * 0.55); r.scale.setScalar(0.88);
      r.userData.legs.forEach(lg => lg.rotation.x = 1.15); r.userData.arms.forEach(a => a.rotation.x = k ? 0.3 : 1.0);
      g.add(r);
    }
  } else {
    const [sw, sl, b, ch, cr] = SPECS[type];
    w = sw; l = sl; bh = b; wz = [-l * 0.3, l * 0.3];
    topY = 0.7 + bh / 2 + ch + 0.08;
    Object.assign(P, { my: 0.7 + bh / 2 + 0.12, mz: l * 0.05 - l * cr / 2 + 0.15, fz: -l / 2, rz: l / 2 });
    add(box(w, bh, l), paint, 0, 0.7, 0, true);
    add(box(w - 0.25, ch, l * cr), glassMat, 0, 0.7 + bh / 2 + ch / 2, l * 0.05, true);
    add(box(w - 0.35, 0.08, l * cr - 0.4), paint, 0, topY - 0.04, l * 0.05);
    add(box(w - 0.1, 0.16, 0.18), darkMat, 0, 0.5, -l / 2);
    add(box(w - 0.1, 0.16, 0.18), darkMat, 0, 0.5, l / 2);
    add(box(w * 0.3, 0.12, 0.04), darkMat, 0, 0.75, -l / 2 - 0.02);
    add(box(w * 0.3, 0.03, 0.04), chromeMat, 0, 0.83, -l / 2 - 0.02);
    for (const s of [-1, 1]) {
      for (const zf of [-0.17, 0.08, 0.3]) add(box(0.012, bh, 0.02), darkMat, s * (w / 2 + 0.006), 0.7, l * zf);
      for (const zf of [-0.12, 0.14]) add(box(0.02, 0.035, 0.13), chromeMat, s * (w / 2 + 0.01), 0.7 + bh / 2 - 0.07, l * zf);
      add(box(0.2, 0.1, 0.06), darkMat, s * w * 0.38, 0.5, -l / 2 - 0.02);
      add(pipeGeo, chromeMat, s * w * 0.28, 0.42, l / 2 + 0.05);
    }
    add(box(0.015, 0.14, 0.14), chromeMat, w / 2 + 0.01, 0.7 + bh / 2 - 0.12, l * 0.32);
    if (type === 'sports') {
      add(box(w - 0.2, 0.06, 0.4), darkMat, 0, 1.3, l / 2 - 0.2);
      for (const s of [-1, 1]) {
        add(box(0.05, 0.25, 0.1), darkMat, s * 0.6, 1.17, l / 2 - 0.2);
        add(box(0.03, 0.08, l * 0.45), darkMat, s * (w / 2 + 0.01), 0.42, 0);
      }
      add(box(w, 0.04, 0.3), darkMat, 0, 0.38, -l / 2 - 0.1);
    } else if (type === 'suv') {
      for (const s of [-1, 1]) add(box(0.05, 0.05, l * 0.45), chromeMat, s * (w / 2 - 0.3), topY + 0.05, l * 0.05);
      for (const z of [-0.5, 0.7]) add(box(w - 0.5, 0.04, 0.05), chromeMat, 0, topY + 0.08, z);
      add(new THREE.CylinderGeometry(0.01, 0.01, 0.6, 5), darkMat, 0.5, topY + 0.3, l * 0.3);
    } else if (type === 'taxi') {
      add(box(0.5, 0.15, 0.25), lampMat, 0, topY + 0.08, l * 0.05);
      for (const s of [-1, 1]) add(box(0.012, 0.06, l * 0.8), darkMat, s * (w / 2 + 0.007), 0.82, 0);
    } else if (type === 'police') {
      for (const s of [-1, 1]) add(box(0.014, bh, l * 0.28), mat(0xf2f2f2, 0.5), s * (w / 2 + 0.007), 0.7, l * 0.1);
      add(box(0.9, 0.08, 0.3), darkMat, 0, topY + 0.04, l * 0.05);
      const red = new THREE.MeshStandardMaterial({ color: 0x600000, emissive: 0xff0000, emissiveIntensity: 0.2 });
      const blue = new THREE.MeshStandardMaterial({ color: 0x000060, emissive: 0x2255ff, emissiveIntensity: 0.2 });
      add(box(0.4, 0.1, 0.26), red, -0.23, topY + 0.1, l * 0.05);
      add(box(0.4, 0.1, 0.26), blue, 0.23, topY + 0.1, l * 0.05);
      flash.push(red, blue);
      add(new THREE.CylinderGeometry(0.01, 0.01, 0.6, 5), darkMat, 0.5, topY + 0.3, l * 0.3);
    }
  }

  const WP = type === 'keke' ? [[0, -1.0], [-0.62, 0.8], [0.62, 0.8]] : type === 'okada' ? [[0, -0.75], [0, 0.75]]
    : [-(w / 2 - 0.05), w / 2 - 0.05].flatMap(x => wz.map(z => [x, z]));
  const minZ = Math.min(...WP.map(p => p[1]));
  for (const [x, z] of WP) {
    const pivot = new THREE.Group(), spin = new THREE.Group();
    pivot.position.set(x, 0.38, z);
    const tire = new THREE.Mesh(wheelGeo, tireMat); tire.castShadow = true;
    spin.add(tire, new THREE.Mesh(hubGeo, rimMat)); pivot.add(spin); g.add(pivot);
    wheels.push({ pivot, spin, front: z === minZ });
    if (!['truck', 'bus', 'keke', 'okada'].includes(type)) add(archGeo, darkMat, Math.sign(x) * (w / 2), 0.38, z);
  }
  for (const s of [-1, 1]) {
    add(box(0.12 * P.ms, 0.084 * P.ms, 0.06 * P.ms), paint, s * (w / 2 + 0.1 * P.ms), P.my, P.mz);
    add(box(0.4, 0.15, 0.08), headMat, s * w * 0.32, P.ly, P.fz - 0.02);
    const tm = new THREE.MeshStandardMaterial({ color: 0x701010, emissive: 0xff1010, emissiveIntensity: 0.5 });
    add(box(0.42, 0.15, 0.08), tm, s * w * 0.32, P.ly, P.rz + 0.02); tails.push(tm);
    for (const [z, d] of [[P.fz, -0.03], [P.rz, 0.03]]) {
      const a = amber(); add(box(0.2, 0.1, 0.06), a, s * (w / 2 - 0.2), P.ly - 0.15, z + d); (s < 0 ? sigL : sigR).push(a);
    }
  }
  const pm = pick(plateMats);
  add(plateGeo, pm, 0, P.py, P.fz - 0.12).rotation.y = Math.PI;
  add(plateGeo, pm, 0, P.py, P.rz + 0.12);
  g.userData = { w, l, topY, tails, wheels, sigL, sigR, flash };
  return layerAll(g);
}

/* ================= PEOPLE ================= */
const SKIN = [0x3b2219, 0x5a3a28, 0x7a4e34, 0x9a6a48, 0xe0b896];
const CLOTH = [0xd7192d, 0xf5c518, 0x1f8a4c, 0x1f5fbf, 0xe67e22, 0x8e44ad, 0xffffff, 0xff5fa2, 0x0f766e];
const legGeo = new THREE.BoxGeometry(0.13, 0.8, 0.14), torsoGeo = new THREE.BoxGeometry(0.46, 0.6, 0.26);
const armGeo = new THREE.BoxGeometry(0.1, 0.55, 0.1), headGeo = new THREE.SphereGeometry(0.13, 10, 8);
const skirtGeo = new THREE.CylinderGeometry(0.2, 0.34, 0.65, 10), robeGeo = new THREE.CylinderGeometry(0.26, 0.4, 0.95, 10);
const robeTopGeo = new THREE.BoxGeometry(0.7, 0.6, 0.34), filaGeo = new THREE.CylinderGeometry(0.13, 0.16, 0.16, 10);
const hairGeo = new THREE.BoxGeometry(0.27, 0.06, 0.27), geleGeo = new THREE.BoxGeometry(0.34, 0.16, 0.3);
// variant: 0 plain, 1 fila cap, 2 agbada robe + fila
function makePerson(gender, variant = 0) {
  const g = new THREE.Group();
  const skin = mat(0x5a3a28, 0.8), cloth = mat(0xd7192d, 0.8), pant = mat(0x222222, 0.8);
  const hair = mat(0x111111, 0.9), wrap = mat(0xf5c518, 0.7);
  const part = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); return o; };
  const legs = [], arms = [];
  for (const s of [-1, 1]) {
    const lg = new THREE.Group(); lg.position.set(s * 0.12, 0.85, 0);
    lg.add(part(legGeo, gender === 'F' ? skin : pant, 0, -0.4, 0)); g.add(lg); legs.push(lg);
    const ar = new THREE.Group(); ar.position.set(s * 0.3, 1.45, 0);
    ar.add(part(armGeo, cloth, 0, -0.28, 0)); g.add(ar); arms.push(ar);
  }
  g.add(part(torsoGeo, cloth, 0, 1.15, 0), part(headGeo, skin, 0, 1.62, 0));
  if (gender === 'F') g.add(part(skirtGeo, cloth, 0, 0.82, 0), part(geleGeo, wrap, 0, 1.76, 0));
  else {
    if (variant >= 2) g.add(part(robeGeo, cloth, 0, 0.78, 0), part(robeTopGeo, cloth, 0, 1.15, 0));
    g.add(variant >= 1 ? part(filaGeo, wrap, 0, 1.78, 0) : part(hairGeo, hair, 0, 1.74, 0));
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.userData = { legs, arms, skin, cloth, pant, wrap, phase: Math.random() * 6 };
  return layerAll(g);
}
function dressPerson(p, foreign) {
  const u = p.userData;
  u.skin.color.setHex(foreign ? SKIN[4] : pick(SKIN.slice(0, 4)));
  u.cloth.color.setHex(pick(CLOTH)); u.wrap.color.setHex(pick(CLOTH)); u.pant.color.setHex(pick([0x1f2a44, 0x222222, 0x4a3b2a]));
}
const peds = [];
for (let i = 0; i < 24; i++) {
  const mesh = makePerson(i < 12 ? 'M' : 'F', i % 3); scene.add(mesh); skinPerson(mesh); peds.push({ mesh, dir: 1 });
}
const waiter = makePerson('F'); waiter.visible = false; scene.add(waiter); skinPerson(waiter);

/* ================= CITY TILES (grid world) ================= */
const bGeo = new THREE.BoxGeometry(1, 1, 1), bx = (w, h, l) => new THREE.BoxGeometry(w, h, l);
const signGeo = new THREE.PlaneGeometry(4, 1);
const interGeo = new THREE.PlaneGeometry(16, 16).rotateX(-Math.PI / 2);
const segGeo = new THREE.PlaneGeometry(16, 144).rotateX(-Math.PI / 2);
const slabGeo = new THREE.BoxGeometry(144, 0.25, 144);
const treeGeo = new THREE.IcosahedronGeometry(1.7, 1), trunkGeo = new THREE.CylinderGeometry(0.15, 0.22, 2.2, 7);
const poleGeo = new THREE.CylinderGeometry(0.07, 0.1, 7, 8), lampGeo = new THREE.BoxGeometry(0.6, 0.12, 0.35);
const sigPoleGeo = new THREE.CylinderGeometry(0.08, 0.1, 6, 6), headBoxGeo = new THREE.BoxGeometry(0.5, 1.1, 0.4), dotGeo = new THREE.SphereGeometry(0.2, 8, 6);
const tableGeo = new THREE.BoxGeometry(1.8, 0.8, 1), umbGeo = new THREE.ConeGeometry(1.3, 0.5, 8);
const lampZ = new THREE.MeshBasicMaterial({ color: 0xff2a2a }), lampX = new THREE.MeshBasicMaterial({ color: 0x2dff6b });
const cocoaTex = winTexes[3].clone(); cocoaTex.needsUpdate = true; cocoaTex.repeat.set(3, 10);
const cocoaMat = new THREE.MeshStandardMaterial({ map: cocoaTex, roughness: 0.7 }), cocoaSign = textSign('COCOA HOUSE', '#1f4e8c', '#fff', 384, 72);

function makeTree() {
  const t = new THREE.Group();
  const tr = new THREE.Mesh(trunkGeo, trunkMat); tr.position.y = 1.1;
  const lf = new THREE.Mesh(treeGeo, pick(leafMats)); lf.position.y = 3.6; lf.scale.y = 1.2;
  t.add(tr, lf); return layerAll(t);
}
function makeLandmarks() { // stylised, inspired by Ibadan icons
  const L = {};
  const mk = (name, fn) => { const g = new THREE.Group(); g.position.set(80, 0.2, 80); g.visible = false; fn(g); L[name] = g; };
  const add = (g, geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  mk('cocoa', g => {
    add(g, bx(18, 60, 18), cocoaMat, 0, 30, 0); add(g, bx(20, 2.5, 20), roofMat, 0, 61.2, 0);
    add(g, new THREE.CylinderGeometry(0.4, 0.6, 14, 8), poleMat, 0, 69, 0);
    for (const [x, z, ry] of [[0, 9.1, 0], [0, -9.1, Math.PI], [9.1, 0, Math.PI / 2], [-9.1, 0, -Math.PI / 2]]) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.6), cocoaSign); s.position.set(x, 55, z); s.rotation.y = ry; g.add(s);
    }
  });
  mk('mapo', g => {
    add(g, bx(20, 6, 14), whiteMat, 0, 3, 0);
    for (const x of [-7, -2.5, 2.5, 7]) add(g, new THREE.CylinderGeometry(0.45, 0.45, 5, 10), whiteMat, x, 2.5, 7.6);
    add(g, new THREE.CylinderGeometry(5, 5, 2, 18), whiteMat, 0, 7, 0);
    add(g, new THREE.SphereGeometry(5, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x2a7fba, 0.5, 0.3), 0, 8, 0);
    add(g, new THREE.CylinderGeometry(0.15, 0.15, 4, 6), poleMat, 0, 14, 0);
  });
  mk('bower', g => {
    add(g, new THREE.ConeGeometry(13, 9, 12), hillMat, 0, 4.5, 0);
    add(g, bx(6, 22, 6), stoneMat, 0, 20, 0); add(g, bx(8, 1.4, 8), stoneMat, 0, 31.7, 0);
    for (const x of [-3.2, 3.2]) for (const z of [-3.2, 3.2]) add(g, bx(1.6, 2.4, 1.6), stoneMat, x, 33.6, z);
  });
  return L;
}
function makeTile() {
  const g = new THREE.Group(), U = { bld: [], trees: [], stalls: [] };
  const add = (geo, m, x, y, z, deco) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); if (deco) o.layers.set(1); g.add(o); return o; };
  add(interGeo, interMat, 0, 0.03, 0).receiveShadow = true;
  add(segGeo, roadMat, 0, 0, 80).receiveShadow = true;
  const sxg = new THREE.Group(); sxg.rotation.y = Math.PI / 2; sxg.position.set(80, 0, 0);
  const sx = new THREE.Mesh(segGeo, roadMat); sx.receiveShadow = true; sxg.add(sx); g.add(sxg);
  add(slabGeo, curbMat, 80, 0.1, 80).receiveShadow = true;
  for (let q = 0; q < 4; q++) {
    const m = new THREE.MeshStandardMaterial({ map: winTexes[0].clone(), roughness: 0.8 }); m.map.needsUpdate = true;
    const b = new THREE.Mesh(bGeo, [m, m, roofMat, roofMat, m, m]); b.castShadow = true; b.receiveShadow = true; g.add(b);
    const awnMat = mat(0xc0392b, 0.9);
    U.bld.push({ b, m, awnMat, par: add(bGeo, roofMat, 0, 0, 0, true), ac: add(bGeo, acMat, 0, 0, 0, true),
      awn: add(bGeo, awnMat, 0, 0, 0, true), sign: add(signGeo, signMats[0], 0, 0, 0, true) });
  }
  for (let i = 0; i < 6; i++) { const t = makeTree(); g.add(t); U.trees.push(t); }
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Group(), um = mat(0xc0392b, 0.8);
    const t1 = new THREE.Mesh(tableGeo, trunkMat); t1.position.y = 0.4; const t2 = new THREE.Mesh(umbGeo, um); t2.position.y = 2.1;
    s.add(t1, t2); layerAll(s); g.add(s); U.stalls.push({ s, um });
  }
  for (const [x, z] of [[9, 40], [9, 120], [40, 9], [120, 9]]) { add(poleGeo, poleMat, x, 3.7, z, true); add(lampGeo, lampMat, x, 7.1, z, true); }
  for (const [x, z, ry, lm] of [[9.5, 9.5, 0, lampZ], [-9.5, -9.5, Math.PI, lampZ], [9.5, -9.5, Math.PI / 2, lampX], [-9.5, 9.5, -Math.PI / 2, lampX]]) {
    const h = new THREE.Group(); h.position.set(x, 0.2, z); h.rotation.y = ry;
    const p = new THREE.Mesh(sigPoleGeo, poleMat); p.position.y = 3;
    const hb = new THREE.Mesh(headBoxGeo, darkMat); hb.position.y = 5.5;
    const d = new THREE.Mesh(dotGeo, lm); d.position.set(0, 5.5, 0.25);
    h.add(p, hb, d); layerAll(h); g.add(h);
  }
  U.lm = makeLandmarks(); Object.values(U.lm).forEach(o => g.add(o));
  g.userData = U; scene.add(g); return g;
}
function assignTile(t, ci, cj) {
  const U = t.userData, st = distAtTile(ci, cj), hs = hash(ci, cj), R = rng(hs), rr = (a, b) => a + R() * (b - a);
  U.ci = ci; U.cj = cj; U.key = ci + ',' + cj; t.position.set(ci * B, 0, cj * B);
  U.sites = { fuel: (ci === 0 && cj === 0) || hs % 9 === 3, gar: (ci === 1 && cj === 0) || hs % 23 === 7, cp: hs % 7 === 5 && !(ci === 0 && cj === 0) };
  if (U.sites.gar) U.sites.fuel = false;
  const busy = U.sites.fuel || U.sites.gar;
  const lmOn = st.lm && ((ci === 0 && cj === 0) || hs % 3 === 0), lmType = lmOn ? (Array.isArray(st.lm) ? st.lm[hs % st.lm.length] : st.lm) : null;
  for (const k in U.lm) U.lm[k].visible = k === lmType;
  U.bld.forEach((o, q) => {
    const east = q & 1, south = q >> 1, w = rr(36, 52), d = rr(36, 52), h = rr(st.h[0], st.h[1]);
    const cx = east ? 146 - w / 2 : 14 + w / 2, cz = south ? 146 - d / 2 : 14 + d / 2;
    o.b.scale.set(w, h, d); o.b.position.set(cx, h / 2 + 0.2, cz);
    o.b.material[2] = st.rust ? rustMat : roofMat;
    o.m.color.setHex(st.tint); o.m.map.image = winTexes[st.walls[Math.floor(R() * st.walls.length)]].image;
    o.m.map.needsUpdate = true; o.m.map.repeat.set(Math.max(w, d) / 12, h / 12);
    o.par.scale.set(w + 0.5, 0.9, d + 0.5); o.par.position.set(cx, h + 0.65, cz); o.par.material = st.rust ? rustMat : roofMat;
    o.ac.scale.set(rr(2, 4), 1.4, rr(2, 4)); o.ac.position.set(cx + rr(-w / 4, w / 4), h + 1.6, cz + rr(-d / 4, d / 4));
    const sg = east ? 1 : -1, fx = east ? cx + w / 2 : cx - w / 2;
    o.awnMat.color.setHex(AWN[Math.floor(R() * AWN.length)]); o.awn.scale.set(1.8, 0.15, 5); o.awn.position.set(fx + sg * 0.9, 3.5, cz);
    o.sign.material = signMats[Math.floor(R() * signMats.length)]; o.sign.position.set(fx + sg * 0.05, 4.6, cz); o.sign.rotation.y = sg * Math.PI / 2;
  });
  U.trees.forEach((tr, n) => {
    const street = n < 3, x = street ? (R() < 0.5 ? rr(9.5, 12) : 160 - rr(9.5, 12)) : 80 + rr(-20, 20), z = street ? rr(14, 146) : 80 + rr(-14, 14);
    tr.visible = !(busy && Math.abs(z - 80) < 14 && (x < 26 || x > 134)) && !(lmType && !street);
    tr.position.set(x, 0.2, z); tr.scale.setScalar(rr(0.8, 1.3));
    const [trunk, lf] = tr.children;
    if (st.palm) { trunk.scale.y = 2; trunk.position.y = 2.2; lf.position.y = 4.9; lf.scale.set(1.5, 0.4, 1.5); }
    else { trunk.scale.y = 1; trunk.position.y = 1.1; lf.position.y = 3.6; lf.scale.set(1, 1.2, 1); }
  });
  U.stalls.forEach((o, i) => {
    const onZ = i < 2, along = rr(24, 136);
    o.s.position.set(onZ ? 10.5 : along, 0.25, onZ ? along : 10.5);
    o.s.visible = R() < st.stallP && !(busy && onZ && Math.abs(along - 80) < 16);
    o.um.color.setHex(AWN[Math.floor(R() * AWN.length)]);
  });
}
const TR = 2, tiles = [];
for (let i = 0; i < (2 * TR + 1) ** 2; i++) tiles.push(makeTile());
function updateTiles() {
  const ci0 = Math.floor(car.position.x / B), cj0 = Math.floor(car.position.z / B), need = new Map();
  for (let i = -TR; i <= TR; i++) for (let j = -TR; j <= TR; j++) need.set((ci0 + i) + ',' + (cj0 + j), [ci0 + i, cj0 + j]);
  const free = [];
  for (const t of tiles) { const k = t.userData.key; if (k && need.has(k)) need.delete(k); else free.push(t); }
  for (const [, [ci, cj]] of need) assignTile(free.pop(), ci, cj);
}
const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), GROUND.dirt);
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

/* ---------- traffic lights ---------- */
function lightFor(axis) {
  const T = state.time % 30, s = axis === 'z' ? 0 : 15;
  if (T >= s && T < s + 12) return 'green';
  if (T >= s + 12 && T < s + 14) return 'yellow';
  return 'red';
}
const LC = { green: 0x2dff6b, yellow: 0xffcc00, red: 0xff2a2a };

/* ================= FUEL / GARAGE / CHECKPOINT (pooled) ================= */
function makeFuelStation() {
  const g = new THREE.Group(), cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
  const cx = cv.getContext('2d'), tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const M = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  M(bx(14, 0.06, 18), mat(0x4a4d52, 0.95), 15, 0.03, 0).castShadow = false;
  M(bx(8, 0.35, 14), mat(0xf2f2f2, 0.5), 11, 5.5, 0); M(bx(8.1, 0.2, 14.1), mat(0x1f8a4c, 0.5), 11, 5.25, 0);
  for (const [x, z] of [[7.5, -6], [7.5, 6], [14.5, -6], [14.5, 6]]) M(new THREE.CylinderGeometry(0.2, 0.2, 5.5, 8), poleMat, x, 2.75, z);
  for (const z of [-3, 3]) { M(bx(0.6, 1.6, 0.5), mat(0xd7192d, 0.4), 9.6, 1.05, z); M(bx(0.05, 0.3, 0.3), lampMat, 9.28, 1.5, z); }
  M(bx(8, 4, 6), mat(0xe9e2d0, 0.8), 19, 2, 0);
  const ss = new THREE.Mesh(signGeo, textSign('FUEL · SHOP', '#14532d', '#ffd23f')); ss.position.set(14.9, 3.3, 0); ss.rotation.y = -Math.PI / 2; g.add(ss);
  M(new THREE.CylinderGeometry(0.1, 0.1, 6, 8), poleMat, 8.6, 3, 11);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.5), new THREE.MeshBasicMaterial({ map: tex })); board.position.set(8.6, 5.6, 11.1); g.add(board);
  g.userData.draw = (name, price) => {
    cx.fillStyle = '#14532d'; cx.fillRect(0, 0, 256, 128); cx.textAlign = 'center';
    cx.fillStyle = '#ffd23f'; cx.font = 'bold 34px Arial'; cx.fillText(name, 128, 42);
    cx.fillStyle = '#fff'; cx.font = 'bold 44px Arial'; cx.fillText('₦' + price + '/L', 128, 100); tex.needsUpdate = true;
  };
  g.visible = false; scene.add(g); return g;
}
function makeGarage() {
  const g = new THREE.Group();
  const M = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  M(bx(14, 0.06, 18), mat(0x4a4d52, 0.95), 15, 0.03, 0).castShadow = false;
  M(bx(10, 6, 12), mat(0xcfd3d8, 0.8), 19, 3, 0);
  for (const z of [-4, 0, 4]) M(bx(0.2, 3.2, 3), mat(0x8e949c, 0.5, 0.4), 13.95, 1.6, z);
  const gs = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.4), textSign('AUTO GARAGE', '#1f4e8c', '#fff', 384, 96));
  gs.position.set(13.9, 5.2, 0); gs.rotation.y = -Math.PI / 2; g.add(gs);
  for (let i = 0; i < 4; i++) M(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 14), tireMat, 12.5, 0.15 + i * 0.3, -7);
  g.visible = false; scene.add(g); return g;
}
function makeCheckpoint() {
  const g = new THREE.Group(), piv = new THREE.Group(); piv.position.set(0, 1.1, 0);
  const arm = new THREE.Mesh(bx(8, 0.15, 0.15), mat(0xd7192d, 0.5)); arm.position.x = 4; piv.add(arm); g.add(piv);
  for (const [x, z] of [[1, -3], [3.5, -3], [1, 3], [3.5, 3]]) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.6, 8), mat(0xff6a00, 0.6)); c.position.set(x, 0.3, z); g.add(c); }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.8), textSign('POLICE CHECKPOINT', '#14325a', '#fff', 384, 96)); sign.position.set(9.3, 2.4, 9); g.add(sign);
  const hut = new THREE.Mesh(bx(2, 2.4, 2), mat(0x8a8f96, 0.8)); hut.position.set(11, 1.45, -2); g.add(hut);
  for (const [x, z, ry] of [[9.2, -0.8, Math.PI / 2], [-0.5, -1.5, -Math.PI / 2]]) {
    const o = makePerson('M'); o.userData.cloth.color.setHex(0x1b3a6b); o.userData.pant.color.setHex(0x111111);
    o.position.set(x, 0.2, z); o.rotation.y = ry; g.add(o);
  }
  const veh = makeVehicle('police', 0x15171a); veh.position.set(-4.2, 0, 5); g.add(veh);
  g.userData = { piv, veh, open: 0, cleared: false, warned: false, prevDz: -1 }; g.visible = false; scene.add(g); return g;
}
const fuelPool = [makeFuelStation(), makeFuelStation()], garPool = [makeGarage()], cpPool = [makeCheckpoint(), makeCheckpoint()];
function assignSites() {
  const P = car.position, L = { fuel: [], gar: [], cp: [] };
  for (const t of tiles) {
    const U = t.userData; if (!U.key) continue;
    for (const k in L) if (U.sites[k]) { const x = U.ci * B, z = U.cj * B + (k === 'cp' ? 45 : 80); L[k].push({ x, z, hs: hash(U.ci, U.cj), d: Math.hypot(x - P.x, z - P.z) }); }
  }
  const pools = { fuel: fuelPool, gar: garPool, cp: cpPool };
  for (const k in L) {
    L[k].sort((a, b) => a.d - b.d);
    pools[k].forEach((g, i) => {
      const s = L[k][i]; g.visible = !!s && s.d < 420; if (!g.visible) return;
      g.position.set(s.x, 0, s.z); const u = g.userData;
      if (u.hs !== s.hs) {
        u.hs = s.hs;
        if (k === 'fuel') { u.site = { price: 850 + s.hs % 180, name: SITE_NAMES[s.hs % SITE_NAMES.length] }; u.draw(u.site.name, u.site.price); }
        if (k === 'cp') { u.cleared = false; u.warned = false; u.prevDz = -1; }
      }
    });
  }
}

/* ================= PLAYER ================= */
const car = new THREE.Group();
car.position.set(6, 0, 120);
scene.add(car);
let body, cfg, dim = { w: 1.9, l: 4.3 };
const dash = new THREE.Group(), wheelG = new THREE.Group(), wheelSpin = new THREE.Group();
const dashBox = new THREE.Mesh(bx(1.5, 0.15, 0.35), darkMat);
wheelSpin.add(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 8, 20), darkMat));
wheelG.rotation.x = -0.9; wheelG.add(wheelSpin); dash.add(dashBox, wheelG); dash.visible = false; layerAll(dash); dash.userData.keep = true;
const spots = [-1, 1].map(s => {
  const sp = new THREE.SpotLight(0xfff3d0, 0, 70, 0.5, 0.6, 1.5);
  sp.position.set(s * 0.6, 0.9, -2); sp.target.position.set(s * 0.6, 0.3, -25); car.add(sp, sp.target); return sp;
});
const mapMarker = new THREE.Mesh(new THREE.ConeGeometry(5, 14, 3).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x35e0ff, depthTest: false }));
mapMarker.layers.set(2); mapMarker.renderOrder = 999; scene.add(mapMarker);
function setCar(id, color) {
  if (body) car.remove(body);
  S.car = id; S.color = color; cfg = CARS[id];
  body = makeVehicle(cfg.type, color); car.add(body); body.add(dash); skinVehicle(body, cfg.type, true);
  dim = { w: body.userData.w, l: body.userData.l };
  const ty = body.userData.topY;
  dashBox.position.set(0, ty - 0.45, -dim.l * 0.12); wheelG.position.set(-0.4, ty - 0.3, -dim.l * 0.07);
  S.fuel = Math.min(S.fuel, cfg.tank); persist();
}
setCar(S.car, S.color);

/* ================= TRAFFIC (grid) ================= */
const traffic = [];
const COLORS = [0x2f5fa8, 0xeeeeee, 0x222222, 0x8c8f94, 0x2e8b57, 0x7a2a8a, 0xb5651d];
const TYPES = ['taxi', 'taxi', 'taxi', 'sedan', 'hatch', 'hatch', 'suv', 'pickup', 'minibus', 'minibus', 'bus', 'keke', 'keke', 'okada', 'okada', 'okada', 'truck', 'police'];
function placeTraffic(t) {
  const axis = Math.random() < 0.5 ? 'z' : 'x', dir = Math.random() < 0.5 ? 1 : -1;
  const off = (Math.random() < 0.5 ? 2 : 6) * dir * (axis === 'z' ? -1 : 1);
  const P = car.position, line = Math.round((axis === 'z' ? P.x : P.z) / B) + irand(-1, 1), c = line * B + off;
  const along = axis === 'z' ? P.z : P.x; let s = along + 150;
  for (let n = 0; n < 14; n++) {
    s = along + rand(-300, 300);
    if (Math.abs(s - along) < 70 || Math.abs(s - Math.round(s / B) * B) < 14) continue;
    if (!traffic.some(o => o !== t && o.axis === axis && o.c === c && Math.abs(o.s - s) < (o.l + t.l) / 2 + 20)) break;
  }
  Object.assign(t, { axis, dir, c, s, base: t.kind === 'okada' ? rand(12, 24) : rand(9, 22), hdg: axis === 'z' ? (dir < 0 ? 0 : Math.PI) : (dir > 0 ? -Math.PI / 2 : Math.PI / 2) });
  t.speed = t.base; t.honkT = rand(3, 14); t.mesh.rotation.y = t.hdg;
  t.mesh.position.set(axis === 'z' ? c : s, 0, axis === 'z' ? s : c);
}
for (let i = 0; i < 26; i++) {
  const type = pick(TYPES);
  const col = ['taxi', 'minibus', 'bus', 'keke'].includes(type) ? 0xf5c518 : type === 'police' ? 0x15171a : pick(COLORS);
  const mesh = makeVehicle(type, col); skinVehicle(mesh, type, false);
  scene.add(mesh); const t = { mesh, kind: type, w: mesh.userData.w, l: mesh.userData.l }; traffic.push(t); placeTraffic(t);
}
const circ = (x, z, h, l, w) => {
  const n = l > 6 ? 3 : 2, r = w / 2 + 0.1, fx = -Math.sin(h), fz = -Math.cos(h), out = [];
  for (let i = 0; i < n; i++) { const o = (i / (n - 1) - 0.5) * (l - w); out.push([x + fx * o, z + fz * o, r]); }
  return out;
};
const onRoad = (x, z) => Math.abs(x - Math.round(x / B) * B) < 7.4 || Math.abs(z - Math.round(z / B) * B) < 7.4;

/* ================= STATE ================= */
const state = {
  speed: 0, steer: 0, sL: false, sR: false, throttle: false, braking: false, nitroKey: false, horn: false, nitro: 1,
  thr: 0, heading: 0, crashes: 0, cooldown: 0, lightCd: 0, shake: 0, time: 0, tod: 8, st: '', lowFuel: false, dead: false
};
const clock = new THREE.Clock();
let hazard = false, wxKey = 'clear', wxTimer = rand(70, 110), bolt = 8, flashV = 0, camIdx = 0, hudT = 0, navT = 0, siteT = 0, ringT = 0, mapBig = false, voiceOn = true, lastBlink = false;
const wx = { ...WX.clear };

/* ================= HUD ================= */
const hud = document.createElement('div');
hud.id = 'hud';
hud.innerHTML = `
  <div class="flash" id="flash"></div>
  <div class="brand">SL<span>-TAXI</span> <small>IBADAN · OYO STATE</small></div>
  <div class="stats">
    <div id="wallet" class="wallet"></div>
    <div class="fuelbar"><i id="fuelFill"></i><span id="fuelTxt"></span></div>
    <div id="loc"></div><div id="wxt"></div><div id="stat"></div>
  </div>
  <div id="mapbox"><span>3D MAP · tap to enlarge</span></div>
  <div id="nav"><b id="navArrow">⬆</b><div><b id="navDist"></b><div id="navTxt"></div></div></div>
  <div class="speed-panel gauge-panel"><canvas id="gauge" width="300" height="300"></canvas><div class="nitro-bar"><i id="nitroFill"></i></div></div>
  <button class="cam-btn" id="camBtn">CAM · CHASE</button>
  <div class="toast" id="toast"></div>
  <div id="phone" class="mini"><div class="p-body">
    <div class="p-notch"></div>
    <div id="pHead"><div class="p-status"><span id="pTime">08:00</span><span>4G ▂▄▆ 🔋</span></div>
      <div class="p-title"><b>SL-Taxi Driver</b><span id="pMini"></span></div></div>
    <div id="pApp"></div>
  </div></div>
  <div id="panel"></div>
  <div class="controls">
    <div class="arrows"><button class="arrow" id="steerL" aria-label="Steer left">◀</button><button class="arrow" id="steerR" aria-label="Steer right">▶</button></div>
    <div class="pedals">
      <div class="side"><button class="pedal small nitro" id="nitroBtn">⚡</button><button class="pedal small hornb" id="hornBtn">📢</button></div>
      <button class="pedal brake" id="brake">BRAKE<br>REV</button>
      <button class="pedal accel" id="accel">ACCEL<br>▲</button>
    </div>
  </div>`;
document.body.appendChild(hud);
function toast(msg, ms = 3500) {
  const t = $('toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), ms);
}
function say(t) {
  if (!voiceOn || !window.speechSynthesis) return;
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang = 'en-NG'; speechSynthesis.speak(u); } catch {}
}
function spend(n) {
  if (S.ngn >= n) { S.ngn -= n; return true; }
  const need = n - S.ngn, usd = Math.ceil(need / RATE * 100) / 100;
  if (S.usd >= usd) { S.usd -= usd; S.ngn = usd * RATE - need; return true; }
  return false;
}
function penalty(n, msg) {
  const ok = spend(n); if (!ok) S.stars = Math.max(1, S.stars - 0.3);
  toast(msg + (ok ? '' : ' (unpaid · rating dropped)'), 3500); persist();
}

/* ---------- panels (fuel / garage / police / rescue) ---------- */
let panelType = null, pmsg = '', fuelSite = null;
const cp = { pending: false, u: null, bribe: 0, dwell: 0 };
function renderPanel() {
  const p = $('panel');
  if (!panelType) { p.classList.remove('on'); return; }
  p.classList.add('on');
  const bal = `<div class="bal">${fmtN(S.ngn)} · ${fmtD(S.usd)}</div>`;
  if (panelType === 'fuel') {
    const pr = fuelSite.price, room = cfg.tank - S.fuel;
    p.innerHTML = `<h3>⛽ ${fuelSite.name}</h3>${bal}<p>${fmtN(pr)}/L · Tank ${S.fuel.toFixed(1)}/${cfg.tank} L</p>
      <div class="row"><button data-a="fuel" data-v="5">+5 L<br>${fmtN(5 * pr)}</button><button data-a="fuel" data-v="10">+10 L<br>${fmtN(10 * pr)}</button>
      <button data-a="fuel" data-v="99">FILL<br>${fmtN(room * pr)}</button></div><p class="msg">${pmsg}</p>`;
  } else if (panelType === 'rescue') {
    p.innerHTML = `<h3>🚨 Out of fuel</h3>${bal}<p>Call roadside assistance for 5 L of fuel.</p><div class="row"><button data-a="rescue">CALL · ${fmtN(3000)}</button></div><p class="msg">${pmsg}</p>`;
  } else if (panelType === 'police') {
    p.innerHTML = `<h3>🚓 Police Checkpoint</h3>${bal}<p>"Oga, you no get something for the boys? ${fmtN(cp.bribe)} for water."</p>
      <div class="row"><button data-a="pay">PAY ${fmtN(cp.bribe)}</button><button data-a="refuse">REFUSE</button></div><p class="msg">${pmsg}</p>`;
  } else {
    const list = Object.entries(CARS).map(([id, c]) => `<div class="item"><div><b>${c.name}</b><small>${Math.round(c.maxV * 3.6)} km/h · ${c.tank} L · fare ×${c.fare}</small></div>` +
      (S.car === id ? '<em>IN USE</em>' : S.owned[id] ? `<button data-a="sel" data-v="${id}">SELECT</button>` : `<button data-a="buy" data-v="${id}">${fmtN(c.price)}</button>`) + '</div>').join('');
    const paints = PAINTS.map(([n, c], i) => `<button class="sw" title="${n}" data-a="paint" data-v="${i}" style="background:#${c.toString(16).padStart(6, '0')}"></button>`).join('');
    p.innerHTML = `<h3>🔧 Auto Garage</h3>${bal}${list}<p>Respray ${fmtN(2500)}</p><div class="row">${paints}</div>
      <div class="row"><button data-a="repair">REPAIR ${fmtN(S.damage * 400)}</button><button data-a="convert">$ → ₦ (${RATE}/$)</button></div><p class="msg">${pmsg}</p>`;
  }
}
function showPanel(t) { panelType = t; pmsg = ''; renderPanel(); }
$('panel').addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const a = b.dataset.a, v = b.dataset.v;
  if (a === 'fuel') {
    const l = Math.min(+v, cfg.tank - S.fuel);
    if (l <= 0.01) pmsg = 'Tank is full'; else if (spend(l * fuelSite.price)) { S.fuel += l; pmsg = `Bought ${l.toFixed(1)} L`; } else pmsg = 'Not enough money';
  } else if (a === 'rescue') { if (spend(3000)) { S.fuel += 5; panelType = null; } else pmsg = 'Not enough money'; }
  else if (a === 'buy') { if (spend(CARS[v].price)) { S.owned[v] = 1; setCar(v, S.color); pmsg = 'Purchased!'; } else pmsg = 'Not enough money'; }
  else if (a === 'sel') { setCar(v, S.color); pmsg = 'Car changed'; }
  else if (a === 'paint') { const c = PAINTS[v][1]; if (c === S.color) pmsg = 'Already this colour'; else if (spend(2500)) { setCar(S.car, c); pmsg = 'Fresh paint!'; } else pmsg = 'Not enough money'; }
  else if (a === 'repair') { const cost = S.damage * 400; if (cost < 1) pmsg = 'No damage'; else if (spend(cost)) { S.damage = 0; pmsg = 'Fully repaired'; } else pmsg = 'Not enough money'; }
  else if (a === 'convert') { if (S.usd > 0) { S.ngn += S.usd * RATE; pmsg = `Converted ${fmtD(S.usd)}`; S.usd = 0; } else pmsg = 'No dollars to convert'; }
  else if (a === 'pay') { if (spend(cp.bribe)) { cp.u.cleared = true; cp.pending = false; panelType = null; toast('👮 "Thank you, oga. Safe journey."'); } else pmsg = 'Not enough money'; }
  else if (a === 'refuse') {
    cp.pending = false; panelType = null;
    if (Math.random() < 0.5) { cp.u.cleared = true; toast('👮 "Okay, go. Next time no dull me."'); } else { cp.u.cleared = true; penalty(3000, '👮 Officer fined you ₦3,000'); }
  }
  persist(); renderPanel();
});

/* ================= DRIVER PHONE (booking app) ================= */
const NM = ['Chidi', 'Tunde', 'Emeka', 'Ibrahim', 'Segun', 'Ola', 'Musa', 'Kelechi', 'Femi', 'Dapo'];
const NF = ['Amina', 'Ngozi', 'Bisi', 'Funke', 'Zainab', 'Chioma', 'Adaeze', 'Yetunde', 'Folake', 'Titi'];
const PAX_MSGS = ['I dey wait for you for roadside o.', 'I wear red cloth, I dey near the kiosk.', 'Oga abeg make you hurry small.', 'Good afternoon, I don see your car.', 'Please no honk, I dey come.'];
const ride = { phase: 'none', timer: 3, dwell: 0 };
const nav = { target: null };
const phone = { tab: 'home', full: false, online: true, summary: null, msg: '' };
const pEl = $('phone'), pApp = $('pApp');
const placeName = (x, z) => `${distAt(x, z).name} · ${roadName('z', Math.round((x - 7) / B), distAt(x, z))}`;
const beacon = new THREE.Group();
const bm = new THREE.MeshBasicMaterial({ color: 0x35e07a, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending });
const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 16, 20, 1, true), bm); beam.position.y = 8;
const ring = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.8, 24).rotateX(-Math.PI / 2), bm); ring.position.y = 0.05;
beacon.add(beam, ring); beacon.visible = false; scene.add(beacon);
const routeGeo = new THREE.PlaneGeometry(4, 1).rotateX(-Math.PI / 2);
const routeMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
const routeSegs = Array.from({ length: 12 }, () => { const m = new THREE.Mesh(routeGeo, routeMat); m.visible = false; scene.add(m); return m; });

function setPhoneFull(v) { phone.full = v; pEl.classList.toggle('full', v); }
function updatePhoneHead(dText) {
  let t;
  if (!phone.online) t = '⚫ Offline';
  else if (phone.summary) t = '✅ Trip completed';
  else if (ride.phase === 'offer') t = '🔔 New booking! Tap ACCEPT';
  else if (ride.phase === 'pickup') t = `📍 Pickup · ${dText || ''}`;
  else if (ride.phase === 'trip') t = `🏁 Drop-off · ${dText || ''}`;
  else t = '🟢 Online · finding riders';
  $('pMini').textContent = t;
}
function renderPhone() {
  const r = ride, pr = r.foreign ? fmtD(r.usd) : fmtN(r.fare), av = r.name ? r.name[0] : '?';
  pEl.classList.toggle('ring', r.phase === 'offer');
  let h = '';
  if (phone.summary) {
    const s = phone.summary;
    h = `<div class="pcard"><h4>✅ Trip completed</h4><div class="big">${s.amt}</div><div class="stars">${s.stars}</div><small>${s.line}</small></div>`;
  } else if (r.phase === 'offer') {
    h = `<div class="pcard"><h4>New booking</h4>
      <div class="who"><i>${av}</i><div><b>${r.name} ${r.g === 'M' ? '♂' : '♀'}</b><small>★ ${r.rating} · ${r.foreign ? 'pays in USD' : 'pays cash / transfer'}</small></div></div>
      <div class="rt"><span class="dot a"></span>${placeName(r.px, r.pz)}</div><div class="rt"><span class="dot b"></span>${placeName(r.tx, r.tz)}</div>
      <div class="meta">${(r.dist / 1000).toFixed(1)} km<b class="fare">${pr}</b>${r.surge > 1 ? '<em>⚡ rain surge</em>' : ''}</div>
      <div class="cd"><i id="pCount"></i></div>
      <div class="prow"><button data-p="decline" class="no">DECLINE</button><button data-p="accept" class="yes">ACCEPT</button></div></div>`;
  } else if (r.phase === 'pickup' || r.phase === 'trip') {
    const to = r.phase === 'pickup' ? placeName(r.px, r.pz) : placeName(r.tx, r.tz);
    h = `<div class="pcard"><h4>${r.phase === 'pickup' ? 'Go to pickup' : 'Trip in progress'}</h4>
      <div class="who"><i>${av}</i><div><b>${r.name}</b><small>${to}</small></div></div>
      <div class="navrow"><b id="pTurn">⬆</b><div><b id="pDist">…</b><div id="pTurnTxt"></div></div></div>
      ${r.phase === 'pickup' ? `<div class="chat">💬 “${phone.msg}”</div>` : ''}
      <div class="meta">Fare<b class="fare">${pr}</b></div>
      <div class="prow"><button data-p="cancel" class="no">CANCEL RIDE</button></div></div>`;
  } else {
    const today = S.history.reduce((a, x) => a + (x.cur === 'NGN' ? x.amt : x.amt * RATE), 0);
    const tabs = `<div class="ptabs">${['home', 'trips', 'wallet'].map(t => `<button data-p="tab" data-t="${t}" class="${phone.tab === t ? 'on' : ''}">${t.toUpperCase()}</button>`).join('')}</div>`;
    let c;
    if (phone.tab === 'trips') c = `<div class="pcard"><h4>Recent trips</h4>${S.history.slice(-5).reverse().map(x => `<div class="trip"><span>${x.name} · ${x.to}</span><b>${x.cur === 'NGN' ? fmtN(x.amt) : fmtD(x.amt)}</b></div>`).join('') || '<small>No trips yet</small>'}</div>`;
    else if (phone.tab === 'wallet') c = `<div class="pcard"><h4>Wallet</h4><div class="big">${fmtN(S.ngn)}</div><div>${fmtD(S.usd)} <small>(₦${RATE}/$)</small></div><small>Earned from ${S.history.length} recent trips: ${fmtN(today)}</small></div>`;
    else c = `<div class="pcard center"><div class="status ${phone.online ? 'on' : 'off'}">${phone.online ? '● You are ONLINE' : '○ You are OFFLINE'}</div>
      ${phone.online ? '<div class="radar"></div>' : ''}<small>${phone.online ? 'Looking for bookings in ' + distAt(car.position.x, car.position.z).name : 'Go online to receive bookings'}</small>
      <div class="prow"><button data-p="online" class="${phone.online ? 'no' : 'yes'}">${phone.online ? 'GO OFFLINE' : 'GO ONLINE'}</button></div></div>${tabs}`;
    h = c + (phone.tab !== 'home' ? tabs : '');
  }
  pApp.innerHTML = h; updatePhoneHead();
}
pEl.addEventListener('click', e => {
  const b = e.target.closest('[data-p]');
  if (!b) { setPhoneFull(!phone.full); return; }
  const a = b.dataset.p;
  if (a === 'accept') acceptRide();
  else if (a === 'decline') declineRide();
  else if (a === 'cancel') { S.stars = Math.max(1, S.stars - 0.15); toast('Ride cancelled'); endRide(); setPhoneFull(false); }
  else if (a === 'online') { phone.online = !phone.online; ride.timer = rand(3, 6); renderPhone(); }
  else if (a === 'tab') { phone.tab = b.dataset.t; renderPhone(); }
});
function ringPhone() {
  navigator.vibrate?.([180, 90, 180]);
  if (!audio) return;
  const { ac, out } = audio, t = ac.currentTime;
  [[880, 0], [1175, 0.16], [880, 0.5], [1175, 0.66]].forEach(([f, d]) => {
    const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(0.18, t + d + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.2);
    o.connect(g); g.connect(out); o.start(t + d); o.stop(t + d + 0.25);
  });
}
const zName = (x, z) => roadName('z', Math.round((x - 7) / B), distAt(x, z));
function pickPoint(minD, maxD, from) {
  for (let n = 0; n < 40; n++) {
    const a = Math.round((from.x - 7) / B) + irand(-4, 4), b = Math.floor(from.z / B) + irand(-4, 4);
    const x = a * B + 7, z = b * B + B / 2, d = Math.abs(x - from.x) + Math.abs(z - from.z);
    if (d >= minD && d <= maxD) return { x, z };
  }
  return { x: from.x + 7 + B * 2, z: from.z + B / 2 };
}
function newOffer() {
  const foreign = Math.random() < 0.1, g = Math.random() < 0.5 ? 'M' : 'F';
  const name = foreign ? pick(g === 'M' ? ['Mr. James', 'Mr. David'] : ['Ms. Sarah', 'Ms. Emma']) : pick(g === 'M' ? NM : NF);
  const pu = pickPoint(250, 700, car.position), dr = pickPoint(500, 1500, pu);
  const dist = Math.abs(dr.x - pu.x) + Math.abs(dr.z - pu.z), surge = wx.rain > 0.3 ? 1.25 : 1;
  const fare = Math.round((1500 + dist / 1000 * 1100) * cfg.fare * surge / 50) * 50;
  Object.assign(ride, { phase: 'offer', name, g, foreign, px: pu.x, pz: pu.z, tx: dr.x, tz: dr.z, dist, fare, surge, expire: 15, dwell: 0,
    rating: (4.2 + Math.random() * 0.8).toFixed(1), usd: foreign ? Math.round(fare / RATE * 2 * 100) / 100 : 0 });
  setPhoneFull(true); ringT = 0; renderPhone();
}
function declineRide() { ride.phase = 'none'; ride.timer = rand(5, 10); setPhoneFull(false); renderPhone(); }
function acceptRide() {
  phone.msg = pick(PAX_MSGS); startPickup(); setPhoneFull(false);
}
function endRide() { ride.phase = 'none'; ride.timer = 5; beacon.visible = false; waiter.visible = false; nav.target = null; renderPhone(); }
function startPickup() {
  ride.phase = 'pickup'; dressPerson(waiter, ride.foreign); waiter.visible = true;
  waiter.position.set(ride.px + 2.7, 0.2, ride.pz); waiter.rotation.y = Math.PI / 2;
  bm.color.setHex(0x35e07a); beacon.position.set(ride.px, 0, ride.pz); beacon.visible = true; nav.target = { x: ride.px, z: ride.pz }; renderPhone();
}
function startTrip() {
  ride.phase = 'trip'; ride.t0 = state.time; ride.crash0 = state.crashes; ride.dwell = 0; waiter.visible = false;
  bm.color.setHex(0xff4d5e); beacon.position.set(ride.tx, 0, ride.tz); nav.target = { x: ride.tx, z: ride.tz };
  toast(`${ride.name}: "Please take me to ${zName(ride.tx, ride.tz)}, ${distAt(ride.tx, ride.tz).name}."`, 4500); renderPhone();
}
function finishRide() {
  const crashes = state.crashes - ride.crash0, secs = state.time - ride.t0, ideal = ride.dist / 18;
  const stars = clamp(Math.round((5 - crashes * 1.2 - (secs > ideal * 1.6 ? 1 : 0)) * 2) / 2, 1, 5);
  const tip = stars >= 4.5 ? 0.2 : stars >= 3.5 ? 0.08 : 0, amt = ride.foreign ? ride.usd : ride.fare, total = amt * (1 + tip);
  if (ride.foreign) S.usd += total; else S.ngn += total;
  S.rides++; S.stars = S.stars * 0.8 + stars * 0.2;
  S.history.push({ name: ride.name, to: distAt(ride.tx, ride.tz).name, amt: Math.round(total * 100) / 100, cur: ride.foreign ? 'USD' : 'NGN' });
  if (S.history.length > 12) S.history.shift();
  const txt = ride.foreign ? fmtD(total) : fmtN(total);
  toast(`${pick(['Thank you o!', 'God bless you!', 'Nice driving!', 'E se gan!'])} +${txt}`, 3500);
  persist(); endRide();
  phone.summary = { amt: '+' + txt, stars: '★'.repeat(Math.floor(stars)) + (stars % 1 ? '½' : ''), line: tip ? `Tip included (${Math.round(tip * 100)}%)` : 'No tip this time' };
  setPhoneFull(true); renderPhone();
  setTimeout(() => { phone.summary = null; if (ride.phase === 'none') { setPhoneFull(false); renderPhone(); } }, 4500);
}

/* ---------- directions ---------- */
const NAV_ICON = { straight: '⬆', left: '⬅', right: '➡', uturn: '↩' };
const NAV_TXT = { straight: 'Continue straight', left: 'Turn left', right: 'Turn right', uturn: 'Make a U-turn' };
let navKey = '', navSpoken = 0;
function setNavUI(icon, dist, text) {
  $('nav').classList.add('on'); $('navArrow').textContent = icon; $('navDist').textContent = dist; $('navTxt').textContent = text;
  const a = $('pTurn'), b = $('pDist'), c = $('pTurnTxt'); if (a) { a.textContent = icon; b.textContent = dist; c.textContent = text; }
  updatePhoneHead(dist);
}
function updateNav() {
  const T = nav.target;
  if (!T) { $('nav').classList.remove('on'); routeSegs.forEach(m => m.visible = false); return; }
  const P = car.position, fx = -Math.sin(state.heading), fz = -Math.cos(state.heading);
  const alongZ = Math.abs(fz) >= Math.abs(fx), dir = Math.sign(alongZ ? fz : fx) || 1;
  let a, b;
  if (alongZ) { a = Math.round(P.x / B); b = dir > 0 ? Math.ceil((P.z + 10) / B) : Math.floor((P.z - 10) / B); }
  else { b = Math.round(P.z / B); a = dir > 0 ? Math.ceil((P.x + 10) / B) : Math.floor((P.x - 10) / B); }
  const ta = Math.round((T.x - 7) / B), tb = Math.floor(T.z / B), goals = [[ta, tb], [ta, tb + 1]];
  const dm = (n, g) => Math.abs(n[0] - g[0]) + Math.abs(n[1] - g[1]);
  const G = dm([a, b], goals[1]) < dm([a, b], goals[0]) ? goals[1] : goals[0];
  const vin = alongZ ? [0, dir] : [dir, 0]; let cur = [a, b], v = vin; const path = [cur];
  for (let i = 0; i < 9 && (cur[0] !== G[0] || cur[1] !== G[1]); i++) {
    const c4 = [v, [-v[1], v[0]], [v[1], -v[0]], [-v[0], -v[1]]]; let best = c4[0], bd = 1e9;
    c4.forEach((c, k) => { const d = dm([cur[0] + c[0], cur[1] + c[1]], G) + (k === 3 ? 0.5 : 0); if (d < bd - 1e-9) { bd = d; best = c; } });
    cur = [cur[0] + best[0], cur[1] + best[1]]; v = best; path.push(cur);
  }
  let vout;
  if (path.length > 1) vout = [path[1][0] - path[0][0], path[1][1] - path[0][1]];
  else { const dx = T.x - a * B, dz = T.z - b * B; vout = Math.abs(dz) >= Math.abs(dx) ? [0, Math.sign(dz) || 1] : [Math.sign(dx), 0]; }
  const cross = vin[0] * vout[1] - vin[1] * vout[0], dot = vin[0] * vout[0] + vin[1] * vout[1];
  let turn = dot > 0.5 ? 'straight' : dot < -0.5 ? 'uturn' : cross > 0 ? 'right' : 'left';
  let dist = alongZ ? Math.abs(b * B - P.z) : Math.abs(a * B - P.x);
  const st = distAt(a * B, b * B), nAxis = vout[0] !== 0 ? 'x' : 'z', street = roadName(nAxis, nAxis === 'x' ? b : a, st);
  let text = `${NAV_TXT[turn]} onto ${street}`;
  const ahead = alongZ && Math.round((P.x - 7) / B) === ta && Math.abs(P.x - ta * B) < 9 && (T.z - P.z) * dir > 0 && (T.z - P.z) * dir < Math.abs(b * B - P.z) + 1;
  if (ahead) { turn = 'straight'; dist = Math.abs(T.z - P.z); text = 'Destination ahead — stop at the kerb'; }
  else if (turn === 'straight') text = `Continue on ${street}`;
  setNavUI(NAV_ICON[turn], (dist < 100 ? Math.round(dist / 5) * 5 : Math.round(dist / 10) * 10) + ' m', text);
  const key = `${a},${b},${turn},${ahead}`; if (key !== navKey) { navKey = key; navSpoken = 0; }
  if (turn !== 'straight' || ahead) {
    if (dist < 300 && navSpoken < 1) { navSpoken = 1; say(ahead ? 'Your destination is ahead' : `In ${Math.round(dist / 50) * 50} metres, ${NAV_TXT[turn].toLowerCase()} onto ${street}`); }
    if (dist < 70 && navSpoken < 2 && !ahead) { navSpoken = 2; say(NAV_TXT[turn] + ' now'); }
  }
  const pts = [alongZ ? [a * B, P.z] : [P.x, b * B]].concat(path.map(n => [n[0] * B, n[1] * B]));
  const L = path[path.length - 1]; if (L[0] === G[0] && L[1] === G[1]) pts.push([ta * B, T.z]);
  routeSegs.forEach((m, i) => {
    const p0 = pts[i], p1 = pts[i + 1];
    if (!p1 || (p0[0] !== p1[0] && p0[1] !== p1[1])) { m.visible = false; return; }
    const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]); m.visible = len > 1;
    m.position.set((p0[0] + p1[0]) / 2, 0.08, (p0[1] + p1[1]) / 2); m.rotation.y = p0[0] === p1[0] ? 0 : Math.PI / 2; m.scale.set(1, 1, len);
  });
}

/* ================= INPUT ================= */
function bindHold(id, down, up) {
  const el = $(id);
  el.addEventListener('pointerdown', e => { e.preventDefault(); el.setPointerCapture(e.pointerId); initAudio(); down(e); el.classList.add('active'); });
  for (const n of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(n, e => { e.preventDefault(); up(e); el.classList.remove('active'); });
}
bindHold('accel', () => state.throttle = true, () => state.throttle = false);
bindHold('brake', () => state.braking = true, () => state.braking = false);
bindHold('nitroBtn', () => state.nitroKey = true, () => state.nitroKey = false);
bindHold('hornBtn', () => state.horn = true, () => state.horn = false);
bindHold('steerL', () => state.sL = true, () => state.sL = false);
bindHold('steerR', () => state.sR = true, () => state.sR = false);
const CAMS = ['CHASE', 'FAR', 'HOOD', 'COCKPIT', 'BUMPER', 'SIDE', 'TOP', 'ORBIT'];
function cycleCam() { camIdx = (camIdx + 1) % CAMS.length; $('camBtn').textContent = 'CAM · ' + CAMS[camIdx]; dash.visible = camIdx === 3; }
$('camBtn').addEventListener('pointerdown', e => { e.preventDefault(); cycleCam(); });
const mapBox = $('mapbox');
function toggleMap() { mapBig = !mapBig; mapBox.classList.toggle('big', mapBig); }
mapBox.addEventListener('pointerdown', e => { e.preventDefault(); toggleMap(); });
function setWeather(k) { wxKey = k; toast(`${WX[k].i} ${WX[k].n}`, 2500); }
const keys = new Set();
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  keys.add(k); initAudio();
  if (k === 'z') hazard = !hazard;
  if (k === 'c') cycleCam();
  if (k === 'm') toggleMap();
  if (k === 'p') setPhoneFull(!phone.full);
  if (k === 'enter' && ride.phase === 'offer') acceptRide();
  if (k === 'x' && ride.phase === 'offer') declineRide();
  if (k === 'v') { voiceOn = !voiceOn; toast(voiceOn ? '🔊 Voice directions on' : '🔇 Voice directions off', 1500); }
  if (k === 't') setWeather(WX_KEYS[(WX_KEYS.indexOf(wxKey) + 1) % WX_KEYS.length]);
  if (k === 'r') { car.position.x = Math.round(car.position.x / B) * B + 6; state.heading = 0; state.speed = 0; }
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => { keys.clear(); state.throttle = state.braking = state.nitroKey = state.horn = state.sL = state.sR = false; });

/* ================= AUDIO ================= */
let audio = null;
function initAudio() {
  if (audio) { audio.ac.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  const ac = new AC(), out = ac.createGain(); out.gain.value = 0.9; out.connect(ac.destination);
  const osc = (type, f) => { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.start(); return o; };
  const eng = [osc('sawtooth', 60), osc('sawtooth', 60.7), osc('sine', 30)];
  const ef = ac.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 500; const eg = ac.createGain(); eg.gain.value = 0;
  eng.forEach(o => o.connect(ef)); ef.connect(eg); eg.connect(out);
  const nb = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = nb.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const noise = (type, f) => { const s = ac.createBufferSource(); s.buffer = nb; s.loop = true; const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; const g = ac.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(out); s.start(); return { f: fl, g }; };
  const wind = noise('lowpass', 900), rain = noise('bandpass', 1500), tire = noise('bandpass', 1700);
  const hg = ac.createGain(); hg.gain.value = 0; const hf = ac.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 1800;
  [osc('square', 420), osc('square', 525)].forEach(o => o.connect(hf)); hf.connect(hg); hg.connect(out);
  const sirenO = osc('triangle', 800), sg = ac.createGain(); sg.gain.value = 0; sirenO.connect(sg); sg.connect(out);
  audio = { ac, out, nb, eng, ef, eg, wind, rain, tire, hg, sirenO, sg };
}
function beep(f, dur, vol, pan) {
  const { ac, out } = audio, t = ac.currentTime, g = ac.createGain(), fl = ac.createBiquadFilter();
  fl.type = 'lowpass'; fl.frequency.value = 1800; fl.connect(g);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.setValueAtTime(vol, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.05);
  [f, f * 1.25].forEach(fr => { const o = ac.createOscillator(); o.type = 'square'; o.frequency.value = fr; o.connect(fl); o.start(t); o.stop(t + dur + 0.1); });
  if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(out); } else g.connect(out);
}
let lastHonk = 0;
function honkAt(x, z) {
  if (!audio || state.time - lastHonk < 0.35) return;
  const P = car.position, d = Math.hypot(x - P.x, z - P.z); if (d > 120) return; lastHonk = state.time;
  const pan = clamp(((x - P.x) * Math.cos(state.heading) + (z - P.z) * -Math.sin(state.heading)) / 40, -1, 1);
  const n = Math.random() < 0.4 ? 2 : 1;
  for (let i = 0; i < n; i++) setTimeout(() => beep(rand(330, 520), rand(0.15, 0.4), (1 - d / 120) * 0.22, pan), i * 260);
}
function noiseBurst(freq, dur, vol) {
  if (!audio) return; const { ac, nb, out } = audio, t = ac.currentTime, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = nb; f.type = 'lowpass'; f.frequency.value = freq; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t + dur + 0.1);
}
function crashSnd() {
  noiseBurst(900, 0.5, 0.7);
  if (audio) { const { ac, out } = audio, t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 80; g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.4); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.5); }
}
const thunder = () => noiseBurst(180, 2.2, 0.6);
function tick() {
  if (!audio) return; const { ac, out } = audio, t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
  o.type = 'square'; o.frequency.value = 1800; g.gain.setValueAtTime(0.04, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.03); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.04);
}
const GEARS = [14, 26, 38, 50, 80];
function gearInfo(s) {
  let g = 0; while (g < GEARS.length - 1 && s > GEARS[g]) g++;
  const lo = g ? GEARS[g - 1] : 0; return { g: g + 1, rpm: clamp((s - lo) / (GEARS[g] - lo), 0, 1) };
}

/* ================= WEATHER & TIME ================= */
const RN = 1400, rp = new Float32Array(RN * 3);
for (let i = 0; i < RN; i++) { rp[i * 3] = rand(-16, 16); rp[i * 3 + 1] = rand(0, 18); rp[i * 3 + 2] = rand(-30, 6); }
const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rp, 3));
const rainPts = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0xbfd8ff, size: 0.09, transparent: true, opacity: 0.6, depthWrite: false }));
rainPts.frustumCulled = false; rainPts.visible = false; scene.add(rainPts);
const cNight = new THREE.Color(0x070b1a), cDay = new THREE.Color(0x7fb8e6), cDusk = new THREE.Color(0xff9a5a);
const cGrey = new THREE.Color(0x6c7480), cHaze = new THREE.Color(0xc9a46a), sky = new THREE.Color();
function updateEnv(dt) {
  state.tod = (state.tod + dt / 25) % 24;
  const tg = WX[wxKey];
  for (const k of ['near', 'far', 'light', 'rain', 'grip', 'haze']) wx[k] = damp(wx[k], tg[k], 1, dt);
  wxTimer -= dt;
  if (wxTimer <= 0) { setWeather(pick(['clear', 'clear', 'cloudy', 'rain', 'storm', 'harmattan'])); wxTimer = rand(70, 120); }
  const dayF = clamp(Math.sin((state.tod - 6) / 12 * Math.PI), 0, 1), dusk = Math.pow(1 - dayF, 3) * dayF * 6;
  sky.copy(cNight).lerp(cDay, Math.sqrt(dayF)).lerp(cDusk, clamp(dusk, 0, 0.55));
  sky.lerp(cGrey, (1 - wx.light) * 0.7 * dayF).lerp(cHaze, wx.haze * 0.7 * dayF);
  scene.background.copy(sky); scene.fog.color.copy(sky); scene.fog.near = wx.near; scene.fog.far = wx.far;
  const dark = clamp(1 - dayF * 1.3 + (1 - wx.light) * 0.5, 0, 1);
  sun.intensity = 3 * dayF * wx.light; sun.color.setHex(0xffffff).lerp(cDusk, clamp(dusk, 0, 0.5));
  hemi.intensity = 0.25 + 1.4 * dayF * (0.4 + 0.6 * wx.light) + flashV * 5;
  lampMat.emissiveIntensity = 0.6 + dark * 3; headMat.emissiveIntensity = 0.7 + dark * 2.5;
  spots.forEach(s => s.intensity = dark * 220);
  roadMat.roughness = interMat.roughness = THREE.MathUtils.lerp(0.92, 0.3, clamp(wx.rain, 0, 1));
  if (wxKey === 'storm') { bolt -= dt; if (bolt <= 0) { flashV = 1; bolt = rand(6, 14); setTimeout(thunder, rand(300, 1500)); } }
  flashV = Math.max(0, flashV - dt * 4);
  rainPts.visible = wx.rain > 0.02;
  if (rainPts.visible) {
    rainPts.material.opacity = Math.min(0.7, wx.rain * 0.6);
    const a = rainGeo.attributes.position.array;
    for (let i = 0; i < RN; i++) { a[i * 3 + 1] -= dt * 22; if (a[i * 3 + 1] < 0) a[i * 3 + 1] += 18; }
    rainGeo.attributes.position.needsUpdate = true; rainPts.position.set(camera.position.x, 0, camera.position.z);
  }
  return dark;
}

/* ================= GAUGE ================= */
const gx = $('gauge').getContext('2d'), MAXK = 260, A0 = Math.PI * 0.75, SW = Math.PI * 1.5;
const face = document.createElement('canvas'); face.width = face.height = 300;
(() => {
  const f = face.getContext('2d');
  f.beginPath(); f.arc(150, 150, 146, 0, 7); f.fillStyle = 'rgba(10,14,20,.88)'; f.fill();
  f.lineWidth = 3; f.strokeStyle = '#ffffff40'; f.stroke(); f.textAlign = 'center'; f.textBaseline = 'middle'; f.font = 'bold 17px Arial';
  for (let v = 0; v <= MAXK; v += 10) {
    const a = A0 + v / MAXK * SW, maj = v % 20 === 0, c = Math.cos(a), s = Math.sin(a), r2 = maj ? 110 : 119;
    f.strokeStyle = v >= 200 ? '#ff4350' : '#e6edf5'; f.lineWidth = maj ? 3 : 1.5;
    f.beginPath(); f.moveTo(150 + c * 128, 150 + s * 128); f.lineTo(150 + c * r2, 150 + s * r2); f.stroke();
    if (v % 40 === 0) { f.fillStyle = f.strokeStyle; f.fillText(v, 150 + c * 92, 150 + s * 92); }
  }
})();
function drawGauge(kmh, rpm, gear, nitroOn) {
  gx.clearRect(0, 0, 300, 300); gx.drawImage(face, 0, 0);
  gx.lineWidth = 5; gx.lineCap = 'round'; gx.strokeStyle = rpm > 0.85 ? '#ff4350' : '#2fd0ff';
  gx.beginPath(); gx.arc(150, 150, 138, A0, A0 + Math.max(0.01, rpm) * SW); gx.stroke();
  gx.save(); gx.translate(150, 150); gx.rotate(A0 + clamp(kmh, 0, MAXK) / MAXK * SW);
  gx.shadowColor = nitroOn ? '#4cc9ff' : '#ff2a36'; gx.shadowBlur = 10; gx.fillStyle = '#ff3040';
  gx.beginPath(); gx.moveTo(-20, -3); gx.lineTo(112, -1.5); gx.lineTo(112, 1.5); gx.lineTo(-20, 3); gx.fill(); gx.restore();
  gx.fillStyle = '#1a2029'; gx.beginPath(); gx.arc(150, 150, 14, 0, 7); gx.fill();
  gx.textAlign = 'center'; gx.textBaseline = 'middle'; gx.fillStyle = '#fff'; gx.font = '900 40px Arial'; gx.fillText(Math.round(kmh), 150, 212);
  gx.fillStyle = '#ff626b'; gx.font = 'bold 13px Arial'; gx.fillText('KM/H · ' + (gear === 'R' ? 'REVERSE' : gear ? 'GEAR ' + gear : 'N'), 150, 240);
}

/* ================= 3D MAP ================= */
const mtmp = new THREE.Vector3();
function renderMap() {
  const r = mapBox.getBoundingClientRect(); if (r.width < 10) return;
  const H = mapBig ? 260 : 120;
  mapCam.aspect = r.width / r.height; mapCam.fov = mapBig ? 55 : 50; mapCam.updateProjectionMatrix();
  car.updateMatrixWorld();
  mapCam.position.copy(car.localToWorld(mtmp.set(0, H, H * 0.5))); mapCam.lookAt(car.localToWorld(mtmp.set(0, 0, -H * 0.12)));
  mapMarker.position.set(car.position.x, 6, car.position.z); mapMarker.rotation.y = state.heading;
  const fn = scene.fog.near, ff = scene.fog.far, rv = rainPts.visible;
  scene.fog.near = 500; scene.fog.far = 3000; rainPts.visible = false;
  renderer.setViewport(r.left, innerHeight - r.bottom, r.width, r.height); renderer.setScissor(r.left, innerHeight - r.bottom, r.width, r.height);
  renderer.setScissorTest(true); renderer.shadowMap.autoUpdate = false;
  renderer.render(scene, mapCam);
  renderer.setScissorTest(false); renderer.setViewport(0, 0, innerWidth, innerHeight); renderer.shadowMap.autoUpdate = true;
  scene.fog.near = fn; scene.fog.far = ff; rainPts.visible = rv;
}

/* ================= CHECKPOINT LOGIC ================= */
function updateCP(dt) {
  const P = car.position; let act = null;
  for (const g of cpPool) {
    if (!g.visible) continue; const u = g.userData;
    u.open = damp(u.open, u.cleared ? 1 : 0, 3, dt); u.piv.rotation.z = u.open * 1.25;
    const fl = u.veh.userData.flash, p = Math.sin(state.time * 14) > 0; fl[0].emissiveIntensity = p ? 4 : 0.2; fl[1].emissiveIntensity = p ? 0.2 : 4;
    const dx = P.x - g.position.x, dz = P.z - g.position.z;
    if (dx > -1 && dx < 10 && Math.abs(dz) < 40 && -Math.cos(state.heading) > 0.3) act = g;
  }
  if (act) {
    const u = act.userData, dz = P.z - act.position.z;
    if (!u.cleared && !cp.pending) {
      if (dz > 0 && dz < 35 && !u.warned) { u.warned = true; toast('🚓 Police checkpoint ahead — slow down and stop', 3000); }
      if (dz > 0 && dz < 14 && Math.abs(state.speed) < 2) {
        cp.dwell += dt;
        if (cp.dwell > 1.5) {
          cp.dwell = 0; const r = Math.random();
          if (r < 0.55) { u.cleared = true; toast('👮 "Alright, move on. Safe journey."'); }
          else if (r < 0.9) { cp.pending = true; cp.u = u; cp.bribe = irand(5, 20) * 100; toast('👮 Officer approaches your window…', 2500); }
          else { u.cleared = true; penalty(2500, '👮 Expired papers! Fine ₦2,500'); }
        }
      } else cp.dwell = 0;
      if (u.prevDz > 0 && dz <= 0 && state.speed > 3) { u.cleared = true; penalty(5000, '🚨 You ran a police checkpoint! ₦5,000 fine'); }
    }
    u.prevDz = dz;
  } else cp.dwell = 0;
  for (const g of cpPool) if (g !== act) g.userData.warned = false;
  if (cp.pending && Math.abs(state.speed) > 6) { cp.pending = false; cp.u.cleared = true; penalty(5000, '🚨 You drove off from the officer! ₦5,000 fine'); }
}

/* ================= GAME LOOP ================= */
const camPos = new THREE.Vector3(), look = new THREE.Vector3(), tmp = new THREE.Vector3();
camera.position.set(6, 5, 130);
toast('Welcome to Ibadan, Oyo State! ◀ ▶ steer · P phone · M map · C camera · H horn · T weather', 7000);
updateTiles(); assignSites(); renderPhone();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.04);
  state.time += dt;
  const dark = updateEnv(dt), P = car.position;
  for (const m of mixers) m.update(dt);

  // ---- input ----
  const thrIn = state.throttle || keys.has('w') || keys.has('arrowup');
  const brkIn = state.braking || keys.has('s') || keys.has('arrowdown');
  const hand = keys.has(' '), hornOn = state.horn || keys.has('h');
  const nitroWant = state.nitroKey || keys.has('shift');
  const steerIn = clamp((state.sR ? 1 : 0) - (state.sL ? 1 : 0) + (keys.has('a') || keys.has('arrowleft') ? -1 : 0) + (keys.has('d') || keys.has('arrowright') ? 1 : 0), -1, 1);
  state.steer = damp(state.steer, steerIn, steerIn === 0 ? 9 : 4.5, dt);
  const hasFuel = S.fuel > 0.001;
  state.thr = damp(state.thr, thrIn && hasFuel ? 1 : 0, 6, dt);
  const nitroOn = nitroWant && state.nitro > 0.01 && thrIn && hasFuel;
  state.nitro = clamp(state.nitro + (nitroOn ? -0.3 : 0.07) * dt, 0, 1);

  if (!onRoad(P.x, P.z)) {
    const dx = P.x - Math.round(P.x / B) * B, dz = P.z - Math.round(P.z / B) * B;
    if (Math.abs(dx) < Math.abs(dz)) P.x = Math.round(P.x / B) * B + clamp(dx, -6, 6); else P.z = Math.round(P.z / B) * B + clamp(dz, -6, 6);
  }

  // ---- longitudinal physics ----
  const grip = wx.grip * (1 - S.damage / 400), vmax = cfg.maxV * (1 - S.damage / 300) * (nitroOn ? 1.3 : 1);
  if (state.thr > 0.01) {
    if (state.speed < -0.3) state.speed += 30 * dt;
    else state.speed += cfg.acc * Math.max(0, 1 - state.speed / vmax) * (nitroOn ? 2 : 1) * state.thr * dt * (0.5 + 0.5 * grip);
  }
  if (brkIn) { if (state.speed > 0.3) state.speed -= 40 * grip * dt; else if (hasFuel) state.speed = Math.max(-8, state.speed - 8 * dt); }
  if (hand) state.speed -= Math.sign(state.speed) * Math.min(Math.abs(state.speed), 22 * dt);
  state.speed -= Math.sign(state.speed) * Math.min(Math.abs(state.speed), (0.6 + 0.0008 * state.speed ** 2 + (hasFuel ? 0 : 3)) * dt);
  const sf = clamp(Math.abs(state.speed) / 55, 0, 1.3);

  // ---- steering & movement ----
  const steerAng = state.steer * 0.5 / (1 + Math.abs(state.speed) * 0.06);
  let yaw = state.speed * Math.tan(steerAng) / 2.7 * (hand ? 1.6 : 1);
  const yawMax = 1.2 * grip + 0.2; yaw = clamp(yaw, -yawMax, yawMax);
  const fx0 = -Math.sin(state.heading), fz0 = -Math.cos(state.heading);
  const prevX = P.x, prevZ = P.z;
  state.heading -= yaw * dt;
  if (grip < 0.8 && Math.abs(state.speed) > 25) state.heading += (Math.random() - 0.5) * 2.5 * (1 - grip) * dt;
  const nx = P.x + -Math.sin(state.heading) * state.speed * dt, nz = P.z + -Math.cos(state.heading) * state.speed * dt;
  let blocked = false;
  if (onRoad(nx, P.z)) P.x = nx; else blocked = true;
  if (onRoad(P.x, nz)) P.z = nz; else blocked = true;
  if (blocked) { state.speed *= 1 - 2.5 * dt; state.shake = Math.max(state.shake, 0.15); }
  car.rotation.y = state.heading;
  body.rotation.z = damp(body.rotation.z, state.steer * 0.05 * Math.min(1, Math.abs(state.speed) / 30), 5, dt);
  body.rotation.x = damp(body.rotation.x, (state.thr > 0.3 ? 0.012 : 0) - (brkIn ? 0.03 : 0), 5, dt);
  body.position.y = Math.sin(state.time * 45) * 0.006 * sf;

  // ---- red-light running ----
  state.lightCd -= dt;
  { const along = Math.abs(fz0) >= Math.abs(fx0) ? 'z' : 'x', dp = Math.sign(along === 'z' ? fz0 : fx0) || 1;
    const p0 = along === 'z' ? prevZ : prevX, p1 = along === 'z' ? P.z : P.x, n = dp > 0 ? Math.ceil(p0 / B) * B : Math.floor(p0 / B) * B;
    const d0 = (n - p0) * dp, d1 = (n - p1) * dp;
    if (d0 > 9 && d1 <= 9 && state.speed > 3 && lightFor(along) === 'red' && state.lightCd <= 0) { state.lightCd = 4; penalty(1500, '🚦 You ran a red light! ₦1,500 fine'); } }

  // ---- fuel ----
  if (hasFuel) {
    S.fuel = Math.max(0, S.fuel - Math.abs(state.speed) * dt * 0.00067 * cfg.burn * (1 + state.thr * 0.4 + (nitroOn ? 1.5 : 0)) - 0.0008 * dt);
    state.dead = false;
    if (S.fuel < cfg.tank * 0.15 && !state.lowFuel) { state.lowFuel = true; toast('⛽ Low fuel! Find a fuel station'); }
    if (S.fuel > cfg.tank * 0.2) state.lowFuel = false;
  } else if (!state.dead) { state.dead = true; toast('Engine died: out of fuel!'); }

  // ---- wheels, lights ----
  for (const w of body.userData.wheels) { w.spin.rotation.x -= state.speed * dt / 0.38; if (w.front) w.pivot.rotation.y = -state.steer * 0.4; }
  body.userData.tails.forEach(m => m.emissiveIntensity = brkIn || hand ? 3 : 0.5 + dark * 1.5);
  const blink = Math.sin(state.time * 10) > 0;
  const sL = (state.steer < -0.25 || hazard) && blink, sR = (state.steer > 0.25 || hazard) && blink;
  body.userData.sigL.forEach(m => m.emissiveIntensity = sL ? 3 : 0); body.userData.sigR.forEach(m => m.emissiveIntensity = sR ? 3 : 0);
  if (blink !== lastBlink) { lastBlink = blink; if (state.steer < -0.25 || state.steer > 0.25 || hazard) tick(); }
  wheelSpin.rotation.z = -state.steer * 1.6;
  for (const [axis, lm] of [['z', lampZ], ['x', lampX]]) lm.color.setHex(LC[lightFor(axis)]);

  // ---- traffic ----
  state.cooldown -= dt;
  let sirenD = 999;
  for (const t of traffic) {
    let target = t.base, blockedBy = false;
    for (const o of traffic) {
      if (o === t || o.axis !== t.axis || o.c !== t.c) continue;
      const gap = (o.s - t.s) * t.dir - (o.l + t.l) / 2;
      if (gap > -1 && gap < 24) { target = Math.min(target, gap < 5 ? 0 : Math.min(o.speed + 2, gap * 0.9)); if (gap < 8) blockedBy = true; }
    }
    const pa = t.axis === 'z' ? P.z : P.x, pl = t.axis === 'z' ? P.x : P.z;
    if (Math.abs(pl - t.c) < 2.4) { const pg = (pa - t.s) * t.dir - (dim.l + t.l) / 2; if (pg > -1 && pg < 24) { target = Math.min(target, pg < 6 ? 0 : pg * 0.6); if (pg < 10) blockedBy = true; } }
    const n = t.dir > 0 ? Math.ceil(t.s / B) * B : Math.floor(t.s / B) * B, gapL = (n - t.s) * t.dir - 9.5 - t.l / 2;
    if (gapL > -1) { const L = lightFor(t.axis); if (L === 'red' || (L === 'yellow' && gapL > t.speed * t.speed / 10)) target = Math.min(target, Math.max(0, gapL) * 0.9); }
    t.speed += (target - t.speed) * Math.min(1, dt * (target < t.speed ? 3 : 1.5));
    t.s += t.dir * t.speed * dt;
    t.mesh.position.set(t.axis === 'z' ? t.c : t.s, 0, t.axis === 'z' ? t.s : t.c);
    const ud = t.mesh.userData, brk = target < t.speed - 0.3 || t.speed < 0.5;
    ud.tails.forEach(m => m.emissiveIntensity = brk ? 3 : 0.5 + dark * 1.5);
    if (ud.flash.length) {
      const p = Math.sin(state.time * 14) > 0; ud.flash[0].emissiveIntensity = p ? 4 : 0.2; ud.flash[1].emissiveIntensity = p ? 0.2 : 4;
      sirenD = Math.min(sirenD, Math.hypot(t.mesh.position.x - P.x, t.mesh.position.z - P.z));
    }
    t.honkT -= dt; if (blockedBy && t.speed < 3 && t.honkT < 0) { honkAt(t.mesh.position.x, t.mesh.position.z); t.honkT = rand(1.2, 3.5); }
    else if (t.honkT < -6 && Math.random() < dt * 0.25) { honkAt(t.mesh.position.x, t.mesh.position.z); t.honkT = rand(5, 14); }
    if (Math.hypot(t.mesh.position.x - P.x, t.mesh.position.z - P.z) > 380) placeTraffic(t);
    if (state.cooldown <= 0 && Math.abs(t.mesh.position.x - P.x) < 14 && Math.abs(t.mesh.position.z - P.z) < 14) {
      const A = circ(P.x, P.z, state.heading, dim.l, dim.w), C = circ(t.mesh.position.x, t.mesh.position.z, t.hdg, t.l, t.w); let hit = null;
      for (const a of A) for (const c of C) { const dx = a[0] - c[0], dz = a[1] - c[1], rr = a[2] + c[2]; if (dx * dx + dz * dz < rr * rr) hit = [dx, dz]; }
      if (hit) {
        const m = Math.hypot(hit[0], hit[1]) || 1; P.x += hit[0] / m * 0.8; P.z += hit[1] / m * 0.8;
        state.speed *= 0.3; t.speed *= 0.5; state.crashes++; state.cooldown = 0.9; state.shake = 1;
        S.damage = Math.min(100, S.damage + 12); persist(); crashSnd(); honkAt(t.mesh.position.x, t.mesh.position.z);
        toast(`💥 Crash! Damage ${Math.round(S.damage)}%`, 2000);
        const f = $('flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
      }
    }
  }

  // ---- pedestrians ----
  const st = distAt(P.x, P.z);
  for (const p of peds) {
    const m = p.mesh, u = m.userData;
    if (!p.init || Math.hypot(m.position.x - P.x, m.position.z - P.z) > 260) {
      p.init = true; m.visible = Math.random() < st.crowd; dressPerson(m);
      const a = Math.round(P.x / B) + irand(-1, 1); let z = P.z + rand(-200, 200); if (Math.abs(z - Math.round(z / B) * B) < 12) z += 14;
      m.position.set(a * B + (Math.random() < 0.5 ? -1 : 1) * rand(8.6, 10.4), 0.2, z); p.dir = Math.random() < 0.5 ? 1 : -1; m.rotation.y = p.dir > 0 ? Math.PI : 0;
    }
    if (m.visible) {
      m.position.z += p.dir * 1.2 * dt;
      if (Math.abs(m.position.z - Math.round(m.position.z / B) * B) < 9) m.position.z += p.dir * 18;
      const sw = Math.sin(state.time * 5 + u.phase) * 0.6; u.legs[0].rotation.x = sw; u.legs[1].rotation.x = -sw; u.arms[0].rotation.x = -sw; u.arms[1].rotation.x = sw;
    }
  }
  if (waiter.visible) { waiter.userData.arms[1].rotation.z = 2.6 + Math.sin(state.time * 8) * 0.35; waiter.userData.legs.forEach(l => l.rotation.x = 0); }

  // ---- world ----
  updateTiles();
  siteT -= dt; if (siteT <= 0) { siteT = 0.5; assignSites(); }
  ground.position.set(Math.round(P.x / 10) * 10, -0.08, Math.round(P.z / 10) * 10); ground.material = GROUND[st.ground];
  sun.position.set(P.x - 20, 35, P.z + 15); sun.target.position.copy(P);
  beacon.rotation.y += dt; bm.opacity = 0.22 + Math.sin(state.time * 4) * 0.08;
  updateCP(dt);
  if (st.name !== state.st) { if (state.st) toast(`📍 Entering ${st.name}, Ibadan`, 3000); state.st = st.name; }

  // ---- panels ----
  const slow = Math.abs(state.speed) < 2.5; let curFuel = null, atGar = false;
  for (const g of fuelPool) if (g.visible && slow && Math.hypot(g.position.x + 9.6 - P.x, g.position.z - P.z) < 14) curFuel = g.userData.site;
  for (const g of garPool) if (g.visible && slow && Math.hypot(g.position.x + 9.6 - P.x, g.position.z - P.z) < 14) atGar = true;
  const want = cp.pending ? 'police' : S.fuel <= 0 && Math.abs(state.speed) < 0.5 ? 'rescue' : curFuel ? 'fuel' : atGar ? 'garage' : null;
  if (want === 'fuel') fuelSite = curFuel;
  if (want !== panelType) showPanel(want);

  // ---- ride / phone logic ----
  if (ride.phase === 'none') {
    ride.timer -= dt;
    if (ride.timer <= 0 && !panelType && phone.online && !phone.summary) newOffer();
  } else if (ride.phase === 'offer') {
    ride.expire -= dt; ringT -= dt;
    if (ringT <= 0) { ringT = 1.5; ringPhone(); }
    const c = $('pCount'); if (c) c.style.width = Math.max(0, ride.expire / 15 * 100) + '%';
    if (ride.expire <= 0) { toast('Booking missed'); declineRide(); }
  } else {
    const tx = ride.phase === 'pickup' ? ride.px : ride.tx, tz = ride.phase === 'pickup' ? ride.pz : ride.tz;
    const near = Math.hypot(P.x - tx, P.z - tz) < 11 && slow; ride.dwell = near ? ride.dwell + dt : 0;
    if (ride.dwell > 1.2) ride.phase === 'pickup' ? startTrip() : finishRide();
  }
  navT -= dt; if (navT <= 0) { navT = 0.2; updateNav(); }

  // ---- camera ----
  state.shake = Math.max(0, state.shake - dt * 2.5);
  car.updateMatrixWorld();
  const ty = body.userData.topY || 1.5, W = v => car.localToWorld(tmp.set(v[0], v[1], v[2]));
  let fov = 62 + sf * 14 + (nitroOn ? 10 : 0), snap = false;
  switch (camIdx) {
    case 0: camPos.copy(W([0, 4 + sf * 0.5, 8.5 + sf * 1.5])); look.copy(W([0, 1.2, -6])); break;
    case 1: camPos.copy(W([0, 7 + sf, 16 + sf * 3])); look.copy(W([0, 1, -12])); fov = 58 + sf * 12; break;
    case 2: camPos.copy(W([0, ty - 0.25, -dim.l * 0.22])); look.copy(W([0, ty - 0.4, -30])); snap = true; fov = 72 + sf * 16; break;
    case 3: camPos.copy(W([-0.4, ty - 0.22, dim.l * 0.05])); look.copy(W([-0.4, ty - 0.27, -30])); snap = true; fov = 75 + sf * 14; break;
    case 4: camPos.copy(W([0, 0.5, -dim.l / 2 - 0.15])); look.copy(W([0, 0.7, -30])); snap = true; fov = 80 + sf * 12; break;
    case 5: camPos.copy(W([6, 1.7, -1.5])); look.copy(W([0, 1, -1])); fov = 50; break;
    case 6: camPos.copy(W([0, 26, 8])); look.copy(W([0, 0, -5])); fov = 55; break;
    case 7: { const a = state.time * 0.5; camPos.set(P.x + Math.sin(a) * 9, 2.5 + Math.sin(a * 1.7) * 1.2, P.z + Math.cos(a) * 9); look.set(P.x, 1, P.z); fov = 55; break; }
  }
  if (snap) camera.position.copy(camPos); else camera.position.lerp(camPos, 1 - Math.exp(-5 * dt));
  camera.position.x += (Math.random() - 0.5) * state.shake * 0.4; camera.position.y += (Math.random() - 0.5) * state.shake * 0.3;
  camera.lookAt(look); camera.fov = damp(camera.fov, fov, 4, dt); camera.updateProjectionMatrix();

  // ---- audio ----
  if (audio) {
    const { ac } = audio, t = ac.currentTime, { g, rpm } = gearInfo(Math.abs(state.speed) * 55 / cfg.maxV);
    const fr = 38 + rpm * 95 + g * 8, spd = Math.abs(state.speed);
    audio.eng[0].frequency.setTargetAtTime(fr, t, 0.05); audio.eng[1].frequency.setTargetAtTime(fr * 1.012 + state.thr * 0.8, t, 0.05); audio.eng[2].frequency.setTargetAtTime(fr * 0.5, t, 0.05);
    audio.ef.frequency.setTargetAtTime(250 + rpm * 900 + state.thr * 500, t, 0.05);
    audio.eg.gain.setTargetAtTime(hasFuel ? 0.05 + state.thr * 0.07 + rpm * 0.03 : 0, t, 0.08);
    audio.wind.g.gain.setTargetAtTime(spd / 60 * 0.14, t, 0.15); audio.wind.f.frequency.setTargetAtTime(400 + spd * 22, t, 0.15);
    audio.rain.g.gain.setTargetAtTime(clamp(wx.rain, 0, 1.6) * 0.07, t, 0.2);
    const sq = clamp((hand ? spd / 25 : 0) + Math.max(0, Math.abs(state.steer) * spd / 45 - 0.45 * grip), 0, 1);
    audio.tire.g.gain.setTargetAtTime(sq * (spd > 4 ? 0.12 : 0), t, 0.05);
    audio.hg.gain.setTargetAtTime(hornOn ? 0.18 : 0, t, 0.02);
    audio.sg.gain.setTargetAtTime(clamp(1 - sirenD / 90, 0, 1) * 0.07, t, 0.1); audio.sirenO.frequency.setTargetAtTime(800 + Math.sin(state.time * 5) * 350, t, 0.03);
  }

  // ---- HUD ----
  const moving = Math.abs(state.speed) > 0.5, gi = gearInfo(Math.abs(state.speed) * 55 / cfg.maxV);
  drawGauge(Math.abs(state.speed) * 3.6, moving ? gi.rpm : (hasFuel ? 0.08 : 0), !moving ? 0 : state.speed < 0 ? 'R' : gi.g, nitroOn);
  $('nitroFill').style.width = state.nitro * 100 + '%';
  hudT += dt;
  if (hudT > 0.1) {
    hudT = 0;
    $('wallet').textContent = `${fmtN(S.ngn)} · ${fmtD(S.usd)}`;
    const fp = S.fuel / cfg.tank, ff = $('fuelFill'); ff.style.width = fp * 100 + '%'; ff.style.background = fp < 0.15 ? '#ff4350' : '#ffd23f';
    $('fuelTxt').textContent = `⛽ ${S.fuel.toFixed(1)} / ${cfg.tank} L`;
    const az = Math.abs(Math.cos(state.heading)) >= Math.abs(Math.sin(state.heading));
    $('loc').textContent = `📍 ${st.name}, Ibadan · ${az ? roadName('z', Math.round(P.x / B), st) : roadName('x', Math.round(P.z / B), st)}`;
    const h = Math.floor(state.tod), m = Math.floor((state.tod % 1) * 60), hm = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    $('wxt').textContent = `${WX[wxKey].i} ${WX[wxKey].n} · ${hm} · 🚦 ${lightFor(az ? 'z' : 'x')}`;
    $('pTime').textContent = hm;
    $('stat').textContent = `★ ${S.stars.toFixed(1)} · Rides ${S.rides} · Damage ${Math.round(S.damage)}%`;
    if (Math.random() < 0.05) persist();
  }

  renderer.render(scene, camera);
  renderMap();
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

animate();
