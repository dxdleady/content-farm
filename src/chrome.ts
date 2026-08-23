// Minimal Chrome DevTools Protocol client — one browser process for the whole run.
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BIN = process.env.CHROME_BIN
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** A CDP target plus the flat session attached to it. */
export type Page = { targetId: string; sessionId: string };

type Pending = { res: (v: unknown) => void; rej: (e: Error) => void };
// `rej` so a dying browser can fail every outstanding wait instead of leaving it parked
// until its own timeout — and, more importantly, so the death is REPORTED rather than
// showing up 20 seconds later as a generic "timeout waiting for Page.loadEventFired".
/**
 * A rejected promise that will not be reported as unhandled if nobody awaits it.
 *
 * shoot() starts `once('Page.loadEventFired')` one line before it awaits `send('navigate')`.
 * Against a dead browser the send rejects first, the function unwinds, and the `once`
 * promise is left with no awaiter — an unhandledRejection for a failure that was already
 * raised and handled through the send. The inert `.catch()` is attached to a DERIVED
 * promise, so the returned one still carries the error to any real caller.
 */
const rejected = (why: string): Promise<never> => {
  const p = Promise.reject(new Error(why));
  p.catch(() => {});
  return p;
};

type Waiter = { method: string; sessionId?: string; res: (params: unknown) => void; rej?: (e: Error) => void };

export class Chrome {
  proc: ChildProcess;
  ws: WebSocket;
  profile: string;
  id: number;
  pending: Map<number, Pending>;
  waiters: Waiter[];
  /** The target shootPooled reuses, and the canvas size it was created for. */
  private pooled: Page | null = null;
  private pooledSize = '';
  /** Set once the browser is gone; every call fails with this instead of hanging. */
  private dead: string | null = null;

  /** Whether this client still has a browser behind it. */
  get alive(): boolean { return this.dead === null; }

  static async launch(): Promise<Chrome> {
    const profile = mkdtempSync(join(tmpdir(), 'cast-chrome-'));
    const proc = spawn(BIN, [
      '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
      '--no-first-run', '--no-default-browser-check', '--disable-extensions',
      '--allow-file-access-from-files', '--force-device-scale-factor=1',
      '--disable-dev-shm-usage', '--remote-debugging-port=0',
      `--user-data-dir=${profile}`, 'about:blank',
    ], { stdio: ['ignore', 'ignore', 'ignore'] });

    const portFile = join(profile, 'DevToolsActivePort');
    let port: number | null = null;
    for (let i = 0; i < 200 && port === null; i++) {
      await sleep(50);
      if (existsSync(portFile)) {
        const txt = readFileSync(portFile, 'utf8').trim().split('\n');
        if (txt[0]) port = Number(txt[0]);
      }
    }
    if (!port) throw new Error('Chrome did not report a DevTools port');

    const info = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json() as { webSocketDebuggerUrl: string };
    const ws = new WebSocket(info.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    return new Chrome(proc, ws, profile);
  }

  constructor(proc: ChildProcess, ws: WebSocket, profile: string) {
    this.proc = proc; this.ws = ws; this.profile = profile;
    this.id = 0; this.pending = new Map(); this.waiters = [];

    // A dead browser used to be an INFINITE HANG, not an error.
    //
    // send() settles its promise only when a matching message arrives, so if the process
    // dies or the socket closes, every in-flight call waits forever and every later call
    // joins them. shootPooled's 30s deadline did not save it: the deadline covers shoot(),
    // and the recovery path it triggers — recycle() → newPage() → send() — has none, so a
    // wedged shot timed out into a permanent hang one frame deeper. Observed as a compose
    // run sitting at zero output for 21 minutes with no Chrome process left alive.
    //
    // The fix is not a longer timeout. It is noticing.
    const die = (why: string) => {
      if (this.dead) return;
      this.dead = why;
      // Drain both queues. Every entry here has a caller awaiting it — that is the whole
      // point of the queues — so these rejections are delivered, not orphaned.
      const pending = [...this.pending.values()];
      const waiters = this.waiters;
      this.pending.clear();
      this.waiters = [];
      for (const { rej } of pending) rej(new Error(why));
      for (const w of waiters) w.rej?.(new Error(why));
    };
    ws.onclose = ev => die(`chrome devtools socket closed (code ${ev.code})`);
    ws.onerror = () => die('chrome devtools socket errored');
    proc.on('exit', (code, signal) =>
      die(`chrome exited (code ${code}${signal ? `, signal ${signal}` : ''})`));

    ws.onmessage = ev => {
      const msg = JSON.parse(String(ev.data)) as
        { id?: number; error?: { message: string }; result?: unknown; method?: string; sessionId?: string; params?: unknown };
      if (msg.id && this.pending.has(msg.id)) {
        const { res, rej } = this.pending.get(msg.id)!;
        this.pending.delete(msg.id);
        msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
      } else if (msg.method) {
        this.waiters = this.waiters.filter(w => {
          if (w.method === msg.method && (!w.sessionId || w.sessionId === msg.sessionId)) {
            w.res(msg.params); return false;
          }
          return true;
        });
      }
    };
  }

  /**
   * Returns `any` on purpose. Typing the whole CDP surface is a rabbit hole with no
   * payoff here — the four call sites below immediately destructure known fields, and
   * those destructurings are where the real shapes are asserted.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  send(method: string, params: Record<string, unknown> = {}, sessionId?: string): Promise<any> {
    if (this.dead) return rejected(this.dead);
    const id = ++this.id;
    const p = new Promise<any>((res, rej) => {
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId && { sessionId }) }));
    });
    // A caller can walk away from this promise: shoot() races it against a deadline, and
    // when the deadline wins the entry stays in `pending` with nobody awaiting it. If the
    // browser then dies, die() rejects that orphan and Node reports an unhandledRejection
    // for a failure that was already handled — as a timeout — one frame up.
    //
    // Attaching an inert handler makes the rejection deliverable but harmless. It does not
    // swallow anything: .catch() returns a NEW promise, which is what gets the no-op; `p`
    // itself is still returned, so a real awaiter still sees the real error.
    p.catch(() => {});
    return p;
  }

  once(method: string, sessionId?: string, timeout = 20000): Promise<unknown> {
    if (this.dead) return rejected(this.dead);
    const p = new Promise<unknown>((res, rej) => {
      const w: Waiter = { method, sessionId, res, rej };
      this.waiters.push(w);
      setTimeout(() => {
        this.waiters = this.waiters.filter(x => x !== w);
        rej(new Error(`timeout waiting for ${method}`));
      }, timeout);
    });
    // Same orphan hazard as send(): shoot() races this against its own deadline, and the
    // loser is left parked in `waiters` with no awaiter. See the note in send().
    p.catch(() => {});
    return p;
  }

  async newPage(width: number, height: number): Promise<Page> {
    const { targetId } = await this.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await this.send('Target.attachToTarget', { targetId, flatten: true });
    await this.send('Page.enable', {}, sessionId);
    await this.send('Runtime.enable', {}, sessionId);
    await this.send('Emulation.setDeviceMetricsOverride',
      { width, height, deviceScaleFactor: 1, mobile: false }, sessionId);
    return { targetId, sessionId };
  }

  async shoot({ sessionId }: Page, fileUrl: string, width: number, height: number,
              timeoutMs = 30000): Promise<Buffer> {
    // Every step below is raced against a deadline. once() already has its own timeout,
    // but send() does not — and it is send('Page.captureScreenshot') that stops returning.
    const deadline = <T>(work: Promise<T>, what: string): Promise<T> => {
      let timer: NodeJS.Timeout;
      return Promise.race([
        work.finally(() => clearTimeout(timer)),
        new Promise<never>((_, rej) => {
          timer = setTimeout(() => rej(new Error(`timed out after ${timeoutMs}ms: ${what}`)), timeoutMs);
        }),
      ]);
    };
    const loaded = this.once('Page.loadEventFired', sessionId);
    await this.send('Page.navigate', { url: fileUrl }, sessionId);
    await loaded;
    await deadline(this.send('Runtime.evaluate',
      { expression: 'document.fonts.ready.then(()=>true)', awaitPromise: true }, sessionId), 'fonts.ready');
    // one frame for layout/paint to settle
    await deadline(this.send('Runtime.evaluate', {
      expression: 'new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))',
      awaitPromise: true,
    }, sessionId), 'paint settle');
    const { data } = await deadline(this.send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 0, y: 0, width, height, scale: 1 },
      captureBeyondViewport: true,
    }, sessionId), 'captureScreenshot');
    return Buffer.from(data, 'base64');
  }

  /**
   * Screenshot a URL, reusing a pooled target and recycling it if a shot ever wedges.
   *
   * The failure this exists for: driving many navigations of large documents through one
   * target occasionally leaves Page.captureScreenshot never returning. Nothing catches
   * it, because the load event already fired — so once()'s timeout never arms and the
   * tool hangs forever. Seen at slide 18 of 20 and at case 26 of 29.
   *
   * A fresh target per shot also avoids it, but measured 713ms/shot against 146ms for a
   * reused one — 5x, or about a minute added to a 100-slide run. So the fast path stays,
   * and the actual defect (no timeout, no recovery) is what gets fixed: a wedged shot now
   * fails after `timeoutMs`, the target is discarded, and the shot is retried once on a
   * clean one. An infinite hang becomes a hiccup.
   */
  async shootPooled(fileUrl: string, width: number, height: number, timeoutMs = 30000): Promise<Buffer> {
    const size = `${width}x${height}`;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (!this.pooled || this.pooledSize !== size) await this.recycle(width, height);
      try {
        return await this.shoot(this.pooled!, fileUrl, width, height, timeoutMs);
      } catch (e) {
        await this.recycle(width, height);
        if (attempt) throw e;
        console.warn(`  ! shot wedged, retried on a fresh target: ${(e as Error).message}`);
      }
    }
    throw new Error('unreachable');
  }

  private async recycle(width: number, height: number): Promise<void> {
    const old = this.pooled;
    this.pooled = null;
    if (old) { try { await this.close(old); } catch { /* already gone */ } }
    this.pooled = await this.newPage(width, height);
    this.pooledSize = `${width}x${height}`;
  }

  async close(page?: Page): Promise<void> {
    if (page) await this.send('Target.closeTarget', { targetId: page.targetId });
  }

  kill(): void {
    // Mark it dead FIRST. Otherwise closing the socket fires onclose/onerror, which
    // rejects whatever was still pending — and during a deliberate teardown nobody is
    // left awaiting those, so the rejections surface as unhandledRejection instead of
    // reaching a caller. A shutdown we asked for should not raise.
    this.dead ??= 'chrome was killed by this process';
    try { this.ws.close(); } catch {}
    try { this.proc.kill('SIGTERM'); } catch {}
    try { rmSync(this.profile, { recursive: true, force: true }); } catch {}
  }
}
