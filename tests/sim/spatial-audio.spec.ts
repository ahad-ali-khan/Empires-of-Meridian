import {afterEach, expect, test, vi} from 'vitest';
import {audibleAmbientSources, spatialAudioMix, type AmbientSource} from '../../apps/web/src/game/audio';

const camera = {x: 0, y: 18, z: 0, yaw: 0};

test('world sounds attenuate with horizontal distance and camera zoom, while panning follows the camera', () => {
  const nearby = spatialAudioMix(camera, {x: 10, z: 0});
  expect(nearby.gain).toBeGreaterThan(spatialAudioMix(camera, {x: 180, z: 0}).gain);
  expect(nearby.gain).toBeGreaterThan(spatialAudioMix({...camera, y: 180}, {x: 10, z: 0}).gain);
  expect(nearby.pan).toBeGreaterThan(0);
  expect(spatialAudioMix(camera, {x: -10, z: 0}).pan).toBeLessThan(0);
  expect(spatialAudioMix({...camera, yaw: Math.PI}, {x: 10, z: 0}).pan).toBeLessThan(0);
  expect(spatialAudioMix(camera, {x: 10000, z: 0}).gain).toBe(0);
});

test('natural ambience stays within a nearest-source budget without letting a forest monopolize it', () => {
  const forest: AmbientSource[] = Array.from({length: 100}, (_, i) => ({id: `tree:${i}`, kind: 'foliage', x: i, z: 2}));
  const special: AmbientSource[] = [
    {id: 'shore', kind: 'shore', x: 12, z: 0},
    {id: 'birds', kind: 'birds', x: 8, z: 3},
    {id: 'wolf', kind: 'wolf', x: 20, z: 15},
    {id: 'brook', kind: 'water', x: 14, z: 2},
    {id: 'sheep', kind: 'sheep', x: 5, z: 3},
  ];
  const selected = audibleAmbientSources(camera, [...forest, ...special, special[0]]);
  expect(selected.length).toBeLessThanOrEqual(12);
  expect(selected.filter((source) => source.kind === 'foliage')).toHaveLength(4);
  expect(new Set(selected.map((source) => source.id)).size).toBe(selected.length);
  expect(selected).toEqual(expect.arrayContaining(special));
  expect(audibleAmbientSources(camera, [{id: 'bad', kind: 'shore', x: NaN, z: 0}])).toHaveLength(0);
});

afterEach(() => vi.unstubAllGlobals());

test('audio sources remain bounded after camera/source changes and all nodes stop on leaving a match', async () => {
  vi.resetModules();
  const fetched: string[] = [];
  const nodes: {stopped: boolean; disconnected: boolean}[] = [];
  const param = () => ({
    value: 0,
    cancelScheduledValues() {},
    setTargetAtTime(value: number) {
      this.value = value;
    },
    setValueAtTime(value: number) {
      this.value = value;
    },
    exponentialRampToValueAtTime() {},
  });
  const node = () => {
    const value = {
      stopped: false,
      disconnected: false,
      onended: undefined as (() => void) | undefined,
      connect(target: unknown) {
        return target;
      },
      disconnect() {
        value.disconnected = true;
      },
      stop() {
        value.stopped = true;
      },
      start() {},
    };
    nodes.push(value);
    return value;
  };
  class FakeContext {
    state = 'running';
    currentTime = 0;
    destination = {};
    createGain() {
      return {...node(), gain: param()};
    }
    createStereoPanner() {
      return {...node(), pan: param()};
    }
    createBufferSource() {
      return {...node(), buffer: undefined, loop: false};
    }
    createOscillator() {
      return {...node(), frequency: param()};
    }
    decodeAudioData() {
      return Promise.resolve({duration: 16});
    }
  }
  vi.stubGlobal('window', {AudioContext: FakeContext});
  vi.stubGlobal('document', {hidden: false});
  vi.stubGlobal('fetch', (url: string) => {
    fetched.push(url);
    return Promise.resolve({ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))});
  });
  const audio = await import('../../apps/web/src/game/audio');
  audio.setAudioListener(camera);
  audio.setAmbientSources(
    Array.from({length: 100}, (_, i) => ({id: `source:${i}`, kind: i % 2 ? 'shore' : 'foliage', x: i, z: 5})),
  );
  audio.setWeatherAudio('clear', 0);
  await vi.waitFor(() => expect(audio.audioDebugState().weatherVoices).toBe(3));
  await vi.waitFor(() => expect(audio.audioDebugState().ambientVoices).toBeGreaterThan(0));
  expect(fetched).not.toContain('/audio/atmosphere/wolf.wav');
  expect(fetched).not.toContain('/audio/atmosphere/sheep.wav');
  expect(audio.audioDebugState().ambientVoices).toBeLessThanOrEqual(12);
  for (let i = 0; i < 20; i++) audio.setAmbientSources([{id: `moving:${i}`, kind: 'birds', x: 1, z: 2}]);
  expect(audio.audioDebugState().ambientVoices + audio.audioDebugState().retiringVoices).toBeLessThanOrEqual(24);
  audio.playAudio('combat.attack', 1, {x: 10, z: 0});
  expect(audio.audioDebugState().effects).toBeGreaterThan(0);
  audio.setWeatherAudio('storm', 220, true);
  expect(audio.audioDebugState().paused).toBe(true);
  audio.stopWeatherAudio();
  expect(audio.audioDebugState()).toMatchObject({
    ambientVoices: 0,
    retiringVoices: 0,
    weatherVoices: 0,
    effects: 0,
    speech: 0,
  });
  // Sources and gains have been explicitly disconnected, not retained by the master bus.
  expect(nodes.filter((value) => value.stopped).length).toBeGreaterThan(3);
  expect(nodes.filter((value) => value.disconnected).length).toBeGreaterThan(6);
});
