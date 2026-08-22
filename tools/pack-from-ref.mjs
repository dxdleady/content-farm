#!/usr/bin/env node
// A whole content pack off ONE reference: its KEEP block is reused verbatim for
// every slide, while each slide brings its own REPLACE block (subject, composition,
// colour). Style stays identical across the carousel; content never repeats.
//
//   node tools/pack-from-ref.mjs <deck.json> [--dry]
import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODELS } from '../src/providers.mjs';
import { openRun } from '../src/run.ts';
import { pool } from '../src/pool.ts';
import { composePrompt } from '../src/plan.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
process.loadEnvFile(join(ROOT, '.env'));

const deckPath = resolve(process.argv[2]);
const dry = process.argv.includes('--dry');
const deck = JSON.parse(readFileSync(deckPath, 'utf8'));

const analysis = JSON.parse(readFileSync(join(ROOT, 'refs/analysis', deck.refAnalysis), 'utf8'));
const refFile = join(ROOT, 'refs/style', analysis.ref);
const model = process.env.PACK_MODEL ?? deck.model ?? 'gpt-image-2';

// Content-addressed cache: an unchanged prompt on an unchanged reference is never
// paid for twice, so editing the deck only costs the slides that actually changed.
const CACHE = join(ROOT, 'assets/generated');
mkdirSync(CACHE, { recursive: true });
const refBytes = readFileSync(join(ROOT, 'refs/style', analysis.ref));
const cacheFor = (prompt) => join(CACHE,
  `pack-${createHash('sha256').update(`${model}|${prompt}`).update(refBytes).digest('hex').slice(0, 16)}.png`);

const buildPrompt = (replace) => composePrompt(analysis.keep, replace);

const run = openRun(`pack-${analysis.name}`, {
  deck: deck.deck, ref: analysis.ref, refAnalysis: deck.refAnalysis, model,
  slides: deck.slides.length,
});
console.log(`run ${run.id}\n  ref: ${analysis.ref}\n  model: ${model} ($${MODELS[model].price}/ea)\n`);

copyFileSync(refFile, join(run.dir, 'reference.jpg'));
const prompts = [];
let spent = 0;
const CONCURRENCY = Number(process.env.PACK_CONCURRENCY || 3);

const jobs = deck.slides
  .map((s, i) => ({ s, i }))
  .filter(({ s }) => s.replace);

await pool(jobs, CONCURRENCY, async ({ s, i }) => {
  const prompt = buildPrompt(s.replace);
  const name = `${String(i + 1).padStart(2, '0')}-${s.layout}.png`;
  prompts.push({ slide: i + 1, layout: s.layout, prompt });
  if (dry) { console.log(`  [dry] ${name}`); return; }
  const cached = cacheFor(prompt);
  const p = join(run.images, name);
  if (existsSync(cached)) {
    copyFileSync(cached, p);
    s.bgFile = p;
    console.log(`  = ${name}  cached`);
    return;
  }
  const t = Date.now();
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const buf = await MODELS[model].call({ prompt, refs: [refFile] });
      writeFileSync(cached, buf);
      writeFileSync(p, buf);
      s.bgFile = p;
      spent += MODELS[model].price;
      console.log(`  ✓ ${name}  ${((Date.now() - t) / 1000).toFixed(0)}s${attempt > 1 ? ' (retry)' : ''}`);
      return;
    } catch (e) {
      if (attempt === 2) console.log(`  ✗ ${name}  ${e.message.slice(0, 110)}`);
      else await new Promise(r => setTimeout(r, 4000));
    }
  }
});
prompts.sort((a, b) => a.slide - b.slide);

writeFileSync(join(run.dir, 'prompts.json'), JSON.stringify(prompts, null, 2));
// deck with resolved bgFile paths — this is what the slide renderer consumes
const resolved = join(run.dir, 'deck.resolved.json');
writeFileSync(resolved, JSON.stringify(deck, null, 2));
run.close({ costUsd: Number(spent.toFixed(3)), images: deck.slides.filter(s => s.bgFile).length });

console.log(`\nimages -> ${run.images}   ~$${spent.toFixed(2)}`);
console.log(`render slides:\n  node src/render.mjs "${resolved}" "${run.slides}"`);
