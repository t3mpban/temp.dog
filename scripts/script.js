(function () {
  "use strict";

  // constants
  var CURSOR_TAU = 0.1; // higher = heavier
  var TIP_TAU = 0.2; // tip tighter than dot
  var VEL_TAU = 0.1; // thin/fat settle speed
  var CURSOR_VEL_REF = 1800; // px/sec = velocity 1
  var CURSOR_THIN_MAX = 0.4; // max height shrink
  var CURSOR_WIDE_MAX = 0.4; // max width grow
  var LOAD_DURATION = 500; // fake load time
  var TIP_DELAY = 200; // hover before tip
  var GEAR_STEP = 60; // cog nudge per hover

  // parallax: layers nudged by velocity, bounce home
  var PARALLAX_REF = 2500; // px/sec = full nudge
  var PARALLAX_MG = 5; // mid layer bounce px
  var PARALLAX_FG = 10; // fg bounce px (less)
  var PARALLAX_K = 100; // spring stiffness
  var PARALLAX_D = 20; // damping for bounce

  var fine = window.matchMedia("(pointer: fine)").matches;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) {
    CURSOR_TAU = 0.02;
    CURSOR_THIN_MAX = 0;
    CURSOR_WIDE_MAX = 0;
  }

  // elements
  var html = document.documentElement;
  var cursor = document.getElementById("cursor");
  var cursorDot = cursor.querySelector(".cursor-dot");
  var tip = document.getElementById("tip");
  var bubble = tip.querySelector(".bubble");
  var fpsEl = document.getElementById("fps");
  var screenEl = document.getElementById("screen");
  var loaderWrap = document.getElementById("loaderWrap");
  var loader = document.getElementById("loader");
  var fill = document.getElementById("fill");
  var sig = document.querySelector(".sig");
  var settings = document.getElementById("settings");
  var panel = settings.querySelector(".panel");
  var gear = document.getElementById("gear");
  var music = document.getElementById("music");
  var sfxHover = document.getElementById("sfxHover");
  var sfxSelect = document.getElementById("sfxSelect");

  // states
  var KEY = "t3mp.settings";
  var LANGS = ["en", "es", "pt", "fr", "de", "jp", "kr", "zh"];
  var LANG_NAMES = {
    en: "english",
    es: "español",
    pt: "português",
    fr: "français",
    de: "deutsch",
    jp: "日本語",
    kr: "한국어",
    zh: "简体中文",
  };
  var st = { music: 5, sounds: 5, fps: false, lang: "en" };

  try {
    var saved = JSON.parse(localStorage.getItem(KEY) || "{}");
    if (saved && typeof saved === "object") {
      // legacy 0-100 -> 0-10
      if (typeof saved.music === "number")
        st.music = clampVol(saved.music > 10 ? saved.music / 10 : saved.music);
      if (typeof saved.sounds === "number")
        st.sounds = clampVol(saved.sounds > 10 ? saved.sounds / 10 : saved.sounds);
      st.fps = !!saved.fps;
      if (LANGS.indexOf(saved.lang) !== -1) st.lang = saved.lang;
    }
  } catch (e) {
    // keep defaults
  }

  // language: detect, override cookie, translations
  var LANG_MANUAL_COOKIE = "t3mp.langManual";
  var LANG_ALIASES = { ja: "jp", ko: "kr" }; // navigator codes differ
  var BCP47 = { en: "en", es: "es", pt: "pt", fr: "fr", de: "de", jp: "ja", kr: "ko", zh: "zh" };
  var I18N = {}; // filled when script.json loads
  var DIALOGUE = {}; // textbox scripts, id -> array of { lang: text } lines
  var ACH = {}; // achievements, id -> { type, icon, goal, title, desc }
  var I18N_FALLBACK = {
    // baked-in fallback
    "settings-title": "settings",
    "label-music": "music",
    "label-sounds": "sound",
    "label-fullscreen": "fullscreen",
    "label-fps": "show fps",
    "label-language": "language",
    "label-cache": "clear cache",
    "label-cache-confirm": "click again to confirm",
    "label-legacy": "legacy website",
    "state-on": "on",
    "state-off": "off",
    "small-text": "made by t3mp",
  };

  function getCookie(name) {
    var esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    var m = document.cookie.match(new RegExp("(?:^|; )" + esc + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : null;
  }
  function setCookie(name, value, days) {
    var expires = new Date(Date.now() + days * 86400000).toUTCString();
    document.cookie =
      name + "=" + encodeURIComponent(value) + "; expires=" + expires + "; path=/; SameSite=Lax";
  }
  function deleteCookie(name) {
    document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  }

  // languages[0] first, language fallback
  function detectLang() {
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

  function t(id) {
    var entry = I18N[id];
    if (entry && entry[st.lang]) return entry[st.lang];
    if (entry && entry.en) return entry.en;
    return I18N_FALLBACK[id] || "";
  }

  // resolve a { lang: text } map for the active language, english fallback
  function langText(map) {
    return (map && (map[st.lang] || map.en)) || "";
  }

  // [{ lang, text }, ...] -> { lang: text }
  function toLangMap(arr) {
    var map = {};
    if (arr) for (var i = 0; i < arr.length; i++) map[arr[i].lang] = arr[i].text;
    return map;
  }

  // pin value box to widest reading (e.g. "10") so column never resizes
  function reserveValWidth(rangeInput) {
    var valEl = rangeInput.parentNode.querySelector(".opt-val");
    if (!valEl) return;
    var lo = parseInt(rangeInput.min, 10) || 0;
    var hi = parseInt(rangeInput.max, 10) || 0;
    var stepv = parseInt(rangeInput.step, 10) || 1;
    var prev = valEl.textContent;
    valEl.style.width = "";
    var widest = 0;
    // restored below, never paints
    for (var v = lo; v <= hi; v += stepv) {
      valEl.textContent = String(v);
      var w = valEl.getBoundingClientRect().width;
      if (w > widest) widest = w;
    }
    valEl.textContent = prev;
    if (widest > 0) valEl.style.width = Math.ceil(widest) + "px";
  }

  function equalizeSliders() {
    var ranges = settings.querySelectorAll(".opt--range .range");
    if (ranges.length < 2) return;
    var i,
      min = Infinity;
    // fix value cols first
    for (i = 0; i < ranges.length; i++) reserveValWidth(ranges[i]);
    // reset to natural width
    for (i = 0; i < ranges.length; i++) {
      ranges[i].style.flex = "";
      ranges[i].style.marginLeft = "";
    }
    // find shortest
    for (i = 0; i < ranges.length; i++) {
      var w = ranges[i].getBoundingClientRect().width;
      if (w < min) min = w;
    }
    if (!isFinite(min) || min <= 0) return;
    // pin all to shared width, right-anchor
    for (i = 0; i < ranges.length; i++) {
      ranges[i].style.flex = "0 0 " + min + "px";
      ranges[i].style.marginLeft = "auto";
    }
  }

  function applyI18n() {
    var nodes = document.querySelectorAll("[data-i18n]");
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = t(nodes[i].getAttribute("data-i18n"));
    }
    var ariaNodes = document.querySelectorAll("[data-i18n-aria]");
    for (var j = 0; j < ariaNodes.length; j++) {
      ariaNodes[j].setAttribute("aria-label", t(ariaNodes[j].getAttribute("data-i18n-aria")));
    }
    refreshCacheLabel();
    syncToggles();
    html.lang = BCP47[st.lang] || "en";
    equalizeSliders();
  }

  // translations + dialogue in external file
  // shape: { ui: [...], dialogue: [...] }; plain array tolerated as ui-only
  fetch("scripts/script.json")
    .then(function (res) {
      return res.json();
    })
    .then(function (data) {
      var uiList = Array.isArray(data) ? data : (data && data.ui) || [];
      uiList.forEach(function (entry) {
        I18N[entry.id] = toLangMap(entry.strings);
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
      applyI18n();
    })
    .catch(function (e) {}); // fallback to baked-in

  // snap volume to 0-10
  function clampVol(v) {
    return Math.min(10, Math.max(0, Math.round(v)));
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(st));
    } catch (e) {}
  }

  function optFor(name) {
    return settings.querySelector('[data-setting="' + name + '"]');
  }

  function setToggle(name, on) {
    var el = optFor(name);
    if (!el) return;
    var state = el.querySelector(".opt-state");
    if (state) {
      state.textContent = on ? t("state-on") : t("state-off");
      state.classList.toggle("on", on);
    }
    el.setAttribute("aria-pressed", on ? "true" : "false");
  }

  // resync toggles on i18n + init
  function syncToggles() {
    setToggle("fullscreen", !!document.fullscreenElement);
    setToggle("fps", st.fps);
  }

  // scale 0-10 to 0-100% fill
  function paintRange(input, v) {
    var max = parseFloat(input.max) || 10;
    input.style.setProperty("--fill", (max ? (v / max) * 100 : 0) + "%");
  }

  function setRange(name, v) {
    var el = optFor(name);
    if (!el) return;
    var input = el.querySelector(".range");
    var valEl = el.querySelector(".opt-val");
    input.value = v;
    if (valEl) valEl.textContent = v;
    paintRange(input, v);
  }

  function syncVisuals() {
    setRange("music", st.music);
    setRange("sounds", st.sounds);
    syncToggles();
    langBtnLabel.textContent = LANG_NAMES[st.lang] || st.lang;
    fpsEl.classList.toggle("show", st.fps);
    music.volume = st.music / 10;
  }

  // play sfx
  function blip(el) {
    if (!st.sounds) return;
    // skip if already playing
    if (!el.paused && !el.ended && el.currentTime > 0) return;
    try {
      el.volume = st.sounds / 10;
      el.currentTime = 0;
      el.play().catch(function () {});
    } catch (e) {}
  }

  // cursor smoothing, velocity, tip
  var mx = window.innerWidth / 2,
    my = window.innerHeight / 2;
  var cx = mx,
    cy = my; // smoothed cursor
  var tx = mx,
    ty = my; // smoothed tip
  var vel = 0; // 0..1 velocity
  var ang = 0; // facing angle
  var cursorOn = fine;

  // parallax: unit spring around 0 drives layers
  var pux = 0,
    puy = 0; // unit offset
  var pvx = 0,
    pvy = 0; // its velocity

  if (cursorOn) {
    html.classList.add("cc-active");
    // position before reveal
    cursor.style.transform = "translate3d(" + cx + "px," + cy + "px,0)";
    cursorDot.style.transform = "translate(-50%,-50%)";
    cursor.classList.add("ready");
  }

  window.addEventListener(
    "pointermove",
    function (e) {
      mx = e.clientX;
      my = e.clientY;
    },
    { passive: true }
  );

  // ring on hover
  function within(node) {
    return node && node.closest && node.closest(".cursorable");
  }
  document.addEventListener("pointerover", function (e) {
    if (within(e.target)) {
      cursor.classList.add("ring");
      blip(sfxHover);
    }
  });
  document.addEventListener("pointerout", function (e) {
    if (within(e.target) && !within(e.relatedTarget)) {
      cursor.classList.remove("ring");
    }
  });

  // loading bar
  var pct = 0;
  var loadDone = false;
  var loadStart = null;

  function loadFrame(now) {
    if (loadStart === null) loadStart = now;
    var p = Math.min((now - loadStart) / LOAD_DURATION, 1);
    pct = Math.round(p * 100);
    fill.style.width = p * 100 + "%";
    loader.setAttribute("aria-valuenow", String(pct));
    if (tipShown) bubble.textContent = pct + "%";
    if (p < 1) {
      requestAnimationFrame(loadFrame);
    } else {
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
  }
  requestAnimationFrame(loadFrame);

  // tip show/hide, delayed
  var tipTimer = null;
  var tipShown = false;

  function hideTip() {
    clearTimeout(tipTimer);
    tipShown = false;
    tip.classList.remove("show");
  }

  if (cursorOn) {
    loader.addEventListener("pointerenter", function () {
      if (loadDone) return;
      tipTimer = setTimeout(function () {
        tipShown = true;
        bubble.textContent = pct + "%";
        tip.classList.add("show");
      }, TIP_DELAY);
    });
    loader.addEventListener("pointerleave", hideTip);
  }

  // cog: nudge forward, never back
  var gearRot = 0;
  function nudgeGear() {
    gearRot += GEAR_STEP;
    gear.style.transform = "rotate(" + gearRot + "deg)";
  }
  gear.addEventListener("pointerenter", nudgeGear);
  // same nudge on keyboard focus
  gear.addEventListener("focus", function () {
    if (gear.matches(":focus-visible")) nudgeGear();
  });

  // settings open/close, measured size
  var open = false;
  panel.inert = true; // collapsed = no tab
  function setOpen(next) {
    open = next;
    if (open) {
      settings.style.width = panel.offsetWidth + "px";
      settings.style.height = panel.offsetHeight + "px";
    } else {
      settings.style.width = "";
      settings.style.height = "";
      closeLangList();
    }
    panel.inert = !open;
    gear.setAttribute("aria-expanded", open ? "true" : "false");
  }

  gear.addEventListener("click", function (e) {
    e.stopPropagation();
    setOpen(!open);
    blip(sfxSelect);
  });
  document.addEventListener("click", function (e) {
    if (langList && !langList.contains(e.target) && e.target !== langBtn) closeLangList();
    if (open && !settings.contains(e.target) && !(langList && langList.contains(e.target)))
      setOpen(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (langList) closeLangList();
      else if (open) setOpen(false);
    }
  });

  // volume sliders
  function bindRange(name) {
    var input = optFor(name).querySelector(".range");
    // hide cursor while dragging
    input.addEventListener("pointerdown", function () {
      cursor.classList.add("dragging");
    });
    input.addEventListener("input", function () {
      var v = clampVol(parseInt(input.value, 10) || 0);
      st[name] = v;
      setRange(name, v);
      if (name === "music") {
        music.volume = v / 10;
        if (v > 0) music.play().catch(function () {});
        else music.pause();
      }
      save();
    });
  }
  bindRange("music");
  bindRange("sounds");

  // restore cursor on drag end
  function endDrag() {
    cursor.classList.remove("dragging");
  }
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);

  // display toggles
  optFor("fullscreen").addEventListener("click", function () {
    if (document.fullscreenElement) {
      if (document.exitFullscreen) document.exitFullscreen();
    } else if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(function () {});
    }
    blip(sfxSelect);
  });
  document.addEventListener("fullscreenchange", function () {
    setToggle("fullscreen", !!document.fullscreenElement);
  });

  optFor("fps").addEventListener("click", function () {
    st.fps = !st.fps;
    setToggle("fps", st.fps);
    fpsEl.classList.toggle("show", st.fps);
    save();
    blip(sfxSelect);
  });

  // custom dropdown so cursor stays on page
  var langBtn = document.getElementById("langBtn");
  var langBtnLabel = document.getElementById("langBtnLabel");
  var langList = null;
  var langAnchor = null; // pointer pos, null if keyboard

  function positionLangList() {
    var x, y;
    if (langAnchor) {
      x = langAnchor.x;
      y = langAnchor.y;
    } else {
      var r = langBtn.getBoundingClientRect();
      x = r.left;
      y = r.bottom + 6;
    }
    var maxLeft = window.innerWidth - langList.offsetWidth - 8;
    var maxTop = window.innerHeight - langList.offsetHeight - 8;
    langList.style.left = Math.max(8, Math.min(x, maxLeft)) + "px";
    langList.style.top = Math.max(8, Math.min(y, maxTop)) + "px";
  }

  function closeLangList(focusBtn) {
    if (!langList) return;
    langList.remove();
    langList = null;
    langBtn.setAttribute("aria-expanded", "false");
    window.removeEventListener("resize", positionLangList);
    window.removeEventListener("scroll", positionLangList, true);
    if (focusBtn) langBtn.focus();
  }

  function pickLang(code) {
    if (LANGS.indexOf(code) !== -1 && code !== st.lang) {
      st.lang = code;
      langBtnLabel.textContent = LANG_NAMES[code] || code;
      setCookie(LANG_MANUAL_COOKIE, "1", 365);
      applyI18n();
      save();
    }
    blip(sfxSelect);
    closeLangList(true);
  }

  function openLangList(anchor) {
    langAnchor = anchor;
    var items = [];
    langList = document.createElement("ul");
    langList.className = "lang-list";
    langList.setAttribute("role", "listbox");
    langList.setAttribute("aria-label", "language");

    function focusOpt(i) {
      if (i < 0) i = items.length - 1;
      if (i >= items.length) i = 0;
      items[i].focus();
    }

    LANGS.forEach(function (code) {
      var li = document.createElement("li");
      li.className = "lang-opt cursorable";
      li.setAttribute("role", "option");
      li.tabIndex = 0;
      li.textContent = LANG_NAMES[code] || code;
      if (code === st.lang) li.setAttribute("aria-selected", "true");
      li.addEventListener("click", function (e) {
        e.stopPropagation();
        pickLang(code);
      });
      li.addEventListener("keydown", function (e) {
        switch (e.key) {
          case "Enter":
          case " ":
            e.preventDefault();
            pickLang(code);
            break;
          case "ArrowDown":
            e.preventDefault();
            focusOpt(items.indexOf(li) + 1);
            break;
          case "ArrowUp":
            e.preventDefault();
            focusOpt(items.indexOf(li) - 1);
            break;
          case "Home":
            e.preventDefault();
            focusOpt(0);
            break;
          case "End":
            e.preventDefault();
            focusOpt(items.length - 1);
            break;
          case "Escape":
            e.preventDefault();
            e.stopPropagation();
            closeLangList(true);
            break;
        }
      });
      items.push(li);
      langList.appendChild(li);
    });

    // close once focus leaves
    langList.addEventListener("focusout", function () {
      setTimeout(function () {
        if (langList && !langList.contains(document.activeElement)) closeLangList(false);
      }, 0);
    });

    // on body, not shell, so it isn't clipped
    document.body.appendChild(langList);
    positionLangList();
    langBtn.setAttribute("aria-expanded", "true");
    window.addEventListener("resize", positionLangList);
    window.addEventListener("scroll", positionLangList, true);

    var startIdx = LANGS.indexOf(st.lang);
    focusOpt(startIdx === -1 ? 0 : startIdx);
  }

  langBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    if (langList) {
      closeLangList();
    } else {
      // detail 0 = keyboard, >=1 = pointer
      openLangList(e.detail ? { x: e.clientX, y: e.clientY } : null);
    }
    blip(sfxSelect);
  });

  // clear cache then reload
  var cacheBtn = optFor("cache");
  var cacheLabel = cacheBtn.querySelector(".opt-label");
  var cacheArmed = false;
  var cacheTimer = null;

  function refreshCacheLabel() {
    cacheLabel.textContent = cacheArmed ? t("label-cache-confirm") : t("label-cache");
  }

  function disarmCache() {
    clearTimeout(cacheTimer);
    cacheArmed = false;
    refreshCacheLabel();
    cacheBtn.classList.remove("confirm");
  }

  cacheBtn.addEventListener("click", function () {
    blip(sfxSelect);
    if (!cacheArmed) {
      cacheArmed = true;
      refreshCacheLabel();
      cacheBtn.classList.add("confirm");
      cacheTimer = setTimeout(disarmCache, 3000);
      return;
    }
    clearTimeout(cacheTimer);
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {}
    deleteCookie(LANG_MANUAL_COOKIE); // resume auto-detect
    if (window.caches && caches.keys) {
      caches
        .keys()
        .then(function (keys) {
          return Promise.all(
            keys.map(function (k) {
              return caches.delete(k);
            })
          );
        })
        .catch(function () {})
        .then(function () {
          location.reload();
        });
    } else {
      location.reload();
    }
  });

  optFor("legacy").addEventListener("click", function () {
    blip(sfxSelect);
  });

  // ----- visual-novel textbox -----
  // textbox("ref") pulls DIALOGUE[ref] from script.json and types each line out.
  // exposed on window so the webgl game can drive it; returns a promise that
  // settles once the whole sequence is dismissed.
  var tb = document.getElementById("textbox");
  var tbText = document.getElementById("textboxText");
  var tbNext = document.getElementById("textboxNext");

  // reveal eases across the whole line (slow-fast-slow). total time scales with
  // length, clamped so tiny/huge lines still feel right.
  var TB_MS_PER_CHAR = 34;
  var TB_MIN_MS = 700;
  var TB_MAX_MS = 4200;
  var TB_POP_MS = 1400; // appear (scale-in); keep in sync with --t-pop
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

  // cubic-bezier(x1,y1,x2,y2) -> y for x, newton with a bisection fallback.
  // lets the typewriter ride the exact same curve as --ease.
  function cubicBezier(x1, y1, x2, y2) {
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
  var tbEase = cubicBezier(0.87, 0, 0.13, 1);

  var tbActive = false; // a dialogue is showing
  var tbTyping = false; // current line still revealing
  var tbLines = null; // array of lang-maps for the current dialogue
  var tbIdx = 0; // current line index
  var tbFull = ""; // resolved text of the current line
  var tbShown = 0; // chars revealed so far
  var tbDur = 0; // eased reveal duration for the current line
  var tbClock = 0; // reveal time consumed (excludes punctuation holds)
  var tbHold = 0; // timestamp to resume after a punctuation pause
  var tbLast = 0; // last frame time
  var tbRAF = 0;
  var tbResolve = null; // resolver for the promise textbox() handed back
  var tbHideTimer = null;
  var tbStartTimer = null; // delays the first line until the box has popped in

  function tbShow() {
    clearTimeout(tbHideTimer);
    tb.removeAttribute("inert");
    tb.removeAttribute("aria-hidden");
    void tb.offsetWidth; // reflow so a quick hide->show still pops
    tb.classList.add("show");
  }

  function tbHide() {
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
    tbNext.classList.add("show");
  }

  function tbType(now) {
    var dt = now - tbLast;
    tbLast = now;
    if (dt > 100) dt = 100; // clamp after a stall
    if (now >= tbHold) tbClock += dt;
    var p = tbDur > 0 ? tbClock / tbDur : 1;
    if (p > 1) p = 1;
    var target = Math.round(tbEase(p) * tbFull.length);
    if (target > tbShown) {
      tbShown = target;
      tbText.textContent = tbFull.slice(0, tbShown);
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
    tbFull = langText(tbLines[tbIdx]);
    tbShown = 0;
    tbText.textContent = "";
    tbNext.classList.remove("show");
    // reduced motion (or an empty line): skip the typewriter, just show it
    if (reduce || !tbFull) {
      tbFinishLine();
      return;
    }
    tbDur = Math.max(TB_MIN_MS, Math.min(TB_MAX_MS, tbFull.length * TB_MS_PER_CHAR));
    tbClock = 0;
    tbHold = 0;
    tbTyping = true;
    tbLast = performance.now();
    tbRAF = requestAnimationFrame(tbType);
  }

  // click/tap (or enter/space) skips the reveal, then advances to the next line
  function tbAdvance() {
    if (!tbActive) return;
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

  function textbox(ref) {
    var lines = DIALOGUE[ref];
    if (!lines || !lines.length) {
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
    tbIdx = 0;
    var wasShown = tb.classList.contains("show");
    tbActive = true;
    tbShow();
    if (reduce || wasShown) {
      // already on screen (or motion reduced): type the first line right away
      tbStartLine();
    } else {
      // start typing halfway through the pop-in: late enough that the box is
      // legible, early enough that it isn't done before it has finished growing
      tbText.textContent = "";
      tbNext.classList.remove("show");
      tbStartTimer = setTimeout(function () {
        tbStartTimer = null;
        tbStartLine();
      }, TB_POP_MS / 2);
    }
    return new Promise(function (res) {
      tbResolve = res;
    });
  }

  tb.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    blip(sfxSelect);
    tbAdvance();
  });

  // enter/space advance too, unless focus is on a settings control
  document.addEventListener("keydown", function (e) {
    if (!tbActive) return;
    if (e.key !== "Enter" && e.key !== " ") return;
    if (document.activeElement && settings.contains(document.activeElement)) return;
    e.preventDefault();
    tbAdvance();
  });

  // let the webgl game call it: textbox("chair")
  window.textbox = textbox;

  // ----- achievement toast -----
  // achievement("id") pops an xbox-360-style toast down from the top. progress
  // achievements take the current value: achievement("explorer", 3) -> 3 / 5.
  // overlapping calls queue and play one at a time.
  var ach = document.getElementById("ach");
  var achIcon = document.getElementById("achIcon").querySelector("i");
  var achTitle = document.getElementById("achTitle");
  var achDesc = document.getElementById("achDesc");
  var achBar = document.getElementById("achBar");
  var achBarFill = document.getElementById("achBarFill");
  var achBarNum = document.getElementById("achBarNum");

  var ACH_SLIDE_MS = 500; // keep in sync with .ach transition
  var ACH_HOLD_MS = 4200; // time spent fully on screen

  var achQueue = [];
  var achBusy = false;
  var achTimer = null;
  var achFill = 0; // pending bar target, applied after the slide-in starts

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
    blip(sfxSelect);
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

  function achievement(ref, value) {
    var a = ACH[ref];
    if (!a) {
      if (window.console) console.warn('achievement: unknown id "' + ref + '"');
      return;
    }
    achQueue.push({ a: a, value: value });
    if (!achBusy) achNext();
  }

  window.achievement = achievement;

  // animation loop
  var last = performance.now();
  var fpsSmooth = 60,
    fpsLast = 0;

  function frame(now) {
    var dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1; // clamp after stall

    var k = 1 - Math.exp(-dt / CURSOR_TAU);
    var px = cx,
      py = cy;
    cx += (mx - cx) * k;
    cy += (my - cy) * k;

    if (cursorOn) {
      // velocity 0..1 from dot speed
      var step = Math.hypot(cx - px, cy - py);
      var speed = dt > 0 ? step / dt : 0;
      var vTarget = Math.min(speed / CURSOR_VEL_REF, 1);
      vel += (vTarget - vel) * (1 - Math.exp(-dt / VEL_TAU));
      // face pointer
      var gx = mx - cx,
        gy = my - cy;
      if (Math.hypot(gx, gy) > 0.5) ang = Math.atan2(gy, gx);
      // thin height, widen width with speed
      var hs = 1 - vel * CURSOR_THIN_MAX;
      var ws = 1 + vel * CURSOR_WIDE_MAX;
      // outer translates, dot rotates/scales
      cursor.style.transform = "translate3d(" + cx + "px," + cy + "px,0)";
      cursorDot.style.transform =
        "translate(-50%,-50%) rotate(" + ang + "rad) scale(" + ws + "," + hs + ")";

      var tk = 1 - Math.exp(-dt / TIP_TAU);
      tx += (cx - tx) * tk;
      ty += (cy - ty) * tk;
      tip.style.transform = "translate3d(" + (tx + 18) + "px," + (ty - 30) + "px,0)";
    }

    if (!reduce) {
      // velocity px/sec, normalized + clamped
      var ivx = dt > 0 ? (cx - px) / dt : 0;
      var ivy = dt > 0 ? (cy - py) / dt : 0;
      var txu = Math.max(-1, Math.min(ivx / PARALLAX_REF, 1));
      var tyu = Math.max(-1, Math.min(ivy / PARALLAX_REF, 1));
      // spring toward target, bounce back
      pvx += (PARALLAX_K * (txu - pux) - PARALLAX_D * pvx) * dt;
      pvy += (PARALLAX_K * (tyu - puy) - PARALLAX_D * pvy) * dt;
      pux += pvx * dt;
      puy += pvy * dt;

      var mg = (pux * PARALLAX_MG).toFixed(1) + "px " + (puy * PARALLAX_MG).toFixed(1) + "px";
      var fg = (pux * PARALLAX_FG).toFixed(1) + "px " + (puy * PARALLAX_FG).toFixed(1) + "px";
      // shift mid layers as whole
      loaderWrap.style.translate = mg;
      sig.style.translate = mg;
      settings.style.translate = mg;
      fpsEl.style.translate = mg;
      if (tbActive) tb.style.translate = mg;
      if (langList) langList.style.translate = fg;
    }

    if (st.fps && dt > 0) {
      fpsSmooth = fpsSmooth * 0.9 + (1 / dt) * 0.1;
      if (now - fpsLast > 200) {
        fpsEl.textContent = "FPS " + Math.round(fpsSmooth);
        fpsLast = now;
      }
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // initial sync
  syncVisuals();
  applyI18n();
  // re-equalize when font ready + on resize
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(equalizeSliders);
  window.addEventListener("resize", equalizeSliders);
  if (st.music > 0) {
    // try autoplay
    music.play().catch(function () {
      // blocked, start on first gesture
      var resume = function () {
        if (st.music > 0) music.play().catch(function () {});
        document.removeEventListener("pointerdown", resume);
        document.removeEventListener("keydown", resume);
        document.removeEventListener("touchstart", resume);
      };
      document.addEventListener("pointerdown", resume, { once: true });
      document.addEventListener("keydown", resume, { once: true });
      document.addEventListener("touchstart", resume, { once: true });
    });
  }
})();
