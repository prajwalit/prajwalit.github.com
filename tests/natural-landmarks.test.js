import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/vendor/three.module.js";
import {
  createAlpineFlowers,
  createFlowerPatchFactory,
} from "../scripts/natural-landmarks.js";

test("flower roots follow uneven ground and avoid missing or steep terrain", () => {
  const site = new THREE.Vector3(400, 120, -900);
  const ground = (x, z) =>
    x < 400
      ? null
      : { height: 120 + (x - 400) * 0.15 + (z + 900) * 0.1, slope: 0.2 };
  const flowers = createAlpineFlowers(site, ground);
  const bases = flowers.userData.plantBases;
  assert.ok(bases.length > 0 && bases.length < 58);
  for (const p of bases) {
    const soil = ground(site.x + p.x, site.z + p.z);
    assert.ok(soil);
    assert.ok(Math.abs(p.y - (soil.height - site.y - 0.035)) < 1e-6);
  }
  assert.equal(
    createAlpineFlowers(site, () => ({ height: 120, slope: 1 })).userData
      .plantBases.length,
    0,
  );
});

test("natural landmarks have finite geometry, bounded complexity and no new shadow casters", () => {
  const objects = [
    createAlpineFlowers(new THREE.Vector3(), () => ({ height: 0, slope: 0 })),
  ];
  let draws = 0,
    triangles = 0;
  for (const object of objects)
    object.traverse((child) => {
      if (!child.isMesh) return;
      draws++;
      triangles += child.geometry.attributes.position.count / 3;
      for (const name of ["position", "normal", "color"])
        assert.ok(child.geometry.attributes[name].array.every(Number.isFinite));
      assert.equal(child.castShadow, false);
    });
  assert.equal(draws, 2);
  assert.ok(triangles < 3000);
});

test("instanced meadow roots follow the terrain and share geometry between patches", () => {
  const factory = createFlowerPatchFactory();
  const ground = (x, z) => ({height: 100 + x * 0.1 + z * 0.1, slope: 0.14});
  const site = new THREE.Vector3(0, 100, 0);
  const a = factory(site, ground, 0), b = factory(site, ground, 1);
  assert.equal(a.children[0].geometry, b.children[0].geometry);
  assert.equal(a.children[1].geometry, b.children[1].geometry);
  for (const p of a.userData.plantBases)
    assert.ok(Math.abs(site.y + p.y + 0.035 - ground(p.x, p.z).height) < 1e-6);
  assert.ok(a.userData.plantBases.length >= 30);
});
