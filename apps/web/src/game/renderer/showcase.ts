import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {makeSkyProbe} from './lighting';
import {createWorld} from './world';
import type {Weather} from './environment';
import {animateAsset, type Clip} from '../../../../../packages/asset-tools/src/actors';
import {setFoliageTime, setResourceLevel} from '../../../../../packages/asset-tools/src/nature';
import {ellipsoid, joint, mesh} from '../../../../../packages/asset-tools/src/geometry';
import {assetInfo, buildAsset, type AssetKind, mat, beam} from '../../../../../packages/asset-tools/src/models';
import {applyCondition, effectsTime} from '../../../../../packages/asset-tools/src/presentation';
import {defaultAge, validateAge} from '../../../../../packages/asset-tools/src/ages';
import type {Condition} from '../../../../../packages/asset-tools/src/extended';
export type View = 'settlement' | 'harbor' | 'regiment' | 'resources' | 'sky' | 'studio';
export type Light = 'day' | 'golden' | 'overcast';
export interface Metrics {
  fps: number;
  frameMs: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  backend: string;
  cpuMs: number;
  pixels: number;
  trees: number;
  units: number;
  buildings: number;
  demo: string;
}
export class Showcase {
  renderer: T.WebGLRenderer;
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(42, 1, 0.2, 1600);
  controls: OrbitControls;
  world: ReturnType<typeof createWorld>;
  sun = new T.DirectionalLight('#ffe0ad', 3.1);
  fill = new T.HemisphereLight('#cbdde2', '#70734c', 2);
  studio = new T.Group();
  view: View = 'settlement';
  asset: AssetKind = 'hall';
  motion = true;
  wireframe = false;
  quality = 'high';
  comparisonScale = false;
  weather: Weather = 'clear';
  clip: Clip = 'idle';
  age = 4;
  private clipStart = 0;
  private preview: T.Group | null = null;
  private currentLight: Light = 'day';
  private variants = new Map<string, T.Group>();
  private frame = 0;
  private elapsed = 0;
  private last = 0;
  private sample = 0;
  private frames = 0;
  private targetPos: T.Vector3 | null = null;
  private targetLook: T.Vector3 | null = null;
  private smoke: T.Points;
  private birds = new T.Group();
  private keySet = new Set<string>();
  private disposer: (() => void)[] = [];
  private first = true;
  private lastShadow = -1;
  private cpuMs = 0;
  constructor(
    private host: HTMLElement,
    private onMetrics: (m: Metrics) => void,
    private onPick: (kind: AssetKind) => void,
    private onReady: () => void,
  ) {
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(1.6);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    host.append(this.renderer.domElement);
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.setAttribute(
      'aria-label',
      'Interactive 3D coastal settlement. Drag to orbit, scroll to zoom, WASD to pan.',
    );
    this.scene.background = new T.Color('#c4d2cf');
    this.scene.fog = new T.FogExp2('#c4d2cf', 0.0044);
    this.sun.position.set(-32, 62, 28);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, {left: -62, right: 62, top: 62, bottom: -62, near: 0.5, far: 180});
    this.sun.shadow.bias = -0.00025;
    this.sun.shadow.normalBias = 0.09;
    this.scene.add(this.sun, this.fill, this.sun.target);
    const skyProbe = makeSkyProbe(this.renderer);
    this.scene.environment = skyProbe.texture;
    this.scene.environmentIntensity = 0.32;
    this.disposer.push(() => skyProbe.dispose());
    this.fill.intensity = 1.05;
    this.world = createWorld(this.renderer);
    this.scene.add(this.world.group);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 115;
    this.controls.maxPolarAngle = Math.PI * 0.45;
    this.controls.minPolarAngle = 0.22;
    this.controls.screenSpacePanning = false;
    this.controls.mouseButtons = {LEFT: T.MOUSE.ROTATE, MIDDLE: T.MOUSE.PAN, RIGHT: T.MOUSE.PAN};
    this.controls.target.set(-3, 1, 0);
    this.camera.position.set(44, 41, 59);
    this.controls.update();
    this.scene.add(this.studio);
    this.studio.visible = false;
    const stage = new T.Mesh(new T.CylinderGeometry(9, 9.3, 0.35, 80), mat('#7b8580'));
    stage.position.y = -0.2;
    stage.receiveShadow = true;
    stage.name = 'stage';
    this.studio.add(stage);
    const smokeGeo = new T.BufferGeometry();
    const smokePos = new Float32Array(36 * 3);
    smokeGeo.setAttribute('position', new T.BufferAttribute(smokePos, 3));
    const smokeMat = new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {},
      vertexShader: `varying float vFade;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=130./max(1.,-mv.z);vFade=clamp((9.-position.y)/5.,0.,1.);}`,
      fragmentShader: `varying float vFade;void main(){float r=length(gl_PointCoord-.5)*2.;gl_FragColor=vec4(.76,.75,.66,(1.-smoothstep(.05,1.,r))*.13*vFade);}`,
    });
    this.smoke = new T.Points(smokeGeo, smokeMat);
    this.world.group.add(this.smoke);
    for (let i = 0; i < 9; i++) {
      const b = new T.Group();
      ellipsoid(b, 0, 0, 0, 0.075, 0.075, 0.2, '#e6e3d1');
      ellipsoid(b, 0, 0.04, 0.18, 0.065, 0.064, 0.08, '#e6e3d1');
      beam(b, [0, 0.035, 0.23], [0, 0.025, 0.32], 0.02, '#c6a45d', 0.002);
      for (const s of [-1, 1]) {
        const wing = joint(b, `wing${s}`, s * 0.04, 0, 0);
        const g = new T.BufferGeometry();
        g.setAttribute(
          'position',
          new T.Float32BufferAttribute(
            [
              0,
              0,
              0.08,
              s * 0.3,
              0.02,
              0.07,
              s * 0.65,
              -0.02,
              -0.17,
              0,
              0,
              -0.13,
              s * 0.34,
              0,
              -0.2,
              s * 0.65,
              -0.02,
              -0.17,
            ],
            3,
          ),
        );
        g.computeVertexNormals();
        const m = mat('#d0d4c6');
        m.side = T.DoubleSide;
        mesh(g, m, wing);
      }
      this.birds.add(b);
    }
    this.world.group.add(this.birds);
    const resize = () => {
      const w = host.clientWidth,
        h = host.clientHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    this.disposer.push(() => ro.disconnect());
    resize();
    const start = () => {
      this.targetPos = null;
      this.targetLook = null;
    };
    this.controls.addEventListener('start', start);
    let downX = 0,
      downY = 0;
    const down = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };
    const up = (e: PointerEvent) => {
      if (e.button !== 0 || Math.hypot(e.clientX - downX, e.clientY - downY) > 4 || this.view === 'studio') return;
      const r = this.renderer.domElement.getBoundingClientRect(),
        pointer = new T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, (-(e.clientY - r.top) / r.height) * 2 + 1),
        ray = new T.Raycaster();
      ray.setFromCamera(pointer, this.camera);
      const hit = ray.intersectObjects(this.world.pickables)[0];
      if (hit) this.onPick(hit.object.userData.kind);
    };
    this.renderer.domElement.addEventListener('pointerdown', down);
    this.renderer.domElement.addEventListener('pointerup', up);
    this.disposer.push(() => {
      this.renderer.domElement.removeEventListener('pointerdown', down);
      this.renderer.domElement.removeEventListener('pointerup', up);
    });
    const keyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement ||
        e.target instanceof HTMLButtonElement
      )
        return;
      this.keySet.add(e.key.toLowerCase());
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home'].includes(e.key)) e.preventDefault();
      if (e.key === 'Home') this.setView('settlement');
    };
    const keyUp = (e: KeyboardEvent) => this.keySet.delete(e.key.toLowerCase());
    const blur = () => this.keySet.clear();
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', blur);
    this.disposer.push(() => {
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', blur);
    });
    const lost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(this.frame);
      host.dataset.context = 'lost';
    };
    const restored = () => location.reload();
    this.renderer.domElement.addEventListener('webglcontextlost', lost);
    this.renderer.domElement.addEventListener('webglcontextrestored', restored);
    this.disposer.push(() => {
      this.renderer.domElement.removeEventListener('webglcontextlost', lost);
      this.renderer.domElement.removeEventListener('webglcontextrestored', restored);
    });
    this.renderer.compile(this.scene, this.camera);
    this.frame = requestAnimationFrame(this.tick);
  }
  setView(view: View) {
    this.view = view;
    this.world.group.visible = view !== 'studio';
    this.studio.visible = view === 'studio';
    this.controls.autoRotate = view === 'studio' && this.motion;
    this.controls.autoRotateSpeed = 0.6;
    this.controls.minDistance = view === 'studio' ? 3 : 8;
    this.controls.maxDistance = view === 'studio' ? 45 : 115;
    this.sun.shadow.needsUpdate = true;
    this.renderer.shadowMap.needsUpdate = true;
    if (view === 'studio') {
      this.setAsset(this.asset);
      this.scene.background = new T.Color('#687e7e');
      this.scene.fog = null;
      return;
    }
    this.scene.fog = new T.FogExp2(this.scene.background as T.Color, 0.0044);
    this.setLight(this.currentLight);
    const presets = {
      settlement: [
        [44, 41, 59],
        [-3, 1, 0],
      ],
      harbor: [
        [54, 21, 48],
        [25, 2, 19],
      ],
      regiment: [
        [19, 12, 33],
        [3, 1, 18],
      ],
      resources: [
        [-13, 22, 45],
        [-30, 1, 13],
      ],
      sky: [
        [54, 15, 64],
        [-5, 8, -8],
      ],
    };
    const [p, t] = presets[view];
    this.targetPos = new T.Vector3(...p);
    this.targetLook = new T.Vector3(...t);
  }
  setAsset(kind: AssetKind, age = defaultAge(kind)) {
    this.asset = kind;
    this.age = age;
    this.clipStart = this.elapsed;
    this.releasePreview();
    const key = `${kind}:${age}`;
    if (!this.variants.has(key)) this.variants.set(key, buildAsset(kind, age));
    const model = this.variants.get(key)!.clone();
    model.name = kind;
    model.userData.age = age;
    this.preview = model;
    this.studio.add(model);
    const bounds = new T.Box3().setFromObject(model),
      size = bounds.getSize(new T.Vector3());
    const radius = this.comparisonScale ? 14 : Math.max(1, size.x, size.y, size.z);
    const stage = this.studio.getObjectByName('stage')!;
    stage.scale.set(Math.max(0.12, radius / 10), 1, Math.max(0.12, radius / 10));
    model.updateMatrixWorld(true);
    const grounded = new T.Box3();
    model.traverseVisible((o) => {
      if (o instanceof T.Mesh) {
        o.geometry.computeBoundingBox();
        grounded.union(o.geometry.boundingBox!.clone().applyMatrix4(o.matrixWorld));
      }
    });
    stage.position.y = (grounded.isEmpty() ? 0 : grounded.min.y) - 0.175;
    this.targetLook = new T.Vector3(0, this.comparisonScale ? 3 : (bounds.min.y + bounds.max.y) * 0.5, 0);
    this.targetPos = new T.Vector3(
      radius * 0.97,
      this.comparisonScale ? 13 : size.y * 0.65 + radius * 0.3,
      radius * 1.72,
    );
    this.controls.autoRotate = false;
    this.applyWireframe();
  }
  private releasePreview() {
    if (!this.preview) return;
    const source = this.variants.get(`${this.preview.name}:${this.preview.userData.age || this.age}`);
    const shared = new Set<T.BufferGeometry>();
    source?.traverse((o) => {
      if (o instanceof T.Mesh) shared.add(o.geometry);
    });
    this.preview.traverse((o) => {
      if (o instanceof T.Mesh) {
        if (!shared.has(o.geometry)) o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m.userData.previewOwned) m.dispose();
      }
    });
    this.studio.remove(this.preview);
    this.preview = null;
  }
  setComparisonScale(enabled: boolean) {
    this.comparisonScale = enabled;
    this.setAsset(this.asset, this.age);
  }
  setCondition(condition: Condition) {
    this.setAsset(this.asset, this.age);
    if (this.preview) applyCondition(this.preview, this.asset, condition);
    this.renderer.localClippingEnabled = true;
    this.renderer.shadowMap.needsUpdate = true;
  }
  setEra(era: number) {
    validateAge(this.asset, era);
    this.setAsset(this.asset, era);
    this.renderer.shadowMap.needsUpdate = true;
  }
  setLight(light: Light) {
    this.renderer.shadowMap.needsUpdate = true;
    this.currentLight = light;
    const weather = this.weather;
    const grey = weather !== 'clear' || light === 'overcast';
    if (light === 'golden') {
      this.sun.color.set('#ffd19a');
      this.sun.intensity = 3.1;
      this.sun.position.set(-50, 30, 15);
      this.fill.intensity = 0.95;
      this.scene.background = new T.Color('#d2c4a8');
    } else {
      this.sun.color.set('#ffead0');
      this.sun.intensity = 3.1;
      this.sun.position.set(-32, 62, 28);
      this.fill.intensity = 1.05;
      this.scene.background = new T.Color('#bdd1d5');
    }
    if (grey) {
      this.sun.color.set('#dbe6ea');
      this.sun.intensity = weather === 'storm' ? 0.45 : 1.1;
      this.fill.intensity = weather === 'storm' ? 0.9 : 1.25;
      this.scene.background = new T.Color(weather === 'storm' ? '#748991' : '#afc3c9');
    }
    this.renderer.toneMappingExposure = 1.02;
    this.world.environment.golden.value = light === 'golden' ? 1 : 0;
    this.world.environment.sunDirection.value.copy(this.sun.position).normalize();
    this.world.environment.setWeather(light === 'overcast' && weather === 'clear' ? 'overcast' : weather);
    this.world.forest.bake(this.sun, this.fill);
    if (this.view !== 'studio')
      this.scene.fog = new T.FogExp2(
        this.scene.background as T.Color,
        weather === 'mist' ? 0.012 : weather === 'storm' ? 0.008 : 0.0032,
      );
  }
  setWeather(weather: Weather) {
    this.weather = weather;
    this.setLight(this.currentLight);
  }
  hunt(kind: 'sheep' | 'deer', hunter: AssetKind) {
    const target = this.world.huntAnimal(kind, hunter);
    if (target) {
      this.targetLook = target.clone().add(new T.Vector3(0, 1, 0));
      this.targetPos = target.clone().add(new T.Vector3(9, 7, 13));
    }
  }
  resetResources() {
    this.world.resetResources();
  }
  setClip(clip: Clip) {
    this.clip = clip;
    this.clipStart = this.elapsed;
    if (this.preview && (clip === 'die' || clip === 'dead'))
      this.preview.userData.deathDirection = Math.random() * Math.PI * 2;
  }
  setOreRemaining(percent: number) {
    this.world.setOreRemaining(percent);
    if (this.preview) setResourceLevel(this.preview, percent);
    this.renderer.shadowMap.needsUpdate = true;
  }
  setQuality(q: string) {
    this.quality = q;
    this.renderer.setPixelRatio(q === 'high' ? 1.6 : 1);
    this.renderer.shadowMap.enabled = q === 'high';
    this.world.grass.visible = q === 'high';
  }
  setMotion(enabled: boolean) {
    this.motion = enabled;
    this.controls.autoRotate = false;
  }
  setWireframe(enabled: boolean) {
    this.wireframe = enabled;
    this.applyWireframe();
  }
  private applyWireframe() {
    this.scene.traverse((o) => {
      if (o instanceof T.Mesh && o.material instanceof T.MeshStandardMaterial) o.material.wireframe = this.wireframe;
    });
  }
  capture() {
    this.renderer.render(this.scene, this.camera);
    const a = document.createElement('a');
    a.href = this.renderer.domElement.toDataURL('image/png');
    a.download = `meridian-${this.view === 'studio' ? this.asset : this.view}.png`;
    a.click();
  }
  private tick = (now: number) => {
    const cpuStart = performance.now();
    const dt = this.last ? Math.min((now - this.last) / 1000, 0.05) : 0.016;
    this.last = now;
    if (this.motion) this.elapsed += dt;
    const t = this.elapsed;
    if (this.targetPos && this.targetLook) {
      const blend = 1 - Math.exp(-dt * 5);
      this.camera.position.lerp(this.targetPos, blend);
      this.controls.target.lerp(this.targetLook, blend);
      if (this.camera.position.distanceTo(this.targetPos) < 0.05) {
        this.targetPos = null;
        this.targetLook = null;
      }
    }
    if (this.keySet.size && this.view !== 'studio') {
      const forward = new T.Vector3();
      this.camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();
      const side = new T.Vector3().crossVectors(forward, new T.Vector3(0, 1, 0));
      const v = new T.Vector3();
      if (this.keySet.has('w') || this.keySet.has('arrowup')) v.add(forward);
      if (this.keySet.has('s') || this.keySet.has('arrowdown')) v.sub(forward);
      if (this.keySet.has('a') || this.keySet.has('arrowleft')) v.sub(side);
      if (this.keySet.has('d') || this.keySet.has('arrowright')) v.add(side);
      v.multiplyScalar(dt * 20);
      this.camera.position.add(v);
      this.controls.target.add(v);
    }
    this.controls.target.x = T.MathUtils.clamp(this.controls.target.x, -65, 65);
    this.controls.target.z = T.MathUtils.clamp(this.controls.target.z, -65, 65);
    this.controls.update(dt);
    setFoliageTime(t, this.world.environment.wind.value);
    effectsTime.value = t;
    if (this.view !== 'studio') {
      this.world.update(t);
      this.world.forest.update(this.camera, this.renderer.domElement.height);
      this.world.environment.update(t, this.camera);
    } else if (this.preview) animateAsset(this.preview, t - this.clipStart, this.clip);
    const ps = this.smoke.geometry.attributes.position;
    const chimneys = this.world.layout.buildings.filter((p) => p.kind === 'house').slice(0, 3);
    for (let i = 0; i < ps.count; i++) {
      const phase = (t * 0.25 + i / 12) % 1,
        {x, z, y} = chimneys[i % 3];
      ps.setXYZ(i, x - 0.8 + phase * 2 + Math.sin(i * 7) * 0.15, y + 4.1 + phase * 4, z - 0.65 + phase * 0.65);
    }
    ps.needsUpdate = true;
    this.birds.children.forEach((b, i) => {
      const a = t * 0.08 + i * 0.45;
      b.position.set(19 + Math.cos(a) * 16, 16 + Math.sin(a * 0.8) * 2 + i * 0.3, -7 + Math.sin(a) * 12);
      b.rotation.y = -a;
      b.rotation.z = Math.sin(t * 0.7 + i) * 0.08;
      for (const s of [-1, 1]) {
        const w = b.getObjectByName(`wing${s}`);
        if (w) w.rotation.z = s * Math.sin(t * 3.6 + i) * 0.4;
      }
    });
    if (this.lastShadow < 0 || this.view === 'studio' || t - this.lastShadow > 1 / 30) {
      this.renderer.shadowMap.needsUpdate = true;
      this.lastShadow = t;
    }
    this.renderer.render(this.scene, this.camera);
    this.cpuMs = this.cpuMs * 0.9 + (performance.now() - cpuStart) * 0.1;
    if (this.first) {
      this.first = false;
      this.onReady();
    }
    this.frames++;
    if (now - this.sample > 1000) {
      const fps = Math.round((this.frames * 1000) / (now - this.sample));
      this.onMetrics({
        fps,
        frameMs: Math.round(10000 / fps) / 10,
        drawCalls: this.renderer.info.render.calls,
        triangles: this.renderer.info.render.triangles,
        geometries: this.renderer.info.memory.geometries,
        textures: this.renderer.info.memory.textures,
        backend: 'WebGL 2',
        cpuMs: Math.round(this.cpuMs * 10) / 10,
        pixels: this.renderer.domElement.width * this.renderer.domElement.height,
        demo: this.world.getDemoStatus(),
        ...this.world.stats,
      });
      this.frames = 0;
      this.sample = now;
    }
    this.frame = requestAnimationFrame(this.tick);
  };
  dispose() {
    cancelAnimationFrame(this.frame);
    this.world.forest.dispose();
    this.disposer.forEach((fn) => fn());
    this.controls.dispose();
    const gs = new Set<T.BufferGeometry>(),
      ms = new Set<T.Material>(),
      textures = new Set<T.Texture>();
    const collect = (o: T.Object3D) => {
      if (o instanceof T.Mesh || o instanceof T.Points) {
        gs.add(o.geometry);
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m: T.Material) => {
          ms.add(m);
          Object.values(m).forEach((v) => {
            if (v instanceof T.Texture) textures.add(v);
          });
        });
      }
    };
    this.scene.traverse(collect);
    this.world.models.forEach((m) => m.traverse(collect));
    this.variants.forEach((m) => m.traverse(collect));
    gs.forEach((g) => g.dispose());
    ms.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
export {assetInfo};
