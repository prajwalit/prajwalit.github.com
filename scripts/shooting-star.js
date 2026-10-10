import * as THREE from "../assets/vendor/three.module.js";

// Only choose a new trajectory when due. Once launched, its world-space path
// stays fixed even if the viewer turns or moves during the streak.
export function createShootingStarFlight(streak, ground, reduced = false) {
  const duration = 1.15, distance = 18000;
  let nextDue = 20, retryAt = 0, started = -Infinity, lastTime = 0, pass = 0;
  const origin = new THREE.Vector3(), travel = new THREE.Vector3();
  const random = n => {
    const v = Math.sin(n * 127.1 + 19.7) * 43758.5453;
    return v - Math.floor(v);
  };
  function skyPoint(camera, x, y) {
    const direction = new THREE.Vector3(x, y, 0.5)
      .applyMatrix4(camera.projectionMatrixInverse).normalize()
      .applyQuaternion(camera.quaternion);
    if (direction.y < 0.025) return null;
    // Check the visible terrain silhouette, not just the mathematical horizon.
    for (let d = 25; d < distance; d *= 1.22) {
      const x = camera.position.x + direction.x * d;
      const z = camera.position.z + direction.z * d;
      if ((ground(x, z)?.height ?? -Infinity) > camera.position.y + direction.y * d - 3)
        return null;
    }
    return direction.multiplyScalar(distance).add(camera.position);
  }
  return (seconds, camera) => {
    if (seconds < lastTime) {
      nextDue = 20; retryAt = 0; started = -Infinity; pass = 0;
    }
    lastTime = seconds;
    streak.visible = false;
    if (reduced) return;
    if (seconds >= nextDue && seconds >= retryAt && camera) {
      retryAt = seconds + 0.5;
      for (let i = 0; i < 12; i++) {
        const seed = pass * 37 + i * 7 + 1;
        const sign = random(seed) < 0.5 ? -1 : 1;
        const x = (random(seed + 2) - 0.5) * 1.1;
        const y = 0.08 + random(seed + 3) * 0.68;
        const endX = THREE.MathUtils.clamp(x + sign * (0.22 + random(seed + 4) * 0.3), -0.8, 0.8);
        const endY = y - 0.12 - random(seed + 5) * 0.2;
        const a = skyPoint(camera, x, y), b = skyPoint(camera, endX, endY);
        const mid = skyPoint(camera, (x + endX) / 2, (y + endY) / 2);
        if (!a || !b || !mid) continue;
        origin.copy(a); travel.copy(b).sub(a);
        const along = travel.clone().normalize();
        const facing = camera.position.clone().sub(a).normalize();
        const up = facing.clone().cross(along).normalize();
        const normal = along.clone().cross(up).normalize();
        streak.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(along, up, normal));
        started = seconds;
        nextDue = seconds + 20;
        pass++;
        break;
      }
    }
    const phase = seconds - started;
    if (phase >= 0 && phase < duration) {
      streak.visible = true;
      streak.position.copy(origin).addScaledVector(travel, phase / duration);
      streak.material.opacity = Math.sin(phase / duration * Math.PI) * 0.8;
    }
  };
}
