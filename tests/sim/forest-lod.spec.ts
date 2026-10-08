import {expect, test} from 'vitest';
import * as T from 'three';
import {createForest} from '../../apps/web/src/game/renderer/forest';

function rendererStub() {
  let renders = 0;
  const state = {
    shadowMap: {enabled: false, needsUpdate: false},
    toneMapping: T.ACESFilmicToneMapping,
    getRenderTarget: () => null,
    getViewport: (value: T.Vector4) => value.set(0, 0, 1280, 720),
    getScissor: (value: T.Vector4) => value.set(0, 0, 1280, 720),
    getScissorTest: () => false,
    getClearColor: (value: T.Color) => value.set('#abcabc'),
    getClearAlpha: () => 1,
    setClearColor: () => {},
    setRenderTarget: () => {},
    setViewport: () => {},
    setScissor: () => {},
    setScissorTest: () => {},
    clear: () => {},
    render: () => renders++,
  };
  return {renderer: state as unknown as T.WebGLRenderer, renders: () => renders};
}

test('forest keeps its atlas when records change, culls outside view and owns instance buffers', () => {
  const stub = rendererStub(),
    variant = new T.Group(),
    mesh = new T.Mesh(new T.BoxGeometry(1, 2, 1), new T.MeshStandardMaterial());
  mesh.position.y = 1;
  variant.add(mesh);
  const camera = new T.PerspectiveCamera(45, 16 / 9, 0.1, 200);
  camera.position.set(0, 3, 12);
  camera.lookAt(0, 1, 0);
  camera.updateProjectionMatrix();
  const tree = (x: number) => {
    const value = new T.Group();
    value.userData.variant = 0;
    value.position.x = x;
    return value;
  };
  const first = tree(0),
    second = tree(2),
    outside = tree(100);
  const forest = createForest(stub.renderer, [variant], [first], {
    capacity: 1,
    cullOutside: true,
    pixelThreshold: 1000,
  });
  const billboard = forest.group.children[0] as T.InstancedMesh,
    originalAtlas = forest.materials[0].map;
  expect(stub.renders()).toBe(32);
  forest.setTrees([first, second, outside]);
  forest.update(camera, 720);
  expect(billboard.count).toBe(2);
  expect(billboard.instanceMatrix.count).toBeGreaterThanOrEqual(3);
  expect(forest.materials[0].map).toBe(originalAtlas);
  const sun = new T.DirectionalLight('#b5cced', 0.45),
    fill = new T.HemisphereLight('#c4d9ec', '#615e45', 1.25);
  forest.setLighting(sun, fill);
  expect(forest.materials[0].color.r).toBeLessThan(0.5);
  first.userData.lodVisible = false;
  forest.update(camera, 720);
  expect(billboard.count).toBe(1);
  forest.setTrees([]);
  forest.update(camera, 720);
  expect(billboard.visible).toBe(false);
  expect(stub.renders()).toBe(32);
  let disposed = 0;
  for (const part of forest.group.children) part.addEventListener('dispose', () => disposed++);
  const ownedMeshes = forest.group.children.length;
  forest.dispose();
  expect(disposed).toBe(ownedMeshes);
  expect(forest.group.children.length).toBe(0);
  mesh.geometry.dispose();
  mesh.material.dispose();
});
