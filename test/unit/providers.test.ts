// Every adapter maps one common call shape onto a vendor's own parameter names. A silent
// rename there is an API 400 at generation time, i.e. after you have already paid for the
// queue slot. The golden freezes the exact URL and request body of all 15 adapters at
// both ratios; regenerate with `UPDATE_GOLDENS=1 node --test test/unit/providers.test.ts`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MODELS } from '../helpers/sut.ts';

type ModelId = keyof typeof MODELS;
const MODEL_IDS = Object.keys(MODELS) as ModelId[];

// MODELS[name] is a union of 15 different call signatures, so TypeScript intersects their
// parameter types — and several adapters destructure `size` with no default, which makes
// it structurally REQUIRED even though every caller omits it and `size ?? SIZE[ratio]`
// handles undefined. Same class of defect as treated()'s w/h. Phase 2 declares these
// properly; until then the cast keeps the test honest about what it actually passes.
type CallArgs = { prompt: string; refs: string[]; ratio?: string };
const callAdapter = (name: ModelId, args: CallArgs) => MODELS[name].call(args as never);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const GOLDEN = join(ROOT, 'test/golden/providers.json');
const REF = join(ROOT, 'test/fixtures/tiny.png');
const RATIOS = ['4:5', '9:16'] as const;

// Pin the key inside the test rather than inheriting it: providers.mjs reads it at call
// time and throws without one, and `npm test` must not depend on a loaded .env — nor
// should the assertions below start passing/failing based on the developer's real key.
process.env.WAVESPEED_API_KEY = 'test-key';

type Call = { price: number; url: string; method?: string; headers?: Record<string, string>; body: Record<string, unknown> };

/**
 * Drive one adapter and capture the request it would have made.
 *
 * The fetch double answers the submit POST with a body carrying no job id, which makes
 * wavespeed() throw immediately. That is deliberate: it short-circuits the 1500ms poll
 * loop, so 30 adapter calls take milliseconds instead of a minute.
 */
async function capture(t: { mock: { method: typeof import('node:test').mock.method } },
                       name: ModelId, ratio: string): Promise<Call> {
  let seen: Omit<Call, 'price'> | null = null;
  t.mock.method(globalThis, 'fetch', async (url: unknown, opts: { method?: string; headers?: Record<string, string>; body?: string }) => {
    seen ??= { url: String(url), method: opts?.method, headers: opts?.headers, body: JSON.parse(opts?.body ?? '{}') };
    return { ok: true, status: 200, json: async () => ({}) };
  });
  try { await callAdapter(name, { prompt: 'P', refs: [REF], ratio }); } catch { /* expected */ }
  assert.ok(seen, `${name} @ ${ratio}: adapter made no request at all`);
  return { price: MODELS[name].price, ...(seen as Omit<Call, 'price'>) };
}

test('all 15 adapters: exact request shape at both ratios', async (t) => {
  const actual: Record<string, Call> = {};
  for (const ratio of RATIOS) {
    for (const name of MODEL_IDS) actual[`${name}|${ratio}`] = await capture(t, name, ratio);
  }

  if (process.env.UPDATE_GOLDENS) {
    writeFileSync(GOLDEN, JSON.stringify(actual, null, 2) + '\n');
    return;
  }
  const golden = JSON.parse(readFileSync(GOLDEN, 'utf8'));
  assert.deepEqual(Object.keys(actual).sort(), Object.keys(golden).sort(),
    'an adapter was added or removed');
  for (const key of Object.keys(golden)) {
    assert.deepEqual(actual[key], golden[key], `adapter drift: ${key}`);
  }
});

test('every adapter authenticates and targets the WaveSpeed v3 API', async (t) => {
  for (const name of MODEL_IDS) {
    const c = await capture(t, name, '4:5');
    assert.match(c.url, /^https:\/\/api\.wavespeed\.ai\/api\/v3\//, `${name}: unexpected host`);
    assert.equal(c.method, 'POST', name);
    assert.equal(c.headers?.authorization, 'Bearer test-key', `${name}: key not sent`);
    assert.equal(c.headers?.['content-type'], 'application/json', name);
    assert.equal(c.body.prompt ?? 'P', 'P', `${name}: prompt not forwarded`);
  }
});

test('the ratio reaches the vendor — or the adapter is documented as ignoring it', async (t) => {
  // Adapters that accept neither aspect_ratio nor size take whatever the vendor defaults
  // to. Listing them makes that a known limitation rather than a silent 4:5 fallback.
  const IGNORES_RATIO = new Set(['grok', 'uso']);

  for (const name of MODEL_IDS) {
    const a = await capture(t, name, '4:5');
    const b = await capture(t, name, '9:16');
    const differs = JSON.stringify(a.body) !== JSON.stringify(b.body);

    if (IGNORES_RATIO.has(name)) {
      assert.ok(!differs, `${name} is listed as ratio-blind but now varies — update IGNORES_RATIO`);
      continue;
    }
    assert.ok(differs, `${name}: 9:16 produced the same request as 4:5 — the ratio is being dropped`);
    const dim = (c: Call) => c.body.aspect_ratio ?? c.body.size;
    assert.notEqual(dim(a), dim(b), `${name}: neither aspect_ratio nor size changed`);
  }
});

test('4:5 request shapes are unchanged from the pre-format-axis code', async (t) => {
  // The format axis added a `ratio` parameter with '4:5' as every adapter's default.
  // Calling with NO ratio at all must still produce the original Instagram request —
  // this is what keeps assets/generated/ hitting instead of re-buying every image.
  for (const name of MODEL_IDS) {
    const withRatio = await capture(t, name, '4:5');
    let seen: Record<string, unknown> | null = null;
    t.mock.method(globalThis, 'fetch', async (_u: unknown, o: { body?: string }) => {
      seen ??= JSON.parse(o?.body ?? '{}');
      return { ok: true, status: 200, json: async () => ({}) };
    });
    try { await callAdapter(name, { prompt: 'P', refs: [REF] }); } catch { /* expected */ }
    assert.deepEqual(seen, withRatio.body, `${name}: omitting ratio no longer means 4:5`);
  }
});
