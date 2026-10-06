import * as T from 'three';
import {box, beam, cyl, C, consolidate, mesh} from './geometry';
import type {Condition} from './extended';
import {setResourceLevel, buildFelledTree} from './nature';
export const effectsTime = {value: 0};
const fireMaterial = new T.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  side: T.DoubleSide,
  uniforms: {time: effectsTime},
  vertexShader: `uniform float time;varying vec2 vUv;void main(){vUv=uv;vec3 p=position;p.x+=sin(time*6.+p.y*4.)*.10*p.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
  fragmentShader: `uniform float time;varying vec2 vUv;void main(){float x=abs(vUv.x-.5)*2.;float tongue=sin(vUv.y*13.-time*7.)*.10;float width=(1.-vUv.y)*.88+tongue;float edge=1.-smoothstep(width-.16,width+.1,x);float a=edge*(1.-smoothstep(.7,1.,vUv.y))*.82;gl_FragColor=vec4(mix(vec3(1.,.24,.025),vec3(1.,.87,.40),pow(1.-vUv.y,2.)),a);}`,
});
const smokeMaterial = new T.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  side: T.DoubleSide,
  uniforms: {time: effectsTime},
  vertexShader: `uniform float time;varying vec2 vUv;void main(){vUv=uv;vec3 p=position;p.x+=sin(time*.7+p.y)*p.y*.08;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
  fragmentShader: `uniform float time;varying vec2 vUv;void main(){vec2 p=vec2((vUv.x-.5)*2.,vUv.y);float edge=1.-smoothstep(.15,.70,abs(p.x)+sin(p.y*8.-time)*.09);float a=edge*sin(clamp(p.y,0.,1.)*3.14159)*.22;gl_FragColor=vec4(vec3(.17,.19,.18),a);}`,
});
// Conditions are authored in the asset's local coordinates. Using world bounds
// here made scaffolding and fire drift on translated, rotated or scaled lots.
function localBounds(root: T.Group) {
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert(),
    bounds = new T.Box3();
  root.traverseVisible((o) => {
    if (o instanceof T.Mesh && o.name !== 'groundFootprint') {
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      if (o.geometry.boundingBox)
        bounds.union(o.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(o.matrixWorld)));
    }
  });
  return bounds;
}
function debris(root: T.Group, bounds: T.Box3, amount = 18) {
  const size = bounds.getSize(new T.Vector3()),
    center = bounds.getCenter(new T.Vector3()),
    pieces = new T.Group();
  pieces.name = 'structuralDebris';
  for (let i = 0; i < amount; i++) {
    const a = i * 2.399,
      r = 0.15 + Math.sqrt((i + 0.5) / amount) * 0.72;
    const x = center.x + Math.cos(a) * size.x * 0.43 * r,
      z = center.z + Math.sin(a) * size.z * 0.43 * r;
    const block = box(
      pieces,
      0.2 + size.x * 0.018,
      0.13 + (i % 3) * 0.055,
      0.21 + size.z * 0.008,
      x,
      bounds.min.y + 0.1 + (i % 3) * 0.035,
      z,
      i % 3 ? '#a69c83' : '#797b69',
    );
    block.rotation.set(0.08 * (i % 3), a, 0.06 * (i % 2));
    if (i % 5 === 0) {
      const plank = box(
        pieces,
        Math.min(size.x * 0.2, 0.9),
        0.09,
        0.13,
        x,
        bounds.min.y + 0.16,
        z,
        i % 2 ? C.wood : '#514737',
      );
      plank.rotation.y = a + 0.8;
    }
  }
  root.add(consolidate(pieces));
}
function cloneMaterials(object: T.Mesh, change: (material: T.Material) => void) {
  const copy = (m: T.Material) => {
    const clone = m.clone();
    clone.userData.previewOwned = true;
    change(clone);
    return clone;
  };
  object.material = Array.isArray(object.material) ? object.material.map(copy) : copy(object.material);
}
export function applyCondition(root: T.Group, kind: string, state: Condition) {
  if (state === 'full' || state === 'half' || state === 'depleted') {
    setResourceLevel(root, state === 'full' ? 100 : state === 'half' ? 50 : 0);
    return;
  }
  if (state === 'cleared') {
    root.visible = false;
    return;
  }
  const bounds = localBounds(root),
    size = bounds.getSize(new T.Vector3());
  if (state === 'sinking') {
    root.rotation.z = 0.24;
    root.position.y = -size.y * 0.36;
    return;
  }
  if (state === 'halfCut') {
    root.children.forEach((o) => (o.visible = false));
    root.add(buildFelledTree(127, kind === 'pine'));
    return;
  }
  if (state === 'stump') {
    root.children.forEach((o) => (o.visible = false));
    const stump = new T.Mesh(
      new T.CylinderGeometry(0.24, 0.34, 0.48, 16),
      new T.MeshStandardMaterial({color: '#a6895d'}),
    );
    stump.position.y = 0.24;
    root.add(stump);
    return;
  }
  if (state === 'rubble') {
    root.children.forEach((o) => (o.visible = false));
    const ruin = new T.Group();
    ruin.name = 'ruinedFoundation';
    const center = bounds.getCenter(new T.Vector3()),
      hx = size.x * 0.37,
      hz = size.z * 0.37;

    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 6; i++) {
        const h = 0.16 + ((i * 7 + (side + 1) * 3) % 5) * 0.105;
        box(
          ruin,
          size.x * 0.12,
          h,
          0.23,
          center.x + (i - 2.5) * size.x * 0.13,
          bounds.min.y + h / 2,
          center.z + side * hz,
          '#a19780',
        );
        if (i < 4)
          box(
            ruin,
            0.24,
            h * 0.8,
            size.z * 0.17,
            center.x + side * hx,
            bounds.min.y + h * 0.4,
            center.z + (i - 1.5) * size.z * 0.18,
            '#928d76',
          );
      }
    }
    root.add(consolidate(ruin));
    debris(root, bounds, 40);
    return;
  }
  if (state === 'construction') {
    root.traverse((o) => {
      if (o.name === 'roof' || o.name === 'factionFlag') o.visible = false;
      if (o instanceof T.Mesh && o.name !== 'groundFootprint')
        cloneMaterials(o, (m) => {
          m.clippingPlanes = [
            new T.Plane(new T.Vector3(0, -1, 0), bounds.min.y + Math.min(size.y * 0.47, 2.2)).applyMatrix4(
              root.matrixWorld,
            ),
          ];
          m.clipShadows = true;
        });
    });
    const scaffold = new T.Group(),
      h = Math.min(size.y, 5);
    scaffold.name = 'constructionScaffold';
    const center = bounds.getCenter(new T.Vector3());
    scaffold.position.set(center.x, bounds.min.y, center.z);
    for (const x of [-1, 1])
      for (const z of [-1, 1])
        beam(
          scaffold,
          [x * size.x * 0.47, 0, z * size.z * 0.47],
          [x * size.x * 0.47, h, z * size.z * 0.47],
          0.06,
          C.wood,
        );
    for (let y = 0.7; y < h; y += 0.95)
      for (const z of [-1, 1]) {
        box(scaffold, size.x * 0.96, 0.08, Math.min(0.43, size.z * 0.16), 0, y, z * size.z * 0.43, C.wood);
        beam(
          scaffold,
          [-size.x * 0.47, y - 0.65, z * size.z * 0.47],
          [size.x * 0.47, y + 0.2, z * size.z * 0.47],
          0.035,
          C.wood,
        );
      }
    for (let i = 0; i < 6; i++)
      box(
        scaffold,
        Math.min(0.75, size.x * 0.14),
        0.12,
        Math.min(0.25, size.z * 0.12),
        -size.x * 0.28 + i * size.x * 0.11,
        0.08 + (i % 3) * 0.12,
        size.z * 0.4,
        C.stone,
      );
    const ladderX = -size.x * 0.39,
      ladderZ = size.z * 0.35;
    for (const side of [-1, 1])
      beam(
        scaffold,
        [ladderX + side * 0.18, 0, ladderZ + 0.3],
        [ladderX + side * 0.18, h * 0.85, ladderZ],
        0.033,
        C.wood,
      );
    for (let y = 0.2; y < h * 0.85; y += 0.28)
      beam(
        scaffold,
        [ladderX - 0.18, y, ladderZ + 0.3 * (1 - y / (h * 0.85))],
        [ladderX + 0.18, y, ladderZ + 0.3 * (1 - y / (h * 0.85))],
        0.026,
        '#aa8c5e',
      );
    for (let i = 0; i < 4; i++)
      box(scaffold, Math.min(1.8, size.x * 0.3), 0.065, 0.15, 0, 0.08 + i * 0.07, -size.z * 0.37, C.wood);
    const mortar = cyl(scaffold, 0.22, 0.18, 0.3, size.x * 0.28, 0.15, size.z * 0.29, '#817661', 12);
    mortar.name = 'mortarBucket';
    // Fit the whole scaffold, including beam radii and ladder feet, inside
    // the authoritative lot even when the authored building is asymmetric.
    const lot = root.getObjectByName('groundFootprint');
    if (lot instanceof T.Mesh) {
      lot.geometry.computeBoundingBox();
      const reservation = lot.geometry.boundingBox!,
        actual = localBounds(scaffold);
      const center = actual.getCenter(new T.Vector3()),
        offsetX = scaffold.position.x + center.x,
        offsetZ = scaffold.position.z + center.z;
      const fit = Math.min(
        1,
        (reservation.max.x - 0.03) /
          Math.max(Math.abs(offsetX + actual.min.x - center.x), Math.abs(offsetX + actual.max.x - center.x)),
        (reservation.max.z - 0.03) /
          Math.max(Math.abs(offsetZ + actual.min.z - center.z), Math.abs(offsetZ + actual.max.z - center.z)),
      );
      scaffold.scale.x *= fit;
      scaffold.scale.z *= fit;
      scaffold.position.x *= fit;
      scaffold.position.z *= fit;
    }
    root.add(consolidate(scaffold));
    return;
  }
  if (state === 'damaged' || state === 'critical') {
    root.updateMatrixWorld(true);
    // Deform closed solids instead of deleting individual triangles: shared
    // vertex positions receive the same displacement, so their seams stay closed.
    const critical = state === 'critical';
    root.traverse((o) => {
      if (o instanceof T.Mesh && o.name !== 'groundFootprint') {
        cloneMaterials(o, (m) => {
          if (m instanceof T.MeshStandardMaterial) m.color.multiplyScalar(critical ? 0.68 : 0.86);
        });
        const geometry = o.geometry.clone(),
          position = geometry.attributes.position,
          toLocal = root.matrixWorld.clone().invert().multiply(o.matrixWorld),
          inverse = toLocal.clone().invert();
        for (let i = 0; i < position.count; i++) {
          const v = new T.Vector3().fromBufferAttribute(position, i).applyMatrix4(toLocal);
          const height = T.MathUtils.smoothstep(v.y, bounds.min.y + size.y * 0.22, bounds.max.y);
          const side = T.MathUtils.smoothstep(v.x, bounds.min.x, bounds.max.x);
          const front = T.MathUtils.smoothstep(v.z, bounds.min.z, bounds.max.z);
          const collapse = height * side * front * (critical ? 0.28 : 0.12);
          v.y -= size.y * collapse;
          v.x -= collapse * size.x * 0.035;
          v.applyMatrix4(inverse);
          position.setXYZ(i, v.x, v.y, v.z);
        }
        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();
        o.geometry = geometry;
      }
    });
    const roofs: T.Object3D[] = [];
    root.traverse((o) => {
      if (o.name === 'roof') roofs.push(o);
    });
    if (critical && roofs.length > 0) {
      const roof = roofs[roofs.length - 1];
      roof.visible = false;
      const wreck = new T.Group();
      wreck.name = 'collapsedRoof';
      box(
        wreck,
        Math.min(size.x * 0.45, 3),
        0.18,
        Math.min(size.z * 0.3, 2),
        size.x * 0.25,
        0.2,
        size.z * 0.28,
        C.roof,
      );
      for (let i = 0; i < 4; i++)
        beam(
          wreck,
          [size.x * 0.1 + i * 0.2, 0.15, size.z * 0.15],
          [size.x * 0.3 + i * 0.2, 0.45, size.z * 0.4],
          0.07,
          C.wood,
        );
      root.add(consolidate(wreck));
    }
    debris(root, bounds, state === 'critical' ? 28 : 12);
    const flames = new T.Group();
    flames.name = 'damageFire';
    const center = bounds.getCenter(new T.Vector3());
    for (let i = 0; i < (critical ? 5 : 2); i++) {
      const a = i * 2.399,
        x = center.x + Math.cos(a) * size.x * 0.22,
        z = center.z + Math.sin(a) * size.z * 0.21;
      // Fire sits on the remaining structure, not in an unrelated world-space patch.
      const y = bounds.min.y + size.y * (i % 2 ? 0.28 : 0.47),
        h = Math.min(1.65, 0.5 + size.y * 0.15);
      for (let layer = 0; layer < 2; layer++) {
        const flame = mesh(new T.PlaneGeometry(h * 0.6, h, 3, 4), fireMaterial, flames, x, y + h * 0.4, z);
        flame.rotation.y = i * 0.73 + (layer * Math.PI) / 2;
      }
      for (let layer = 0; layer < 2; layer++) {
        const smoke = mesh(new T.PlaneGeometry(h * 1.4, h * 2.8, 2, 4), smokeMaterial, flames, x, y + h * 1.9, z);
        smoke.rotation.y = i * 0.73 + (layer * Math.PI) / 2;
      }
    }
    root.add(flames);
  }
}
