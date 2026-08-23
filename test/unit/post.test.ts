// Posts: the words, as JSON, one file per published thing.
//
// This replaces test/unit/draft.test.ts, and the change it tests is structural. A "rubric"
// used to be both the shape of a post and one specific post's copy — 23 352 characters
// across 102 slides — so `myth-vs-fact` could not be picked for a new topic, because the
// topic was already inside it. Now a post holds the words and a rubric holds only shape.
//
// The load-bearing property here is asRubric(): everything downstream was written against
// `Rubric`, and handing back that exact shape is what let the copy leave TypeScript
// without one of the 335 goldens moving.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  asRubric, checkPost, listPosts, loadPost, postDir, postId, postsById, savePost, type Post,
} from '../../src/post.ts';
import { PRODUCTS } from '../../src/product.ts';
import { rubricsFor } from '../../src/plan.ts';
import { validateCopy } from '../../src/validate.ts';
import type { Product } from '../../src/types.ts';

const CAST = PRODUCTS.cast;

test('every shipped post loads, and is what rubricsFor serves', () => {
  // Zero is legitimate — it is what a brand looks like before its first post.
  const posts = postsById(CAST);

  const rubrics = rubricsFor(CAST);
  assert.deepEqual(Object.keys(rubrics).sort(), Object.keys(posts).sort(),
    'the rubric view names exactly the posts on disk');

  for (const [id, post] of Object.entries(posts)) {
    assert.deepEqual(rubrics[id], asRubric(post), `${id} round-trips through the view`);
  }
});

test('asRubric strips review state — but never `note`, which is copy', () => {
  // The bug this pins cost twelve slides their text. `note` is a real field on callout,
  // symbolHero and footnote; the reviewer's comment is `review` precisely so the two
  // cannot collide.
  const post: Post = {
    id: 't', product: 'cast', name: 'T', bucket: 'product', promise: 'p',
    rubric: null, status: 'draft',
    axes: { density: 'minimal', theme: 'light', ref: null, formats: ['ig'] },
    slides: [{
      layout: 'callout', title: 'Keep *this*', note: 'this is copy and must survive',
      status: 'redo', review: 'this is a reviewer comment and must not',
    } as Post['slides'][number]],
  };

  const r = asRubric(post);
  const slide = r.slides[0] as Record<string, unknown>;
  assert.equal(slide.note, 'this is copy and must survive');
  assert.equal('review' in slide, false);
  assert.equal('status' in slide, false);
});

test('every shipped post still validates against the product', () => {
  assert.deepEqual(validateCopy(CAST, rubricsFor(CAST)), []);
});

test('checkPost separates what blocks a render from what only warns', () => {
  const base: Post = {
    id: 't', product: 'cast', name: 'T', bucket: 'product', promise: 'p',
    rubric: null, status: 'draft',
    axes: { density: 'minimal', theme: 'light', ref: null, formats: ['ig'] },
    slides: [],
  };
  const errs = (p: Post) => checkPost(p).filter(x => x.level !== 'warn');

  assert.ok(errs(base).some(x => /no slides/.test(x.what)));
  assert.ok(errs({ ...base, axes: { ...base.axes, formats: [] } }).some(x => /no formats/.test(x.what)));

  const eleven = { ...base, slides: Array(11).fill({ layout: 'claim', title: 'x' }) } as Post;
  assert.ok(errs(eleven).some(x => /caps a carousel at 10/.test(x.what)));

  // Under five is a judgement, not a breakage — it must not stop a render.
  const three = { ...base, slides: Array(3).fill({ layout: 'claim', title: 'x' }) } as Post;
  assert.deepEqual(errs(three), []);
  assert.ok(checkPost(three).some(x => x.level === 'warn'));
});

test('postId makes a filesystem-safe name out of a hook', () => {
  assert.equal(postId('Edit your whole episode *without* a waveform'),
    'edit-your-whole-episode-without-a-waveform');
  assert.equal(postId('Same voice. *Finished*.'), 'same-voice-finished');
  assert.equal(postId(''), '');
});

/* ------------------------------------------------------------------ storage */

// postDir() is keyed on the product ID and lives under out/, not under p.dir — so a temp
// product's files land in out/posts/<id> and the cleanup has to go there, not to the
// tmpdir. Getting this wrong leaves a stray broken.json that fails the NEXT run.
/** A post that depends on nothing being shipped — the suite must pass with zero posts. */
function samplePost(id = 'sample'): Post {
  return {
    id, product: 'cast', name: 'Sample', bucket: 'product',
    promise: 'A fixture, not a post.', rubric: null, status: 'draft',
    axes: { density: 'minimal', theme: 'light', ref: null, formats: ['ig'] },
    slides: [
      { layout: 'statement', title: 'A *hook*', accent: 'accent-lime' },
      { layout: 'claim', title: 'A *claim*', accent: 'accent-carrot' },
      { layout: 'splash', title: 'A *close*', accent: 'accent-lime' },
    ] as Post['slides'],
  };
}

function tempProduct(): { p: Product; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'studio-post-'));
  const id = `temp-${process.pid}`;
  const p = { ...CAST, id, dir } as Product;
  return {
    p,
    cleanup: () => {
      rmSync(dir, { recursive: true, force: true });
      rmSync(postDir(p), { recursive: true, force: true });
    },
  };
}

test('posts round-trip through disk, under out/ where generated things go', () => {
  const { p, cleanup } = tempProduct();
  try {
    assert.deepEqual(listPosts(p), [], 'no directory yet is not an error');

    const saved = savePost(p, samplePost(), new Date('2026-08-23T18:00:00Z'));
    assert.equal(saved.updatedAt, '2026-08-23T18:00:00.000Z');

    // out/, scoped by product — and exempted from .gitignore, because these are authored
    // words rather than build output.
    assert.ok(postDir(p).includes('out/posts'));
    assert.ok(postDir(p).endsWith(p.id), 'scoped by product so two brands cannot collide');
    assert.ok(readFileSync(join(postDir(p), 'sample.json'), 'utf8').endsWith('\n'));
    assert.deepEqual(loadPost(p, 'sample'), saved);
  } finally { cleanup(); }
});

test('a malformed post is reported, not fatal', () => {
  const { p, cleanup } = tempProduct();
  try {
    savePost(p, samplePost());
    mkdirSync(postDir(p), { recursive: true });
    writeFileSync(join(postDir(p), 'broken.json'), '{ not json');

    const all = listPosts(p);
    assert.equal(all.length, 2, 'both are listed');
    assert.ok(all.some(x => 'error' in x && x.id === 'broken'));
    assert.equal(Object.keys(postsById(p)).length, 1, 'but only the good one reaches the renderer');
  } finally { cleanup(); }
});

test('a missing post names the path it looked at', () => {
  const { p, cleanup } = tempProduct();
  try {
    assert.throws(() => loadPost(p, 'nope'), new RegExp(`no post "nope" for product "${p.id}"`));
    assert.equal(existsSync(join(postDir(p), 'nope.json')), false);
  } finally { cleanup(); }
});
