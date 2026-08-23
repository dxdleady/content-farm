// Does this Node run the repo at all? Answered BEFORE anything tries to import a .ts file.
//
// Deliberately .mjs, not .ts. Every other tool here is TypeScript, run directly by Node's
// native type stripping — which means that on a Node without it, every tool dies at module
// resolution with:
//
//     TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".ts"
//
// That error names the symptom and nothing else: not the required version, not that a
// .nvmrc is sitting right there, not what to type. And it took `npm run doctor` down with
// it — the one tool whose whole job is to diagnose this could not run on the machine that
// needed diagnosing. A check that cannot execute when it is wrong is not a check.
//
// So this file uses no syntax newer than Node 12 and imports nothing from src/.
const REQUIRED = 24;

const major = Number(process.versions.node.split('.')[0]);
const strips = process.features.typescript === 'strip';

if (strips) process.exit(0);

const bar = '─'.repeat(64);
console.error(`\n${bar}`);
console.error(`  This repo runs TypeScript directly. Your Node cannot.`);
console.error(bar);
console.error(`\n  running   node v${process.versions.node}`);
console.error(`  needs     node >= ${REQUIRED}   (native type stripping, default-on from 23.6)\n`);

// nvm is the likely fix and .nvmrc is already correct, so lead with the one command that
// works from inside the repo. The install line is second because it is the rarer case.
console.error(`  Fix, from this directory:\n`);
console.error(`      nvm use                 # honours .nvmrc, which says ${REQUIRED}\n`);
if (major < REQUIRED) {
  console.error(`  If nvm does not have it yet:\n`);
  console.error(`      nvm install ${REQUIRED} && nvm use\n`);
}
console.error(`  Then re-run what you were running. Nothing else is wrong — no install`);
console.error(`  step is missing, and this repo has no npm dependencies to fetch.\n`);
process.exit(1);
