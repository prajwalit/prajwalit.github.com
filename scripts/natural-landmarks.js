import * as THREE from "../assets/vendor/three.module.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const random = (n) => {
  const x = Math.sin(n * 127.1 + 19.7) * 43758.5453;
  return x - Math.floor(x);
};

// Build once into a few buffers. No per-leaf objects, textures or animation.
class Surface {
  positions = [];
  colors = [];
  normals = [];
  triangle(a, b, c, tint, normals) {
    const color = new THREE.Color(tint);
    const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    for (const [i, p] of [a, b, c].entries()) {
      this.positions.push(...p.toArray());
      this.colors.push(color.r, color.g, color.b);
      this.normals.push(...(normals?.[i] ?? normal).toArray());
    }
  }
  mesh(name, material) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(this.positions, 3),
    );
    geometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(this.colors, 3),
    );
    geometry.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(this.normals, 3),
    );
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.receiveShadow = true;
    return mesh;
  }
}

export function createAlpineFlowers(site, ground) {
  const foliage = new Surface(),
    flowers = new Surface();
  const plantBases = [];
  for (let plant = 0; plant < 58; plant++) {
    const cluster = plant % 4;
    const angle = random(plant + 51) * Math.PI * 2;
    const radius = Math.sqrt(random(plant + 80)) * 2.4;
    const x = [-5, 1.8, 4, -1][cluster] + Math.cos(angle) * radius;
    const z = [-2, 3, -3, 0][cluster] + Math.sin(angle) * radius;
    const soil = ground(site.x + x, site.z + z);
    if (!soil || soil.slope > 0.65 || Math.abs(soil.height - site.y) > 4)
      continue;
    const base = V(x, soil.height - site.y - 0.035, z);
    plantBases.push(base.clone());
    const height = 0.42 + random(plant + 40) * 0.62;
    const bend = V(
      (random(plant + 60) - 0.5) * 0.28,
      0,
      (random(plant + 61) - 0.5) * 0.28,
    );
    const tip = base
      .clone()
      .add(bend)
      .add(V(0, height, 0));
    const green = new THREE.Color().setHSL(
      0.18 + random(plant) * 0.035,
      0.22,
      0.17 + random(plant + 3) * 0.065,
    );
    const w = V(0.015, 0, 0.012);
    foliage.triangle(base.clone().sub(w), base.clone().add(w), tip, green);
    foliage.triangle(
      base.clone().add(V(0, 0, -0.014)),
      base.clone().add(V(0, 0, 0.014)),
      tip,
      green,
    );
    // Slightly cupped, narrow basal leaves in uneven rosettes.
    for (let leaf = 0; leaf < 5; leaf++) {
      const a = leaf * 2.4 + plant * 0.7;
      const length = 0.24 + random(plant * 5 + leaf) * 0.33;
      const mid = base
        .clone()
        .add(V(Math.cos(a) * length * 0.55, 0.12, Math.sin(a) * length * 0.55));
      const end = base
        .clone()
        .add(V(Math.cos(a) * length, 0.07, Math.sin(a) * length));
      const side = V(-Math.sin(a) * 0.045, 0, Math.cos(a) * 0.045);
      foliage.triangle(
        base,
        mid.clone().sub(side),
        mid.clone().add(V(0, 0.035, 0)),
        green,
      );
      foliage.triangle(
        base,
        mid.clone().add(V(0, 0.035, 0)),
        mid.clone().add(side),
        green,
      );
      foliage.triangle(
        mid.clone().sub(side),
        end,
        mid.clone().add(V(0, 0.035, 0)),
        green,
      );
      foliage.triangle(
        mid.clone().add(V(0, 0.035, 0)),
        end,
        mid.clone().add(side),
        green,
      );
    }
    const pink = plant % 5 === 0;
    const tint = pink ? new THREE.Color("#b68792") : new THREE.Color("#d5d0ba");
    const petalLength = 0.13 + random(plant + 32) * 0.065;
    for (let petal = 0; petal < 5; petal++) {
      const a = (petal * Math.PI * 2) / 5 + plant;
      const outward = V(Math.cos(a), 0, Math.sin(a));
      const across = V(-Math.sin(a), 0, Math.cos(a));
      const middle = tip
        .clone()
        .addScaledVector(outward, petalLength * 0.6)
        .add(V(0, 0.025, 0));
      const end = tip
        .clone()
        .addScaledVector(outward, petalLength)
        .add(V(0, 0.06, 0));
      const left = middle.clone().addScaledVector(across, 0.06),
        right = middle.clone().addScaledVector(across, -0.06);
      flowers.triangle(tip, left, middle, tint.clone().multiplyScalar(0.83));
      flowers.triangle(tip, middle, right, tint.clone().multiplyScalar(0.83));
      flowers.triangle(left, end, middle, tint);
      flowers.triangle(middle, end, right, tint);
    }
    for (let i = 0; i < 5; i++) {
      const a = i * 2.4;
      const p = tip
        .clone()
        .add(V(Math.cos(a) * 0.035, 0.028, Math.sin(a) * 0.035));
      flowers.triangle(
        p.clone().add(V(-0.018, 0, 0)),
        p.clone().add(V(0.018, 0, 0)),
        p.clone().add(V(0, 0.035, 0.014)),
        "#af9653",
      );
    }
  }
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    side: THREE.DoubleSide,
  });
  const group = new THREE.Group();
  group.name = "Sheltered alpine wildflowers";
  group.userData.plantBases = plantBases;
  group.add(
    foliage.mesh("Leaves and stems", material),
    flowers.mesh("Small cream and dusty pink blossoms", material),
  );
  return group;
}

// Reuse two small flower buffers across every extra patch. Instance transforms
// place each root on the actual terrain; distant patches are culled as a unit.
export function createFlowerPatchFactory() {
  const source = createAlpineFlowers(V(0, 0, 0), () => ({ height: 0, slope: 0 }));
  const base = source.userData.plantBases[1];
  const geometries = source.children.map((mesh, part) => {
    const vertices = part === 0 ? 66 : 75;
    const geometry = new THREE.BufferGeometry();
    for (const key of ["position", "normal", "color"]) {
      const attr = mesh.geometry.attributes[key];
      geometry.setAttribute(key, new THREE.Float32BufferAttribute(
        attr.array.slice(vertices * 3, vertices * 6), 3));
    }
    geometry.translate(-base.x, -base.y, -base.z);
    geometry.computeBoundingSphere();
    mesh.geometry.dispose();
    return geometry;
  });
  const material = source.children[0].material;
  return (site, ground, seed) => {
    const group = new THREE.Group();
    group.name = `Meadow wildflowers ${seed + 1}`;
    const bases = [], transforms = [];
    const size = 0.7 + random(seed + 200) * 0.6;
    const turn = random(seed + 400) * Math.PI * 2;
    const count = 30 + Math.floor(random(seed + 300) * 25);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const a = random(seed * 93 + i) * Math.PI * 2;
      const r = Math.sqrt(random(seed * 77 + i + 80)) * 3;
      const cx = [-4, 2, 4][i % 3] + Math.cos(a) * r;
      const cz = [-2, 3, -2][i % 3] + Math.sin(a) * r;
      const x = (cx * Math.cos(turn) - cz * Math.sin(turn)) * size;
      const z = (cx * Math.sin(turn) + cz * Math.cos(turn)) * size;
      const soil = ground(site.x + x, site.z + z);
      if (!soil || soil.height < 8 || soil.slope > 0.5) continue;
      const root = V(x, soil.height - site.y - 0.035, z);
      bases.push(root);
      dummy.position.copy(root);
      dummy.rotation.set(0, random(i + seed * 11) * Math.PI * 2, 0);
      dummy.scale.setScalar(0.75 + random(i + seed * 17) * 0.55);
      dummy.updateMatrix();
      transforms.push(dummy.matrix.clone());
    }
    geometries.forEach((geometry, part) => {
      const mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
      mesh.name = part ? "Meadow blossoms" : "Meadow leaves and stems";
      mesh.receiveShadow = true;
      transforms.forEach((matrix, i) => {
        mesh.setMatrixAt(i, matrix);
        if (part) mesh.setColorAt(i, new THREE.Color(i % 5 ? "#ffffff" : "#d5abbc"));
      });
      mesh.computeBoundingSphere();
      group.add(mesh);
    });
    group.userData.plantBases = bases;
    return group;
  };
}
