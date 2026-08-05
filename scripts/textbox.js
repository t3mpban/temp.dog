// shared game <-> page api: script.json, textbox, choices, achievements, tooltip,
// loader and cursor feedback. index.html uses all of it, /the-end only the textbox.
// every element lookup is optional so the module is safe on a bare page.

export var fine = window.matchMedia("(pointer: fine)").matches;
export var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export var isMobile = !fine;

function el(id) {
  return document.getElementById(id);
}

// states
var KEY = "t3mp.settings";
export var LANGS = ["en", "es", "pt", "fr", "de", "jp", "kr", "zh"];
export var LANG_NAMES = {
  en: "english",
  es: "español",
  pt: "português",
  fr: "français",
  de: "deutsch",
  jp: "日本語",
  kr: "한국어",
  zh: "简体中文",
};
export var st = { music: 5, sounds: 5, lang: "en", ach: {} };

// snap volume to 0-10
export function clampVol(v) {
  return Math.min(10, Math.max(0, Math.round(v)));
}

try {
  var saved = JSON.parse(localStorage.getItem(KEY) || "{}");
  if (saved && typeof saved === "object") {
    // legacy 0-100 -> 0-10
    if (typeof saved.music === "number")
      st.music = clampVol(saved.music > 10 ? saved.music / 10 : saved.music);
    if (typeof saved.sounds === "number")
      st.sounds = clampVol(saved.sounds > 10 ? saved.sounds / 10 : saved.sounds);
    if (LANGS.indexOf(saved.lang) !== -1) st.lang = saved.lang;
    if (saved.ach && typeof saved.ach === "object") st.ach = saved.ach;
  }
} catch (e) {
  // keep defaults
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(st));
  } catch (e) {}
}

// language: detect, override cookie, translations
export var LANG_MANUAL_COOKIE = "t3mp.langManual";
var LANG_ALIASES = { ja: "jp", ko: "kr" }; // navigator codes differ
export var BCP47 = {
  en: "en",
  es: "es",
  pt: "pt",
  fr: "fr",
  de: "de",
  jp: "ja",
  kr: "ko",
  zh: "zh",
};
export var I18N = {}; // filled when script.json loads
export var DIALOGUE = {}; // textbox scripts, id -> array of { lang: text } lines
export var ACH = {}; // achievements, id -> { type, icon, goal, title, desc }
export var CHOICES = {}; // multiple choice sets, id -> array of { id, text }
export var TIPS = {}; // hover labels, id -> { lang: text }
var I18N_FALLBACK = {
  // baked-in fallback
  "settings-title": "settings",
  "label-music": "music",
  "label-sounds": "sound",
  "label-fullscreen": "fullscreen",
  "label-language": "language",
  "label-achievements": "achievements",
  "label-close": "close",
  "label-cache": "clear cache",
  "label-cache-confirm": "click again to confirm",
  "label-legacy": "legacy website",
  "state-on": "on",
  "state-off": "off",
  "small-text": "made by t3mp",
  "notice-translation": "Translations are automatically generated and may be inaccurate.",
};

export function getCookie(name) {
  var esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  var m = document.cookie.match(new RegExp("(?:^|; )" + esc + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}
export function setCookie(name, value, days) {
  var expires = new Date(Date.now() + days * 86400000).toUTCString();
  document.cookie =
    name + "=" + encodeURIComponent(value) + "; expires=" + expires + "; path=/; SameSite=Lax";
}
export function deleteCookie(name) {
  document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
}

// languages[0] first, language fallback
export function detectLang() {
  var candidates = (navigator.languages || []).concat(navigator.language || []);
  for (var i = 0; i < candidates.length; i++) {
    var tag = (candidates[i] || "").toLowerCase().split("-")[0];
    var code = LANG_ALIASES[tag] || tag;
    if (LANGS.indexOf(code) !== -1) return code;
  }
  return null;
}

// auto-detect only if no manual pick (cookie wins)
if (getCookie(LANG_MANUAL_COOKIE) !== "1") {
  var detected = detectLang();
  if (detected) st.lang = detected;
}

export function t(id) {
  var entry = I18N[id];
  if (entry && entry[st.lang]) return entry[st.lang];
  if (entry && entry.en) return entry.en;
  return I18N_FALLBACK[id] || "";
}

// resolve a { lang: text } map for the active language, english fallback
export function langText(map) {
  return (map && (map[st.lang] || map.en)) || "";
}

// [{ lang, text }, ...] -> { lang: text }
export function toLangMap(arr) {
  var map = {};
  if (arr) for (var i = 0; i < arr.length; i++) map[arr[i].lang] = arr[i].text;
  return map;
}

// translations + dialogue in external file
// shape: { ui: [...], dialogue: [...] }; plain array tolerated as ui-only
function loadScript() {
  return fetch("/scripts/script.json")
    .then(function (res) {
      return res.json();
    })
    .then(function (data) {
      var uiList = Array.isArray(data) ? data : (data && data.ui) || [];
      uiList.forEach(function (entry) {
        I18N[entry.id] = toLangMap(entry.strings);
      });
      var tipList = (data && data.tooltips) || [];
      tipList.forEach(function (entry) {
        TIPS[entry.id] = toLangMap(entry.strings);
      });
      var dlgList = (data && data.dialogue) || [];
      dlgList.forEach(function (entry) {
        DIALOGUE[entry.id] = (entry.lines || []).map(toLangMap);
      });
      var achList = (data && data.achievements) || [];
      achList.forEach(function (entry) {
        ACH[entry.id] = {
          type: entry.type || "normal",
          icon: entry.icon || "fa-trophy",
          goal: entry.goal || 0,
          title: toLangMap(entry.title),
          desc: toLangMap(entry.desc),
        };
      });
      var choiceList = (data && data.choices) || [];
      choiceList.forEach(function (entry) {
        CHOICES[entry.id] = (entry.options || []).map(function (opt, i) {
          return { id: opt.id == null ? i : opt.id, text: toLangMap(opt.text) };
        });
      });
    })
    .catch(function (e) {}); // fallback to baked-in
}

// one fetch shared by every importer
export var ready = loadScript();

// cubic-bezier(x1,y1,x2,y2) -> y for x, newton with a bisection fallback.
// shared by the game's camera eases and the textbox pop-in timing below.
export function cubicBezier(x1, y1, x2, y2) {
  var cx = 3 * x1,
    bx = 3 * (x2 - x1) - cx,
    ax = 1 - cx - bx;
  var cy = 3 * y1,
    by = 3 * (y2 - y1) - cy,
    ay = 1 - cy - by;
  function sx(t) {
    return ((ax * t + bx) * t + cx) * t;
  }
  function sy(t) {
    return ((ay * t + by) * t + cy) * t;
  }
  function dx(t) {
    return (3 * ax * t + 2 * bx) * t + cx;
  }
  return function (x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    var t = x,
      i,
      e,
      d;
    for (i = 0; i < 8; i++) {
      e = sx(t) - x;
      if (Math.abs(e) < 1e-4) return sy(t);
      d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    // newton stalled, fall back to bisection
    var lo = 0,
      hi = 1;
    t = x;
    while (hi - lo > 1e-5) {
      var xx = sx(t);
      if (Math.abs(xx - x) < 1e-4) break;
      if (xx < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}

// ----- audio -----
// how many text.ogg blips can overlap at once (tweak to taste)
var TEXT_POOL_SIZE = 3;
// per-character pitch spread: playbackRate is randomized in [1-RANGE, 1+RANGE]
var TEXT_PITCH_RANGE = 0.35;

// one-shot sfx: never overlaps itself (or, for a shared `group`, any other
// sound in that group), plays at DEF.vol * its bus (0-1). `pool` lets N
// instances overlap each other before new plays start getting ignored.
// vol levels are ear-balanced against each file's measured loudness
// (ffmpeg volumedetect mean_volume) so the default mix has music as the
// most prominent layer and frequent/short sfx (hover, typing) sit well
// under it rather than competing with it
var SFX_DEFS = {
  hover: { file: "hover.ogg", vol: 0.15, bus: "sounds", group: "hover" },
  unhover: { file: "unhover.ogg", vol: 0.15, bus: "sounds", group: "hover" },
  textboxenter: { file: "textboxenter.ogg", vol: 0.25, bus: "sounds" },
  textboxleave: { file: "textboxleave.ogg", vol: 0.25, bus: "sounds" },
  zoomin: { file: "zoomin.ogg", vol: 0.6, bus: "sounds" },
  zoomout: { file: "zoomout.ogg", vol: 0.4, bus: "sounds" },
  select: { file: "select.ogg", vol: 0.3, bus: "sounds" },
  text: { file: "text.ogg", vol: 0.25, bus: "sounds", pool: TEXT_POOL_SIZE },
  wear: { file: "wear.ogg", vol: 0.6, bus: "sounds" },
  achievement: { file: "achievement.ogg", vol: 0.85, bus: "sounds" },
};

// sustained ambience: setLoop(name, true/false) turns it on/off, volume
// tracks its bus live. played through Web Audio (not <audio loop>) so the
// ogg loops sample-accurately, with no seam between the end and the restart
var LOOP_DEFS = {
  pc: { file: "pc.ogg", vol: 0.2, bus: "sounds" },
  music: { file: "music.ogg", vol: 3, bus: "music" },
};

// music.ogg's tempo - game.js derives the tv dance-loop's frame from it.
// keep in sync with whatever the track actually is if it ever changes.
export var MUSIC_BPM = 90;

var sfxBuffers = {}; // name -> decoded AudioBuffer, once loaded
var sfxPlaying = {}; // name -> count of currently active source nodes

function loadSfxBuffer(name) {
  fetch("/sounds/" + SFX_DEFS[name].file)
    .then(function (res) {
      return res.arrayBuffer();
    })
    .then(function (data) {
      return ctx().decodeAudioData(data);
    })
    .then(function (buffer) {
      sfxBuffers[name] = buffer;
    })
    .catch(function () {});
}

for (var sfxName in SFX_DEFS) {
  sfxPlaying[sfxName] = 0;
  loadSfxBuffer(sfxName);
}

function groupBusy(group) {
  for (var n in SFX_DEFS) {
    if (SFX_DEFS[n].group === group && sfxPlaying[n] > 0) return true;
  }
  return false;
}

function busVol(bus) {
  return (bus === "music" ? st.music : st.sounds) / 10;
}

function tryPlay(a) {
  try {
    var p = a.play();
    if (p && p.catch) p.catch(function () {});
  } catch (e) {}
}

// play a named one-shot; ignored if that sound (or another in its group,
// e.g. hover/unhover) is already playing, or its pool is fully busy.
// rate (optional) sets playbackRate, e.g. for per-character pitch variance
export function playSfx(name, rate) {
  var def = SFX_DEFS[name];
  var buffer = sfxBuffers[name];
  if (!def || !buffer) return;
  var v = busVol(def.bus);
  if (!v) return;
  if (def.group && groupBusy(def.group)) return;
  var poolSize = def.pool || 1;
  if (sfxPlaying[name] >= poolSize) return;

  resumeCtx();
  var src = ctx().createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = rate || 1;
  var gain = ctx().createGain();
  gain.gain.value = def.vol * v;
  src.connect(gain).connect(loopDestination());
  sfxPlaying[name]++;
  src.onended = function () {
    sfxPlaying[name]--;
    src.disconnect();
    gain.disconnect();
  };
  src.start(0);
}

// ----- loop sounds (pc hum, tv theme), via Web Audio for gapless looping -----
var audioCtx = null;
function ctx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

// routed through a real <audio> element (via a MediaStreamDestination)
// rather than straight to ctx().destination: on iOS, plain Web Audio output
// ignores the phone's physical mute/silent switch, but audio played through
// an HTMLMediaElement respects it. Shared by the sfx pool above too.
var loopDest = null;
var loopOutputEl = null;
function loopDestination() {
  if (!loopDest) {
    loopDest = ctx().createMediaStreamDestination();
    loopOutputEl = new Audio();
    loopOutputEl.srcObject = loopDest.stream;
  }
  return loopDest;
}

var loopBuffers = {}; // name -> decoded AudioBuffer, once loaded
var loopGains = {}; // name -> GainNode, persistent
var loopSources = {}; // name -> currently playing AudioBufferSourceNode or null
var loopStarted = {}; // name -> ctx().currentTime when it was started
var loopWanted = {}; // name -> whether it should be playing

function loadLoop(name) {
  fetch("/sounds/" + LOOP_DEFS[name].file)
    .then(function (res) {
      return res.arrayBuffer();
    })
    .then(function (data) {
      return ctx().decodeAudioData(data);
    })
    .then(function (buffer) {
      loopBuffers[name] = buffer;
      if (loopWanted[name]) startLoopSource(name);
    })
    .catch(function () {});
}

for (var loopName in LOOP_DEFS) {
  loopWanted[loopName] = false;
  loopGains[loopName] = ctx().createGain();
  loopGains[loopName].connect(loopDestination());
  loadLoop(loopName);
}

function stopLoopSource(name) {
  var src = loopSources[name];
  if (!src) return;
  try {
    src.stop();
  } catch (e) {}
  src.disconnect();
  loopSources[name] = null;
  loopStarted[name] = null;
}

// starts a fresh BufferSourceNode from 0; sample-accurate loop, no restart gap
function startLoopSource(name) {
  var buffer = loopBuffers[name];
  if (!buffer) return; // not decoded yet; loadLoop() picks this up once ready
  stopLoopSource(name);
  var src = ctx().createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.connect(loopGains[name]);
  src.start(0);
  loopSources[name] = src;
  loopStarted[name] = ctx().currentTime;
}

// seconds elapsed within the loop right now, read straight off the audio
// clock so a caller can derive an animation frame that can never drift from
// it (two independently-ticking clocks - rAF dt and the audio hardware -
// will always creep apart over a long loop; deriving from one clock can't).
// null if the loop isn't currently playing (not started yet, still loading).
export function loopTime(name) {
  var buffer = loopBuffers[name];
  var startedAt = loopStarted[name];
  if (!buffer || !loopSources[name] || startedAt == null) return null;
  return (ctx().currentTime - startedAt) % buffer.duration;
}

// resume the (possibly gesture-gated) audio context and the loop output
// element on the first interaction - both need a user gesture to start
function resumeCtx() {
  if (ctx().state === "suspended")
    ctx()
      .resume()
      .catch(function () {});
  if (loopOutputEl && loopOutputEl.paused) tryPlay(loopOutputEl);
}
document.addEventListener("pointerdown", resumeCtx);
document.addEventListener("keydown", resumeCtx);
document.addEventListener("touchstart", resumeCtx);

function syncLoopVolume(name) {
  var def = LOOP_DEFS[name];
  loopGains[name].gain.value = def.vol * busVol(def.bus);
}

// starts/stops a named loop (pc hum, tv theme); starting always restarts
// from 0 so it can be kept in phase with whatever it's tied to
export function setLoop(name, on) {
  if (!LOOP_DEFS[name]) return;
  loopWanted[name] = on;
  if (on) {
    resumeCtx();
    startLoopSource(name);
  } else {
    stopLoopSource(name);
  }
  syncLoopVolume(name);
}

// re-applies the music/sounds sliders to any currently active loop (gain
// only - never restarts a loop, so a slider drag can't desync it), call
// after either changes
export function syncLoopVolumes() {
  for (var name in LOOP_DEFS) syncLoopVolume(name);
}

// ----- cursor + tooltip -----
var cursor = el("cursor");
var tip = el("tip");
var bubble = tip && tip.querySelector(".bubble");
var tipTimer = null;
var tipLoader = false; // loader owns the bubble, so it may keep repainting it

export function showCursor() {
  if (cursor) cursor.classList.remove("hide");
}

export function setCursorRing(on) {
  if (cursor) cursor.classList.toggle("ring", !!on);
}

export function setCursorDark(on) {
  if (cursor) cursor.classList.toggle("dark", !!on);
}

// settings / achievements panel: 3D camera lookAt and tooltips pause while either is open
var panelOpen = false;

export function setPanelOpen(on) {
  panelOpen = !!on;
}

export function isPanelOpen() {
  return panelOpen;
}

function showTip(text) {
  clearTimeout(tipTimer);
  if (!tip) return;
  bubble.textContent = text;
  tip.classList.add("show");
}

function hideTip() {
  clearTimeout(tipTimer);
  tipLoader = false;
  if (tip) tip.classList.remove("show");
}

// tooltip("text") sets the bubble, tooltip() / tooltip(null) unsets it
export function tooltip(text) {
  if (text == null || text === "") hideTip();
  else showTip(langText(TIPS[text]) || String(text));
}

// ----- loading bar -----
// setLoadProgress(0..1) drives the bar; hitting 1 fades the loader and grows
// the screen in behind it
var loaderWrap = el("loaderWrap");
var loader = el("loader");
var fill = el("fill");
var screenEl = el("screen");
var pct = 0;
var loadDone = false;

export function setLoadProgress(p) {
  if (loadDone || !loader) return;
  p = Math.max(0, Math.min(p, 1));
  pct = Math.round(p * 100);
  fill.style.width = p * 100 + "%";
  loader.setAttribute("aria-valuenow", String(pct));
  if (tipLoader) bubble.textContent = pct + "%";
  if (p < 1) return;
  loadDone = true;
  hideTip();
  setTimeout(function () {
    loaderWrap.classList.add("done");
    // reveal screen as loader fades
    if (screenEl) screenEl.classList.add("show");
    setTimeout(function () {
      loaderWrap.style.display = "none";
    }, 750);
  }, 350);
}

if (fine && loader) {
  loader.addEventListener("pointerenter", function () {
    if (loadDone) return;
    tipTimer = setTimeout(function () {
      tipLoader = true;
      showTip(pct + "%");
    }, 200);
  });
  loader.addEventListener("pointerleave", hideTip);
}

// ----- visual-novel textbox -----
// textbox("ref") pulls DIALOGUE[ref] from script.json and types each line out.
// exposed on window so the webgl game can drive it; returns a promise that
// settles once the whole sequence is dismissed.
var tb = el("textbox");
var tbText = el("textboxText");
var tbNext = el("textboxNext");

// reveal is linear: one character every TB_MS_PER_CHAR, no clamping
var TB_MS_PER_CHAR = 30;
var TB_POP_MS = 500; // appear (scale-in); keep in sync with --t-pop
var TB_OUT_MS = 600; // dismiss (scale-out); keep in sync with .textbox transition
// extra dwell after punctuation (latin + cjk)
var TB_PAUSE = {
  ",": 160,
  ";": 160,
  ":": 160,
  "—": 220,
  ".": 320,
  "!": 340,
  "?": 340,
  "…": 360,
  "、": 160,
  "，": 160,
  "；": 160,
  "。": 320,
  "！": 340,
  "？": 340,
};

var tbActive = false; // a dialogue is showing
var tbTyping = false; // current line still revealing
var tbLines = null; // array of lang-maps for the current dialogue
var tbVars = {}; // {name} substitutions for the current dialogue
var tbIdx = 0; // current line index
var tbFull = ""; // resolved text of the current line
var tbShown = 0; // chars revealed so far
var tbClock = 0; // reveal time consumed (excludes punctuation holds)
var tbHold = 0; // timestamp to resume after a punctuation pause
var tbLast = 0; // last frame time
var tbRAF = 0;
var tbResolve = null; // resolver for the promise textbox() handed back
var tbHideTimer = null;
var tbStartTimer = null; // delays the first line until the box has popped in
var tbHoldOpen = false;
var tbOnLastLine = null;
var tbOnLine = null; // { at: lineIndex, fn } - fires when that line starts
var tbJustOpened = false; // true for the rest of the click/key that opened this textbox

export function isTextboxOpen() {
  return tbActive;
}

export function closeTextbox() {
  if (tbActive) tbHide();
}

function tbShow() {
  clearTimeout(tbHideTimer);
  tb.removeAttribute("inert");
  tb.removeAttribute("aria-hidden");
  void tb.offsetWidth; // reflow so a quick hide->show still pops
  tb.classList.add("show");
}

function tbHide() {
  playSfx("textboxleave");
  tbActive = false;
  tbTyping = false;
  clearTimeout(tbStartTimer);
  tbStartTimer = null;
  if (tbRAF) cancelAnimationFrame(tbRAF);
  tbRAF = 0;
  tbNext.classList.remove("show");
  tb.classList.remove("show"); // scale back down to 0
  // wait out the pop before pulling it from tab order + the a11y tree
  tbHideTimer = setTimeout(function () {
    if (!tbActive) {
      tb.setAttribute("inert", "");
      tb.setAttribute("aria-hidden", "true");
      tbText.textContent = "";
    }
  }, TB_OUT_MS);
  var done = tbResolve;
  tbResolve = null;
  if (done) done();
}

function tbFinishLine() {
  tbTyping = false;
  if (tbRAF) cancelAnimationFrame(tbRAF);
  tbRAF = 0;
  tbShown = tbFull.length;
  tbText.textContent = tbFull;
  if (tbHoldOpen && tbIdx === tbLines.length - 1) {
    var done = tbResolve;
    tbResolve = null;
    if (done) done();
    return;
  }
  tbNext.classList.add("show");
}

function tbType(now) {
  var dt = now - tbLast;
  tbLast = now;
  if (dt > 100) dt = 100; // clamp after a stall
  if (now >= tbHold) tbClock += dt;
  var target = Math.min(tbFull.length, Math.floor(tbClock / TB_MS_PER_CHAR));
  if (target > tbShown) {
    tbShown = target;
    tbText.textContent = tbFull.slice(0, tbShown);
    playSfx("text", 1 - TEXT_PITCH_RANGE + Math.random() * TEXT_PITCH_RANGE * 2);
    // hold a beat on punctuation (but never at the very end)
    if (tbShown < tbFull.length) {
      var pause = TB_PAUSE[tbFull.charAt(tbShown - 1)];
      if (pause) tbHold = now + pause;
    }
  }
  if (tbShown >= tbFull.length) {
    tbFinishLine();
    return;
  }
  tbRAF = requestAnimationFrame(tbType);
}

function tbStartLine() {
  tbFull = langText(tbLines[tbIdx]).replace(/\{(\w+)\}/g, function (whole, key) {
    return key in tbVars ? tbVars[key] : whole;
  });
  tbShown = 0;
  tbText.textContent = "";
  tbNext.classList.remove("show");
  if (tbOnLastLine && tbIdx === tbLines.length - 1) {
    var onLast = tbOnLastLine;
    tbOnLastLine = null;
    onLast();
  }
  if (tbOnLine && tbIdx === tbOnLine.at) {
    var onLine = tbOnLine.fn;
    tbOnLine = null;
    onLine();
  }
  // reduced motion (or an empty line): skip the typewriter, just show it
  if (reduce || !tbFull) {
    tbFinishLine();
    return;
  }
  tbClock = 0;
  tbHold = 0;
  tbTyping = true;
  tbLast = performance.now();
  tbRAF = requestAnimationFrame(tbType);
}

// click/tap (or enter/space) skips the reveal, then advances to the next line
function tbAdvance() {
  if (!tbActive || choiceResolve) return;
  // still popping in -> begin the first line now instead of waiting it out
  if (tbStartTimer) {
    clearTimeout(tbStartTimer);
    tbStartTimer = null;
    tbStartLine();
    return;
  }
  if (tbTyping) {
    tbFinishLine();
    return;
  }
  tbIdx++;
  if (tbIdx < tbLines.length) tbStartLine();
  else tbHide();
}

export function textbox(ref, vars, hold, onLastLine, onLine) {
  var lines = DIALOGUE[ref];
  if (!lines || !lines.length || !tb) {
    if (window.console) console.warn('textbox: no dialogue for "' + ref + '"');
    return Promise.resolve();
  }
  // interrupt anything in flight and settle its promise first
  if (tbResolve) {
    var prev = tbResolve;
    tbResolve = null;
    prev();
  }
  clearTimeout(tbStartTimer);
  tbStartTimer = null;
  if (tbRAF) cancelAnimationFrame(tbRAF);
  tbRAF = 0;
  tbLines = lines;
  tbVars = vars || {};
  tbIdx = 0;
  tbHoldOpen = !!hold;
  tbOnLastLine = onLastLine || null;
  tbOnLine = onLine || null;
  var wasShown = tb.classList.contains("show");
  tbActive = true;
  // the click/key that opened this textbox bubbles to the document-level
  // advance listeners below within the same dispatch; ignore it there so it
  // can't immediately skip the pop-in wait it just started
  tbJustOpened = true;
  setTimeout(function () {
    tbJustOpened = false;
  }, 0);
  if (!wasShown) playSfx("textboxenter");
  tbShow();
  if (reduce || wasShown) {
    // already on screen (or motion reduced): type the first line right away
    tbStartLine();
  } else {
    // wait for the pop-in to finish before typing starts
    tbText.textContent = "";
    tbNext.classList.remove("show");
    tbStartTimer = setTimeout(function () {
      tbStartTimer = null;
      tbStartLine();
    }, TB_POP_MS);
  }
  return new Promise(function (res) {
    tbResolve = res;
  });
}

if (tb) {
  // anywhere on the page advances, except the other interactive chrome
  document.addEventListener("pointerdown", function (e) {
    if (!tbActive || choiceResolve || tbJustOpened) return;
    if (e.target.closest && e.target.closest(".settings, .achv, .dim, .choices, .zone-back"))
      return;
    e.preventDefault();
    playSfx("select");
    tbAdvance();
  });

  // enter/space advance too, unless focus is on a settings control
  document.addEventListener("keydown", function (e) {
    if (!tbActive || choiceResolve || tbJustOpened) return;
    if (e.key !== "Enter" && e.key !== " ") return;
    var settings = el("settings");
    if (document.activeElement && settings && settings.contains(document.activeElement)) return;
    e.preventDefault();
    tbAdvance();
  });
}

// ----- multiple choice -----
// choice("pc-on") pulls a set from script.json; choice(["yes","no"]) takes a
// literal list. 2-4 options, stacked + centred above the textbox. resolves to
// the picked option's id (or its index when the option has none).
var choicesEl = el("choices");
var CHOICE_OUT_MS = 350; // keep in sync with .choice transition
var choiceResolve = null;
var choiceHideTimer = null;
var choiceRAF = 0;

export function isChoiceOpen() {
  return !!choiceResolve;
}

// stack sits between the viewport top and the textbox top
export function choicePosition() {
  if (!choicesEl) return;
  var top = tb && tb.classList.contains("show") ? tb.getBoundingClientRect().top : innerHeight;
  choicesEl.style.height = Math.max(0, top) + "px";
}

// the textbox height moves while it pops in / wraps, so keep re-centring
function choiceTrack() {
  if (!choiceResolve) {
    choiceRAF = 0;
    return;
  }
  choicePosition();
  choiceRAF = requestAnimationFrame(choiceTrack);
}

function choiceSettle(value) {
  var done = choiceResolve;
  choiceResolve = null;
  showCursor();
  choicesEl.classList.remove("show");
  choicesEl.setAttribute("inert", "");
  choiceHideTimer = setTimeout(function () {
    if (!choiceResolve) {
      choicesEl.hidden = true;
      choicesEl.textContent = "";
    }
  }, CHOICE_OUT_MS);
  if (done) done(value);
}

// single source of truth for which option is "active" (hover, keyboard
// focus, and arrow keys before anything has focus all funnel into this)
var choiceBtns = [];
var choiceActiveBtn = null;

function choiceSetActive(btn) {
  if (btn === choiceActiveBtn) return;
  if (choiceActiveBtn) choiceActiveBtn.classList.remove("active");
  choiceActiveBtn = btn;
  btn.classList.add("active");
  btn.focus({ preventScroll: true });
}

function choiceFocusAt(i) {
  if (i < 0) i = choiceBtns.length - 1;
  if (i >= choiceBtns.length) i = 0;
  choiceSetActive(choiceBtns[i]);
}

document.addEventListener("keydown", function (e) {
  if (!choiceResolve || choiceActiveBtn) return;
  switch (e.key) {
    case "ArrowDown":
    case "ArrowRight":
    case "ArrowUp":
    case "ArrowLeft":
      e.preventDefault();
      choiceFocusAt(0);
      break;
  }
});

export function choice(list, only) {
  var opts = typeof list === "string" ? CHOICES[list] : list;
  if (opts && only && only.length) {
    opts = opts.filter(function (opt) {
      return only.indexOf(opt.id) !== -1;
    });
  }
  if (!choicesEl || !opts || opts.length < 1 || opts.length > 4) {
    if (window.console) console.warn("choice: needs 1-4 options");
    return Promise.resolve(null);
  }
  // interrupt anything in flight and settle its promise first
  if (choiceResolve) choiceSettle(null);
  clearTimeout(choiceHideTimer);
  choicesEl.textContent = "";
  choiceBtns = [];
  choiceActiveBtn = null;

  opts.forEach(function (opt, i) {
    var value = opt && opt.id != null ? opt.id : i;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "choice cursorable";
    var inner = document.createElement("span");
    inner.className = "choice-inner";
    inner.textContent = typeof opt === "string" ? opt : langText(opt.text || opt);
    btn.appendChild(inner);
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      playSfx("select");
      choiceSettle(value);
    });
    // hover takes over keyboard focus too, so enter/space always picks
    // whichever option the pointer is actually over
    btn.addEventListener("pointerenter", function () {
      choiceSetActive(btn);
    });
    btn.addEventListener("focus", function () {
      choiceSetActive(btn);
    });
    btn.addEventListener("keydown", function (e) {
      switch (e.key) {
        case "ArrowDown":
        case "ArrowRight":
          e.preventDefault();
          choiceFocusAt(choiceBtns.indexOf(btn) + 1);
          break;
        case "ArrowUp":
        case "ArrowLeft":
          e.preventDefault();
          choiceFocusAt(choiceBtns.indexOf(btn) - 1);
          break;
      }
    });
    choiceBtns.push(btn);
    choicesEl.appendChild(btn);
  });

  choicesEl.hidden = false;
  choicesEl.removeAttribute("inert");
  choicePosition();
  void choicesEl.offsetWidth; // commit the collapsed state before the pop
  choicesEl.classList.add("show");

  return new Promise(function (res) {
    choiceResolve = res;
    if (!choiceRAF) choiceRAF = requestAnimationFrame(choiceTrack);
  });
}

window.addEventListener("resize", choicePosition);

// ----- achievement toast -----
// achievement("id") pops an xbox-360-style toast down from the top. progress
// achievements take the current value: achievement("explorer", 3) -> 3 / 5.
// overlapping calls queue and play one at a time.
var ach = el("ach");
var achIcon = ach && el("achIcon").querySelector("i");
var achTitle = el("achTitle");
var achDesc = el("achDesc");
var achBar = el("achBar");
var achBarFill = el("achBarFill");
var achBarNum = el("achBarNum");

var ACH_SLIDE_MS = 500; // keep in sync with .ach transition
var ACH_HOLD_MS = 4200; // time spent fully on screen

var achQueue = [];
var achBusy = false;
var achTimer = null;
var achFill = 0; // pending bar target, applied after the slide-in starts
var achWatchers = [];

export function onAchievementChange(fn) {
  achWatchers.push(fn);
}

function achRender(a, value) {
  achIcon.className = "fa-solid " + a.icon;
  achTitle.textContent = langText(a.title);
  achDesc.textContent = langText(a.desc);
  if (a.type === "progress") {
    var goal = a.goal || 0;
    var x = value == null ? goal : value;
    if (x < 0) x = 0;
    if (goal && x > goal) x = goal;
    achBarNum.textContent = x + " / " + goal;
    achFill = goal > 0 ? (x / goal) * 100 : 0;
    achBarFill.style.width = "0%"; // reset so it animates up each time
    achBar.hidden = false;
  } else {
    achBar.hidden = true;
  }
}

function achNext() {
  if (!achQueue.length) {
    achBusy = false;
    return;
  }
  achBusy = true;
  var job = achQueue.shift();
  achRender(job.a, job.value);
  void ach.offsetWidth; // commit the reset state before sliding in
  ach.classList.add("show");
  playSfx("achievement");
  if (!achBar.hidden) {
    // let the 0% commit, then grow the bar
    requestAnimationFrame(function () {
      achBarFill.style.width = achFill + "%";
    });
  }
  achTimer = setTimeout(function () {
    ach.classList.remove("show"); // slide back up
    achTimer = setTimeout(achNext, ACH_SLIDE_MS);
  }, ACH_HOLD_MS);
}

// normal achievements are 0/1, progress ones 0..goal
export function achGoal(a) {
  return a && a.type === "progress" ? a.goal || 0 : 1;
}

export function achValue(id) {
  var v = st.ach[id];
  return typeof v === "number" ? v : 0;
}

export function achDone(id, a) {
  var goal = achGoal(a || ACH[id]);
  return goal > 0 && achValue(id) >= goal;
}

// records progress, then toasts only when it actually moved forward
export function achievement(ref, value) {
  var a = ACH[ref];
  if (!a) {
    if (window.console) console.warn('achievement: unknown id "' + ref + '"');
    return;
  }
  var goal = achGoal(a);
  var next = value == null ? goal : value;
  if (next < 0) next = 0;
  if (goal && next > goal) next = goal;
  if (next <= achValue(ref)) return;
  st.ach[ref] = next;
  save();
  achWatchers.forEach(function (fn) {
    fn(ref, next);
  });
  if (!ach || (a.type === "progress" && next < goal)) return;
  achQueue.push({ a: a, value: next });
  if (!achBusy) achNext();
}

window.textbox = textbox;
window.choice = choice;
window.achievement = achievement;
window.tooltip = tooltip;
