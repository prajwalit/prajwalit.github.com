import * as THREE from "../assets/vendor/three.module.js";
import { sampleGround } from "./vegetation.js?v=5";

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
          (h) => h === undefined || Math.abs(h - g.height) > footprint * 0.3,
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
  const sphere = new THREE.IcosahedronGeometry(1, 2);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 5);
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

  // Quiet, deep water beside the opening route. Validate the entire orbit,
  // including the hull footprint, so drifting can never beach the boat.
  let boat = null,
    boatSite = null;
  for (const [x, z] of [
    [-180, 550],
    [160, 200],
    [-80, 1100],
    [0, -600],
  ]) {
    let clear = true;
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      if (
        (ground(x + Math.cos(a) * 72, z + Math.sin(a) * 52)?.height ?? 1) > -8
      )
        clear = false;
    }
    for (let dx = -72; dx <= 72; dx += 12)
      for (let dz = -52; dz <= 52; dz += 12) {
        if ((ground(x + dx, z + dz)?.height ?? 1) > -8) clear = false;
      }
    if (clear && (ground(x, z)?.height ?? 1) < -8) {
      boatSite = new THREE.Vector3(x, 0, z);
      break;
    }
  }
  if (boatSite) {
    const hull = new THREE.BufferGeometry();
    // Pointed bow, flat deck, narrow keel. Bow faces local +Z.
    const deck = [
      [-2.8, 1.5, -5.5],
      [2.8, 1.5, -5.5],
      [3.2, 1.5, 1],
      [0, 1.8, 7],
      [-3.2, 1.5, 1],
    ];
    const vertices = [];
    for (let i = 0; i < deck.length; i++) {
      const next = deck[(i + 1) % deck.length];
      vertices.push(
        ...deck[i],
        ...next,
        0,
        -1,
        0,
        ...deck[i],
        0,
        1.5,
        0,
        ...next,
      );
    }
    hull.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    const sail = new THREE.BufferGeometry();
    sail.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [0, 3, 0, 0, 20, 0, 1.4, 3, -7.5, 0, 4, 0.4, 0, 17, 0.4, 0.6, 3, 5],
        3,
      ),
    );
    boat = mesh(
      [
        piece(hull, [0, 0, 0], [1, 1, 1], "#584840"),
        piece(cylinder, [0, 10, 0], [0.16, 20, 0.16], "#ad9a7b"),
        piece(cylinder, [0.6, 3, -3.5], [0.13, 7.5, 0.13], "#ad9a7b", [
          Math.PI / 2,
          0,
          -0.15,
        ]),
        piece(sail, [0, 0, 0], [1, 1, 1], "#d9cfb8"),
      ],
      "A small sailboat on the lake",
    );
    nearby(boat, boatSite, 5000);
    hull.dispose();
    sail.dispose();
  }

  const deerSite = findDiscoverySite(ground, 1700, -2000, {
    min: 100,
    max: 620,
    radius: 650,
    footprint: 7,
  });
  let head = null;
  if (deerSite) {
    const deer = new THREE.Group();
    deer.name = "A reindeer on the eastern meadow";
    const body = [
      piece(sphere, [0, 5.2, 0], [1.8, 2.1, 3.6], "#71695e"),
      piece(sphere, [0, 6.4, 2.5], [1.35, 2.5, 1.45], "#a39b89", [0.35, 0, 0]),
      piece(stone, [0, 5.1, -3.5], [0.6, 0.65, 0.85], "#ccc1aa"),
    ];
    for (const x of [-1, 1])
      for (const z of [-2.2, 2.1]) {
        const yaw = -0.85;
        const foot =
          ground(
            deerSite.x + x * Math.cos(yaw) + z * Math.sin(yaw),
            deerSite.z - x * Math.sin(yaw) + z * Math.cos(yaw),
          ).height - deerSite.y;
        body.push(
          piece(
            cylinder,
            [x, (4.25 + foot) / 2, z],
            [0.3, 4.25 - foot, 0.28],
            "#514d47",
            [z * 0.035, 0, x * 0.025],
          ),
        );
        body.push(
          piece(stone, [x, foot + 0.1, z + 0.15], [0.43, 0.32, 0.6], "#363632"),
        );
      }
    deer.add(mesh(body, "Reindeer body"));
    const headParts = [
      piece(sphere, [0, 0.4, 0.7], [0.95, 1.1, 1.65], "#8e8574"),
      piece(stone, [0, 0, 2], [0.7, 0.65, 0.75], "#4d4942"),
    ];
    for (const side of [-1, 1]) {
      headParts.push(
        piece(stone, [side * 1.05, 1.1, 0], [0.95, 0.28, 0.45], "#a79d87", [
          0,
          0,
          side * 0.45,
        ]),
      );
      headParts.push(
        piece(
          cylinder,
          [side * 0.95, 2.4, -0.35],
          [0.12, 3.3, 0.12],
          "#b4a38a",
          [-0.35, 0, side * -0.25],
        ),
      );
      for (let tine = 0; tine < 3; tine++)
        headParts.push(
          piece(
            cylinder,
            [side * (1.05 + tine * 0.23), 2 + tine * 0.7, 0.05 - tine * 0.18],
            [0.085, 1.15, 0.085],
            "#b4a38a",
            [0.7, 0, side * -0.65],
          ),
        );
    }
    head = mesh(headParts, "Reindeer head");
    head.position.set(0, 8, 3.1);
    deer.add(head);
    deer.rotation.y = -0.85;
    nearby(deer, deerSite, 1500);
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
  sphere.dispose();
  cylinder.dispose();

  function update(seconds) {
    const t = reduced ? 0 : seconds;
    if (boat) {
      const phase = t * 0.006;
      boat.position.set(
        Math.cos(phase) * 48,
        0.12 + Math.sin(t * 0.8) * 0.12,
        Math.sin(phase) * 28,
      );
      boat.rotation.set(
        Math.sin(t * 0.53) * 0.012,
        -0.65 - phase,
        Math.sin(t * 0.67) * 0.025,
      );
    }
    if (head) {
      head.rotation.y = Math.sin(t * 0.16) * 0.12;
      head.rotation.x = Math.sin(t * 0.11) * 0.06;
    }
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
    const phase = (t + 42) % 113;
    streak.visible = !reduced && phase < 1.15;
    if (streak.visible) {
      streak.position.set(-6500 + phase * 2900, 9800 - phase * 900, -18000);
      streak.material.opacity = Math.sin((phase / 1.15) * Math.PI) * 0.8;
    }
  }
  update(0);
  return {
    update,
    root,
    sites: { cairn: cairnSite, boat: boatSite, reindeer: deerSite },
  };
}
