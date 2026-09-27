import {mkdir, writeFile} from 'node:fs/promises';

const rate = 24000;
const outDir = 'apps/web/public/audio/sfx';
const sounds = {
  'ui-command-accepted': {duration: 0.12, notes: [[520, 0, 0.06], [660, 0.05, 0.07]]},
  'ui-command-rejected': {duration: 0.18, notes: [[150, 0, 0.16]], noise: 0.08},
  selection: {duration: 0.09, notes: [[360, 0, 0.08]]},
  'resource-gather': {duration: 0.18, notes: [[220, 0, 0.12], [280, 0.07, 0.11]], noise: 0.12},
  hammer: {duration: 0.14, notes: [[115, 0, 0.08]], noise: 0.3},
  'construction-complete': {duration: 0.34, notes: [[300, 0, 0.1], [440, 0.08, 0.12], [620, 0.18, 0.17]]},
  'production-complete': {duration: 0.28, notes: [[440, 0, 0.08], [660, 0.08, 0.16]], noise: 0.08},
  'projectile-launch': {duration: 0.18, notes: [[100, 0, 0.16]], noise: 0.2},
  'projectile-impact': {duration: 0.24, notes: [[78, 0, 0.2]], noise: 0.42},
  destroyed: {duration: 0.42, notes: [[75, 0, 0.34]], noise: 0.5},
  thunder: {duration: 0.62, notes: [[48, 0, 0.58]], noise: 0.72},
  victory: {duration: 0.72, notes: [[392, 0, 0.18], [523, 0.16, 0.2], [784, 0.34, 0.34]]},
};

function wave({duration, notes = [], noise = 0}) {
  const count = Math.ceil(duration * rate);
  const pcm = new Int16Array(count);
  for (let i = 0; i < count; i++) {
    const t = i / rate;
    let value = 0;
    for (const [frequency, start, length] of notes) {
      if (t < start || t > start + length) continue;
      const local = t - start;
      const attack = Math.min(1, local / 0.008);
      const release = Math.min(1, (start + length - t) / 0.04);
      value += Math.sin(Math.PI * 2 * frequency * local) * attack * release * 0.42;
    }
    if (noise) value += (Math.random() * 2 - 1) * noise * Math.exp(-t * 18);
    pcm[i] = Math.max(-32767, Math.min(32767, value * 32767));
  }
  const dataSize = pcm.byteLength;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(36 + dataSize, 4); buffer.write('WAVE', 8);
  buffer.write('fmt ', 12); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24); buffer.writeUInt32LE(rate * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36); buffer.writeUInt32LE(dataSize, 40); Buffer.from(pcm.buffer).copy(buffer, 44);
  return buffer;
}

await mkdir(outDir, {recursive: true});
for (const [name, spec] of Object.entries(sounds)) await writeFile(`${outDir}/${name}.wav`, wave(spec));
console.log(`generated ${Object.keys(sounds).length} procedural effects in ${outDir}`);
