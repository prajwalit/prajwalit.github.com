import test from "node:test";
import assert from "node:assert/strict";
import { MathUtils } from "../assets/vendor/three.module.js";
import {
  cameraProgress,
  journeyScrollDistance,
} from "../scripts/camera-progress.js";

test("opening moves promptly and rejoins the existing ascent", () => {
  assert.equal(cameraProgress(0), 0);
  assert.ok(cameraProgress(0.01) > 0.003);
  for (const p of [0.25, 0.5, 0.75, 0.96, 1])
    assert.equal(cameraProgress(p), MathUtils.smootherstep(p, 0, 0.96));
});
test("camera never reverses or overshoots as the opening boost fades", () => {
  let previous = 0;
  for (let i = 0; i <= 10000; i++) {
    const next = cameraProgress(i / 10000);
    assert.ok(next >= previous && next <= 1);
    previous = next;
  }
});

test("autoplay covers the full scroll range in 75 seconds at different sizes and frame rates", () => {
  for (const range of [3000, 4070, 5500]) {
    for (const fps of [15, 30, 60, 120]) {
      let distance = 0;
      for (let frame = 0; frame < 75 * fps; frame++)
        distance += journeyScrollDistance(1 / fps, range);
      assert.ok(Math.abs(distance - range) < 1e-6);
    }
  }
});
