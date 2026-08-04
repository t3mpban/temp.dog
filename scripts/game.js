import * as THREE from "./three.module.min.js";
import {
  ACH,
  achGoal,
  achValue,
  achievement,
  choice,
  closeTextbox,
  cubicBezier,
  ready,
  setCursorDark,
  setCursorRing,
  setLoadProgress,
  sound,
  textbox,
  tooltip,
} from "./textbox.js";

// ----- uk clock -----
// london wall time, so bst is the browser's problem and not ours

const CLOCK = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const ONES = [
  "",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
  "twenty",
];

const BANDS = [
  [4, "early"],
  [6, "morning"],
  [12, "afternoon"],
  [20, "evening"],
];

function ukNow() {
  const parts = CLOCK.formatToParts(new Date());
  const read = (type) => Number(parts.find((p) => p.type === type).value);
  return { hour: read("hour") % 24, minute: read("minute") };
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function ukFace() {
  const now = ukNow();
  return pad(now.hour) + ":" + pad(now.minute);
}

function ukBand() {
  const hour = ukNow().hour;
  let out = "night";
  for (const [from, name] of BANDS) if (hour >= from) out = name;
  return out;
}

function ukIsDay() {
  const band = ukBand();
  return band === "morning" || band === "afternoon";
}

function num(n) {
  return n <= 20 ? ONES[n] : "twenty-" + ONES[n - 20];
}

function ukWords() {
  const now = ukNow();
  let minute = Math.round(now.minute / 5) * 5;
  let hour = now.hour;
  if (minute === 60) {
    minute = 0;
    hour = (hour + 1) % 24;
  }
  const h = hour % 12 || 12;
  const next = (h % 12) + 1;
  if (minute === 0) return num(h) + " o'clock";
  if (minute === 15) return "quarter past " + num(h);
  if (minute === 30) return "half past " + num(h);
  if (minute === 45) return "quarter to " + num(next);
  if (minute < 30) return num(minute) + " past " + num(h);
  return num(60 - minute) + " to " + num(next);
}

// ----- noise -----
// stand-in for FastNoiseLite perlin at frequency 1, for the handheld shake

const PERM = new Uint8Array(512);
{
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let seed = 1337;
  for (let i = 255; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const j = seed % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
}

function smooth(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function slope(hash, x, y) {
  switch (hash & 3) {
    case 0:
      return x + y;
    case 1:
      return y - x;
    case 2:
      return x - y;
    default:
      return -x - y;
  }
}

function noise2(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = smooth(xf);
  const v = smooth(yf);
  const gx = xi & 255;
  const gy = yi & 255;
  const a = PERM[gx + PERM[gy]];
  const b = PERM[((gx + 1) & 255) + PERM[gy]];
  const c = PERM[gx + PERM[(gy + 1) & 255]];
  const d = PERM[((gx + 1) & 255) + PERM[(gy + 1) & 255]];
  return mix(
    mix(slope(a, xf, yf), slope(b, xf - 1, yf), u),
    mix(slope(c, xf, yf - 1), slope(d, xf - 1, yf - 1), u),
    v
  );
}

// ----- scene -----

const TEX_DIR = "/images/game/";
const PAD = 0.03;
const MIN_BOX = 0.15;

const canvas = document.getElementById("game");
const screenEl = document.getElementById("screen");

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 4000);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(1);
const gl = renderer.getContext();

const manager = new THREE.LoadingManager();
const texLoader = new THREE.TextureLoader(manager);
const textures = new Map();
const materials = new Map();
const roles = new Map();
const quad = new THREE.PlaneGeometry(1, 1);

let data = null;

function texture(name) {
  if (textures.has(name)) return textures.get(name);
  const tex = texLoader.load(TEX_DIR + name + ".webp");
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  textures.set(name, tex);
  return tex;
}

function material(name) {
  if (materials.has(name)) return materials.get(name);
  const def = data.mats[name];
  const mat = new THREE.MeshBasicMaterial({
    alphaTest: 0.5,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  if (def.map) mat.map = texture(def.map);
  else mat.color.setStyle(def.color, THREE.SRGBColorSpace);
  materials.set(name, mat);
  return mat;
}

// godot writes a Transform3D as basis rows then origin, which is Matrix4.set order
function matrixOf(t) {
  return new THREE.Matrix4().set(
    t[0],
    t[1],
    t[2],
    t[9],
    t[3],
    t[4],
    t[5],
    t[10],
    t[6],
    t[7],
    t[8],
    t[11],
    0,
    0,
    0,
    1
  );
}

// world-space aabb of a local box, corner by corner
function corners(matrix, at, size) {
  const box = new THREE.Box3();
  const point = new THREE.Vector3();
  for (let c = 0; c < 8; c++) {
    point
      .set(at.x + size.x * (c & 1), at.y + size.y * ((c >> 1) & 1), at.z + size.z * ((c >> 2) & 1))
      .applyMatrix4(matrix);
    box.expandByPoint(point);
  }
  return box;
}

function meshBox(entry, matrix) {
  const half = entry.geo === "box" ? entry.size.map((s) => s / 2) : [0.5, 0.5, 0];
  const at = new THREE.Vector3(-half[0], -half[1], -half[2]);
  const size = new THREE.Vector3(half[0] * 2, half[1] * 2, half[2] * 2);
  const box = corners(matrix || matrixOf(entry.t), at, size);
  box.expandByScalar(PAD);
  for (const axis of ["x", "y", "z"]) {
    const short = MIN_BOX - (box.max[axis] - box.min[axis]);
    if (short > 0) {
      box.min[axis] -= short / 2;
      box.max[axis] += short / 2;
    }
  }
  return box;
}

function shapeBox(entry) {
  const size = new THREE.Vector3(...entry.size);
  return corners(matrixOf(entry.t), size.clone().multiplyScalar(-0.5), size);
}

function tags(entry, prefix) {
  return entry.g.filter((g) => g.startsWith(prefix)).map((g) => g.slice(prefix.length));
}

function tag(entry, prefix) {
  return tags(entry, prefix)[0] || "";
}

// ----- labels -----
// Label3D as a canvas texture: the quad is canvas px * pixel_size, anchored by
// the node's alignment (cmd hangs from its top-left, the clock is centred)

const MARK_DIM = "\x01";
const MARK_OK = "\x02";
const MARK_RESET = "\x03";
const MARK_RE = /[\x01-\x03]/g;
const MARK_COLORS = { [MARK_DIM]: "#9c8b78", [MARK_OK]: "#8fbf7f" };

function stripMarks(text) {
  return text.replace(MARK_RE, "");
}

function colorRuns(text, base) {
  const runs = [];
  let color = base;
  let buf = "";
  for (const ch of text) {
    if (ch === MARK_DIM || ch === MARK_OK || ch === MARK_RESET) {
      if (buf) runs.push({ text: buf, color });
      buf = "";
      color = MARK_COLORS[ch] || base;
      continue;
    }
    buf += ch;
  }
  if (buf) runs.push({ text: buf, color });
  return runs;
}

function makeLabel(def, lines, family) {
  const canvasEl = document.createElement("canvas");
  const ctx = canvasEl.getContext("2d");
  const font = def.font + "px " + (family || '"temp-v2", monospace');
  ctx.font = font;
  const metrics = ctx.measureText("M");
  const ascent = metrics.fontBoundingBoxAscent || def.font * 0.8;
  const height = Math.round(ascent + (metrics.fontBoundingBoxDescent || def.font * 0.25));
  canvasEl.width = Math.max(1, Math.round(def.w));
  canvasEl.height = Math.max(1, height * lines);

  const texture = new THREE.CanvasTexture(canvasEl);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;

  const label = {
    ctx,
    texture,
    font,
    height,
    ascent,
    width: canvasEl.width,
    dirty: false,
    text: "",
    fits(line) {
      return ctx.measureText(stripMarks(line)).width <= def.w;
    },
    set(text) {
      label.text = text;
      label.dirty = true;
    },
    paint() {
      if (!label.dirty) return;
      label.dirty = false;
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
      ctx.font = font;
      ctx.fillStyle = def.color;
      ctx.textBaseline = "alphabetic";
      const rows = label.text.split("\n");
      const centred = def.align[0] === 1;
      ctx.textAlign = centred ? "center" : "left";
      const x = centred ? canvasEl.width / 2 : 0;
      const top = def.align[1] === 1 ? (canvasEl.height - rows.length * height) / 2 : 0;
      for (let i = 0; i < rows.length; i++) {
        const y = top + i * height + ascent;
        if (centred) {
          ctx.fillText(stripMarks(rows[i]), x, y);
          continue;
        }
        let rx = x;
        for (const run of colorRuns(rows[i], def.color)) {
          ctx.fillStyle = run.color;
          ctx.fillText(run.text, rx, y);
          rx += ctx.measureText(run.text).width;
        }
      }
      texture.needsUpdate = true;
    },
  };

  const geometry = new THREE.PlaneGeometry(canvasEl.width * def.px, canvasEl.height * def.px);
  const anchor = [0.5, 0, -0.5][def.align[0]] * canvasEl.width * def.px;
  const rise = [-0.5, 0, 0.5][def.align[1]] * canvasEl.height * def.px;
  geometry.translate(anchor, rise, 0);

  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    })
  );
  mesh.matrixAutoUpdate = false;
  mesh.matrix.copy(matrixOf(def.t));
  scene.add(mesh);
  label.mesh = mesh;
  return label;
}

// ----- camera rig -----

const BEZ = cubicBezier(0.87, 0, 0.13, 1);
const TRANS_TIME = 1.2;
const SHAKE_SPEED = 0.2;
const SHAKE_ROT = THREE.MathUtils.degToRad(0.4);
const SHAKE_POS = 0.01;
const CURSOR_ROT = THREE.MathUtils.degToRad(3);
const CURSOR_CLAMP = 1;
const CURSOR_EASE = 3;
const HOVER_BLEND = 0.3;
const HOVER_EASE = 4;
const UP = new THREE.Vector3(0, 1, 0);

const rig = {
  zonePos: new THREE.Vector3(),
  zoneRot: new THREE.Quaternion(),
  fromPos: new THREE.Vector3(),
  fromRot: new THREE.Quaternion(),
  t: 1,
  cursorX: 0,
  cursorY: 0,
  hover: false,
  hoverWeight: 0,
  hoverAt: new THREE.Vector3(),
  hoverTo: new THREE.Vector3(),
  time: 0,
};

const basePos = new THREE.Vector3();
const baseRot = new THREE.Quaternion();
const lookRot = new THREE.Quaternion();
const lookMatrix = new THREE.Matrix4();
const look = new THREE.Vector3();
const nudge = new THREE.Vector3();
const shake = new THREE.Vector3();
const spin = new THREE.Quaternion();
const euler = new THREE.Euler(0, 0, 0, "YXZ");

function rigBase(e) {
  basePos.lerpVectors(rig.fromPos, rig.zonePos, e);
  baseRot.slerpQuaternions(rig.fromRot, rig.zoneRot, e);
}

function setZone(position, rotation, instant) {
  if (instant) {
    rig.fromPos.copy(position);
    rig.fromRot.copy(rotation);
    rig.zonePos.copy(position);
    rig.zoneRot.copy(rotation);
    rig.t = 1;
    return;
  }
  rigBase(BEZ(rig.t));
  rig.fromPos.copy(basePos);
  rig.fromRot.copy(baseRot);
  rig.zonePos.copy(position);
  rig.zoneRot.copy(rotation);
  rig.t = 0;
}

function setHover(on, at) {
  rig.hover = on;
  if (on) rig.hoverTo.copy(at);
}

function stepCamera(dt, pointer) {
  rig.time += dt;
  if (rig.t < 1) rig.t = Math.min(rig.t + dt / TRANS_TIME, 1);

  const ease = Math.min(dt * CURSOR_EASE, 1);
  rig.cursorX +=
    (THREE.MathUtils.clamp(pointer.x, -CURSOR_CLAMP, CURSOR_CLAMP) - rig.cursorX) * ease;
  rig.cursorY +=
    (THREE.MathUtils.clamp(pointer.y, -CURSOR_CLAMP, CURSOR_CLAMP) - rig.cursorY) * ease;

  const blend = Math.min(dt * HOVER_EASE, 1);
  rig.hoverWeight += ((rig.hover ? HOVER_BLEND : 0) - rig.hoverWeight) * blend;
  if (rig.hoverWeight < 0.005) rig.hoverAt.copy(rig.hoverTo);
  else rig.hoverAt.lerp(rig.hoverTo, blend);

  rigBase(BEZ(rig.t));

  if (rig.hoverWeight > 0.001) {
    look.subVectors(rig.hoverAt, basePos);
    if (look.lengthSq() > 1e-6 && Math.abs(look.normalize().dot(UP)) < 0.999) {
      lookMatrix.lookAt(basePos, rig.hoverAt, UP);
      lookRot.setFromRotationMatrix(lookMatrix);
      baseRot.slerp(lookRot, rig.hoverWeight);
    }
  }

  shake.set(
    noise2(rig.time * SHAKE_SPEED, 0),
    noise2(0, rig.time * SHAKE_SPEED),
    noise2(rig.time * SHAKE_SPEED, 100)
  );

  camera.position
    .copy(basePos)
    .addScaledVector(nudge.copy(shake).applyQuaternion(baseRot), SHAKE_POS);
  camera.quaternion.copy(baseRot);
  euler.set(-rig.cursorY * CURSOR_ROT, -rig.cursorX * CURSOR_ROT, 0);
  camera.quaternion.multiply(spin.setFromEuler(euler));
  euler.set(shake.x * SHAKE_ROT, shake.y * SHAKE_ROT, shake.z * SHAKE_ROT);
  camera.quaternion.multiply(spin.setFromEuler(euler));
}

// ----- zones -----

const ZONES = {
  main: { marker: "main", parent: "", area: "" },
  setup: { marker: "setup", parent: "main", area: "setupzone" },
  "pc-screen": { marker: "pc-screen", parent: "setup", area: "monitor" },
  bed: { marker: "bed", parent: "main", area: "bedzone" },
  tv: { marker: "tv", parent: "main", area: "tvzone" },
  "tv-screen": { marker: "tv-screen", parent: "tv", area: "tv" },
};
const LOCKED = { "pc-screen": true, "tv-screen": true };
const BACK_BAND = 0.15;
const HOVER_LOCK_FRAC = 0.02;

const boxes = new Map();
const ofZone = new Map();
const nolook = new Set();
const areas = new Set();
const markers = new Map();

let zone = "";
let hovered = "";
let hoveredZone = "";
let blocked = false;
let inBand = false;
let hot = [];
let hoverHot = null;
let hoverLocked = false;
let hoverLockX = 0.5;
let hoverLockY = 0.5;

const raycaster = new THREE.Raycaster();
const hitPoint = new THREE.Vector3();
const hitCentre = new THREE.Vector3();
const lookTarget = new THREE.Vector3();
const pointer = new THREE.Vector2();
let pointerX = 0.5;
let pointerY = 0.5;

let mouseMesh = null;
let mouseEntry = null;
let mouseBox = null;
let padMatrix = null;
let mouseRestLocal = null;
const mouseTarget = new THREE.Vector3();

function buildZones() {
  for (const entry of data.meshes) {
    const id = tag(entry, "obj:");
    if (!id) continue;
    if (!boxes.has(id)) {
      boxes.set(id, []);
      ofZone.set(id, tags(entry, "zone:"));
    }
    if (entry.g.includes("nolookat")) nolook.add(id);
    boxes.get(id).push(meshBox(entry));
  }

  const overridden = new Set();
  for (const entry of data.boxes) {
    if (entry.off) continue;
    const id = tag(entry, "obj:");
    if (!id) continue;
    if (!overridden.has(id)) {
      overridden.add(id);
      boxes.set(id, []);
    }
    boxes.get(id).push(shapeBox(entry));
    if (entry.g.includes("nolookat")) nolook.add(id);
    const zs = tags(entry, "zone:");
    if (zs.length || !ofZone.has(id)) ofZone.set(id, zs);
  }

  const named = new Map(data.boxes.map((entry) => [entry.n, entry]));
  for (const name of Object.keys(ZONES)) {
    const area = ZONES[name].area;
    if (named.has(area)) boxes.set(area, [shapeBox(named.get(area))]);
    else if (ofZone.has(area)) areas.add(area);
  }

  for (const [name, t] of Object.entries(data.markers)) {
    const matrix = matrixOf(t);
    markers.set(name, {
      position: new THREE.Vector3().setFromMatrixPosition(matrix),
      rotation: new THREE.Quaternion().setFromRotationMatrix(matrix),
    });
  }
}

function looks(id) {
  return id !== "" && !nolook.has(id);
}

function gotoZone(to, instant) {
  if (!ZONES[to] || to === zone) return;
  zone = to;
  hot = [];
  hoverLocked = false;
  for (const name of Object.keys(ZONES)) {
    const area = ZONES[name].area;
    if (ZONES[name].parent !== zone || !boxes.has(area)) continue;
    const obj = areas.has(area) ? area : "";
    hot.push({ boxes: boxes.get(area), zone: name, obj, look: looks(obj) });
  }
  for (const [id, zs] of ofZone) {
    if (zs.includes(zone) && !areas.has(id)) {
      hot.push({ boxes: boxes.get(id), zone: "", obj: id, look: looks(id) });
    }
  }
  const marker = markers.get(ZONES[zone].marker);
  setZone(marker.position, marker.rotation, instant);
  onZone(zone);
}

function zoneBack() {
  const up = ZONES[zone].parent;
  if (up) gotoZone(up);
}

function pick() {
  pointer.set(pointerX * 2 - 1, 1 - pointerY * 2);
  raycaster.setFromCamera(pointer, camera);
  const ray = raycaster.ray;
  let best = Infinity;
  let found = null;
  for (const entry of hot) {
    for (const box of entry.boxes) {
      if (!ray.intersectBox(box, hitPoint)) continue;
      const d = ray.origin.distanceTo(hitPoint);
      if (d < best) {
        best = d;
        found = entry;
        box.getCenter(hitCentre);
      }
    }
  }
  if (found) lookTarget.copy(hitCentre);
  return found;
}

function hoverLockBroken() {
  const dx = pointerX - hoverLockX;
  const dy = pointerY - hoverLockY;
  return dx * dx + dy * dy > HOVER_LOCK_FRAC * HOVER_LOCK_FRAC;
}

function stepZones() {
  inBand =
    !blocked && ZONES[zone].parent !== "" && (pointerX < BACK_BAND || pointerX > 1 - BACK_BAND);

  let found;
  if (inBand || blocked) {
    found = null;
    hoverLocked = false;
  } else if (hoverLocked && !hoverLockBroken()) {
    found = hoverHot;
  } else {
    found = pick();
    hoverLocked = !!found;
    hoverLockX = pointerX;
    hoverLockY = pointerY;
  }
  hoverHot = found;

  const obj = found ? found.obj : "";
  const zn = found ? found.zone : "";
  if (obj !== hovered || zn !== hoveredZone) {
    hovered = obj;
    hoveredZone = zn;
    onHovered(hovered);
  }
  setHover(found ? found.look : false, lookTarget);
  setCursorRing(inBand || !!found);
}

// ----- terminal -----
// straight port of pc.gd, which follows .godot/pc-example.py

const MAX_LINES = 9;
const CHAR_DELAY = 0.01;
const PROMPT = "[temp@temp ~]$ ";
const PASSWORD = "dogs100";

const BOOT_LOG = `[    0.000000] Command line: BOOT SEQ START
[    0.001842] CPU: AMD Ryzen 9 5950X 16-Core Processor detected
[    0.002104] CPU: 16 cores / 32 threads @ 3.4GHz base
[    0.014557] Memory: 64GB DDR4 available
[    0.021309] pci 0000:0a:00.0: NVIDIA GeForce RTX 4060 Ti detected
[    0.032881] nvidia: loading module...                          [  OK  ]
[    0.089213] Initializing cgroup subsys cpuset                  [  OK  ]
[    0.102456] Mounting /boot...                                  [  OK  ]
[    0.118732] Mounting /home...                                  [  OK  ]
[    0.203119] Starting Wayland compositor: Hyprland              [  OK  ]
[    0.240881] Starting PipeWire audio server                     [  OK  ]
[    0.251203] Starting WirePlumber session manager               [  OK  ]
[    0.302447] Loading Waybar                                     [  OK  ]
[    0.318992] Network Manager: eth0 up                           [  OK  ]
[    0.401337] Reached target Graphical Interface.                [  OK  ]
[    0.512004] Starting temp.dog message...                       [  OK  ]`;

const WELCOME = `Temp Linux [Version 26w31a]
Copyright (c) t3mp 2026. All rights reserved.

Welcome back, Temp!

Available commands: help, ls, <filename>, clr, ping
`;

const HELP = `ls lists all files
<filename> opens a file, e.g. dog
clr clears the screen
ping pongs
help prints this again!
`;

const LS_FILES = [
  "dog.png",
  "faq.txt",
  "idklol.mp4",
  "secret.txt",
  "secretgame.py",
  "theanswertolifetheuniverseandeverything.txt",
  "whatisthis.txt",
  "whoami.txt",
];

const WHOAMI_PAGES = [
  "(1/6)\nHi, my name is Temp! An awfully creative individual that, when paired with unlimited free time, can pretty much do anything I set my mind to (nerfed by ADHD tho, lol).",
  "(2/6)\nRecently, I quit video editing to pursue my dreams of game development and web design, and despite it being really scary at times, I've never felt better.",
  "(3/6)\nAs a kid who grew up on the internet, I found myself making games, music, art, videos, websites, and so much more, simply because I found it so enjoyable and fun to me.",
  "(4/6)\nSo, after finishing the hell that was high school, despite getting really good grades, I decided to follow my dreams, and that leads us to today.",
  "(5/6)\nLook, you may not know much about me now, but I promise you, and myself, that you will know me in the future. Then I can die peacefully, knowing I left my mark on the internet.",
  "(6/6)\nAnd before I sign off, I just want to thank you for stopping by my silly little website. You are awesome. Never forget where you've come from, and where you're going.\n\n- temp 29/07/26",
];

const WHATISTHIS_PAGES = [
  "What is this website for? (1/4)\n\nThis website was initially made for lurkers who like clicking on random links. I eventually decided to make a really awesome 3D WebGL game as my portfolio, as I think actions speak louder than words. Immean, what sane being creates an entire website with lore for their personal website. If this can't land me a job then nothing will.",
  'How did you make it? (2/4)\n\nThis website is purely made of HTML, CSS, and ThreeJS, and took about a month to complete. I\'ve honestly never used ThreeJS before so I designed the website in Godot first, then "converted" it into ThreeJS, for better performance/compatibility. It was really fun to make, and I highly encourage others to make their own website!',
  "What else will you add? (3/4)\n\nI consider this website finished, though my /hireme page might be updated occasionally.",
  "I found a bug/glitch in your website! (4/4)\n\nPlease email me at hi@temp.dog (or reach out on Discord) and let me know!",
];

const SECRET_TEXT = `hey, it's me, temp. i've been coding this for like... hours and like im so tired rn but like hah im glad u enjoy my game, thank you so much for your time!

feel free to reach out to me to say hi, im really curious to meet someone like you...

also, yes this is a reference to nso, yes the credits was a reference to minecraft, and yes there are a lot more references scattered around this place heh

but fr tho ur awesome tysm for playing !! <3
`;

const EXTENSIONS = [".txt", ".py", ".png", ".mp4"];
const EXTRA_COMMANDS = ["help", "ls", "ping", "clr", "rm -rf /"];

const BUSY = 0;
const ASK = 1;
const PAGE = 2;

function defer() {
  let resolve;
  const promise = new Promise((res) => (resolve = res));
  return { promise, resolve };
}

const pc = {
  label: null,
  captured: false,
  on: false,
  mode: BUSY,
  out: [],
  line: "",
  buffer: "",
  prompt: "",
  hidden: false,
  complete: false,
  entered: "",
  running: false,
  lineDone: defer(),
  anyKey: defer(),
};

function wait(seconds) {
  return new Promise((res) => setTimeout(res, Math.max(0, seconds) * 1000));
}

function baseName(name) {
  for (const ext of EXTENSIONS) {
    if (name.endsWith(ext) && name !== ext) return name.slice(0, -ext.length);
  }
  return name;
}

function commands() {
  return EXTRA_COMMANDS.concat(LS_FILES.map(baseName));
}

function formatLs() {
  return LS_FILES.map((name) => {
    const base = baseName(name);
    return base + MARK_DIM + name.slice(base.length) + MARK_RESET;
  }).join(" ");
}

function colorizeBootLine(line) {
  return line
    .replace(/^(\[\s*\d+\.\d+\])/, MARK_DIM + "$1" + MARK_RESET)
    .replace(/(\[\s*OK\s*\])\s*$/, MARK_OK + "$1" + MARK_RESET);
}

function suggest() {
  if (!pc.buffer) return "";
  let best = "";
  for (const option of commands()) {
    if (option.startsWith(pc.buffer) && option !== pc.buffer && (!best || option < best)) {
      best = option;
    }
  }
  return best;
}

function clip(head, tail) {
  let out = tail;
  while (out && !pc.label.fits(head + out)) out = out.slice(0, -1);
  return out;
}

function wrap(body) {
  const lines = [];
  let current = "";
  for (const raw of body.split(" ")) {
    let word = raw;
    while (!pc.label.fits(word)) {
      let head = clip("", word);
      if (!head) head = word.slice(0, 1);
      if (current) {
        lines.push(current);
        current = "";
      }
      lines.push(head);
      word = word.slice(head.length);
    }
    const candidate = current ? current + " " + word : word;
    if (current && !pc.label.fits(candidate)) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  lines.push(current);
  return lines;
}

function commit(line) {
  pc.out.push(line);
  while (pc.out.length > MAX_LINES) pc.out.shift();
}

function paint() {
  if (!pc.on) {
    pc.label.set("");
    return;
  }
  const shown = pc.out.slice();
  if (pc.mode === ASK) {
    let typed = pc.hidden ? "*".repeat(pc.buffer.length) : pc.buffer;
    const hint = pc.complete ? suggest() : "";
    if (hint) {
      const rest = clip(pc.prompt + typed, hint.slice(pc.buffer.length));
      if (rest) typed += MARK_DIM + rest + MARK_RESET;
    }
    shown.push(pc.prompt + typed);
  } else if (pc.line) {
    shown.push(pc.line);
  }
  while (shown.length > MAX_LINES) shown.shift();
  pc.label.set(shown.join("\n"));
}

function clear() {
  pc.out.length = 0;
  pc.line = "";
  pc.buffer = "";
  paint();
}

function write(body) {
  for (const part of wrap(body)) commit(part);
  paint();
}

async function type(body) {
  if (!pc.on) return;
  for (const part of wrap(body)) {
    for (const word of part.split(" ")) {
      pc.line += word;
      paint();
      await wait(word.length * CHAR_DELAY);
      if (!pc.on) return;
      pc.line += " ";
    }
    pc.line = pc.line.slice(0, -1);
    commit(pc.line);
    pc.line = "";
    paint();
  }
}

async function typeOut(body) {
  for (const line of body.split("\n")) await type(line);
}

async function slow(body) {
  await wait(1);
  if (pc.on) await type(body);
}

async function read(prompt, hidden, complete) {
  if (!pc.on) return "";
  pc.prompt = prompt;
  pc.hidden = hidden;
  pc.complete = complete;
  pc.buffer = "";
  pc.entered = "";
  pc.mode = ASK;
  paint();
  pc.lineDone = defer();
  await pc.lineDone.promise;
  pc.mode = BUSY;
  return pc.entered;
}

async function paginate(pages) {
  for (let i = 0; i < pages.length; i++) {
    for (const line of pages[i].split("\n")) await type(line);
    await type("");
    if (!pc.on || i === pages.length - 1) return;
    pc.line = "Press any key to continue...";
    paint();
    pc.mode = PAGE;
    pc.anyKey = defer();
    await pc.anyKey.promise;
    pc.mode = BUSY;
    pc.line = "";
    paint();
  }
}

async function play() {
  await type("");
  await slow("This is the best game ever.");
  await type("");
  await read("Are you ready? (Y/N): ", false, false);
  await type("");
  await slow("...");
  await type("");
  await slow("I'm too lazy to code y/n logic anyways lol");
  await type("");
  await slow(
    "So in this game, say a number between 1 and 1 googolplex and if you guess right you win"
  );
  await type("");
  await read("enter your number: ", false, false);
  await type("");
  await slow("...wow you won u should play the lottery!!");
  await type("");
  await slow("haha just kidding uhh you lost");
  await type("");
  await slow("Thank u so much for playing my game! yahoo");
  await type("");
  game.gambles++;
  saveGame();
  award("gambling", game.gambles);
}

async function secretgame() {
  await slow("...");
  await type("");
  await slow("game requires elevated privileges");
  await type("");
  for (let attempt = 0; attempt < 3; attempt++) {
    const entry = await read("[sudo] password for temp: ", true, false);
    if (!pc.on) return;
    if (entry === PASSWORD) {
      award("log-on");
      await play();
      return;
    }
    await type("Sorry, try again.");
  }
  await type("sudo: 3 incorrect password attempts");
  await type("");
}

async function open(base, command) {
  switch (base) {
    case "whoami":
      await paginate(WHOAMI_PAGES);
      break;
    case "whatisthis":
      await paginate(WHATISTHIS_PAGES);
      break;
    case "faq":
      await type("");
      break;
    case "secretgame":
      await secretgame();
      break;
    case "dog":
      await type("[opens dog.png in browser]");
      await type("");
      break;
    case "idklol":
      await type("[opens idklol.mp4 in browser]");
      await type("");
      break;
    case "secret":
      await typeOut(SECRET_TEXT);
      break;
    case "theanswertolifetheuniverseandeverything":
      await type("42");
      await type("");
      break;
    default:
      await type("bash: " + command + ": command not found");
      await type("");
  }
}

async function handle(command) {
  switch (command) {
    case "help":
      await typeOut(HELP);
      break;
    case "ls":
      write(formatLs());
      await type("");
      break;
    case "ping":
      await type("pong");
      await type("");
      break;
    case "clr":
      clear();
      break;
    case "rm -rf /":
      await type("[the page goes blank]");
      pc.on = false;
      break;
    default:
      await open(baseName(command), command);
  }
}

async function runTerminal() {
  if (pc.running) return;
  pc.running = true;
  try {
    await bootTerminal();
  } finally {
    pc.running = false;
  }
}

async function bootTerminal() {
  let prev = 0;
  for (const line of BOOT_LOG.split("\n")) {
    const stamp = parseFloat(line.slice(1, line.indexOf("]"))) || 0;
    await wait(stamp - prev);
    if (!pc.on) return;
    write(colorizeBootLine(line));
    prev = stamp;
  }
  clear();
  await typeOut(WELCOME);
  while (pc.on) {
    const command = (await read(PROMPT, false, true)).trim();
    if (!pc.on) return;
    if (command) await handle(command);
  }
}

function power(on) {
  pc.on = on;
  clear();
  if (on) {
    runTerminal();
  } else {
    pc.mode = BUSY;
    pc.lineDone.resolve();
    pc.anyKey.resolve();
  }
}

window.addEventListener("keydown", (event) => {
  if (!pc.captured || !pc.on) return;
  event.preventDefault();
  if (pc.mode === PAGE) {
    pc.anyKey.resolve();
    return;
  }
  if (pc.mode !== ASK) return;
  if (event.key === "Enter") {
    if (pc.complete) {
      const hint = suggest();
      if (hint) pc.buffer = clip(pc.prompt, hint);
    }
    pc.entered = pc.buffer;
    commit(pc.prompt + (pc.hidden ? "" : pc.buffer));
    pc.line = "";
    pc.lineDone.resolve();
    return;
  }
  if (event.key === "Backspace") {
    pc.buffer = pc.buffer.slice(0, -1);
  } else if (event.key === "Tab") {
    const hint = suggest();
    if (hint) pc.buffer = clip(pc.prompt, hint);
  } else if (event.key.length === 1 && pc.label.fits(pc.prompt + pc.buffer + event.key)) {
    pc.buffer += event.key;
  }
  paint();
});

// ----- game -----

const END = "free-the-end";
const TOPICS = ["password", "guitar", "remote"];
const TV_FPS = 4;
const PLAY_HOLD = 2;
const GAME_KEY = "t3mp.game";

const game = {
  pcOn: false,
  tvOn: false,
  coin: false,
  ramStolen: false,
  guitarLearned: false,
  chair: 0,
  shelf: 0,
  rug: 0,
  gambles: 0,
  knowledge: {},
  plays: { before: 0, after: 0 },
  visits: 0,
};

let tvAudio = false;
let tvFrame = 0;
let tick = 1;
let skyKey = "";

function loadGame() {
  try {
    const saved = JSON.parse(localStorage.getItem(GAME_KEY) || "{}");
    if (saved && typeof saved === "object") {
      for (const key of Object.keys(game)) {
        if (typeof saved[key] === typeof game[key] && saved[key] !== null) game[key] = saved[key];
      }
    }
  } catch (e) {
    // keep defaults
  }
}

function saveGame() {
  try {
    localStorage.setItem(GAME_KEY, JSON.stringify(game));
  } catch (e) {}
}

function beaten() {
  let n = 0;
  for (const id of Object.keys(ACH)) {
    if (id !== END && achValue(id) >= achGoal(ACH[id])) n++;
  }
  return n;
}

function award(id, value) {
  achievement(id, value);
  if (id !== END) achievement(END, Math.min(beaten(), achGoal(ACH[END]) - 1));
}

function role(name) {
  return roles.get(name);
}

function setTv(on) {
  game.tvOn = on;
  const frames = role("tvframes");
  if (frames) frames.visible = on;
}

function tvSheet() {
  const frames = role("tvframes");
  const sheet = frames && frames.material.map;
  if (!sheet) return null;
  sheet.repeat.set(1, 1 / data.mats[frames.userData.mat].frames);
  return sheet;
}

function holdGuitar(shown) {
  for (const mesh of roles.get("guitar") || []) mesh.visible = shown;
}

function topics() {
  return TOPICS.concat("donate").filter((t) => !game.knowledge[t]);
}

function learn(key) {
  game.knowledge[key] = true;
  saveGame();
  award("marketable-plush", Object.keys(game.knowledge).length);
}

function pickOne(n) {
  return 1 + Math.floor(Math.random() * n);
}

async function actPc() {
  await textbox(game.pcOn ? "pc-on" : "pc-off", null, true);
  const options = game.ramStolen ? ["yes", "no"] : [];
  const pick = await choice("pc-on", options);
  if (pick === "yes") {
    game.pcOn = !game.pcOn;
    saveGame();
    await textbox(game.pcOn ? "pc-off-yes" : "pc-on-yes");
    power(game.pcOn);
  } else if (pick === "no") {
    await textbox(game.pcOn ? "pc-on-no" : "pc-off-no");
  } else if (pick === "ram") {
    game.ramStolen = true;
    saveGame();
    await textbox("pc-ram");
    award("thief");
  }
}

async function actMonitor() {
  if (game.pcOn) gotoZone("pc-screen");
  else await textbox("monitor-off");
}

async function actTv() {
  if (!game.tvOn) {
    await textbox("tv-off");
    return;
  }
  gotoZone("tv-screen");
  await textbox("tv-on");
}

async function actRug() {
  game.rug = Math.min(game.rug + 1, 3);
  saveGame();
  await textbox("rug-" + game.rug);
  if (game.rug === 1) {
    game.coin = true;
    saveGame();
    award("money");
  } else if (game.rug === 3) {
    award("carpet");
  }
}

async function actBed() {
  if (beaten() < achGoal(ACH[END])) {
    await textbox("bed-busy-" + pickOne(4));
    return;
  }
  award(END, achGoal(ACH[END]));
  saveGame();
  location.href = "/the-end";
}

async function ask(topic) {
  if (topic === "donate" && !game.coin) {
    await textbox("plush-donate");
    return;
  }
  await textbox("plush-" + (topic === "donate" ? "donate-coin" : topic));
  learn(topic);
  if (topic === "guitar") {
    game.guitarLearned = true;
    saveGame();
    award("fast-learner");
  } else if (topic === "remote") {
    setTv(true);
    saveGame();
    award("tv-on");
  } else if (topic === "donate") {
    award("philanthropist");
  }
}

async function actPlush() {
  await textbox("plush-open-" + pickOne(5));
  await textbox("plush-interact", null, true);
  if ((await choice("plush-interact")) !== "go") {
    closeTextbox();
    return;
  }
  const left = topics();
  if (!left.length) {
    await textbox("plush-empty");
    learn("empty");
    return;
  }
  await textbox("plush-topics", null, true);
  const pick = left.length > 1 ? await choice("plush-topics", left) : left[0];
  await ask(pick);
}

async function actGuitar() {
  const stage = game.guitarLearned ? "after" : "before";
  await textbox("guitar-" + stage, null, true);
  if ((await choice("guitar-play")) !== "yes") {
    closeTextbox();
    return;
  }
  game.plays[stage] = Math.min(game.plays[stage] + 1, game.guitarLearned ? 3 : 2);
  saveGame();
  holdGuitar(false);
  sound("wear.ogg");
  await wait(PLAY_HOLD);
  await textbox("guitar-" + stage + "-play-" + game.plays[stage], null, false, () =>
    holdGuitar(true)
  );
}

async function act(id) {
  switch (id) {
    case "pc":
      await actPc();
      break;
    case "monitor":
      await actMonitor();
      break;
    case "monitor2":
      await textbox(game.pcOn ? "monitor2-on" : "monitor2-off");
      break;
    case "tv":
      await actTv();
      break;
    case "chair":
      game.chair = Math.min(game.chair + 1, 8);
      saveGame();
      await textbox("chair-" + game.chair);
      award("chair", game.chair);
      break;
    case "shelf":
      game.shelf = Math.min(game.shelf + 1, 3);
      saveGame();
      await textbox("shelf-" + game.shelf);
      break;
    case "rug":
      await actRug();
      break;
    case "marketableplush":
      await actPlush();
      break;
    case "guitar":
      await actGuitar();
      break;
    case "bed":
      await actBed();
      break;
    case "clock":
      await textbox("clock", { time: ukWords() });
      break;
    case "window":
      await textbox("window-" + ukBand());
      break;
    case "mouse":
      await textbox("mouse");
      award("mouse-ception");
      break;
    default:
      await textbox(id);
  }
}

async function onClicked(id) {
  blocked = true;
  setCursorRing(false);
  setCursorDark(false);
  await act(id);
  blocked = false;
}

function onHovered(id) {
  tooltip(id);
  if (game.tvOn && (id === "tv") !== tvAudio) {
    tvAudio = id === "tv";
    sound("tv", tvAudio ? "in" : "out");
  }
}

function onZone(name) {
  pc.captured = name === "pc-screen";
}

function stepSky() {
  const key = ukIsDay() ? "day" : "night";
  if (key === skyKey) return;
  skyKey = key;
  for (const mesh of roles.get("sky") || []) mesh.material = material(mesh.userData[key]);
}

// the pair we did not boot with, fetched once the page is idle so a rollover
// at 06:00 / 20:00 never stalls
function prefetchSky() {
  const other = skyKey === "day" ? "night" : "day";
  for (const mesh of roles.get("sky") || []) material(mesh.userData[other]);
}

function stepGame(dt) {
  tick += dt;
  if (tick >= 1) {
    tick = 0;
    const clock = role("clock");
    if (clock) clock.set(ukFace());
    stepSky();
  }
  if (!game.tvOn) return;
  const sheet = tvSheet();
  if (!sheet) return;
  const count = data.mats[role("tvframes").userData.mat].frames;
  tvFrame = (tvFrame + dt * TV_FPS) % count;
  sheet.offset.y = 1 - (Math.floor(tvFrame) + 1) / count;
}

// ----- boot -----

let rect = { left: 0, top: 0, width: 1, height: 1 };

// offset* rather than getBoundingClientRect: the screen sits at scale(0) until
// the loader finishes, and a scaled rect measures zero
function resize() {
  const width = Math.max(1, screenEl.offsetWidth);
  const height = Math.max(1, screenEl.offsetHeight);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  rect = { left: screenEl.offsetLeft, top: screenEl.offsetTop, width, height };
}

function trackPointer(event) {
  pointerX = THREE.MathUtils.clamp((event.clientX - rect.left) / rect.width, 0, 1);
  pointerY = THREE.MathUtils.clamp((event.clientY - rect.top) / rect.height, 0, 1);
}

window.addEventListener("pointermove", trackPointer);

// picked like an eyedropper: read the rendered pixel under the pointer and
// judge the cursor against its luminance, so painted-dark art counts too
const DARK_LUMA = 0.5;
const pixel = new Uint8Array(4);
function sampleCursorColor() {
  const px = Math.min(rect.width - 1, Math.floor(pointerX * rect.width));
  const py = Math.min(rect.height - 1, Math.floor((1 - pointerY) * rect.height));
  gl.readPixels(px, py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
  const luma = (0.2126 * pixel[0] + 0.7152 * pixel[1] + 0.0722 * pixel[2]) / 255;
  setCursorDark(luma < DARK_LUMA);
}

// taps arrive without a preceding move, so pick from the event itself
canvas.addEventListener("pointerdown", (event) => {
  if (blocked || !data) return;
  trackPointer(event);
  stepMouse();
  stepZones();
  if (inBand) zoneBack();
  else if (hoveredZone && !LOCKED[hoveredZone]) gotoZone(hoveredZone);
  else if (hovered) onClicked(hovered);
});

window.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || blocked || !data) return;
  zoneBack();
});

function build() {
  scene.background = new THREE.Color().setStyle(data.camera.bg, THREE.SRGBColorSpace);
  camera.fov = data.camera.fov;
  skyKey = ukIsDay() ? "day" : "night";

  const sky = [];
  const guitars = [];
  let mouseOrigin = null;
  for (const entry of data.meshes) {
    if (!entry.mat) continue;
    const geometry = entry.geo === "box" ? new THREE.BoxGeometry(...entry.size) : quad;
    // only the sky pair the current uk hour needs gets queued
    const matName = entry.day ? entry[skyKey] : entry.mat;
    const mesh = new THREE.Mesh(geometry, material(matName));
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(matrixOf(entry.t));
    mesh.visible = entry.vis !== false;
    mesh.userData.mat = matName;
    if (entry.day) {
      mesh.userData.day = entry.day;
      mesh.userData.night = entry.night;
      sky.push(mesh);
    }
    if (entry.g.includes("obj:guitar")) guitars.push(mesh);
    if (entry.g.includes("obj:mousepad")) padMatrix = matrixOf(entry.t);
    if (entry.g.includes("obj:mouse")) {
      mouseMesh = mesh;
      mouseEntry = entry;
      mouseOrigin = new THREE.Vector3(entry.t[9], entry.t[10], entry.t[11]);
    }
    const roleName = tag(entry, "role:");
    if (roleName && roleName !== "sky") roles.set(roleName, mesh);
    scene.add(mesh);
  }
  roles.set("sky", sky);
  roles.set("guitar", guitars);
  if (mouseMesh && padMatrix && mouseOrigin) {
    mouseRestLocal = mouseOrigin.applyMatrix4(new THREE.Matrix4().copy(padMatrix).invert());
  }

  for (const def of data.labels) {
    const named = tag(def, "role:");
    const family = named === "cmd" ? '"JetBrains Mono", monospace' : undefined;
    const label = makeLabel(def, named === "cmd" ? MAX_LINES : 1, family);
    if (named) roles.set(named, label);
  }
  pc.label = role("cmd");
  tvSheet();

  buildZones();
  mouseBox = boxes.has("mouse") ? boxes.get("mouse")[0] : null;
  resize();
  new ResizeObserver(resize).observe(screenEl);
  window.addEventListener("resize", resize);
}

function stepMouse() {
  if (!mouseMesh || !padMatrix || !mouseRestLocal) return;
  mouseTarget.set(pointerX - 0.5, 0.5 - pointerY, mouseRestLocal.z).applyMatrix4(padMatrix);
  mouseMesh.matrix.elements[12] = mouseTarget.x;
  mouseMesh.matrix.elements[13] = mouseTarget.y;
  mouseMesh.matrix.elements[14] = mouseTarget.z;
  if (mouseBox) mouseBox.copy(meshBox(mouseEntry, mouseMesh.matrix));
}

let last = performance.now();

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  stepGame(dt);
  stepMouse();
  stepZones();
  stepCamera(dt, { x: pointerX * 2 - 1, y: pointerY * 2 - 1 });
  for (const label of [role("cmd"), role("clock")]) if (label) label.paint();
  renderer.render(scene, camera);
  sampleCursorColor();
  requestAnimationFrame(frame);
}

async function boot() {
  const [loaded] = await Promise.all([
    fetch("/scripts/scene.json").then((res) => res.json()),
    ready,
    document.fonts ? document.fonts.load('31px "temp-v2"') : null,
    document.fonts ? document.fonts.load('31px "JetBrains Mono"') : null,
  ]);
  data = loaded;

  const done = new Promise((res) => {
    manager.onLoad = res;
    manager.onProgress = (url, count, total) => setLoadProgress(total ? count / total : 1);
  });

  loadGame();
  game.visits++;
  saveGame();

  build();
  setTv(game.tvOn);
  role("clock").set(ukFace());
  gotoZone("main", true);
  if (game.pcOn) power(true);

  await done;
  setLoadProgress(1);
  last = performance.now();
  requestAnimationFrame(frame);

  award("hello-world");
  if (game.visits >= 2) award("honey-im-home");
  if (window.requestIdleCallback) requestIdleCallback(prefetchSky);
  else setTimeout(prefetchSky, 3000);
}

boot();
