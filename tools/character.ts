// Character pool builder.
//
//   node tools/character.ts base <product> <id>     — invent her, once
//   node tools/character.ts pool <product> <id>     — every scene off that base
//
// Two steps on purpose. The base portrait is the only frame with no reference,
// so it is the only one anybody has to art-direct by eye; once it is approved it
// becomes the fixed input for the whole pool, and every later frame is judged
// against it rather than against a description. Re-running `pool` is free where
// a frame already exists — delete the file to re-roll just that one.
import { mkdirSync, existsSync, copyFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { background, type CharacterSpec } from '../src/bgen.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** 9:16 — the UGC canvas. Slides are 1080×1920, so anything else gets cropped. */
const ASPECT = '9:16';

/**
 * The scene list IS the product decision. It is built from where a podcast
 * actually gets made and consumed — desk, kit, headphones — plus street frames,
 * because a pool shot entirely in one room reads as a set, not a life.
 * `key` becomes the filename decks reference.
 */
const SCENES: Array<{ key: string } & CharacterSpec> = [
  { key: 'mic-desk', scene: 'at a home desk behind a podcast microphone on a boom arm, laptop open beside her, ordinary flat in the background', framing: 'chest-up, camera slightly below eye level, close like a front camera', wardrobe: 'plain white tee', light: 'soft daylight from a window to her left' },
  { key: 'headphones-listen', scene: 'sitting on a sofa with over-ear headphones on, eyes half closed, listening back to a take', framing: 'head and shoulders, slight high angle', wardrobe: 'grey hoodie', light: 'flat overcast daylight' },
  { key: 'laptop-edit', scene: 'leaning over a laptop at a kitchen table, editing, mug beside the trackpad', framing: 'three-quarter from the side, waist up', wardrobe: 'oversized knit', light: 'warm late-afternoon sun across the table' },
  { key: 'earbuds-street', scene: 'walking down a city street with wired earbuds in, phone in hand, shopfronts behind her', framing: 'full body, walking toward camera, shot from across the pavement', wardrobe: 'leather jacket over a striped top', light: 'bright flat daylight' },
  { key: 'cafe-phone', scene: 'at an outdoor cafe table with a phone and one earbud in, glass of water and a cup on the table', framing: 'seated, chest-up, camera across the table', wardrobe: 'black slip top', light: 'dappled sun through an awning' },
  { key: 'desk-night', scene: 'at the same home desk late at night, only a desk lamp and the laptop lighting the room', framing: 'chest-up, close, camera slightly off-axis', wardrobe: 'plain black tee', light: 'single warm lamp, everything behind her in shadow' },
  { key: 'bedroom-mirror', scene: 'standing in front of a leaning bedroom mirror taking a selfie, headphones round her neck', framing: 'mirror selfie, full torso, phone visible', wardrobe: 'cream lounge set', light: 'morning light, curtains half drawn' },
  { key: 'park-bench', scene: 'sitting on a park bench with headphones on, trees and a path behind her', framing: 'wide, she sits small in the frame, shot from a few metres away', wardrobe: 'denim jacket', light: 'low golden sun' },
];

/**
 * The one frame with no reference. Deliberately plain: a base portrait that is
 * doing something stylish is a base portrait that fights every later scene.
 */
const BASE = [
  'A candid phone photo of one woman, mid-twenties, sitting at a home desk.',
  'Warm mid-brown skin, dark brown eyes, dark hair in two tight braids, minimal make-up,',
  'small silver hoop earrings. Plain white t-shirt. Ordinary flat behind her, slightly untidy.',
  '',
  'Shot on a phone front camera in available daylight: natural skin with visible pores and',
  'flyaway hair, mild handheld tilt, no studio lighting, no beauty filter, no portrait-mode',
  'blur. She looks directly at the camera, neutral open expression, mid-sentence.',
  '',
  'CRITICAL: no text anywhere in the image — no words, letters, numerals, signage, labels,',
  'logos or watermarks, not on clothing, screens or objects. This person is invented.',
].join('\n');

const [mode, productId = 'cast', charId = 'nia'] = process.argv.slice(2);
const DIR = join(ROOT, 'products', productId, 'ugc', 'characters', charId);
const BASE_FILE = join(DIR, 'base.png');

if (mode === 'base') {
  mkdirSync(DIR, { recursive: true });
  // No refPaths: this is the one text-to-image call in the whole flow.
  const out = await background(BASE, { aspect: ASPECT, force: true, plain: true });
  if (!out) { console.error('no image produced — check GEMINI_API_KEY'); process.exit(1); }
  copyFileSync(out, BASE_FILE);
  console.log(`base → ${BASE_FILE}`);
} else if (mode === 'pool') {
  if (!existsSync(BASE_FILE)) { console.error(`no base yet — run: node tools/character.ts base ${productId} ${charId}`); process.exit(1); }
  for (const { key, ...spec } of SCENES) {
    const dest = join(DIR, `${key}.png`);
    if (existsSync(dest)) { console.log(`  = ${key} (exists)`); continue; }
    const out = await background('', { aspect: ASPECT, character: spec, refPaths: [BASE_FILE], force: true });
    if (!out) { console.warn(`  ! ${key} failed`); continue; }
    copyFileSync(out, dest);
    console.log(`  + ${key}`);
  }
  console.log(`pool → ${DIR} (${readdirSync(DIR).length} files)`);
} else {
  console.log('usage: node tools/character.ts base|pool <product> <characterId>');
}
