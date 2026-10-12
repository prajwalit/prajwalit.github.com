import test from 'node:test';
import assert from 'node:assert/strict';
import { environment, settle } from './helpers.js';

async function audioSetup(options) {
  const env = environment(options);
  env.load('scripts/ambience.js');
  await settle();
  return env;
}
test('blocked autoplay never claims sound is playing; a gesture retries', async () => {
  const env = await audioSetup({ blockedAudio: true });
  const button = env.get('#sound-toggle');
  assert.equal(button.getAttribute('aria-pressed'), 'false');
  assert.match(button.innerHTML, /Tap for sound/);
  env.audio.blocked = false;
  env.document.dispatchEvent(new Event('journey:start'));
  await settle();
  assert.equal(button.getAttribute('aria-pressed'), 'true');
  assert.equal(env.audio.loop, true);
});
test('saved mute survives starting a journey, and toggle persists unmute', async () => {
  const env = await audioSetup({ storedMute: 'true' });
  env.document.dispatchEvent(new Event('journey:start'));
  assert.equal(env.audio.muted, true);
  env.get('#sound-toggle').dispatchEvent(new Event('click'));
  await settle();
  assert.equal(env.audio.muted, false);
  assert.equal(env.storage.get('prajwalit-sound-muted'), 'false');
  env.get('#sound-toggle').dispatchEvent(new Event('click'));
  assert.equal(env.storage.get('prajwalit-sound-muted'), 'true');
});
test('music pauses in a hidden tab and resumes when visible', async () => {
  const env = await audioSetup();
  env.document.hidden = true;
  env.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(env.audio.pauseCount, 1);
  env.document.hidden = false;
  env.document.dispatchEvent(new Event('visibilitychange'));
  await settle();
  assert.equal(env.audio.playCount, 2);
});
test('unavailable local storage does not break the sound control', async () => {
  const env = await audioSetup({ storageUnavailable: true });
  env.get('#sound-toggle').dispatchEvent(new Event('click'));
  await settle();
  assert.equal(env.audio.muted, true);
});

test("entering exploration retries blocked audio and preserves saved mute", async () => {
  for (const muted of [false, true]) {
    const env = environment({ blockedAudio: true, storedMute: String(muted) });
    env.load("scripts/ambience.js");
    env.load("scripts/journey.js");
    await settle();
    const before = env.audio.playCount;
    env.audio.blocked = false;
    env.run("summitReady=true; explorer={active:false,enter(){this.active=true;}};");
    env.get("#explore-toggle").onclick();
    await settle();
    assert.equal(env.audio.playCount, before + (muted ? 0 : 1));
    assert.equal(env.audio.muted, muted);
    assert.equal(env.run("explorer.active"), true);
    if (!muted) assert.equal(env.get("#sound-toggle").getAttribute("aria-pressed"), "true");
  }
});

test("the aurora brings its own piece, and hands the soundtrack back", async () => {
  const env = environment();
  env.load("scripts/ambience.js");
  await settle();
  assert.equal(env.audio.playCount, 1);
  assert.equal(env.aurora.playCount, 0);
  // The aurora crosses in: its track starts, the soundtrack is left paused.
  env.document.dispatchEvent(new Event("aurora:start"));
  assert.equal(env.aurora.playCount, 1);
  assert.equal(env.aurora.volume, 0.8);
  assert.equal(env.audio.volume, 0);
  assert.equal(env.audio.pauseCount, 1);
  // And back again afterwards, with the aurora's piece rewound for next night.
  env.document.dispatchEvent(new Event("aurora:end"));
  assert.equal(env.audio.playCount, 2);
  assert.equal(env.audio.volume, 0.8);
  assert.equal(env.aurora.volume, 0);
  assert.equal(env.aurora.pauseCount, 1);
  assert.equal(env.aurora.currentTime, 0);
});

test("a muted visitor stays muted, and unmutes into the aurora's piece", async () => {
  const env = environment({ storedMute: "true" });
  env.load("scripts/ambience.js");
  await settle();
  env.document.dispatchEvent(new Event("aurora:start"));
  // Running but silent, exactly as the soundtrack behaves while muted.
  assert.equal(env.aurora.muted, true);
  assert.equal(env.aurora.playCount, 1);
  env.get("#sound-toggle").dispatchEvent(new Event("click"));
  await settle();
  // So unmuting is instant, and lands on the aurora's piece, not the other one.
  assert.equal(env.aurora.muted, false);
  assert.equal(env.aurora.volume, 0.8);
  assert.equal(env.audio.volume, 0);
});

test("a hidden tab pauses whichever piece is playing", async () => {
  const env = environment();
  env.load("scripts/ambience.js");
  await settle();
  env.document.dispatchEvent(new Event("aurora:start"));
  const before = env.aurora.pauseCount;
  env.document.hidden = true;
  env.document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(env.aurora.pauseCount, before + 1);
  env.document.hidden = false;
  env.document.dispatchEvent(new Event("visibilitychange"));
  await settle();
  assert.equal(env.aurora.playCount, 2);
});
