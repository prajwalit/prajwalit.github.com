// One aurora a night, between eleven and two. Solar angle sets the hour —
// PI at midnight, so an hour is PI/12 — and these are the cycle fractions
// those hours land on.
export const AURORA_FROM = 0.3014; // 23:00
export const AURORA_UNTIL = 0.3973; // 02:00
// Counted in real seconds, so the piece playing under it keeps its own pace
// whether the sky is paused or running at sixteen times.
export const AURORA_DURATION = 176; // Cloud Valley runs 175.8s
const FADE_IN = 10;
const FADE_OUT = 20;
const EDGE = 0.006;

const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
function envelope(elapsed) {
  if (elapsed < 0 || elapsed >= AURORA_DURATION) return 0;
  const t = Math.min(elapsed / FADE_IN, (AURORA_DURATION - elapsed) / FADE_OUT, 1);
  return t * t * (3 - 2 * t);
}
// Soft edges on the hours themselves, so a sky running fast does not snap it
// off at two in the morning.
const withinHours = (fraction) =>
  smooth(AURORA_FROM, AURORA_FROM + EDGE, fraction) *
  (1 - smooth(AURORA_UNTIL - EDGE, AURORA_UNTIL, fraction));

export function createAuroraEvent({ onStart, onEnd } = {}) {
  let armed = true,
    elapsed = -1;
  const inside = (f) => f >= AURORA_FROM && f <= AURORA_UNTIL;
  return {
    get running() {
      return elapsed >= 0;
    },
    update(fraction, realSeconds) {
      const within = inside(fraction);
      if (elapsed >= 0) {
        elapsed += Math.max(0, realSeconds);
        // The hours bound it as firmly as the clock: at speed the sky leaves
        // the night long before the piece would have finished.
        if (elapsed >= AURORA_DURATION || !within) {
          elapsed = -1;
          onEnd?.();
        }
      } else if (armed && within) {
        armed = false;
        elapsed = 0;
        onStart?.();
      }
      // Re-arms only once the sky has left those hours, so holding the dial
      // inside them plays it once rather than on a loop.
      if (!within) armed = true;
      return elapsed < 0 ? 0 : envelope(elapsed) * withinHours(fraction);
    },
    reset() {
      if (elapsed >= 0) onEnd?.();
      armed = true;
      elapsed = -1;
    },
  };
}
