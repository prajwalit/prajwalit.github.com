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
    "journeyStarted=true; summitReady=true; panoramaElapsed=180; updateJourneyControl();",
  );
  assert.match(env.get("#play").innerHTML, /Pause panorama/);
  env.get("#play").onclick();
  assert.match(env.get("#play").innerHTML, /Resume panorama/);
  env.get("#play").onclick();
  assert.match(env.get("#play").innerHTML, /Pause panorama/);
});
test("reduced motion begins with the panorama paused", async () => {
  const env = await setup({ reduced: true });
  env.run("journeyStarted=true; summitReady=true; updateJourneyControl();");
  assert.match(env.get("#play").innerHTML, /Resume panorama/);
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
