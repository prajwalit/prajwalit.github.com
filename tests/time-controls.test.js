import test from 'node:test';
import assert from 'node:assert/strict';
import { createSkyClock } from '../scripts/time-controls.js';
import { DAY_CYCLE_DURATION } from '../scripts/sunset.js';
const settle = clock => { for (let i=0;i<300;i++) clock.tick(1/60); };
test('sky clock advances, holds, and resumes independently', () => {
  const clock=createSkyClock();
  assert.equal(clock.tick(240),240);
  clock.toggle(); assert.equal(clock.tick(20),240);
  clock.toggle(); assert.equal(clock.tick(20),260);
});
test('selecting light transitions smoothly then holds the selected moment', () => {
  const clock=createSkyClock();clock.select(.3);
  assert.equal(clock.paused,true);assert.equal(clock.time,0);
  clock.tick(.1);assert.ok(clock.time>0 && clock.time<864);
  settle(clock);assert.equal(clock.time,864);
  assert.equal(clock.tick(30),864);
  clock.toggle();assert.equal(clock.tick(30),894);
});
test('time selection takes the short route across the cycle boundary', () => {
  const clock=createSkyClock();clock.select(.99);settle(clock);
  assert.ok(Math.abs(clock.time+DAY_CYCLE_DURATION*.01)<1e-8);
  clock.select(0);settle(clock);assert.equal(clock.time,0);
  clock.select(1);settle(clock);assert.equal(clock.time,0);
});
test('reduced-motion clock starts still but permits manual time selection', () => {
  const clock=createSkyClock(true);assert.equal(clock.tick(60),0);
  clock.select(.25);settle(clock);assert.equal(clock.time,720);
  assert.equal(clock.paused,true);
});
