import {readFile, writeFile} from 'node:fs/promises';
const base = JSON.parse(await readFile('scripts/gemini-voice-samples.json', 'utf8'));
const variants = [];
const deliveries = [
  'alternate delivery with a slightly quicker cadence and a brighter final emphasis',
  'alternate delivery with a lower, steadier cadence and a clear pause before the final phrase',
];
for (const item of base) {
  for (let i = 0; i < deliveries.length; i += 1) {
    variants.push({
      id: `${item.id}_v${i + 2}`,
      text: item.text,
      voice: item.voice,
      style: `${item.style}; ${deliveries[i]}`,
      out: item.out.replace(/\.wav$/, `_v${i + 2}.wav`),
    });
  }
}
await writeFile('scripts/gemini-voice-variants.json', JSON.stringify(variants, null, 2) + '\n');
console.log(`prepared ${variants.length} voice variants`);
