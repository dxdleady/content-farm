// Preflight: everything this repo depends on lives outside npm — the Node
// runtime, a Chrome binary and two API keys. Check all three before a run.
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
try { process.loadEnvFile(join(ROOT, '.env')); } catch { /* no .env — reported below */ }

let failed = 0;
const ok = (label, note) => console.log(`  ✓ ${label}${note ? `  ${note}` : ''}`);
const bad = (label, fix) => { failed++; console.log(`  ✗ ${label}\n      → ${fix}`); };
const warn = (label, note) => console.log(`  ! ${label}\n      → ${note}`);

console.log('\n(cast) content farm — preflight\n');

// ── Node ────────────────────────────────────────────────────────────────────
// Three separate floors, in the order they were added:
//   20.12  process.loadEnvFile
//   22.4   the global WebSocket that src/chrome.mjs drives the DevTools protocol with
//   23.6   native TypeScript type stripping, on by default — the repo runs .ts directly
const [maj] = process.versions.node.split('.').map(Number);
if (maj >= 24) ok('node', process.version);
else bad(`node ${process.version} — needs >= 24.0.0`,
  'nvm use   (honours .nvmrc; below 24 the .ts sources need --experimental-strip-types)');

if (typeof WebSocket === 'function') ok('global WebSocket');
else bad('global WebSocket missing', 'same fix: run on Node >= 24');

// Capability, not a version proxy: this is the definitive answer to "can this runtime
// execute the .ts sources without a build step".
if (process.features.typescript) ok('typescript', `native type stripping (${process.features.typescript})`);
else bad('this runtime cannot run .ts directly',
  'nvm use   (type stripping is default-on from Node 23.6; you are on ' + process.version + ')');

// ── Chrome ──────────────────────────────────────────────────────────────────
const BIN = process.env.CHROME_BIN
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
if (existsSync(BIN)) {
  let version = '';
  try { version = execFileSync(BIN, ['--version'], { encoding: 'utf8' }).trim(); } catch {}
  ok('chrome', version || BIN);
} else {
  bad(`chrome not found at ${BIN}`,
    'install Google Chrome (112+, for --headless=new) or set CHROME_BIN in .env');
}

// ── Keys ────────────────────────────────────────────────────────────────────
if (!existsSync(join(ROOT, '.env'))) warn('no .env at the project root', 'cp .env.example .env');

if (process.env.WAVESPEED_API_KEY) ok('WAVESPEED_API_KEY');
else warn('WAVESPEED_API_KEY not set', 'image-to-image backgrounds are off — https://wavespeed.ai');

if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) ok('GEMINI_API_KEY');
else warn('GEMINI_API_KEY not set',
  'text-to-image fallback is off; slides use CSS gradients — https://aistudio.google.com/apikey');

// ── Python (the icon/CSS helpers in tools/*.py — stdlib only) ───────────────
try {
  const v = execFileSync('python3', ['--version'], { encoding: 'utf8' }).trim();
  ok('python3', `${v}  (tools/*.py — stdlib only, no pip installs)`);
} catch {
  warn('python3 not found', 'only needed for tools/build_css.py and the icon helpers');
}

// ── Typecheck (optional — the only thing that needs node_modules) ───────────
try {
  const v = execFileSync('npx', ['--no-install', 'tsc', '--version'], { encoding: 'utf8' }).trim();
  ok('tsc', `${v}  (npm run typecheck)`);
} catch {
  warn('tsc not installed', 'run `npm install` — needed only for `npm run typecheck`, not to render');
}

console.log(failed
  ? `\n${failed} blocking problem(s) — renders will fail until fixed.\n`
  : '\nReady to render.\n');
process.exit(failed ? 1 : 0);
