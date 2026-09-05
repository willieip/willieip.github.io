import * as THREE from 'three';

const windDeformation = `
  float windHeight = smoothstep(0.8, 7.5, position.y);
  float windPhase = position.x * 0.31 + position.z * 0.23;
  float gust = 0.65 + 0.35 * sin(uParkWindTime * 0.39 + windPhase * 0.25);
  float sway = sin(uParkWindTime * 0.82 + windPhase)
    + 0.28 * sin(uParkWindTime * 1.47 + windPhase * 0.73);
  float flutter = sin(uParkWindTime * 5.3 + position.x * 7.1 + position.z * 8.7 + position.y * 4.3);
  transformed.x += windHeight * gust * (0.085 * sway + 0.012 * flutter);
  transformed.z += windHeight * gust * (0.046 * sin(uParkWindTime * 0.73 + windPhase + 1.3));
  transformed.y += windHeight * 0.013 * flutter;
`;

function leafGeometry() {
  const geometry = new THREE.BufferGeometry();
  // A folded, pointed leaf with a short stem, rather than a rectangular sprite.
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, .095, 0, -.041, .038, 0, 0, .040, .009, .041, .038, 0,
    -.032, -.024, 0, 0, -.035, .009, .032, -.024, 0,
    0, -.078, 0, -.003, -.076, 0, .003, -.076, 0, 0, -.108, 0,
  ], 3));
  geometry.setIndex([0,1,2,0,2,3,1,4,5,1,5,2,2,5,6,2,6,3,4,7,5,5,7,6,8,10,9]);
  geometry.computeVertexNormals();
  return geometry;
}

type Leaf = {
  phase: 'waiting' | 'falling' | 'resting';
  start: THREE.Vector3; landing: THREE.Vector3; position: THREE.Vector3;
  age: number; duration: number; rest: number; scale: number; seed: number; spin: number;
};

export function createParkWind(scene: THREE.Scene, canopies: THREE.Group, floor: THREE.Mesh[], reducedMotion: boolean) {
  const time = {value: 0};
  const shaderMaterials = new Map<THREE.Material, THREE.Material>();
  function animateMaterial(material: THREE.Material) {
    material.onBeforeCompile = shader => {
      shader.uniforms.uParkWindTime = time;
      shader.vertexShader = 'uniform float uParkWindTime;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + windDeformation);
    };
    material.customProgramCacheKey = () => 'park-gentle-canopy-wind-v1';
    return material;
  }
  const depth = animateMaterial(new THREE.MeshDepthMaterial({depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide}));
  const distance = animateMaterial(new THREE.MeshDistanceMaterial({side: THREE.DoubleSide}));
  const canopyPoints: {position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute; count: number}[] = [];
  let pointCount = 0;
  canopies.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    if (!reducedMotion) {
      const original = object.material as THREE.Material;
      if (!shaderMaterials.has(original)) shaderMaterials.set(original, animateMaterial(original.clone()));
      object.material = shaderMaterials.get(original)!;
      object.customDepthMaterial = depth;
      object.customDistanceMaterial = distance;
      object.geometry.computeBoundingSphere();
      if (object.geometry.boundingSphere) object.geometry.boundingSphere.radius += .18;
    }
    const position = object.geometry.getAttribute('position');
    pointCount += position.count;
    canopyPoints.push({position, count: pointCount});
  });

  const material = new THREE.MeshStandardMaterial({color: 0xffffff, roughness: .94, side: THREE.DoubleSide});
  const falling = new THREE.InstancedMesh(leafGeometry(), material, 40);
  falling.name = 'Wind | falling and settled leaves';
  falling.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  falling.frustumCulled = false;
  falling.receiveShadow = true;
  falling.visible = !reducedMotion;
  scene.add(falling);
  const transform = new THREE.Object3D();
  const palette = [0x737d41, 0x85834a, 0x9c8751, 0x5d713b, 0x68733c].map(c => new THREE.Color(c));
  const leaves: Leaf[] = Array.from({length: falling.count}, (_, i) => {
    transform.scale.setScalar(0);transform.updateMatrix();falling.setMatrixAt(i, transform.matrix);
    falling.setColorAt(i, palette[i % palette.length]);
    return {phase: 'waiting', start: new THREE.Vector3(), landing: new THREE.Vector3(), position: new THREE.Vector3(), age: 0, duration: 0, rest: 0, scale: 1, seed: 0, spin: 0};
  });
  if (falling.instanceColor) falling.instanceColor.needsUpdate = true;
  const ray = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0), origin = new THREE.Vector3();
  floor.forEach(mesh => mesh.updateMatrixWorld(true));
  let elapsed = 0, pending = 0, nextLeaf = .6;

  function spawn(leaf: Leaf) {
    if (!pointCount) return;
    // Pick a real canopy point and a landing point on the modeled ground.
    for (let attempt = 0; attempt < 16; attempt++) {
      const index = Math.floor(Math.random() * pointCount);
      const source = canopyPoints.find(points => index < points.count)!;
      const localIndex = index - (source.count - source.position.count);
      leaf.start.fromBufferAttribute(source.position, localIndex);
      if (leaf.start.y < 2.8) continue;
      leaf.landing.set(leaf.start.x + .5 + Math.random() * .9, 0, leaf.start.z + .2 + Math.random() * .7);
      if (Math.abs(leaf.landing.x) > 7.25 || leaf.landing.z < -6.35 || leaf.landing.z > 4.18) continue;
      origin.set(leaf.landing.x, 15, leaf.landing.z);ray.set(origin, down);
      const hit = ray.intersectObjects(floor, false)[0];
      if (!hit) continue;
      leaf.landing.y = hit.point.y + .013;
      leaf.duration = (leaf.start.y - leaf.landing.y) / (.55 + Math.random() * .28);
      leaf.rest = 14 + Math.random() * 10;
      leaf.scale = .60 + Math.random() * .42;
      leaf.seed = Math.random() * Math.PI * 2;leaf.spin = .7 + Math.random() * 1.4;
      leaf.age = 0;leaf.phase = 'falling';
      return;
    }
  }

  return {
    update(dt: number) {
      if (reducedMotion || !canopies.visible) return false;
      pending += dt;
      if (pending < 1 / 30) return false;
      const step = pending;pending = 0;elapsed += step;time.value = elapsed;
      if (elapsed >= nextLeaf) {
        const leaf = leaves.find(item => item.phase === 'waiting');
        if (leaf) spawn(leaf);
        nextLeaf = elapsed + 1.2 + Math.random() * 1.6;
      }
      leaves.forEach((leaf, i) => {
        if (leaf.phase === 'waiting') return;
        leaf.age += step;
        if (leaf.phase === 'falling') {
          const t = Math.min(1, leaf.age / leaf.duration);
          leaf.position.lerpVectors(leaf.start, leaf.landing, t);
          const flutter = Math.sin(Math.PI * t);
          leaf.position.x += Math.sin(leaf.age * 2.2 + leaf.seed) * .14 * flutter;
          leaf.position.z += Math.cos(leaf.age * 1.7 + leaf.seed) * .10 * flutter;
          transform.rotation.set(Math.sin(leaf.age * 3 + leaf.seed) * .9, leaf.age * leaf.spin, leaf.age * .7 + leaf.seed);
          // Settle flat as the leaf reaches the ground.
          const settle = THREE.MathUtils.smoothstep(t, .92, 1);
          transform.rotation.x = THREE.MathUtils.lerp(transform.rotation.x, -Math.PI / 2, settle);
          transform.rotation.y = THREE.MathUtils.lerp(transform.rotation.y, 0, settle);
          transform.rotation.z = THREE.MathUtils.lerp(transform.rotation.z, leaf.seed, settle);
          transform.scale.setScalar(leaf.scale);
          if (t === 1) {leaf.phase = 'resting';leaf.age = 0;leaf.position.copy(leaf.landing);}
        } else {
          transform.rotation.set(-Math.PI / 2, 0, leaf.seed);
          const fade = 1 - THREE.MathUtils.smoothstep(leaf.age, leaf.rest - 3, leaf.rest);
          transform.scale.setScalar(leaf.scale * fade);
          if (leaf.age >= leaf.rest) leaf.phase = 'waiting';
        }
        transform.position.copy(leaf.position);transform.updateMatrix();falling.setMatrixAt(i, transform.matrix);
      });
      falling.instanceMatrix.needsUpdate = true;
      return true;
    },
    dispose() {
      scene.remove(falling);falling.geometry.dispose();material.dispose();depth.dispose();distance.dispose();
      floor.forEach(mesh => mesh.geometry.dispose());
      const materials = new Set(floor.map(mesh => mesh.material));
      materials.forEach(m => { if (Array.isArray(m)) m.forEach(item => item.dispose()); else m.dispose(); });
    },
  };
}
