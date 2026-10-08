import {mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

// Original, reproducible stereo ambience. Independent noise bands are filtered
// before layering; gusts and swell are slow envelopes, never pitched UI tones.
const sampleRate = 48000,
  root = 'apps/web/public/audio/atmosphere';
function random(seed) {
  let x = seed >>> 0;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) / 4294967296) * 2 - 1;
  };
}
function noise(length, seed, cutoff) {
  const next = random(seed),
    data = new Float32Array(length),
    coefficient = 1 - Math.exp((-2 * Math.PI * cutoff) / sampleRate);
  let low = 0;
  for (let i = -sampleRate; i < length; i++) {
    low += coefficient * (next() - low);
    if (i >= 0) data[i] = low;
  }
  return data;
}
function wav(channels) {
  const bytes = channels[0].length * 4,
    data = Buffer.alloc(bytes + 44);
  data.write('RIFF');
  data.writeUInt32LE(bytes + 36, 4);
  data.write('WAVE', 8);
  data.write('fmt ', 12);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(2, 22);
  data.writeUInt32LE(sampleRate, 24);
  data.writeUInt32LE(sampleRate * 4, 28);
  data.writeUInt16LE(4, 32);
  data.writeUInt16LE(16, 34);
  data.write('data', 36);
  data.writeUInt32LE(bytes, 40);
  for (let i = 0; i < channels[0].length; i++)
    for (let c = 0; c < 2; c++)
      data.writeInt16LE(Math.round(Math.max(-0.92, Math.min(0.92, channels[c][i])) * 32767), 44 + i * 4 + c * 2);
  return data;
}
function ambience(kind, seed) {
  const length = sampleRate * 16,
    blend = sampleRate * 2;
  const channels = [0, 1].map((c) => {
    const n = length + blend,
      bass = noise(n, seed + c * 73, kind === 'surf' ? 260 : 90),
      mid = noise(n, seed + c * 103 + 7, kind === 'rain' ? 2400 : 750),
      high = noise(n, seed + c * 199 + 13, 6500);
    const samples = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / sampleRate;
      const gust = 0.56 + 0.27 * Math.sin((t * Math.PI) / 4 + c * 0.24) + 0.12 * Math.sin(t * Math.PI * 0.875);
      const swell = Math.pow(0.5 + 0.5 * Math.sin((t * Math.PI) / 4 - c * 0.3), 1.7);
      if (kind === 'wind') samples[i] = bass[i] * 1.25 * gust + mid[i] * 0.09 * gust + (high[i] - mid[i]) * 0.013;
      if (kind === 'rain') samples[i] = mid[i] * 0.23 + (high[i] - mid[i]) * 0.075 + bass[i] * 0.2;
      if (kind === 'surf')
        samples[i] = (bass[i] * 0.72 + mid[i] * 0.19 + (high[i] - mid[i]) * 0.028) * (0.16 + swell * 0.72);
    }
    // Equal-power overlap gives a continuous non-silent loop boundary. The
    // first and final sample share the same original noise neighbourhood.
    const loop = samples.slice(blend, length + blend);
    for (let i = 0; i < blend; i++) {
      const f = i / blend,
        a = Math.cos((f * Math.PI) / 2),
        b = Math.sin((f * Math.PI) / 2);
      loop[length - blend + i] = samples[length + i] * a + samples[i] * b;
    }
    loop[length - 1] = loop[0];
    return loop;
  });
  return wav(channels);
}
function thunder(seed) {
  const n = sampleRate * 7;
  return wav(
    [0, 1].map((c) => {
      const bass = noise(n, seed + c * 113, 135),
        mid = noise(n, seed + c * 31 + 9, 1150),
        high = noise(n, seed + c * 71 + 17, 5500);
      const result = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const t = i / sampleRate,
          onset = Math.min(1, t / 0.006),
          tail = Math.min(1, (7 - t) / 0.25);
        const crack = Math.exp(-t * 18),
          rolls = Math.exp(-t * 0.7) * (0.54 + 0.2 * Math.sin(t * 6.5 + c * 0.2) + 0.14 * Math.sin(t * 13.2));
        result[i] = onset * tail * (bass[i] * 3.5 * rolls + mid[i] * 0.6 * crack + high[i] * 0.22 * crack);
      }
      return result;
    }),
  );
}
function nature(kind, seed) {
  const length = sampleRate * 16;
  return wav(
    [0, 1].map((channel) => {
      const next = random(seed + channel * 337),
        low = noise(length, seed + channel * 97, 550),
        mid = noise(length, seed + channel * 137 + 1, 2600),
        high = noise(length, seed + channel * 197 + 2, 8200),
        samples = new Float32Array(length);
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        if (kind === 'foliage') {
          const gust = 0.2 + 0.7 * Math.pow(0.5 + 0.5 * Math.sin(t * 0.7 + Math.sin(t * 1.8) * 0.4 + channel * 0.1), 2);
          samples[i] = ((high[i] - mid[i]) * 0.12 + mid[i] * 0.08 + low[i] * 0.12) * gust;
        }
        if (kind === 'brook') {
          const flow = 0.7 + 0.12 * Math.sin(t * 1.7 + channel);
          samples[i] = (mid[i] * 0.18 + (high[i] - mid[i]) * 0.065 + low[i] * 0.16) * flow;
        }
        if (kind === 'insects') {
          const pulse = Math.pow(Math.max(0, Math.sin(t * 34 + channel * 0.25)), 4),
            phrasing = Math.pow(Math.max(0, Math.sin(t * 1.4 + channel)), 2);
          samples[i] =
            Math.sin(t * Math.PI * 2 * (3550 + Math.sin(t * 0.9) * 50)) * 0.018 * pulse * phrasing +
            (high[i] - mid[i]) * 0.009;
        }
      }
      const addCall = (start, duration, base, amplitude, species = 0) => {
        let phase = 0;
        for (let i = 0; i < duration * sampleRate && i + start * sampleRate < length; i++) {
          const at = Math.floor(start * sampleRate) + i,
            t = i / sampleRate,
            f = t / duration,
            envelope = Math.sin(Math.PI * f) ** 1.5;
          let frequency = base;
          if (kind === 'birds')
            frequency = base * (1 + 0.28 * Math.sin(f * Math.PI * (species ? 3 : 1)) + 0.045 * Math.sin(t * 190));
          if (kind === 'brook') frequency = base * (1 - f * 0.5);
          if (kind === 'wolf') frequency = base * (0.7 + Math.sin(f * Math.PI) * 0.45 + 0.025 * Math.sin(t * 27));
          if (kind === 'sheep') frequency = base * (1 + 0.065 * Math.sin(t * 36) + 0.15 * Math.sin(f * Math.PI));
          phase += (Math.PI * 2 * frequency) / sampleRate;
          let vocal = Math.sin(phase) + Math.sin(phase * 2) * 0.16 + Math.sin(phase * 3) * 0.06;
          if (kind === 'wolf')
            vocal =
              Math.sin(phase) * 0.65 +
              Math.sin(phase * 2) * 0.27 +
              Math.sin(phase * 3) * 0.16 +
              Math.sin(phase * 5) * 0.08 +
              mid[at] * 0.3;
          if (kind === 'sheep')
            vocal =
              (Math.sin(phase) * 0.5 + Math.sin(phase * 3) * 0.32 + Math.sin(phase * 5) * 0.15) *
                (0.75 + 0.25 * Math.sin(t * 34)) +
              mid[at] * 0.15;
          samples[at] += vocal * amplitude * envelope;
        }
      };
      if (kind === 'birds') {
        for (let phrase = 0; phrase < 7; phrase++) {
          const start = 0.7 + phrase * 2.15 + (next() + 1) * 0.18,
            base = 1800 + (next() + 1) * 900;
          for (let note = 0; note < 2 + (phrase % 3); note++)
            addCall(start + note * 0.16, 0.09 + (next() + 1) * 0.035, base + note * 130, 0.045, phrase % 2);
        }
      }
      if (kind === 'brook')
        for (let drop = 0; drop < 60; drop++)
          addCall(0.15 + (next() + 1) * 7.65, 0.035 + (next() + 1) * 0.025, 700 + (next() + 1) * 800, 0.007);
      if (kind === 'wolf') {
        addCall(1.4 + channel * 0.08, 4.2, 240, 0.19);
        addCall(6.1 + channel * 0.06, 1.8, 290, 0.105);
      }
      if (kind === 'sheep') {
        addCall(2.2, 1.1, 215, 0.16);
        addCall(10.3 + channel * 0.08, 0.85, 240, 0.14);
      }
      // Loop endpoints fade into the continuing wind/nature bed without a click.
      for (let i = 0; i < length; i++)
        samples[i] *= Math.min(1, i / (sampleRate * 0.1), (length - i - 1) / (sampleRate * 0.1));
      let energy = 0;
      for (const sample of samples) energy += sample * sample;
      const gain = Math.max(1, 0.016 / Math.sqrt(energy / length));
      for (let i = 0; i < length; i++) samples[i] *= gain;
      return samples;
    }),
  );
}
await mkdir(root, {recursive: true});
const assets = [];
for (const [name, data] of [
  ['wind', ambience('wind', 71)],
  ['rain', ambience('rain', 93)],
  ['surf', ambience('surf', 127)],
  ['foliage', nature('foliage', 151)],
  ['brook', nature('brook', 173)],
  ['insects', nature('insects', 193)],
  ['birds', nature('birds', 211)],
  ['wolf', nature('wolf', 233)],
  ['sheep', nature('sheep', 257)],
  ['thunder', thunder(311)],
  ['thunder_v2', thunder(479)],
  ['thunder_v3', thunder(587)],
]) {
  await writeFile(`${root}/${name}.wav`, data);
  assets.push({
    id: name,
    file: `${name}.wav`,
    sha256: createHash('sha256').update(data).digest('hex'),
    loop: !name.startsWith('thunder'),
  });
}
await writeFile(
  `${root}/manifest.json`,
  JSON.stringify(
    {
      version: 2,
      source: 'Original layered noise and wildlife vocal synthesis in scripts/generate-weather-audio.mjs',
      license: 'Original project assets; same terms as repository',
      sampleRate,
      channels: 2,
      assets,
    },
    null,
    2,
  ) + '\n',
);
console.log(`Generated ${assets.length} original stereo weather and nature assets.`);
