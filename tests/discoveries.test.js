import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/vendor/three.module.js";
import { addDiscoveries, findDiscoverySite } from "../scripts/discoveries.js";
import { sampleGround } from "../scripts/vegetation.js";

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
  const { sites, root, update } = addDiscoveries(scene, terrain);
  assert.ok(sites.cairn && sites.boat && sites.reindeer);
  assert.ok(sites.cairn.distanceTo(sites.reindeer) > 2000);
  assert.ok(sites.boat.distanceTo(sites.cairn) > 2000);
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
  assert.ok(triangles < 2500, `${triangles} triangles`);
  assert.ok(draws <= 6, `${draws} draw calls before reflection`);
  const boat = root.getObjectByName("A small sailboat on the lake").levels[0]
    .object;
  for (let t = 0; t < 1100; t += 11) {
    update(t);
    for (const [dx, dz] of [
      [0, 0],
      [12, 0],
      [-12, 0],
      [0, 12],
      [0, -12],
    ]) {
      assert.ok(
        sampleGround(
          terrain,
          sites.boat.x + boat.position.x + dx,
          sites.boat.z + boat.position.z + dz,
        ).height < -8,
      );
    }
  }
});

test("rare effects fade and reduced motion freezes the props", () => {
  const terrain = landscape();
  const normal = addDiscoveries(new THREE.Scene(), terrain);
  const streak = normal.root.getObjectByName("An occasional shooting star");
  normal.update(30);
  assert.equal(streak.visible, false);
  normal.update(71.5);
  assert.equal(streak.visible, true);
  assert.ok(streak.material.opacity > 0);
  normal.update(73);
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
