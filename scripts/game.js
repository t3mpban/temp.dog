import * as THREE from "./three.module.min.js";
import {
  ACH,
  achGoal,
  achValue,
  achievement,
  choice,
  closeTextbox,
  cubicBezier,
  isChoiceOpen,
  isPanelOpen,
  langText,
  loopTime,
  MUSIC_BPM,
  playSfx,
  ready,
  setCursorDark,
  setCursorRing,
  setLoadProgress,
  setLoop,
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
const MARK_COLORS = { [MARK_DIM]: "#e0b98e", [MARK_OK]: "#fed8b1" };

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

// "[token]" runs are clickable, but rendered without the brackets: stripLinks()
// drops them from what's drawn, and findLinks() reports columns in that same
// (marks + brackets stripped) space so they line up with the drawn text
const LINK_RE = /(?<![\x01-\x03])\[[^\]\n]+\]/g;
// findLinks' exec loop below calls stripLinks while it's mid-iteration; sharing
// one regex object between the two would clobber lastIndex and spin forever
const LINK_SCAN_RE = /(?<![\x01-\x03])\[[^\]\n]+\]/g;
function stripLinks(text) {
  return text.replace(LINK_RE, (m) => m.slice(1, -1));
}
function findLinks(row) {
  const out = [];
  LINK_SCAN_RE.lastIndex = 0;
  let m;
  while ((m = LINK_SCAN_RE.exec(row))) {
    out.push({
      col: stripMarks(stripLinks(row.slice(0, m.index))).length,
      len: m[0].length - 2,
      text: m[0].slice(1, -1),
    });
  }
  return out;
}

function makeLabel(def, lines, family) {
  const canvasEl = document.createElement("canvas");
  const ctx = canvasEl.getContext("2d");
  const font = def.font + "px " + (family || '"temp-v2", monospace');
  ctx.font = font;
  ctx.fontKerning = "none"; // temp-v2's kerning pairs shift some glyphs (e.g. "_" next to "**") off baseline
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
    canvasHeight: canvasEl.height,
    dirty: false,
    text: "",
    links: [],
    fits(line) {
      return ctx.measureText(stripLinks(stripMarks(line))).width <= def.w;
    },
    set(text) {
      label.text = text;
      label.dirty = true;
    },
    // px,py in canvas pixels (top-left origin); null if nothing clickable there
    hitLink(px, py) {
      for (const link of label.links) {
        if (px >= link.x0 && px < link.x1 && py >= link.y0 && py < link.y1) return link.text;
      }
      return null;
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
      const charWidth = ctx.measureText("0").width;
      label.links = [];
      for (let i = 0; i < rows.length; i++) {
        const y = top + i * height + ascent;
        if (centred) {
          ctx.fillText(stripLinks(stripMarks(rows[i])), x, y);
          continue;
        }
        let rx = x;
        for (const run of colorRuns(stripLinks(rows[i]), def.color)) {
          ctx.fillStyle = run.color;
          ctx.fillText(run.text, rx, y);
          rx += ctx.measureText(run.text).width;
        }
        for (const link of findLinks(rows[i])) {
          label.links.push({
            x0: link.col * charWidth,
            x1: (link.col + link.len) * charWidth,
            y0: top + i * height,
            y1: top + (i + 1) * height,
            text: link.text,
          });
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

  if (!isPanelOpen()) {
    const blend = Math.min(dt * HOVER_EASE, 1);
    rig.hoverWeight += ((rig.hover ? HOVER_BLEND : 0) - rig.hoverWeight) * blend;
    if (rig.hoverWeight < 0.005) rig.hoverAt.copy(rig.hoverTo);
    else rig.hoverAt.lerp(rig.hoverTo, blend);
  }

  rigBase(BEZ(rig.t));

  if (rig.hoverWeight > 0.001 && !isPanelOpen()) {
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
let wasHot = false; // whether the cursor was over anything hoverable last frame
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
  if (!instant) playSfx(ZONES[to].parent === zone ? "zoomin" : "zoomout");
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
  if (isPanelOpen()) {
    // settings/achievements own hover + cursor while open; ignore the game world,
    // but leave the ring alone so their own .cursorable hover state still shows
    inBand = false;
    hoverLocked = false;
    hoverHot = null;
    if (hovered !== "" || hoveredZone !== "") {
      hovered = "";
      hoveredZone = "";
      onHovered("");
    }
    wasHot = false; // a dom overlay is showing, not a real unhover of the game world
    setHover(false, lookTarget);
    return;
  }
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
  if (!!found !== wasHot) {
    wasHot = !!found;
    playSfx(wasHot ? "hover" : "unhover");
  }
  setHover(found ? found.look : false, lookTarget);
  setCursorRing(inBand || !!found);
}

// ----- terminal -----
// straight port of pc.gd, which follows .godot/pc-example.py

const MAX_LINES = 9;
const CHAR_DELAY = 0.01;
const PROMPT = "temp@temp ~$ ";
const PASSWORD = "dogs100";

const BOOT_LOG = `[    0.000000] Command line: BOOT SEQ START
[0.001842] CPU: AMD Ryzen 9 5950X 16-Core Processor detected
[0.002104] CPU: 16 cores / 32 threads @ 3.4GHz base
[0.014557] Memory: 64GB DDR4 available
[0.021309] pci 0000:0a:00.0: NVIDIA GeForce RTX 4060 Ti detected
[0.032881] nvidia: loading module...        [  OK  ]
[0.089213] Initializing cgroup subsys cpuset[  OK  ]
[0.102456] Mounting /boot...                [  OK  ]
[0.118732] Mounting /home...                [  OK  ]
[0.203119] Starting compositor: Hyprland    [  OK  ]
[0.240881] Starting PipeWire audio server   [  OK  ]
[0.251203] Starting WirePlumber session     [  OK  ]
[0.302447] Loading Waybar                   [  OK  ]
[0.318992] Network Manager: eth0 up         [  OK  ]
[0.401337] Reached target GUI               [  OK  ]
[0.512004] Starting temp.dog message...     [  OK  ]`;

const WELCOME = `Temp Linux (Version 26w31a)
Copyright (c) t3mp 2026. All rights reserved.

Welcome back, Temp!

Available commands: [help], [ls], <filename>, [clr], [ping]
`;

const HELP = `[ls] lists all files
<filename> opens a file, e.g. [dog]
[clr] clears the screen
[ping] pongs
[help] prints this again!
`;

const LS_FILES = [
  "dog.png",
  "idklol.mp4",
  "secret.txt",
  "casino.py",
  "theanswertolifetheuniverseandeverything.txt",
  "whatisthis.txt",
  "whoami.txt",
];

const WHOAMI_PAGES = [
  {
    en: "(1/6)\nHi, my name is Temp! An awfully creative individual that, when paired with unlimited free time, can pretty much do anything I set my mind to (nerfed by ADHD tho, lol).",
    es: "(1/6)\n¡Hola, soy Temp! Un individuo muy creativo que, con tiempo libre ilimitado, puede casi todo lo que se propone (nerfeado por el TDAH, lol).",
    pt: "(1/6)\nOi, meu nome é Temp! Um cara muito criativo que, com tempo livre ilimitado, faz quase tudo que quiser (nerfado pelo TDAH, lol).",
    fr: "(1/6)\nSalut, je suis Temp ! Un type très créatif qui, avec du temps libre illimité, peut faire presque tout (nerfé par le TDAH, lol).",
    de: "(1/6)\nhi, ich bin temp! ein sehr kreativer typ, der mit unbegrenzter freizeit fast alles schaffen kann (durch adhs generft, lol).",
    jp: "(1/6)\nどうも、Tempです！時間が無限にあれば大抵何でもできる、めちゃ創造的な人間です（ADHDのせいで少し弱体化してるけどw）。",
    kr: "(1/6)\n안녕, 나는 Temp야! 시간이 무한하면 거의 뭐든 할 수 있는, 엄청 창의적인 사람이지 (ADHD 때문에 좀 너프됐지만 ㅋㅋ).",
    zh: "(1/6)\n嗨，我是Temp！一个超有创意的人，只要时间无限，几乎什么都能做到（不过被多动症削弱了些，哈哈）。",
  },
  {
    en: "(2/6)\nRecently, I quit video editing to pursue my dreams of game development and web design, and despite it being really scary at times, I've never felt better.",
    es: "(2/6)\nHace poco dejé la edición de video para perseguir mis sueños en videojuegos y diseño web, y aunque da miedo, nunca me sentí mejor.",
    pt: "(2/6)\nRecentemente deixei a edição de vídeo para seguir meus sonhos em jogos e design web, e mesmo dando medo, nunca me senti melhor.",
    fr: "(2/6)\nJ'ai récemment quitté le montage vidéo pour poursuivre mes rêves en jeux vidéo et web design, et malgré la peur, je me sens mieux que jamais.",
    de: "(2/6)\nvor kurzem habe ich videobearbeitung aufgegeben, um meine träume von gamedev und webdesign zu verfolgen, und trotz der angst fühle ich mich besser.",
    jp: "(2/6)\n最近、動画編集をやめてゲーム開発とウェブデザインの夢を追うことにした。怖いこともあるけど、今までで一番いい気分だ。",
    kr: "(2/6)\n최근 영상 편집을 그만두고 게임 개발과 웹 디자인이라는 꿈을 좇기로 했어. 무섭기도 하지만, 그 어느 때보다 기분이 좋아.",
    zh: "(2/6)\n最近我放弃了视频剪辑，去追求游戏开发和网页设计的梦想，虽然有点吓人，但我从未感觉这么好过。",
  },
  {
    en: "(3/6)\nAs a kid who grew up on the internet, I found myself making games, music, art, videos, websites, and so much more, simply because I found it so enjoyable and fun to me.",
    es: "(3/6)\nDe niño crecí en internet, y me encontré haciendo juegos, música, arte, videos, webs, y mucho más, solo porque me resultaba muy divertido.",
    pt: "(3/6)\nCresci na internet, e me encontrei fazendo jogos, música, arte, vídeos, sites, e muito mais, só porque eu achava tudo isso muito divertido.",
    fr: "(3/6)\nEnfant élevé sur internet, je me suis retrouvé à faire des jeux, musique, art, vidéos, sites, et bien plus, juste parce que ça m'amusait.",
    de: "(3/6)\nals kind, der im internet aufwuchs, machte ich spiele, musik, kunst, videos, websites und vieles mehr, einfach weil es mir spaß machte.",
    jp: "(3/6)\nインターネットで育った子供として、気づけばゲームや音楽、アート、動画、ウェブサイトなどを作っていた。単純に楽しかったからだ。",
    kr: "(3/6)\n인터넷 속에서 자란 아이로서, 어느새 게임, 음악, 예술, 영상, 웹사이트 등을 만들고 있었어. 그냥 그게 너무 즐거웠거든.",
    zh: "(3/6)\n作为在互联网上长大的孩子，我不知不觉就开始做游戏、音乐、艺术、视频、网站等等，只因为这一切让我觉得非常快乐有趣。",
  },
  {
    en: "(4/6)\nSo, after finishing the hell that was high school, despite getting really good grades, I decided to follow my dreams, and that leads us to today.",
    es: "(4/6)\nAsí que, tras terminar el infierno del instituto, con muy buenas notas, decidí seguir mis sueños, y así llegamos hasta aquí.",
    pt: "(4/6)\nEntão, após terminar o inferno do colégio, com notas muito boas, decidi seguir meus sonhos, e assim chegamos até aqui.",
    fr: "(4/6)\nDonc, après avoir fini l'enfer du lycée, avec de très bonnes notes, j'ai décidé de suivre mes rêves, et ça nous mène jusqu'ici.",
    de: "(4/6)\nnach der hölle namens schule, mit richtig guten noten, entschied ich mich, meinen träumen zu folgen, und so kamen wir hierher.",
    jp: "(4/6)\n地獄のような高校生活を、いい成績で終えた後、俺は夢を追うことに決めた。それが今日につながっている。",
    kr: "(4/6)\n지옥 같던 고등학교를 아주 좋은 성적으로 마친 뒤, 나는 꿈을 좇기로 결심했어. 그렇게 지금에 이르게 됐지.",
    zh: "(4/6)\n结束了如同地狱般的高中生活后，尽管成绩很好，我还是决定追随自己的梦想，于是就有了今天。",
  },
  {
    en: "(5/6)\nLook, you may not know much about me now, but I promise you, and myself, that you will know me in the future. Then I can die peacefully, knowing I left my mark on the internet.",
    es: "(5/6)\nQuizá no me conozcas mucho ahora, pero te prometo, y me prometo, que me conocerás en el futuro. Así podré morir en paz, sabiendo que dejé huella en internet.",
    pt: "(5/6)\nTalvez não me conheça muito agora, mas prometo a você, e a mim, que vai me conhecer no futuro. Assim posso morrer em paz, sabendo que deixei minha marca na internet.",
    fr: "(5/6)\nTu ne me connais peut-être pas bien maintenant, mais je te promets, et me promets, que tu me connaîtras un jour. Je pourrai alors mourir en paix, ayant marqué internet.",
    de: "(5/6)\ndu kennst mich jetzt kaum, aber ich verspreche dir und mir: du wirst mich noch kennenlernen. dann kann ich in frieden sterben, mit meiner spur im internet.",
    jp: "(5/6)\n今はまだ俺のことをよく知らないかもしれないけど、将来は必ず知ってもらえると約束する。そうすればインターネットに足跡を残して安らかに死ねる。",
    kr: "(5/6)\n지금은 나를 잘 모를 수도 있지만, 언젠가 나를 알게 될 거라고 너와 나 자신에게 약속해. 그러면 인터넷에 흔적을 남기고 편히 눈을 감을 수 있겠지.",
    zh: "(5/6)\n你现在可能还不太了解我，但我向你、也向自己保证，将来你一定会认识我的。那样我就能安心地离去，因为我在互联网上留下了自己的印记。",
  },
  {
    en: "(6/6)\nAnd before I sign off, I just want to thank you for stopping by my silly little website. You are awesome. Never forget where you've come from, and where you're going. - temp 29/07/26",
    es: "(6/6)\nAntes de irme, quiero darte las gracias por visitar mi pequeña web. Eres genial. Nunca olvides de dónde vienes y a dónde vas. - temp 29/07/26",
    pt: "(6/6)\nAntes de sair, quero te agradecer por visitar meu site bobinho. Você é demais. Nunca esqueça de onde veio e pra onde vai. - temp 29/07/26",
    fr: "(6/6)\nAvant de partir, merci d'être passé sur mon petit site débile. Tu es génial. N'oublie jamais d'où tu viens, ni où tu vas. - temp 29/07/26",
    de: "(6/6)\nbevor ich abschließe, danke ich dir, dass du auf meiner kleinen albernen website warst. du bist toll. vergiss nie, wo du herkommst. - temp 29/07/26",
    jp: "(6/6)\n最後に、この小さくて馬鹿げたサイトに来てくれてありがとう。お前は最高だ。自分の来た道と行く先を忘れないで。 - temp 29/07/26",
    kr: "(6/6)\n마지막으로, 이 작고 엉뚱한 사이트에 들러줘서 고마워. 넌 정말 멋져. 네가 온 길과 갈 길을 절대 잊지 마. - temp 29/07/26",
    zh: "(6/6)\n最后，谢谢你逛了我这个傻乎乎的小网站。你很棒。永远别忘了自己从哪来，要去哪。 - temp 29/07/26",
  },
];

const WHATISTHIS_PAGES = [
  {
    en: "What is this website for? (1/4)\nThis website was initially made for lurkers who like clicking on random links. I eventually decided to make a really awesome 3D WebGL game as my portfolio, as I think actions speak louder than words. If this can't land me a job then nothing will.",
    es: "¿Para qué es esta web? (1/4)\nLa hice para curiosos que hacen clic en links random. Al final decidí hacer un juego 3D WebGL como portafolio, ya que las acciones hablan más que las palabras. Si esto no me da trabajo, nada lo hará.",
    pt: "Pra que serve este site? (1/4)\nFiz para curiosos que clicam em links aleatórios. No fim decidi fazer um jogo 3D WebGL como portfólio, já que ações falam mais que palavras. Se isso não me dá um emprego, nada vai.",
    fr: "C'est pour quoi ce site ? (1/4)\nFait pour les curieux qui cliquent sur des liens au hasard. J'ai fini par faire un jeu 3D WebGL comme portfolio, car les actes valent mieux que les mots. Si ça ne me trouve pas de travail, rien ne le fera.",
    de: "wofür ist diese website? (1/4)\ngemacht für neugierige, die auf zufällige links klicken. am ende baute ich ein 3d-webgl-spiel als portfolio, denn taten zählen mehr als worte. wenn das mir keinen job bringt, nichts wird.",
    jp: "このサイトは何のため？(1/4)\nランダムなリンクをクリックする野次馬のために作った。結局、行動は言葉より物を言うと思い、ポートフォリオとして3D WebGLゲームを作ることにした。これで仕事が取れなければ、もう無理だ。",
    kr: "이 사이트는 뭐 하러 만든 거야? (1/4)\n아무 링크나 누르는 사람들을 위해 처음 만들었어. 결국 행동이 말보다 중요하다 싶어서 포트폴리오로 3D 웹GL 게임을 만들기로 했지. 이걸로도 취업이 안 되면, 답이 없는 거야.",
    zh: "这个网站是做什么用的？(1/4)\n最初是为喜欢乱点链接的人做的。后来我决定做一个3D WebGL游戏当作品集，因为行动胜于空谈。要是这样都找不到工作，那就没办法了。",
  },
  {
    en: 'How did you make it? (2/4)\nThis website is made with ThreeJS, and about a week to make. I\'ve honestly never used ThreeJS before so I designed the website in Godot first, then "converted" it into ThreeJS. It was really fun to make, and I highly encourage others to make their own website!',
    es: '¿Cómo la hiciste? (2/4)\nEstá hecha con ThreeJS, y tardé como una semana. Nunca antes usé ThreeJS, así que diseñé la web en Godot primero, y luego la "convertí" a ThreeJS. Fue muy divertido, ¡y animo a otros a hacer su propia web!',
    pt: 'Como você fez isso? (2/4)\nÉ feito com ThreeJS, e levou uma semana. Nunca tinha usado ThreeJS, então desenhei o site no Godot primeiro, e depois "converti" pra ThreeJS. Foi muito divertido, e recomendo que outros façam o próprio site!',
    fr: "Comment tu l'as fait ? (2/4)\nFait avec ThreeJS, en environ une semaine. Je n'avais jamais utilisé ThreeJS, donc j'ai conçu le site sur Godot d'abord, puis \"converti\" en ThreeJS. Très amusant, et j'encourage tout le monde à faire son propre site !",
    de: 'wie hast du das gemacht? (2/4)\ngemacht mit threejs, und etwa eine woche gedauert. ich hatte threejs nie benutzt, also entwarf ich die website erst in godot, dann "konvertierte" ich sie zu threejs. hat riesig spaß gemacht!',
    jp: "どうやって作った？(2/4)\nThreeJSで作られていて、約1週間かかった。ThreeJSは初めてだったので、まずGodotでサイトを設計し、それをThreeJSに「変換」した。とても楽しかったし、みんなも自分のサイトを作ってみてほしい！",
    kr: '어떻게 만든 거야? (2/4)\nThreeJS로 만들었고, 한 일주일쯜 걸렸어. ThreeJS는 써본 적이 없어서, 먼저 Godot에서 디자인한 다음 ThreeJS로 "변환"했지. 정말 재밌었고, 다들 자기 사이트를 만들어보길 추천해!',
    zh: "你是怎么做出来的？(2/4)\n是用ThreeJS做的，花了大概一周。我以前从没用过ThreeJS，所以先在Godot里设计好网站，再把它「转换」成ThreeJS。做得很开心，也鼓励大家做一个属于自己的网站！",
  },
  {
    en: "What else will you add? (3/4)\nI consider this website finished, though my /hireme page might be updated occasionally.",
    es: "¿Qué más añadirás? (3/4)\nConsidero esta web terminada, aunque mi página /hireme puede actualizarse a veces.",
    pt: "O que mais vai adicionar? (3/4)\nConsidero este site terminado, embora /hireme possa ser atualizado às vezes.",
    fr: "Quoi d'autre ? (3/4)\nJe considère ce site fini, même si ma page /hireme sera parfois mise à jour.",
    de: "was kommt noch? (3/4)\nich halte diese website für fertig, obwohl meine /hireme-seite ab und zu aktualisiert wird.",
    jp: "他に何を追加する？(3/4)\nこのサイトは完成したと思っているが、/hiremeページはたまに更新するかもしれない。",
    kr: "또 뭘 추가할 거야? (3/4)\n이 사이트는 완성됐다고 생각하지만, /hireme 페이지는 가끔 업데이트될 수도 있어.",
    zh: "你还会添加什么？(3/4)\n我认为这个网站已经完成了，不过/hireme页面可能会偶尔更新。",
  },
  {
    en: "I found a bug/glitch in your website! (4/4)\nPlease email me at hi@temp.dog (or reach out on Discord) and let me know!",
    es: "¡Encontré un bug en tu web! (4/4)\nEscríbeme a hi@temp.dog (o en Discord) y avísame!",
    pt: "Encontrei um bug no seu site! (4/4)\nMe escreva em hi@temp.dog (ou no Discord) e me avise!",
    fr: "J'ai trouvé un bug sur ton site ! (4/4)\nÉcris-moi à hi@temp.dog (ou sur Discord) pour me le dire !",
    de: "ich habe einen bug gefunden! (4/4)\nschreib mir an hi@temp.dog (oder auf discord) und sag mir bescheid!",
    jp: "サイトにバグを見つけた！(4/4)\nhi@temp.dogまで（またはDiscordで）教えてください！",
    kr: "사이트에서 버그를 발견했어! (4/4)\nhi@temp.dog로 (또는 디스코드로) 알려줘!",
    zh: "我发现你网站有个bug！(4/4)\n请发邮件到hi@temp.dog（或私信Discord）告诉我！",
  },
];

const SECRET_PAGES = [
  {
    en: "(1/4)\nhey, it's me, temp. i've been coding this for like... hours and like im so tired rn but like hah im glad u enjoy my game, thank you so much for your time!",
    es: "(1/4)\nhola, soy temp. lleva ya horas programando esto y estoy muy cansado pero me alegra que disfrutes mi juego, gracias por tu tiempo!",
    pt: "(1/4)\noi, sou o temp. já são horas programando isso e tô muito cansado mas fico feliz que curte meu jogo, obrigado pelo seu tempo!",
    fr: "(1/4)\nsalut, c'est temp. ça fait des heures que je code ça et je suis épuisé mais content que tu aimes mon jeu, merci pour ton temps !",
    de: "(1/4)\nhey, ich bin's, temp. das hier zu coden dauert schon stunden und ich bin so müde, aber freut mich, dass es dir gefällt, danke dir!",
    jp: "(1/4)\nどうも、tempです。もう何時間もこれをコーディングしてて超眠いけど、楽しんでもらえて嬉しいよ、時間をくれてありがとう！",
    kr: "(1/4)\n안녕, 나 temp야. 이거 코딩하는 데 벌써 몇 시간이나 걸렸고 너무 졸린데, 즐겨줘서 기쁘다, 시간 내줘서 고마워!",
    zh: "(1/4)\n嗨，是我，temp。这玩意儿都写了好几个小时了，累死了，但很高兴你喜欢我的游戏，谢谢你的时间！",
  },
  {
    en: "(2/4)\nfeel free to reach out to me to say hi, im really curious to meet someone like you...",
    es: "(2/4)\nescríbeme para saludar, tengo curiosidad por conocer a alguien como tú...",
    pt: "(2/4)\nme escreva pra dizer oi, tenho curiosidade de conhecer alguém como você...",
    fr: "(2/4)\nn'hésite pas à m'écrire, je suis curieux de rencontrer quelqu'un comme toi...",
    de: "(2/4)\nschreib mir gern, ich bin gespannt jemanden wie dich kennenzulernen...",
    jp: "(2/4)\n気軽に声をかけてね、お前みたいな人に会えるの、すごく楽しみにしてるんだ…",
    kr: "(2/4)\n편하게 인사하러 와도 돼, 너 같은 사람을 만나는 게 진짜 궁금하거든…",
    zh: "(2/4)\n欢迎随时来打个招呼，我真的很想认识像你这样的人…",
  },
  {
    en: "(3/4)\nalso, yes this is a reference to nso, yes the credits was a reference to minecraft, and yes there are a lot more references scattered around this place heh",
    es: "(3/4)\ntambién, sí esto es referencia a nso, sí los créditos son referencia a minecraft, y sí hay más referencias por aquí jeje",
    pt: "(3/4)\ntambém, sim isso é referência ao nso, sim os créditos são referência ao minecraft, e sim tem mais referências por aqui hehe",
    fr: "(3/4)\naussi, oui c'est une référence à nso, oui le générique est une référence à minecraft, et oui il y a plus de références ici mdr",
    de: "(3/4)\nübrigens, ja das ist eine nso-referenz, ja der abspann ist eine minecraft-referenz, und ja es gibt noch mehr referenzen hier hehe",
    jp: "(3/4)\nちなみに、これはnsoの元ネタで、クレジットはマイクラの元ネタ、そしてここには他にもネタが隠れてるよへへ",
    kr: "(3/4)\n참고로, 이건 nso 레퍼런스고, 크레딧은 마인크래프트 레퍼런스야, 여기 저기 더 많은 레퍼런스가 숨어있어 헤헤",
    zh: "(3/4)\n还有，这里是nso的彩蛋，credits是我的世界的彩蛋，这地方还藏着更多彩蛋呢嘿嘿",
  },
  {
    en: "(4/4)\nbut fr tho ur awesome tysm for playing !! <3",
    es: "(4/4)\nen serio, eres genial, gracias por jugar! <3",
    pt: "(4/4)\nmas sério, você é ótimo, valeu por jogar! <3",
    fr: "(4/4)\nsérieux, t'es génial, merci d'avoir joué! <3",
    de: "(4/4)\necht, du bist toll, danke fürs spielen! <3",
    jp: "(4/4)\nでもマジで、お前最高だよ、遊んでくれてありがとう！！<3",
    kr: "(4/4)\n근데 진심으로, 너 정말 멋져, 플레이해줘서 고마워 !! <3",
    zh: "(4/4)\n不过说真的，你超棒，谢谢你玩这个游戏！！<3",
  },
];

const SECRET_LOCKED = {
  en: "permission denied",
  es: "acceso denegado",
  pt: "acesso negado",
  fr: "accès refusé",
  de: "zugriff verwehrt",
  jp: "アクセス拒否",
  kr: "접근 거부",
  zh: "拒绝访问",
};

const CASINO_START = 100;
const CASINO_ROLL_COST = 20;
const CASINO_PROFIT_GOAL = 50;
const CASINO_GUESSES = ["odd", "even", "1", "2", "3", "4", "5", "6"];
const CASINO_RULES = [
  {
    en: "(1/3)\nWelcome to my casino! Each dice roll costs $20. You must choose between odd, even or the specific number.",
    es: "(1/3)\n¡Bienvenido a mi casino! Cada tirada cuesta $20. Debes elegir entre par, impar o el número exacto.",
    pt: "(1/3)\nBem-vindo ao meu casino! Cada jogada custa $20. Você deve escolher entre par, ímpar ou o número exato.",
    fr: "(1/3)\nBienvenue dans mon casino ! Chaque lancer coûte 20 $. Choisis entre pair, impair, ou le chiffre exact.",
    de: "(1/3)\nwillkommen in meinem casino! jeder wurf kostet 20$. wähle gerade, ungerade oder die genaue zahl.",
    jp: "(1/3)\n俺のカジノへようこそ！サイコロ一回20ドル。奇数・偶数か、正確な数字を選んでね。",
    kr: "(1/3)\n내 카지노에 온 걸 환영해! 주사위 한 번에 20달러야. 홀짝이나 정확한 숫자 중에 골라.",
    zh: "(1/3)\n欢迎来到我的赌场！每次掷骰子花$20。你要选单双或具体数字。",
  },
  {
    en: "(2/3)\nIf you guess odd/even correctly, you'll double your money. If you guess a number correctly, you'll times your money by that amount.",
    es: "(2/3)\nSi aciertas par/impar, tu dinero se duplica. Si aciertas el número, se multiplica por esa cantidad.",
    pt: "(2/3)\nSe acertar par/ímpar, seu dinheiro dobra. Se acertar o número, ele multiplica por essa quantidade.",
    fr: "(2/3)\nSi tu devines pair/impair juste, ton argent double. Si tu devines le chiffre, il se multiplie par ce nombre.",
    de: "(2/3)\nrätst du gerade/ungerade richtig, verdoppelt sich dein geld. rätst du die zahl, multipliziert es sich damit.",
    jp: "(2/3)\n奇数・偶数が当たれば、お金は2倍に。数字が当たれば、その数字倍になるよ。",
    kr: "(2/3)\n홀짝을 맞히면 돈이 두 배가 돼. 숫자를 맞히면 그 숫자만큼 곱해지지.",
    zh: "(2/3)\n猜中单双，钱翻倍。猜中数字，钱就乘以那个数字。",
  },
  {
    en: "(3/3)\nIf you guess odd/even incorrectly, you'll half your money. If you guess a number incorrectly, you'll divide your money by that amount.",
    es: "(3/3)\nSi fallas par/impar, tu dinero se reduce a la mitad. Si fallas el número, se divide por esa cantidad.",
    pt: "(3/3)\nSe errar par/ímpar, seu dinheiro cai pela metade. Se errar o número, ele divide por essa quantidade.",
    fr: "(3/3)\nSi tu te trompes de pair/impair, ton argent est réduit de moitié. Faux chiffre, il se divise par ce nombre.",
    de: "(3/3)\nliegst du bei gerade/ungerade falsch, halbiert sich dein geld. bei falscher zahl, teilt es sich durch sie.",
    jp: "(3/3)\n奇数・偶数を外すと、お金は半分に。数字を外すと、その数字で割られるよ。",
    kr: "(3/3)\n홀짝을 틀리면 돈이 반으로 줄어. 숫자를 틀리면 그 숫자로 나눠지지.",
    zh: "(3/3)\n猜错单双，钱减半。猜错数字，钱就除以那个数字。",
  },
];

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
    return "[" + base + "]" + MARK_DIM + name.slice(base.length) + MARK_RESET;
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

async function guessRound() {
  let guess;
  for (;;) {
    guess = (await read("Type [odd], [even], [1], [2], [3], [4], [5], or [6]: ", false, false))
      .trim()
      .toLowerCase();
    if (!pc.on) return null;
    if (CASINO_GUESSES.indexOf(guess) !== -1) break;
    await type("...");
    await type("try again.");
    await type("");
  }
  await type("");
  const dice = pickOne(6);
  await type("You guessed " + guess + " and the dice was " + dice + ".");
  await type("");
  const n = parseInt(guess, 10);
  return { won: n ? dice === n : (guess === "odd") === (dice % 2 === 1), n };
}

async function casinoBankrupt() {
  const short = CASINO_ROLL_COST - game.casinoMoney;
  await type("You're $" + short + " short...");
  await type("");
  const gamble = await read("Gamble your save data to win $100? ([Y]/[N]): ", false, false);
  if (!pc.on) return;
  await type("");
  if (gamble.trim().toLowerCase().charAt(0) !== "y") return;

  await type("You currently have -$" + short);
  await type("");
  const round = await guessRound();
  if (!round) return;

  if (round.won) {
    game.casinoMoney = CASINO_START;
    saveGame();
    await type("You won! Here's your $100 back.");
    await type("");
    return;
  }

  await type("You lost. Your save data is gone.");
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch (e) {}
  location.reload();
}

async function play() {
  await type("");
  if (game.casinoMoney >= CASINO_ROLL_COST) {
    if (game.casinoVisited) {
      await type("Welcome back to my casino!");
      await type("");
      const again = await read("Read the rules again? ([Y]/[N]): ", false, false);
      if (!pc.on) return;
      await type("");
      if (again.trim().toLowerCase().charAt(0) === "y") await paginate(CASINO_RULES.map(langText));
    } else {
      await paginate(CASINO_RULES.map(langText));
    }
  }
  game.casinoVisited = true;
  saveGame();

  let first = true;
  while (pc.on) {
    if (game.casinoMoney < CASINO_ROLL_COST) {
      await casinoBankrupt();
      if (game.casinoMoney < CASINO_ROLL_COST) return;
      continue;
    }

    await type("You currently have $" + game.casinoMoney);
    await type("");
    const again = await read(
      (first ? "Roll the dice" : "Play again") + "? ([Y]/[N]): ",
      false,
      false
    );
    if (!pc.on) return;
    first = false;
    await type("");
    if (again.trim().toLowerCase().charAt(0) !== "y") {
      await type("You cashed out $" + game.casinoMoney + ".");
      await type("");
      await type("See ya next time!");
      await type("");
      if (game.casinoMoney - CASINO_START > CASINO_PROFIT_GOAL) award("stonks");
      return;
    }

    game.casinoMoney -= CASINO_ROLL_COST;
    saveGame();
    await type("You currently have $" + game.casinoMoney);
    await type("");

    const round = await guessRound();
    if (!round) return;
    // the $20 stake is just a bind: a win refunds it, then doubles/timeses the whole total
    game.casinoMoney = round.won
      ? (game.casinoMoney + CASINO_ROLL_COST) * (round.n || 2)
      : Math.floor(game.casinoMoney / (round.n || 2));
    saveGame();

    await type(round.won ? "You won!" : "You lost.");
    await type("");
  }
}

async function open(base, command) {
  switch (base) {
    case "whoami":
      await paginate(WHOAMI_PAGES.map(langText));
      break;
    case "whatisthis":
      await paginate(WHATISTHIS_PAGES.map(langText));
      break;
    case "casino":
      await play();
      break;
    case "dog":
      window.open("/dog.png", "_blank");
      await type("opened [dog]" + MARK_DIM + ".png" + MARK_RESET + " in new tab");
      await type("");
      break;
    case "idklol":
      window.open("/idklol.mp4", "_blank");
      await type("opened [idklol]" + MARK_DIM + ".mp4" + MARK_RESET + " in new tab");
      await type("");
      break;
    case "secret": {
      await slow("...");
      await type("");
      await slow("elevated privileges required to view secret.txt");
      await type("");
      let authorized = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        const entry = await read("sudo password for temp: ", true, false);
        if (!pc.on) return;
        if (entry === PASSWORD) {
          authorized = true;
          break;
        }
        await type("Sorry, try again.");
      }
      if (!authorized) {
        await type("sudo: 3 incorrect password attempts");
        await type("");
        break;
      }
      if (beaten() >= achGoal(ACH[END])) {
        await paginate(SECRET_PAGES.map(langText));
      } else {
        await typeOut(langText(SECRET_LOCKED));
        await type("");
      }
      break;
    }
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
      await type(formatLs());
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
      pc.on = false;
      location.href = "about:blank";
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
  setLoop("pc", on);
  if (on) {
    runTerminal();
  } else {
    pc.mode = BUSY;
    pc.lineDone.resolve();
    pc.anyKey.resolve();
  }
}

function submitLine(value) {
  pc.entered = value;
  commit(pc.prompt + (pc.hidden ? "" : value));
  pc.line = "";
  pc.lineDone.resolve();
}

// raycasts the pointer against the terminal's own label mesh, in its canvas-pixel space
function terminalHitUV() {
  if (!pc.captured || !pc.on || !pc.label || !pc.label.mesh) return null;
  pointer.set(pointerX * 2 - 1, 1 - pointerY * 2);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(pc.label.mesh);
  return hits.length && hits[0].uv ? hits[0].uv : null;
}

function terminalLinkAt(uv) {
  if (!uv || pc.mode !== ASK) return null;
  const px = uv.x * pc.label.width;
  const py = (1 - uv.y) * pc.label.canvasHeight;
  return pc.label.hitLink(px, py);
}

// the bare "temp@temp ~$ " prompt (top-level, nothing typed yet) has no [link]
// of its own, but clicking it should still run help — keeps the whole game
// playable without a keyboard
function terminalPromptHit(uv) {
  if (!uv || pc.mode !== ASK || pc.prompt !== PROMPT || pc.buffer) return false;
  const py = (1 - uv.y) * pc.label.canvasHeight;
  const rows = Math.min(pc.out.length + 1, MAX_LINES);
  const rowTop = (rows - 1) * pc.label.height;
  return py >= rowTop && py < rowTop + pc.label.height;
}

function tryTerminalClick() {
  const uv = terminalHitUV();
  if (!uv) return;
  if (pc.mode === PAGE) {
    pc.anyKey.resolve();
    return;
  }
  if (terminalPromptHit(uv)) {
    submitLine("help");
    return;
  }
  const text = terminalLinkAt(uv);
  if (text != null) submitLine(text);
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
    let value = pc.buffer;
    if (pc.complete) {
      const hint = suggest();
      if (hint) value = clip(pc.prompt, hint);
    }
    submitLine(value);
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
const TV_FALLBACK_FPS = 4; // flip rate used only before the music has started playing
const TV_POSES_PER_BEAT = 2; // dance poses per beat
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
  casinoMoney: CASINO_START,
  casinoVisited: false,
  donateSeen: false,
  knowledge: {},
  plays: { before: 0, after: 0 },
  visits: 0,
};

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
  if (on) tvFrame = 0; // restart the loop in phase with the music
  setLoop("music", on);
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
    power(game.pcOn);
    if (game.pcOn) award("log-on");
    await textbox(game.pcOn ? "pc-off-yes" : "pc-on-yes");
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
  if (topic === "donate" && (!game.donateSeen || !game.coin)) {
    if (!game.donateSeen) {
      game.donateSeen = true;
      learn("donate-ask");
    }
    await textbox("plush-donate");
    return;
  }
  // "So without thinking, you squeeze [Marketable Plush] and the TV turns
  // on!" - line 3 of plush-remote; the tv should react right as that's read,
  // not after the whole exchange closes
  const onSqueeze =
    topic === "remote"
      ? {
          at: 3,
          fn: () => {
            setTv(true);
            saveGame();
            award("tv-on");
          },
        }
      : null;
  await textbox(
    "plush-" + (topic === "donate" ? "donate-coin" : topic),
    null,
    false,
    null,
    onSqueeze
  );
  learn(topic);
  if (topic === "guitar") {
    game.guitarLearned = true;
    saveGame();
    award("fast-learner");
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
  await ask(await choice("plush-topics", left));
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
  playSfx("wear");
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
  tooltip(isPanelOpen() ? null : id);
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
  // tv-frames.webp is an 8-pose dance loop - the frame index is elapsed
  // beats (x TV_POSES_PER_BEAT), not elapsed seconds. driven off the music's
  // own audio-clock position so it can't drift apart from what's actually
  // playing the way two independently-ticking clocks (rAF dt vs audio
  // hardware) would; only falls back to dt-stepping while the track itself
  // isn't playing yet (still loading, or blocked pending a user gesture)
  const musicT = loopTime("music");
  tvFrame =
    musicT == null
      ? (tvFrame + dt * TV_FALLBACK_FPS) % count
      : (musicT * (MUSIC_BPM / 60) * TV_POSES_PER_BEAT) % count;
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
  renderer.render(scene, camera);
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
  if (isPanelOpen() || isChoiceOpen()) return; // dom overlays own the cursor color while shown
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
  if (inBand) {
    zoneBack();
  } else if (pc.captured) {
    playSfx("select");
    tryTerminalClick();
  } else if (hoveredZone && !LOCKED[hoveredZone]) {
    playSfx("select");
    gotoZone(hoveredZone);
  } else if (hovered) {
    playSfx("select");
    onClicked(hovered);
  }
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
  if (pc.captured && !isPanelOpen()) {
    const uv = terminalHitUV();
    if (uv && (pc.mode === PAGE || terminalLinkAt(uv) != null || terminalPromptHit(uv)))
      setCursorRing(true);
  }
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
