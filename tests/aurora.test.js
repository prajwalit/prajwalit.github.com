import test from "node:test";
import assert from "node:assert/strict";
import {
  createAuroraEvent,
  AURORA_DURATION,
  AURORA_FROM,
  AURORA_UNTIL,
} from "../scripts/aurora.js";
import { dayCycleState, DAY_CYCLE_DURATION } from "../scripts/sunset.js";

const MIDNIGHT = 1 / 3;
const run = (event, fraction, seconds, step = 1) => {
  let last = 0;
  for (let t = 0; t < seconds; t += step) last = event.update(fraction, step);
  return last;
};

test("the window is the dark hours, eleven through two", () => {
  // Solar angle is PI at midnight, so an hour is PI/12 either side.
  const hour = (h) => {
    const want = Math.PI + (h - 24) * (Math.PI / 12);
    let lo = 0, hi = 1;
    for (let i = 0; i < 40; i++) {
      const m = (lo + hi) / 2;
      dayCycleState(m * DAY_CYCLE_DURATION).angle < want ? (lo = m) : (hi = m);
    }
    return (lo + hi) / 2;
  };
  assert.ok(Math.abs(hour(23) - AURORA_FROM) < 0.001);
  assert.ok(Math.abs(hour(26) - AURORA_UNTIL) < 0.001);
  // Fully dark throughout, so it never shows against a lit sky.
  for (const f of [AURORA_FROM, MIDNIGHT, AURORA_UNTIL])
    assert.equal(dayCycleState(f * DAY_CYCLE_DURATION).night, 1);
});

test("one aurora a night, fading up and out across its own duration", () => {
  const seen = [];
  const event = createAuroraEvent({
    onStart: () => seen.push("start"),
    onEnd: () => seen.push("end"),
  });
  assert.equal(event.update(0.1, 1), 0, "nothing in the evening");
  assert.equal(seen.length, 0);
  // Arriving at eleven starts it, from nothing.
  assert.equal(event.update(AURORA_FROM, 1), 0);
  assert.deepEqual(seen, ["start"]);
  assert.ok(run(event, MIDNIGHT, 20) > 0.9, "up to full within the fade-in");
  assert.ok(event.running);
  run(event, MIDNIGHT, AURORA_DURATION);
  assert.deepEqual(seen, ["start", "end"]);
  assert.equal(event.running, false);
  assert.equal(event.update(MIDNIGHT, 1), 0);
});

test("holding the dial inside the hours plays it once, not on a loop", () => {
  let starts = 0;
  const event = createAuroraEvent({ onStart: () => starts++ });
  event.update(MIDNIGHT, 1);
  run(event, MIDNIGHT, AURORA_DURATION + 60);
  assert.equal(starts, 1);
  // Still parked at midnight long afterwards, and it stays dark.
  assert.equal(run(event, MIDNIGHT, 600), 0);
  assert.equal(starts, 1);
});

test("it re-arms for the next night once the sky has left those hours", () => {
  let starts = 0;
  const event = createAuroraEvent({ onStart: () => starts++ });
  event.update(MIDNIGHT, 1);
  run(event, MIDNIGHT, AURORA_DURATION);
  assert.equal(starts, 1);
  event.update(0.75, 1); // noon
  event.update(MIDNIGHT, 1);
  assert.equal(starts, 2);
});

test("once begun it runs its full length, whatever the sky does", () => {
  const seen = [];
  const event = createAuroraEvent({
    onStart: () => seen.push("start"),
    onEnd: () => seen.push("end"),
  });
  event.update(MIDNIGHT, 1);
  run(event, MIDNIGHT, 30);
  // A sky at speed reaches dawn, then noon, long before the piece is over.
  assert.ok(event.update(0.62, 1) > 0, "still lit through sunrise");
  assert.ok(event.update(0.75, 1) > 0, "still lit at noon");
  assert.ok(event.running);
  assert.deepEqual(seen, ["start"], "nothing has ended it");
  // It ends on its own duration, and only then.
  run(event, 0.75, AURORA_DURATION);
  assert.deepEqual(seen, ["start", "end"]);
  assert.equal(event.running, false);
});

test("a fast sky cannot start a second one on top of the first", () => {
  let starts = 0;
  const event = createAuroraEvent({ onStart: () => starts++ });
  event.update(MIDNIGHT, 1);
  // Several whole cycles pass while the piece is still playing.
  for (let i = 0; i < 400; i++)
    for (const f of [MIDNIGHT, 0.5, 0.75, 0.95, 0.1]) event.update(f, 0.05);
  assert.equal(starts, 1);
});

test("reset stops a running aurora and lets the next night have one", () => {
  const seen = [];
  const event = createAuroraEvent({
    onStart: () => seen.push("start"),
    onEnd: () => seen.push("end"),
  });
  event.update(MIDNIGHT, 1);
  event.reset();
  assert.deepEqual(seen, ["start", "end"]);
  assert.equal(event.running, false);
  event.update(MIDNIGHT, 1);
  assert.equal(seen.filter((s) => s === "start").length, 2);
});
