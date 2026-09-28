import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {expect, test} from 'vitest';

const root = resolve(process.cwd(), 'apps/web/public/audio/voices');
const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8')) as {
  assets: {id: string; file: string; sha256: string}[];
};

test('generated voice manifest is complete and content-addressed', () => {
  expect(manifest.assets.length).toBeGreaterThan(150);
  expect(new Set(manifest.assets.map((asset) => asset.id)).size).toBe(manifest.assets.length);
  for (const asset of manifest.assets) {
    expect(asset.file).toMatch(/^[a-z0-9_-]+\.wav$/);
    const data = readFileSync(resolve(root, asset.file));
    expect(data.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(data.subarray(8, 12).toString('ascii')).toBe('WAVE');
    expect(createHash('sha256').update(data).digest('hex')).toBe(asset.sha256);
  }
});

test('voice cues have alternate deliveries for non-repetitive playback', () => {
  const baseIds = manifest.assets.filter((asset) => !asset.id.match(/_v[23]$/)).map((asset) => asset.id);
  for (const id of baseIds) {
    const variants = manifest.assets.filter((asset) => asset.variantOf === id);
    expect(variants.map((asset) => asset.id)).toEqual(expect.arrayContaining([`${id}_v2`, `${id}_v3`]));
  }
});
