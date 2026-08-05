import { achValue, achievement, choice, ready, setLoadProgress, textbox, tooltip } from "./textbox.js";

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
})();
