// Covers the wedge fix in src/chrome.ts. Lives in the png tier because it needs a real
// browser — there is nothing to assert about a deadline you have not actually raced.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Chrome } from '../../src/chrome.ts';
import { renderSlide } from '../helpers/sut.ts';
import { renderPage } from '../helpers/page.ts';
import { resolveFormat } from '../../src/formats.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const WORK = join(ROOT, 'out/test-chrome');
const ig = resolveFormat('ig');

let chrome: Chrome;
let slideUrl: string;

before(async () => {
  mkdirSync(WORK, { recursive: true });
  const f = join(WORK, 'slide.html');
  writeFileSync(f, renderPage(renderSlide({
    layout: 'claim', title: 'Wedge *test*', index: 1, total: 3, accent: 'accent-lime', minimal: true,
  } as never), ig));
  slideUrl = `file://${f}`;
  chrome = await Chrome.launch();
});

after(() => chrome?.kill());

test('shootPooled returns a PNG', async () => {
  const buf = await chrome.shootPooled(slideUrl, ig.w, ig.h);
  assert.ok(buf.length > 1000, 'suspiciously small image');
  assert.equal(buf.subarray(1, 4).toString('ascii'), 'PNG', 'not a PNG');
});

test('the pooled target is reused across shots, not recreated', async (t) => {
  // The point of pooling is speed — 146ms/shot reused against 713ms fresh — but asserting
  // on wall-clock makes a flaky test. Count target creations instead: that is the property
  // the speed follows from, and it is deterministic.
  const real = chrome.send.bind(chrome);
  let created = 0;
  t.mock.method(chrome, 'send', (method: string, params?: Record<string, unknown>, sessionId?: string) => {
    if (method === 'Target.createTarget') created++;
    return real(method, params, sessionId);
  });

  for (let i = 0; i < 5; i++) await chrome.shootPooled(slideUrl, ig.w, ig.h);
  assert.equal(created, 0, `${created} targets created for 5 shots — the pool is not being reused`);
});

test('a wedged shot times out instead of hanging forever', async (t) => {
  // The defect was that captureScreenshot could stop returning with nothing to catch it.
  // A 1ms deadline forces that path deterministically: the first attempt fails, the
  // target is recycled, the retry fails too, and the error surfaces. Before the fix this
  // call would never settle and the test runner would sit there until killed.
  const warnings: string[] = [];
  t.mock.method(console, 'warn', (m: string) => { warnings.push(String(m)); });

  await assert.rejects(
    () => chrome.shootPooled(slideUrl, ig.w, ig.h, 1),
    /timed out after 1ms/,
    'a wedge must surface as an error, not a hang');

  assert.equal(warnings.length, 1, 'the first failure should warn once and retry');
  assert.match(warnings[0]!, /retried on a fresh target/);
});

test('the pool recovers after a wedge', async () => {
  // Having just failed twice and recycled twice, a normal shot must still work.
  const buf = await chrome.shootPooled(slideUrl, ig.w, ig.h);
  assert.equal(buf.subarray(1, 4).toString('ascii'), 'PNG');
});

test('switching canvas size recycles the target', async () => {
  const tiktok = resolveFormat('tiktok');
  const a = await chrome.shootPooled(slideUrl, ig.w, ig.h);
  const b = await chrome.shootPooled(slideUrl, tiktok.w, tiktok.h);
  assert.notEqual(a.length, b.length, 'the second shot should be a different canvas');
  const c = await chrome.shootPooled(slideUrl, ig.w, ig.h);
  assert.equal(c.length, a.length, 'switching back must give the original canvas again');
});

// A browser that DIES must fail, not hang. Its own browser, because the point is to kill
// one — the shared `chrome` above has to survive for the tests around it.
//
// This is the defect a real compose run hit: headless Chrome died between two format
// passes and the client sat at zero output for 21 minutes with nothing alive behind it.
// send() settled only when a matching message arrived, so every in-flight call waited
// forever and every later call joined them. The 30s deadline on shootPooled did not save
// it — that deadline covers shoot(), while the recovery it triggers (recycle → newPage →
// send) had none, so a wedged shot timed out INTO a permanent hang one frame deeper.
//
// The lesson is in the shape of the bug, not the timeout: a client must notice that the
// thing it is talking to is gone. Adding seconds to a deadline would only have made the
// same run hang later.
test('a killed browser fails every call instead of hanging', async () => {
  const doomed = await Chrome.launch();
  try {
    // Prove it works first, so a rejection below cannot be blamed on setup.
    assert.ok((await doomed.shootPooled(slideUrl, 200, 250)).length > 0);
    assert.equal(doomed.alive, true);

    doomed.proc.kill('SIGKILL');
    for (let i = 0; i < 40 && doomed.alive; i++) await new Promise(r => setTimeout(r, 50));
    assert.equal(doomed.alive, false, 'the client must notice the process is gone');

    await assert.rejects(() => doomed.newPage(200, 250), /chrome (exited|devtools socket)/,
      'newPage is the call that had no deadline — it is what actually hung');
    await assert.rejects(() => doomed.shootPooled(slideUrl, 200, 250), /chrome (exited|devtools socket)/,
      'and the pooled path must surface the same cause rather than retrying into it');

    // SIGKILL makes the process exit and the socket error at their own pace, and the
    // socket is usually the later of the two. Stay inside the test until both have
    // landed — otherwise the runner sees async activity after the test returned and
    // fails the FILE while every assertion in it passed.
    await new Promise(r => setTimeout(r, 600));
  } finally { doomed.kill(); }
});
