# Mobile support

Make temp.dog playable on phones without a separate mobile page. All changes
live in the existing files, gated on a single `isMobile` flag plus CSS aspect
math.

## Problems

Rendered at 390x844 and 844x390 to confirm each of these.

1. **Portrait framing.** `.screen` is `inset: 4vmin`, so the canvas becomes a
   0.44-aspect sliver. The camera's `fov: 60` is vertical, so horizontal view is
   `2*atan(tan(30deg) * aspect)`. At 0.44 the PC, TV, bed and couch are all off
   frame. Landscape (844x390) already looks better than desktop.
2. **No hover means no game.** Tooltips, the ring cursor and the camera look-at
   are all driven by `pointermove`. Touch has no pointer between taps.
3. **Back navigation is invisible.** `inBand` is the left/right 15% of the
   canvas plus the Escape key. At 366px wide that is a 55px strip per side that
   short-circuits picking, and phones have no Escape.
4. **`sampleCursorColor()` runs `gl.readPixels` every frame** to tint a cursor
   that is `display: none` on coarse pointers.
5. **Touch hygiene.** No `touch-action`, so double-tap zoom and pull-to-refresh
   fire. `viewport-fit=cover` is set but nothing reads `env(safe-area-inset-*)`,
   so the notch clips the gear and textbox in landscape.
6. **Dead controls.** iOS Safari has no element fullscreen, so that toggle does
   nothing there.

Rejected: letterboxing the canvas to the desktop aspect. It frames the room
correctly but leaves a small card at the top of the phone with dead background
below it, and no alignment of that card hides the seam where the floor art is
cut off.
Out of scope: the terminal's sudo password prompt stays desktop-only. Every
other terminal command is reachable through its `[link]`, so only `secret.txt`
is affected.

## Design

### The flag

`textbox.js` exports `isMobile = !fine` alongside the existing `fine` and
`reduce`. `script.js` stamps `html.is-mobile` for CSS. It drives behaviour:
two-stage tap, back button, tooltip pinning, skipping pointer-driven parallax.

It does not drive the letterbox. That problem is caused by aspect ratio, not by
the device, so a narrow desktop window breaks identically. One CSS rule fixes
both.

### Portrait framing

three.js `fov` is vertical, so horizontal view is a function of aspect and a
narrow window shears the room off left and right. Portrait instead locks the
*horizontal* view and lets the vertical grow, which is the same framing
desktop gets plus extra floor and wall:

    fov = 2 * atan(tan(base / 2) * REF_ASPECT / aspect)

with `REF_ASPECT = 1.45` (the desktop aspect, where this returns the scene's
authored 60) and a `MAX_FOV = 125` guard so an unusually tall viewport crops
horizontally rather than going fisheye. At or above the reference aspect it
returns the authored fov unchanged, so landscape and desktop are untouched.

A 390x844 phone lands at 124 degrees. Because the horizontal view is locked,
the room renders at the same pixel width at every aspect - widening only adds
vertical extent, it does not shrink the furniture. The canvas keeps filling
the inset viewport, so there is no letterbox and no seam.

Known tradeoff: the zoomed zones (`pc-screen`, `tv-screen`, `setup`) were
framed for the desktop aspect, so in portrait their subject sits in the middle
of a tall frame with empty wall above and desk below. The terminal is legible
but small. Tightening those zones would need a per-zone camera dolly and is
not done here.

### Two-stage tap

`stepZones()` already runs each frame off `pointerX/pointerY`, and on touch
those persist at the last tap, so selection state is free: after tap one
`hovered` stays set, the tooltip stays up and the camera keeps easing toward the
object. Tapping empty space clears it.

One new variable in the canvas `pointerdown` handler:

- empty space: clear `armed`
- a different target: `armed = target`, select only
- the same target: act, clear `armed`

Target resolution mirrors the existing action branch, so a `LOCKED` zone still
falls through to the object under it rather than arming an unusable zone.

The terminal keeps single-tap; its `[links]` are already discrete buttons.

`.cursor-tip` is currently hidden by the same coarse-pointer rule as `.cursor`.
Split them: keep `.cursor` hidden, and on mobile pin the tip just below the
canvas, clamped to stay on screen in landscape. Selection reads as label pill
plus camera lean plus the existing hover sound. No 3D outline.

### Back button

A mobile-only button mirroring the gear, top-left. `onZone()` toggles it on
`ZONES[name].parent`. Guarded by `blocked`, and added to the exclusion list in
`textbox.js`'s document-level advance listener so tapping it cannot both go back
and advance the textbox.

Edge bands stay, but `BACK_BAND` narrows to `0.08` on mobile so edge objects in
child zones stay reachable now that a visible control does the same job.

### Performance and hygiene

- Gate `sampleCursorColor()` on `fine`.
- Gate the parallax spring on `!isMobile`.
- `touch-action: manipulation` on body, `none` on `.game`,
  `-webkit-touch-callout: none`, `overscroll-behavior: none`.
- `env(safe-area-inset-*)` on the gear, back button and textbox.
- `.opt` to 46px and `.achv-close` to 40px on mobile; `.choice` from
  `--tb-w * 0.5` to `0.7` so option text stops wrapping.
- Feature-detect `requestFullscreen` and hide the row when absent. Needs
  `.opt[hidden] { display: none }` since `.opt` sets `display: flex`.

## Files

`index.html` (back button), `scripts/style.css` (most of it),
`scripts/textbox.js` (`isMobile`, advance exclusion), `scripts/script.js`
(html class, parallax gate, fullscreen detect), `scripts/game.js` (two-stage
tap, back wiring, band, readPixels gate). No new files.

## Verification

Render index.html in 390x844 and 844x390 iframes. Confirm the room is fully
framed in both, that a first tap labels an object and a second opens its
dialogue, that the back button appears only in child zones, and that
`/the-end` still reads correctly.
