import * as T from 'three';
import {buildingById} from '../../../../../packages/content/src/index';

// Reservation bounds are semantic. Authored thresholds/courtyards provide the
// visible footing; the whole reserved rectangle is never a solid paving slab.
const footprintMaterial = new T.MeshBasicMaterial({visible: false});
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
  const pad = new T.Mesh(new T.BoxGeometry(hx * 2, 0.06, hz * 2), footprintMaterial);
  pad.name = 'groundFootprint';
  pad.visible = false;
  pad.position.y = 0.03;
  wrapper.add(pad, model);
  return wrapper;
}
