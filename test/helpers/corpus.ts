// The slide corpus that Tier 2 snapshots and Tier 3 screenshots.
//
// Assembled from data that already exists rather than hand-written, so it stays
// representative of what the generator actually renders: 161 authored deck slides, the
// 10 in content.json, every slide of all ten rubric skeletons, the one-of-every-layout
// catalogue table, and a set of hand-built edge cases the real data never reaches.
//
// Case names are stable and filesystem-safe — they become golden filenames, so reordering
// the sources must not renumber anything.
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { RUBRICS } from './sut.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export type Case = { name: string; slide: Record<string, unknown> };

const HANDLE = 'mubert.com/tools/cast';

/** Authored decks, injected exactly the way src/render.mjs injects them. */
function deckCases(): Case[] {
  const out: Case[] = [];
  for (const f of readdirSync(join(ROOT, 'src')).sort()) {
    if (!/^(deck-.*|content)\.json$/.test(f)) continue;
    const deck = JSON.parse(readFileSync(join(ROOT, 'src', f), 'utf8'));
    const total = deck.slides.length;
    deck.slides.forEach((raw: Record<string, unknown>, i: number) => {
      out.push({
        name: `deck--${f.replace(/\.json$/, '')}--${String(i + 1).padStart(2, '0')}-${raw.layout}`,
        slide: { meta: deck.meta, handle: deck.handle, ...raw, index: i + 1, total },
      });
    });
  }
  return out;
}

/**
 * Rubric skeletons, transformed the way tools/compose.mjs transforms them: `art` and any
 * authored `theme` are dropped, minimal is forced on, and index/total/handle are injected.
 * The theme/accent rewriting compose does per --theme is deliberately NOT applied — this
 * corpus exercises the layouts, and the theme permutations are covered by the edge cases.
 */
function rubricCases(): Case[] {
  const out: Case[] = [];
  for (const [id, r] of Object.entries(RUBRICS)) {
    const slides = (r as { slides: Array<Record<string, unknown>> }).slides;
    slides.forEach((sl, i) => {
      const { art: _art, theme: _theme, ...copy } = sl;
      out.push({
        name: `rubric--${id}--${String(i + 1).padStart(2, '0')}-${sl.layout}`,
        slide: { ...copy, minimal: true, handle: HANDLE, index: i + 1, total: slides.length },
      });
    });
  }
  return out;
}

/** The hand-built one-of-every-layout table, mirrored from tools/layout-catalogue.mjs. */
function catalogueCases(): Case[] {
  const rows = JSON.parse(readFileSync(join(ROOT, 'test/fixtures/catalogue-slides.json'), 'utf8'));
  return rows.map((row: Record<string, unknown>) => {
    const { $case, $purpose: _p, ...slide } = row;
    return { name: `catalogue--${$case}`, slide };
  });
}

/** Branches the production data never exercises. */
function edgeCases(): Case[] {
  const base = { index: 2, total: 5, minimal: true, handle: HANDLE, accent: 'accent-lime' };
  const cases: Case[] = [
    // meter is a real either/or: segments[] XOR {left,right,pct}. Both modes, plus the
    // fallback when neither is supplied (pct defaults to 50).
    { name: 'edge--meter--segments', slide: { ...base, layout: 'meter', title: 'Split',
      segments: [{ label: 'a', v: 3 }, { label: 'b', v: 1 }, { label: 'c', v: 2 }] } },
    { name: 'edge--meter--left-right-pct', slide: { ...base, layout: 'meter', title: 'Split',
      left: 'before', right: 'after', pct: 72 } },
    { name: 'edge--meter--defaults', slide: { ...base, layout: 'meter', title: 'Split' } },

    // lineChart has two live division hazards: one point makes (len-1) zero, and a flat
    // series makes (max-min) zero. Both are pinned rather than fixed.
    { name: 'edge--linechart--single-point', slide: { ...base, layout: 'lineChart', title: 'One', points: [5] } },
    { name: 'edge--linechart--flat', slide: { ...base, layout: 'lineChart', title: 'Flat', points: [3, 3, 3] } },
    { name: 'edge--linechart--normal', slide: { ...base, layout: 'lineChart', title: 'Trend',
      points: [24, 30, 28, 44, 52, 50, 72, 96], left: '0:00', right: '32:00' } },

    // items arrays that are heterogeneous unions, discriminated at runtime by typeof.
    { name: 'edge--tags--strings', slide: { ...base, layout: 'tags', title: 'Cut *this*',
      items: ['Hellos', 'Mic check', 'Dead air'] } },
    // Object items carry their own accent; the rotation is skipped for them. This case
    // exercises the ghost / small / auto-small-when-long branches on the working path.
    { name: 'edge--tags--objects', slide: { ...base, layout: 'tags', title: 'Cut *this*',
      items: [{ label: 'Ghosted', ghost: true, accent: 'pink' },
              { label: 'Tinted', accent: 'purpleblue' },
              { label: 'Small', small: true, accent: 'carrot' },
              { label: 'A very long label indeed', accent: 'green' }] } },
    // …and an object item WITHOUT an accent throws, because `cvar(undefined)` calls
    // .startsWith on undefined. A latent bug in production code, pinned rather than fixed:
    // the behaviour-preserving rule says Phase 4 owns it. The AccentToken type introduced
    // in Phase 1 is what will surface it at compile time.
    { name: 'edge--tags--object-without-accent', slide: { ...base, layout: 'tags', title: 'Boom',
      items: [{ label: 'no accent supplied' }] } },
    { name: 'edge--tags--mixed', slide: { ...base, layout: 'tags', title: 'Mixed',
      items: ['plain', { label: 'object', accent: 'carrot' }] } },
    { name: 'edge--index--strings', slide: { ...base, layout: 'index', title: 'Chapters',
      items: ['One', 'Two', 'Three'] } },
    { name: 'edge--index--objects', slide: { ...base, layout: 'index', title: 'Chapters',
      items: [{ title: 'One', meta: '00:00' }, { title: 'Two', meta: '04:12', accent: 'pink' }] } },
    { name: 'edge--steps--objects', slide: { ...base, layout: 'steps', title: 'How',
      items: [{ title: 'First' }, { title: 'Second' }] } },

    // renderSlide's own branches
    { name: 'edge--ground-flood', slide: { ...base, layout: 'claim', title: 'On *colour*', ground: 'purpleblue' } },
    { name: 'edge--ground-vs-palette', slide: { ...base, layout: 'tags', title: 'Rotation',
      ground: 'superlime', items: ['a', 'b', 'c', 'd', 'e'] } },
    { name: 'edge--theme-grad-with-art', slide: { ...base, layout: 'statement', title: 'Art *wins*',
      theme: 'grad', bgFile: '/fixture/art.png' } },
    { name: 'edge--theme-grad-no-art', slide: { ...base, layout: 'statement', title: 'Grad *stays*', theme: 'grad' } },
    { name: 'edge--theme-light', slide: { ...base, layout: 'claim', title: 'On *cream*', theme: 'light' } },
    { name: 'edge--not-minimal-grain', slide: { ...base, layout: 'claim', title: 'With *grain*', minimal: false } },
    { name: 'edge--foot-shown', slide: { ...base, layout: 'claim', title: 'With *handle*', foot: true } },
    { name: 'edge--first-and-last-tick', slide: { ...base, layout: 'claim', title: 'Tick', index: 1, total: 1 } },

    // a glyph key that does not exist — renders empty rather than throwing
    { name: 'edge--symbolhero--missing-icon', slide: { ...base, layout: 'symbolHero',
      icon: 'does-not-exist', title: 'No *glyph*', note: 'the icon silently renders empty' } },
    { name: 'edge--list--numbered', slide: { ...base, layout: 'list', title: 'Ordered',
      numbered: true, items: ['one', 'two', 'three'] } },
    { name: 'edge--statrow--arrow', slide: { ...base, layout: 'statRow', title: 'Maths',
      stats: [{ v: '7→1', l: 'tools' }, { v: '3->1', l: 'ascii arrow' }] } },

    // Three layouts no authored deck, rubric or catalogue entry reaches. Without these the
    // corpus would silently leave 3 of 32 layouts unprotected during the port.
    { name: 'edge--cover--plain', slide: { ...base, layout: 'cover', title: 'The *cold open*',
      lede: 'Find the line that earns the next thirty minutes.' } },
    { name: 'edge--cover--with-art', slide: { ...base, layout: 'cover', title: 'The *cold open*',
      bgFile: '/fixture/art.png' } },
    { name: 'edge--processvertical', slide: { ...base, layout: 'processVertical', title: 'The *flow*',
      items: ['Upload', 'Clean', 'Transcript', 'Chapters', 'Music', 'Export'] } },
    { name: 'edge--lowerthird', slide: { ...base, layout: 'lowerThird', kicker: 'Now playing',
      title: 'Cut a *sentence*, not a selection' } },
    { name: 'edge--lowerthird--with-art', slide: { ...base, layout: 'lowerThird', kicker: 'Now playing',
      title: 'Over *art*', bgFile: '/fixture/art.png' } },
  ];

  // Every bento shell, including a variant that does not exist (falls back to 'k').
  const items = [{ title: 'Voice cleanup', icon: 'eraser' }, { title: 'Word cuts', icon: 'scissors' },
                 { title: 'Adaptive music', icon: 'sound' }, { title: 'Auto-ducking', icon: 'sliders' },
                 { title: 'Chapters', icon: 'file' }, { title: 'Cleared licence', icon: 'gem' }];
  for (const v of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'zz']) {
    cases.push({ name: `edge--bento--variant-${v}`,
      slide: { ...base, layout: 'bento', title: 'Six tools, *one* pass', items, variant: v } });
  }
  return cases;
}

export function corpus(): Case[] {
  const all = [...catalogueCases(), ...edgeCases(), ...rubricCases(), ...deckCases()];
  const seen = new Set<string>();
  for (const c of all) {
    if (seen.has(c.name)) throw new Error(`duplicate corpus case name: ${c.name}`);
    seen.add(c.name);
  }
  return all;
}
