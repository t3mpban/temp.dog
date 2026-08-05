import {
  ACH,
  BCP47,
  LANGS,
  LANG_MANUAL_COOKIE,
  LANG_NAMES,
  achDone,
  achGoal,
  achValue,
  achievement,
  choicePosition,
  clampVol,
  deleteCookie,
  fine,
  isChoiceOpen,
  isTextboxOpen,
  langText,
  onAchievementChange,
  playSfx,
  ready,
  reduce,
  save,
  setCookie,
  setPanelOpen,
  st,
  syncLoopVolumes,
  t,
} from "./textbox.js";

(function () {
  "use strict";

  // constants
  var CURSOR_TAU = 0.1; // higher = heavier
  var TIP_TAU = 0.1; // tip tighter than dot
  var VEL_TAU = 0.1; // thin/fat settle speed
  var CURSOR_VEL_REF = 1000; // px/sec = velocity 1
  var CURSOR_THIN_MAX = 0.2; // max height shrink
  var CURSOR_WIDE_MAX = 0.2; // max width grow
  var GEAR_STEP = 60; // cog nudge per hover

  // parallax: layers nudged by velocity, bounce home
  var PARALLAX_REF = 2500; // px/sec = full nudge
  var PARALLAX_MG = 5; // mid layer bounce px
  var PARALLAX_FG = 10; // fg bounce px (less)
  var PARALLAX_K = 100; // spring stiffness
  var PARALLAX_D = 20; // damping for bounce

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
  var loaderWrap = document.getElementById("loaderWrap");
  var sig = document.querySelector(".sig");
  var settings = document.getElementById("settings");
  var panel = settings.querySelector(".panel");
  var gear = document.getElementById("gear");
  var tb = document.getElementById("textbox");
  var choicesEl = document.getElementById("choices");

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
    renderAchList();
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
    syncLoopVolumes();
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
  function onDark(node) {
    return node && node.closest && node.closest(".opt-state.on, .choice, .achv-icon");
  }
  document.addEventListener("pointerover", function (e) {
    if (within(e.target)) {
      cursor.classList.add("ring");
      playSfx("hover");
    }
    if (onDark(e.target)) cursor.classList.add("dark");
  });
  document.addEventListener("pointerout", function (e) {
    if (within(e.target) && !within(e.relatedTarget)) {
      cursor.classList.remove("ring");
      playSfx("unhover");
    }
    if (onDark(e.target) && !onDark(e.relatedTarget)) cursor.classList.remove("dark");
  });

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
      cursor.classList.remove("dark");
    } else {
      settings.style.width = "";
      settings.style.height = "";
      closeLangList();
    }
    panel.inert = !open;
    gear.setAttribute("aria-expanded", open ? "true" : "false");
    setPanelOpen(open || achvOpen);
  }

  gear.addEventListener("click", function (e) {
    e.stopPropagation();
    setOpen(!open);
    playSfx("select");
  });
  document.addEventListener("click", function (e) {
    if (langList && !langList.contains(e.target) && e.target !== langBtn) closeLangList();
    if (open && !settings.contains(e.target) && !(langList && langList.contains(e.target)))
      setOpen(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (achvOpen) setAchvOpen(false);
      else if (langList) closeLangList();
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
      syncLoopVolumes();
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
    playSfx("select");
  });
  document.addEventListener("fullscreenchange", function () {
    setToggle("fullscreen", !!document.fullscreenElement);
    document.documentElement.classList.toggle("is-fullscreen", !!document.fullscreenElement);
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

  // machine-translation disclaimer, shown in the language just picked
  var notice = document.getElementById("notice");
  var noticeTimer = null;
  var NOTICE_MS = 4000;

  function showNotice(text) {
    clearTimeout(noticeTimer);
    notice.textContent = text;
    notice.classList.add("show");
    noticeTimer = setTimeout(function () {
      notice.classList.remove("show");
    }, NOTICE_MS);
  }

  function pickLang(code) {
    if (LANGS.indexOf(code) !== -1 && code !== st.lang) {
      st.lang = code;
      langBtnLabel.textContent = LANG_NAMES[code] || code;
      setCookie(LANG_MANUAL_COOKIE, "1", 365);
      applyI18n();
      save();
      if (code !== "en") {
        showNotice(t("notice-translation"));
        achievement("multilingual");
      }
    }
    playSfx("select");
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
    playSfx("select");
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
    playSfx("select");
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
    playSfx("select");
  });

  // ----- achievements viewer -----
  // completed first, then started-but-unfinished, then the rest; alphabetical
  // by the active language's title within each band
  var dim = document.getElementById("dim");
  var achv = document.getElementById("achv");
  var achvList = document.getElementById("achvList");
  var achvCount = document.getElementById("achvCount");
  var achvClose = document.getElementById("achvClose");
  var ACHV_OUT_MS = 700; // keep in sync with .achv transition (--t-slow)
  var achvOpen = false;
  var achvHideTimer = null;

  function achBand(id) {
    var a = ACH[id];
    if (achDone(id, a)) return 0;
    return achValue(id) > 0 ? 1 : 2;
  }

  function achOrder() {
    return Object.keys(ACH).sort(function (x, y) {
      var bx = achBand(x),
        by = achBand(y);
      if (bx !== by) return bx - by;
      return langText(ACH[x].title).localeCompare(langText(ACH[y].title), BCP47[st.lang] || "en");
    });
  }

  function achRow(id) {
    var a = ACH[id];
    var goal = achGoal(a);
    var value = achValue(id);
    var complete = achDone(id, a);

    var row = document.createElement("div");
    row.className = complete ? "achv-row" : "achv-row locked";

    var icon = document.createElement("span");
    icon.className = "achv-icon";
    var glyph = document.createElement("i");
    glyph.className = "fa-solid " + a.icon;
    glyph.setAttribute("aria-hidden", "true");
    icon.appendChild(glyph);

    var body = document.createElement("span");
    body.className = "achv-body";

    var name = document.createElement("span");
    name.className = "achv-name";
    name.textContent = langText(a.title);

    var desc = document.createElement("span");
    desc.className = "achv-desc";
    desc.textContent = langText(a.desc);

    body.appendChild(name);
    body.appendChild(desc);

    if (a.type === "progress") {
      var bar = document.createElement("span");
      bar.className = "ach-bar";
      var track = document.createElement("span");
      track.className = "ach-bar-track";
      var barFill = document.createElement("span");
      barFill.className = "ach-bar-fill";
      barFill.style.width = (goal > 0 ? (value / goal) * 100 : 0) + "%";
      track.appendChild(barFill);
      var num = document.createElement("span");
      num.className = "ach-bar-num";
      num.textContent = value + " / " + goal;
      bar.appendChild(track);
      bar.appendChild(num);
      body.appendChild(bar);
    }

    row.appendChild(icon);
    row.appendChild(body);
    return row;
  }

  function renderAchList() {
    if (!achvList) return;
    var ids = achOrder();
    var scroll = achvList.scrollTop;
    var done = 0;
    achvList.textContent = "";
    ids.forEach(function (id) {
      if (achDone(id, ACH[id])) done++;
      achvList.appendChild(achRow(id));
    });
    achvCount.textContent = done + " / " + ids.length;
    achvList.scrollTop = scroll;
  }

  onAchievementChange(renderAchList);

  function setAchvOpen(next) {
    if (next === achvOpen) return;
    achvOpen = next;
    setPanelOpen(open || achvOpen);
    if (next) {
      cursor.classList.remove("dark");
      clearTimeout(achvHideTimer);
      renderAchList();
      dim.hidden = false;
      achv.hidden = false;
      achv.removeAttribute("inert");
      void achv.offsetWidth; // commit the collapsed state before the pop
      dim.classList.add("show");
      achv.classList.add("show");
      achvList.scrollTop = 0;
      settings.inert = true; // nothing behind the dim should stay reachable
      achvClose.focus();
    } else {
      dim.classList.remove("show");
      achv.classList.remove("show");
      achv.setAttribute("inert", "");
      settings.inert = false;
      achvHideTimer = setTimeout(function () {
        if (!achvOpen) {
          dim.hidden = true;
          achv.hidden = true;
        }
      }, ACHV_OUT_MS);
    }
  }

  optFor("achievements").addEventListener("click", function (e) {
    e.stopPropagation();
    playSfx("select");
    setOpen(false);
    setAchvOpen(true);
  });

  achvClose.addEventListener("click", function () {
    playSfx("select");
    setAchvOpen(false);
  });

  dim.addEventListener("click", function () {
    setAchvOpen(false);
  });

  // "interstellar": reach the bottom of this list
  achvList.addEventListener(
    "scroll",
    function () {
      if (achvList.scrollTop + achvList.clientHeight >= achvList.scrollHeight - 2) {
        achievement("interstellar");
      }
    },
    { passive: true }
  );

  // animation loop
  var last = performance.now();

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
      if (isTextboxOpen()) tb.style.translate = mg;
      if (isChoiceOpen()) choicesEl.style.translate = mg;
      if (langList) langList.style.translate = fg;
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // initial sync
  syncVisuals();
  applyI18n();
  ready.then(applyI18n);
  // re-equalize when font ready + on resize
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(equalizeSliders);
  window.addEventListener("resize", function () {
    equalizeSliders();
    choicePosition();
  });
})();
