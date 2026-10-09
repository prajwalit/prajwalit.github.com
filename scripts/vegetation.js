import * as THREE from "../assets/vendor/three.module.js";

// Sample the rendered triangles, not the higher-frequency terrain function,
// so roots and grass stay attached to the actual visible ground.
export function sampleGround(geometry, x, z) {
  const {
    width,
    height,
    widthSegments: cols,
    heightSegments: rows,
  } = geometry.parameters;
  const points = geometry.attributes.position;
  const u = ((x - points.getX(0)) / width) * cols;
  const v = ((z - points.getZ(0)) / height) * rows;
  if (u < 0 || v < 0 || u >= cols || v >= rows) return null;
  const col = Math.floor(u),
    row = Math.floor(v),
    dx = u - col,
    dz = v - row;
  const a = row * (cols + 1) + col,
    b = a + cols + 1;
  const ha = points.getY(a),
    hb = points.getY(b),
    hc = points.getY(b + 1),
    hd = points.getY(a + 1);
  const lower = dx + dz <= 1;
  return {
    height: lower
      ? ha + (hd - ha) * dx + (hb - ha) * dz
      : hc + (hb - hc) * (1 - dx) + (hd - hc) * (1 - dz),
    slope: Math.hypot(
      (lower ? hd - ha : hc - hb) / (width / cols),
      (lower ? hb - ha : hc - hd) / (height / rows),
    ),
  };
}

export function habitat(height, slope, patch) {
  const fade = THREE.MathUtils.smoothstep;
  const meadow =
    fade(height, 5, 35) *
    (1 - fade(height, 480, 1050)) *
    (1 - fade(slope, 0.4, 1.05));
  const forest =
    fade(height, 12, 55) *
    (1 - fade(height, 300 + patch * 100, 640 + patch * 100)) *
    (1 - fade(slope, 0.6, 1.15));
  return { meadow, forest };
}

function coniferGeometry(variant) {
  const positions = [],
    shades = [];
  const primitive = new THREE.OctahedronGeometry(1, 0);
  const source = primitive.attributes.position;
  const pine = variant === 3;
  const random = (n) => {
    const value = Math.sin(n * 127.1 + variant * 91.7) * 43758.5453;
    return value - Math.floor(value);
  };
  // Separate needle sprays, with air between boughs rather than solid skirts.
  for (let tier = 0; tier < 9; tier++) {
    const y = (pine ? 0.43 : 0.2) + tier * (pine ? 0.057 : 0.082);
    const width = pine
      ? Math.sin(((tier + 1) / 10) * Math.PI) * 0.24
      : (1 - y) * (0.25 + variant * 0.018);
    const count = 4 + (tier % 3);
    for (let branch = 0; branch < count; branch++) {
      if (random(tier * 30 + branch) < 0.13) continue;
      const angle = (branch / count) * Math.PI * 2 + tier * 2.39 + variant;
      const length = width * (0.65 + random(branch * 17 + tier) * 0.65);
      for (let spray = 0; spray < 3; spray++) {
        const along = 0.3 + spray * 0.29;
        const cx = Math.cos(angle) * length * along;
        const cz = Math.sin(angle) * length * along;
        const cy = y - along * 0.035 + random(tier * 7 + branch) * 0.025;
        const radial = length * (0.42 - spray * 0.065);
        const cross = radial * (0.45 + random(branch + tier) * 0.3);
        const vertical = 0.033 + (1 - y) * 0.018;
        const shade = 0.72 + random(tier * 71 + branch * 3 + spray) * 0.38;
        for (let i = 0; i < source.count; i++) {
          const rx = source.getX(i) * radial,
            rz = source.getZ(i) * cross;
          positions.push(
            cx + rx * Math.cos(angle) - rz * Math.sin(angle),
            cy + source.getY(i) * vertical,
            cz + rx * Math.sin(angle) + rz * Math.cos(angle),
          );
          shades.push(
            shade * (1.04 + spray * 0.035),
            shade,
            shade * (0.88 - spray * 0.045),
          );
        }
      }
    }
  }
  primitive.dispose();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(shades, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function grassGeometry() {
  const positions = [];
  for (let blade = 0; blade < 7; blade++) {
    const angle = blade * 2.4,
      x = Math.cos(angle) * 0.3,
      z = Math.sin(angle) * 0.3;
    const height = 0.6 + (blade % 3) * 0.24,
      lean = 0.3;
    positions.push(
      x - 0.07,
      0,
      z,
      x + 0.07,
      0,
      z,
      x + Math.cos(angle) * lean,
      height,
      z + Math.sin(angle) * lean,
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.computeVertexNormals();
  return geometry;
}

export function addVegetation(scene, terrainGeometry, noise, random) {
  const trees = [],
    grass = [],
    shrubs = [];
  // Jittered candidates with broad patches leave open shoreline and rock.
  for (let z = -9000; z < 3900; z += 48)
    for (let x = -5700; x < 5700; x += 48) {
      const px = x + (random(x + 9, z) - 0.5) * 30,
        pz = z + (random(x, z + 19) - 0.5) * 30;
      const ground = sampleGround(terrainGeometry, px, pz);
      if (!ground) continue;
      const patch = noise(px * 0.0012 + 63, pz * 0.0012 - 41);
      const { forest, meadow } = habitat(ground.height, ground.slope, patch);
      const grove = noise(px * 0.006 + 9, pz * 0.006 - 7);
      const density =
        THREE.MathUtils.smoothstep(patch, 0.48, 0.65) *
        THREE.MathUtils.smoothstep(grove, 0.48, 0.67);
      const lakeside =
        (1 - THREE.MathUtils.smoothstep(ground.height, 140, 280)) *
        (1 - THREE.MathUtils.smoothstep(Math.abs(px), 1800, 2800));
      if (
        pz > -4500 &&
        pz < 2600 &&
        random(x + 147, z - 45) < forest * density * lakeside * 0.85
      ) {
        const height =
          (12 + random(x - 7, z + 4) * 23) *
          (1 - THREE.MathUtils.smoothstep(ground.height, 300, 740) * 0.48);
        trees.push({
          x: px,
          y: ground.height - 0.6,
          z: pz,
          height,
          seed: random(x + 91, z + 7),
        });
        // Mixed ages in small families give the grove an irregular edge.
        for (let sapling = 0; sapling < 2; sapling++) {
          const sx = px + (random(x + sapling * 11, z + 83) - 0.5) * 42;
          const sz = pz + (random(x + 19, z + sapling * 23) - 0.5) * 42;
          const soil = sampleGround(terrainGeometry, sx, sz);
          if (soil && habitat(soil.height, soil.slope, patch).forest > 0.3)
            trees.push({
              x: sx,
              y: soil.height - 0.3,
              z: sz,
              height: height * (0.3 + random(sx, sz) * 0.45),
              seed: random(sz + 7, sx),
            });
        }
      }
      if (
        meadow > 0.2 &&
        pz > -4500 &&
        Math.abs(px) < 3100 &&
        random(x - 21, z) < meadow * 0.7
      ) {
        if (random(px + 21, pz) < 0.6)
          shrubs.push({
            x: px,
            y: ground.height - 0.2,
            z: pz,
            seed: random(px, pz),
          });
        for (let i = 0; i < 3; i++) {
          const gx = px + (random(x + i * 13, z + 27) - 0.5) * 34,
            gz = pz + (random(x + 44, z + i * 17) - 0.5) * 34;
          const g = sampleGround(terrainGeometry, gx, gz);
          if (g && habitat(g.height, g.slope, patch).meadow > 0.2)
            grass.push({
              x: gx,
              y: g.height - 0.15,
              z: gz,
              seed: random(gx, gz),
            });
        }
      }
    }
  const foliageMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1,
    vertexColors: true,
  });
  const groups = Array.from({ length: 4 }, (_, variant) =>
    trees.filter((tree) => Math.min(3, Math.floor(tree.seed * 4)) === variant),
  );
  const crowns = groups.map(
    (group, variant) =>
      new THREE.InstancedMesh(
        coniferGeometry(variant),
        foliageMaterial,
        group.length,
      ),
  );
  const trunkGeometry = new THREE.CylinderGeometry(0.003, 0.009, 0.97, 5);
  trunkGeometry.translate(0, 0.485, 0);
  const trunks = new THREE.InstancedMesh(
    trunkGeometry,
    new THREE.MeshStandardMaterial({ color: 0x544739, roughness: 1 }),
    trees.length,
  );
  const transform = new THREE.Object3D(),
    color = new THREE.Color();
  let trunkIndex = 0;
  groups.forEach((group, variant) =>
    group.forEach((tree, i) => {
      const crown = crowns[variant];
      transform.position.set(tree.x, tree.y, tree.z);
      transform.rotation.set(
        (tree.seed - 0.5) * 0.06,
        tree.seed * Math.PI * 2,
        (tree.seed - 0.5) * 0.05,
      );
      transform.scale.set(
        tree.height * (0.7 + ((tree.seed * 7) % 1) * 0.65),
        tree.height,
        tree.height * (0.7 + ((tree.seed * 7) % 1) * 0.65),
      );
      transform.updateMatrix();
      crown.setMatrixAt(i, transform.matrix);
      trunks.setMatrixAt(trunkIndex++, transform.matrix);
      color.setHSL(
        0.2 + ((tree.seed * 13) % 1) * 0.07,
        0.12 + ((tree.seed * 23) % 1) * 0.12,
        0.105 + ((tree.seed * 17) % 1) * 0.085,
      );
      crown.setColorAt(i, color);
    }),
  );
  crowns.forEach((crown) => (crown.receiveShadow = true));
  trunks.receiveShadow = true;
  // Terrain shadows shade the forest. Avoid thousands of tiny shadow casters.
  scene.add(...crowns, trunks);
  const shrubGeometry = new THREE.IcosahedronGeometry(1, 1);
  const bushes = new THREE.InstancedMesh(
    shrubGeometry,
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }),
    shrubs.length,
  );
  shrubs.forEach((shrub, i) => {
    transform.position.set(shrub.x, shrub.y + 0.8, shrub.z);
    transform.rotation.set(0.1, shrub.seed * 6, 0);
    transform.scale.set(
      2 + shrub.seed * 3,
      0.8 + shrub.seed * 1.2,
      1.8 + shrub.seed * 2,
    );
    transform.updateMatrix();
    bushes.setMatrixAt(i, transform.matrix);
    color.setHSL(0.15 + shrub.seed * 0.1, 0.22, 0.15 + shrub.seed * 0.09);
    bushes.setColorAt(i, color);
  });
  bushes.receiveShadow = true;

  const tufts = new THREE.InstancedMesh(
    grassGeometry(),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 1,
      side: THREE.DoubleSide,
    }),
    grass.length,
  );
  grass.forEach((tuft, i) => {
    transform.position.set(tuft.x, tuft.y, tuft.z);
    transform.rotation.set(0, tuft.seed * Math.PI * 2, 0);
    transform.scale.setScalar(1.2 + tuft.seed * 1.8);
    transform.updateMatrix();
    tufts.setMatrixAt(i, transform.matrix);
    color.setHSL(0.12 + tuft.seed * 0.12, 0.23, 0.23 + tuft.seed * 0.1);
    tufts.setColorAt(i, color);
  });
  tufts.receiveShadow = true;

  for (const mesh of [...crowns, trunks, tufts, bushes]) {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }
  // Ground detail only matters nearby. Small tiles also let the reflected
  // camera cull independently, while terrain colour carries distant meadows.
  function addGroundTiles(source, items) {
    const tiles = new Map();
    items.forEach((item, index) => {
      const x = (Math.floor(item.x / 500) + 0.5) * 500;
      const z = (Math.floor(item.z / 500) + 0.5) * 500;
      const key = x + ":" + z;
      if (!tiles.has(key)) tiles.set(key, { x, z, indices: [] });
      tiles.get(key).indices.push(index);
    });
    const matrix = new THREE.Matrix4(),
      tint = new THREE.Color();
    for (const tile of tiles.values()) {
      const y =
        tile.indices.reduce((sum, i) => sum + items[i].y, 0) /
        tile.indices.length;
      const mesh = new THREE.InstancedMesh(
        source.geometry,
        source.material,
        tile.indices.length,
      );
      tile.indices.forEach((index, i) => {
        source.getMatrixAt(index, matrix);
        matrix.elements[12] -= tile.x;
        matrix.elements[13] -= y;
        matrix.elements[14] -= tile.z;
        mesh.setMatrixAt(i, matrix);
        source.getColorAt(index, tint);
        mesh.setColorAt(i, tint);
      });
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      const lod = new THREE.LOD();
      lod.position.set(tile.x, y, tile.z);
      lod.addLevel(mesh, 0);
      lod.addLevel(new THREE.Group(), 1100, 0.15);
      scene.add(lod);
    }
    source.dispose();
  }
  addGroundTiles(bushes, shrubs);
  addGroundTiles(tufts, grass);
  return { trees: trees.length, grass: grass.length };
}
