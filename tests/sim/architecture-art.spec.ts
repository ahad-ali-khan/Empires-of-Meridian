import {expect, test} from 'vitest';
import * as T from 'three';
import {buildAsset} from '../../packages/asset-tools/src/models';
import {applyCondition} from '../../packages/asset-tools/src/presentation';

function vertices(root: T.Group) {
  const result: number[] = [];
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert();
  root.traverseVisible((o) => {
    if (!(o instanceof T.Mesh)) return;
    const transform = inverse.clone().multiply(o.matrixWorld);
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const v = new T.Vector3().fromBufferAttribute(p, i).applyMatrix4(transform);
      result.push(v.x, v.y, v.z);
    }
  });
  return result;
}

test('building conditions remain attached when a lot is translated, rotated and scaled', () => {
  for (const state of ['construction', 'damaged', 'critical', 'rubble'] as const) {
    const origin = buildAsset('house', 3),
      translated = buildAsset('house', 3);
    translated.position.set(113, 7, -94);
    translated.rotation.y = 1.2;
    translated.scale.multiplyScalar(1.4);
    applyCondition(origin, 'house', state);
    applyCondition(translated, 'house', state);
    const expected = vertices(origin),
      actual = vertices(translated);
    expect(actual.length, state).toBe(expected.length);
    for (let i = 0; i < expected.length; i++) expect(actual[i], `${state}/${i}`).toBeCloseTo(expected[i], 4);
  }
});

test('static building and ship detail stays batched while naval shots remain animated', () => {
  for (const kind of ['house', 'hall', 'fort', 'barracks', 'frigate'] as const) {
    const model = buildAsset(kind);
    let draws = 0;
    model.traverse((o) => {
      if (o instanceof T.Mesh) draws++;
    });
    expect(draws, kind).toBeLessThanOrEqual(40);
    if (kind === 'frigate') {
      expect(model.getObjectByName('projectile')).toBeDefined();
      expect(model.getObjectByName('shotFlash')).toBeDefined();
      expect(model.userData.shot.type).toBe('shell');
    }
  }
});
