(function () {
	"use strict";

	// constants
	var CURSOR_TAU = 0.16;      // higher = heavier follow
	var TIP_TAU = 0.16;         // tooltip trails a touch tighter than the dot
	var VEL_TAU = 0.08;         // how quickly the thin/fat reading settles
	var CURSOR_VEL_REF = 1800;  // px/sec that maps to velocity 1.0
	var CURSOR_THIN_MAX = 0.25; // most the height may shrink (25%)
	var CURSOR_WIDE_MAX = 0.5;  // most the width may grow (50%)
	var LOAD_DURATION = 10000;  // placeholder load time
	var TIP_DELAY = 200;        // hovertime before the tooltip shows
	var GEAR_STEP = 33;         // degrees the cog nudges per hover (never reverses)

	var fine = window.matchMedia("(pointer: fine)").matches;
	var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	if (reduce) { CURSOR_TAU = 0.02; CURSOR_THIN_MAX = 0; CURSOR_WIDE_MAX = 0; }

	// elements
	var html = document.documentElement;
	var cursor = document.getElementById("cursor");
	var tip = document.getElementById("tip");
	var bubble = tip.querySelector(".bubble");
	var fpsEl = document.getElementById("fps");
	var loaderWrap = document.getElementById("loaderWrap");
	var loader = document.getElementById("loader");
	var fill = document.getElementById("fill");
	var settings = document.getElementById("settings");
	var panel = settings.querySelector(".panel");
	var gear = document.getElementById("gear");
	var music = document.getElementById("music");
	var sfxHover = document.getElementById("sfxHover");
	var sfxSelect = document.getElementById("sfxSelect");

	// states
	var KEY = "t3mp.settings.v2";
	var LANGS = ["en", "es", "pt", "fr", "de", "jp", "kr", "zh"];
	var st = { music: 0, sounds: 0, fps: false, lang: "en" };

	try {
		var saved = JSON.parse(localStorage.getItem(KEY) || "{}");
		if (saved && typeof saved === "object") {
			if (typeof saved.music === "number") st.music = clampVol(saved.music);
			if (typeof saved.sounds === "number") st.sounds = clampVol(saved.sounds);
			st.fps = !!saved.fps;
			if (LANGS.indexOf(saved.lang) !== -1) st.lang = saved.lang;
		}
	} catch (e) { // ignore parse errors, keep defaults
		}

	function clampVol(v) {
		v = Math.round(v);
		if (v < 0) return 0;
		if (v > 100) return 100;
		return v;
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
			state.textContent = on ? "on" : "off";
			state.classList.toggle("on", on);
		}
		el.setAttribute("aria-pressed", on ? "true" : "false");
	}

	// paint the filled portion of a slider track with the ink colour
	function paintRange(input, v) {
		input.style.background =
			"linear-gradient(90deg, var(--ink) " + v + "%, var(--accent) " + v + "%)";
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
		setToggle("fps", st.fps);
		setToggle("fullscreen", !!document.fullscreenElement);
		var langSel = optFor("language").querySelector(".select");
		langSel.value = st.lang;
		fpsEl.classList.toggle("show", st.fps);
		music.volume = st.music / 100;
	}

	// sfx play helper (ignores errors if the user hasn't interacted yet)
	function blip(el) {
		if (!st.sounds) return;
		try {
			el.volume = st.sounds / 100;
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

	if (cursorOn) {
		html.classList.add("cc-active");
		// position before revealing so it never flashes in the corner
		cursor.style.transform =
			"translate3d(" + cx + "px," + cy + "px,0) translate(-50%,-50%)";
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

	// cog: nudge forward a little on hover and never spin back; pop the container
	var gearRot = 0;
	gear.addEventListener("pointerenter", function () {
		gearRot += GEAR_STEP;
		gear.style.transform = "rotate(" + gearRot + "deg)";
		if (!open) settings.classList.add("poke");
	});
	gear.addEventListener("pointerleave", function () {
		settings.classList.remove("poke");
	});

	// settings menu open/close — size is measured so any layout morphs cleanly
	var open = false;
	function setOpen(next) {
		open = next;
		if (open) {
			settings.classList.remove("poke");
			settings.style.width = panel.offsetWidth + "px";
			settings.style.height = panel.offsetHeight + "px";
			settings.classList.add("open");
		} else {
			settings.style.width = "";
			settings.style.height = "";
			settings.classList.remove("open");
		}
		gear.setAttribute("aria-expanded", open ? "true" : "false");
	}

	gear.addEventListener("click", function (e) {
		e.stopPropagation();
		setOpen(!open);
		blip(sfxSelect);
	});
	document.addEventListener("click", function (e) {
		if (open && !settings.contains(e.target)) setOpen(false);
	});
	document.addEventListener("keydown", function (e) {
		if (e.key === "Escape" && open) setOpen(false);
	});

	// music / sounds sliders
	function bindRange(name) {
		var input = optFor(name).querySelector(".range");
		input.addEventListener("input", function () {
			var v = clampVol(parseInt(input.value, 10) || 0);
			st[name] = v;
			setRange(name, v);
			if (name === "music") {
				music.volume = v / 100;
				if (v > 0) music.play().catch(function () {});
				else music.pause();
			}
			save();
		});
	}
	bindRange("music");
	bindRange("sounds");

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

	// language dropdown
	optFor("language").querySelector(".select").addEventListener("change", function () {
		if (LANGS.indexOf(this.value) !== -1) st.lang = this.value;
		save();
		blip(sfxSelect);
	});

	// clear cache then reload
	var cacheBtn = optFor("cache");
	var cacheLabel = cacheBtn.querySelector(".opt-label");
	var cacheArmed = false;
	var cacheTimer = null;

	function disarmCache() {
		clearTimeout(cacheTimer);
		cacheArmed = false;
		cacheLabel.textContent = "clear cache";
		cacheBtn.classList.remove("confirm");
	}

	cacheBtn.addEventListener("click", function () {
		blip(sfxSelect);
		if (!cacheArmed) {
			cacheArmed = true;
			cacheLabel.textContent = "click again to confirm";
			cacheBtn.classList.add("confirm");
			cacheTimer = setTimeout(disarmCache, 3000);
			return;
		}
		clearTimeout(cacheTimer);
		try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}
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
			cursor.style.transform =
				"translate3d(" + cx + "px," + cy + "px,0) translate(-50%,-50%) rotate(" +
				ang + "rad) scale(" + ws + "," + hs + ")";

			var tk = 1 - Math.exp(-dt / TIP_TAU);
			tx += (cx - tx) * tk;
			ty += (cy - ty) * tk;
			tip.style.transform =
				"translate3d(" + (tx + 18) + "px," + (ty - 30) + "px,0)";
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
	if (st.music > 0) {
		// resume music if it was on last visit; ignore autoplay rejection
		music.play().catch(function () {});
	}
})();
