import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/vendor/three.module.js";
import { addVegetation, habitat, sampleGround } from "../scripts/vegetation.js";

test("vegetation excludes water, cliffs, and the high alpine zone", () => {
  for (const patch of [0, 0.5, 1]) {
    assert.deepEqual(habitat(-5, 0, patch), { meadow: 0, forest: 0 });
    assert.equal(habitat(800, 0, patch).forest, 0);
    assert.deepEqual(habitat(1500, 0, patch), { meadow: 0, forest: 0 });
    assert.deepEqual(habitat(100, 2, patch), { meadow: 0, forest: 0 });
    assert.ok(habitat(100, 0.2, patch).forest > 0);
  }
});
test("roots follow both actual mesh triangles rather than a bilinear approximation", () => {
  const geometry = new THREE.PlaneGeometry(10, 10, 1, 1);
  geometry.rotateX(-Math.PI / 2);
  const p = geometry.attributes.position;
  p.setY(0, 0);
  p.setY(1, 0);
  p.setY(2, 0);
  p.setY(3, 10);
  assert.equal(sampleGround(geometry, -2.5, -2.5).height, 0);
  assert.equal(sampleGround(geometry, 2.5, 2.5).height, 5);
  assert.equal(sampleGround(geometry, 20, 20), null);
  geometry.dispose();
});

test("upland meadows keep ground cover without trees and hide distant tufts", () => {
  const geometry = new THREE.PlaneGeometry(1000, 1000, 10, 10);
  geometry.rotateX(-Math.PI / 2);
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, 400);
  const scene = new THREE.Scene();
  const counts = addVegetation(
    scene,
    geometry,
    () => 0.7,
    () => 0.2,
  );
  assert.equal(counts.trees, 0);
  assert.ok(counts.grass > 0);
  const tiles = scene.children.filter((object) => object.isLOD);
  assert.ok(tiles.length > 0);
  scene.updateMatrixWorld(true);
  const camera = new THREE.PerspectiveCamera();
  camera.position.copy(tiles[0].position);
  camera.updateMatrixWorld(true);
  tiles[0].update(camera);
  assert.equal(tiles[0].levels[0].object.visible, true);
  camera.position.y += 5000;
  camera.updateMatrixWorld(true);
  tiles[0].update(camera);
  assert.equal(tiles[0].levels[0].object.visible, false);
  const geometries = new Set([geometry]),
    materials = new Set();
  scene.traverse((object) => {
    if (object.isMesh) {
      geometries.add(object.geometry);
      materials.add(object.material);
      object.dispose?.();
    }
  });
  geometries.forEach((item) => item.dispose());
  materials.forEach((item) => item.dispose());
});
