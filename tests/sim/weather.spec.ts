import {expect, test} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {weatherAt} from '../../packages/sim/src/weather';
import {checksum, createMatch, restoreSave, serializeSave, step} from '../../packages/sim/src/index';

test('seeded fronts visit all six weather states with persistent deterministic transitions', () => {
  for (const seed of [1, 73, 90210]) {
    const states = new Set<string>();
    for (let tick = 0; tick < 22000; tick += 20) {
      const a = weatherAt(seed, tick);
      states.add(a.weather);
      expect(a).toEqual(weatherAt(seed, tick));
      expect(Number.isInteger(a.wind)).toBe(true);
    }
    expect([...states].sort()).toEqual(['clear', 'mist', 'overcast', 'rain', 'storm', 'windy']);
  }
  const s = createMatch({
    v: 1,
    seed: 73,
    mode: 'skirmish',
    difficulty: 'standard',
    aiCount: 0,
    populationCap: 100,
    gameSpeed: 1,
  });
  s.tick = 1199;
  const restored = restoreSave(serializeSave(s));
  for (let i = 0; i < 80; i++) {
    step(s, []);
    step(restored, []);
  }
  expect(checksum(s)).toBe(checksum(restored));
  expect(s.map.weather).toBe(weatherAt(73, s.tick).weather);
});

test('original ambience files are stereo 48kHz loops and long thunder variations, with valid hashes', () => {
  const root = 'apps/web/public/audio/atmosphere/',
    manifest = JSON.parse(readFileSync(root + 'manifest.json', 'utf8'));
  expect(manifest.assets).toHaveLength(6);
  for (const asset of manifest.assets) {
    const bytes = readFileSync(root + asset.file);
    expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
    expect(bytes.readUInt16LE(22)).toBe(2);
    expect(bytes.readUInt32LE(24)).toBe(48000);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256);
    expect(bytes.readUInt32LE(40) / (48000 * 4)).toBeGreaterThanOrEqual(asset.loop ? 16 : 7);
    let peak = 0,
      energy = 0;
    for (let i = 44; i < bytes.length; i += 4) {
      const value = bytes.readInt16LE(i) / 32768;
      peak = Math.max(peak, Math.abs(value));
      energy += value * value;
    }
    expect(peak).toBeLessThan(0.93);
    expect(energy / (bytes.length / 4)).toBeGreaterThan(0.0001);
  }
});
