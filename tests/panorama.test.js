import test from 'node:test';
import assert from 'node:assert/strict';
import { advancePanorama, panoramaAngle } from '../scripts/panorama.js';

test('rotation continues for multiple full revolutions', () => {
  let elapsed = 0;
  for (let second = 0; second < 361; second++) elapsed = advancePanorama(elapsed, 1, true);
  assert.equal(elapsed, 1);
  assert.ok(panoramaAngle(advancePanorama(elapsed, 1, true)) > panoramaAngle(elapsed));
});
test('wrap is seamless and preserves the manually chosen heading', () => {
  const step = .02, offset = 1.7;
  const before = panoramaAngle(89.99, offset);
  const after = panoramaAngle(advancePanorama(89.99, step, true), offset);
  const travelled = Math.atan2(Math.sin(after - before), Math.cos(after - before));
  assert.ok(Math.abs(travelled - step * 2 * Math.PI / 90) < 1e-12);
});
test('pause preserves position and resume advances from that position', () => {
  assert.equal(advancePanorama(37, 50, false), 37);
  assert.equal(advancePanorama(37, 1, true), 38);
});
