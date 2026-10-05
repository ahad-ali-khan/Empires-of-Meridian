import * as T from 'three';
import {buildingById} from '../../../../../packages/content/src/index';

// The reserved lot is the visible ground edge in every age. Keep authored
// proportions, fit overhangs inside it, and show unused space as a foundation.
export function prepareBuildingView(model: T.Group, kind: string) {
  const definition = buildingById.get(kind);
  if (!definition) return;
  const [hx, hz] = definition.footprint;
  const bounds = new T.Box3().setFromObject(model);
  const factor = Math.min(
    1,
    hx / Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x)),
    hz / Math.max(Math.abs(bounds.min.z), Math.abs(bounds.max.z)),
  );
  model.scale.x *= factor;
  model.scale.z *= factor;
  const wrapper = new T.Group();
  // Authored roots may be scaled. The lot itself must stay in world units.
  const pad = new T.Mesh(
    new T.BoxGeometry(hx * 2, 0.06, hz * 2),
    new T.MeshStandardMaterial({color: kind === 'farm' ? '#766344' : '#a99f83', roughness: 1}),
  );
  pad.name = 'groundFootprint';
  pad.position.y = 0.03;
  wrapper.add(pad, model);
  return wrapper;
}
