#!/usr/bin/env node
// Same 5 refs, same 5 briefs, every model — so the only variable is the model.
//   node tools/model-bakeoff.mjs [--models=a,b,c] [--seed=n]
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { MODELS } from '../src/providers.mjs';
import { Chrome } from '../src/chrome.mjs';
import { pool } from '../src/pool.ts';

process.loadEnvFile(join(dirname(fileURLToPath(import.meta.url)), '..', '.env'));
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REFS = join(ROOT, 'refs/style');
const OUT = join(ROOT, 'out/bakeoff');
const T = JSON.parse(readFileSync(join(ROOT, 'tokens/tokens.json'), 'utf8'));
const S = JSON.parse(readFileSync(join(ROOT, 'src/styles.json'), 'utf8'));

const arg = n => (process.argv.find(a => a.startsWith(`--${n}=`)) ?? '').split('=')[1];
const picked = (arg('models') ?? 'flux2-flash,qwen-edit,kontext,grok,seedream4,nano-banana').split(',');
// "full" moves subject + framing + colour; "tight" leaves the reference's own
// composition alone and only moves subject + colour.
const split = c => { const [m, brief = 'full'] = c.split(':'); return { m, brief }; };
const seed = arg('seed') ?? '11';

// Not "a person doing a podcast thing" — that reads as stock however it is rendered.
// These stay about voice, listening and attention, but arrive at it sideways,
// the way the reference board does.
const SUBJECTS = [
  'a mouth opened so wide it stops reading as a mouth and becomes an architectural opening',
  'a single head with a second, smaller head growing out of its ear, both mid-speech',
  'a figure buried to the neck in a nest of tangled audio cable, calm about it',
  'a person wearing a speaker cone over the face like a mask, hands at their sides',
  'a throat lit from the inside so the neck glows through the skin',
];

const rng = s => { const h = createHash('sha256').update(String(s)).digest(); let i = 0; return () => h[(i = (i + 5) % h.length)] / 255; };
const pick = (l, r) => l[Math.floor(r() * l.length) % l.length];
const shuffle = (a, r) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const prompt = ({ subject, framing, colorName, color }, brief = 'full') => [
  "Keep this image's exact rendering style: the same medium, engine, texture, grain,",
  'contrast, edge quality and level of polish. Do not clean it up or modernise it.',
  '',
  ...(brief === 'tight'
    ? ['KEEP THE COMPOSITION AS IT IS: the same crop, camera angle, subject placement,',
       'scale and negative space as this image. Only what is depicted changes.']
    : [`Change the framing to: ${framing}.`]),
  `Change the subject to: ${subject}.`,
  `Change the dominant colour to ${colorName} (${color}) and key the whole frame to it.`,
  '',
  'CRITICAL: no text of any kind — no words, letters, numerals, signage, labels, logos',
  'or watermarks, not even on objects in the scene. Any person is invented.',
].join('\n');

const files = shuffle(readdirSync(REFS).filter(f => /\.(jpe?g|png|webp)$/i.test(f)), rng(`bake|${seed}`)).slice(0, 5);
const ACCENTS = Object.entries(T.color.accent);

// one brief per ref, shared by every model
const briefs = files.map((f, i) => {
  const r = rng(`${f}|${seed}`);
  return {
    ref: f,
    subject: SUBJECTS[i % SUBJECTS.length],
    framing: [pick(S.wildcards.angle, r), pick(S.wildcards.crop, r)].join('; '),
    ...(([n, c]) => ({ colorName: n, color: c }))(pick(ACCENTS, r)),
  };
});

mkdirSync(OUT, { recursive: true });
let spent = 0;
const grid = {};

const CONCURRENCY = Number(process.env.BAKE_CONCURRENCY || 4);

for (const col of picked) {
  const { m, brief } = split(col);
  if (!MODELS[m]) { console.log(`skip unknown model ${m}`); continue; }
  grid[col] = await pool(briefs, CONCURRENCY, async (b) => {
    const t = Date.now();
    // 'full' keeps the original filename so earlier runs stay cached
    const p = join(OUT, `${m}--${brief === 'full' ? '' : brief + '--'}${b.ref.slice(0, 8)}.png`);
    if (existsSync(p)) { console.log(`  ${col.padEnd(18)} ${b.ref.slice(0, 8)}  cached`); return p; }
    try {
      const buf = await MODELS[m].call({ prompt: prompt(b, brief), refs: [join(REFS, b.ref)] });
      writeFileSync(p, buf);
      spent += MODELS[m].price;
      console.log(`  ${col.padEnd(18)} ${b.ref.slice(0, 8)}  ok  ${((Date.now() - t) / 1000).toFixed(0)}s`);
      return p;
    } catch (e) {
      console.log(`  ${col.padEnd(18)} ${b.ref.slice(0, 8)}  FAIL ${e.message.slice(0, 90)}`);
      return null;
    }
  });
}

const W = 230;
const cell = p => p ? `<img src="file://${p}" style="width:${W}px;display:block">` : `<div style="width:${W}px;height:${W * 1.25}px;background:#222"></div>`;
const html = `<!doctype html><html><body style="margin:0;background:#141414;color:#999;font:11px -apple-system">
<table style="border-collapse:collapse">
<tr><td style="padding:8px;color:#fff">REF</td>${Object.keys(grid).map(c => `<td style="padding:8px;color:#fff">${c}<br><span style="color:#666">$${MODELS[split(c).m].price}</span></td>`).join('')}</tr>
${briefs.map((b, i) => `<tr>
  <td style="padding:6px;vertical-align:top"><img src="file://${join(REFS, b.ref)}" style="width:${W}px;display:block"><div style="width:${W}px;padding-top:4px;color:${b.color}">${b.colorName}</div></td>
  ${Object.keys(grid).map(c => `<td style="padding:6px;vertical-align:top">${cell(grid[c][i])}</td>`).join('')}
</tr>`).join('')}
</table></body></html>`;
const htmlPath = join(OUT, (arg('out') ?? 'bakeoff') + '.html');
writeFileSync(htmlPath, html);

const chrome = await Chrome.launch();
try {
  const w = (Object.keys(grid).length + 1) * (W + 12) + 20;
  const h = briefs.length * (W * 1.25 + 30) + 60;
  const page = await chrome.newPage(w, Math.round(h));
  writeFileSync(join(OUT, (arg('out') ?? 'bakeoff') + '.png'), await chrome.shoot(page, `file://${htmlPath}`, w, Math.round(h)));
} finally { chrome.kill(); }

console.log(`\n${Object.keys(grid).length} columns x ${briefs.length} refs -> ${join(OUT, (arg('out') ?? 'bakeoff') + '.png')}   ~$${spent.toFixed(2)}`);
