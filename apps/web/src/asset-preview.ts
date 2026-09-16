import * as THREE from 'three';
import { createScene } from '@meridian/presentation';
import { createNorthStarWorld } from '@meridian/presentation/north-star';
import manifest from '../../../assets/asset-manifest.json';
import './asset-preview.css';

const root = document.querySelector<HTMLElement>('#asset-preview');
if (!root) throw new Error('Asset preview root is missing');

root.innerHTML = [
  '<header class="preview-header">',
  '  <a href="/">← Return to battlefield</a>',
  '  <div><span class="preview-kicker">MERIDIAN / ASSET WORKSHOP</span><h1>North Star Kit</h1></div>',
  '  <span class="preview-version" data-version></span>',
  '</header>',
  '<section class="preview-layout">',
  '  <div class="preview-stage"><canvas id="preview-canvas" aria-label="Procedural asset preview"></canvas></div>',
  '  <aside class="preview-panel">',
  '    <span class="preview-kicker">ORIGINAL PROCEDURAL KIT</span><h2>Temperate Coast</h2>',
  '    <p>Shared geometry, palette materials, semantic terrain, and local-only cosmetic motion.</p>',
  '    <dl><div><dt>ASSETS</dt><dd data-asset-count></dd></div><div><dt>LOD TARGET</dt><dd>3 BANDS</dd></div><div><dt>PROVENANCE</dt><dd>REPOSITORY</dd></div><div><dt>REMOTE LOADS</dt><dd>NONE</dd></div></dl>',
  '    <ul data-asset-list></ul>',
  '  </aside>',
  '</section>',
].join('');

root.querySelector<HTMLElement>('[data-version]')!.textContent =
  'MANIFEST ' + manifest.manifestVersion + ' · ' + manifest.contentVersion;
root.querySelector<HTMLElement>('[data-asset-count]')!.textContent = String(manifest.assets.length);
const assetList = root.querySelector<HTMLUListElement>('[data-asset-list]');
if (!assetList) throw new Error('Asset list is missing');
manifest.assets.forEach((asset) => {
  const item = document.createElement('li');
  item.innerHTML = '<span></span><small></small>';
  item.querySelector('span')!.textContent = asset.id;
  item.querySelector('small')!.textContent = asset.kind;
  assetList.append(item);
});

const canvas = document.querySelector<HTMLCanvasElement>('#preview-canvas');
if (!canvas) throw new Error('Asset preview canvas is missing');
const renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const { scene, camera } = createScene();
scene.background = new THREE.Color(0x68786f);
scene.fog = new THREE.Fog(0x68786f, 12, 28);
camera.position.set(10, 8.5, 12);
camera.lookAt(0, 0.2, 0);
scene.add(new THREE.HemisphereLight(0xf3dec0, 0x26313b, 2.1));
const key = new THREE.DirectionalLight(0xffdca6, 3);
key.position.set(-6, 12, 7);
scene.add(key);
const world = createNorthStarWorld();
scene.add(world.group);

const resize = (): void => {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
};
window.addEventListener('resize', resize);
resize();
const started = performance.now();
const render = (now: number): void => {
  world.update((now - started) / 1000, false);
  renderer.render(scene, camera);
  requestAnimationFrame(render);
};
requestAnimationFrame(render);
