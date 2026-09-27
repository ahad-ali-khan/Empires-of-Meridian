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

type Tone = {frequency: number; duration: number; type?: OscillatorType; gain?: number; slide?: number};

const tones: Record<AudioEventId, Tone[]> = {
  'ui.command.accepted': [{frequency: 520, duration: 0.055, gain: 0.035}],
  'ui.command.move': [{frequency: 260, duration: 0.045, gain: 0.045}, {frequency: 330, duration: 0.06, gain: 0.035}],
  'ui.command.gather': [{frequency: 210, duration: 0.06, gain: 0.045}, {frequency: 170, duration: 0.08, gain: 0.035}],
  'ui.command.attack': [{frequency: 120, duration: 0.055, type: 'sawtooth', gain: 0.055, slide: 75}],
  'ui.command.build': [{frequency: 300, duration: 0.05, gain: 0.045}, {frequency: 390, duration: 0.07, gain: 0.035}],
  'ui.command.garrison': [{frequency: 180, duration: 0.07, gain: 0.04}, {frequency: 240, duration: 0.09, gain: 0.03}],
  'ui.command.rejected': [{frequency: 150, duration: 0.13, type: 'square', gain: 0.04, slide: 110}],
  'ui.selection': [{frequency: 360, duration: 0.045, gain: 0.025}],
  'ui.alert': [{frequency: 180, duration: 0.18, type: 'sawtooth', gain: 0.035, slide: 120}],
  'ui.build.preview': [{frequency: 240, duration: 0.04, gain: 0.02}],
  'ui.build.placed': [{frequency: 280, duration: 0.08, gain: 0.035}, {frequency: 420, duration: 0.1, gain: 0.025}],
  'ui.queue.added': [{frequency: 410, duration: 0.05, gain: 0.025}],
  'resource.gather': [{frequency: 210, duration: 0.08, type: 'triangle', gain: 0.025}],
  'resource.depleted': [{frequency: 110, duration: 0.2, type: 'triangle', gain: 0.03, slide: 80}],
  'construction.hammer': [{frequency: 120, duration: 0.035, type: 'square', gain: 0.025}],
  'construction.complete': [{frequency: 300, duration: 0.08, gain: 0.03}, {frequency: 540, duration: 0.16, gain: 0.035}],
  'production.complete': [{frequency: 440, duration: 0.08, gain: 0.03}, {frequency: 660, duration: 0.12, gain: 0.025}],
  'research.age.start': [{frequency: 180, duration: 0.12, gain: 0.03}, {frequency: 260, duration: 0.14, gain: 0.03}],
  'research.age.complete': [{frequency: 330, duration: 0.1, gain: 0.03}, {frequency: 500, duration: 0.12, gain: 0.03}, {frequency: 760, duration: 0.22, gain: 0.035}],
  'dispatch.arrive': [{frequency: 260, duration: 0.1, gain: 0.03}, {frequency: 390, duration: 0.12, gain: 0.03}, {frequency: 520, duration: 0.2, gain: 0.03}],
  'combat.attack': [{frequency: 90, duration: 0.06, type: 'sawtooth', gain: 0.025, slide: 70}],
  'combat.projectile.launch': [{frequency: 100, duration: 0.07, type: 'sawtooth', gain: 0.025, slide: 55}],
  'combat.projectile.impact': [{frequency: 75, duration: 0.12, type: 'square', gain: 0.035, slide: 45}],
  'combat.destroyed': [{frequency: 70, duration: 0.24, type: 'sawtooth', gain: 0.04, slide: 35}],
  'wildlife.flee': [{frequency: 240, duration: 0.08, type: 'triangle', gain: 0.025, slide: 340}],
  'weather.rain': [{frequency: 720, duration: 0.035, type: 'sine', gain: 0.012}],
  'weather.thunder': [{frequency: 48, duration: 0.35, type: 'sawtooth', gain: 0.05, slide: 30}],
  'weather.lightning': [{frequency: 180, duration: 0.08, type: 'square', gain: 0.04, slide: 90}],
  'match.victory': [{frequency: 392, duration: 0.12, gain: 0.035}, {frequency: 523, duration: 0.14, gain: 0.035}, {frequency: 784, duration: 0.28, gain: 0.04}],
};

let context: AudioContext | undefined;
let master: GainNode | undefined;
let lastPlayed = new Map<AudioEventId, number>();

function getContext() {
  if (typeof window === 'undefined') return undefined;
  if (!context) {
    const Audio = window.AudioContext || (window as typeof window & {webkitAudioContext: typeof AudioContext}).webkitAudioContext;
    context = new Audio();
    master = context.createGain();
    master.gain.value = 0.72;
    master.connect(context.destination);
  }
  if (context.state === 'suspended') void context.resume();
  return context;
}

export function playAudio(id: AudioEventId, intensity = 1) {
  const now = performance.now();
  const last = lastPlayed.get(id) ?? -Infinity;
  const cooldown = id.startsWith('weather.') ? 380 : id.startsWith('construction.') ? 90 : 35;
  if (now - last < cooldown) return;
  lastPlayed.set(id, now);
  const ctx = getContext();
  if (!ctx || !master) return;
  const start = ctx.currentTime;
  let offset = 0;
  for (const tone of tones[id]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const duration = tone.duration * Math.max(0.7, Math.min(1.35, intensity));
    osc.type = tone.type ?? 'triangle';
    osc.frequency.setValueAtTime(tone.frequency, start + offset);
    if (tone.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, tone.slide), start + offset + duration);
    gain.gain.setValueAtTime((tone.gain ?? 0.03) * Math.min(1.4, Math.max(0.6, intensity)), start + offset);
    gain.gain.exponentialRampToValueAtTime(0.001, start + offset + duration);
    osc.connect(gain).connect(master);
    osc.start(start + offset);
    osc.stop(start + offset + duration + 0.01);
    offset += duration * 0.64;
  }
}

export function audioForSimulationEvent(kind: string, text: string) {
  const value = `${kind} ${text}`.toLowerCase();
  if (kind === 'rejected' || value.includes('cannot') || value.includes('no accessible')) return 'ui.command.rejected' as const;
  if (kind === 'victory' || value.includes('wins by conquest')) return 'match.victory' as const;
  if (kind === 'combat' && value.includes('destroyed')) return 'combat.destroyed' as const;
  if (kind === 'combat') return 'combat.attack' as const;
  if (kind === 'build' && value.includes('completed')) return 'construction.complete' as const;
  if (kind === 'build') return 'construction.hammer' as const;
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
}
