import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/vendor/three.module.js";
import { addDiscoveries, findDiscoverySite } from "../scripts/discoveries.js";

function landscape() {
  const geometry = new THREE.PlaneGeometry(17500, 20000, 200, 200);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, 0, -4800);
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, Math.abs(p.getX(i)) * 0.3 - 200);
  return geometry;
}

test("discovery placement rejects water, cliffs, missing ground and sharp ledges", () => {
  assert.equal(
    findDiscoverySite(() => null, 0, 0),
    null,
  );
  assert.equal(
    findDiscoverySite(() => ({ height: -20, slope: 0 }), 0, 0),
    null,
  );
  assert.equal(
    findDiscoverySite(() => ({ height: 500, slope: 1 }), 0, 0),
    null,
  );
  assert.equal(
    findDiscoverySite(
      (x) => ({ height: x % 32 === 0 ? 500 : 550, slope: 0 }),
      0,
      0,
      { radius: 32 },
    ),
    null,
  );
});

test("discoveries stay distributed and within a small geometry and draw-call budget", () => {
  const terrain = landscape();
  const scene = new THREE.Scene();
  const { sites, root, flowerPatches } = addDiscoveries(scene, terrain);
  assert.ok(sites.cairn && sites.flowers);
  assert.deepEqual(Object.keys(sites).sort(), ["cairn", "flowers"]);
  assert.ok(sites.cairn.distanceTo(sites.flowers) > 2000);
  assert.ok(sites.flowers.y >= 10 && sites.flowers.y <= 60);
  assert.ok(Math.abs(sites.flowers.z - 1100) <= 500);
  assert.equal(flowerPatches.length, 15);
  flowerPatches.forEach((p, i) => {
    assert.ok(p.y >= 25 && p.y <= 650);
    for (const other of flowerPatches.slice(i + 1)) assert.ok(p.distanceTo(other) > 600);
  });
  const buffers = new Set();
  root.traverse(o => { if (o.isInstancedMesh && o.name.startsWith("Meadow")) buffers.add(o.geometry); });
  assert.equal(buffers.size, 2, "all added patches share two geometry buffers");
  let triangles = 0,
    draws = 0;
  root.traverse((o) => {
    if (!o.isMesh) return;
    draws++;
    triangles +=
      ((o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3) *
      (o.count ?? 1);
    assert.equal(o.castShadow, false);
    assert.equal(o.isLight, undefined);
  });
  assert.ok(triangles < 42000, `${triangles} triangles`);
  assert.ok(draws <= 35, `${draws} draw calls before reflection`);
});

test("rare effects fade and reduced motion freezes the props", () => {
  const terrain = landscape();
  const normal = addDiscoveries(new THREE.Scene(), terrain);
  const streak = normal.root.getObjectByName("An occasional shooting star");
  normal.update(19.99);
  assert.equal(streak.visible, false);
  const camera = new THREE.PerspectiveCamera(54, 1.5, 10, 160000);
  camera.position.set(0, 2500, 0);
  camera.lookAt(0, 10000, -18000);
  normal.update(20, camera);
  normal.update(20.5, camera);
  assert.equal(streak.visible, true);
  assert.ok(streak.material.opacity > 0);
  normal.update(21.2);
  assert.equal(streak.visible, false);
  const birds = normal.root.getObjectByName(
    "A passing flock above the northern valley",
  );
  normal.update(0);
  assert.equal(birds.material.opacity, 0);
  normal.update(10);
  assert.equal(birds.material.opacity, 1);
  normal.update(60);
  assert.equal(birds.visible, false);
  const still = addDiscoveries(new THREE.Scene(), terrain, { reduced: true });
  const snapshot = () => {
    const values = [];
    still.root.traverse((o) =>
      values.push(...o.position.toArray(), ...o.quaternion.toArray()),
    );
    return values;
  };
  const before = snapshot();
  still.update(71.5);
  assert.deepEqual(snapshot(), before);
  assert.equal(
    still.root.getObjectByName("An occasional shooting star").visible,
    false,
  );
  assert.equal(
    still.root.getObjectByName("A passing flock above the northern valley")
      .visible,
    false,
  );
});
