import { describe, expect, it } from 'vitest';
import { createScene } from './index';

describe('presentation boundary', () => {
  it('creates a camera and scene without browser globals', () => {
    const { scene, camera } = createScene();
    expect(scene.background).not.toBeNull();
    expect(camera.position.y).toBe(7);
  });
});
