import * as THREE from "../assets/vendor/three.module.js";
import { visibleSkyPoint } from "./visible-sky.js?v=2";

export function createBirdFlight(birds, ground, reduced = false) {
  const duration = 18;
  // Birds fly while the sun still gives real light, through sunrise and
  // sunset, and roost once it sits a couple of degrees below the horizon.
  const roosting = 0.15;
  // The first flock belongs where the camera has come to rest, so the crossing
  // is actually noticed rather than passed through at speed.
  const arrival = 10;
  let nextDue = 120, retryAt = 0, started = -Infinity, lastTime = 0, pass = 0;
  let armed = false;
  const origin = new THREE.Vector3(), travel = new THREE.Vector3();
  const heading = new THREE.Vector3(), lateral = new THREE.Vector3();
  const transform = new THREE.Object3D();
  let yaw = 0;
  return (seconds, camera, night = 0, settled = false) => {
    if (seconds < lastTime) {
      nextDue = 120; retryAt = 0; started = -Infinity; pass = 0; armed = false;
    }
    lastTime = seconds;
    birds.visible = false;
    birds.material.opacity = 0;
    if (reduced) return;
    // Settling pulls the first pass forward, once, and never later than the
    // standing two minutes — a visitor who neither summits nor explores still
    // sees one. Arming once keeps the rhythm from collapsing to ten seconds.
    if (settled && !armed) {
      armed = true;
      nextDue = Math.min(nextDue, seconds + arrival);
    }
    // Darkness defers a pass the way an obscured sky does: the flight stays
    // due and retries, so one flock crosses after sunrise rather than a
    // night's worth arriving together.
    if (seconds >= nextDue && seconds >= retryAt && camera && night < roosting) {
      retryAt = seconds + 0.75;
      for (let i = 0; i < 8; i++) {
        const side = pass % 2 ? -1 : 1;
        const y = 0.2 + ((i * 3 + pass * 2) % 8) * 0.075;
        const a = visibleSkyPoint(camera, ground, -0.65 * side, y, 750, 18);
        const b = visibleSkyPoint(camera, ground, 0.65 * side, y + 0.05, 750, 18);
        let clear = Boolean(a && b);
        // Sample the whole crossing, with room for the loose formation.
        for (let j = 1; clear && j < 8; j++)
          clear = Boolean(visibleSkyPoint(camera, ground, side * (-0.65 + 1.3 * j / 8), y + 0.05 * j / 8, 750, 18));
        if (!clear) continue;
        origin.copy(a); travel.copy(b).sub(a);
        heading.copy(travel).normalize();
        lateral.set(-heading.z, 0, heading.x).normalize();
        yaw = Math.atan2(-heading.x, -heading.z);
        started = seconds; nextDue = seconds + 120; pass++;
        break;
      }
    }
    const phase = seconds - started;
    if (phase < 0 || phase >= duration) return;
    birds.visible = true;
    // A flock overtaken by nightfall fades with the light rather than popping.
    birds.material.opacity = THREE.MathUtils.smoothstep(phase, 0, 2)
      * (1 - THREE.MathUtils.smoothstep(phase, duration - 3, duration))
      * (1 - night);
    for (let i = 0; i < 7; i++) {
      const row = Math.ceil(i / 2);
      for (let wing = 0; wing < 2; wing++) {
        transform.position.copy(origin).addScaledVector(travel, phase / duration)
          .addScaledVector(heading, -row * 9)
          .addScaledVector(lateral, (i % 2 ? -1 : 1) * row * 6);
        transform.position.y += Math.sin(phase * 0.5 + i) * 1.2 + i * 0.5;
        transform.rotation.set(0, yaw + (wing ? Math.PI : 0),
          0.12 + Math.sin(phase * 4.4 + i * 0.8) * 0.4);
        transform.updateMatrix();
        birds.setMatrixAt(i * 2 + wing, transform.matrix);
      }
    }
    birds.instanceMatrix.needsUpdate = true;
  };
}
