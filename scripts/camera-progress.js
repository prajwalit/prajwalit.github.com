import { MathUtils } from "../assets/vendor/three.module.js";

export function cameraProgress(progress) {
  const base = MathUtils.smootherstep(progress, 0, 0.96);
  // Give the opening a visible forward pace. Rejoin the original route before
  // the work chapter settles, preserving the later ascent and summit arrival.
  const opening =
    0.35 * progress * (1 - MathUtils.smoothstep(progress, 0, 0.25));
  return base + opening;
}

// Normalized distance keeps autoplay duration independent of viewport height.
export function journeyScrollDistance(seconds, scrollRange) {
  return (Math.max(0, seconds) * scrollRange) / 75;
}
