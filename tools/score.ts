#!/usr/bin/env node
// Score a post before it goes out.
//   node tools/score.ts --post edit-time
//   node tools/score.ts --all
//
// The idea is borrowed from a LinkedIn post-scorer skill, and so is its best rule: every
// score must cite a specific fact, never an opinion. What is NOT borrowed is that skill's
// basis — it scores against the account's own top-performing posts, and this account has
// no history yet. Inventing benchmarks would be worse than having none.
//
// So this scores against what the repo can actually measure about itself: the hook's
// length and person, how many slides are structurally incapable of teaching anything, the
// contrast ratios of the colours it will render in, and the brand's own list of claims it
// must not make. Five dimensions, ten points each.
//
// Three of the five are MEASURED and this tool decides them. Two are JUDGED — whether the
// hook promises an outcome rather than a method, and whether the deck pays what the hook
// promised — because no regex knows what a promise is. Those print as prompts rather than
// as numbers, which is the honest thing to do with a judgement a machine cannot make.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { productFromArgv } from '../src/product.ts';
import { asRubric, listPosts, loadPost, type Post } from '../src/post.ts';
import { auditContrast, nameSets, validateSlide } from '../src/validate.ts';
import type { Product, Slide } from '../src/types.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k: string): string | undefined => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};

/** Layouts that will happily hold a slogan. More than three of these is rhetoric. */
const SLOGAN = new Set(['claim', 'callout', 'poster', 'statement', 'bigQuestion', 'quote']);
/** Layouts that carry information by construction — the layout does the forcing. */
const INFORMS = new Set(['index', 'comparison', 'beforeAfter', 'steps', 'checklist',
  'dontList', 'timeline', 'statRow', 'priceTiers', 'lineChart', 'tags', 'bento', 'iconRow',
  'processVertical', 'meter', 'definition']);

/** ~11 characters a line at --t-hero 144px. See references/hooks.md. */
const linesOf = (title: string) => Math.ceil(title.replace(/\*/g, '').length / 11);

type Line = { score: number; max: number; kind: 'measured' | 'judged'; label: string; facts: string[] };

function hookScore(post: Post): Line {
  const first = post.slides[0] as { title?: string; layout?: string } | undefined;
  const title = String(first?.title ?? '');
  const bare = title.replace(/\*/g, '');
  const facts: string[] = [];
  let score = 10;

  const lines = linesOf(title);
  facts.push(`${bare.length} chars, ~${lines} lines`);
  if (bare.length > 65) { score -= 4; facts.push('OVER 65 — swamps the art; rewrite, do not trim'); }
  else if (bare.length > 55) { score -= 1; facts.push('tight — tighten the outcome, not the shape'); }

  if (/\b(you|your)\b/i.test(bare)) facts.push('second person ✓');
  else { score -= 3; facts.push('NO second person — it is about an episode, not about them'); }

  if (/^(edit|make|stop|start|try|get|use|do|cut|fix)\b/i.test(bare.trim())) {
    score -= 3; facts.push('opens on an imperative — a command, not a promise');
  }
  if (!['statement', 'bigQuestion'].includes(String(first?.layout))) {
    score -= 2; facts.push(`opens on "${first?.layout}", not a hook layout`);
  }
  return { score: Math.max(0, score), max: 10, kind: 'measured', label: 'hook', facts };
}

function densityScore(post: Post): Line {
  const layouts = post.slides.map(s => s.layout);
  const slogans = layouts.filter(l => SLOGAN.has(l)).length;
  const informs = layouts.filter(l => INFORMS.has(l)).length;
  const facts = [
    `${post.slides.length} slides`,
    `${slogans} on slogan-friendly layouts, ${informs} that carry information by construction`,
  ];
  let score = 10;
  // Hook and close are legitimately rhetorical, so the budget is three ON TOP of them.
  if (slogans > 5) { score -= 5; facts.push('more than five — this is a mood board'); }
  else if (slogans > 3) { score -= 2; facts.push('over the budget of three'); }
  if (informs < 2) { score -= 3; facts.push('fewer than two informing slides — nothing here teaches'); }
  if (post.slides.length < 5) { score -= 2; facts.push('under 5 slides — no room for a body'); }
  if (post.slides.length > 10) { score -= 3; facts.push('over 10 — Instagram will not take it'); }
  return { score: Math.max(0, score), max: 10, kind: 'measured', label: 'information', facts };
}

function readabilityScore(post: Post, p: Product): Line {
  const sets = nameSets(p);
  const rubric = asRubric(post);
  const problems = rubric.slides.flatMap((s, i) => validateSlide(p, s as Slide, `slide ${i + 1}`, sets));
  const contrast = auditContrast(p);
  const errs = contrast.filter(x => x.level !== 'warn');
  const warns = contrast.filter(x => x.level === 'warn');

  // A headline that overflows its slide is the other half of readable.
  const long = rubric.slides
    .map((s, i) => ({ i, t: String((s as { title?: string }).title ?? '').replace(/\*/g, '') }))
    .filter(x => x.t.length > 65);

  const facts = [
    `${problems.length} unresolved name(s) in copy`,
    `${errs.length} contrast error(s), ${warns.length} palette warning(s)`,
    `${long.length} headline(s) over 65 chars`,
  ];
  let score = 10;
  score -= Math.min(5, problems.length * 2);
  score -= Math.min(4, errs.length * 2);
  score -= Math.min(3, long.length);
  if (long.length) facts.push(`slides ${long.map(x => x.i + 1).join(', ')} will wrap past five lines`);
  return { score: Math.max(0, score), max: 10, kind: 'measured', label: 'readability', facts };
}

function brandScore(post: Post, p: Product): Line {
  const brief = JSON.parse(readFileSync(join(p.dir, 'brief/product.json'), 'utf8')) as
    { voice?: { avoid?: string[] } };
  const avoid = brief.voice?.avoid ?? [];
  const text = JSON.stringify(post.slides).toLowerCase();

  // Substring matching on the forbidden CLAIMS, reduced to their load-bearing words —
  // "Guaranteed brand-safe" must also catch "brand safe" in another sentence.
  const hits = avoid.filter(a => {
    const key = a.toLowerCase().replace(/^(makes your podcast|guaranteed|automatic|impossible to receive a)\s*/, '');
    return key.length > 6 && text.includes(key);
  });
  const digits = [...text.matchAll(/\b\d[\d.,]*\s*(%|x\b|hours?|minutes?|mins?)/g)].map(m => m[0]);

  const facts = [`${hits.length} voice.avoid violation(s)`, `${digits.length} figure(s) in copy`];
  if (hits.length) facts.push(`forbidden: ${hits.join('; ')}`);
  if (digits.length) facts.push(`check every figure is sourceable: ${digits.join(', ')}`);

  let score = 10;
  score -= hits.length * 5;
  return { score: Math.max(0, score), max: 10, kind: 'measured', label: 'brand truth', facts };
}

/** The two a machine must not pretend to know. */
function judged(post: Post): Line[] {
  const hook = String((post.slides[0] as { title?: string })?.title ?? '').replace(/\*/g, '');
  return [
    { score: -1, max: 10, kind: 'judged', label: 'outcome, not method', facts: [
      `hook: "${hook}"`,
      'Does it promise a RESULT the reader wants, or a technique? "without a waveform" is a',
      'technique. "get your evening back" is a result.',
    ] },
    { score: -1, max: 10, kind: 'judged', label: 'promise paid', facts: [
      'Which slide delivers what the hook promised? Name it. A number promised needs a',
      'number stated; a count promised needs exactly that many, named.',
    ] },
  ];
}

function scoreOne(post: Post, p: Product): void {
  const measured = [hookScore(post), densityScore(post), readabilityScore(post, p), brandScore(post, p)];
  const total = measured.reduce((a, l) => a + l.score, 0);
  const max = measured.reduce((a, l) => a + l.max, 0);

  console.log(`\n${'─'.repeat(72)}`);
  console.log(`  ${post.id}${' '.repeat(Math.max(1, 52 - post.id.length))}${total} / ${max}  measured`);
  console.log('─'.repeat(72));
  for (const l of measured) {
    console.log(`\n  ${l.label.padEnd(14)} ${String(l.score).padStart(2)}/${l.max}`);
    for (const f of l.facts) console.log(`      · ${f}`);
  }
  console.log(`\n  ${'┄'.repeat(68)}`);
  console.log('  JUDGED — no measurement decides these. Answer them before publishing.\n');
  for (const l of judged(post)) {
    console.log(`  ${l.label}`);
    for (const f of l.facts) console.log(`      ${f}`);
    console.log('');
  }
}

const P = productFromArgv();
const which = arg('post');

if (which) {
  scoreOne(loadPost(P, which), P);
} else if (process.argv.includes('--all')) {
  for (const x of listPosts(P)) {
    if ('error' in x) { console.log(`\n  ${x.id}: ${x.error}`); continue; }
    scoreOne(x, P);
  }
} else {
  console.error('usage: node tools/score.ts --post <id>   |   --all');
  process.exit(1);
}
void ROOT;
