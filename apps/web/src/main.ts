import * as THREE from 'three';
import { createScene } from '@meridian/presentation';
import { createNorthStarWorld } from '@meridian/presentation/north-star';
import './style.css';

type Backend = 'webgpu' | 'webgl';

type RendererLike = {
  outputColorSpace: string;
  setPixelRatio: (value: number) => void;
  setSize: (width: number, height: number, updateStyle?: boolean) => void;
  render: (scene: THREE.Scene, camera: THREE.Camera) => void;
  dispose: () => void;
};

const createRenderer = async (
  canvas: HTMLCanvasElement,
): Promise<{ backend: Backend; renderer: RendererLike }> => {
  const browserWithGpu = navigator as Navigator & { gpu?: unknown };
  const gpu = browserWithGpu.gpu as { requestAdapter?: () => Promise<unknown | null> } | undefined;
  const adapter = gpu?.requestAdapter ? await gpu.requestAdapter() : null;
  if (adapter) {
    try {
      const { WebGPURenderer } = await import('three/webgpu');
      const candidate = new WebGPURenderer({
        antialias: true,
        canvas,
      }) as unknown as RendererLike & {
        init: () => Promise<void>;
      };
      await candidate.init();
      return { backend: 'webgpu', renderer: candidate };
    } catch {
      // WebGL is the required readable fallback for unsupported or failed WebGPU.
    }
  }
  return {
    backend: 'webgl',
    renderer: new THREE.WebGLRenderer({ antialias: true, canvas }),
  };
};

const createHud = (): HTMLElement => {
  const hud = document.createElement('div');
  hud.className = 'hud';
  hud.innerHTML = [
    '<header class="topbar">',
    '  <div class="brand" aria-label="Empires of Meridian">',
    '    <svg class="crest" viewBox="0 0 48 48" role="img" aria-label="Meridian crest">',
    '      <path d="M24 3 42 12v14c0 10-7 16-18 19C13 42 6 36 6 26V12L24 3Z"/>',
    '      <path d="m24 10 3.7 8.2 9 .8-6.8 5.8 2 8.8-7.9-4.7-7.9 4.7 2-8.8-6.8-5.8 9-.8L24 10Z"/>',
    '    </svg>',
    '    <span><strong>MERIDIAN</strong><small>FIELD CHARTER // NORTHSTAR</small></span>',
    '  </div>',
    '  <div class="resources" aria-label="Resources">',
    '    <span class="resource"><i class="resource-dot provisions"></i><b>1,240</b><small>PROVISIONS</small></span>',
    '    <span class="resource"><i class="resource-dot timber"></i><b>860</b><small>TIMBER</small></span>',
    '    <span class="resource"><i class="resource-dot coin"></i><b>540</b><small>COIN</small></span>',
    '    <span class="resource"><i class="resource-dot metal"></i><b>310</b><small>METAL</small></span>',
    '    <span class="renown"><b>•••◦◦</b><small>RENOWN</small></span>',
    '  </div>',
    '  <div class="top-actions"><span class="backend-chip" data-backend>WEBGL PATH</span><button class="icon-button" type="button" data-action="reduced-motion" aria-pressed="false">MOTION</button><button class="icon-button" type="button" data-action="focus-hall">FOCUS</button></div>',
    '</header>',
    '<aside class="left-rail">',
    '  <div class="weather-card"><div class="eyebrow">FRONTIER COAST // 01:42</div><div class="weather-title"><span class="weather-mark">◌</span><span>LIGHT RAIN<small>WIND SSW · GENTLE</small></span></div><div class="forecast"><span class="active">NOW</span><span>02:10<br><b>OVERCAST</b></span><span>03:05<br><b>CLEAR</b></span></div></div>',
    '  <div class="alert-card"><span class="alert-dot"></span><span><b>SETTLEMENT READY</b><small>Central hall is online</small></span></div>',
    '</aside>',
    '<aside class="right-rail">',
    '  <div class="event-card"><span class="event-icon">✦</span><span><b>NEW HORIZON</b><small>Coastal route surveyed</small></span><time>NOW</time></div>',
    '  <div class="minimap-card" aria-label="Strategic minimap"><div class="minimap"><span class="mini-water"></span><span class="mini-road"></span><span class="mini-base"></span><span class="mini-unit u1"></span><span class="mini-unit u2"></span><span class="mini-unit u3"></span></div><div class="minimap-legend"><span><i class="legend-dot friendly"></i>OWNED</span><span><i class="legend-dot neutral"></i>NEUTRAL</span></div></div>',
    '</aside>',
    '<footer class="command-desk">',
    '  <div class="selection-portrait"><div class="portrait-mark">✧</div><div><b>MERIDIAN WORK PARTY</b><small>2 WORKERS · BUILDING</small></div></div>',
    '  <div class="selection-stats"><span><b>100%</b><small>HEALTH</small></span><span><b>READY</b><small>STATUS</small></span><span><b>FRONTIER</b><small>ERA</small></span></div>',
    '  <div class="command-grid" aria-label="Command preview"><button type="button" aria-label="Build">⌂</button><button type="button" aria-label="Gather">✥</button><button type="button" aria-label="Repair">⟲</button><button type="button" aria-label="More commands">···</button></div>',
    '</footer>',
    '<div class="controls-hint"><kbd>WASD</kbd> PAN <kbd>SCROLL</kbd> ZOOM <kbd>F1</kbd> HELP <span class="hint-divider"></span> PHASE 1 VISUAL TARGET</div>',
  ].join('');
  return hud;
};

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('App root is missing');

const canvas = document.createElement('canvas');
canvas.id = 'meridian-canvas';
canvas.setAttribute('aria-label', 'Meridian battlefield visual foundation');
app.append(canvas);

const bootstrap = async (): Promise<void> => {
  const { backend, renderer } = await createRenderer(canvas);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const { scene, camera } = createScene();
  scene.background = new THREE.Color(0x68786f);
  scene.fog = new THREE.Fog(0x68786f, 13, 28);
  camera.position.set(12.5, 10.5, 14.5);
  camera.lookAt(0, 0.2, 0);

  scene.add(new THREE.HemisphereLight(0xf3dec0, 0x26313b, 2.1));
  const key = new THREE.DirectionalLight(0xffdca6, 3.2);
  key.position.set(-6, 12, 7);
  scene.add(key);

  const world = createNorthStarWorld();
  scene.add(world.group);
  const hud = createHud();
  app.append(hud);
  const backendLabel = hud.querySelector<HTMLElement>('[data-backend]');
  if (backendLabel) backendLabel.textContent = backend === 'webgpu' ? 'WEBGPU PATH' : 'WEBGL PATH';

  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = reducedMotionQuery.matches;
  const motionButton = hud.querySelector<HTMLButtonElement>('[data-action="reduced-motion"]');
  motionButton?.addEventListener('click', () => {
    reducedMotion = !reducedMotion;
    motionButton.setAttribute('aria-pressed', String(reducedMotion));
    motionButton.textContent = reducedMotion ? 'STILL' : 'MOTION';
  });

  hud.querySelector('[data-action="focus-hall"]')?.addEventListener('click', () => {
    camera.position.set(8.8, 7.6, 10.5);
    camera.lookAt(0, 0.2, 0);
  });

  const resize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };
  window.addEventListener('resize', resize);
  resize();

  const started = performance.now();
  const render = (now: number): void => {
    world.update((now - started) / 1000, reducedMotion);
    renderer.render(scene, camera);
    requestAnimationFrame(render);
  };
  requestAnimationFrame(render);

  window.addEventListener('beforeunload', () => {
    world.dispose();
    renderer.dispose();
  });
};

void bootstrap();
