# PC Mobile Usability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the in-game PC usable on phones: typing into the terminal brings up the on-screen keyboard, and the zoomed-in monitor is no longer tiny and mushy.

**Architecture:** Three independent, additive changes gated on the existing `isMobile` flag (`textbox.js`, `!fine`): a hidden `<input>` that bridges the OS virtual keyboard into the terminal's `pc.buffer` state, a camera dolly-in applied only to the `pc-screen` zone marker to cancel out the portrait FOV widening, and a moderate resolution bump to the terminal's canvas texture, changed at its source (the Godot `.tscn`) and re-exported.

**Tech Stack:** Vanilla JS (ES modules), three.js (`scripts/three.module.min.js`), a Python export script (`tools/build.py`) that turns a Godot `.tscn` into `scripts/scene.json`. No bundler, no test framework — this is a static site; verification throughout is manual (load `index.html` in a browser).

## Global Constraints

- Every change here is **mobile-only**: on desktop (`isMobile === false`), the game's behavior must be byte-for-byte the same as before (per spec, direction confirmed: "Mobile only (Recommended)" for the camera zoom).
- Keep the terminal's retro look "a bit chunky" — the resolution bump is a moderate increase (~1.5x), not a switch to fully crisp/antialiased text (per spec, direction confirmed: "Keep it a bit chunky").
- `scripts/scene.json` is generated output. Never hand-edit it — edit `.godot/temp.dog/tscn/scene.tscn` and regenerate.
- No new dependencies, no bundler, no build-step changes beyond running the existing `tools/build.py` (or the narrower scene-only regeneration in Task 1, which avoids its unrelated image side effect — see Task 1 step 2).

---

### Task 1: Bump terminal canvas resolution at the source

**Files:**
- Modify: `.godot/temp.dog/tscn/scene.tscn:434-455` (the `cmd` `Label3D` node)
- Modify (generated, do not hand-edit beyond the regeneration command below): `scripts/scene.json`

**Interfaces:**
- Produces: `scripts/scene.json`'s `labels[0]` (the `"n":"cmd"` entry) with updated `font`/`w`/`px` fields, consumed by `makeLabel()` in `scripts/game.js:343`.

- [ ] **Step 1: Edit the `cmd` Label3D node's resolution fields**

  In `.godot/temp.dog/tscn/scene.tscn`, the node currently reads (lines 433-456):

  ```
  [node name="cmd" type="Label3D" parent="." unique_id=1620706492 groups=["obj:monitor", "role:cmd", "zone:setup"]]
  transform = Transform3D(-9.1793915e-08, -0.59528387, 1.0190517, 0, 2.2216294, 0.27305412, -2.1, 2.6020684e-08, -4.4544166e-08, -3.8, 2.725, 0.825)
  pixel_size = 0.001
  double_sided = false
  modulate = Color(1, 0.9372549, 0.8352941, 1)
  text = "..."
  font = ExtResource("32_jikjf")
  font_size = 31
  outline_size = 0
  horizontal_alignment = 0
  vertical_alignment = 0
  autowrap_mode = 2
  justification_flags = 0
  width = 1000.0
  script = ExtResource("36_pc")
  ```

  Change exactly three values (leave `transform` and everything else untouched — scaling `pixel_size` down by the same factor `width`/`font_size` scale up keeps the label's on-screen world-space size identical, only the texel density increases):

  - `pixel_size = 0.001` → `pixel_size = 0.0006667`
  - `font_size = 31` → `font_size = 47`
  - `width = 1000.0` → `width = 1500.0`

- [ ] **Step 2: Regenerate `scripts/scene.json` — scene data only, not images**

  `tools/build.py`'s `main()` also re-encodes every texture via `ffmpeg` (`build_images()`), which is unrelated to this change and — confirmed by running it — produces a large unrelated diff across `images/game/*.webp` because those committed files currently don't byte-match a fresh export. Don't run `python3 tools/build.py` directly. Instead regenerate only the JSON:

  ```bash
  python3 -c "
  import sys, json
  sys.path.insert(0, 'tools')
  import build
  scene = build.build_scene()
  build.OUT_JSON.write_text(json.dumps(scene, separators=(',', ':')) + '\n')
  "
  ```

- [ ] **Step 3: Diff and scope-check the result**

  ```bash
  git diff scripts/scene.json
  ```

  Confirm the **only** change is inside the `"n":"cmd"` entry under `"labels"` (the `"font"`, `"w"`, `"px"` fields going from `31`/`1000.0`/`0.001` to `47`/`1500.0`/`0.0006667`).

  The source tree currently has pre-existing drift unrelated to this task: regenerating from the current `.tscn` also changes `"anim":{"map":"tv-frames","frames":8}` to `"anim":{"map":"frame0006"}` and nudges the `screen2` mesh's z-translation from `3.159576` to `3.169576`. **Do not carry those into this commit** — they're a separate, pre-existing inconsistency between the committed `scene.json` and the current Godot source that deserves its own investigation. If your diff shows them, hand-edit those two spots in `scripts/scene.json` back to their current committed values before staging, so this commit contains only the `cmd` label change. Mention the drift to whoever reviews this so it can be looked at separately.

- [ ] **Step 4: Manual verification — desktop unaffected**

  Serve the site locally (e.g. `python3 -m http.server` from the repo root) and open `index.html` in a normal desktop browser window. Navigate to the PC (setup zone → click the monitor). Confirm the terminal text is in the same position, wraps the same way, and is at least as readable as before — this step only increased resolution, so desktop should look the same or crisper, never worse or differently laid out.

- [ ] **Step 5: Commit**

  ```bash
  git add .godot/temp.dog/tscn/scene.tscn scripts/scene.json
  git commit -m "pc: bump terminal canvas resolution ~1.5x"
  ```

---

### Task 2: Compensate PC-screen camera zoom on mobile

**Files:**
- Modify: `scripts/game.js:653-674` (`gotoZone`)

**Interfaces:**
- Consumes: `isMobile` (imported from `./textbox.js`, already in scope at `game.js:12`), `fovFor(aspect)` (`game.js:1861`, hoisted function declaration — callable from `gotoZone` despite appearing later in the file), `camera` (`game.js:185`), `data.camera.fov` (loaded scene JSON), `markers` (`Map<string, {position: THREE.Vector3, rotation: THREE.Quaternion}>`, built in `buildZones()`).
- Produces: nothing consumed by later tasks — self-contained.

- [ ] **Step 1: Add the dolly-compensation helper just above `gotoZone`**

  In `scripts/game.js`, immediately before `function gotoZone(to, instant) {` (currently line 653), add:

  ```js
  // pc-screen's marker was framed assuming the desktop FOV. On mobile,
  // fovFor() widens the vertical FOV a lot to lock the horizontal FOV on
  // narrow/portrait screens (see resize()), which from that same fixed
  // camera position makes the monitor read as small and far away. Dolly
  // the camera forward (along the direction it's already facing) by
  // however much the FOV widened, so the monitor keeps roughly the same
  // on-screen size it has on desktop. Distance is an eyeballed constant,
  // not measured — this only needs to look right, not be exact.
  const PC_SCREEN_DOLLY_DISTANCE = 1.8;

  function zoneCameraPosition(name, marker) {
    if (name !== "pc-screen" || !isMobile) return marker.position;
    const baseFov = THREE.MathUtils.degToRad(data.camera.fov);
    const currentFov = THREE.MathUtils.degToRad(fovFor(camera.aspect));
    const ratio = Math.tan(baseFov / 2) / Math.tan(currentFov / 2);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(marker.rotation);
    const advance = PC_SCREEN_DOLLY_DISTANCE * (1 - ratio);
    return marker.position.clone().addScaledVector(forward, advance);
  }
  ```

- [ ] **Step 2: Use it in `gotoZone`**

  Change (currently the last two lines of the function, ~673-674):

  ```js
  const marker = markers.get(ZONES[zone].marker);
  setZone(marker.position, marker.rotation, instant);
  ```

  to:

  ```js
  const marker = markers.get(ZONES[zone].marker);
  setZone(zoneCameraPosition(zone, marker), marker.rotation, instant);
  ```

- [ ] **Step 3: Manual verification — desktop is a no-op**

  Serve locally, open in a normal desktop browser window, navigate into the PC screen. Since `fovFor(camera.aspect)` returns `data.camera.fov` at desktop aspect ratios (`resize()`/`fovFor` at `game.js:1861-1866`: aspect ≥ `REF_ASPECT` returns `base` unchanged), `ratio` is `1` and `advance` is `0` — framing must look pixel-identical to before this change.

- [ ] **Step 4: Manual verification — mobile framing looks right**

  `isMobile` is computed once at module load from `matchMedia("(pointer: fine)")` (`textbox.js:5-7`), which reflects the browser's real input capability, not window size — resizing a desktop Chrome window alone won't flip it. To check the framing visually without a phone, temporarily edit `textbox.js:7` from `export var isMobile = !fine;` to `export var isMobile = true;`, reload, resize the browser window to a narrow/tall size (e.g. 390x844) so `fovFor` widens, and navigate into the PC screen. The monitor should occupy roughly the same fraction of the viewport it does on desktop, not look small and distant. Adjust `PC_SCREEN_DOLLY_DISTANCE` up or down if it under/overshoots, then **revert the temporary `textbox.js` edit** before committing — it must not ship.

- [ ] **Step 5: Commit**

  ```bash
  git add scripts/game.js
  git commit -m "pc: dolly camera in on pc-screen zoom for mobile's widened fov"
  ```

---

### Task 3: Hidden-input keyboard bridge for terminal typing

**Files:**
- Modify: `index.html` (add one hidden `<input>`)
- Modify: `scripts/style.css` (styling for that input)
- Modify: `scripts/game.js:1444-1512` (terminal click/keydown handling)

**Interfaces:**
- Consumes: `isMobile` (already imported), `pc` state object (`game.js:1016`, fields `captured`, `on`, `mode`, `buffer`, `prompt`, `complete`), `ASK`/`PAGE` mode constants (`game.js:1006-1008`), `pc.label.fits(line)` (`game.js:372-374`), `suggest()` (`game.js:1061`), `clip(head, tail)` (`game.js:1072`), `submitLine(value)` (`game.js:1437`), `paint()` (`game.js:1110`), `terminalHitUV()` / `terminalPromptHit(uv)` / `terminalLinkAt(uv)` (`game.js:1444-1469`), `zoneBack()` (`game.js:676`), `gotoZone(to, instant)` (`game.js:653`, modified in Task 2 — independent of that change).
- Produces: `submitCurrentLine()` (new, replaces the duplicated Enter-submit logic in both the desktop keydown handler and the new mobile path) — no other task depends on it.

- [ ] **Step 1: Add the hidden input to `index.html`**

  Add this right after the `.screen` div (currently ends at line 62, i.e. insert after `</div>` on line 62):

  ```html
  <!-- mobile-only bridge: focusing this on tap summons the OS keyboard;
	       its value is resynced into pc.buffer on every input event -->
  <input
    id="pcInput"
    class="pc-input"
    type="text"
    autocomplete="off"
    autocorrect="off"
    autocapitalize="off"
    spellcheck="false"
    enterkeyhint="send"
    tabindex="-1"
    aria-hidden="true"
  />
  ```

- [ ] **Step 2: Style it invisible but focusable**

  Add to `scripts/style.css` (e.g. near the other utility/shell rules — placement within the file doesn't matter, there's no cascade dependency):

  ```css
  /* mobile terminal keyboard bridge: must stay focusable (no display:none /
     visibility:hidden, either of which stops the OS keyboard from opening) */
  .pc-input {
    position: fixed;
    top: 0;
    left: 0;
    width: 1px;
    height: 1px;
    padding: 0;
    border: none;
    outline: none;
    opacity: 0;
    pointer-events: none;
  }
  ```

- [ ] **Step 3: Look up the element and add a `submitCurrentLine()` helper in `game.js`**

  Near the other `document.getElementById` calls (currently `game.js:180-182`), add:

  ```js
  const pcInput = document.getElementById("pcInput");
  ```

  Immediately before `function tryTerminalClick() {` (currently line 1471), add:

  ```js
  // shared by desktop Enter and the mobile keyboard bridge's Enter
  function submitCurrentLine() {
    let value = pc.buffer;
    if (pc.complete) {
      const hint = suggest();
      if (hint) value = clip(pc.prompt, hint);
    }
    submitLine(value);
  }

  function openPcKeyboard() {
    pcInput.value = pc.buffer;
    pcInput.focus();
  }

  function closePcKeyboard() {
    if (document.activeElement === pcInput) pcInput.blur();
  }

  // re-derives pc.buffer from pcInput's current value on every native input
  // event, clamped to the same width limit desktop typing already respects.
  // Reading the whole value fresh (rather than trying to interpret discrete
  // keystrokes) is what makes this correct across autocorrect/predictive-text
  // rewrites: it doesn't matter how the value changed, only what it is now.
  function pcInputOnInput() {
    if (!pc.captured || !pc.on || pc.mode !== ASK) return;
    let next = "";
    for (const ch of pcInput.value) {
      if (!pc.label.fits(pc.prompt + next + ch)) break;
      next += ch;
    }
    pc.buffer = next;
    if (pcInput.value !== next) pcInput.value = next;
    paint();
  }

  pcInput.addEventListener("input", pcInputOnInput);
  pcInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    submitCurrentLine();
    pcInput.value = "";
  });
  ```

- [ ] **Step 4: Open the keyboard on tap, only on mobile**

  Change `tryTerminalClick()` (currently `game.js:1471-1484`) from:

  ```js
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
  ```

  to:

  ```js
  function tryTerminalClick() {
    const uv = terminalHitUV();
    if (!uv) return;
    if (isMobile && pc.mode === ASK) openPcKeyboard();
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
  ```

- [ ] **Step 5: Keep desktop's physical-keyboard path exclusive to desktop**

  Without this, a physical keystroke could be applied twice on a mobile browser with a keyboard attached (once by this handler mutating `pc.buffer` directly, once by the `input` event on the now-focused `pcInput` via Step 3's resync). Change the top of the existing global handler (currently `game.js:1486-1487`):

  ```js
  window.addEventListener("keydown", (event) => {
    if (!pc.captured || !pc.on) return;
  ```

  to:

  ```js
  window.addEventListener("keydown", (event) => {
    if (!pc.captured || !pc.on || isMobile) return;
  ```

  Then simplify its own `Enter` case (currently lines 1494-1502) from:

  ```js
  if (event.key === "Enter") {
    let value = pc.buffer;
    if (pc.complete) {
      const hint = suggest();
      if (hint) value = clip(pc.prompt, hint);
    }
    submitLine(value);
    return;
  }
  ```

  to:

  ```js
  if (event.key === "Enter") {
    submitCurrentLine();
    return;
  }
  ```

  (`submitCurrentLine()` from Step 3 does exactly what the inline block did.)

- [ ] **Step 6: Close the keyboard when leaving the PC**

  Change the start of `gotoZone` (currently `game.js:653-654`):

  ```js
  function gotoZone(to, instant) {
    if (!ZONES[to] || to === zone) return;
  ```

  to:

  ```js
  function gotoZone(to, instant) {
    if (!ZONES[to] || to === zone) return;
    closePcKeyboard();
  ```

- [ ] **Step 7: Manual verification — desktop unaffected**

  Serve locally, open in a normal desktop browser. Navigate into the PC, type a command (e.g. `help`) using a physical keyboard, press Enter, confirm it still works exactly as before. Nothing here should differ from pre-change behavior since `isMobile` is `false`.

- [ ] **Step 8: Manual verification — mobile typing**

  Using the same temporary `textbox.js` `isMobile = true` override from Task 2 Step 4 (or a real phone / Chrome remote debugging against a real device, which is the more trustworthy check since it exercises a real virtual keyboard and real autocorrect): tap the terminal while it's showing the `temp@temp ~$` prompt. Confirm:
  - The on-screen keyboard opens (on a real device) or the input is focused (verify via devtools: `document.activeElement.id === "pcInput"`).
  - Typing appends characters to what's displayed on the terminal.
  - Backspace removes characters.
  - Pressing Enter (or the keyboard's send/return key) submits the line and the terminal responds.
  - Typing a long line that would exceed `pc.label.fits(...)` stops accepting further characters rather than overflowing the display.
  - Navigating back out of the PC (back button or swipe/tap-outside per the existing mobile back gesture) blurs the input.

  Revert the temporary `textbox.js` edit afterward if you used it — it must not ship.

- [ ] **Step 9: Commit**

  ```bash
  git add index.html scripts/style.css scripts/game.js
  git commit -m "pc: hidden-input keyboard bridge for mobile terminal typing"
  ```
