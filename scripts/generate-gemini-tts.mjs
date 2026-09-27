#!/usr/bin/env node
import {access, mkdir, readFile, writeFile} from 'node:fs/promises';
import {basename, dirname, resolve} from 'node:path';

const keys = [1, 2, 3, 4].map((n) => process.env[`GEMINI_API_KEY${n === 1 ? '' : `_${n}`}`]).filter(Boolean);
if (!keys.length) throw new Error('Set GEMINI_API_KEY in your local environment; never commit it.');

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
const manifestPath = args.get('manifest');
const model = args.get('model') ?? 'gemini-3.8-flash-tts';
const defaultVoice = args.get('voice') ?? 'Kore';
const defaultStyle = args.get('style') ?? 'warm, clear, grounded strategy-game commander';
const skipExisting = args.has('skip-existing');
const items = manifestPath
  ? JSON.parse(await readFile(resolve(manifestPath), 'utf8'))
  : [{id: args.get('id') ?? 'sample', text: args.get('text') ?? 'Our settlement stands ready.', voice: defaultVoice, style: defaultStyle, out: args.get('out') ?? `apps/web/public/audio/voices/${args.get('id') ?? 'sample'}.wav`}];

if (!Array.isArray(items) || !items.length) throw new Error('Manifest must be a non-empty JSON array.');

async function generate(item, itemIndex) {
  if (!item?.text || !item?.out) throw new Error('Each item requires text and out.');
  if (skipExisting) {
    try {
      await access(resolve(item.out));
      console.log(`${item.id ?? basename(item.out)} -> already exists`);
      return;
    } catch {}
  }
  let response;
  let payload;
  let lastError;
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const key = keys[(itemIndex + attempt) % keys.length];
    response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: {'x-goog-api-key': key, 'content-type': 'application/json'},
      body: JSON.stringify({
        model,
        input: [{type: 'user_input', content: [{type: 'text', text: item.text, annotations: [{type: 'speech_metadata', style: item.style ?? defaultStyle}]}]}],
        response_format: {type: 'audio', mime_type: 'audio/wav', sample_rate: 24000},
        generation_config: {speech_config: [{voice: item.voice ?? defaultVoice}]},
      }),
    });
    payload = await response.json();
    if (response.ok) break;
    lastError = new Error(`Gemini TTS ${response.status}: ${JSON.stringify(payload).slice(0, 800)}`);
    if (![429, 500, 502, 503, 504].includes(response.status)) throw lastError;
    await new Promise((r) => setTimeout(r, 1200));
  }
  if (!response?.ok) throw lastError;
  const encoded =
    payload?.output_audio?.data ??
    payload?.output?.audio?.data ??
    payload?.steps?.flatMap((step) => step.content ?? []).find((content) => content.type === 'audio')?.data;
  if (!encoded) throw new Error(`Gemini TTS returned no audio: ${JSON.stringify(payload).slice(0, 800)}`);
  const out = resolve(item.out);
  await mkdir(dirname(out), {recursive: true});
  await writeFile(out, Buffer.from(encoded, 'base64'));
  console.log(`${item.id ?? basename(out)} -> ${out}`);
}

for (const [index, item] of items.entries()) await generate(item, index);
