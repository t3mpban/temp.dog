(function () {
	"use strict";

	// constants
	var CURSOR_TAU = 0.1;      // higher = heavier follow
	var TIP_TAU = 0.2;         // tooltip trails a touch tighter than the dot
	var VEL_TAU = 0.1;         // how quickly the thin/fat reading settles
	var CURSOR_VEL_REF = 1800;  // px/sec that maps to velocity 1.0
	var CURSOR_THIN_MAX = 0.4; // most the height may shrink (25%)
	var CURSOR_WIDE_MAX = 0.4;  // most the width may grow (50%)
	var LOAD_DURATION = 500;  // placeholder load time
	var TIP_DELAY = 200;        // hovertime before the tooltip shows
	var GEAR_STEP = 33;         // degrees the cog nudges per hover (never reverses)

	// parallax: the mid/foreground layers get nudged by cursor velocity, then bounce home
	var PARALLAX_REF = 2500;    // px/sec of cursor travel that maps to a full nudge
	var PARALLAX_MG = 5;       // px the mid layer (settings, loading, small-text) may bounce
	var PARALLAX_FG = 10;        // px the foreground (dropdowns) bounces — deliberately less
	var PARALLAX_K = 100;       // spring stiffness — the snap back to the middle
	var PARALLAX_D = 20;        // damping (< 2*sqrt(K)) so it overshoots into a bounce

	var fine = window.matchMedia("(pointer: fine)").matches;
	var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	if (reduce) { CURSOR_TAU = 0.02; CURSOR_THIN_MAX = 0; CURSOR_WIDE_MAX = 0; }

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
		en: "english", es: "español", pt: "português", fr: "français",
		de: "deutsch", jp: "日本語", kr: "한국어", zh: "简体中文"
	};
	var st = { music: 5, sounds: 5, fps: false, lang: "en" };

	try {
		var saved = JSON.parse(localStorage.getItem(KEY) || "{}");
		if (saved && typeof saved === "object") {
			// legacy saves used a 0–100 scale; fold anything above 10 down to the new 0–10
			if (typeof saved.music === "number") st.music = clampVol(saved.music > 10 ? saved.music / 10 : saved.music);
			if (typeof saved.sounds === "number") st.sounds = clampVol(saved.sounds > 10 ? saved.sounds / 10 : saved.sounds);
			st.fps = !!saved.fps;
			if (LANGS.indexOf(saved.lang) !== -1) st.lang = saved.lang;
		}
	} catch (e) { // ignore parse errors, keep defaults
		}

	// --- language: locale detection, manual override cookie, translations ---
	var LANG_MANUAL_COOKIE = "t3mp.langManual";
	var LANG_ALIASES = { ja: "jp", ko: "kr" }; // navigator's codes that differ from ours
	var BCP47 = { en: "en", es: "es", pt: "pt", fr: "fr", de: "de", jp: "ja", kr: "ko", zh: "zh" };
	var I18N = {};         // populated once scripts/script.json loads
	var I18N_FALLBACK = {  // baked-in English so labels never sit blank pre-fetch
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
		"small-text": "made by t3mp"
	};

	function getCookie(name) {
		var esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		var m = document.cookie.match(new RegExp("(?:^|; )" + esc + "=([^;]*)"));
		return m ? decodeURIComponent(m[1]) : null;
	}
	function setCookie(name, value, days) {
		var expires = new Date(Date.now() + days * 86400000).toUTCString();
		document.cookie = name + "=" + encodeURIComponent(value) + "; expires=" + expires + "; path=/; SameSite=Lax";
	}
	function deleteCookie(name) {
		document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
	}

	// navigator.languages[0] first, navigator.language as the old-browser fallback
	function detectLang() {
		var candidates = (navigator.languages || []).concat(navigator.language || []);
		for (var i = 0; i < candidates.length; i++) {
			var tag = (candidates[i] || "").toLowerCase().split("-")[0];
			var code = LANG_ALIASES[tag] || tag;
			if (LANGS.indexOf(code) !== -1) return code;
		}
		return null;
	}

	// only auto-detect when the user hasn't manually picked a language before;
	// a manual pick (see the language dropdown handler) sets the cookie below
	// and wins over locale detection on every later visit
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

	// the two volume sliders flex-fill the space left of their value, so a longer label
	// gives a shorter track. lock both tracks to the shorter of the two so they're the same
	// size, then right-anchor them (margin-left:auto): each keeps the same right gap to its
	// value, and the row with more room puts the surplus on the left. the shorter one shifts
	// per language, so this recomputes on load and on every lang change (end of applyI18n).
	// pin a value box to the width of its widest possible reading (e.g. "10"), so the column
	// — and the track beside it — never resizes as the number's digit count changes (0/10)
	function reserveValWidth(rangeInput) {
		var valEl = rangeInput.parentNode.querySelector(".opt-val");
		if (!valEl) return;
		var lo = parseInt(rangeInput.min, 10) || 0;
		var hi = parseInt(rangeInput.max, 10) || 0;
		var stepv = parseInt(rangeInput.step, 10) || 1;
		var prev = valEl.textContent;
		valEl.style.width = "";
		var widest = 0;
		// restored synchronously below, so the swapped-in text never paints
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
		var i, min = Infinity;
		// fix each value column first so the track measurement below accounts for it
		for (i = 0; i < ranges.length; i++) reserveValWidth(ranges[i]);
		// drop previous overrides so each track flex-fills to its natural width again
		for (i = 0; i < ranges.length; i++) {
			ranges[i].style.flex = "";
			ranges[i].style.marginLeft = "";
		}
		// measure, find the shortest natural width
		for (i = 0; i < ranges.length; i++) {
			var w = ranges[i].getBoundingClientRect().width;
			if (w < min) min = w;
		}
		if (!isFinite(min) || min <= 0) return;
		// pin every track to that shared width and right-anchor it so the right gap matches
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

	// translations live in an external file so the script stays readable
	fetch("scripts/script.json")
		.then(function (res) { return res.json(); })
		.then(function (data) {
			data.forEach(function (entry) {
				var map = {};
				for (var i = 0; i < entry.strings.length; i++) {
					map[entry.strings[i].lang] = entry.strings[i].text;
				}
				I18N[entry.id] = map;
			});
			applyI18n();
		})
		.catch(function (e) {}); // fall back to baked-in English on failure

	// volume is an integer 0–10 (10 = full); snap to the nearest stop
	function clampVol(v) {
		return Math.min(10, Math.max(0, Math.round(v)));
	}

	function save() {
		try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {}
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

	// fullscreen/fps toggles need re-syncing both on i18n changes (label text) and on init
	function syncToggles() {
		setToggle("fullscreen", !!document.fullscreenElement);
		setToggle("fps", st.fps);
	}

	// move the slider's fill (the 0.1s ease between steps lives in CSS). the value is 0–10,
	// so scale it to the 0–100% gradient stop the track expects
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

	// sfx play helper (ignores errors if the user hasn't interacted yet)
	function blip(el) {
		if (!st.sounds) return;
		try {
			el.volume = st.sounds / 10;
			el.currentTime = 0;
			el.play().catch(function () {});
		} catch (e) {}
	}

	// cursor smoothing, velocity and tooltip follow
	var mx = window.innerWidth / 2, my = window.innerHeight / 2;
	var cx = mx, cy = my;       // smoothed cursor
	var tx = mx, ty = my;       // smoothed tooltip
	var vel = 0;                // 0..1 velocity reading
	var ang = 0;                // facing angle (radians)
	var cursorOn = fine;

	// parallax: a single unit spring oscillating around 0 (the middle) drives both layers
	var pux = 0, puy = 0;       // unit offset (-1..1, may overshoot)
	var pvx = 0, pvy = 0;       // its velocity

	if (cursorOn) {
		html.classList.add("cc-active");
		// position before revealing so it never flashes in the corner
		cursor.style.transform = "translate3d(" + cx + "px," + cy + "px,0)";
		cursorDot.style.transform = "translate(-50%,-50%)";
		cursor.classList.add("ready");
	}

	window.addEventListener("pointermove", function (e) {
		mx = e.clientX;
		my = e.clientY;
	}, { passive: true });

	// ring on hover for cursorable elements
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

	// loading bar animation
	var pct = 0;
	var loadDone = false;
	var loadStart = null;

	function loadFrame(now) {
		if (loadStart === null) loadStart = now;
		var p = Math.min((now - loadStart) / LOAD_DURATION, 1);
		pct = Math.round(p * 100);
		fill.style.width = (p * 100) + "%";
		loader.setAttribute("aria-valuenow", String(pct));
		if (tipShown) bubble.textContent = pct + "%";
		if (p < 1) {
			requestAnimationFrame(loadFrame);
		} else {
			loadDone = true;
			hideTip();
			setTimeout(function () {
				loaderWrap.classList.add("done");
				// reveal the placeholder screen as the loader fades, so they cross over
				if (screenEl) screenEl.classList.add("show");
				setTimeout(function () { loaderWrap.style.display = "none"; }, 750);
			}, 350);
		}
	}
	requestAnimationFrame(loadFrame);

	// tooltip show/hide on hover, delayed so it doesn't flash on a fly-by
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

	// cog: nudge forward a little on hover and never spin back
	var gearRot = 0;
	function nudgeGear() {
		gearRot += GEAR_STEP;
		gear.style.transform = "rotate(" + gearRot + "deg)";
	}
	gear.addEventListener("pointerenter", nudgeGear);
	// keyboard focus gets the same nudge instead of an outline (see .gear:focus-visible)
	gear.addEventListener("focus", function () {
		if (gear.matches(":focus-visible")) nudgeGear();
	});

	// settings menu open/close — size is measured so any layout morphs cleanly
	var open = false;
	panel.inert = true; // collapsed panel must be unreachable by Tab, not just visually clipped
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
		if (open && !settings.contains(e.target) && !(langList && langList.contains(e.target))) setOpen(false);
	});
	document.addEventListener("keydown", function (e) {
		if (e.key === "Escape") {
			if (langList) closeLangList();
			else if (open) setOpen(false);
		}
	});

	// music / sounds sliders
	function bindRange(name) {
		var input = optFor(name).querySelector(".range");
		// hide the cursor while dragging so it doesn't sit on top of the value
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

	// restore the cursor when the drag ends, wherever the pointer is released
	function endDrag() { cursor.classList.remove("dragging"); }
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

	// language dropdown — built from scratch (instead of a native <select>) so the
	// custom cursor never has to hand off to the OS-painted native popup
	var langBtn = document.getElementById("langBtn");
	var langBtnLabel = document.getElementById("langBtnLabel");
	var langList = null;
	var langAnchor = null; // {x, y} where the pointer landed; null when opened via keyboard

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

		// closing via Tab (or any focus change) falls out of the listbox naturally —
		// just tear the popup down once focus actually leaves it
		langList.addEventListener("focusout", function () {
			setTimeout(function () {
				if (langList && !langList.contains(document.activeElement)) closeLangList(false);
			}, 0);
		});

		// appended to <body>, not after the button: the settings shell bounces (a non-none
		// translate) and would otherwise become this fixed list's containing block and clip
		// it inside the shell's overflow:hidden
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
			// detail is 0 for a keyboard-activated click, >=1 for a real pointer click
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
		try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}
		deleteCookie(LANG_MANUAL_COOKIE); // let locale auto-detection resume too
		if (window.caches && caches.keys) {
			caches.keys().then(function (keys) {
				return Promise.all(keys.map(function (k) { return caches.delete(k); }));
			}).catch(function () {}).then(function () { location.reload(); });
		} else {
			location.reload();
		}
	});

	optFor("legacy").addEventListener("click", function () { blip(sfxSelect); });

	// animation loop
	var last = performance.now();
	var fpsSmooth = 60, fpsLast = 0;

	function frame(now) {
		var dt = (now - last) / 1000;
		last = now;
		if (dt > 0.1) dt = 0.1; // clamp after tab-switch stalls

		var k = 1 - Math.exp(-dt / CURSOR_TAU);
		var px = cx, py = cy;
		cx += (mx - cx) * k;
		cy += (my - cy) * k;

		if (cursorOn) {
			// velocity as a 0..1 float from how fast the smoothed dot is travelling
			var step = Math.hypot(cx - px, cy - py);
			var speed = dt > 0 ? step / dt : 0;
			var vTarget = Math.min(speed / CURSOR_VEL_REF, 1);
			vel += (vTarget - vel) * (1 - Math.exp(-dt / VEL_TAU));
			// face the actual pointer (the dot trails it, so this points where it's headed)
			var gx = mx - cx, gy = my - cy;
			if (Math.hypot(gx, gy) > 0.5) ang = Math.atan2(gy, gx);
			// thin the height and widen the width by up to their max as it speeds up
			var hs = 1 - vel * CURSOR_THIN_MAX;
			var ws = 1 + vel * CURSOR_WIDE_MAX;
			// outer node translates only (keeps the drop-shadow offset screen-fixed);
			// the dot takes the rotation/scale so the shape still leans into motion
			cursor.style.transform = "translate3d(" + cx + "px," + cy + "px,0)";
			cursorDot.style.transform =
				"translate(-50%,-50%) rotate(" + ang + "rad) scale(" + ws + "," + hs + ")";

			var tk = 1 - Math.exp(-dt / TIP_TAU);
			tx += (cx - tx) * tk;
			ty += (cy - ty) * tk;
			tip.style.transform =
				"translate3d(" + (tx + 18) + "px," + (ty - 30) + "px,0)";
		}

		if (!reduce) {
			// cursor velocity (px/sec) from this frame's smoothed travel, normalised + clamped
			var ivx = dt > 0 ? (cx - px) / dt : 0;
			var ivy = dt > 0 ? (cy - py) / dt : 0;
			var txu = Math.max(-1, Math.min(ivx / PARALLAX_REF, 1));
			var tyu = Math.max(-1, Math.min(ivy / PARALLAX_REF, 1));
			// spring the offset toward the velocity target, then let it bounce back to the middle
			pvx += (PARALLAX_K * (txu - pux) - PARALLAX_D * pvx) * dt;
			pvy += (PARALLAX_K * (tyu - puy) - PARALLAX_D * pvy) * dt;
			pux += pvx * dt;
			puy += pvy * dt;

			var mg = (pux * PARALLAX_MG).toFixed(1) + "px " + (puy * PARALLAX_MG).toFixed(1) + "px";
			var fg = (pux * PARALLAX_FG).toFixed(1) + "px " + (puy * PARALLAX_FG).toFixed(1) + "px";
			// move each mid-layer element as a whole (the settings shell shifts rigidly, so
			// its contents never go off-centre); the language list lives on <body>, not in
			// the shell, so this translate can't become its containing block and clip it.
			loaderWrap.style.translate = mg;
			sig.style.translate = mg;
			settings.style.translate = mg;
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

	// initial sync of settings visuals
	syncVisuals();
	applyI18n();
	// label widths depend on the custom font's metrics, so re-equalize once it's ready;
	// also recompute when the panel can change width (the narrow-screen breakpoint)
	if (document.fonts && document.fonts.ready) document.fonts.ready.then(equalizeSliders);
	window.addEventListener("resize", equalizeSliders);
	if (st.music > 0) {
		// try to autoplay; browsers blocking it will reject the promise
		music.play().catch(function () {
			// blocked until the user interacts with the page; start on first gesture
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
