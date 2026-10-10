import test from 'node:test';
import assert from 'node:assert/strict';
import { createSkyClock, cycleToDial, dialToCycle } from '../scripts/time-controls.js';
import { DAY_CYCLE_DURATION, dayCycleState } from '../scripts/sunset.js';
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

test('time speeds change rate without jumping or overriding pause', () => {
  const clock = createSkyClock();
  for (const speed of [1, 2, 4, 8, 16, 1]) {
    const before = clock.time;
    clock.setSpeed(speed);
    assert.equal(clock.time, before);
    assert.equal(clock.tick(10), before + 10 * speed);
    clock.toggle();
    const held = clock.time;
    clock.setSpeed(8);
    assert.equal(clock.tick(10), held);
    clock.toggle();
  }
});
test('manual selection remains exact at accelerated speed and resumes at that rate', () => {
  const clock = createSkyClock();
  clock.setSpeed(8); clock.select(.25); settle(clock);
  assert.equal(clock.time, DAY_CYCLE_DURATION / 4);
  clock.toggle();
  assert.equal(clock.tick(1), DAY_CYCLE_DURATION / 4 + 8);
});

test('dial cardinal points match the sun and opening position is northwest', () => {
  assert.ok(cycleToDial(0) > .875 && cycleToDial(0) < 1);
  for (const [dial, elevation] of [[0,0],[.25,-1],[.5,0],[.75,1]]) {
    assert.ok(Math.abs(dayCycleState(dialToCycle(dial)*DAY_CYCLE_DURATION).elevation-elevation)<1e-8);
  }
  for (const fraction of [0,.02,.2,.5,.8,.99]) {
    const difference = Math.abs(dialToCycle(cycleToDial(fraction))-fraction);
    assert.ok(Math.min(difference, 1-difference)<1e-8);
  }
});
