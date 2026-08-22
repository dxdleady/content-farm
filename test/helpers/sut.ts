// System Under Test — the single barrel every test imports from.
//
// Tests must NEVER import from `../../src/...` directly. During the migration each
// source file is renamed `.mjs` -> `.ts` one commit at a time, and every rename changes
// its specifier. Routing all of it through this one file means a rename edits ONE line
// here instead of N test files, so no test's imports churn during the port.
//
// Note the `.mjs` extensions below: that is the pre-migration state. Phase 2 rewrites
// them to `.ts` in place, and nothing else in test/ moves.

export { renderSlide, layouts, icon, ACCENTS, inkFor } from '../../src/layouts.mjs';
export { pool } from '../../src/pool.ts';
export { fxPage, FX_FILTER } from '../../src/fx.ts';
export { duotone, misprint, grain, halftoneCss, treated } from '../../src/treatment.ts';
export {
  FORMATS, DEFAULT_FORMAT, resolveFormat, formatFromArgv, formatCss, formatTag,
} from '../../src/formats.mjs';
export {
  RUBRICS, ART_CAPABLE, ART_DIRECTIVE, composePrompt, refAnalysisFile,
} from '../../src/plan.mjs';
export { MODELS, dataUri, wavespeed } from '../../src/providers.mjs';
export { RUNS, newRunId, openRun, listRuns } from '../../src/run.ts';

// bgen is deliberately NOT re-exported here. It calls process.loadEnvFile() at module
// scope and has a top-level await inside its main-module guard, so importing it mutates
// process.env and makes every importer an async module. Its pure functions are reached
// through a narrower barrel that the bgen test owns.
