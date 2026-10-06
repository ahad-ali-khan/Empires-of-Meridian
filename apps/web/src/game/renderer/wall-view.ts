import * as T from 'three';
import {buildAsset} from '../../../../../packages/asset-tools/src/models';
import {terrainHeight} from '../../../../../packages/sim/src/terrain';
import type {WallSpan} from '../../../../../packages/sim/src/walls';

// Keep posts upright while the panel follows the endpoints' terrain heights.
// This same transform is used by the preview and completed wall/gate.
export function alignWall(model: T.Group, span: WallSpan, size: number, seed: number) {
  if (!model.userData.wallMatrix) {
    model.updateMatrix();
    model.userData.wallMatrix = model.matrix.clone();
    model.userData.wallWidth = new T.Box3().setFromObject(model).getSize(new T.Vector3()).x;
  }
  const length = Math.hypot(span.dx, span.dz) / 256;
  const a = terrainHeight((span.x - span.dx / 2) / 256, (span.z - span.dz / 2) / 256, size, seed),
    b = terrainHeight((span.x + span.dx / 2) / 256, (span.z + span.dz / 2) / 256, size, seed),
    y = terrainHeight(span.x / 256, span.z / 256, size, seed),
    scale = length / Math.max(0.1, model.userData.wallWidth),
    slope = (b - a) / Math.max(0.1, length);
  model.matrixAutoUpdate = false;
  model.matrix
    .set(scale, 0, 0, 0, slope * scale, 1, 0, (a + b) / 2 - y, 0, 0, 1, 0, 0, 0, 0, 1)
    .multiply(model.userData.wallMatrix);
  model.matrixWorldNeedsUpdate = true;
}
export function updateWallPreview(
  root: T.Group,
  spans: WallSpan[],
  age: number,
  size: number,
  seed: number,
  invalid: boolean,
) {
  let template = root.userData.wallTemplate as T.Group | undefined;
  if (!template) {
    template = buildAsset('wall', age);
    root.userData.wallTemplate = template;
  }
  const pool = (root.userData.wallPool ??= []) as T.Group[];
  for (let i = 0; i < spans.length; i++) {
    if (!pool[i]) {
      const view = new T.Group(),
        model = template.clone();
      model.traverse((o) => {
        if (!(o instanceof T.Mesh)) return;
        o.material = new T.MeshBasicMaterial({color: '#7ee8b4', transparent: true, opacity: 0.46, depthWrite: false});
        o.castShadow = false;
        o.receiveShadow = false;
      });
      view.add(model);
      root.add(view);
      pool.push(view);
    }
    const span = spans[i],
      view = pool[i];
    view.visible = true;
    view.position.set(span.x / 256, terrainHeight(span.x / 256, span.z / 256, size, seed), span.z / 256);
    view.rotation.y = -Math.atan2(span.dz, span.dx);
    alignWall(view.children[0] as T.Group, span, size, seed);
    view.traverse((o) => {
      if (o instanceof T.Mesh) (o.material as T.MeshBasicMaterial).color.set(invalid ? '#eb6556' : '#7ee8b4');
    });
  }
  for (let i = spans.length; i < pool.length; i++) pool[i].visible = false;
}
