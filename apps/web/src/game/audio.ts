import type {EnvironmentWeather} from '../../../../packages/protocol/src/index';

export type AudioPoint = {x: number; y?: number; z: number};
export type AudioListener = {x: number; y: number; z: number; yaw: number};
export type AmbientSource = AudioPoint & {
  id: string;
  kind: 'shore' | 'water' | 'foliage' | 'birds' | 'wolf' | 'sheep' | 'nature';
  strength?: number;
};

const ambientLimit = 12;
let listener: AudioListener = {x: 0, y: 25, z: 0, yaw: 0};

/** Distance is measured from the camera, including zoom altitude. UI cues omit a source. */
export function spatialAudioMix(camera: AudioListener, source: AudioPoint, radius = 52) {
  const dx = source.x - camera.x,
    dz = source.z - camera.z,
    dy = (source.y ?? 0) - camera.y;
  const distance = Math.hypot(dx, dy, dz);
  const gain = 1 / (1 + (distance / radius) ** 2);
  // Camera yaw is its horizontal forward direction. A source on the right is positive pan.
  const pan = Math.max(
    -0.92,
    Math.min(0.92, (dx * Math.cos(camera.yaw) - dz * Math.sin(camera.yaw)) / Math.max(18, distance)),
  );
  return {gain: distance > radius * 12 ? 0 : gain, pan};
}

export function audibleAmbientSources(camera: AudioListener, sources: readonly AmbientSource[]) {
  const limits: Record<AmbientSource['kind'], number> = {
    shore: 2,
    water: 2,
    foliage: 4,
    birds: 2,
    wolf: 2,
    sheep: 2,
    nature: 1,
  };
  const counts = new Map<string, number>();
  const ids = new Set<string>();
  return sources
    .slice(0, 128)
    .map((source) => ({
      source,
      gain: spatialAudioMix(camera, source, ambientRadius[source.kind]).gain * (source.strength ?? 1),
    }))
    .filter(
      ({source, gain}) =>
        Number.isFinite(gain) && gain >= 0.012 && Number.isFinite(source.x) && Number.isFinite(source.z),
    )
    .sort((a, b) => b.gain - a.gain || a.source.id.localeCompare(b.source.id))
    .filter(({source}) => {
      const count = counts.get(source.kind) ?? 0;
      if (ids.has(source.id) || count >= limits[source.kind]) return false;
      counts.set(source.kind, count + 1);
      ids.add(source.id);
      return true;
    })
    .slice(0, ambientLimit)
    .map(({source}) => source);
}

export type AudioEventId =
  | 'ui.command.accepted'
  | 'ui.command.move'
  | 'ui.command.gather'
  | 'ui.command.attack'
  | 'ui.command.build'
  | 'ui.command.garrison'
  | 'ui.command.rejected'
  | 'ui.selection'
  | 'ui.alert'
  | 'ui.build.preview'
  | 'ui.build.placed'
  | 'ui.queue.added'
  | 'resource.gather'
  | 'resource.depleted'
  | 'construction.hammer'
  | 'construction.complete'
  | 'production.complete'
  | 'research.age.start'
  | 'research.age.complete'
  | 'dispatch.arrive'
  | 'combat.attack'
  | 'combat.projectile.launch'
  | 'combat.projectile.impact'
  | 'combat.destroyed'
  | 'wildlife.flee'
  | 'weather.rain'
  | 'weather.thunder'
  | 'weather.lightning'
  | 'match.victory';

export type VoiceAssetId = string;

type Tone = {frequency: number; duration: number; type?: OscillatorType; gain?: number; slide?: number};

const tones: Record<AudioEventId, Tone[]> = {
  'ui.command.accepted': [{frequency: 520, duration: 0.055, gain: 0.035}],
  'ui.command.move': [
    {frequency: 260, duration: 0.045, gain: 0.045},
    {frequency: 330, duration: 0.06, gain: 0.035},
  ],
  'ui.command.gather': [
    {frequency: 210, duration: 0.06, gain: 0.045},
    {frequency: 170, duration: 0.08, gain: 0.035},
  ],
  'ui.command.attack': [{frequency: 120, duration: 0.055, type: 'sawtooth', gain: 0.055, slide: 75}],
  'ui.command.build': [
    {frequency: 300, duration: 0.05, gain: 0.045},
    {frequency: 390, duration: 0.07, gain: 0.035},
  ],
  'ui.command.garrison': [
    {frequency: 180, duration: 0.07, gain: 0.04},
    {frequency: 240, duration: 0.09, gain: 0.03},
  ],
  'ui.command.rejected': [{frequency: 150, duration: 0.13, type: 'square', gain: 0.04, slide: 110}],
  'ui.selection': [{frequency: 360, duration: 0.045, gain: 0.025}],
  'ui.alert': [{frequency: 180, duration: 0.18, type: 'sawtooth', gain: 0.035, slide: 120}],
  'ui.build.preview': [{frequency: 240, duration: 0.04, gain: 0.02}],
  'ui.build.placed': [
    {frequency: 280, duration: 0.08, gain: 0.035},
    {frequency: 420, duration: 0.1, gain: 0.025},
  ],
  'ui.queue.added': [{frequency: 410, duration: 0.05, gain: 0.025}],
  'resource.gather': [{frequency: 210, duration: 0.08, type: 'triangle', gain: 0.025}],
  'resource.depleted': [{frequency: 110, duration: 0.2, type: 'triangle', gain: 0.03, slide: 80}],
  'construction.hammer': [{frequency: 120, duration: 0.035, type: 'square', gain: 0.025}],
  'construction.complete': [
    {frequency: 300, duration: 0.08, gain: 0.03},
    {frequency: 540, duration: 0.16, gain: 0.035},
  ],
  'production.complete': [
    {frequency: 440, duration: 0.08, gain: 0.03},
    {frequency: 660, duration: 0.12, gain: 0.025},
  ],
  'research.age.start': [
    {frequency: 180, duration: 0.12, gain: 0.03},
    {frequency: 260, duration: 0.14, gain: 0.03},
  ],
  'research.age.complete': [
    {frequency: 330, duration: 0.1, gain: 0.03},
    {frequency: 500, duration: 0.12, gain: 0.03},
    {frequency: 760, duration: 0.22, gain: 0.035},
  ],
  'dispatch.arrive': [
    {frequency: 260, duration: 0.1, gain: 0.03},
    {frequency: 390, duration: 0.12, gain: 0.03},
    {frequency: 520, duration: 0.2, gain: 0.03},
  ],
  'combat.attack': [{frequency: 90, duration: 0.06, type: 'sawtooth', gain: 0.025, slide: 70}],
  'combat.projectile.launch': [{frequency: 100, duration: 0.07, type: 'sawtooth', gain: 0.025, slide: 55}],
  'combat.projectile.impact': [{frequency: 75, duration: 0.12, type: 'square', gain: 0.035, slide: 45}],
  'combat.destroyed': [{frequency: 70, duration: 0.24, type: 'sawtooth', gain: 0.04, slide: 35}],
  'wildlife.flee': [{frequency: 240, duration: 0.08, type: 'triangle', gain: 0.025, slide: 340}],
  'weather.rain': [{frequency: 720, duration: 0.035, type: 'sine', gain: 0.012}],
  'weather.thunder': [{frequency: 48, duration: 0.35, type: 'sawtooth', gain: 0.05, slide: 30}],
  'weather.lightning': [{frequency: 180, duration: 0.08, type: 'square', gain: 0.04, slide: 90}],
  'match.victory': [
    {frequency: 392, duration: 0.12, gain: 0.035},
    {frequency: 523, duration: 0.14, gain: 0.035},
    {frequency: 784, duration: 0.28, gain: 0.04},
  ],
};

let context: AudioContext | undefined;
let master: GainNode | undefined;
let resuming = false;
const effectVoices = new Set<{
  source: AudioBufferSourceNode | OscillatorNode;
  gain: GainNode;
  pan?: StereoPannerNode;
}>();
const speechVoices = new Set<HTMLAudioElement>();
let lastPlayed = new Map<AudioEventId, number>();
const lastVoice = new Map<VoiceAssetId, number>();
const voiceCursors = new Map<VoiceAssetId, string>();
const effectCursors = new Map<AudioEventId, string>();
const effectFiles: Partial<Record<AudioEventId, string[]>> = {
  'ui.command.accepted': ['ui-command-accepted', 'ui-command-accepted_v2', 'ui-command-accepted_v3'],
  'ui.command.rejected': ['ui-command-rejected', 'ui-command-rejected_v2', 'ui-command-rejected_v3'],
  'ui.selection': ['selection', 'selection_v2', 'selection_v3'],
  'resource.gather': ['resource-gather', 'resource-gather_v2', 'resource-gather_v3'],
  'construction.hammer': ['hammer', 'hammer_v2', 'hammer_v3'],
  'construction.complete': ['construction-complete', 'construction-complete_v2', 'construction-complete_v3'],
  'production.complete': ['production-complete', 'production-complete_v2', 'production-complete_v3'],
  'combat.projectile.launch': ['projectile-launch', 'projectile-launch_v2', 'projectile-launch_v3'],
  'combat.projectile.impact': ['projectile-impact', 'projectile-impact_v2', 'projectile-impact_v3'],
  'combat.destroyed': ['destroyed', 'destroyed_v2', 'destroyed_v3'],
  'weather.thunder': ['thunder', 'thunder_v2', 'thunder_v3'],
  'match.victory': ['victory', 'victory_v2', 'victory_v3'],
};
const effectBuffers = new Map<AudioEventId, AudioBuffer[]>();
const effectLoading = new Set<AudioEventId>();

function chooseVariant(id: string, variants: string[]) {
  if (variants.length <= 1) return variants[0];
  const previous = id && (voiceCursors.get(id) ?? effectCursors.get(id as AudioEventId));
  const candidates = variants.filter((variant) => variant !== previous);
  const next = candidates[Math.floor(Math.random() * candidates.length)] ?? variants[0];
  return next;
}

function getContext() {
  if (typeof window === 'undefined') return undefined;
  if (!context) {
    const Audio =
      window.AudioContext || (window as typeof window & {webkitAudioContext: typeof AudioContext}).webkitAudioContext;
    if (!Audio) return undefined;
    context = new Audio();
    master = context.createGain();
    master.gain.value = 0.72;
    master.connect(context.destination);
  }
  if (context.state === 'suspended' && !resuming && !document.hidden) {
    resuming = true;
    void context
      .resume()
      .catch(() => undefined)
      .finally(() => {
        resuming = false;
      });
  }
  return context;
}

async function loadEffect(id: AudioEventId, ctx: AudioContext) {
  const files = effectFiles[id];
  if (!files || effectLoading.has(id) || effectBuffers.has(id)) return;
  effectLoading.add(id);
  try {
    const decoded = await Promise.all(
      files.map(async (file) => {
        const response = await fetch(`/audio/sfx/${file}.wav`);
        if (!response.ok) return undefined;
        return ctx.decodeAudioData(await response.arrayBuffer());
      }),
    );
    const buffers = decoded.filter((buffer): buffer is AudioBuffer => Boolean(buffer));
    if (buffers.length) effectBuffers.set(id, buffers);
  } catch {
    // Procedural oscillator fallback remains available when an asset is unavailable.
  } finally {
    effectLoading.delete(id);
  }
}

function connectEffect(source: AudioBufferSourceNode | OscillatorNode, gain: GainNode, position?: AudioPoint) {
  if (!context || !master) return false;
  if (effectVoices.size >= 24) return false;
  const pan = position ? context.createStereoPanner() : undefined;
  const mix = position ? spatialAudioMix(listener, position) : {gain: 1, pan: 0};
  if (mix.gain < 0.012) return false;
  gain.gain.value *= mix.gain;
  if (pan) {
    pan.pan.value = mix.pan;
    source.connect(gain).connect(pan).connect(master);
  } else source.connect(gain).connect(master);
  const voice = {source, gain, pan};
  effectVoices.add(voice);
  source.onended = () => {
    effectVoices.delete(voice);
    source.disconnect();
    gain.disconnect();
    pan?.disconnect();
  };
  return true;
}

export function playAudio(id: AudioEventId, intensity = 1, position?: AudioPoint) {
  if (typeof document === 'undefined' || document.hidden || (position && ambiencePaused)) return;
  const now = performance.now();
  const last = lastPlayed.get(id) ?? -Infinity;
  const cooldown = id.startsWith('weather.') ? 380 : id.startsWith('construction.') ? 90 : 35;
  if (now - last < cooldown) return;
  lastPlayed.set(id, now);
  const ctx = getContext();
  if (!ctx || !master) return;
  const buffers = effectBuffers.get(id);
  const buffer = buffers?.[0];
  if (buffer) {
    const fileNames = effectFiles[id] ?? [];
    const selected = chooseVariant(id, fileNames);
    const selectedIndex = Math.max(0, fileNames.indexOf(selected));
    effectCursors.set(id, selected);
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffers[selectedIndex % buffers.length] ?? buffer;
    gain.gain.value = Math.min(1.25, Math.max(0, intensity));
    if (!connectEffect(source, gain, position)) return;
    source.start();
    return;
  }
  void loadEffect(id, ctx);
  const start = ctx.currentTime;
  let offset = 0;
  for (const tone of tones[id]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const duration = tone.duration * Math.max(0.7, Math.min(1.35, intensity));
    osc.type = tone.type ?? 'triangle';
    osc.frequency.setValueAtTime(tone.frequency, start + offset);
    if (tone.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, tone.slide), start + offset + duration);
    gain.gain.value = (tone.gain ?? 0.03) * Math.min(1.4, Math.max(0, intensity));
    if (!connectEffect(osc, gain, position)) continue;
    gain.gain.setValueAtTime(gain.gain.value, start + offset);
    gain.gain.exponentialRampToValueAtTime(0.001, start + offset + duration);
    osc.start(start + offset);
    osc.stop(start + offset + duration + 0.01);
    offset += duration * 0.64;
  }
}

export function audioForSimulationEvent(kind: string, text: string) {
  const value = `${kind} ${text}`.toLowerCase();
  if (kind === 'rejected' || value.includes('cannot') || value.includes('no accessible'))
    return 'ui.command.rejected' as const;
  if (kind === 'victory' || value.includes('wins by conquest')) return 'match.victory' as const;
  if (kind === 'combat' && value.includes('destroyed')) return 'combat.destroyed' as const;
  if (kind === 'combat') return 'combat.attack' as const;
  if (kind === 'build' && value.includes('completed')) return 'construction.complete' as const;
  if (kind === 'build') return 'construction.hammer' as const;
  if (kind === 'research-complete') return 'production.complete' as const;
  if (kind === 'train') return 'production.complete' as const;
  if (kind === 'age' && value.includes('advanced')) return 'research.age.complete' as const;
  if (kind === 'age') return 'research.age.start' as const;
  if (kind === 'dispatch') return 'dispatch.arrive' as const;
  if (kind === 'gather' && value.includes('no matching')) return 'resource.depleted' as const;
  if (kind === 'gather') return 'resource.gather' as const;
  return undefined;
}

export function resetAudioThrottle() {
  lastPlayed = new Map();
  lastVoice.clear();
  voiceCursors.clear();
  effectCursors.clear();
}

export function voiceForSimulationEvent(kind: string, text: string) {
  const value = `${kind} ${text}`.toLowerCase();
  if (kind === 'victory' || value.includes('wins by conquest')) return 'victory';
  if (kind === 'build' && value.includes('completed')) return 'building_complete';
  if (kind === 'age' && value.includes('advanced'))
    return `age_${value.includes('4') ? 'industrial' : value.includes('3') ? 'medieval' : 'classical'}`;
  if (kind === 'dispatch' && value.includes('arrived')) return 'dispatch_arrived';
  if (kind === 'gather' && value.includes('no matching')) return 'worker_no_resource';
  return undefined;
}

export function playVoice(id: VoiceAssetId, volume = 0.7, position?: AudioPoint) {
  if (typeof document === 'undefined' || document.hidden || (position && ambiencePaused)) return;
  const now = performance.now();
  if (now - (lastVoice.get(id) ?? -Infinity) < 900) return;
  lastVoice.set(id, now);
  const selected = chooseVariant(id, [id, `${id}_v2`, `${id}_v3`]);
  voiceCursors.set(id, selected);
  const audio = new Audio(`/audio/voices/${selected}.wav`);
  const spatialGain = position ? spatialAudioMix(listener, position, 80).gain : 1;
  audio.volume = Math.max(0, Math.min(1, volume * spatialGain));
  if (audio.volume < 0.012) return;
  while (speechVoices.size >= 3) {
    const oldest = speechVoices.values().next().value!;
    oldest.pause();
    oldest.src = '';
    speechVoices.delete(oldest);
  }
  speechVoices.add(audio);
  audio.onended = () => speechVoices.delete(audio);
  void audio.play().catch(() => speechVoices.delete(audio));
}

type AmbientVoice = {
  source: AudioBufferSourceNode;
  gain: GainNode;
  pan?: StereoPannerNode;
  descriptor?: AmbientSource;
};
const atmosphere = new Map<string, AmbientVoice>();
const spatialAmbience = new Map<string, AmbientVoice>();
const retiringAmbience = new Set<AmbientVoice>();
const ambientBuffers = new Map<string, AudioBuffer>();
const naturalLoading = new Set<string>();
const missingAmbient = new Set<string>();
const ambientRadius: Record<AmbientSource['kind'], number> = {
  shore: 68,
  water: 36,
  foliage: 38,
  birds: 65,
  wolf: 100,
  sheep: 30,
  nature: 60,
};
const ambientFiles: Record<AmbientSource['kind'], string> = {
  shore: 'surf',
  water: 'brook',
  foliage: 'foliage',
  birds: 'birds',
  wolf: 'wolf',
  sheep: 'sheep',
  nature: 'insects',
};
let ambientCandidates: readonly AmbientSource[] = [];
let ambienceLoading: Promise<void> | undefined;
let ambienceGeneration = 0;
let currentWeather: EnvironmentWeather = 'clear';
let weatherTransition: {from: EnvironmentWeather; progress: number} | undefined;
let ambiencePaused = false;
let lastThunderCycle = -1;
let lastListenerUpdate = -Infinity;
const thunderBuffers: AudioBuffer[] = [];
const thunderSources = new Set<AudioBufferSourceNode>();
const ambienceLevels = {
  clear: {wind: 0.1, rain: 0, insects: 0.11},
  windy: {wind: 0.36, rain: 0, insects: 0.065},
  overcast: {wind: 0.18, rain: 0, insects: 0.075},
  mist: {wind: 0.045, rain: 0, insects: 0.07},
  rain: {wind: 0.2, rain: 0.3, insects: 0.01},
  storm: {wind: 0.44, rain: 0, insects: 0.005},
};
function weatherLevel(id: 'wind' | 'rain' | 'insects') {
  const to = ambienceLevels[currentWeather][id];
  if (!weatherTransition) return to;
  const from = ambienceLevels[weatherTransition.from][id];
  return from + (to - from) * weatherTransition.progress;
}
function mixAtmosphere() {
  if (!context) return;
  const heightGain = 1 / (1 + (Math.max(0, listener.y - 25) / 140) ** 2);
  for (const [id, voice] of atmosphere) {
    const level = ambiencePaused ? 0 : weatherLevel(id as 'wind' | 'rain' | 'insects') * heightGain;
    voice.gain.gain.cancelScheduledValues(context.currentTime);
    voice.gain.gain.setTargetAtTime(level, context.currentTime, ambiencePaused ? 0.15 : weatherTransition ? 0.5 : 2.2);
  }
  for (const voice of spatialAmbience.values()) mixSpatialVoice(voice);
}
function mixSpatialVoice(voice: AmbientVoice) {
  if (!context || !voice.descriptor) return;
  const source = voice.descriptor;
  const mix = spatialAudioMix(listener, source, ambientRadius[source.kind]);
  let weatherGain = 1;
  if (source.kind === 'foliage') weatherGain = 0.22 + weatherLevel('wind') * 2.5;
  if (source.kind === 'birds')
    weatherGain = Math.max(0.08, 1 - weatherLevel('rain') * 2.5 - weatherLevel('wind') * 1.4);
  if (source.kind === 'shore') weatherGain = 0.62 + weatherLevel('wind');
  const level = ambiencePaused
    ? 0
    : mix.gain *
      (source.strength ?? 1) *
      weatherGain *
      (source.kind === 'wolf' ? 0.36 : source.kind === 'birds' ? 0.28 : 0.24);
  voice.gain.gain.setTargetAtTime(level, context.currentTime, ambiencePaused ? 0.15 : 0.55);
  voice.pan?.pan.setTargetAtTime(mix.pan, context.currentTime, 0.25);
}
function disposeVoice(voice: AmbientVoice) {
  voice.source.disconnect();
  voice.gain.disconnect();
  voice.pan?.disconnect();
}
function reconcileAmbientSources() {
  const ctx = context;
  if (!ctx || !master) return;
  const desired = audibleAmbientSources(listener, ambientCandidates);
  const desiredIds = new Set(desired.map((source) => source.id));
  for (const [id, voice] of spatialAmbience) {
    if (desiredIds.has(id)) continue;
    voice.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
    voice.source.stop(ctx.currentTime + 0.6);
    spatialAmbience.delete(id);
    retiringAmbience.add(voice);
    voice.source.onended = () => {
      retiringAmbience.delete(voice);
      disposeVoice(voice);
    };
  }
  for (const descriptor of desired) {
    let voice = spatialAmbience.get(descriptor.id);
    if (!voice) {
      const buffer = ambientBuffers.get(ambientFiles[descriptor.kind]);
      if (!buffer) void loadNaturalBuffer(ambientFiles[descriptor.kind], ctx);
      // A brief crossfade can use twice the steady-state voice budget, never an unbounded node pool.
      if (!buffer || spatialAmbience.size + retiringAmbience.size >= ambientLimit * 2) continue;
      const source = ctx.createBufferSource(),
        gain = ctx.createGain(),
        pan = ctx.createStereoPanner();
      source.buffer = buffer;
      source.loop = true;
      gain.gain.value = 0;
      source.connect(gain).connect(pan).connect(master);
      source.start(0, Math.random() * buffer.duration);
      voice = {source, gain, pan, descriptor};
      spatialAmbience.set(descriptor.id, voice);
    }
    voice.descriptor = descriptor;
    mixSpatialVoice(voice);
  }
}
async function loadNaturalBuffer(id: string, ctx: AudioContext) {
  if (ambientBuffers.has(id) || naturalLoading.has(id) || missingAmbient.has(id)) return;
  naturalLoading.add(id);
  const generation = ambienceGeneration;
  try {
    const response = await fetch(`/audio/atmosphere/${id}.wav`);
    if (!response.ok) {
      if (generation === ambienceGeneration) missingAmbient.add(id);
      return;
    }
    const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
    if (generation !== ambienceGeneration) return;
    ambientBuffers.set(id, buffer);
    if (id.startsWith('thunder')) thunderBuffers.push(buffer);
    else reconcileAmbientSources();
  } catch {
    // Missing ambience is silent; required command feedback remains available.
    if (generation === ambienceGeneration) missingAmbient.add(id);
  } finally {
    if (generation === ambienceGeneration) naturalLoading.delete(id);
  }
}
/** Renderer supplies its camera, at most four times a second. No world scan or simulation writes. */
export function setAudioListener(camera: AudioListener) {
  if (![camera.x, camera.y, camera.z, camera.yaw].every(Number.isFinite)) return;
  listener = camera;
  const now = performance.now();
  if (now - lastListenerUpdate < 240) return;
  lastListenerUpdate = now;
  mixAtmosphere();
  reconcileAmbientSources();
}
/** Visibility-filtered source candidates come from snapshots, never hidden enemy or wildlife state. */
export function setAmbientSources(sources: readonly AmbientSource[]) {
  ambientCandidates = sources.slice(0, 128);
  reconcileAmbientSources();
}
async function loadAtmosphere(ctx: AudioContext) {
  const generation = ambienceGeneration;
  const decoded = await Promise.all(
    ['wind', 'rain', 'insects'].map(async (id) => {
      try {
        const response = await fetch(`/audio/atmosphere/${id}.wav`);
        if (!response.ok) return;
        return {id, buffer: await ctx.decodeAudioData(await response.arrayBuffer())};
      } catch {
        return;
      }
    }),
  );
  if (generation !== ambienceGeneration || !master) return;
  for (const sound of decoded) {
    if (!sound) continue;
    if (sound.id.startsWith('thunder')) {
      thunderBuffers.push(sound.buffer);
      continue;
    }
    ambientBuffers.set(sound.id, sound.buffer);
    if (!['wind', 'rain', 'insects'].includes(sound.id)) continue;
    const source = ctx.createBufferSource(),
      gain = ctx.createGain();
    source.buffer = sound.buffer;
    source.loop = true;
    gain.gain.value = 0;
    source.connect(gain).connect(master);
    source.start();
    atmosphere.set(sound.id, {source, gain});
  }
  mixAtmosphere();
  reconcileAmbientSources();
}
/** Cosmetic audio reads the authoritative weather clock. It never advances it. */
export function setWeatherAudio(
  weather: EnvironmentWeather,
  tick: number,
  paused = false,
  transition?: {from: EnvironmentWeather; progress: number},
) {
  if (typeof document === 'undefined') return;
  const effectivePaused = paused || document.hidden;
  const changed =
    currentWeather !== weather ||
    ambiencePaused !== effectivePaused ||
    transition?.progress !== weatherTransition?.progress;
  currentWeather = weather;
  weatherTransition = transition ? {...transition, progress: Math.max(0, Math.min(1, transition.progress))} : undefined;
  ambiencePaused = effectivePaused;
  if (ambiencePaused) {
    for (const source of thunderSources) source.stop();
    thunderSources.clear();
    for (const voice of speechVoices) voice.pause();
  }
  const ctx = getContext();
  if (!ctx || !master) return;
  if (!ambienceLoading) ambienceLoading = loadAtmosphere(ctx);
  if (weather === 'storm' && !ambiencePaused) {
    for (const id of ['thunder', 'thunder_v2', 'thunder_v3']) void loadNaturalBuffer(id, ctx);
  }
  if (changed) mixAtmosphere();
  const cycle = Math.floor(tick / 194),
    phase = tick % 194;
  if (
    !ambiencePaused &&
    weather === 'storm' &&
    (weatherTransition?.progress ?? 1) > 0.65 &&
    phase >= 14 &&
    phase <= 30 &&
    cycle !== lastThunderCycle &&
    thunderBuffers.length
  ) {
    lastThunderCycle = cycle;
    const source = ctx.createBufferSource(),
      gain = ctx.createGain();
    source.buffer = thunderBuffers[cycle % thunderBuffers.length];
    gain.gain.value = 0.32 / (1 + (listener.y / 210) ** 2);
    source.connect(gain).connect(master);
    source.start();
    thunderSources.add(source);
    source.onended = () => {
      thunderSources.delete(source);
      source.disconnect();
      gain.disconnect();
    };
  }
}
export function audioDebugState() {
  return {
    ambientVoices: spatialAmbience.size,
    retiringVoices: retiringAmbience.size,
    weatherVoices: atmosphere.size,
    effects: effectVoices.size,
    speech: speechVoices.size,
    paused: ambiencePaused,
    weather: currentWeather,
  };
}
export function stopWeatherAudio() {
  ambienceGeneration++;
  for (const source of thunderSources) source.stop();
  thunderSources.clear();
  for (const voice of [...atmosphere.values(), ...spatialAmbience.values(), ...retiringAmbience]) {
    try {
      voice.source.stop();
    } catch {
      /* Already retired source. */
    }
    disposeVoice(voice);
  }
  for (const voice of effectVoices) {
    voice.source.stop();
    voice.source.disconnect();
    voice.gain.disconnect();
    voice.pan?.disconnect();
  }
  effectVoices.clear();
  for (const voice of speechVoices) {
    voice.pause();
    voice.src = '';
  }
  speechVoices.clear();
  atmosphere.clear();
  spatialAmbience.clear();
  retiringAmbience.clear();
  ambientBuffers.clear();
  naturalLoading.clear();
  missingAmbient.clear();
  ambientCandidates = [];
  thunderBuffers.length = 0;
  ambienceLoading = undefined;
  weatherTransition = undefined;
  lastThunderCycle = -1;
  lastListenerUpdate = -Infinity;
}
