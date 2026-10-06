import {expect, test} from 'vitest';
import * as T from 'three';
import {buildAsset, animateAsset} from '../../packages/asset-tools/src/models';

test('work poses reach in three dimensions with a bending spine and planted feet', () => {
  for (const kind of ['villager', 'villagerFemale'] as const) {
    const model = buildAsset(kind),
      elbow = model.getObjectByName('elbow1')!,
      spine = model.getObjectByName('spine')!;
    const elbowPoints: T.Vector3[] = [],
      footHeights: number[] = [],
      bends: number[] = [];
    for (let i = 0; i < 24; i++) {
      animateAsset(model, i * 0.1, 'mine');
      model.updateMatrixWorld(true);
      elbowPoints.push(elbow.getWorldPosition(new T.Vector3()));
      footHeights.push(model.getObjectByName('foot1')!.getWorldPosition(new T.Vector3()).y);
      bends.push(spine.rotation.x);
    }
    const bounds = new T.Box3().setFromPoints(elbowPoints),
      range = bounds.getSize(new T.Vector3());
    expect(range.x).toBeGreaterThan(0.075);
    expect(range.y).toBeGreaterThan(0.15);
    expect(range.z).toBeGreaterThan(0.12);
    expect(Math.max(...bends) - Math.min(...bends)).toBeGreaterThan(0.5);
    expect(Math.max(...footHeights) - Math.min(...footHeights)).toBeLessThan(0.03);
  }
});

test('game-rendered weapon animations never spawn duplicate forge projectiles', () => {
  for (const kind of ['infantry', 'archer', 'crossbow', 'grenadier', 'cannon', 'frigate'] as const) {
    const model = buildAsset(kind);
    model.traverse((o) => (o.userData.externalProjectiles = true));
    const shot = model.userData.shot;
    animateAsset(model, shot.release + 0.1, kind === 'cannon' ? 'fire' : 'attack');
    expect(model.getObjectByName('projectile')!.visible, kind).toBe(false);
  }
});
