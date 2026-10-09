import test from "node:test";
import assert from "node:assert/strict";
import { createScreenWakeLock } from "../scripts/screen-wake-lock.js";
import { environment, settle } from "./helpers.js";

function sentinel() {
  const lock = new EventTarget();
  lock.released = false;
  lock.release = async () => {
    lock.released = true;
    lock.dispatchEvent(new Event("release"));
  };
  return lock;
}
function setup(request) {
  const page = new EventTarget();
  page.hidden = false;
  const control = createScreenWakeLock({ wakeLock: { request } }, page);
  return {
    control,
    page,
    visibility(hidden) {
      page.hidden = hidden;
      page.dispatchEvent(new Event("visibilitychange"));
    },
  };
}

test("wake lock is held only while playing visibly; resumes after returning to the tab", async () => {
  const locks = [];
  const { control, visibility } = setup(async (type) => {
    assert.equal(type, "screen");
    const lock = sentinel();
    locks.push(lock);
    return lock;
  });
  assert.equal(locks.length, 0);
  control.setActive(true);
  await settle();
  control.setActive(true);
  await settle();
  assert.equal(locks.length, 1);
  visibility(true);
  await settle();
  assert.equal(locks[0].released, true);
  visibility(false);
  await settle();
  assert.equal(locks.length, 2);
  control.setActive(false);
  await settle();
  assert.equal(locks[1].released, true);
  visibility(true);
  visibility(false);
  await settle();
  assert.equal(locks.length, 2);
});

test("pending lock is released if playback stops before it is granted", async () => {
  let grant;
  const { control } = setup(
    () =>
      new Promise((resolve) => {
        grant = resolve;
      }),
  );
  control.setActive(true);
  control.setActive(false);
  const lock = sentinel();
  grant(lock);
  await settle();
  assert.equal(lock.released, true);
});

test("rapid pause/resume discards the old request and acquires for the current playback", async () => {
  const grants = [];
  const { control } = setup(
    () => new Promise((resolve) => grants.push(resolve)),
  );
  control.setActive(true);
  control.setActive(false);
  control.setActive(true);
  const stale = sentinel();
  grants[0](stale);
  await settle();
  assert.equal(stale.released, true);
  assert.equal(grants.length, 2);
  const current = sentinel();
  grants[1](current);
  await settle();
  assert.equal(current.released, false);
  control.setActive(false);
  await settle();
  assert.equal(current.released, true);
});

test("denial and OS revocation do not cause repeated requests every frame", async () => {
  let requests = 0;
  const { control } = setup(async () => {
    requests++;
    throw new Error("Power saving");
  });
  control.setActive(true);
  await settle();
  for (let i = 0; i < 100; i++) control.setActive(true);
  await settle();
  assert.equal(requests, 1);
  control.setActive(false);
  control.setActive(true);
  await settle();
  assert.equal(requests, 2);
  const lock = sentinel();
  let granted = 0;
  const other = setup(async () => {
    granted++;
    return lock;
  });
  other.control.setActive(true);
  await settle();
  await lock.release();
  other.control.setActive(true);
  await settle();
  assert.equal(granted, 1);
  assert.doesNotThrow(() =>
    createScreenWakeLock({}, new EventTarget()).setActive(true),
  );
});

test("journey controls release at pause and summit, and request again on replay", async () => {
  const env = environment({ reduced: true });
  const states = [];
  env.context.createScreenWakeLock = () => ({
    setActive: (value) => states.push(value),
  });
  env.load("scripts/journey.js");
  await settle();
  env.get("#play").onclick();
  assert.equal(states.at(-1), true);
  env.get("#play").onclick();
  assert.equal(states.at(-1), false);
  env.get("#play").onclick();
  assert.equal(states.at(-1), true);
  env.run("summitReady=true; updateJourneyControl();");
  assert.equal(states.at(-1), false);
  env.get("#play").onclick();
  assert.equal(states.at(-1), false);
  await env.get("#restart-journey").onclick();
  assert.equal(states.at(-1), true);
  env.run("stopPlayback();");
  assert.equal(states.at(-1), false);
});
