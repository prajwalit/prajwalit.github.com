import { createShootingStarFlight } from "./shooting-star.js?v=2";
import { createAlpineFlowers, createFlowerPatchFactory } from "./natural-landmarks.js?v=3";
import * as THREE from "../assets/vendor/three.module.js";
import { sampleGround, habitat } from "./vegetation.js?v=5";

// Fixed neighbourhoods keep the discoveries apart; actual mesh samples keep
// them on the visible terrain. Never place a prop when no suitable spot exists.
export function findDiscoverySite(
  ground,
  x,
  z,
  { min = 40, max = 1400, radius = 400, footprint = 8 } = {},
) {
  let best = null,
    score = Infinity;
  for (let dz = -radius; dz <= radius; dz += 32) {
    for (let dx = -radius; dx <= radius; dx += 32) {
      const g = ground(x + dx, z + dz);
      if (!g || g.height < min || g.height > max || g.slope > 0.48) continue;
      const feet = [
        [-footprint, 0],
        [footprint, 0],
        [0, -footprint],
        [0, footprint],
      ].map(([a, b]) => ground(x + dx + a, z + dz + b)?.height);
      if (
        feet.some(
          (h) => h === undefined || Math.abs(h - g.height) > footprint * 0.3 + 1e-5,
        )
      )
        continue;
      const cost = Math.hypot(dx, dz) + g.slope * 500;
      if (cost < score) {
        score = cost;
        best = new THREE.Vector3(x + dx, g.height, z + dz);
      }
    }
  }
  return best;
}

function merge(parts) {
  const positions = [],
    colors = [],
    normals = [];
  for (const [source, position, scale, rotation, tint] of parts) {
    const geometry = source.index ? source.toNonIndexed() : source.clone();
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(...position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
      new THREE.Vector3(...scale),
    );
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    geometry.applyMatrix4(matrix);
    normals.push(...geometry.attributes.normal.array);
    positions.push(...geometry.attributes.position.array);
    const color = new THREE.Color(tint);
    for (let i = 0; i < geometry.attributes.position.count; i++)
      colors.push(color.r, color.g, color.b);
    geometry.dispose();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  return geometry;
}

export function addDiscoveries(
  scene,
  terrainGeometry,
  { reduced = false } = {},
) {
  const ground = (x, z) => sampleGround(terrainGeometry, x, z);
  const root = new THREE.Group();
  root.name = "Landscape discoveries";
  scene.add(root);
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.93,
    flatShading: false,
    side: THREE.DoubleSide,
  });
  const stone = new THREE.IcosahedronGeometry(1, 1);
  const rockVertices = stone.attributes.position;
  for (let i = 0; i < rockVertices.count; i++) {
    const x = rockVertices.getX(i),
      y = rockVertices.getY(i),
      z = rockVertices.getZ(i);
    const roughness = 1 + Math.sin(x * 13 + y * 9 + z * 17) * 0.12;
    rockVertices.setXYZ(
      i,
      x * roughness,
      Math.max(-0.75, Math.min(0.78, y * roughness)),
      z * roughness,
    );
  }
  stone.computeVertexNormals();
  const parts = [];
  const piece = (shape, p, s, color, r = [0, 0, 0]) => [shape, p, s, r, color];
  function mesh(items, name) {
    const result = new THREE.Mesh(merge(items), material);
    result.name = name;
    result.receiveShadow = true;
    return result;
  }
  function nearby(object, position, distance) {
    const lod = new THREE.LOD();
    lod.name = object.name;
    lod.position.copy(position);
    lod.addLevel(object, 0);
    lod.addLevel(new THREE.Group(), distance, 0.15);
    root.add(lod);
    return lod;
  }

  const flowerSite = findDiscoverySite(ground, 500, 1100, {
    min: 10,
    max: 60,
    radius: 500,
    footprint: 8,
  });
  if (flowerSite)
    nearby(createAlpineFlowers(flowerSite, ground), flowerSite, 400);

  const flowerPatches = [];
  const candidates = [];
  for (let z = 1600; z >= -9000; z -= 320) {
    for (let x = -4000; x <= 4000; x += 320) {
      const soil = ground(x, z);
      if (soil && soil.height >= 25 && soil.height <= 650 && soil.slope < 0.38
        && habitat(soil.height, soil.slope, 0.5).meadow > 0.65)
        candidates.push(new THREE.Vector3(x, soil.height, z));
    }
  }
  const makeFlowerPatch = createFlowerPatchFactory();
  const neighbourhoods = [
    [-650, 1300], [750, 350], [-800, -400], [1000, -1000],
    [-1400, -1800], [1400, -2400], [-1800, -3100], [1900, -3800],
    [-2400, -4600], [2400, -5100], [-2800, -6000], [2800, -6600],
    [-3200, -7400], [3200, -8200], [0, -8600],
  ];
  for (const [x, z] of neighbourhoods) {
    const occupied = flowerSite ? [flowerSite, ...flowerPatches] : flowerPatches;
    const site = candidates.filter(p => occupied.every(q => p.distanceTo(q) > 600))
      .sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0];
    if (!site) continue;
    nearby(makeFlowerPatch(site, ground, flowerPatches.length), site, 280);
    flowerPatches.push(site);
  }

  const cairnSite = findDiscoverySite(ground, -1800, -3200, {
    min: 350,
    max: 1500,
    radius: 900,
  });
  if (cairnSite) {
    const tints = ["#77766f", "#8b8580", "#696c70", "#a19a8d", "#7c7b75"];
    let y = -0.7;
    for (let i = 0; i < 5; i++) {
      const width = 4.8 - i * 0.77;
      const height = 1.45 - i * 0.12;
      parts.push(
        piece(
          stone,
          [Math.sin(i * 4) * 0.35, y + height, Math.cos(i * 2) * 0.25],
          [width, height, width * 0.72],
          tints[i],
          [0.09 * i, i * 1.8, -0.07 * i],
        ),
      );
      y += height * 1.35;
    }
    nearby(mesh(parts, "A cairn on the western ridge"), cairnSite, 1700);
  }

  // Seven distant birds, two tapered wings each, all in one draw call.
  const wing = new THREE.BufferGeometry();
  wing.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        0, 0, 0.5, 2.8, 0, -0.3, 1.4, 0, -0.8, 0, 0, 0.5, 1.4, 0, -0.8, 0, 0,
        -0.7,
      ],
      3,
    ),
  );
  wing.computeVertexNormals();
  const birds = new THREE.InstancedMesh(
    wing,
    new THREE.MeshBasicMaterial({
      color: "#35383b",
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
    }),
    14,
  );
  birds.name = "A passing flock above the northern valley";
  birds.frustumCulled = false;
  birds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  root.add(birds);
  const transform = new THREE.Object3D();
  let flightHeight = 750;
  for (let i = 0; i < 80; i++) {
    const a = (i / 80) * Math.PI * 2;
    flightHeight = Math.max(
      flightHeight,
      (ground(Math.cos(a) * 900, -2700 + Math.sin(a) * 650)?.height ?? 0) + 220,
    );
  }

  // A single tapered streak, no light, bloom, particles or shadow map.
  const streakGeometry = new THREE.BufferGeometry();
  streakGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([0, 0, 0, -650, 10, 0, -650, -10, 0], 3),
  );
  streakGeometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(
      [1, 0.94, 0.8, 0.04, 0.04, 0.05, 0.04, 0.04, 0.05],
      3,
    ),
  );
  const streak = new THREE.Mesh(
    streakGeometry,
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      fog: false,
      toneMapped: false,
    }),
  );
  streak.name = "An occasional shooting star";
  streak.rotation.z = -0.3;
  root.add(streak);
  stone.dispose();

  const updateStar = createShootingStarFlight(streak, ground, reduced);
  function update(seconds, camera) {
    const t = reduced ? 0 : seconds;
    const orbit = t * 0.017;
    birds.visible = !reduced && t % 100 < 42;
    if (birds.visible) {
      const pass = t % 100;
      birds.material.opacity =
        THREE.MathUtils.smoothstep(pass, 0, 4) *
        (1 - THREE.MathUtils.smoothstep(pass, 37, 42));
      for (let i = 0; i < 7; i++) {
        const a = orbit - i * 0.018;
        for (let side = 0; side < 2; side++) {
          transform.position.set(
            Math.cos(a) * (900 + (i % 2) * 24),
            flightHeight + Math.sin(t * 0.4 + i) * 3 + i * 1.6,
            -2700 + Math.sin(a) * 650,
          );
          transform.rotation.set(
            0,
            -a + (side ? Math.PI : 0),
            0.14 + Math.sin(t * 4.4 + i * 0.8) * 0.4,
          );
          transform.scale.setScalar(1);
          transform.updateMatrix();
          birds.setMatrixAt(i * 2 + side, transform.matrix);
        }
      }
      birds.instanceMatrix.needsUpdate = true;
    }
    updateStar(t, camera);
  }
  update(0);
  return {
    update,
    root,
    flowerPatches,
    sites: {
      cairn: cairnSite,
      flowers: flowerSite,
    },
  };
}
