import {
  achValue,
  achievement,
  choice,
  playSfx,
  ready,
  setLoadProgress,
  setLoop,
  textbox,
  tooltip,
} from "./textbox.js";

(function () {
  "use strict";

  var vnLog = document.getElementById("rigVnLog");
  function log(text) {
    vnLog.textContent = text;
  }

  // fake asset loading: no game.js on this page, so nothing else drives the bar
  var LOAD_MS = 1200;
  var loadStart = performance.now();
  function driveLoader(now) {
    var p = Math.min((now - loadStart) / LOAD_MS, 1);
    setLoadProgress(p);
    if (p < 1) requestAnimationFrame(driveLoader);
  }
  requestAnimationFrame(driveLoader);

  document.getElementById("rigLoaderReplay").addEventListener("click", function () {
    location.reload();
  });

  document.getElementById("rigTextbox").addEventListener("click", function () {
    log("dialogue: pc-off …");
    textbox("pc-off").then(function () {
      log("dialogue: pc-off — dismissed");
    });
  });

  document.getElementById("rigChoice").addEventListener("click", function () {
    log("choice: pc-on …");
    choice("pc-on").then(function (id) {
      log("choice: pc-on — picked " + id);
    });
  });

  document.getElementById("rigAchNormal").addEventListener("click", function () {
    achievement("hello-world");
  });

  document.getElementById("rigAchProgress").addEventListener("click", function () {
    achievement("chair", achValue("chair") + 1);
  });

  document.getElementById("rigAchvOpen").addEventListener("click", function () {
    var btn = document.querySelector('[data-setting="achievements"]');
    if (btn) btn.click();
  });

  document.getElementById("rigSettingsOpen").addEventListener("click", function () {
    document.getElementById("gear").click();
  });

  var tipTarget = document.getElementById("rigTipTarget");
  tipTarget.addEventListener("pointerenter", function () {
    tooltip("pc");
  });
  tipTarget.addEventListener("pointerleave", function () {
    tooltip();
  });

  ready.then(function () {
    log("script.json loaded — dialogue/choices/achievements ready");
  });

  var expCtx = null;
  function actx() {
    if (!expCtx) expCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (expCtx.state === "suspended") expCtx.resume();
    return expCtx;
  }

  var expBuffers = {};
  function loadExpBuffer(name) {
    if (expBuffers[name]) return Promise.resolve(expBuffers[name]);
    return fetch("/sounds/" + name + ".ogg")
      .then(function (res) {
        return res.arrayBuffer();
      })
      .then(function (data) {
        return actx().decodeAudioData(data);
      })
      .then(function (buffer) {
        expBuffers[name] = buffer;
        return buffer;
      });
  }

  var expStreamDest = null;
  var expStreamEl = null;
  function streamDestination() {
    if (!expStreamDest) {
      expStreamDest = actx().createMediaStreamDestination();
      expStreamEl = new Audio();
      expStreamEl.srcObject = expStreamDest.stream;
      expStreamEl.play().catch(function () {});
    }
    return expStreamDest;
  }

  function sfxLog(text) {
    document.getElementById("rigSfxLog").textContent = text;
  }

  document.getElementById("rigSfxSiteQuiet").addEventListener("click", function () {
    playSfx("hover");
    sfxLog("site hover, real vol 0.15, via the game's own <audio>.volume pool");
  });
  document.getElementById("rigSfxSiteLoud").addEventListener("click", function () {
    playSfx("achievement");
    sfxLog("site achievement, real vol 0.85, via the game's own <audio>.volume pool");
  });

  var expPlainEl = new Audio("/sounds/hover.ogg");
  document.getElementById("rigSfxPlainQuiet").addEventListener("click", function () {
    expPlainEl.currentTime = 0;
    expPlainEl.volume = 0.15;
    expPlainEl.play().catch(function () {});
    sfxLog("plain <audio>.volume = 0.15");
  });
  document.getElementById("rigSfxPlainLoud").addEventListener("click", function () {
    expPlainEl.currentTime = 0;
    expPlainEl.volume = 1;
    expPlainEl.play().catch(function () {});
    sfxLog("plain <audio>.volume = 1");
  });

  function playGain(name, v, dest, label) {
    loadExpBuffer(name).then(function (buffer) {
      var src = actx().createBufferSource();
      src.buffer = buffer;
      var gain = actx().createGain();
      gain.gain.value = v;
      src.connect(gain).connect(dest);
      src.start(0);
    });
    sfxLog(label);
  }

  document.getElementById("rigSfxGainQuiet").addEventListener("click", function () {
    playGain("hover", 0.15, actx().destination, "WebAudio gain=0.15 -> destination");
  });
  document.getElementById("rigSfxGainLoud").addEventListener("click", function () {
    playGain("hover", 1, actx().destination, "WebAudio gain=1 -> destination");
  });
  document.getElementById("rigSfxStreamQuiet").addEventListener("click", function () {
    playGain("hover", 0.15, streamDestination(), "WebAudio gain=0.15 -> mediastream -> audio el");
  });
  document.getElementById("rigSfxStreamLoud").addEventListener("click", function () {
    playGain("hover", 1, streamDestination(), "WebAudio gain=1 -> mediastream -> audio el");
  });

  function musicLog(text) {
    document.getElementById("rigMusicLog").textContent = text;
  }

  document.getElementById("rigMusicRealOn").addEventListener("click", function () {
    setLoop("music", true);
    musicLog("real site music loop started (site's actual gain path + current slider position)");
  });
  document.getElementById("rigMusicRealOff").addEventListener("click", function () {
    setLoop("music", false);
    musicLog("real site music loop stopped");
  });

  var expMusicSrc = null;
  function stopExpMusic() {
    if (!expMusicSrc) return;
    try {
      expMusicSrc.stop();
    } catch (e) {}
    expMusicSrc.disconnect();
    expMusicSrc = null;
  }

  function playExpMusic(dest, v, label) {
    loadExpBuffer("music").then(function (buffer) {
      stopExpMusic();
      expMusicSrc = actx().createBufferSource();
      expMusicSrc.buffer = buffer;
      expMusicSrc.loop = true;
      var gain = actx().createGain();
      gain.gain.value = v;
      expMusicSrc.connect(gain).connect(dest);
      expMusicSrc.start(0);
    });
    musicLog(label);
  }

  document.getElementById("rigMusicDirect1x").addEventListener("click", function () {
    playExpMusic(actx().destination, 1, "music gain=1 -> destination (ignores mute switch)");
  });
  document.getElementById("rigMusicDirect3x").addEventListener("click", function () {
    playExpMusic(actx().destination, 3, "music gain=3 -> destination (ignores mute switch)");
  });
  document.getElementById("rigMusicStream1x").addEventListener("click", function () {
    playExpMusic(streamDestination(), 1, "music gain=1 -> mediastream -> audio el");
  });
  document.getElementById("rigMusicStream3x").addEventListener("click", function () {
    playExpMusic(streamDestination(), 3, "music gain=3 -> mediastream -> audio el");
  });
  document.getElementById("rigMusicStop").addEventListener("click", function () {
    stopExpMusic();
    musicLog("experimental music stopped");
  });

  function kbLog(text) {
    document.getElementById("rigKbLog").textContent = text;
  }
  function reportActive(label) {
    setTimeout(function () {
      var active = document.activeElement;
      kbLog(label + " - active element: " + (active ? active.tagName + "#" + active.id : "none"));
    }, 80);
  }

  var kbA = document.getElementById("rigKbInputA");
  document.getElementById("rigKbA").addEventListener("pointerdown", function (event) {
    event.preventDefault();
    kbA.focus();
    reportActive("A: pointerdown + preventDefault");
  });

  var kbB = document.getElementById("rigKbInputB");
  document.getElementById("rigKbB").addEventListener("pointerdown", function () {
    kbB.focus();
    reportActive("B: pointerdown, no preventDefault");
  });

  var kbC = document.getElementById("rigKbInputC");
  document.getElementById("rigKbC").addEventListener("click", function () {
    kbC.focus();
    reportActive("C: click event");
  });

  var kbD = document.getElementById("rigKbInputD");
  document.getElementById("rigKbD").addEventListener("touchend", function (event) {
    event.preventDefault();
    kbD.focus();
    reportActive("D: touchend");
  });
  document.getElementById("rigKbD").addEventListener("click", function () {
    kbD.focus();
    reportActive("D: click (non-touch fallback)");
  });

  var kbE = document.getElementById("rigKbInputE");
  document.getElementById("rigKbE").addEventListener("pointerdown", function (event) {
    event.preventDefault();
    kbE.focus();
    reportActive("E: textarea");
  });

  var kbF = document.getElementById("rigKbInputF");
  document.getElementById("rigKbF").addEventListener("pointerdown", function (event) {
    event.preventDefault();
    kbF.focus();
    reportActive("F: visible tiny input");
  });

  var kbG = document.getElementById("rigKbInputG");
  document.getElementById("rigKbG").addEventListener("pointerdown", function (event) {
    event.preventDefault();
    kbG.focus({ preventScroll: true });
    reportActive("G: focus(preventScroll)");
  });

  var kbH = document.getElementById("rigKbInputH");
  document.getElementById("rigKbH").addEventListener("pointerdown", function (event) {
    event.preventDefault();
    kbH.focus();
    kbH.click();
    reportActive("H: focus() then .click()");
  });

  var kbvScreen = document.getElementById("screen");
  var kbvInput = document.getElementById("rigKbvInput");
  var kbvCleanup = null;

  function kbvLog(text) {
    document.getElementById("rigKbvLog").textContent = text;
  }

  function kbvReadout(extra) {
    if (!window.visualViewport) return "visualViewport not supported on this browser";
    var vv = window.visualViewport;
    var covered = window.innerHeight - vv.height;
    return (
      (extra ? extra + " | " : "") +
      "innerHeight=" +
      Math.round(window.innerHeight) +
      " visualViewport.height=" +
      Math.round(vv.height) +
      " covered=" +
      Math.round(covered)
    );
  }

  function kbvSetMethod(setup) {
    if (kbvCleanup) kbvCleanup();
    kbvScreen.style.height = "";
    kbvScreen.style.transform = "";
    kbvCleanup = setup ? setup() : null;
  }

  document.getElementById("rigKbvNone").addEventListener("click", function () {
    kbvSetMethod(null);
    kbvLog("method: do nothing - " + kbvReadout());
  });

  document.getElementById("rigKbvShrink").addEventListener("click", function () {
    kbvSetMethod(function () {
      if (!window.visualViewport) return null;
      function sync() {
        kbvScreen.style.height = window.visualViewport.height + "px";
        kbvLog("method: shrink to visualViewport - " + kbvReadout());
      }
      window.visualViewport.addEventListener("resize", sync);
      sync();
      return function () {
        window.visualViewport.removeEventListener("resize", sync);
      };
    });
  });

  document.getElementById("rigKbvShift").addEventListener("click", function () {
    kbvSetMethod(function () {
      if (!window.visualViewport) return null;
      function sync() {
        var covered = window.innerHeight - window.visualViewport.height;
        kbvScreen.style.transform = "translateY(-" + Math.round(covered / 2) + "px)";
        kbvLog("method: shift up half the covered height - " + kbvReadout());
      }
      window.visualViewport.addEventListener("resize", sync);
      sync();
      return function () {
        window.visualViewport.removeEventListener("resize", sync);
      };
    });
  });

  document.getElementById("rigKbvFocus").addEventListener("pointerdown", function (event) {
    event.preventDefault();
    kbvInput.focus();
    setTimeout(function () {
      kbvLog(kbvReadout("focused"));
    }, 300);
  });

  document.getElementById("rigKbvBlur").addEventListener("pointerdown", function (event) {
    event.preventDefault();
    kbvInput.blur();
    setTimeout(function () {
      kbvLog(kbvReadout("blurred"));
    }, 300);
  });
})();
