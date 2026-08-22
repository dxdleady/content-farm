import { test } from 'node:test';
import assert from 'node:assert/strict';

import { pool } from '../helpers/sut.ts';

const defer = () => {
  let resolve!: (v: unknown) => void, reject!: (e: unknown) => void;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

test('results come back in INPUT order, not completion order', async () => {
  // The whole point: image jobs finish out of order but must land on the right slide.
  const gates = [defer(), defer(), defer()];
  const run = pool([0, 1, 2], 3, async (i: number) => { await gates[i]!.promise; return `r${i}`; });
  gates[2]!.resolve(null);
  gates[0]!.resolve(null);
  gates[1]!.resolve(null);
  assert.deepEqual(await run, ['r0', 'r1', 'r2']);
});

test('concurrency never exceeds the limit', async () => {
  let live = 0, peak = 0;
  await pool(Array.from({ length: 20 }, (_, i) => i), 3, async () => {
    peak = Math.max(peak, ++live);
    await new Promise(r => setTimeout(r, 1));
    live--;
  });
  assert.equal(peak, 3, `peak concurrency was ${peak}, limit was 3`);
});

test('a limit larger than the work is harmless', async () => {
  assert.deepEqual(await pool([1, 2], 10, async (n: number) => n * 2), [2, 4]);
});

test('empty input resolves to an empty array without calling the worker', async () => {
  let calls = 0;
  assert.deepEqual(await pool([], 4, async () => { calls++; }), []);
  assert.equal(calls, 0);
});

test('the worker receives the item and its index', async () => {
  const seen: Array<[unknown, number]> = [];
  await pool(['a', 'b', 'c'], 1, async (item: string, i: number) => { seen.push([item, i]); });
  assert.deepEqual(seen, [['a', 0], ['b', 1], ['c', 2]]);
});

test('a throwing worker rejects the pool', async () => {
  await assert.rejects(
    () => pool([1, 2, 3], 2, async (n: number) => { if (n === 2) throw new Error('boom'); return n; }),
    { message: 'boom' });
});

test('a synchronous worker return value is accepted', async () => {
  assert.deepEqual(await pool([1, 2], 2, ((n: number) => n + 1) as never), [2, 3]);
});
