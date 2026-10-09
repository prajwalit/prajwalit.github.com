const REVOLUTION_SECONDS = 90;

export function advancePanorama(elapsed, delta, playing) {
  return playing ? (elapsed + delta) % REVOLUTION_SECONDS : elapsed;
}

export function panoramaAngle(elapsed, offset = 0) {
  return (elapsed / REVOLUTION_SECONDS) * Math.PI * 2 + offset;
}
