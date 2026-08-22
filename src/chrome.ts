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
type Waiter = { method: string; sessionId?: string; res: (params: unknown) => void };

export class Chrome {
  proc: ChildProcess;
  ws: WebSocket;
  profile: string;
  id: number;
  pending: Map<number, Pending>;
  waiters: Waiter[];

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
    const id = ++this.id;
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId && { sessionId }) }));
    });
  }

  once(method: string, sessionId?: string, timeout = 20000): Promise<unknown> {
    return new Promise((res, rej) => {
      const w: Waiter = { method, sessionId, res };
      this.waiters.push(w);
      setTimeout(() => {
        this.waiters = this.waiters.filter(x => x !== w);
        rej(new Error(`timeout waiting for ${method}`));
      }, timeout);
    });
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

  async shoot({ sessionId }: Page, fileUrl: string, width: number, height: number): Promise<Buffer> {
    const loaded = this.once('Page.loadEventFired', sessionId);
    await this.send('Page.navigate', { url: fileUrl }, sessionId);
    await loaded;
    await this.send('Runtime.evaluate',
      { expression: 'document.fonts.ready.then(()=>true)', awaitPromise: true }, sessionId);
    // one frame for layout/paint to settle
    await this.send('Runtime.evaluate', {
      expression: 'new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))',
      awaitPromise: true,
    }, sessionId);
    const { data } = await this.send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 0, y: 0, width, height, scale: 1 },
      captureBeyondViewport: true,
    }, sessionId);
    return Buffer.from(data, 'base64');
  }

  async close(page?: Page): Promise<void> {
    if (page) await this.send('Target.closeTarget', { targetId: page.targetId });
  }

  kill(): void {
    try { this.ws.close(); } catch {}
    try { this.proc.kill('SIGTERM'); } catch {}
    try { rmSync(this.profile, { recursive: true, force: true }); } catch {}
  }
}
