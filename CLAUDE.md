# CLAUDE.md

Personal site at **prajwalit.com** — static GitHub Pages, no build step, no runtime
dependencies. Five chapters of plain HTML with a Three.js procedural mountain-fjord
landscape layered over them, flown through on scroll.

`README` is the living design spec: bounds, timings, instance counts, rationale.
Read the section relevant to your change before touching code, and update it after
(see Workflow below).

## Layout

```
index.html          all content + metadata, server-rendered; GA4; reload-scroll shim
styles/journey.css  dark-only; :root tokens --ivory/--muted/--accent
scripts/journey.js  the only place Three.js scene setup lives (~790 lines)
scripts/*.js        mostly pure modules, unit-tested in plain node
assets/vendor/      Three.js 0.170.0 + Water, locally vendored and patched
tests/*.test.js     77 tests, node --test, ~144 lines of hand-rolled DOM mocks
```

## Architecture

**`journey.js` owns the scene and the frame.** It builds terrain, sky, water, camera
path, then runs one `render(now)` loop that drives everything: camera position and
gaze, panorama turn, panel opacity/`inert`, captions, progress bar, place name. There
is no state manager — module-scope `let` plus the loop. Nothing else creates a
renderer, light, or render target.

**Everything else is a factory returning an update function.** `createSunset`,
`createSkyClock`, `createExplorer`, `createWallpaper`, `createBirdFlight`,
`createShootingStarFlight`, `createScreenWakeLock`, `addDiscoveries`, `addVegetation`.
They receive the objects they mutate and return closures — no imports of `journey.js`,
so the dependency graph stays a tree and the modules stay testable.

**Two shared helpers**, both tiny on purpose: `seeded-random.js` holds the one
deterministic hash behind every procedural placement (change it and the
landscape changes), and `pointer.js` holds `onPointerRelease` — a gesture ends on
release, cancellation *and* lost capture — plus `closeOnOutsidePress`, the single
dismissal gesture every dialog uses.

**Pure geometry/math lives apart from DOM:** `camera-progress.js`, `panorama.js`,
`sunset.js` (`dayCycleState`), `time-controls.js` (`cycleToDial`/`dialToCycle`),
`vegetation.js` (`habitat`/`sampleGround`), `explore.js` (`explorerFloor`/
`constrainExplorer`/`moveExplorer`), `wallpaper.js` (`wallpaperSize`/`renderWallpaper`),
`visible-sky.js`. These are the parts with real test coverage — keep new logic in this
shape where you can.

### Load-bearing details

- **`body` starts `.no-webgl`.** `journey.js` removes it on success; the `start().catch`
  handler puts it back and clears `[inert]`. The readable page is the default, not a
  fallback — never invert this.
- **Terrain is sampled two ways, deliberately.** `terrainHeight(x,z)` is the analytic
  field, used only for camera clearance. Everything that must *look* attached to the
  ground (tree roots, flowers, bird/star sky checks, explorer floor) goes through
  `sampleGround(terrainGeometry, …)`, which interpolates the actual rendered triangles —
  including picking the correct half of each quad. Mixing these up makes props float.
- **Scroll is the single source of truth for route position, but must not feed back.**
  `autoplayTarget` holds the camera clock in floating-point route space; DOM `scrollY`
  rounds to pixels, so autoplay writes to scroll and never reads from it.
- **Reduced motion is threaded through, not bolted on.** `reduced` disables ambient
  animation and camera smoothing, hides birds and stars, starts both the panorama and
  the sky clock paused, and makes returns instant. Any new motion needs a `reduced` path.
- **Hidden tabs stop clocks.** `render` early-returns on `document.hidden`;
  bird/star schedulers detect time going backwards and reset. Open dialogs also pause
  the panorama, autoplay, and the wake lock.
- **One shadowed directional light, reused.** `createSunset` swaps it between sun and
  moon at near-zero intensity as they cross the horizon. Vegetation and discoveries
  `receiveShadow` but never cast — thousands of tiny casters is the thing being avoided.
- **The day cycle reaches the props through one value.** `createSunset`'s update
  returns the `dayCycleState` it already computed, and `render` threads `night` into
  `discoveries.update`, which is how birds know to roost. Read the cycle from that
  return rather than calling `dayCycleState` again in the frame.
- **Vendor patches are intentional.** `Water.js` carries local changes (multisampled
  mipmapped reflections, viewport-aware target sizing capped at 1536px long edge) and
  `journey.js` string-patches its fragment shader at runtime to fade subpixel ripples by
  screen-space footprint. `terrainMaterial.onBeforeCompile` similarly injects world-space
  grain. When editing these, keep `customProgramCacheKey` in step with the shader source.
- **Mobile GPU precision is a recurring bug class.** The sky vertex shader declares
  `highp`, and `sky-shader.js` squares signed distances directly because `pow()` with a
  negative base is undefined. The most recent commit is a fix in exactly this area.

## Workflow

Node 20+. No install step.

```
npm test                              # 77 tests, must stay green
npm run check                         # node --check on every script
git diff --check                      # whitespace
python3 -m http.server 8081 --bind 127.0.0.1
```

- **New script in `scripts/`?** Add it to the `check` chain in `package.json`.
- **Bump `?v=` on every change.** Each module is imported with a version specifier
  (`./sunset.js?v=6`). All importers of a module must agree — mismatched versions fetch
  and instantiate the module twice. `grep -ho 'from "\./[a-z-]*\.js[^"]*"' scripts/*.js |
  sort -u` should show one version per module. Entry points in `index.html` use a dated
  form (`journey.js?v=YYYYMMDD-n`) — bump the date and reset the counter, or
  increment the counter within a day. Assets (`favicon.svg?v=`,
  `silent-trail.m4a?v=`) follow the same dated scheme.
- **Update the `README`** in its existing prose voice whenever behavior, constants,
  bounds, timings, or counts change. It is maintained as the spec, not a stale readme.
- **Ship tests with new behavior.** Prefer extracting the logic as a pure function and
  testing it directly; for DOM-coupled code use `environment()` from `tests/helpers.js`,
  which strips imports and runs the real source in a `vm` context against mocked
  globals. `env.run("…")` pokes module-scope state directly. Because `load()`
  strips imports, anything a module calls at import time must also be injected
  into the vm context in `environment()` — that is why `createScreenWakeLock` and
  `closeOnOutsidePress` appear there.
- **Commits:** sentence-case imperative, no prefix or scope — "Fix mobile galaxy shader
  math and coordinate precision", "Soften cloud overlap while preserving sunset glow".
  **One logical change per commit**, even across several asks in one session.
  Commit each one as it is finished and tested, before starting the next — then
  its `?v=` bumps and doc edits land with the change that caused them. Batching
  the work and splitting afterwards does not work: `index.html`, `scripts/journey.js`
  and the `README` are touched by almost everything, so the version strings
  interleave and no hunk-level split leaves each commit self-consistent. The
  overlap is an argument for committing sooner, never for one combined commit.
  **Push only when asked** — master is live.
- Code style is Prettier-default-ish (2-space, double quotes, semicolons) but several
  newer modules are hand-compacted. Match the file you are in rather than reformatting.
- Comments explain *why* — GPU precision, autoplay policy, pixel-rounding feedback,
  what a constant protects against. Not what the line does. Follow that.

## Seeing the render

There is no GPU in the loop by default, and "I can't see it" has been the
limiting factor on every visual change. Headless Chrome plus CDP solves it, with
no dependencies — Node 22+ has a global `WebSocket`:

```
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --enable-unsafe-swiftshader \
  --user-data-dir=<scratch>/chrome-profile --remote-debugging-port=9222 \
  --window-size=1200,675 about:blank &
# poll http://127.0.0.1:9222/json/version until it answers, then over the
# websocket from /json/list: Page.enable -> Page.navigate -> wait -> Page.captureScreenshot
```

Then `Read` the PNG and actually look at it. Hard-won details:

- **`--virtual-time-budget` hangs this page.** The render loop never idles, so
  virtual time never completes. Drive it over CDP and wait in real time
  (~14s covers scene build), rather than using Chrome's bare `--screenshot`.
- **To reach a state, patch a copy, never the repo.** `tar` the project to the
  scratchpad, patch `createSkyClock`'s initial `time` there, serve that on
  another port. A patch in the working tree *will* be left behind when a
  command times out.
- `#hello` as the URL fragment deep-links to the summit, since `scroll-margin-top:
  -30vh` carries anchor navigation past the end of the route.
- SwiftShader says nothing about real GPU performance. Phone framerate still
  needs a phone.
- A standalone harness page that imports just `sky-shader.js` renders far
  faster than the whole site, when only the sky is in question.

## Constraints

- **Phone must work properly; desktop should feel premium.** A visual gain that breaks
  or stutters on a phone isn't acceptable; extra fidelity that only desktop can afford
  is. Gate cost by device where needed (`devicePixelRatio` is already capped at 1.6,
  reflection targets at 1536px, wallpaper resolution defaults down on coarse pointers
  and low `deviceMemory`).
- **Hold the render budget:** one shadowed light, no post-processing passes, no added
  render targets, no new image downloads. Prefer instancing, merged buffers, and `LOD`
  with a distance cull — the existing patterns in `vegetation.js` and `discoveries.js`.
- **No photographs or real-place reconstruction in the scene.** The landscape is
  explicitly imagined and makes no geographic claim. The portrait in the about
  dialog is the only photograph on the site, and it loads lazily.
- **Accessibility is part of the feature:** every control gets an accurate
  `aria-label`, dialogs use native modal focus handling and restore focus on close,
  inactive panels are `inert`, the dial is a real `role="slider"` with keyboard steps.
- **Prose in `index.html` is personal content.** Fix markup freely; don't rewrite the
  copy, bio, or captions without asking.
- `node_modules/` is in the repo but holds no packages — don't add dependencies.

## Not covered by tests

GPU rendering, actual browser autoplay policy, CSS layout, real wake-lock dimming,
search indexing. Verify those by hand: preview the five chapters, sound controls,
dialogs, summit pan, free exploration, and the time dial — with JavaScript disabled,
at a narrow viewport, and on a phone for the wake lock.
