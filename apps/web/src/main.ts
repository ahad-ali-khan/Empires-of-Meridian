import * as THREE from 'three';
import { createScene } from '@meridian/presentation';
import './style.css';

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('App root is missing');

const canvas = document.createElement('canvas');
canvas.id = 'meridian-canvas';
canvas.setAttribute('aria-label', 'Meridian battlefield visual foundation');
app.append(canvas);

const renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x171714, 1);

const { scene, camera } = createScene();
scene.add(new THREE.HemisphereLight(0xf3dec0, 0x26313b, 2));
const key = new THREE.DirectionalLight(0xffe3b0, 2.5);
key.position.set(5, 8, 4);
scene.add(key);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(18, 12),
  new THREE.MeshStandardMaterial({ color: 0x705f48, roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const resize = () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
};
window.addEventListener('resize', resize);
resize();

const render = () => {
  renderer.render(scene, camera);
  requestAnimationFrame(render);
};
render();
