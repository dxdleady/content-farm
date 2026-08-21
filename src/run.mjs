// One run = one immutable directory with its own id. Nothing is ever overwritten,
// so any image can be traced back to the exact inputs that produced it.
import { mkdirSync, writeFileSync, rmSync, symlinkSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const RUNS = join(ROOT, 'out/runs');

/** 20260818-1432-7a3f — sortable, readable, collision-proof enough. */
export function newRunId(label = '') {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
  const tag = randomBytes(2).toString('hex');
  return [stamp, label.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, ''), tag].filter(Boolean).join('-');
}

export function openRun(label, meta = {}) {
  const id = newRunId(label);
  const dir = join(RUNS, id);
  mkdirSync(join(dir, 'images'), { recursive: true });
  mkdirSync(join(dir, 'slides'), { recursive: true });
  const state = { id, dir, meta: { id, label, startedAt: new Date().toISOString(), ...meta }, cost: 0 };
  writeFileSync(join(dir, 'meta.json'), JSON.stringify(state.meta, null, 2));
  return {
    ...state,
    images: join(dir, 'images'),
    slides: join(dir, 'slides'),
    /** Record everything needed to reproduce this run, then point `latest` here. */
    close(extra = {}) {
      const meta = { ...state.meta, finishedAt: new Date().toISOString(), ...extra };
      writeFileSync(join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
      const latest = join(RUNS, 'latest');
      try { rmSync(latest, { recursive: true, force: true }); } catch {}
      try { symlinkSync(id, latest, 'dir'); } catch {}
      return dir;
    },
  };
}

export function listRuns() {
  if (!existsSync(RUNS)) return [];
  return readdirSync(RUNS).filter(f => f !== 'latest').sort().reverse();
}
