import * as THREE from 'three';

export function createScene(): { scene: THREE.Scene; camera: THREE.PerspectiveCamera } {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x171714);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(7, 7, 9);
  camera.lookAt(0, 0, 0);
  return { scene, camera };
}
