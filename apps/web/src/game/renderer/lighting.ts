import * as T from 'three';

// A small, original sky-reflection probe generated once per renderer. Metals
// receive a broad sky highlight instead of appearing like painted plastic.
export function makeSkyProbe(renderer: T.WebGLRenderer) {
  const scene = new T.Scene();
  const geometry = new T.SphereGeometry(10, 24, 12);
  const material = new T.MeshBasicMaterial({vertexColors: true, side: T.BackSide});
  const colors: number[] = [];
  const position = geometry.attributes.position;
  const top = new T.Color('#91b7d0'),
    horizon = new T.Color('#e2d6b5'),
    ground = new T.Color('#6b7454');
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i) / 10;
    const c = y > 0 ? horizon.clone().lerp(top, Math.pow(y, 0.45)) : horizon.clone().lerp(ground, Math.min(1, -y * 2));
    colors.push(c.r, c.g, c.b);
  }
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  scene.add(new T.Mesh(geometry, material));
  const generator = new T.PMREMGenerator(renderer);
  const probe = generator.fromScene(scene, 0.08, 0.1, 100, {size: 128});
  generator.dispose();
  geometry.dispose();
  material.dispose();
  return probe;
}
