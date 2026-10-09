import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/vendor/three.module.js";
import {
  explorerFloor,
  constrainExplorer,
  moveExplorer,
  createExplorer,
} from "../scripts/explore.js";

test("exploration stays above water, nearby terrain and inside world bounds", () => {
  const ground = (x, z) => (x > 10 ? 400 : 100);
  assert.equal(explorerFloor(0, 0, ground), 430);
  const p = new THREE.Vector3(99999, -20, -99999);
  constrainExplorer(p, ground);
  assert.equal(p.x, 7800);
  assert.equal(p.z, -13500);
  assert.ok(p.y >= 430);
  p.set(0, -100, 0);
  constrainExplorer(p, () => -100);
  assert.equal(p.y, 40);
  p.y = 5000;
  constrainExplorer(p, () => 0);
  assert.equal(p.y, 3300);
});
test("movement follows view heading, normalizes diagonals and stops smoothly", () => {
  const run = (input, yaw = 0) => {
    const p = new THREE.Vector3(0, 500, 0),
      v = new THREE.Vector3();
    for (let i = 0; i < 120; i++)
      moveExplorer(p, v, input, yaw, 0, 1 / 60, () => 0);
    return { p, v };
  };
  const straight = run({ forward: 1, right: 0, up: 0 });
  const diagonal = run({ forward: 1, right: 1, up: 0 });
  assert.ok(straight.p.z < -400);
  assert.ok(
    Math.abs(Math.hypot(diagonal.p.x, diagonal.p.z) + straight.p.z) < 1e-6,
  );
  assert.ok(run({ forward: 1, right: 0, up: 0 }, Math.PI / 2).p.x < -400);
  for (let i = 0; i < 120; i++)
    moveExplorer(
      straight.p,
      straight.v,
      { forward: 0, right: 0, up: 0 },
      0,
      0,
      1 / 60,
      () => 0,
    );
  assert.ok(straight.v.length() < 0.001);
});
test("a stalled frame cannot teleport through a ridge or travel an unbounded distance", () => {
  const p = new THREE.Vector3(0, 80, 0),
    v = new THREE.Vector3(240, 0, 0);
  moveExplorer(p, v, { forward: 0, right: 1, up: 0 }, 0, 0, 20, (x) =>
    x > 5 ? 300 : 0,
  );
  assert.ok(p.x <= 12);
  assert.ok(p.y >= 330);
});

function setup(t, reduced = false) {
  class Node extends EventTarget {
    style = {};
    hidden = true;
    disabled = false;
    textContent = "";
    focused = false;
    classList = { add() {}, remove() {} };
    focus() {
      this.focused = true;
    }
    setPointerCapture() {}
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 106, height: 106 };
    }
    querySelector() {
      return (this.knob ??= new Node());
    }
  }
  const nodes = new Map();
  const get = (id) => {
    if (!nodes.has(id)) nodes.set(id, new Node());
    return nodes.get(id);
  };
  const page = new EventTarget();
  page.body = new Node();
  page.hidden = false;
  page.modal = false;
  page.querySelector = (id) =>
    id === "dialog[open]" ? (page.modal ? {} : null) : get(id);
  const events = new EventTarget();
  const oldDocument = globalThis.document,
    oldAdd = globalThis.addEventListener;
  globalThis.document = page;
  globalThis.addEventListener = events.addEventListener.bind(events);
  t.after(() => {
    globalThis.document = oldDocument;
    globalThis.addEventListener = oldAdd;
  });
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 500, 0);
  const changes = [];
  const control = createExplorer(camera, () => 0, {
    reduced,
    onChange: (value) => changes.push(value),
  });
  const emit = (target, type, values = {}) => {
    const e = new Event(type, { cancelable: true });
    Object.assign(e, values);
    target.dispatchEvent(e);
    return e;
  };
  const frame = () => {
    camera.position.set(0, 500, 0);
    camera.quaternion.identity();
    control.update(1 / 60);
  };
  return { control, camera, changes, get, page, events, emit, frame };
}
test("free mode moves independently, clears held keys on blur and returns exactly to summit", (t) => {
  const { control, camera, changes, get, events, emit, frame } = setup(t);
  control.enter();
  assert.equal(control.active, true);
  assert.equal(get("#explore-ui").hidden, false);
  emit(events, "keydown", { code: "KeyW" });
  for (let i = 0; i < 60; i++) frame();
  assert.ok(camera.position.z < -100);
  emit(events, "blur");
  const stopped = camera.position.clone();
  for (let i = 0; i < 30; i++) frame();
  assert.ok(camera.position.distanceTo(stopped) < 1e-6);
  emit(events, "keydown", { code: "Escape" });
  for (let i = 0; i < 120; i++) frame();
  assert.equal(control.active, false);
  assert.equal(get("#explore-ui").hidden, true);
  assert.ok(camera.position.distanceTo(new THREE.Vector3(0, 500, 0)) < 1e-6);
  assert.deepEqual(changes, [true, false]);
});
test("touch look and joystick can operate together; cancellation and dialogs stop movement", (t) => {
  const { control, camera, get, page, emit, frame } = setup(t);
  control.enter();
  emit(get("#explore-look"), "pointerdown", {
    pointerId: 1,
    clientX: 200,
    clientY: 200,
    pointerType: "touch",
  });
  emit(get("#explore-look"), "pointermove", {
    pointerId: 1,
    clientX: 300,
    clientY: 210,
  });
  emit(get("#explore-stick"), "pointerdown", {
    pointerId: 2,
    clientX: 53,
    clientY: 15,
  });
  for (let i = 0; i < 60; i++) frame();
  assert.ok(camera.position.length() > 500);
  assert.ok(Math.abs(camera.quaternion.y) > 0.05);
  emit(get("#explore-stick"), "pointercancel", { pointerId: 2 });
  page.modal = true;
  frame();
  const p = camera.position.clone();
  for (let i = 0; i < 60; i++) frame();
  assert.ok(camera.position.distanceTo(p) < 1e-6);
  page.modal = false;
  control.leave(true);
  assert.equal(control.active, false);
});
test("reduced motion exits immediately and hidden tabs clear held input", (t) => {
  const { control, camera, page, events, emit, frame } = setup(t, true);
  control.enter();
  emit(events, "keydown", { code: "KeyE" });
  frame();
  page.hidden = true;
  emit(page, "visibilitychange");
  const p = camera.position.clone();
  frame();
  assert.ok(camera.position.distanceTo(p) < 1e-6);
  control.leave();
  assert.equal(control.active, false);
});

test("expanded perimeter still enforces mountain clearance beyond the former bounds", () => {
  const ground = (x, z) => x > 5900 && z < -9500 ? 2200 : -20;
  const p = new THREE.Vector3(6000, 80, -10000);
  const v = new THREE.Vector3();
  for (let frame=0; frame<120; frame++) {
    moveExplorer(p, v, { forward:1, right:0, up:-1 }, 0, 0, 1/60, ground);
    assert.ok(p.y >= explorerFloor(p.x, p.z, ground));
  }
  assert.ok(p.x > 5200 && p.z < -9000);
  assert.ok(p.y >= 2230);
});
