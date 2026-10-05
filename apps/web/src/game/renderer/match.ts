import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {buildAsset, animateAsset, type AssetKind} from '../../../../../packages/asset-tools/src/models';
import {setFoliageTime} from '../../../../../packages/asset-tools/src/nature';
import type {Clip} from '../../../../../packages/asset-tools/src/actors';
import {placementReason, type MatchSnapshot} from '../../../../../packages/sim/src/index';
import {buildingById, productionName} from '../../../../../packages/content/src/index';
import {applyCondition, effectsTime} from '../../../../../packages/asset-tools/src/presentation';
import {prepareBuildingView} from './building-view';
import {halfBounds} from '../../../../../packages/sim/src/spatial';
import {Ragdoll, MachineWreck} from './ragdoll';
import {coastAt, terrainHeight, landAt, cliffAt} from '../../../../../packages/sim/src/terrain';
import {createEnvironment} from './environment';
import {random} from './layout';
import {wallSpans, wallPlacementReason} from '../../../../../packages/sim/src/walls';

type View = {
  root: T.Group;
  model: T.Group;
  proxy: T.Mesh;
  ring: T.Mesh;
  health: T.Mesh;
  target: T.Vector3;
  clip: Clip;
  age: number;
  x: number;
  z: number;
  yaw: number;
  phase: number;
  stateKey: string;
  label: HTMLDivElement;
  ragdoll?: Ragdoll | MachineWreck;
  remembered: boolean;
  cargo: T.Group;
  onScreen: boolean;
  sphere: T.Sphere;
  dynamic: boolean;
  occluded?: boolean;
};
export class MatchRenderer {
  wallAnchor?: {x: number; z: number};
  readonly scene = new T.Scene();
  readonly camera = new T.PerspectiveCamera(42, 1, 0.2, 1600);
  readonly renderer: T.WebGLRenderer;
  readonly controls: OrbitControls;
  readonly ground: T.Mesh;
  private environment = createEnvironment();
  private views = new Map<number, View>();
  private shots = new Map<number, T.Group>();
  private ray = new T.Raycaster();
  private pointer = new T.Vector2();
  private templates = new Map<string, T.Group>();
  private actorBatches: {
    mesh: T.InstancedMesh;
    silhouette?: T.InstancedMesh;
    parts: {mesh: T.Mesh; view: View; parents: T.Object3D[]}[];
  }[] = [];
  private batchDirty = false;
  private grass?: T.InstancedMesh;
  private worldSize = 256;
  private seed = 90210;
  private worldKey = '';
  private fogTexture = new T.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  private visibility = {value: this.fogTexture};
  private fogSize = {value: 256};
  private fogTime = {value: 0};
  private markers: {root: T.Group; expires: number}[] = [];
  private receivedAt = 0;
  private ownerMaterials = new Map<string, T.Material>();
  private frame = 0;
  private occlusionAt = 0;
  private frustum = new T.Frustum();
  private projection = new T.Matrix4();
  private frameCpu = 0;
  private frameTimes: number[] = [];
  private last = performance.now();
  private time = 0;
  private keys = new Set<string>();
  private selected = new Set<number>();
  private rallyMarkers = new T.Group();
  private rallyKey = '';
  private snapshot?: MatchSnapshot;
  private down?: {x: number; y: number; button: number; shift: boolean};
  private marquee = document.createElement('div');
  private ghost?: T.Group;
  private ghostFootprint?: T.Mesh<T.PlaneGeometry, T.MeshBasicMaterial>;
  private placementQuarter: 0 | 1 | 2 | 3 = 0;
  private placing?: string;
  private ordering = false;
  setOrderMode(active: boolean) {
    this.ordering = active;
    this.renderer.domElement.style.cursor = active ? 'crosshair' : 'grab';
  }
  private geometries = new Set<T.BufferGeometry>();
  private materials = new Set<T.Material>();
  private sun = new T.DirectionalLight('#ffead0', 2.6);
  private observer: ResizeObserver;
  private shadowTime = 0;
  private boundary = new T.Group();
  private terrainBuildings: MatchSnapshot['entities'] = [];
  constructor(
    private host: HTMLElement,
    private onSelect: (id: number, add: boolean, button: number) => void,
    private onGround: (x: number, z: number, button: number, queued?: boolean) => void,
    private onGroup: (ids: number[], add: boolean) => void = () => {},
  ) {
    this.renderer = new T.WebGLRenderer({antialias: true, powerPreference: 'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.localClippingEnabled = true;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', this.prepareGesture, true);
    canvas.tabIndex = 0;
    canvas.setAttribute(
      'aria-label',
      'Battlefield. Left-drag to select, Alt-left-drag to orbit, middle-drag to pan, right-click to order, scroll to zoom.',
    );
    host.append(canvas);
    this.scene.background = new T.Color('#bdd1d5');
    this.scene.fog = new T.FogExp2('#bdd1d5', 0.0032);
    this.scene.add(this.environment.group);
    this.environment.water.position.set(80, 0.06, 80);
    Object.assign(this.environment.waterMat.uniforms, {
      visibilityMap: this.visibility,
      worldSize: this.fogSize,
      coastKnots: {value: new Float32Array(9)},
    });
    this.environment.waterMat.fragmentShader =
      'uniform sampler2D visibilityMap;uniform float worldSize;uniform float coastKnots[9];\n' +
      this.environment.waterMat.fragmentShader
        .replace(
          '24.+sin(p.y*.065)*7.+sin(p.y*.16)*2.',
          'mix(coastKnots[int(clamp(floor(p.y/(worldSize/8.)),0.,7.))],coastKnots[int(clamp(floor(p.y/(worldSize/8.)),0.,7.))+1],smoothstep(0.,1.,fract(clamp(p.y/worldSize,0.,.9999)*8.)))',
        )
        .replace(
          'gl_FragColor=vec4(col,1.);',
          'col*=mix(.045,1.,texture2D(visibilityMap,clamp(world.xz/worldSize,0.,1.)).r);gl_FragColor=vec4(col,1.);',
        );
    this.sun.position.set(-32, 62, 28);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, {left: -52, right: 52, top: 52, bottom: -52, near: 0.5, far: 180});
    this.sun.shadow.bias = -0.00025;
    this.sun.shadow.normalBias = 0.09;
    this.scene.add(this.sun, this.sun.target, new T.HemisphereLight('#cbdde2', '#70734c', 1.8));
    const geo = new T.PlaneGeometry(600, 600, 280, 280);
    geo.rotateX(-Math.PI / 2);
    geo.translate(80, 0, 80);
    const pos = geo.attributes.position,
      colors: number[] = [],
      rand = random(8421);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        z = pos.getZ(i),
        shore = coastAt(Math.round(z * 256)) / 256 - x;
      pos.setY(i, this.height(x, z));
      const c = new T.Color(shore < 6 ? '#c7b891' : '#829369');
      if (shore >= 6) {
        const n = (Math.sin(x * 0.1 + z * 0.06) + Math.cos(z * 0.17 - x * 0.09)) * 0.5;
        c.lerp(new T.Color('#566e4c'), Math.max(0, n) * 0.4);
        c.lerp(new T.Color('#b1ac79'), Math.max(0, -n) * 0.35);
      }
      c.offsetHSL(0, 0, rand() * 0.035 - 0.01);
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const tc = document.createElement('canvas');
    tc.width = tc.height = 128;
    const ctx = tc.getContext('2d')!,
      pixels = ctx.createImageData(128, 128);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const v = 190 + rand() * 55;
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = v;
      pixels.data[i + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
    const texture = new T.CanvasTexture(tc);
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    texture.repeat.set(140, 140);
    this.ground = new T.Mesh(
      geo,
      new T.MeshStandardMaterial({vertexColors: true, roughness: 1, map: texture, bumpMap: texture, bumpScale: 0.055}),
    );
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
    this.addGroundCover();
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 180;
    this.controls.minPolarAngle = 0.22;
    this.controls.maxPolarAngle = Math.PI * 0.45;
    this.controls.screenSpacePanning = false;
    this.controls.mouseButtons = {LEFT: undefined, MIDDLE: T.MOUSE.PAN, RIGHT: undefined};
    this.controls.target.set(108, 1, 111);
    this.camera.position.set(137, 35, 152);
    this.controls.update();
    this.marquee.className = 'selection-marquee';
    this.marquee.hidden = true;
    host.append(this.marquee);
    canvas.addEventListener('pointerdown', this.pointerDown);
    canvas.addEventListener('pointermove', this.pointerMove);
    canvas.addEventListener('pointerup', this.pointerUp);
    canvas.addEventListener('dblclick', this.doubleClick);
    canvas.addEventListener('contextmenu', this.preventMenu);
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', this.blur);
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(host);
    this.resize();
    this.tick();
  }
  private addGroundCover() {
    const rand = random(327),
      g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute([-0.026, 0, 0, 0.026, 0, 0, 0.04, 0.28, 0], 3));
    g.computeVertexNormals();
    const material = new T.MeshStandardMaterial({color: '#8b965e', side: T.DoubleSide, roughness: 1});
    this.grass = new T.InstancedMesh(g, material, 14000);
    const matrix = new T.Matrix4(),
      q = new T.Quaternion();
    for (let i = 0; i < this.grass.count; i++) {
      const x = 4 + rand() * 125,
        z = 4 + rand() * 152;
      matrix.compose(
        new T.Vector3(x, this.height(x, z), z),
        q.setFromAxisAngle(new T.Vector3(0, 1, 0), rand() * 6.28),
        new T.Vector3(1, 0.5 + rand(), 1),
      );
      this.grass.setMatrixAt(i, matrix);
    }
    this.grass.receiveShadow = true;
    this.grass.frustumCulled = false;
    this.scene.add(this.grass);
  }
  private rebuildBatches() {
    for (const b of this.actorBatches) {
      if (b.silhouette) {
        this.scene.remove(b.silhouette);
        b.silhouette.dispose();
        (b.silhouette.material as T.Material).dispose();
      }
      this.scene.remove(b.mesh);
      b.mesh.dispose();
    }
    this.actorBatches = [];
    const groups = new Map<
      string,
      {
        geometry: T.BufferGeometry;
        material: T.Material | T.Material[];
        parts: {mesh: T.Mesh; view: View; parents: T.Object3D[]}[];
      }
    >();
    for (const [id, v] of this.views) {
      const entity = this.snapshot?.entities.find((e) => e.id === id);
      if (entity?.category !== 'unit' && entity?.category !== 'animal' && entity?.kind !== 'timber') continue;
      v.root.updateMatrixWorld(true);
      v.model.traverse((o) => {
        if (o instanceof T.Mesh) {
          const key =
            o.geometry.uuid +
            (Array.isArray(o.material) ? o.material.map((m) => m.uuid).join() : o.material.uuid) +
            (entity.category === 'unit' ? ':unit' : '');
          let group = groups.get(key);
          if (!group) {
            group = {geometry: o.geometry, material: o.material, parts: []};
            groups.set(key, group);
          }
          const parents: T.Object3D[] = [];
          let parent = o.parent;
          while (parent && parent !== v.model) {
            parents.push(parent);
            parent = parent.parent;
          }
          group.parts.push({mesh: o, view: v, parents});
        }
      });
      v.model.visible = false;
    }
    for (const group of groups.values()) {
      const mesh = new T.InstancedMesh(group.geometry, group.material, group.parts.length);
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.customDepthMaterial = group.parts[0].mesh.customDepthMaterial;
      this.scene.add(mesh);
      let silhouette: T.InstancedMesh | undefined;
      if (group.parts[0].view.proxy.userData.unit) {
        // Draw against terrain/building depth BEFORE the normal unit pass, so a
        // unit's own arms and equipment cannot create false occlusion highlights.
        const material = new T.MeshBasicMaterial({
          color: '#bdac79',
          depthFunc: T.GreaterDepth,
          depthWrite: false,
          toneMapped: false,
        });
        silhouette = new T.InstancedMesh(group.geometry, material, group.parts.length);
        silhouette.instanceMatrix.setUsage(T.DynamicDrawUsage);
        silhouette.frustumCulled = false;
        silhouette.renderOrder = 1;
        mesh.renderOrder = 2;
        this.scene.add(silhouette);
      }
      this.actorBatches.push({mesh, silhouette, parts: group.parts});
    }
    this.batchDirty = false;
  }
  private height(x: number, z: number) {
    let y = terrainHeight(x, z, this.worldSize, this.seed);
    for (const e of this.terrainBuildings) {
      if (e.category !== 'building' || e.hp <= 0) continue;
      if (e.wallAxis) continue;
      const [hx, hz] = halfBounds(e),
        dx = Math.abs(x - e.x / 256) - hx / 256,
        dz = Math.abs(z - e.z / 256) - hz / 256,
        d = Math.max(dx, dz);
      if (d < 2) {
        const base = terrainHeight(e.x / 256, e.z / 256, this.worldSize, this.seed);
        y = T.MathUtils.lerp(base, y, T.MathUtils.smoothstep(d, 0, 2));
      }
    }
    return y;
  }
  private prepareGesture = (e: PointerEvent) => {
    if (e.button === 0) this.controls.mouseButtons.LEFT = e.altKey && !this.placing ? T.MOUSE.ROTATE : undefined;
  };
  private fogMaterial(material: T.MeshStandardMaterial) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.visibilityMap = this.visibility;
      shader.uniforms.worldSize = this.fogSize;
      shader.uniforms.fogClock = this.fogTime;
      shader.vertexShader = 'varying vec2 fogWorld;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        '#include <project_vertex>\n\n#ifdef USE_INSTANCING\nfogWorld=(modelMatrix*instanceMatrix*vec4(transformed,1.)).xz;\n#else\nfogWorld=(modelMatrix*vec4(transformed,1.)).xz;\n#endif\n',
      );
      shader.fragmentShader =
        'uniform sampler2D visibilityMap;uniform float worldSize;uniform float fogClock;varying vec2 fogWorld;\n' +
        shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        'float vision=texture2D(visibilityMap,clamp(fogWorld/worldSize,0.,1.)).r;float clouds=.045+.015*sin(fogWorld.x*.22+fogClock*.12)*sin(fogWorld.y*.16-fogClock*.09);outgoingLight*=mix(clouds,1.,vision);\n#include <opaque_fragment>',
      );
    };
    material.customProgramCacheKey = () => 'match-visibility-v2';
    material.needsUpdate = true;
  }
  private updateFog(snapshot: MatchSnapshot) {
    const n = snapshot.fogWidth;
    if (this.fogTexture.image.width !== n) {
      this.fogTexture.dispose();
      this.fogTexture = new T.DataTexture(new Uint8Array(n * n * 4), n, n);
      this.fogTexture.magFilter = T.LinearFilter;
      this.fogTexture.minFilter = T.LinearFilter;
      this.visibility.value = this.fogTexture;
    }
    const data = this.fogTexture.image.data as Uint8Array;
    for (let i = 0; i < snapshot.fog.length; i++) {
      const value = snapshot.fog[i] === 2 ? 255 : snapshot.fog[i] === 1 ? 95 : 0;
      data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = value;
      data[i * 4 + 3] = 255;
    }
    this.fogTexture.needsUpdate = true;
    this.fogSize.value = this.worldSize;
  }
  private refreshGround() {
    const w = this.worldSize,
      geo = new T.PlaneGeometry(w, w, 280, 280);
    geo.rotateX(-Math.PI / 2);
    geo.translate(w / 2, 0, w / 2);
    const pos = geo.attributes.position,
      colors: number[] = [],
      rand = random(this.seed);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        z = pos.getZ(i),
        shore = coastAt(Math.round(z * 256), w * 256, this.seed) / 256 - x;
      pos.setY(i, this.height(x, z));
      const c = new T.Color(shore < 6 ? '#c7b891' : '#829369');
      const n = (Math.sin(x * 0.1 + z * 0.06 + (this.seed % 9)) + Math.cos(z * 0.17 - x * 0.09)) * 0.5;
      if (cliffAt(Math.round(x * 256), Math.round(z * 256), w * 256, this.seed)) c.set('#8f8776');
      if (shore >= 6) {
        c.lerp(new T.Color('#566e4c'), Math.max(0, n) * 0.4);
        c.lerp(new T.Color('#b1ac79'), Math.max(0, -n) * 0.35);
      }
      c.offsetHSL(0, 0, rand() * 0.035 - 0.01);
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    this.ground.geometry.dispose();
    this.ground.geometry = geo;
    this.environment.water.geometry.dispose();
    this.environment.water.geometry = new T.PlaneGeometry(w, w, 80, 80);
    this.environment.water.position.set(w / 2, 0.06, w / 2);
    this.boundary.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.geometry.dispose();
        (o.material as T.Material).dispose();
      }
    });
    this.boundary.clear();
    for (const [x, z, angle] of [
      [0, w / 2, Math.PI / 2],
      [w, w / 2, Math.PI / 2],
      [w / 2, 0, 0],
      [w / 2, w, 0],
    ]) {
      const wall = new T.Mesh(
        new T.PlaneGeometry(w, 16),
        new T.MeshBasicMaterial({color: '#080e10', side: T.DoubleSide}),
      );
      wall.position.set(x, 0, z);
      wall.rotation.y = angle;
      this.boundary.add(wall);
    }
    if (!this.boundary.parent) this.scene.add(this.boundary);
    this.fogMaterial(this.ground.material as T.MeshStandardMaterial);
    if (this.grass) {
      const matrix = new T.Matrix4(),
        q = new T.Quaternion();
      for (let i = 0; i < this.grass.count; i++) {
        const x = rand() * w * 0.9,
          z = rand() * w,
          blocked = this.terrainBuildings.some(
            (e) =>
              e.category === 'building' &&
              Math.abs(x - e.x / 256) < (buildingById.get(e.kind)?.footprint[0] ?? 3) + 0.7 &&
              Math.abs(z - e.z / 256) < (buildingById.get(e.kind)?.footprint[1] ?? 3) + 0.7,
          );
        matrix.compose(
          new T.Vector3(x, this.height(x, z), z),
          q.setFromAxisAngle(new T.Vector3(0, 1, 0), rand() * 6.28),
          new T.Vector3(
            1,
            blocked || !landAt(Math.round(x * 256), Math.round(z * 256), w * 256, this.seed) ? 0 : 0.7 + rand(),
            1,
          ),
        );
        this.grass.setMatrixAt(i, matrix);
      }
      this.grass.instanceMatrix.needsUpdate = true;
      this.grass.frustumCulled = false;
      this.fogMaterial(this.grass.material as T.MeshStandardMaterial);
    }
  }
  private cursor(kind: string) {
    const paths: Record<string, string> = {
      mine: 'M9 29L24 7M8 8Q20 0 30 15M19 6L29 15',
      chop: 'M10 30L22 6M19 9L29 10L26 22L15 18Z',
      attack: 'M7 30L25 5L28 3L29 9L11 28M9 21L18 28',
      hunt: 'M9 4Q32 17 9 31L9 4M3 18L32 18M27 13L32 18L27 23',
      process: 'M8 31L18 18M18 18L18 5Q33 10 26 20Z',
      fish: 'M8 17Q19 5 28 17Q19 29 8 17L3 10L3 24ZM23 15L23 16M7 31Q11 27 15 31Q19 27 24 31',
      farm: 'M16 31L16 5M16 11L9 5L9 11L16 16L23 10L23 4M16 21L9 15L9 21L16 26L23 20L23 14',
      gather: 'M5 16L9 29L27 29L31 16ZM10 16L14 6L21 6L26 16M13 19L14 26M22 19L21 26',
      build: 'M10 30L22 10M14 6L27 6L30 12L17 12Z',
      garrison: 'M4 16L18 4L32 16M8 14L8 30L28 30L28 14M15 30L15 22L21 22L21 30',
    };
    const path = paths[kind] ?? paths.attack;
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><path d="' +
      path +
      '" fill="none" stroke="#14271c" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="' +
      path +
      '" fill="none" stroke="#f8db92" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '") 8 8, crosshair';
  }
  feedback(id: number) {
    const v = this.views.get(id);
    if (v) {
      v.ring.visible = true;
      v.ring.userData.flashUntil = this.time + 0.8;
      this.mark(v.target.x, v.target.z);
    }
  }
  mark(x: number, z: number, rally = false) {
    const root = new T.Group();
    root.position.set(x, this.height(x, z) + 0.12, z);
    const material = new T.MeshBasicMaterial({
      color: rally ? '#76d8c1' : '#e9ce85',
      transparent: true,
      opacity: 0.95,
      depthTest: false,
    });
    for (const angle of [Math.PI / 4, -Math.PI / 4]) {
      const bar = new T.Mesh(new T.BoxGeometry(0.12, 0.03, 1.3), material);
      bar.rotation.y = angle;
      root.add(bar);
    }
    this.scene.add(root);
    this.markers.push({root, expires: this.time + (rally ? 4 : 1.2)});
  }
  cameraFootprint() {
    const ray = new T.Raycaster(),
      plane = new T.Plane(new T.Vector3(0, 1, 0), -1),
      points: {x: number; z: number}[] = [];
    for (const [x, y] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      ray.setFromCamera(new T.Vector2(x, y), this.camera);
      const p = ray.ray.intersectPlane(plane, new T.Vector3());
      if (p) points.push({x: p.x, z: p.z});
    }
    return points;
  }
  projectEntity(id: number) {
    const v = this.views.get(id);
    if (!v) return;
    const p = v.root.position
      .clone()
      .add(new T.Vector3(0, 1, 0))
      .project(this.camera);
    return {x: ((p.x + 1) * this.host.clientWidth) / 2, y: ((1 - p.y) * this.host.clientHeight) / 2};
  }
  projectWorld(x: number, z: number) {
    const p = new T.Vector3(x, this.height(x, z), z).project(this.camera);
    return {x: ((p.x + 1) * this.host.clientWidth) / 2, y: ((1 - p.y) * this.host.clientHeight) / 2};
  }
  metrics() {
    return {
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
      views: this.views.size,
      knownEntities: this.snapshot?.entities.length ?? 0,
      visibleViews: [...this.views.values()].filter((v) => v.onScreen).length,
      frameCpuMs: this.frameCpu,
      medianFrameMs: [...this.frameTimes].sort((a, b) => a - b)[Math.floor(this.frameTimes.length / 2)] ?? 0,
      projectiles: this.shots.size,
    };
  }
  private blur = () => {
    this.keys.clear();
    this.down = undefined;
    this.marquee.hidden = true;
  };
  private keyDown = (e: KeyboardEvent) => {
    if (!/input|textarea|select/i.test((e.target as Element)?.tagName || '')) {
      this.keys.add(e.code);
      if (e.code === 'Space') {
        e.preventDefault();
        const v = this.views.get([...this.selected][0]);
        if (v) this.focus(v.target.x, v.target.z);
      }
      if (this.placing && (e.code === 'KeyQ' || e.code === 'KeyE')) {
        e.preventDefault();
        this.rotatePlacement(e.code === 'KeyE' ? 1 : -1);
      }
    }
  };
  private keyUp = (e: KeyboardEvent) => this.keys.delete(e.code);
  private preventMenu = (e: Event) => e.preventDefault();
  private setRay(e: MouseEvent) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, 1 - ((e.clientY - r.top) / r.height) * 2);
    this.ray.setFromCamera(this.pointer, this.camera);
  }
  private hit(e: MouseEvent) {
    this.setRay(e);
    const r = this.renderer.domElement.getBoundingClientRect();
    const hits = this.ray.intersectObjects(
      [...this.views.values()].filter((v) => v.onScreen).map((v) => v.proxy),
      false,
    );
    const score = (hit: T.Intersection) => {
      const p = this.projectEntity(hit.object.userData.entityId);
      return p ? Math.hypot(p.x + r.left - e.clientX, p.y + r.top - e.clientY) + hit.distance * 0.015 : Infinity;
    };
    const exact = hits.sort((a, b) => score(a) - score(b))[0]?.object.userData.entityId as number | undefined;
    if (exact !== undefined) return exact;
    let best: number | undefined,
      distance = 18;
    for (const entity of this.snapshot?.entities ?? []) {
      if (entity.remembered || (entity.category !== 'unit' && entity.category !== 'animal')) continue;
      const v = this.views.get(entity.id);
      if (!v) continue;
      const p = v.root.position
        .clone()
        .add(new T.Vector3(0, 1, 0))
        .project(this.camera);
      if (p.z < 0 || p.z > 1) continue;
      const d = Math.hypot(
        ((p.x + 1) * r.width) / 2 + r.left - e.clientX,
        ((1 - p.y) * r.height) / 2 + r.top - e.clientY,
      );
      if (d < distance) {
        distance = d;
        best = entity.id;
      }
    }
    return best;
  }
  private pointerDown = (e: PointerEvent) => {
    if (e.button === 1) return;
    if (e.button === 0 && this.controls.mouseButtons.LEFT === T.MOUSE.ROTATE) {
      this.down = undefined;
      return;
    }
    this.renderer.domElement.focus();
    this.down = {x: e.clientX, y: e.clientY, button: e.button, shift: e.shiftKey};
    this.renderer.domElement.setPointerCapture(e.pointerId);
  };
  private pointerMove = (e: PointerEvent) => {
    if (!this.down && !this.placing) {
      const id = this.hit(e),
        entity = this.snapshot?.entities.find((x) => x.id === id),
        selected = this.snapshot?.entities.filter((x) => this.selected.has(x.id) && x.owner === 1) ?? [],
        worker = selected.some((x) => x.kind === 'worker');
      const type =
        entity && selected.length
          ? (entity.owner > 1 || entity.guardOf !== undefined) && entity.category !== 'animal'
            ? 'attack'
            : entity.tradeSite
              ? 'gather'
              : entity.category === 'treasure'
                ? 'gather'
                : entity.incapacitatedAt !== undefined
                  ? 'gather'
                  : entity.category === 'animal'
                    ? worker
                      ? entity.hp > 0
                        ? 'hunt'
                        : 'process'
                      : selected.some((e) => e.damage > 0)
                        ? 'attack'
                        : undefined
                    : worker
                      ? entity.kind === 'timber'
                        ? 'chop'
                        : entity.kind === 'fish'
                          ? 'fish'
                          : entity.kind === 'farm'
                            ? 'farm'
                            : entity.category === 'resource'
                              ? entity.kind === 'coin' || entity.kind === 'metal'
                                ? 'mine'
                                : 'gather'
                              : entity.category === 'building' && entity.owner === 1
                                ? entity.progress < 10000
                                  ? 'build'
                                  : ['hall', 'fort'].includes(entity.kind)
                                    ? 'garrison'
                                    : undefined
                                : undefined
                      : undefined
          : undefined;
      this.renderer.domElement.style.cursor = this.ordering
        ? 'crosshair'
        : type
          ? this.cursor(type)
          : id
            ? 'pointer'
            : 'grab';
    }
    if (this.ghost) {
      this.setRay(e);
      const hit = this.ray.intersectObject(this.ground)[0];
      if (hit) {
        this.ghost.position.set(hit.point.x, hit.point.y + 0.06, hit.point.z);
        if (this.wallAnchor) {
          const dx = hit.point.x - this.wallAnchor.x,
            dz = hit.point.z - this.wallAnchor.z;
          this.ghost.position.set(
            (hit.point.x + this.wallAnchor.x) / 2,
            hit.point.y + 0.12,
            (hit.point.z + this.wallAnchor.z) / 2,
          );
          this.ghost.rotation.set(0, -Math.atan2(dz, dx), 0);
          this.ghost.scale.set(Math.hypot(dx, dz) / 6.4, 1, 1);
        }
        const invalid =
          this.snapshot &&
          (this.wallAnchor
            ? wallPlacementReason(
                this.snapshot,
                wallSpans(
                  Math.round(this.wallAnchor.x * 256),
                  Math.round(this.wallAnchor.z * 256),
                  Math.round(hit.point.x * 256),
                  Math.round(hit.point.z * 256),
                ),
                1,
              )
            : placementReason(
                this.snapshot,
                this.placing!,
                Math.round(hit.point.x * 256),
                Math.round(hit.point.z * 256),
                this.placementQuarter,
              ));
        this.ghostFootprint?.material.color.set(invalid ? '#eb6556' : '#7ee8b4');
        const edge = this.ghost.getObjectByName('placementEdge') as T.LineLoop | undefined;
        (edge?.material as T.LineBasicMaterial | undefined)?.color.set(invalid ? '#eb6556' : '#7ee8b4');
      }
    }
    const d = this.down;
    if (!d || d.button !== 0 || this.placing || Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5) return;
    const r = this.host.getBoundingClientRect();
    this.marquee.hidden = false;
    Object.assign(this.marquee.style, {
      left: Math.min(e.clientX, d.x) - r.left + 'px',
      top: Math.min(e.clientY, d.y) - r.top + 'px',
      width: Math.abs(e.clientX - d.x) + 'px',
      height: Math.abs(e.clientY - d.y) + 'px',
    });
  };
  private pointerUp = (e: PointerEvent) => {
    const d = this.down;
    this.down = undefined;
    this.marquee.hidden = true;
    if (!d) return;
    const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5;
    if (d.button === 0 && moved && !this.placing) {
      const r = this.renderer.domElement.getBoundingClientRect(),
        ids: number[] = [];
      for (const entity of this.snapshot?.entities ?? []) {
        if (entity.owner !== 1 || entity.category !== 'unit') continue;
        const v = this.views.get(entity.id);
        if (!v) continue;
        const p = v.root.position
            .clone()
            .add(new T.Vector3(0, 1, 0))
            .project(this.camera),
          x = r.left + ((p.x + 1) * r.width) / 2,
          y = r.top + ((1 - p.y) * r.height) / 2;
        if (
          p.z < 1 &&
          x >= Math.min(d.x, e.clientX) &&
          x <= Math.max(d.x, e.clientX) &&
          y >= Math.min(d.y, e.clientY) &&
          y <= Math.max(d.y, e.clientY)
        )
          ids.push(entity.id);
      }
      this.onGroup(ids, d.shift);
      return;
    }
    if (moved) return;
    if (!this.placing) {
      const id = this.hit(e);
      if (id) {
        this.onSelect(id, e.shiftKey, e.button);
        if (e.button === 2) this.feedback(id);
        return;
      }
    }
    this.setRay(e);
    const hit = this.ray.intersectObject(this.ground)[0];
    if (hit) {
      this.onGround(hit.point.x, hit.point.z, e.button, e.shiftKey);
      if (e.button === 2) this.mark(hit.point.x, hit.point.z);
    }
  };
  private doubleClick = (e: MouseEvent) => {
    const id = this.hit(e),
      entity = this.snapshot?.entities.find((x) => x.id === id);
    if (!entity || entity.owner !== 1) return;
    this.onGroup(
      (this.snapshot?.entities ?? [])
        .filter(
          (x) =>
            x.owner === 1 &&
            x.kind === entity.kind &&
            (this.views.get(x.id)?.root.position.clone().project(this.camera).length() ?? Infinity) < 1.75,
        )
        .map((x) => x.id),
      e.shiftKey,
    );
  };
  private resize = () => {
    const w = this.host.clientWidth,
      h = this.host.clientHeight;
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  };
  focus(x: number, z: number) {
    const offset = this.camera.position.clone().sub(this.controls.target);
    this.controls.target.set(x, 1, z);
    this.camera.position.copy(this.controls.target).add(offset);
  }
  setPlacement(kind?: string) {
    this.wallAnchor = undefined;
    if (this.ghost) {
      this.scene.remove(this.ghost);
      this.ghost.traverse((o) => {
        if (!(o instanceof T.Mesh) && !(o instanceof T.Line)) return;
        o.geometry.dispose();
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        materials.forEach((m) => m.dispose());
      });
      this.ghost = undefined;
      this.ghostFootprint = undefined;
    }
    this.placing = kind;
    this.placementQuarter = 0;
    this.renderer.domElement.style.cursor = kind ? 'crosshair' : 'default';
    if (kind) {
      const f = buildingById.get(kind)!.footprint;
      this.ghost = new T.Group();
      this.ghostFootprint = new T.Mesh(
        new T.PlaneGeometry(f[0] * 2, f[1] * 2),
        new T.MeshBasicMaterial({
          color: '#7ee8b4',
          transparent: true,
          opacity: 0.4,
          side: T.DoubleSide,
          depthWrite: false,
        }),
      );
      this.ghostFootprint.rotation.x = -Math.PI / 2;
      this.ghostFootprint.position.y = 0.04;
      this.ghost.add(this.ghostFootprint);
      if (kind !== 'wall') {
        const edge = new T.LineLoop(
          new T.BufferGeometry().setFromPoints([
            new T.Vector3(-f[0], 0.1, -f[1]),
            new T.Vector3(f[0], 0.1, -f[1]),
            new T.Vector3(f[0], 0.1, f[1]),
            new T.Vector3(-f[0], 0.1, f[1]),
          ]),
          new T.LineBasicMaterial({color: '#7ee8b4', depthTest: false}),
        );
        edge.name = 'placementEdge';
        edge.renderOrder = 9;
        this.ghost.add(edge);
        const definition = buildingById.get(kind)!;
        let preview: T.Group;
        try {
          preview = buildAsset(definition.model as AssetKind, this.snapshot?.players[0]?.age ?? 1);
        } catch {
          preview = buildAsset(definition.model as AssetKind);
        }
        preview = prepareBuildingView(preview, kind) ?? preview;
        preview.traverse((o) => {
          if (!(o instanceof T.Mesh)) return;
          const materials = (Array.isArray(o.material) ? o.material : [o.material]).map((source) => {
            const material = source.clone();
            material.transparent = true;
            material.opacity = 0.55;
            material.depthWrite = false;
            return material;
          });
          o.material = Array.isArray(o.material) ? materials : materials[0];
          o.castShadow = false;
          o.receiveShadow = false;
        });
        this.ghost.add(preview);
      }
      this.ghost.position.set(-1000, 0, 0);
      this.scene.add(this.ghost);
    }
  }
  getPlacementRotation() {
    return this.placementQuarter;
  }
  private rotatePlacement(delta: number) {
    if (!this.ghost || this.placing === 'wall') return;
    this.placementQuarter = ((((this.placementQuarter + delta) % 4) + 4) % 4) as 0 | 1 | 2 | 3;
    this.ghost.rotation.y = this.placementQuarter * (Math.PI / 2);
  }
  setSelected(ids: Set<number>) {
    this.selected = new Set(ids);
    this.refreshRallies();
    for (const [id, v] of this.views) v.ring.visible = this.selected.has(id);
  }
  private refreshRallies() {
    const sites =
      this.snapshot?.entities.filter(
        (e) => this.selected.has(e.id) && e.category === 'building' && e.owner === 1 && e.rally,
      ) ?? [];
    const key = sites.map((e) => e.id + ':' + e.rally!.x + ':' + e.rally!.z).join('|');
    if (key === this.rallyKey) return;
    this.rallyKey = key;
    this.rallyMarkers.traverse((o) => {
      if (o instanceof T.Line) {
        o.geometry.dispose();
        (o.material as T.Material).dispose();
      }
    });
    this.rallyMarkers.clear();
    if (!this.rallyMarkers.parent) this.scene.add(this.rallyMarkers);
    for (const e of sites) {
      const x = e.rally!.x / 256,
        z = e.rally!.z / 256,
        y = this.height(x, z) + 0.2;
      const positions = [
        new T.Vector3(x - 1, y, z - 1),
        new T.Vector3(x + 1, y, z + 1),
        new T.Vector3(x - 1, y, z + 1),
        new T.Vector3(x + 1, y, z - 1),
      ];
      const marker = new T.LineSegments(
        new T.BufferGeometry().setFromPoints(positions),
        new T.LineBasicMaterial({color: '#71e8cb', depthTest: false}),
      );
      marker.renderOrder = 20;
      this.rallyMarkers.add(marker);
      const route = new T.Line(
        new T.BufferGeometry().setFromPoints([
          new T.Vector3(e.x / 256, this.height(e.x / 256, e.z / 256) + 0.2, e.z / 256),
          new T.Vector3(x, y, z),
        ]),
        new T.LineDashedMaterial({
          color: '#71e8cb',
          dashSize: 0.6,
          gapSize: 0.5,
          transparent: true,
          opacity: 0.55,
          depthTest: false,
        }),
      );
      route.computeLineDistances();
      this.rallyMarkers.add(route);
    }
  }
  private remember(root: T.Object3D) {
    root.traverse((o) => {
      if (o instanceof T.Mesh) {
        this.geometries.add(o.geometry);
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) this.materials.add(m);
      }
    });
  }
  update(snapshot: MatchSnapshot) {
    this.snapshot = snapshot;
    this.terrainBuildings = snapshot.entities.filter((e) => e.category === 'building' && e.hp > 0);
    this.refreshRallies();
    this.receivedAt = this.time;
    const worldKey =
      snapshot.map.seed +
      ':' +
      snapshot.map.size +
      ':' +
      snapshot.entities
        .filter((e) => e.category === 'building')
        .map((e) => e.id)
        .join();
    if (worldKey !== this.worldKey) {
      const first = !this.worldKey;
      this.worldKey = worldKey;
      this.worldSize = snapshot.map.size / 256;
      this.seed = snapshot.map.seed;
      this.environment.waterMat.uniforms.coastKnots.value = Float32Array.from(
        {length: 9},
        (_, i) => coastAt(Math.trunc((i * snapshot.map.size) / 8), snapshot.map.size, this.seed) / 256,
      );
      this.refreshGround();
      if (first) {
        const hall = snapshot.entities.find((e) => e.owner === 1 && e.kind === 'hall');
        if (hall) this.focus(hall.x / 256, hall.z / 256);
      }
    }
    this.updateFog(snapshot);
    this.camera.updateMatrixWorld();
    this.frustum.setFromProjectionMatrix(
      this.projection.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse),
    );
    const byId = new Map(snapshot.entities.map((e) => [e.id, e]));
    const live = new Set(snapshot.entities.map((e) => e.id));
    for (const e of snapshot.entities) {
      const age = e.tradeSite ? 2 : Math.min(3, snapshot.players[Math.max(0, e.owner - 1)]?.age ?? 1);
      const stateKey = [
        e.model,
        e.incapacitatedAt !== undefined ? 'incapacitated' : 'active',
        age,
        e.owner,
        Math.floor(e.progress / 2500),
        e.remembered,
        e.category === 'building'
          ? e.hp <= 0
            ? 'rubble'
            : e.progress === 10000
              ? e.hp / e.maxHp < 0.3
                ? 'critical'
                : e.hp / e.maxHp < 0.65
                  ? 'damaged'
                  : 'intact'
              : 'construction'
          : '',
        e.kind === 'timber'
          ? e.stumpSince !== undefined
            ? 'stump'
            : e.amount < (e.initialAmount ?? e.amount) * 0.5
              ? 'fallen'
              : 'intact'
          : '',
      ].join(':');
      let v = this.views.get(e.id);
      if (!v && !this.frustum.intersectsSphere(new T.Sphere(new T.Vector3(e.x / 256, 5, e.z / 256), 30))) continue;
      if (v && v.stateKey !== stateKey) {
        this.scene.remove(v.root);
        this.remember(v.root);
        this.views.delete(e.id);
        v.label.remove();
        v = undefined;
      }
      if (!v) {
        this.batchDirty = true;
        const key = e.model + ':' + age;
        let proto = this.templates.get(key);
        if (!proto) {
          try {
            proto = buildAsset(e.model as AssetKind, age);
          } catch {
            proto = buildAsset(e.model as AssetKind);
          }
          if (e.category === 'building' && !e.wallAxis) proto = prepareBuildingView(proto, e.kind) ?? proto;
          this.templates.set(key, proto);
        }
        const model = proto.clone();
        if (e.wallAxis) {
          const [dx, dz] = e.wallAxis;
          const width = new T.Box3().setFromObject(model).getSize(new T.Vector3()).x;
          model.scale.x *= Math.hypot(dx, dz) / 256 / Math.max(0.1, width);
          const slope =
            (terrainHeight((e.x + dx / 2) / 256, (e.z + dz / 2) / 256, this.worldSize, this.seed) -
              terrainHeight((e.x - dx / 2) / 256, (e.z - dz / 2) / 256, this.worldSize, this.seed)) /
            (Math.hypot(dx, dz) / 256);
          model.rotation.z = Math.atan(slope);
        }
        if (e.kind === 'fish') {
          model.clear();
          model.userData.shoal = true;
          for (let i = 0; i < 3; i++) {
            const fish = proto.clone();
            fish.name = 'jumpingFish';
            fish.userData.phase = e.id * 0.19 + i * 0.21;
            fish.userData.offset = i * 0.65 - 0.65;
            model.add(fish);
          }
        }
        const root = new T.Group();
        root.add(model);
        root.position.set(e.x / 256, e.kind === 'fish' ? 0.06 : this.height(e.x / 256, e.z / 256), e.z / 256);
        const size = new T.Box3().setFromObject(model).getSize(new T.Vector3());
        if (e.category === 'building' && e.progress < 10000) {
          applyCondition(model, e.kind, 'construction');
          model.traverse((o) => {
            if (o instanceof T.Mesh) {
              for (const m of Array.isArray(o.material) ? o.material : [o.material])
                if (m.clippingPlanes)
                  m.clippingPlanes = [
                    new T.Plane(
                      new T.Vector3(0, -1, 0),
                      root.position.y + Math.max(0.25, (size.y * e.progress) / 10000),
                    ),
                  ];
            }
          });
        }
        if (e.category === 'building' && e.hp <= 0) applyCondition(model, e.kind, 'rubble');
        else if (e.category === 'building' && e.progress === 10000 && e.hp / e.maxHp < 0.65)
          applyCondition(model, e.kind, e.hp / e.maxHp < 0.3 ? 'critical' : 'damaged');
        if (e.kind === 'timber' && e.amount < (e.initialAmount ?? e.amount) * 0.5)
          applyCondition(model, 'tree', e.stumpSince !== undefined ? 'stump' : 'halfCut');
        if (e.owner > 1 || (e.kind === 'sheep' && e.owner === 0))
          model.traverse((o) => {
            if (o instanceof T.Mesh) {
              const tint = (m: T.Material) => {
                if (!(m instanceof T.MeshStandardMaterial)) return m;
                const c = m.color;
                if (c.g > c.r * 1.25 && c.g > c.b * 0.85) {
                  const key = m.uuid + ':' + e.owner;
                  let n = this.ownerMaterials.get(key) as T.MeshStandardMaterial | undefined;
                  if (!n) {
                    n = m.clone();
                    n.color.set(
                      e.owner > 1 ? ['#000000', '#267f70', '#8f3d38', '#3f65b5', '#985eaf'][e.owner] : '#9a8a66',
                    );
                    this.ownerMaterials.set(key, n);
                  }
                  return n;
                }
                return m;
              };
              o.material = Array.isArray(o.material) ? o.material.map(tint) : tint(o.material);
            }
          });
        if (e.remembered)
          model.traverse((o) => {
            if (o instanceof T.Mesh) {
              const dark = (m: T.Material) => {
                if (!(m instanceof T.MeshStandardMaterial)) return m;
                const n = m.clone();
                n.color.multiplyScalar(0.5);
                return n;
              };
              o.material = Array.isArray(o.material) ? o.material.map(dark) : dark(o.material);
            }
          });
        model.traverse((o) => {
          if (o instanceof T.InstancedMesh) o.frustumCulled = false;
        });
        const radius =
          e.category === 'building'
            ? Math.max(...(buildingById.get(e.kind)?.footprint ?? [2]))
            : e.category === 'unit'
              ? 0.65
              : 1.8;
        const ring = new T.Mesh(
          new T.RingGeometry(radius, radius + 0.09, 48),
          new T.MeshBasicMaterial({
            color: e.owner > 1 ? '#f08574' : '#e7cc87',
            transparent: true,
            opacity: 0.95,
            side: T.DoubleSide,
            depthWrite: false,
          }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.07;
        root.add(ring);
        const health = new T.Mesh(
          new T.PlaneGeometry(Math.min(3, Math.max(1.2, size.x)), 0.12),
          new T.MeshBasicMaterial({color: e.owner > 1 ? '#dc7664' : '#a8cd7e', depthTest: false}),
        );
        health.renderOrder = 10;
        health.position.y = size.y + 0.4;
        root.add(health);
        const proxy = new T.Mesh(
          new T.BoxGeometry(
            e.kind === 'timber' ? 1.1 : e.category === 'unit' ? 1.4 : Math.max(0.85, size.x),
            e.kind === 'timber' ? 3.4 : e.category === 'unit' ? Math.min(size.y, 3.2) : Math.max(1.6, size.y),
            e.kind === 'timber' ? 1.1 : e.category === 'unit' ? 1.8 : Math.max(0.85, size.z),
          ),
          new T.MeshBasicMaterial({visible: false}),
        );
        proxy.position.y = e.kind === 'timber' ? 1.7 : e.category === 'unit' ? Math.min(size.y, 3.2) / 2 : size.y / 2;
        proxy.userData.entityId = e.id;
        proxy.userData.unit = e.category === 'unit';
        root.add(proxy);
        const cargo = new T.Group();
        cargo.position.set(0, 1.1, -0.3);
        root.add(cargo);
        for (const [i, color] of (e.kind === 'worker' ? ['#785333', '#b37b94', '#dfb755', '#8b989b'] : []).entries()) {
          const item = new T.Mesh(
            i === 0 ? new T.CylinderGeometry(0.085, 0.085, 0.7, 7) : new T.DodecahedronGeometry(0.22, 0),
            new T.MeshStandardMaterial({color}),
          );
          if (i === 0) item.rotation.z = Math.PI / 2;
          item.name = ['timber', 'provisions', 'coin', 'metal'][i];
          cargo.add(item);
        }
        this.scene.add(root);
        const label = document.createElement('div');
        label.className = 'building-world-label';
        label.hidden = true;
        this.host.append(label);
        v = {
          stateKey,
          cargo,
          onScreen: true,
          sphere: new T.Sphere(new T.Vector3(), Math.max(size.length() / 2 + 2, 2)),
          dynamic: e.category === 'unit' || e.category === 'animal' || e.kind === 'fish',
          label,
          remembered: !!e.remembered,
          root,
          model,
          ring,
          health,
          proxy,
          target: root.position.clone(),
          clip: 'idle',
          age,
          x: e.x,
          z: e.z,
          yaw: 0,
          phase: 0,
        };
        this.views.set(e.id, v);
        this.renderer.shadowMap.needsUpdate = true;
      }
      v.target.set(e.x / 256, e.kind === 'fish' ? 0.06 : this.height(e.x / 256, e.z / 256), e.z / 256);
      const dx = e.x - v.x,
        dz = e.z - v.z,
        moving = !!e.moving;
      v.x = e.x;
      v.z = e.z;
      if (e.category === 'building' && !e.wallAxis) v.yaw = (e.rotation ?? 0) * (Math.PI / 2);
      if (e.wallAxis) v.yaw = -Math.atan2(e.wallAxis[1], e.wallAxis[0]);
      if (moving) v.yaw = Math.atan2(dx, dz);
      const target = e.targetId === undefined ? undefined : byId.get(e.targetId);
      if (!moving && target && e.category === 'unit') v.yaw = Math.atan2(target.x - e.x, target.z - e.z);
      const clip: Clip =
        e.task === 'dead'
          ? 'dead'
          : moving
            ? 'walk'
            : !e.working && (e.task === 'gather' || e.task === 'build' || e.task === 'attack')
              ? 'idle'
              : e.task === 'gather'
                ? target?.kind === 'farm'
                  ? 'farm'
                  : target?.kind === 'timber'
                    ? 'chop'
                    : target?.kind === 'coin' || target?.kind === 'metal'
                      ? 'mine'
                      : target?.category === 'animal'
                        ? target.hp > 0
                          ? 'hunt'
                          : 'process'
                        : target?.kind === 'fish'
                          ? 'fish'
                          : 'gather'
                : e.task === 'build' && e.category === 'unit'
                  ? 'build'
                  : e.task === 'revive'
                    ? e.working
                      ? 'heal'
                      : 'idle'
                    : e.task === 'collect'
                      ? e.working
                        ? 'gather'
                        : 'idle'
                      : e.task === 'claim'
                        ? 'idle'
                        : e.task === 'heal'
                          ? e.working
                            ? 'heal'
                            : 'idle'
                          : e.task === 'attack'
                            ? 'attack'
                            : e.category === 'animal'
                              ? 'graze'
                              : 'idle';
      if (v.clip !== clip) {
        v.clip = clip;
        v.phase = this.time;
      }
      if (e.hp <= 0 && e.category !== 'building' && !v.ragdoll) {
        animateAsset(v.model, 0, 'idle');
        v.ragdoll = ['cannon', 'ramWagon'].includes(e.model)
          ? new MachineWreck(v.model, e.id + (e.deathTick ?? 0))
          : new Ragdoll(v.model, e.id + (e.deathTick ?? 0));
        this.batchDirty = true;
      }
      v.cargo.visible = e.kind === 'worker' && Object.values(e.carry).some((n) => (n ?? 0) > 0);
      v.cargo.children.forEach(
        (o) => (o.visible = (o.name === e.activeResource ? (e.carry[o.name as keyof typeof e.carry] ?? 0) : 0) > 0),
      );
      if (target?.kind === 'fish') v.model.userData.fishingTarget = [target.x / 256, 0.03, target.z / 256];
      v.ring.visible = this.selected.has(e.id);
      v.health.visible = !e.remembered && e.hp > 0 && e.owner !== 0 && (e.hp < e.maxHp || this.selected.has(e.id));
      v.health.scale.x = Math.max(0.02, e.hp / e.maxHp);
      const queue = e.queue[0];
      v.label.hidden = !!e.remembered || e.owner !== 1 || (!queue && e.progress === 10000);
      if (!v.label.hidden) {
        v.label.replaceChildren();
        const title = document.createElement('span');
        title.textContent = queue
          ? productionName(queue.kind) + ' · ' + Math.ceil(queue.remaining / 20) + 's'
          : 'Constructing · ' + Math.floor(e.progress / 100) + '%';
        const progress = document.createElement('progress');
        progress.max = queue?.total ?? 10000;
        progress.value = queue ? queue.total - queue.remaining : e.progress;
        v.label.append(title, progress);
        if (e.queue.length > 1) {
          const list = document.createElement('small');
          list.textContent = e.queue.map((q, i) => `${i + 1}. ${productionName(q.kind)}`).join(' · ');
          v.label.append(list);
        }
      }
    }
    for (const [id, v] of this.views)
      if (!live.has(id)) {
        this.scene.remove(v.root);
        v.label.remove();
        this.remember(v.root);
        this.views.delete(id);
        this.batchDirty = true;
        this.renderer.shadowMap.needsUpdate = true;
      }
    if (this.batchDirty) this.rebuildBatches();
    const shotIds = new Set(snapshot.projectiles.map((s) => s.id));
    for (const shot of snapshot.projectiles) {
      let model = this.shots.get(shot.id);
      if (!model) {
        model = new T.Group();
        const source = this.views.get(shot.sourceId),
          muzzle = source?.model.getObjectByName('shotOrigin');
        if (muzzle) {
          const p = muzzle.getWorldPosition(new T.Vector3());
          model.userData.launchHeight = p.y;
          model.userData.launchOffset = [p.x - (shot.startX ?? shot.x) / 256, p.z - (shot.startZ ?? shot.z) / 256];
        }
        if (shot.kind === 'shell') {
          model.add(
            new T.Mesh(
              new T.SphereGeometry(0.12, 8, 6),
              new T.MeshStandardMaterial({color: '#363c38', metalness: 0.4}),
            ),
          );
        } else {
          const shaft = new T.Mesh(
            new T.CylinderGeometry(0.012, 0.012, 0.7, 5),
            new T.MeshStandardMaterial({color: '#735339'}),
          );
          shaft.rotation.x = Math.PI / 2;
          const tip = new T.Mesh(new T.ConeGeometry(0.04, 0.13, 4), new T.MeshStandardMaterial({color: '#c6cbc0'}));
          tip.rotation.x = Math.PI / 2;
          tip.position.z = 0.4;
          model.add(shaft, tip);
        }
        this.scene.add(model);
        this.shots.set(shot.id, model);
      }
      model.userData.shot = shot;
      model.position.set(shot.x / 256, this.height(shot.x / 256, shot.z / 256) + 1.2, shot.z / 256);
    }
    for (const [id, m] of this.shots)
      if (!shotIds.has(id)) {
        this.scene.remove(m);
        this.remember(m);
        this.shots.delete(id);
      }
  }
  private tick = () => {
    const now = performance.now(),
      dt = Math.min(0.05, (now - this.last) / 1000);
    this.frameTimes.push(now - this.last);
    if (this.frameTimes.length > 120) this.frameTimes.shift();
    this.last = now;
    this.time += dt;
    const forward = new T.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    const right = new T.Vector3().crossVectors(forward, new T.Vector3(0, 1, 0)),
      move = new T.Vector3();
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) move.add(forward);
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) move.sub(forward);
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) move.sub(right);
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) move.add(right);
    move.multiplyScalar(dt * 24);
    this.camera.position.add(move);
    this.controls.target.add(move);
    const correction = new T.Vector3(
      T.MathUtils.clamp(this.controls.target.x, 2, this.worldSize - 2) - this.controls.target.x,
      0,
      T.MathUtils.clamp(this.controls.target.z, 2, this.worldSize - 2) - this.controls.target.z,
    );
    this.camera.position.add(correction);
    this.controls.target.add(correction);
    this.controls.update(dt);
    this.fogTime.value = this.time;
    for (const marker of [...this.markers])
      if (this.time > marker.expires) {
        this.scene.remove(marker.root);
        this.remember(marker.root);
        this.markers.splice(this.markers.indexOf(marker), 1);
      }
    for (const model of this.shots.values()) {
      const shot = model.userData.shot as MatchSnapshot['projectiles'][number],
        t = Math.min(shot.impactTick, (this.snapshot?.tick ?? 0) + (this.time - this.receivedAt) * 20),
        remaining = Math.max(1, shot.impactTick - (this.snapshot?.tick ?? 0)),
        f = T.MathUtils.clamp((t - (this.snapshot?.tick ?? 0)) / remaining, 0, 1),
        x = T.MathUtils.lerp(shot.x, shot.targetX ?? shot.x, f) / 256,
        z = T.MathUtils.lerp(shot.z, shot.targetZ ?? shot.z, f) / 256,
        progress = T.MathUtils.clamp(
          (t - (shot.startTick ?? t)) / (shot.impactTick - (shot.startTick ?? t) + 0.001),
          0,
          1,
        );
      const target = this.snapshot?.entities.find((e) => e.id === shot.targetId),
        targetHeight =
          this.height((shot.targetX ?? shot.x) / 256, (shot.targetZ ?? shot.z) / 256) +
          (target?.category === 'animal' ? 0.7 : target?.category === 'building' ? 2 : 1.2),
        offset = model.userData.launchOffset ?? [0, 0];
      model.position.set(
        x + offset[0] * (1 - progress),
        T.MathUtils.lerp(model.userData.launchHeight ?? this.height(x, z) + 1.3, targetHeight, progress) +
          Math.sin(progress * Math.PI) * (shot.kind === 'shell' ? 0.7 : 0.35),
        z + offset[1] * (1 - progress),
      );
      model.lookAt((shot.targetX ?? shot.x) / 256, targetHeight, (shot.targetZ ?? shot.z) / 256);
      model.visible = t < shot.impactTick;
    }
    this.camera.updateMatrixWorld();
    this.frustum.setFromProjectionMatrix(
      this.projection.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse),
    );
    const blend = 1 - Math.exp(-dt * 18);
    const checkOcclusion = this.time - this.occlusionAt > 0.15;
    if (checkOcclusion) this.occlusionAt = this.time;
    const occluders = checkOcclusion
      ? [...this.views.values()].filter((v) => v.onScreen && !v.proxy.userData.unit).map((v) => v.proxy)
      : [];
    for (const v of this.views.values()) {
      v.sphere.center.copy(v.target);
      v.sphere.center.y += v.sphere.radius * 0.45;
      v.onScreen = this.frustum.intersectsSphere(v.sphere);
      v.root.visible = v.onScreen;
      if (!v.onScreen) {
        v.label.style.visibility = 'hidden';
        continue;
      }
      v.root.position.lerp(v.target, blend);
      if (checkOcclusion && v.proxy.userData.unit) {
        const center = v.root.position.clone().add(new T.Vector3(0, 1.2, 0));
        const direction = center.clone().sub(this.camera.position),
          distance = direction.length();
        const ray = new T.Raycaster(this.camera.position, direction.normalize(), 0, Math.max(0, distance - 0.5));
        v.occluded = ray.intersectObjects(occluders, false).length > 0;
        if (!v.occluded)
          for (let i = 1; i < 12; i++) {
            const p = center.clone().lerp(this.camera.position, i / 12);
            if (terrainHeight(p.x, p.z, this.worldSize, this.seed) > p.y) {
              v.occluded = true;
              break;
            }
          }
      }
      v.root.rotation.y += Math.atan2(Math.sin(v.yaw - v.root.rotation.y), Math.cos(v.yaw - v.root.rotation.y)) * blend;
      if (v.ragdoll) v.ragdoll.update(dt);
      else if (v.model.userData.shoal) {
        const cycle = Math.floor(this.time / 5);
        const count = 1 + Math.floor(random(v.proxy.userData.entityId + cycle * 131)() * 3);
        for (const [index, fish] of v.model.children.entries()) {
          const phase = (this.time % 5) - index * 0.24;
          const jumping = index < count && phase >= 0 && phase < 1.15;
          fish.visible = jumping;
          const f = phase / 1.15;
          fish.position.set(
            fish.userData.offset + (jumping ? f * 1.4 : 0),
            jumping ? 0.1 + Math.sin(f * Math.PI) * 0.9 : -0.8,
            fish.userData.offset,
          );
          fish.rotation.set(jumping ? Math.cos(f * Math.PI) * 0.6 : 0, Math.PI / 2, 0);
        }
      } else if (!v.remembered && v.dynamic) animateAsset(v.model, this.time - v.phase, v.clip);
      for (const name of ['projectile', 'shotFlash'])
        v.model.getObjectByName(name)?.traverse((o) => (o.visible = false));
      v.ring.visible = this.selected.has(v.proxy.userData.entityId) || (v.ring.userData.flashUntil ?? 0) > this.time;
      v.health.quaternion.copy(v.root.quaternion.clone().invert().multiply(this.camera.quaternion));
      if (!v.label.hidden) {
        const p = v.root.position
          .clone()
          .add(new T.Vector3(0, v.health.position.y + 0.4, 0))
          .project(this.camera);
        v.label.style.transform =
          'translate(-50%,-100%) translate(' +
          ((p.x + 1) * this.host.clientWidth) / 2 +
          'px,' +
          ((1 - p.y) * this.host.clientHeight) / 2 +
          'px)';
        v.label.style.visibility = p.z > 1 || p.z < -1 ? 'hidden' : 'visible';
      }
    }
    for (const v of this.views.values()) if (v.onScreen) v.root.updateMatrixWorld(true);
    for (const batch of this.actorBatches) {
      let count = 0;
      let silhouetteCount = 0;
      for (const part of batch.parts)
        if (part.view.onScreen && part.mesh.visible && part.parents.every((p) => p.visible)) {
          batch.mesh.setMatrixAt(count++, part.mesh.matrixWorld);
          if (part.view.occluded && batch.silhouette)
            batch.silhouette.setMatrixAt(silhouetteCount++, part.mesh.matrixWorld);
        }
      batch.mesh.count = count;
      batch.mesh.visible = count > 0;
      if (batch.silhouette) {
        batch.silhouette.count = silhouetteCount;
        batch.silhouette.visible = silhouetteCount > 0;
        batch.silhouette.instanceMatrix.needsUpdate = true;
      }
      batch.mesh.instanceMatrix.needsUpdate = true;
    }
    setFoliageTime(this.time, 1);
    effectsTime.value = this.time;
    this.environment.update(this.time, this.camera);
    if (this.time - this.shadowTime > 0.1) {
      const p = this.controls.target;
      this.sun.position.set(p.x - 32, 62, p.z + 28);
      this.sun.target.position.set(p.x, 0, p.z);
      this.renderer.shadowMap.needsUpdate = true;
      this.shadowTime = this.time;
    }
    this.renderer.render(this.scene, this.camera);
    this.frameCpu = this.frameCpu * 0.9 + (performance.now() - now) * 0.1;
    this.frame = requestAnimationFrame(this.tick);
  };
  dispose() {
    cancelAnimationFrame(this.frame);
    this.fogTexture.dispose();
    this.observer.disconnect();
    this.controls.dispose();
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('keyup', this.keyUp);
    window.removeEventListener('blur', this.blur);
    this.remember(this.scene);
    const textures = new Set<T.Texture>();
    for (const m of this.materials) {
      for (const v of Object.values(m)) if (v instanceof T.Texture) textures.add(v);
      m.dispose();
    }
    textures.forEach((t) => t.dispose());
    this.geometries.forEach((g) => g.dispose());
    this.sun.shadow.dispose();
    this.renderer.dispose();
    this.host.replaceChildren();
  }
}
