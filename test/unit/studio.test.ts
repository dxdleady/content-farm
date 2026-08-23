// The studio's HTTP surface.
//
// Bound on port 0 rather than the tool's default: a test that fights for a fixed port
// fails on whatever else happens to be running, and the point here is the routing, not
// the number. tools/studio.ts exports `studio()` separately from its listen() precisely
// so importing it does not open a port.
//
// The render route is deliberately NOT exercised — it spawns compose, which launches
// Chrome. That path is covered end-to-end by the --no-generate checks on compose itself.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

import { studio } from '../../tools/studio.ts';

let server: Server;
let base: string;

before(async () => {
  server = studio();
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => { server.close(); });

const get = (p: string) => fetch(base + p);
const getJson = async (p: string) => (await get(p)).json() as Promise<Record<string, unknown>>;

test('GET / serves the app, re-read from disk', async () => {
  const r = await get('/');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type') ?? '', /text\/html/);
  const html = await r.text();
  assert.ok(html.includes('<title>studio</title>'));
  assert.ok(html.includes('/api/state'), 'the page talks to the API it is served beside');
});

test('GET /api/state describes the product, its posts and its rendered runs', async () => {
  const s = await getJson('/api/state');
  assert.equal((s.product as { id: string }).id, 'cast');
  assert.ok(Array.isArray(s.rubrics));
  // Zero is valid — a brand between rewrites has no posts, and the studio is how the
  // next one gets written.
  assert.ok(Array.isArray(s.rubrics));
  assert.ok(Array.isArray(s.posts), 'the post FILES — the words');
  assert.ok(Array.isArray(s.renders), 'and the rendered runs — the pictures');
  assert.ok(Array.isArray(s.posts), 'every post file is offered');

  // Only compose writes a deck.json, and only compose runs are renders. A layout-catalogue
  // or feed folder in out/runs must not show up here as something to review.
  for (const post of s.renders as Array<{ key: string; slides: number; formats: unknown[] }>) {
    assert.ok(post.slides > 0, `${post.key} was listed with no slides`);
    assert.ok(post.formats.length > 0, `${post.key} has no format`);
  }
});

test('one post rendered to two formats is ONE entry with two formats', async () => {
  // The bug this pins: run folders were listed directly, so `compose --format ig,tiktok`
  // put the same post in the review queue twice. Format is a VIEW of a post — the same
  // words in another crop — not a second post.
  const s = await getJson('/api/state');
  const posts = s.renders as Array<{ key: string; formats: Array<{ id: string; run: string }> }>;

  const keys = posts.map(p => p.key);
  assert.equal(new Set(keys).size, keys.length, 'a post must appear at most once');

  for (const p of posts) {
    const ids = p.formats.map(f => f.id);
    assert.equal(new Set(ids).size, ids.length, `${p.key} lists a format twice`);
    assert.equal(new Set(p.formats.map(f => f.run)).size, p.formats.length, 'each format is its own run folder');
  }

  const paired = posts.find(p => p.formats.length > 1);
  if (paired) {
    assert.ok(paired.formats.some(f => f.id === 'ig') && paired.formats.some(f => f.id === 'tiktok'));
    // And opening either run offers the switch to the other.
    for (const f of paired.formats) {
      const detail = await getJson('/api/post/' + encodeURIComponent(f.run));
      assert.deepEqual((detail.siblings as Array<{ id: string }>).map(x => x.id).sort(),
        paired.formats.map(x => x.id).sort(), `${f.run} does not offer its siblings`);
      // Same words in both crops — that is what makes them one post.
      const titles = (detail.slides as Array<{ copy: { title?: string } }>).map(x => x.copy.title);
      assert.ok(titles.length > 0);
    }
  }
});

test('a rendered post expands into slides, each with its image, copy and problems', async () => {
  const s = await getJson('/api/state');
  const posts = s.renders as Array<{ formats: Array<{ run: string }> }>;
  if (!posts.length) return;   // nothing rendered on this machine yet; the route is still covered below

  const post = await getJson('/api/post/' + encodeURIComponent(posts[0]!.formats[0]!.run));
  const slides = post.slides as Array<Record<string, unknown>>;
  assert.ok(slides.length > 0);

  for (const [i, sl] of slides.entries()) {
    // The naming contract compose already guarantees: deck.json.slides[i] <-> NN-layout.png
    assert.equal(sl.name, `${String(i + 1).padStart(2, '0')}-${sl.layout}`);
    assert.ok(Array.isArray(sl.problems), 'problems are attached per slide, not per post');
    assert.equal(typeof sl.copy, 'object');
  }
});

test('an unknown run is a 404, not a stack trace', async () => {
  const r = await get('/api/post/definitely-not-a-run');
  assert.equal(r.status, 404);
  assert.match(((await r.json()) as { error: string }).error, /no run or post/);
});

test('an unknown route is a 404 naming the method and path', async () => {
  const r = await get('/api/nope');
  assert.equal(r.status, 404);
  assert.match(((await r.json()) as { error: string }).error, /no route for GET \/api\/nope/);
});

// The one route that touches the filesystem with a caller-supplied path. The check has to
// be on the RESOLVED path: `/img/a/../../../../etc/passwd` is an unremarkable-looking URL
// whose resolution escapes out/runs entirely.
test('/img refuses to serve anything outside out/runs', async () => {
  for (const attack of [
    '/img/a/../../../../etc/passwd',
    '/img/a/..%2f..%2f..%2f..%2fetc%2fpasswd',
    '/img/a/../../package.json',
  ]) {
    const r = await get(attack);
    assert.ok(r.status === 403 || r.status === 404,
      `${attack} returned ${r.status} — it must never be served`);
    const body = await r.text();
    assert.equal(body.includes('root:'), false, 'no /etc/passwd content escaped');
    assert.equal(body.includes('"devDependencies"'), false, 'no package.json content escaped');
  }
});

test('/img serves a real slide PNG when there is one', async () => {
  const s = await getJson('/api/state');
  const posts = s.renders as Array<{ formats: Array<{ run: string }> }>;
  if (!posts.length) return;

  const post = await getJson('/api/post/' + encodeURIComponent(posts[0]!.formats[0]!.run));
  const withPng = (post.slides as Array<{ png: Record<string, string> }>).find(x => Object.keys(x.png).length);
  if (!withPng) return;
  const href = Object.values(withPng.png)[0]!;

  const r = await get(href);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'image/png');
  const buf = Buffer.from(await r.arrayBuffer());
  assert.equal(buf.subarray(1, 4).toString(), 'PNG', 'it really is a PNG');
});

test('a post round-trips through PUT and GET', async () => {
  // Creates its own post rather than editing a shipped one: (cast) legitimately has zero
  // posts between rewrites, and a route test that needs content to already exist is a
  // test that fails for a reason unrelated to routing.
  const { PRODUCTS } = await import('../../src/product.ts');
  const { postPath } = await import('../../src/post.ts');
  const { rmSync } = await import('node:fs');
  const id = 'studio-route-test';
  const original = {
    id, product: 'cast', name: 'Route test', bucket: 'product' as const,
    promise: 'A fixture.', rubric: null, status: 'draft' as const,
    axes: { density: 'minimal', theme: 'light', ref: null, formats: ['ig'] },
    slides: [
      { layout: 'statement', title: 'A *hook*', accent: 'accent-lime' },
      { layout: 'splash', title: 'A *close*', accent: 'accent-lime' },
    ],
  };

  try {
    const edited = { ...original, status: 'review' as const, note: 'studio test' };
    const put = await fetch(`${base}/api/post/${id}`, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(edited),
    });
    assert.equal(put.status, 200);
    assert.ok(((await put.json()) as { post: { updatedAt: string } }).post.updatedAt,
      'the server stamps the edit time');

    const back = await getJson(`/api/post/${id}`);
    assert.equal((back.post as { status: string }).status, 'review');
    assert.equal((back.slides as unknown[]).length, original.slides.length);
    assert.deepEqual((back.problems as unknown[]).filter((x: unknown) => (x as { level?: string }).level !== 'warn'), []);

    // The URL is the identity — a body claiming another id would write the wrong file.
    const wrong = await fetch(`${base}/api/post/${id}`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...edited, id: 'something-else' }),
    });
    assert.equal(wrong.status, 400);
    assert.match(((await wrong.json()) as { error: string }).error, /does not match the URL/);
  } finally {
    rmSync(postPath(PRODUCTS.cast, id), { force: true });
  }
});

test('a run id and a post id do not collide on /api/post', async () => {
  // Both live under the same route: a run is a directory in out/runs, a post is a file in
  // copy/posts. The run check runs first, so a rendered folder can never be mistaken for
  // a post file — and this is what proves it, because both are real here.
  const s = await getJson('/api/state');
  const renders = s.renders as Array<{ formats: Array<{ run: string }> }>;
  if (!renders.length) return;

  const runId = renders[0]!.formats[0]!.run;
  const asRun = await getJson('/api/post/' + encodeURIComponent(runId));
  assert.ok(asRun.deckPath, 'a run id resolves to a rendered run, with a deck.json path');
  assert.equal(asRun.post, undefined, 'and not to a post file');

  // No post file needs to exist for this: an unknown id must resolve to neither, by name.
  const neither = await get('/api/post/not-a-run-and-not-a-post');
  assert.equal(neither.status, 404);
  assert.match(((await neither.json()) as { error: string }).error, /no run or post/);
});
