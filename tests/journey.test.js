import test from "node:test";
import assert from "node:assert/strict";
import { environment, settle } from "./helpers.js";

async function setup(options) {
  const env = environment(options);
  env.load("scripts/journey.js");
  await settle();
  return env;
}
test("WebGL failure reveals the readable page and removes inert panels", async () => {
  const env = await setup();
  assert.ok(env.document.body.classList.contains("no-webgl"));
  assert.ok(env.get("#loading").classList.contains("done"));
  assert.equal(env.inertPanel.inert, false);
});
test("start dispatches sound gesture and manual input pauses the journey", async () => {
  const env = await setup();
  let starts = 0;
  env.document.addEventListener("journey:start", () => starts++);
  env.get("#play").onclick();
  assert.equal(starts, 1);
  assert.match(env.get("#play").innerHTML, /Pause journey/);
  env.events.dispatchEvent(new Event("wheel"));
  assert.match(env.get("#play").innerHTML, /Resume journey/);
});
test("summit controls only pause and resume, even after a full revolution", async () => {
  const env = await setup();
  env.run(
    "journeyStarted=true; summitReady=true; panoramaPaused=false; panoramaElapsed=180; updateJourneyControl();",
  );
  assert.match(env.get("#play").innerHTML, /Pause panorama/);
  env.get("#play").onclick();
  assert.match(env.get("#play").innerHTML, /Resume panorama/);
  env.get("#play").onclick();
  assert.match(env.get("#play").innerHTML, /Pause panorama/);
});
for (const reduced of [false, true]) test(`summit waits for explicit panorama start (reduced motion: ${reduced})`, async () => {
  const env = await setup({ reduced });
  env.run("journeyStarted=true; summitReady=true; updateJourneyControl();");
  assert.equal(env.run("panoramaPaused"), true);
  assert.match(env.get("#play").innerHTML, /Start panorama/);
  env.get("#play").onclick();
  assert.equal(env.run("panoramaPaused"), false);
  assert.match(env.get("#play").innerHTML, /Pause panorama/);
});
test("horizontal summit input pans and pauses; vertical and pinch gestures remain native", async () => {
  const env = await setup();
  env.run("journeyStarted=true; summitReady=true;");
  function wheel(x, y, ctrlKey = false) {
    const event = new Event("wheel", { cancelable: true });
    Object.assign(event, {
      deltaX: x,
      deltaY: y,
      deltaMode: 0,
      ctrlKey,
      shiftKey: false,
    });
    env.events.dispatchEvent(event);
    return event;
  }
  assert.equal(wheel(0, 80).defaultPrevented, false);
  assert.equal(wheel(80, 0, true).defaultPrevented, false);
  assert.equal(wheel(80, 0).defaultPrevented, true);
  assert.equal(env.run("panTarget"), 0.16);
  assert.equal(env.run("panoramaPaused"), true);
});

test("replay resets summit orientation and restarts automatic travel", async () => {
  const env = await setup();
  env.run(
    "journeyStarted=true; summitReady=true; position=1; panoramaElapsed=34; panTarget=2; panOffset=2; panoramaPaused=true;",
  );
  let starts = 0;
  env.document.addEventListener("journey:start", () => starts++);
  const replay = env.get("#restart-journey").onclick();
  assert.equal(env.run("position"), 1);
  assert.equal(env.run("automatic"), false);
  env.animations[0].finish();
  await settle();
  assert.equal(env.run("position"), 0);
  assert.equal(env.run("automatic"), false);
  env.animations[1].finish();
  await replay;
  for (const field of ["position", "panoramaElapsed", "panTarget", "panOffset"])
    assert.equal(env.run(field), 0);
  assert.equal(env.run("summitReady"), false);
  assert.equal(env.run("panoramaPaused"), true);
  assert.equal(env.run("automatic"), true);
  assert.equal(env.scrolls.at(-1).top, 0);
  assert.equal(env.scrolls.at(-1).behavior, "instant");
  assert.equal(starts, 0);
  assert.match(env.get("#play").innerHTML, /Pause journey/);
});

for (const type of ["pointerdown", "touchstart", "keydown"]) {
  test(`sound activation via ${type} leaves automatic travel running`, async () => {
    const env = await setup();
    env.load("scripts/ambience.js");
    await settle();
    env.get("#play").onclick();
    const event = new Event(type);
    Object.defineProperty(event, "target", {
      value: { closest: () => env.get("#sound-toggle") },
    });
    env.events.dispatchEvent(event);
    env.get("#sound-toggle").dispatchEvent(new Event("click"));
    await settle();
    assert.equal(env.audio.muted, true);
    assert.equal(env.run("automatic"), true);
    assert.match(env.get("#play").innerHTML, /Pause journey/);
  });
}

test("pause button activation pauses rather than stopping then resuming", async () => {
  const env = await setup();
  env.get("#play").onclick();
  const event = new Event("pointerdown");
  Object.defineProperty(event, "target", {
    value: { closest: () => env.get("#play") },
  });
  env.events.dispatchEvent(event);
  env.get("#play").onclick();
  assert.equal(env.run("automatic"), false);
  assert.match(env.get("#play").innerHTML, /Resume journey/);
});

test("scrolling over a footer control still pauses automatic travel", async () => {
  const env = await setup();
  env.get("#play").onclick();
  const event = new Event("wheel");
  Object.defineProperty(event, "target", {
    value: { closest: () => env.get("#sound-toggle") },
  });
  env.events.dispatchEvent(event);
  assert.equal(env.run("automatic"), false);
});

test("reduced-motion replay skips the fade and leaves audio alone", async () => {
  const env = await setup({ reduced: true });
  env.load("scripts/ambience.js");
  await settle();
  const plays = env.audio.playCount;
  await env.get("#restart-journey").onclick();
  assert.equal(env.animations.length, 0);
  assert.equal(env.run("automatic"), true);
  assert.equal(env.audio.playCount, plays);
  assert.equal(env.audio.pauseCount, 0);
});

test("pause and replay discard the previous automatic camera target", async () => {
  const env = await setup({ reduced: true });
  env.run("journeyStarted=true; automatic=true; autoplayTarget=.6;");
  env.get("#play").onclick();
  assert.equal(env.run("autoplayTarget"), null);
  env.run("autoplayTarget=.8;");
  await env.get("#restart-journey").onclick();
  assert.equal(env.run("autoplayTarget"), null);
});

function fakeExplorer(env) {
  env.run(
    "explorer = { active:false, calls:[], enter(o){ this.calls.push(o); this.active = true; } };",
  );
  return {
    calls: () => env.run("explorer.calls.length"),
    last: (field) => env.run(`explorer.calls.at(-1)?.${field} ?? null`),
  };
}
function key(env, code) {
  const event = new Event("keydown");
  Object.assign(event, { code });
  env.events.dispatchEvent(event);
}
function pointer(env, type, props, outside = true) {
  const event = new Event(type);
  Object.assign(event, { pointerType: "mouse", button: 0, pointerId: 1, ...props });
  Object.defineProperty(event, "target", {
    value: { closest: () => (outside ? null : {}) },
  });
  env.events.dispatchEvent(event);
}

test("summit movement keys enter free flight; scrolling keys still scroll", async () => {
  const env = await setup();
  const explorer = fakeExplorer(env);
  env.run("summitReady = true;");
  for (const code of ["ArrowDown", "ArrowUp", "Space", "KeyZ"]) key(env, code);
  assert.equal(explorer.calls(), 0);
  key(env, "KeyW");
  assert.equal(explorer.calls(), 1);
  assert.equal(explorer.last("returnLabel"), "summit");
  // Already flying, so a second press is the explorer's to handle.
  key(env, "KeyD");
  assert.equal(explorer.calls(), 1);
});

test("movement keys do nothing before the summit or behind a dialog", async () => {
  const env = await setup();
  const explorer = fakeExplorer(env);
  key(env, "KeyW");
  assert.equal(explorer.calls(), 0);
  env.run("summitReady = true;");
  env.get("#about").showModal();
  key(env, "KeyW");
  assert.equal(explorer.calls(), 0);
  env.get("#about").close();
  key(env, "KeyW");
  assert.equal(explorer.calls(), 1);
});

test("entering by key or drag never starts the soundtrack", async () => {
  const env = await setup();
  env.load("scripts/ambience.js");
  await settle();
  fakeExplorer(env);
  env.run("summitReady = true;");
  let announced = 0;
  env.document.addEventListener("journey:start", () => announced++);
  key(env, "KeyW");
  assert.equal(announced, 0);
});

test("dragging the scenery at the summit flies, past a threshold", async () => {
  const env = await setup();
  const explorer = fakeExplorer(env);
  env.run("summitReady = true;");
  // A click with a small wobble is not a drag.
  pointer(env, "pointerdown", { clientX: 100, clientY: 100 });
  pointer(env, "pointermove", { clientX: 106, clientY: 103 });
  assert.equal(explorer.calls(), 0);
  pointer(env, "pointerup", {});
  pointer(env, "pointermove", { clientX: 300, clientY: 300 });
  assert.equal(explorer.calls(), 0);
  // A real drag enters, and hands the gesture over so looking continues.
  pointer(env, "pointerdown", { clientX: 100, clientY: 100 });
  pointer(env, "pointermove", { clientX: 140, clientY: 100 });
  assert.equal(explorer.calls(), 1);
  assert.equal(explorer.last("drag.x"), 100);
  assert.equal(explorer.last("drag.id"), 1);
});

test("drags over text and controls, and touch drags, are left alone", async () => {
  const env = await setup();
  const explorer = fakeExplorer(env);
  env.run("summitReady = true;");
  pointer(env, "pointerdown", { clientX: 100, clientY: 100 }, false);
  pointer(env, "pointermove", { clientX: 300, clientY: 100 }, false);
  assert.equal(explorer.calls(), 0);
  pointer(env, "pointerdown", { clientX: 100, clientY: 100, pointerType: "touch" });
  pointer(env, "pointermove", { clientX: 300, clientY: 100, pointerType: "touch" });
  assert.equal(explorer.calls(), 0);
});
