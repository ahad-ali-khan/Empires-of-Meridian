import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {expect, test} from 'vitest';

const root = resolve(process.cwd(), 'apps/web/public/audio/voices');
const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8')) as {
  assets: {id: string; file: string; sha256: string}[];
};

test('generated voice manifest is complete and content-addressed', () => {
  expect(manifest.assets.length).toBeGreaterThan(40);
  expect(new Set(manifest.assets.map((asset) => asset.id)).size).toBe(manifest.assets.length);
  for (const asset of manifest.assets) {
    expect(asset.file).toMatch(/^[a-z0-9_-]+\.wav$/);
    const data = readFileSync(resolve(root, asset.file));
    expect(data.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(data.subarray(8, 12).toString('ascii')).toBe('WAVE');
    expect(createHash('sha256').update(data).digest('hex')).toBe(asset.sha256);
  }
});
