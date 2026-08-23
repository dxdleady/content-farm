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
  asRubric, captionText, checkCaption, checkPost, checkStatus, listPosts, loadPost, postDir,
  postId, postsById, savePost, statusRank, CAPTION_MAX, POST_STATUSES, TIKTOK_TITLE_MAX,
  type Post, type PostStatus,
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

/* ------------------------------------------------------------------ the caption */
//
// The words beside the picture. These are the only fields in the model that compose never
// reads — which is exactly why they need their own checks: nothing in the render path
// would ever notice they are missing, wrong, or 400 characters too long.

const withCaption = (caption: Post['caption']): Post => ({
  id: 'c', product: 'cast', name: 'C', bucket: 'product', promise: 'p',
  rubric: null, status: 'draft',
  axes: { density: 'minimal', theme: 'light', ref: null, formats: ['ig'] },
  slides: [{ layout: 'statement', title: 'x' }, { layout: 'splash', title: 'y' }],
  caption,
});

test('captionText publishes body, a blank line, then the tags — with exactly one hash', () => {
  assert.equal(captionText({ body: 'Just the words.' }), 'Just the words.',
    'no tags means no trailing blank line');
  assert.equal(captionText({ body: 'Words.', hashtags: ['podcast', 'editing'] }),
    'Words.\n\n#podcast #editing');
  // Tolerant on the way out rather than strict on the way in: a tag the author typed with
  // a hash must not publish as "##podcast".
  assert.equal(captionText({ body: 'W.', hashtags: ['#podcast', '##x'] }), 'W.\n\n#podcast #x');
  assert.equal(captionText(undefined), '', 'an unwritten caption is the empty string, not a crash');
});

test('checkCaption names every way a caption fails to publish', () => {
  const what = (p: Post) => checkCaption(p).map(x => x.what).join(' | ');

  assert.match(what(withCaption(undefined)), /no caption/);
  assert.match(what(withCaption({ body: '   ' })), /no caption/, 'whitespace is not a caption');

  // The ceiling counts the RENDERED string — body plus the tags plus the blank line —
  // because that is what the platform receives. Counting only the body would pass a
  // caption that publishes truncated.
  const body = 'x'.repeat(CAPTION_MAX - 10);
  assert.deepEqual(checkCaption(withCaption({ body })), [], 'just under the cap is fine');
  const over = what(withCaption({ body, hashtags: ['podcasting', 'editing'] }));
  assert.match(over, new RegExp(String(CAPTION_MAX)), 'the cap is named');
  assert.match(over, /with its tags/, 'and it is clear the tags are what pushed it over');

  assert.match(what(withCaption({ body: 'ok', title: 't'.repeat(TIKTOK_TITLE_MAX + 1) })),
    /TikTok caps it at 90/);
  assert.deepEqual(checkCaption(withCaption({ body: 'ok', title: 't'.repeat(TIKTOK_TITLE_MAX) })), [],
    'exactly at the cap passes');

  // The quiet one: a space does not error at the platform, it publishes two tags.
  assert.match(what(withCaption({ body: 'ok', hashtags: ['podcast editing'] })), /would publish as two tags/);
});

test('a missing caption never blocks a render — it only blocks publishing', () => {
  // compose filters checkPost down to non-warn problems. If a caption problem arrived as
  // an error, a post with finished art and unwritten words could not be drawn at all,
  // which is backwards: the caption is written by looking at the render.
  const p = withCaption(undefined);
  assert.deepEqual(checkPost(p).filter(x => x.level !== 'warn'), []);
  assert.ok(checkPost(p).some(x => x.level === 'warn' && /no caption/.test(x.what)),
    'but it is still reported, so the studio can refuse to call the post ready');
  // And with a caption present, nothing is reported at all.
  assert.deepEqual(checkPost(withCaption({ body: 'Words.', hashtags: ['podcast'] }))
    .filter(x => /caption|hashtag|title/.test(x.what)), []);
});

/* ------------------------------------------------------------------ the lifecycle */
//
// Status is a CLAIM — "a human approved this", "this is queued at Postiz" — and a JSON
// field can claim anything. These tests are what stop the later states from being
// decoration.

const at = (status: PostStatus, extra: Partial<Post> = {}): Post => ({
  id: 's', product: 'cast', name: 'S', bucket: 'product', promise: 'p',
  rubric: null, status,
  axes: { density: 'minimal', theme: 'light', ref: null, formats: ['ig', 'tiktok'] },
  slides: [{ layout: 'statement', title: 'x' }, { layout: 'splash', title: 'y' }],
  caption: { body: 'Words.', hashtags: ['podcast'] },
  ...extra,
});

const IG = { platform: 'instagram-standalone', integrationId: 'cmt5rod', format: 'ig' as const };

test('the five statuses are a progression, not a set', () => {
  assert.deepEqual(POST_STATUSES, ['draft', 'review', 'approved', 'scheduled', 'published']);
  // The order is load-bearing: every gate below is expressed as "at least this far".
  assert.ok(statusRank('draft') < statusRank('review'));
  assert.ok(statusRank('review') < statusRank('approved'));
  assert.ok(statusRank('approved') < statusRank('scheduled'));
  assert.ok(statusRank('scheduled') < statusRank('published'));
  assert.equal(statusRank('nonsense' as PostStatus), 0, 'an unknown status is not silently the last one');
});

test('a post cannot be approved with nothing to publish beside it', () => {
  const what = (p: Post) => checkStatus(p).map(x => x.what).join(' | ');

  // The point of the caption work: approval means the WORDS are final, and a post with
  // no caption has no words. Before `approved` this is nobody's business yet.
  assert.deepEqual(checkStatus(at('draft', { caption: undefined })), []);
  assert.deepEqual(checkStatus(at('review', { caption: undefined })), []);
  assert.match(what(at('approved', { caption: undefined })), /approved, but no caption/);
  assert.match(what(at('published', { caption: undefined })), /published, but no caption/);

  assert.deepEqual(checkStatus(at('approved')), [], 'with a caption it passes');
  assert.match(what(at('unknown' as PostStatus)), /unknown status/);
});

test('scheduled and published have to name where the post actually went', () => {
  const what = (p: Post) => checkStatus(p).map(x => x.what).join(' | ');

  const bare = at('scheduled');
  assert.match(what(bare), /no publish targets/);
  assert.match(what(bare), /no scheduledFor/);

  const good = at('scheduled', { publish: { scheduledFor: '2026-09-01T09:00:00Z', targets: [IG] } });
  assert.deepEqual(checkStatus(good), []);

  assert.match(what(at('scheduled', { publish: { scheduledFor: 'soon', targets: [IG] } })),
    /is not a date/);

  // A target claiming a crop the post never rendered — the channel would have received
  // pictures that do not exist.
  assert.match(
    what(at('scheduled', { axes: { density: 'minimal', theme: 'light', ref: null, formats: ['ig'] },
      publish: { scheduledFor: '2026-09-01T09:00:00Z', targets: [{ ...IG, platform: 'tiktok-business', format: 'tiktok' }] } })),
    /not in axes.formats/);

  // Published without Postiz's own id is published and unmeasurable.
  assert.match(what(at('published', { publish: { scheduledFor: '2026-09-01T09:00:00Z', targets: [IG] } })),
    /no postId — analytics cannot find it/);
  assert.deepEqual(
    checkStatus(at('published', { publish: { scheduledFor: '2026-09-01T09:00:00Z', targets: [{ ...IG, postId: 'abc' }] } })),
    []);

  // And the reverse drift: a publish record on a post that claims not to be queued.
  assert.match(what(at('draft', { publish: { targets: [IG] } })), /one of the two is stale/);
});

test('a wrong status never blocks a render either', () => {
  // Same reasoning as the caption: compose does not read status, so refusing to draw a
  // mislabelled post would be a check punishing the wrong step.
  const p = at('published', { caption: undefined });
  assert.deepEqual(checkPost(p).filter(x => x.level !== 'warn'), []);
  assert.ok(checkPost(p).some(x => x.level === 'warn' && /published, but no caption/.test(x.what)));
});
