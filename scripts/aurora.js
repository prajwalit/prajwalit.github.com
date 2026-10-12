// One aurora a night, starting between eleven and two. Solar angle sets the
// hour — PI at midnight, so an hour is PI/12 — and these are the cycle
// fractions those hours land on.
export const AURORA_FROM = 0.3014; // 23:00
export const AURORA_UNTIL = 0.3973; // 02:00
// Once begun it runs its full length in real seconds, so the piece playing
// underneath always finishes, whether the sky is paused or at sixteen times.
// The hours decide when it may start, not when it must stop.
export const AURORA_DURATION = 144; // Cloud Valley runs 143.6s
const FADE_IN = 10;
const FADE_OUT = 20;

function envelope(elapsed) {
  if (elapsed < 0 || elapsed >= AURORA_DURATION) return 0;
  const t = Math.min(elapsed / FADE_IN, (AURORA_DURATION - elapsed) / FADE_OUT, 1);
  return t * t * (3 - 2 * t);
}

export function createAuroraEvent({ onStart, onEnd } = {}) {
  let armed = true,
    elapsed = -1;
  return (fraction, realSeconds) => {
    const within = fraction >= AURORA_FROM && fraction <= AURORA_UNTIL;
    if (elapsed >= 0) {
      elapsed += Math.max(0, realSeconds);
      if (elapsed >= AURORA_DURATION) {
        elapsed = -1;
        onEnd?.();
      }
    } else if (armed && within) {
      armed = false;
      elapsed = 0;
      onStart?.();
    }
    // Re-arms only once the sky has left those hours with nothing running,
    // so holding the dial inside them plays it once rather than on a loop,
    // and a fast sky cannot start a second one on top of the first.
    if (!within && elapsed < 0) armed = true;
    // The sky's own darkness still decides whether this is seen: the shader
    // multiplies it by uNight, so a sky run round to daylight shows nothing
    // even while the event, and the piece under it, are still running.
    return envelope(elapsed);
  };
}
