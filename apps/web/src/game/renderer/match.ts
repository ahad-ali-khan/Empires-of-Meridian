import {alignWall, updateWallPreview} from './wall-view';
import {setAudioListener} from '../audio';
import {createForest} from './forest';
import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {buildAsset, animateAsset, type AssetKind} from '../../../../../packages/asset-tools/src/models';
import {setFoliageTime, setResourceLevel} from '../../../../../packages/asset-tools/src/nature';
import type {Clip} from '../../../../../packages/asset-tools/src/actors';
import {placementReason, type MatchSnapshot} from '../../../../../packages/sim/src/index';
import {buildingById, unitById, productionName} from '../../../../../packages/content/src/index';
import {applyCondition, effectsTime} from '../../../../../packages/asset-tools/src/presentation';
import {makeSkyProbe} from './lighting';
import {prepareBuildingView} from './building-view';
import {halfBounds} from '../../../../../packages/sim/src/spatial';
import {Ragdoll, MachineWreck} from './ragdoll';
import {coastAt, terrainHeight, landAt, terrainZone, terrainDepth} from '../../../../../packages/sim/src/terrain';
import {createEnvironment} from './environment';
import {random} from './layout';
import {landscapeColor, makeGroundMaterial, grassClumpGeometry, laneDistance, type Lane} from './terrain-art';
import {
  wallSpans,
  wallPlacementReason,
  snapWallEndpoint,
  gateWallAt,
  gateConversionReason,
} from '../../../../../packages/sim/src/walls';

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
  walked: number;
  stateKey: string;
  label: HTMLDivElement;
  ragdoll?: Ragdoll | MachineWreck;
  remembered: boolean;
  cargo: T.Group;
  onScreen: boolean;
  sphere: T.Sphere;
  dynamic: boolean;
  occluded?: boolean;
  lastAnimated: number;
  matrixDirty: boolean;
  labelKey: string;
  occlusionBounds: T.Box3;
  terrainVersion: number;
};
export class MatchRenderer {
  wallAnchor?: {x: number; z: number};
  readonly scene = new T.Scene();
  readonly camera = new T.PerspectiveCamera(42, 1, 0.2, 1600);
  readonly renderer: T.WebGLRenderer;
  readonly controls: OrbitControls;
  private skyProbe: T.WebGLRenderTarget;
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
    dynamic: boolean;
    visibleKey: number;
  }[] = [];
  private forest?: ReturnType<typeof createForest>;
  private batchDirty = false;
  private grass?: T.InstancedMesh;
  private waterDepth = new T.DataTexture(new Uint8Array(4), 1, 1);
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
  private down?: {x: number; y: number; pointerId: number; shift: boolean; dragging: boolean};
  private hovered?: number;
  private cameraGesture?: number;
  private hoverAt = 0;
  private cursors = new Map<string, string>();
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
  private sharedGeometries = new Set<T.BufferGeometry>();
  private sharedMaterials = new Set<T.Material>();
  private scratchForward = new T.Vector3();
  private scratchRight = new T.Vector3();
  private scratchMove = new T.Vector3();
  private scratchPoint = new T.Vector3();
  private scratchRotation = new T.Quaternion();
  private entityById = new Map<number, MatchSnapshot['entities'][number]>();
  private worldRecipeKey = '';
  private baseGroundColors?: Float32Array;
  private previousTerrainBuildings: MatchSnapshot['entities'] = [];
  private sun = new T.DirectionalLight('#ffe8c5', 3.1);
  private fill = new T.HemisphereLight('#c4d9ec', '#615e45', 1.05);
  private weather = '';
  private grassTime = {value: 0};
  private observer: ResizeObserver;
  private shadowTime = 0;
  private audioTime = -1;
  private boundary = new T.Group();
  private terrainBuildings: MatchSnapshot['entities'] = [];
  private terrainVersion = 0;
  constructor(
    private host: HTMLElement,
    private onSelect: (id: number, add: boolean, button: number) => void,
    private onGround: (x: number, z: number, button: number, queued?: boolean) => void,
    private onGroup: (ids: number[], add: boolean) => void = () => {},
    private onError: (message: string) => void = () => {},
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
    // Hidden source rigs feed instance batches. Update only changed visible
    // rigs below instead of traversing every hidden limb every frame.
    this.scene.matrixWorldAutoUpdate = false;
    this.skyProbe = makeSkyProbe(this.renderer);
    this.scene.environment = this.skyProbe.texture;
    this.scene.environmentIntensity = 0.32;
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
      depthMap: {value: this.waterDepth},
    });
    this.environment.waterMat.fragmentShader =
      'uniform sampler2D visibilityMap;uniform sampler2D depthMap;uniform float worldSize;uniform float coastKnots[9];\n' +
      this.environment.waterMat.fragmentShader
        .replace(
          '24.+sin(p.y*.065)*7.+sin(p.y*.16)*2.',
          'mix(coastKnots[int(clamp(floor(p.y/(worldSize/8.)),0.,7.))],coastKnots[int(clamp(floor(p.y/(worldSize/8.)),0.,7.))+1],smoothstep(0.,1.,fract(clamp(p.y/worldSize,0.,.9999)*8.)))',
        )
        .replace('float depth=max(0.,p.x-shore+4.0);', 'float depth=texture2D(depthMap,clamp(p/worldSize,0.,1.)).r*8.;')
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
    this.scene.add(this.sun, this.sun.target, this.fill);
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
    this.ground = new T.Mesh(geo, makeGroundMaterial(600));
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
    canvas.addEventListener('pointercancel', this.cancelGesture);
    canvas.addEventListener('lostpointercapture', this.cancelGesture);
    canvas.addEventListener('pointerleave', this.pointerLeave);
    canvas.addEventListener('dblclick', this.doubleClick);
    canvas.addEventListener('contextmenu', this.preventMenu);
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', this.blur);
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(host);
    this.resize();
    this.scene.updateMatrixWorld(true);
    this.tick();
  }
  private addGroundCover() {
    const rand = random(327),
      g = grassClumpGeometry();
    const material = new T.MeshStandardMaterial({vertexColors: true, side: T.DoubleSide, roughness: 1});
    material.onBeforeCompile = (shader) => {
      shader.uniforms.grassTime = this.grassTime;
      shader.vertexShader = 'uniform float grassTime;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n transformed.x += sin(grassTime * 1.6 + instanceMatrix[3].x * .3 + instanceMatrix[3].z * .4) * position.y * position.y * .7;',
      );
    };
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
      const entity = this.entityById.get(id);
      if (
        !entity ||
        (entity.category !== 'unit' && entity.category !== 'animal' && entity.category !== 'resource') ||
        entity.kind === 'fish'
      )
        continue;
      if (
        entity.kind === 'timber' &&
        entity.stumpSince === undefined &&
        entity.amount >= (entity.initialAmount ?? entity.amount) * 0.5
      ) {
        v.model.visible = false;
        continue;
      }
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
      this.actorBatches.push({
        mesh,
        silhouette,
        parts: group.parts,
        dynamic: group.parts.some((p) => p.view.dynamic),
        visibleKey: -1,
      });
    }
    const trees: T.Group[] = [];
    for (const [id, v] of this.views) {
      const entity = this.entityById.get(id);
      if (
        entity?.kind !== 'timber' ||
        entity.stumpSince !== undefined ||
        entity.amount < (entity.initialAmount ?? entity.amount) * 0.5
      )
        continue;
      v.root.userData.variant = entity.model === 'pine' ? 1 : 0;
      trees.push(v.root);
    }
    if (!this.forest && trees.length) {
      const variants = [buildAsset('tree'), buildAsset('pine')];
      for (const variant of variants)
        variant.traverse((o) => {
          if (!(o instanceof T.Mesh)) return;
          const source = o.material as T.Material,
            local = source.clone();
          local.onBeforeCompile = source.onBeforeCompile;
          local.customProgramCacheKey = source.customProgramCacheKey;
          o.material = local;
        });
      variants.forEach((v) => this.share(v));
      this.forest = createForest(this.renderer, variants, [], {
        capacity: 2048,
        cullOutside: true,
        light: this.sun,
        fill: this.fill,
      });
      for (const variant of variants)
        variant.traverse((o) => {
          if (o instanceof T.Mesh) this.fogMaterial(o.material as T.Material);
        });
      for (const material of this.forest.materials) this.fogMaterial(material);
      this.scene.add(this.forest.group);
    }
    this.forest?.setTrees(trees);
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
  private fogMaterial(material: T.Material) {
    const previous = material.userData.beforeFog ?? material.onBeforeCompile;
    material.userData.beforeFog = previous;
    material.onBeforeCompile = (shader, renderer) => {
      previous.call(material, shader, renderer);
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
    material.customProgramCacheKey = () => `match-visibility-v3:${previous.toString()}`;
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
    const recipeKey = `${this.seed}:${this.worldSize}`;
    if (recipeKey === this.worldRecipeKey) {
      this.patchFoundations();
      return;
    }
    this.worldRecipeKey = recipeKey;
    const w = this.worldSize,
      geo = new T.PlaneGeometry(w, w, 280, 280);
    geo.rotateX(-Math.PI / 2);
    geo.translate(w / 2, 0, w / 2);
    const pos = geo.attributes.position,
      colors: number[] = [],
      rand = random(this.seed);
    const lanes: Lane[] = [];
    // Only observed settlement buildings can form paths. Hidden towns never
    // leave roads or clearings in the viewer's terrain.
    for (const building of this.terrainBuildings) {
      if (building.progress < 10000 || ['hall', 'wall', 'gate', 'farm'].includes(building.kind)) continue;
      const hall = this.terrainBuildings.find((e) => e.kind === 'hall' && e.owner === building.owner);
      if (hall && Math.hypot(hall.x - building.x, hall.z - building.z) < 32 * 256)
        lanes.push([hall.x / 256, hall.z / 256, building.x / 256, building.z / 256]);
    }
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        z = pos.getZ(i),
        y = terrainHeight(x, z, w, this.seed);
      const shore = coastAt(Math.round(z * 256), w * 256, this.seed) / 256 - x;
      pos.setY(i, y);
      const slope =
        Math.hypot(
          terrainHeight(x + 0.7, z, w, this.seed) - terrainHeight(x - 0.7, z, w, this.seed),
          terrainHeight(x, z + 0.7, w, this.seed) - terrainHeight(x, z - 0.7, w, this.seed),
        ) / 1.4;
      const c = landscapeColor(
        x,
        z,
        y,
        slope,
        this.seed,
        shore,
        Infinity,
        terrainZone(Math.round(x * 256), Math.round(z * 256), w * 256, this.seed),
      );
      colors.push(c.r, c.g, c.b);
    }
    const groundMaterial = this.ground.material as T.MeshStandardMaterial;
    groundMaterial.map?.repeat.set(w / 3, w / 3);
    geo.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    this.baseGroundColors = Float32Array.from(colors);
    geo.computeVertexNormals();
    this.ground.geometry.dispose();
    this.ground.geometry = geo;
    this.waterDepth.dispose();
    const resolution = Math.ceil(w),
      depthPixels = new Uint8Array(resolution * resolution * 4);
    for (let z = 0; z < resolution; z++)
      for (let x = 0; x < resolution; x++) {
        const depth = terrainDepth(
          Math.round(((x + 0.5) / resolution) * w * 256),
          Math.round(((z + 0.5) / resolution) * w * 256),
          w * 256,
          this.seed,
        );
        const index = (z * resolution + x) * 4;
        depthPixels[index] = Math.min(255, Math.round((depth / 256 / 8) * 255));
        depthPixels[index + 3] = 255;
      }
    this.waterDepth = new T.DataTexture(depthPixels, resolution, resolution);
    this.waterDepth.minFilter = this.waterDepth.magFilter = T.LinearFilter;
    this.waterDepth.needsUpdate = true;
    this.environment.waterMat.uniforms.depthMap.value = this.waterDepth;
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
    this.boundary.updateMatrixWorld(true);
    this.fogMaterial(this.ground.material as T.MeshStandardMaterial);
    if (this.grass) {
      const matrix = new T.Matrix4(),
        q = new T.Quaternion();
      for (let i = 0; i < this.grass.count; i++) {
        const x = rand() * w * 0.9,
          z = rand() * w,
          blocked =
            laneDistance(x, z, lanes) < 1.4 ||
            this.terrainBuildings.some(
              (e) =>
                e.category === 'building' &&
                Math.abs(x - e.x / 256) < (buildingById.get(e.kind)?.footprint[0] ?? 3) + 0.7 &&
                Math.abs(z - e.z / 256) < (buildingById.get(e.kind)?.footprint[1] ?? 3) + 0.7,
            );
        matrix.compose(
          new T.Vector3(x, this.height(x, z), z),
          q.setFromAxisAngle(new T.Vector3(0, 1, 0), rand() * 6.28),
          new T.Vector3(
            0.85 + rand() * 0.7,
            blocked || !landAt(Math.round(x * 256), Math.round(z * 256), w * 256, this.seed) ? 0 : 0.55 + rand() * 0.8,
            0.85 + rand() * 0.7,
          ),
        );
        this.grass.setMatrixAt(i, matrix);
      }
      this.grass.instanceMatrix.needsUpdate = true;
      this.grass.frustumCulled = false;
      this.fogMaterial(this.grass.material as T.MeshStandardMaterial);
    }
    this.previousTerrainBuildings = [];
    this.patchFoundations();
  }
  private patchFoundations() {
    if (!this.baseGroundColors) return;
    const current = this.terrainBuildings.filter((e) => !e.wallAxis),
      previous = this.previousTerrainBuildings,
      keys = new Set(current.map((e) => `${e.id}:${e.progress === 10000}`)),
      oldKeys = new Set(previous.map((e) => `${e.id}:${e.progress === 10000}`)),
      changed = [
        ...previous.filter((e) => !keys.has(`${e.id}:${e.progress === 10000}`)),
        ...current.filter((e) => !oldKeys.has(`${e.id}:${e.progress === 10000}`)),
      ];
    if (!changed.length) return;
    const dirty: {minX: number; minZ: number; maxX: number; maxZ: number}[] = [],
      lanes: Lane[] = [];
    for (const e of changed) {
      const [hx, hz] = halfBounds(e);
      dirty.push({
        minX: (e.x - hx) / 256 - 2,
        minZ: (e.z - hz) / 256 - 2,
        maxX: (e.x + hx) / 256 + 2,
        maxZ: (e.z + hz) / 256 + 2,
      });
    }
    for (const set of [previous, current])
      for (const b of set) {
        if (b.progress < 10000 || ['hall', 'farm', 'wall', 'gate'].includes(b.kind)) continue;
        const hall = set.find((e) => e.kind === 'hall' && e.owner === b.owner);
        if (!hall || Math.hypot(hall.x - b.x, hall.z - b.z) >= 32 * 256) continue;
        const lane: Lane = [hall.x / 256, hall.z / 256, b.x / 256, b.z / 256];
        if (set === current) lanes.push(lane);
        if (changed.some((e) => e.id === b.id || e.id === hall.id))
          dirty.push({
            minX: Math.min(lane[0], lane[2]) - 2,
            minZ: Math.min(lane[1], lane[3]) - 2,
            maxX: Math.max(lane[0], lane[2]) + 2,
            maxZ: Math.max(lane[1], lane[3]) + 2,
          });
      }
    const pos = this.ground.geometry.attributes.position,
      color = this.ground.geometry.attributes.color,
      pathColor = new T.Color('#b3a07b'),
      c = new T.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        z = pos.getZ(i);
      if (!dirty.some((r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ)) continue;
      pos.setY(i, this.height(x, z));
      c.fromArray(this.baseGroundColors, i * 3);
      c.lerp(pathColor, (1 - T.MathUtils.smoothstep(laneDistance(x, z, lanes), 0.65, 1.8)) * 0.55);
      color.setXYZ(i, c.r, c.g, c.b);
    }
    pos.needsUpdate = color.needsUpdate = true;
    this.ground.geometry.computeVertexNormals();
    if (this.grass) {
      const matrix = new T.Matrix4();
      for (let i = 0; i < this.grass.count; i++) {
        this.grass.getMatrixAt(i, matrix);
        const x = matrix.elements[12],
          z = matrix.elements[14];
        if (!dirty.some((r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ)) continue;
        const blocked =
          current.some((e) => {
            const [hx, hz] = halfBounds(e);
            return Math.abs(x - e.x / 256) < hx / 256 + 0.3 && Math.abs(z - e.z / 256) < hz / 256 + 0.3;
          }) || !landAt(Math.round(x * 256), Math.round(z * 256), this.worldSize * 256, this.seed);
        matrix.elements[13] = this.height(x, z);
        matrix.elements[5] = blocked ? 0 : matrix.elements[5] || 0.8;
        this.grass.setMatrixAt(i, matrix);
      }
      this.grass.instanceMatrix.needsUpdate = true;
    }
    this.previousTerrainBuildings = current;
    this.renderer.shadowMap.needsUpdate = true;
  }
  private cursor(kind: string) {
    const cached = this.cursors.get(kind);
    if (cached) return cached;
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
    const cursor = 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '") 8 8, crosshair';
    this.cursors.set(kind, cursor);
    return cursor;
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
    root.updateMatrixWorld(true);
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
      ownedGeometries: this.geometries.size,
      ownedMaterials: this.materials.size,
      distantTrees:
        this.forest?.group.children.reduce(
          (count, o) =>
            count + (o instanceof T.InstancedMesh && o.material instanceof T.MeshBasicMaterial ? o.count : 0),
          0,
        ) ?? 0,
      weatherLook: {...this.environment.look},
    };
  }
  private blur = () => {
    this.keys.clear();
    this.cancelGesture();
  };
  weatherAudioTransition() {
    return this.environment.audioTransition;
  }
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
  private hit(e: MouseEvent, ordering = false) {
    this.setRay(e);
    const rect = this.renderer.domElement.getBoundingClientRect();
    const candidates = [...this.views.values()].filter((v) => {
      const entity = this.entityById.get(v.proxy.userData.entityId);
      return (
        v.onScreen &&
        entity &&
        entity.garrisonedIn === undefined &&
        !(entity.category === 'unit' && entity.hp <= 0 && entity.incapacitatedAt === undefined)
      );
    });
    const score = (id: number) => {
      const p = this.projectEntity(id);
      return p ? Math.hypot(p.x + rect.left - e.clientX, p.y + rect.top - e.clientY) : Infinity;
    };
    const hits = this.ray.intersectObjects(
      candidates.filter((v) => this.ray.ray.intersectsSphere(v.sphere)).map((v) => v.proxy),
      false,
    );
    // Mobile targets remain clickable through scenery. A small screen-space capsule
    // also makes moving animals and a silhouette behind a roof easy to acquire.
    let assisted: number | undefined,
      distance = 14;
    for (const v of candidates) {
      const entity = this.entityById.get(v.proxy.userData.entityId)!;
      if (entity.remembered || (entity.category !== 'unit' && entity.category !== 'animal')) continue;
      if (ordering && entity.owner === 1 && this.selected.has(entity.id)) continue;
      const base = v.root.position
        .clone()
        .add(new T.Vector3(0, 0.35, 0))
        .project(this.camera);
      const top = v.root.position
        .clone()
        .add(new T.Vector3(0, Math.max(1, v.proxy.position.y * 1.7), 0))
        .project(this.camera);
      if (base.z < -1 || base.z > 1 || top.z < -1 || top.z > 1) continue;
      const ax = ((base.x + 1) * rect.width) / 2 + rect.left,
        ay = ((1 - base.y) * rect.height) / 2 + rect.top;
      const bx = ((top.x + 1) * rect.width) / 2 + rect.left,
        by = ((1 - top.y) * rect.height) / 2 + rect.top;
      const t = T.MathUtils.clamp(
        ((e.clientX - ax) * (bx - ax) + (e.clientY - ay) * (by - ay)) / Math.max(1, (bx - ax) ** 2 + (by - ay) ** 2),
        0,
        1,
      );
      const d = Math.hypot(e.clientX - (ax + (bx - ax) * t), e.clientY - (ay + (by - ay) * t));
      if (d < distance) {
        distance = d;
        assisted = entity.id;
      }
    }
    if (assisted !== undefined) return assisted;
    const exact = hits.sort((a, b) => score(a.object.userData.entityId) - score(b.object.userData.entityId))[0];
    return exact?.object.userData.entityId as number | undefined;
  }
  private setHovered(id?: number) {
    if (id === this.hovered) return;
    const old = this.views.get(this.hovered ?? -1);
    if (old) old.ring.userData.hovered = false;
    this.hovered = id;
    const next = this.views.get(id ?? -1);
    if (next) {
      next.ring.userData.hovered = true;
      next.ring.visible = true;
    }
  }
  private cancelGesture = () => {
    this.down = undefined;
    this.cameraGesture = undefined;
    this.marquee.hidden = true;
    this.setHovered();
    this.renderer.domElement.style.cursor = this.ordering ? 'crosshair' : 'default';
  };
  private pointerLeave = () => {
    if (!this.down) this.setHovered();
  };
  private pointerDown = (e: PointerEvent) => {
    this.renderer.domElement.focus();
    this.setHovered();
    if (e.button === 1 || (e.button === 0 && this.controls.mouseButtons.LEFT === T.MOUSE.ROTATE)) {
      this.cancelGesture();
      this.cameraGesture = e.pointerId;
      this.renderer.domElement.style.cursor = 'grabbing';
      return;
    }
    if (e.button === 2) {
      e.preventDefault();
      this.dispatchPointer(e, 2, e.shiftKey);
      return;
    }
    if (e.button !== 0) return;
    this.down = {x: e.clientX, y: e.clientY, pointerId: e.pointerId, shift: e.shiftKey, dragging: false};
    this.renderer.domElement.setPointerCapture(e.pointerId);
  };
  private dispatchPointer(e: MouseEvent, button: number, shift: boolean) {
    if (!this.placing) {
      const id = this.hit(e, button === 2 || this.ordering);
      if (id !== undefined) {
        this.onSelect(id, shift, button);
        return;
      }
    }
    this.setRay(e);
    const hit = this.ray.intersectObject(this.ground)[0];
    if (hit) this.onGround(hit.point.x, hit.point.z, button, shift);
  }
  private pointerMove = (e: PointerEvent) => {
    if (this.cameraGesture !== undefined) return;
    if (!this.down && !this.placing) {
      if (performance.now() - this.hoverAt < 30) return;
      this.hoverAt = performance.now();
      const id = this.hit(e, this.selected.size > 0 || this.ordering),
        entity = this.entityById.get(id ?? -1),
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
      this.setHovered(id);
      this.renderer.domElement.style.cursor = this.ordering
        ? 'crosshair'
        : type
          ? this.cursor(type)
          : id
            ? 'pointer'
            : 'default';
    }
    if (this.ghost) {
      this.setRay(e);
      const hit = this.ray.intersectObject(this.ground)[0];
      if (hit) {
        this.ghost.position.set(hit.point.x, hit.point.y + 0.06, hit.point.z);
        let invalid = '';
        if (this.snapshot && this.placing === 'wall') {
          const end = snapWallEndpoint(this.snapshot, Math.round(hit.point.x * 256), Math.round(hit.point.z * 256), 1);
          const start = this.wallAnchor
            ? snapWallEndpoint(
                this.snapshot,
                Math.round(this.wallAnchor.x * 256),
                Math.round(this.wallAnchor.z * 256),
                1,
              )
            : {x: end.x - 640, z: end.z};
          const spans = wallSpans(start.x, start.z, end.x, end.z);
          invalid = wallPlacementReason(this.snapshot, spans, 1);
          this.ghost.position.set(0, 0, 0);
          this.ghost.rotation.set(0, 0, 0);
          this.ghost.scale.set(1, 1, 1);
          if (this.ghostFootprint) this.ghostFootprint.visible = false;
          updateWallPreview(this.ghost, spans, this.snapshot.players[0].age, this.worldSize, this.seed, !!invalid);
        } else if (this.snapshot) {
          const gate =
            this.placing === 'gate'
              ? gateWallAt(this.snapshot, Math.round(hit.point.x * 256), Math.round(hit.point.z * 256), 1)
              : undefined;
          invalid = gate
            ? gateConversionReason(gate, 1, this.snapshot.players[0].age, this.snapshot)
            : placementReason(
                this.snapshot,
                this.placing!,
                Math.round(hit.point.x * 256),
                Math.round(hit.point.z * 256),
                this.placementQuarter,
              );
          const preview = this.ghost.getObjectByName('buildingPreview') as T.Group | undefined;
          if (gate) {
            this.ghost.position.set(gate.x / 256, this.height(gate.x / 256, gate.z / 256), gate.z / 256);
            this.ghost.rotation.y = -Math.atan2(gate.wallAxis?.[1] ?? 0, gate.wallAxis?.[0] ?? 1280);
            if (preview)
              alignWall(
                preview,
                {x: gate.x, z: gate.z, dx: gate.wallAxis?.[0] ?? 1280, dz: gate.wallAxis?.[1] ?? 0},
                this.worldSize,
                this.seed,
              );
          } else {
            this.ghost.rotation.y = (this.placementQuarter * Math.PI) / 2;
            if (preview?.userData.wallMatrix) {
              preview.matrix.copy(preview.userData.wallMatrix);
              preview.matrixWorldNeedsUpdate = true;
            }
          }
          if (this.ghostFootprint) this.ghostFootprint.visible = !gate;
          const outline = this.ghost.getObjectByName('placementEdge');
          if (outline) outline.visible = !gate;
        }
        this.ghostFootprint?.material.color.set(invalid ? '#eb6556' : '#7ee8b4');
        const edge = this.ghost.getObjectByName('placementEdge') as T.LineLoop | undefined;
        (edge?.material as T.LineBasicMaterial | undefined)?.color.set(invalid ? '#eb6556' : '#7ee8b4');
      }
    }
    const d = this.down;
    if (!d || e.pointerId !== d.pointerId || this.placing) return;
    d.dragging ||= Math.hypot(e.clientX - d.x, e.clientY - d.y) >= 7;
    if (!d.dragging) return;
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
    this.cameraGesture = undefined;
    const d = this.down;
    if (!d || e.pointerId !== d.pointerId) {
      this.renderer.domElement.style.cursor = this.ordering ? 'crosshair' : 'default';
      return;
    }
    this.down = undefined;
    this.marquee.hidden = true;
    if (this.renderer.domElement.hasPointerCapture(e.pointerId))
      this.renderer.domElement.releasePointerCapture(e.pointerId);
    if (d.dragging && !this.placing) {
      const rect = this.renderer.domElement.getBoundingClientRect(),
        ids: number[] = [],
        sheep: number[] = [];
      for (const entity of this.snapshot?.entities ?? []) {
        if (
          entity.owner !== 1 ||
          entity.hp <= 0 ||
          entity.garrisonedIn !== undefined ||
          (entity.category !== 'unit' && entity.kind !== 'sheep')
        )
          continue;
        const v = this.views.get(entity.id);
        if (!v?.onScreen) continue;
        const p = v.root.position
            .clone()
            .add(new T.Vector3(0, 1, 0))
            .project(this.camera),
          x = rect.left + ((p.x + 1) * rect.width) / 2,
          y = rect.top + ((1 - p.y) * rect.height) / 2;
        if (
          p.z >= -1 &&
          p.z < 1 &&
          x >= Math.min(d.x, e.clientX) &&
          x <= Math.max(d.x, e.clientX) &&
          y >= Math.min(d.y, e.clientY) &&
          y <= Math.max(d.y, e.clientY)
        )
          (entity.kind === 'sheep' ? sheep : ids).push(entity.id);
      }
      this.onGroup(ids.length ? ids : sheep, d.shift);
      return;
    }
    this.dispatchPointer(e, 0, d.shift);
  };
  private doubleClick = (e: MouseEvent) => {
    if (this.placing || this.ordering || e.altKey || e.button !== 0) return;
    const id = this.hit(e),
      entity = this.entityById.get(id ?? -1);
    if (!entity || entity.owner !== 1) return;
    this.onGroup(
      (this.snapshot?.entities ?? [])
        .filter((candidate) => {
          if (
            candidate.owner !== 1 ||
            candidate.kind !== entity.kind ||
            candidate.hp <= 0 ||
            candidate.garrisonedIn !== undefined
          )
            return false;
          const view = this.views.get(candidate.id);
          if (!view?.onScreen) return false;
          const p = view.root.position
            .clone()
            .add(new T.Vector3(0, 1, 0))
            .project(this.camera);
          return p.z >= -1 && p.z < 1 && Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1;
        })
        .map((candidate) => candidate.id),
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
        preview.name = 'buildingPreview';
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
      if (o instanceof T.Mesh || o instanceof T.Line) {
        this.geometries.add(o.geometry);
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) this.materials.add(m);
      }
    });
  }
  private share(root: T.Object3D) {
    root.traverse((o) => {
      if (!(o instanceof T.Mesh)) return;
      this.sharedGeometries.add(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) this.sharedMaterials.add(m);
    });
    this.remember(root);
  }
  private release(root: T.Object3D) {
    const geometry = new Set<T.BufferGeometry>(),
      material = new Set<T.Material>();
    root.traverse((o) => {
      if (!(o instanceof T.Mesh) && !(o instanceof T.Line)) return;
      if (!this.sharedGeometries.has(o.geometry)) geometry.add(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        if (!this.sharedMaterials.has(m)) material.add(m);
    });
    geometry.forEach((g) => {
      g.dispose();
      this.geometries.delete(g);
    });
    material.forEach((m) => {
      m.dispose();
      this.materials.delete(m);
    });
  }
  update(snapshot: MatchSnapshot) {
    this.snapshot = snapshot;
    this.entityById = new Map(snapshot.entities.map((e) => [e.id, e]));
    if (this.weather !== snapshot.map.weather) {
      this.weather = snapshot.map.weather;
      this.environment.setWeather(snapshot.map.weather);
    }

    this.terrainBuildings = snapshot.entities.filter((e) => e.category === 'building' && e.hp > 0);
    this.refreshRallies();
    this.receivedAt = this.time;
    const worldKey =
      snapshot.map.seed +
      ':' +
      snapshot.map.size +
      ':' +
      this.terrainBuildings.map((e) => `${e.id}:${e.progress === 10000}`).join();
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
      this.terrainVersion++;
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
    const byId = this.entityById;
    const live = new Set(snapshot.entities.map((e) => e.id));
    for (const e of snapshot.entities) {
      const age = e.tradeSite ? 2 : e.owner ? Math.min(4, snapshot.players[e.owner - 1]?.age ?? 1) : 1;
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
        this.release(v.root);
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
          this.share(proto);
        }
        const model = proto.clone();
        model.traverse((o) => {
          o.userData.externalProjectiles = true;
        });
        if (e.wallAxis) {
          alignWall(model, {x: e.x, z: e.z, dx: e.wallAxis[0], dz: e.wallAxis[1]}, this.worldSize, this.seed);
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
                    this.sharedMaterials.add(n);
                    this.materials.add(n);
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
          walked: 0,
          lastAnimated: -1,
          matrixDirty: true,
          labelKey: '',
          occlusionBounds: new T.Box3(),
          terrainVersion: this.terrainVersion,
        };
        this.views.set(e.id, v);
        this.renderer.shadowMap.needsUpdate = true;
      }
      v.model.userData.attackStart = e.attackStart;
      v.model.userData.attackCooldown = unitById.get(e.kind)?.cooldown ?? 35;
      if (v.x !== e.x || v.z !== e.z || v.terrainVersion !== this.terrainVersion) {
        v.target.set(e.x / 256, e.kind === 'fish' ? 0.06 : this.height(e.x / 256, e.z / 256), e.z / 256);
        v.terrainVersion = this.terrainVersion;
      }
      if (e.kind === 'coin' || e.kind === 'metal') {
        const chunks = Math.ceil((e.amount / Math.max(1, e.initialAmount ?? e.amount)) * 12);
        if (v.model.userData.resourceChunks !== chunks) {
          setResourceLevel(v.model, (e.amount / Math.max(1, e.initialAmount ?? e.amount)) * 100);
          v.model.userData.resourceChunks = chunks;
        }
      }
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
        const labelKey = `${queue?.kind}:${queue && Math.ceil(queue.remaining / 20)}:${Math.floor(e.progress / 100)}:${e.queue.map((q) => q.kind).join(',')}`;
        if (labelKey !== v.labelKey) {
          v.labelKey = labelKey;
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
    }
    for (const [id, v] of this.views)
      if (!live.has(id)) {
        this.scene.remove(v.root);
        v.label.remove();
        this.release(v.root);
        this.views.delete(id);
        this.batchDirty = true;
        this.renderer.shadowMap.needsUpdate = true;
      }
    if (this.batchDirty) this.rebuildBatches();
    const shotIds = new Set(snapshot.projectiles.map((s) => s.id));
    for (const shot of snapshot.projectiles) {
      let model = this.shots.get(shot.id);
      if (!model) {
        const templateKey = `projectile:${shot.kind}`;
        let template = this.templates.get(templateKey);
        if (!template) {
          template = new T.Group();
          if (shot.kind === 'shell') {
            template.add(
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
            template.add(shaft, tip);
          }
          this.templates.set(templateKey, template);
          this.share(template);
        }
        model = template.clone();
        const source = this.views.get(shot.sourceId),
          muzzle = source?.model.getObjectByName('shotOrigin');
        if (muzzle) {
          const p = muzzle.getWorldPosition(this.scratchPoint);
          model.userData.launchHeight = p.y;
          model.userData.launchOffset = [p.x - (shot.startX ?? shot.x) / 256, p.z - (shot.startZ ?? shot.z) / 256];
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
        this.release(m);
        this.shots.delete(id);
      }
  }
  private tick = () => {
    try {
      this.renderFrame();
    } catch (error) {
      this.onError(error instanceof Error ? error.message : 'The battlefield could not be rendered.');
    }
  };
  private renderFrame = () => {
    const now = performance.now(),
      dt = Math.min(0.05, (now - this.last) / 1000);
    this.frameTimes.push(now - this.last);
    if (this.frameTimes.length > 120) this.frameTimes.shift();
    this.last = now;
    this.time += dt;
    const forward = this.scratchForward;
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    const right = this.scratchRight.set(-forward.z, 0, forward.x),
      move = this.scratchMove.set(0, 0, 0);
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) move.add(forward);
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) move.sub(forward);
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) move.sub(right);
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) move.add(right);
    move.multiplyScalar(dt * 24);
    this.camera.position.add(move);
    this.controls.target.add(move);
    const correction = this.scratchPoint.set(
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
        this.release(marker.root);
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
      const target = this.entityById.get(shot.targetId),
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
      model.updateMatrixWorld(true);
    }
    this.camera.updateMatrixWorld();
    this.frustum.setFromProjectionMatrix(
      this.projection.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse),
    );
    const blend = 1 - Math.exp(-dt * 18);
    const checkOcclusion = this.time - this.occlusionAt > 0.15;
    if (checkOcclusion) this.occlusionAt = this.time;
    const occluders = checkOcclusion
      ? [...this.views.values()]
          .filter((v) => v.onScreen && !v.proxy.userData.unit)
          .map((v) => {
            if (!v.proxy.geometry.boundingBox) v.proxy.geometry.computeBoundingBox();
            return v.occlusionBounds.copy(v.proxy.geometry.boundingBox!).applyMatrix4(v.proxy.matrixWorld);
          })
      : [];
    for (const v of this.views.values()) {
      v.sphere.center.copy(v.target);
      v.sphere.center.y += v.sphere.radius * 0.45;
      v.onScreen = this.frustum.intersectsSphere(v.sphere);
      v.root.visible = v.onScreen;
      v.root.userData.lodVisible = v.onScreen;
      if (!v.onScreen) {
        v.label.style.visibility = 'hidden';
        continue;
      }
      const oldX = v.root.position.x,
        oldZ = v.root.position.z,
        oldY = v.root.position.y;
      v.root.position.lerp(v.target, blend);
      v.walked += Math.hypot(v.root.position.x - oldX, v.root.position.z - oldZ);
      if (checkOcclusion && v.proxy.userData.unit) {
        const center = this.scratchForward.copy(v.root.position);
        center.y += 1.2;
        const direction = this.scratchRight.copy(center).sub(this.camera.position),
          distance = direction.length();
        this.ray.ray.set(this.camera.position, direction.normalize());
        v.occluded = occluders.some((box) => {
          const hit = this.ray.ray.intersectBox(box, this.scratchPoint);
          return !!hit && hit.distanceToSquared(this.camera.position) < (distance - 0.5) ** 2;
        });
        if (!v.occluded)
          for (let i = 1; i < 12; i++) {
            const p = this.scratchPoint.copy(center).lerp(this.camera.position, i / 12);
            if (terrainHeight(p.x, p.z, this.worldSize, this.seed) > p.y) {
              v.occluded = true;
              break;
            }
          }
      }
      const rotationChange =
        Math.atan2(Math.sin(v.yaw - v.root.rotation.y), Math.cos(v.yaw - v.root.rotation.y)) * blend;
      v.root.rotation.y += rotationChange;
      v.matrixDirty =
        v.matrixDirty ||
        Math.abs(oldX - v.root.position.x) +
          Math.abs(oldZ - v.root.position.z) +
          Math.abs(oldY - v.root.position.y) +
          Math.abs(rotationChange) >
          0.00001;
      if (v.ragdoll) v.ragdoll.update(dt);
      else if (v.model.userData.shoal) {
        v.matrixDirty = true;
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
      } else if (!v.remembered && v.dynamic) {
        let motionTime = this.time - v.phase;
        if (v.clip === 'walk') motionTime = (v.walked / (v.model.userData.gaitStride ?? 0.66)) * (Math.PI / 3);
        if (['idle', 'walk', 'graze', 'carry'].includes(v.clip))
          motionTime += (v.proxy.userData.entityId * 0.61803398875) % 5;
        if (v.clip === 'attack' && v.model.userData.attackStart !== undefined) {
          const data = v.model.userData;
          const motion =
            data.shot && !data.villager
              ? {period: data.shot.period, contact: data.shot.release}
              : (data.attackMotion ?? {period: 1.8, contact: 0.72});
          const elapsed = Math.max(
            0,
            ((this.snapshot?.tick ?? 0) - data.attackStart) / 20 + this.time - this.receivedAt,
          );
          motionTime =
            elapsed < 0.4
              ? (elapsed / 0.4) * motion.contact
              : motion.contact +
                Math.min(0.999, (elapsed - 0.4) / (data.attackCooldown / 20)) * (motion.period - motion.contact);
        }
        const pixels =
            (v.sphere.radius * this.host.clientHeight) /
            (Math.tan(T.MathUtils.degToRad(this.camera.fov / 2)) *
              Math.max(1, this.camera.position.distanceTo(v.root.position))),
          interval = pixels > 100 ? 0 : pixels > 40 ? 1 / 30 : 1 / 15;
        if (this.time - v.lastAnimated >= interval) {
          animateAsset(v.model, motionTime, v.clip);
          v.lastAnimated = this.time;
          v.matrixDirty = true;
        }
      }
      v.ring.visible =
        this.selected.has(v.proxy.userData.entityId) ||
        !!v.ring.userData.hovered ||
        (v.ring.userData.flashUntil ?? 0) > this.time;
      if (v.health.visible) {
        v.health.quaternion.copy(
          this.scratchRotation.copy(v.root.quaternion).invert().multiply(this.camera.quaternion),
        );
        v.health.updateMatrixWorld();
      }
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
    for (const v of this.views.values())
      if (v.onScreen && (v.matrixDirty || v.ragdoll)) {
        v.root.updateMatrixWorld(true);
        v.matrixDirty = false;
      }
    for (const batch of this.actorBatches) {
      let visibleKey = 0;
      if (!batch.dynamic) {
        for (const part of batch.parts)
          if (part.view.onScreen)
            visibleKey = Math.imul(
              visibleKey ^ part.view.proxy.userData.entityId ^ (part.view.model.userData.resourceChunks ?? 0),
              16777619,
            );
        if (visibleKey === batch.visibleKey) continue;
        batch.visibleKey = visibleKey;
      }
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
    this.grassTime.value += dt * this.environment.wind.value;
    setFoliageTime(this.time, this.environment.wind.value);
    effectsTime.value = this.time;
    this.environment.update((this.snapshot?.tick ?? 0) / 20 + Math.min(0.05, this.time - this.receivedAt), this.camera);
    this.environment.group.updateMatrixWorld();
    this.ghost?.updateMatrixWorld(true);
    const weatherLook = this.environment.look;
    this.sun.intensity = weatherLook.sun;
    this.sun.color.setRGB(weatherLook.sunR, weatherLook.sunG, weatherLook.sunB);
    this.fill.intensity = weatherLook.fill;
    const fog = this.scene.fog as T.FogExp2;
    fog.color.setRGB(weatherLook.fogR, weatherLook.fogG, weatherLook.fogB);
    fog.density = weatherLook.density;
    this.forest?.setLighting(this.sun, this.fill);
    this.forest?.update(this.camera, this.renderer.domElement.height);
    if (this.time - this.audioTime > 0.25) {
      const direction = this.camera.getWorldDirection(this.scratchForward);
      setAudioListener({
        x: this.camera.position.x,
        y: this.camera.position.y,
        z: this.camera.position.z,
        yaw: Math.atan2(direction.x, direction.z),
      });
      this.audioTime = this.time;
    }
    const wideView = this.camera.position.distanceTo(this.controls.target) > 85;
    if (this.time - this.shadowTime > (wideView ? 0.35 : 0.15)) {
      const p = this.controls.target;
      this.sun.position.set(p.x - 32, 62, p.z + 28);
      this.sun.target.position.set(p.x, 0, p.z);
      this.sun.updateMatrixWorld();
      this.sun.target.updateMatrixWorld();
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
    this.waterDepth.dispose();
    this.observer.disconnect();
    this.controls.dispose();
    if (this.forest) {
      this.scene.remove(this.forest.group);
      this.forest.dispose();
    }
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
    this.skyProbe.dispose();
    this.renderer.dispose();
    this.host.replaceChildren();
  }
}
