import * as THREE from "../assets/vendor/three.module.js";

export function visibleSkyPoint(camera, ground, x, y, distance = 18000, clearance = 3) {
    const direction = new THREE.Vector3(x, y, 0.5)
      .applyMatrix4(camera.projectionMatrixInverse).normalize()
      .applyQuaternion(camera.quaternion);
    if (direction.y < 0.025) return null;
    // Check the visible terrain silhouette, not just the mathematical horizon.
    for (let d = 25; d < distance; d *= 1.22) {
      const x = camera.position.x + direction.x * d;
      const z = camera.position.z + direction.z * d;
      if ((ground(x, z)?.height ?? -Infinity) > camera.position.y + direction.y * d - clearance)
        return null;
    }
    return direction.multiplyScalar(distance).add(camera.position);
  }
