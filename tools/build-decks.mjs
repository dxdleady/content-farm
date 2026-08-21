#!/usr/bin/env node
// Eight topics, one per analysed reference. Composition and colour follow a fixed
// rota by slide index, so a topic only has to supply its copy and eight subjects —
// the reference's KEEP block already carries the medium.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const COMPOSITION = [
  'the subject sits high and right, cropped by the top edge; the lower-left third stays quiet and empty',
  'the subject is small and pushed into the upper right; most of the frame is empty ground',
  'the subject crosses the upper half diagonally; the bottom-left stays empty',
  'elements scatter, dense in the upper right, thinning to nothing towards the lower left',
  'the subject enters from the top-right corner; the lower-left is empty',
  'the subject stands tall in the right third, cropped by the top edge; the left two thirds are empty',
  'the motif fills the frame evenly and quietly; the lower left falls into shadow',
  'centred and cropped, the lower half is empty ground',
];
/* Colour used to be a fixed rota by slide index, so every deck came out in the
   same sequence. Now it is drawn per deck, seeded on the deck name so a rebuild
   is cache-stable, with no two neighbours alike. Slides that carry chips or cards
   on top keep a dark ground — only its cast varies. */
const BRIGHT = ['hot magenta', 'deep orange-red', 'electric blue-violet', 'acid lime yellow-green',
                'hot pink', 'electric green', 'deep violet', 'burnt orange'];
const DARK = ['near-black charcoal', 'near-black with a cold blue cast',
              'near-black with a warm red cast', 'near-black with a green cast'];
const DARK_SLIDES = new Set([3, 6]);   // tags and the feature grid sit on top of the art

function seeded(str) {
  let h = 2166136261;
  for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h ^= h >>> 13; return (h >>> 0) / 4294967296; };
}

function palette(deckName) {
  const rnd = seeded(deckName);
  const bag = [...BRIGHT];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  const out = [];
  let b = 0;
  for (let i = 0; i < 8; i++) {
    if (DARK_SLIDES.has(i)) { out.push(DARK[Math.floor(rnd() * DARK.length)]); continue; }
    let c = bag[b++ % bag.length];
    if (c === out[i - 1]) c = bag[b++ % bag.length];
    out.push(c);
  }
  return out;
}

const FEATURES = [
  { title: 'Voice cleanup',   icon: 'eraser' },
  { title: 'Word cuts',       icon: 'scissors' },
  { title: 'Adaptive music',  icon: 'sound' },
  { title: 'Auto-ducking',    icon: 'sliders' },
  { title: 'Chapters',        icon: 'file' },
  { title: 'Cleared licence', icon: 'gem' },
];

const replace = (i, subject, colour) => [
  `SUBJECT: ${subject}.`,
  `COMPOSITION: ${COMPOSITION[i]}.`,
  `COLOUR: ${colour} dominant.`,
];

/** t = { deck, ref, variant, hook, stat:[v,u], trap, tagsKicker, tags, fixTitle, steps, rule, splashLine, subjects[8] } */
function build(t) {
  const s = t.subjects;
  const colours = palette(t.deck);
  const slides = [
    { layout: 'photo',     kicker: t.hookKicker, accent: 'accent-lime',   title: t.hook },
    { layout: 'stat',      kicker: t.statKicker, value: t.stat[0], unit: t.stat[1], accent: 'accent-carrot' },
    { layout: 'statement', kicker: t.trapKicker, accent: 'accent-lime',   title: t.trap },
    { layout: 'tags',      kicker: t.tagsKicker, accent: 'accent-lime',   items: t.tags },
    { layout: 'steps',     kicker: 'The fix',    accent: 'accent-carrot', title: t.fixTitle, items: t.steps },
    { layout: 'poster',    kicker: 'Rule',       accent: 'accent-purple', title: t.rule },
    { layout: 'bento',     accent: 'accent-pink', title: 'Six tools, *one* pass', items: FEATURES, variant: t.variant },
    { layout: 'splash',    accent: 'accent-lime', title: t.splashLine },
  ].map((sl, i) => ({ ...sl, replace: replace(i, s[i], colours[i]) }));

  const deck = { deck: t.deck, refAnalysis: t.ref, model: 'gpt-image-2',
                 handle: 'mubert.com/tools/cast', slides };
  writeFileSync(join(ROOT, `src/deck-${t.deck}.json`), JSON.stringify(deck, null, 2));
  return t.deck;
}

const TOPICS = JSON.parse(readFileSync(join(ROOT, 'src/topics.json'), 'utf8'));
for (const t of TOPICS) console.log('src/deck-%s.json  <- %s', build(t), t.ref.slice(0, 8));
