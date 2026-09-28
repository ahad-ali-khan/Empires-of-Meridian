import {createHash} from 'node:crypto';
import {readdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const root = resolve('apps/web/public/audio/voices');
const manifestPath = resolve(root, 'manifest.json');
const previous = JSON.parse(await readFile(manifestPath, 'utf8'));
const previousById = new Map(previous.assets.map((asset) => [asset.id, asset]));
const files = (await readdir(root)).filter((file) => file.endsWith('.wav')).sort();
const assets = [];

for (const file of files) {
  const id = file.replace(/\.wav$/, '');
  const data = await readFile(resolve(root, file));
  const baseId = id.replace(/_v[23]$/, '');
  const prior = previousById.get(id) ?? previousById.get(baseId);
  assets.push({
    id,
    file,
    model: prior?.model ?? 'local-dsp-variant',
    sha256: createHash('sha256').update(data).digest('hex'),
    ...(id !== baseId ? {variantOf: baseId} : {}),
  });
}

await writeFile(
  manifestPath,
  JSON.stringify(
    {
      ...previous,
      generatedAt: new Date().toISOString().slice(0, 10),
      variantPolicy: 'Each voice cue has two alternate deliveries. The client avoids immediate repeats and selects a different variant for the next playback.',
      assets,
    },
    null,
    2,
  ) + '\n',
);
console.log(`indexed ${assets.length} voice files`);
