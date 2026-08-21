// Single source of truth for the content plan's RUBRIC skeletons.
// A post = rubric (this file) × density (data/density.json) × ref (refs/analysis) .
// Every slide carries copy + layout. Art-capable slides also carry an `art` prompt
// { s: subject, c: composition, k: colour } — used as the image REPLACE block only
// when the chosen density turns that slide into a generated background.
//
// Composition rule of thumb: text sits low (body--tb) or centred (splash), so art
// prompts keep the type zone open (lower-left, or the area around the centre).

// Layouts that can carry a full-bleed generated background (call art() internally).
export const ART_CAPABLE = new Set([
  'statement', 'stat', 'quote', 'splash', 'tags', 'bento', 'poster', 'photo', 'steps', 'symbolHero',
]);

export const RUBRICS = {
  'hot-takes': {
    name: 'Hot Takes', bucket: 'bright',
    promise: 'One opinionated line that stops the scroll. Product only at the end.',
    slides: [
      { layout: 'statement', kicker: 'Hot take', accent: 'accent-lime', title: 'Nobody stays for the *warm-up*',
        art: { s: 'a bored listener already reaching to skip, thumb hovering over a play bar', c: 'the figure sits high and right, cropped by the top edge; the lower-left third stays open', k: 'acid lime-green dominant' } },
      { layout: 'stat', kicker: 'The whole audition', value: '60', unit: 'sec', accent: 'accent-carrot',
        art: { s: 'a stopwatch caught mid-tick', c: 'small and pushed to the upper right; most of the frame is empty ground', k: 'hot carrot-orange dominant' } },
      { layout: 'claim', kicker: 'The truth', accent: 'accent-carrot', title: 'Your *intro* is the skip button' },
      { layout: 'bigQuestion', kicker: 'So', accent: 'accent-purple', title: 'Why is it still *90 seconds* long?' },
      { layout: 'dontList', kicker: "Don't open with", accent: 'accent-carrot', title: 'The usual *five*', items: ['A slow hello', 'A mic check', 'The weather', 'Housekeeping', 'A long recap'] },
      { layout: 'tags', kicker: 'Cut all of it', items: ['Hellos', 'Mic check', 'The weather', 'Housekeeping', 'Dead air', 'Long recap', 'Sponsor pre-roll', 'Nervous laugh', 'So anyway…'],
        art: { s: 'a crowd of faces all turning away at once', c: 'elements scatter, dense in the upper right, thinning to nothing toward the lower left', k: 'warm red cast' } },
      { layout: 'steps', kicker: 'The fix', accent: 'accent-lime', title: 'Move your best line to *0:00*', items: ['Find it in the transcript', 'Cut it loose', 'Paste it at the very top'],
        art: { s: 'two hands cutting a strip of tape with a blade', c: 'enters from the top-right corner; the lower-left is empty', k: 'acid lime yellow-green dominant' } },
      { layout: 'poster', kicker: 'Rule', accent: 'accent-purple', title: 'Open on the *punchline*',
        art: { s: 'a figure caught mid-leap, arms flung out', c: 'stands tall in the right third, cropped by the top edge; the left two thirds are open', k: 'deep violet dominant' } },
      { layout: 'bento', kicker: 'Inside Cast', accent: 'accent-pink', title: 'The tools for it', variant: 'k', items: [{ title: 'Transcript editing', icon: 'scissors' }, { title: 'Silence removal', icon: 'pause' }, { title: 'Filler removal', icon: 'eraser' }, { title: 'Chapters', icon: 'file' }],
        art: { s: 'a soft blurred studio backdrop, no subject', c: 'evenly quiet so the tiles read on top', k: 'deep magenta-pink dominant' } },
      { layout: 'splash', accent: 'accent-lime', title: 'Start where it gets *good*.',
        art: { s: 'a single spotlight cutting through haze', c: 'most of the frame open around the centre for the logo', k: 'acid lime dominant' } },
    ],
  },

  'inspiration': {
    name: 'Inspiration', bucket: 'bright',
    promise: 'Motivate the creator to make and ship the thing — mindset, not features.',
    slides: [
      { layout: 'statement', theme: 'light', kicker: 'Inspiration', accent: 'accent-purple', title: 'You have something *worth saying*',
        art: { s: 'a person mid-sentence, lit up, genuinely alive', c: 'high and right against open sky; the lower-left third stays quiet', k: 'warm daylight, soft lilac accents' } },
      { layout: 'claim', theme: 'light', kicker: 'Truth', accent: 'accent-carrot', title: 'Done beats *perfect*' },
      { layout: 'bigQuestion', theme: 'light', kicker: 'So', accent: 'accent-purple', title: "What's actually *stopping* you?" },
      { layout: 'tags', theme: 'light', kicker: 'The excuses', items: ['Not a pro', 'Cheap mic', 'No studio', 'Sounds amateur', 'No time to edit', "Nobody's listening", 'Maybe next month', 'What if it flops'],
        art: { s: 'crumpled sticky-notes drifting off a wall', c: 'scattered in the upper right, thinning to the lower left', k: 'bright paper-white with pastel accents' } },
      { layout: 'claim', theme: 'light', kicker: 'Remember', accent: 'accent-purple', title: 'Nobody starts *good*' },
      { layout: 'quote', theme: 'light', accent: 'accent-green', title: 'The best show is the one you *finish*.', author: 'Field note', role: '(cast)',
        art: { s: 'a hand pressing a glowing record button', c: 'lower-right, most of the frame open cream space for the quote', k: 'warm cream, one green glow' } },
      { layout: 'statement', theme: 'light', kicker: 'The move', accent: 'accent-carrot', title: 'Ship episode *one*',
        art: { s: 'a figure stepping off a starting line', c: 'upper right, cropped by the top; the lower-left stays open', k: 'bright daylight, warm carrot accents' } },
      { layout: 'callout', theme: 'light', kicker: 'The deal', accent: 'accent-purple', title: "Say the thing — we'll *finish* it", note: 'Production is necessary, but it was never the point. Bring the idea; the polish is handled.' },
      { layout: 'splash', theme: 'light', accent: 'accent-purple', title: 'Press *record*.',
        art: { s: 'an open sky with a single contrail', c: 'wide open space around the centre for the logo', k: 'clean blue sky, soft white cloud' } },
    ],
  },

  'feature-drop': {
    name: 'Feature Drop', bucket: 'product',
    promise: 'One feature as the fix to one concrete pain — filler-word removal.',
    slides: [
      { layout: 'statement', kicker: 'The pain', accent: 'accent-carrot', title: 'Every *um* is a reason to leave',
        art: { s: 'a mouth caught mid-stumble, tongue tripping on a word', c: 'upper right macro crop; the lower-left third stays open', k: 'hot carrot-orange dominant' } },
      { layout: 'bigQuestion', kicker: 'Count them', accent: 'accent-purple', title: 'How many *ums* in an hour of tape?' },
      { layout: 'claim', kicker: 'The truth', accent: 'accent-carrot', title: "You *can't* un-hear it" },
      { layout: 'steps', kicker: 'How it works', accent: 'accent-lime', title: 'Filler-word removal', items: ['Cast transcribes every word', 'The fillers get flagged in the text', 'Delete them — the audio follows'],
        art: { s: 'a line of text with words being struck through', c: 'runs across the upper half; the lower-left is empty', k: 'acid lime dominant' } },
      { layout: 'checklist', kicker: 'It catches', accent: 'accent-green', title: 'Um, uh, *like*, you know', items: ['Um, uh, er', 'Like, you know', 'So, basically, right', 'False starts and repeats'] },
      { layout: 'callout', kicker: 'One pass', accent: 'accent-lime', title: 'A whole episode, *de-ummed*', note: 'No waveform hunting — you edit the words, and the audio keeps up.' },
      { layout: 'comparison', kicker: 'Same take', accent: 'accent-lime', aTitle: 'Raw', a: ['Um, uh, like', 'Half-finished starts', 'Stop-start rhythm'], bTitle: 'Cleaned', b: ['Straight through', 'Every line lands', 'A steady pace'] },
      { layout: 'symbolHero', kicker: 'The feature', accent: 'accent-lime', icon: 'eraser', title: 'Filler-word *removal*', note: 'One tap clears every um, uh and like across the whole episode — from the transcript, not the waveform.',
        art: { s: 'an eraser lifting words off a page', c: 'upper right; the lower-left stays open for the type', k: 'acid lime dominant' } },
      { layout: 'bento', kicker: 'Same pass', accent: 'accent-pink', title: 'It travels with', variant: 'k', items: [{ title: 'Transcript editing', icon: 'scissors' }, { title: 'Silence removal', icon: 'pause' }, { title: 'Shorten pauses', icon: 'minus-solid' }, { title: 'Voice cleanup', icon: 'eraser' }],
        art: { s: 'a soft neutral studio wall, no subject', c: 'evenly quiet behind the tiles', k: 'deep magenta-pink dominant' } },
      { layout: 'splash', accent: 'accent-lime', title: 'Cut the filler, keep the *flow*.',
        art: { s: 'a clean audio line running unbroken', c: 'open space around the centre for the logo', k: 'acid lime' } },
    ],
  },

  'one-workflow': {
    name: 'One Workflow', bucket: 'product',
    promise: 'The whole record→export pipeline in one place vs a mess of tools.',
    slides: [
      { layout: 'statement', kicker: 'Before', accent: 'accent-carrot', title: 'Seven tabs to finish *one* episode',
        art: { s: 'a tangle of open browser tabs and cables', c: 'dense in the upper right, thinning to the lower left', k: 'cold desaturated blue-grey' } },
      { layout: 'tags', kicker: 'The old stack', items: ['Recorder', 'DAW', 'Noise plugin', 'Transcriber', 'Leveler', 'Music library', 'Licensing', 'Chapter tool'],
        art: { s: 'a wall of mismatched app windows', c: 'scattered dense upper-right, open lower-left', k: 'cold grey with red error accents' } },
      { layout: 'statRow', kicker: 'The maths', accent: 'accent-lime', title: 'One pass replaces the *stack*', stats: [{ v: '7→1', l: 'tools' }] },
      { layout: 'claim', kicker: 'The idea', accent: 'accent-carrot', title: 'One place, or *no* place' },
      { layout: 'bento', kicker: 'In Cast', accent: 'accent-lime', title: 'One pass, six *moves*', variant: 'k', items: [{ title: 'Upload', icon: 'upload' }, { title: 'Clean the voice', icon: 'eraser' }, { title: 'Edit transcript', icon: 'scissors' }, { title: 'Structure', icon: 'file' }, { title: 'Add music', icon: 'music' }, { title: 'Export', icon: 'link' }],
        art: { s: 'a single calm surface, no subject', c: 'evenly quiet behind the tiles', k: 'acid lime dominant' } },
      { layout: 'timeline', kicker: 'Record to export', accent: 'accent-lime', title: 'The whole line', items: ['Upload', 'Clean', 'Transcript', 'Structure', 'Music', 'Export'] },
      { layout: 'claim', kicker: 'After', accent: 'accent-lime', title: 'Record to *export*, one place' },
      { layout: 'callout', kicker: 'No round-trips', accent: 'accent-purple', title: 'No exporting *between* tools', note: 'One project from raw file to publish-ready — no re-imports, no version chaos.' },
      { layout: 'splash', accent: 'accent-lime', title: 'The whole show, *end to end*.',
        art: { s: 'one unbroken conveyor line', c: 'open space around the centre for the logo', k: 'acid lime' } },
    ],
  },

  'plan-picker': {
    name: 'Plan Picker', bucket: 'product',
    promise: 'Which plan fits which creator — Free/Lite/Plus/Max, no hype.',
    slides: [
      { layout: 'bigQuestion', kicker: 'Which one', accent: 'accent-purple', title: 'Which plan fits *your* show?' },
      { layout: 'statement', kicker: 'Honest start', accent: 'accent-lime', title: 'Start where you *are*',
        art: { s: 'a set of four stacked steps rising', c: 'upper right, cropped by the top; the lower-left stays open', k: 'clean cool blue dominant' } },
      { layout: 'priceTiers', kicker: 'Plans', accent: 'accent-purple', title: 'Free to *Max*', items: [{ nm: 'Free', ch: '100 cr · 60 min', pr: '$0' }, { nm: 'Lite', ch: '700 cr · 10 h', pr: '$9.99' }, { nm: 'Plus', ch: '2,750 cr · licence', pr: '$29.74', hi: true }, { nm: 'Max', ch: 'unlimited · stems', pr: '$59.99' }] },
      { layout: 'checklist', kicker: 'Where it steps up', accent: 'accent-green', title: 'Licence lands on *Plus*', items: ['Commercial music licence from Plus', 'Lossless export from Plus', 'Stems on Max', 'Unlimited uploads on Max'] },
      { layout: 'comparison', kicker: 'The jump', accent: 'accent-purple', aTitle: 'Lite · $9.99', a: ['700 credits', '10 h / mo', 'HQ MP3'], bTitle: 'Plus · $29.74', b: ['2,750 credits', '25 h / mo', 'Lossless + licence'] },
      { layout: 'definition', kicker: 'One word', accent: 'accent-carrot', term: 'Credit', body: 'Mostly for *generated* music and SFX — not ordinary editing.' },
      { layout: 'callout', kicker: 'The line', accent: 'accent-lime', title: 'Most creators land on *Plus*', note: 'Commercial music licence and lossless export both start there.' },
      { layout: 'footnote', kicker: 'Small print', accent: 'accent-carrot', title: 'Prices *move*', note: 'Check the live pricing page before you publish any price or offer — plans and credits can change.' },
      { layout: 'splash', accent: 'accent-lime', title: 'Start on *Free*. Move up when it pays.',
        art: { s: 'a simple ascending bar step', c: 'open space around the centre for the logo', k: 'cool blue' } },
    ],
  },

  'how-to': {
    name: 'How-To', bucket: 'guide',
    promise: 'A concrete method a creator can act on today — scoring music.',
    slides: [
      { layout: 'statement', kicker: 'Problem', accent: 'accent-carrot', title: 'Music that *buries* the voice',
        art: { s: 'a voice waveform drowning under a loud music wave', c: 'upper right; the lower-left third stays open', k: 'deep orange-red dominant' } },
      { layout: 'bigQuestion', kicker: 'First', accent: 'accent-purple', title: 'Where should the music even *be*?' },
      { layout: 'claim', kicker: 'Principle', accent: 'accent-lime', title: 'Score the *silences*' },
      { layout: 'steps', kicker: 'The method', accent: 'accent-lime', title: 'Score it in *three* moves', items: ['Pick one track — it adapts to length', 'Duck it under the voice automatically', 'Keep it only where it earns the room'],
        art: { s: 'a music bed dipping smoothly beneath a voice line', c: 'runs across the upper half; the lower-left is empty', k: 'acid lime dominant' } },
      { layout: 'callout', kicker: 'Rule', accent: 'accent-purple', title: 'Music sets the *floor*, not the ceiling', note: 'If you hear the music before the words, it is too loud.' },
      { layout: 'dontList', kicker: "Don't", accent: 'accent-carrot', title: 'Four ways to *wreck* it', items: ['Loop one bed for the whole hour', 'Fade in on every single line', "Use a track you can't license", 'Let it fight the voice'] },
      { layout: 'iconRow', kicker: 'In Cast', accent: 'accent-lime', title: 'What does the *work*', items: [{ title: 'Adaptive music', icon: 'music' }, { title: 'Auto-ducking', icon: 'sliders' }, { title: 'Royalty-free', icon: 'gem' }] },
      { layout: 'checklist', kicker: 'Before you export', accent: 'accent-green', title: 'The music *check*', items: ['One track, reshaped to length', 'Ducked under every line', 'Only where it earns the room', 'Licence sorted before export'] },
      { layout: 'splash', accent: 'accent-lime', title: 'Scored, not *soundtracked*.',
        art: { s: 'a single sound wave curling like a ribbon', c: 'open space around the centre for the logo', k: 'acid lime' } },
    ],
  },

  'mistakes': {
    name: 'Mistakes', bucket: 'guide',
    promise: 'Things creators get wrong, named fast — the tag wall is the payload.',
    slides: [
      { layout: 'statement', kicker: 'Verdict', accent: 'accent-lime', title: 'It is not talent. It is *ten habits*',
        art: { s: 'a hand caught making a small fumbling mistake', c: 'upper right macro; the lower-left third stays open', k: 'acid lime dominant' } },
      { layout: 'stat', kicker: 'Fixable in', value: '1', unit: 'pass', accent: 'accent-carrot',
        art: { s: 'a single clean sweep across a surface', c: 'small in the upper right; most of the frame empty', k: 'hot carrot-orange dominant' } },
      { layout: 'claim', kicker: 'The truth', accent: 'accent-carrot', title: 'Amateur is a *checklist*' },
      { layout: 'tags', kicker: 'The tells', items: ['Long intro', 'No structure', 'Room echo', 'Uneven levels', 'Filler everywhere', 'Dead air', 'Music too loud', 'No chapters', 'Mouth clicks', 'Abrupt ending'],
        art: { s: 'a wall of red-circled mistakes', c: 'dense upper-right, thinning to the lower left', k: 'warm red accents' } },
      { layout: 'dontList', kicker: 'The worst four', accent: 'accent-carrot', title: 'Fix these *first*', items: ['A three-minute intro', 'No chapters at all', 'Music louder than you', 'Ending mid-sentence'] },
      { layout: 'steps', kicker: 'The fix', accent: 'accent-lime', title: 'Work the list, *top down*', items: ['Clean the voice', 'Cut filler and dead air', 'Level to one target', 'Add chapters'],
        art: { s: 'a checklist being ticked top to bottom', c: 'enters from the top-right; the lower-left is empty', k: 'acid lime dominant' } },
      { layout: 'comparison', kicker: 'The gap', accent: 'accent-purple', aTitle: 'Reads amateur', a: ['Echoey room', 'Rambling', 'Levels jumping'], bTitle: 'Reads pro', b: ['Dry and close', 'Tight and paced', 'One steady level'] },
      { layout: 'callout', kicker: 'Order', accent: 'accent-lime', title: 'Fix the *room*, then the *file*', note: "You can't clean up what the room already ruined — record better, then edit." },
      { layout: 'splash', accent: 'accent-lime', title: 'Sound *finished*, not fancy.',
        art: { s: 'a single polished level meter sitting steady', c: 'open space around the centre for the logo', k: 'acid lime' } },
    ],
  },

  'myth-vs-fact': {
    name: 'Myth vs Fact', bucket: 'guide',
    promise: 'Kill beliefs with facts, leaning on real product boundaries.',
    slides: [
      { layout: 'bigQuestion', kicker: 'Three myths', accent: 'accent-purple', title: 'What keeps a show sounding *amateur*' },
      { layout: 'statement', kicker: 'Myth', accent: 'accent-carrot', title: 'A better *mic* fixes it',
        art: { s: 'an expensive studio microphone on a pedestal', c: 'upper right, cropped by the top; the lower-left stays open', k: 'deep orange-red dominant' } },
      { layout: 'claim', kicker: 'Fact', accent: 'accent-lime', title: 'You hear the *room*, not the mic' },
      { layout: 'statement', kicker: 'Myth', accent: 'accent-carrot', title: '“Royalty-free” means you are *covered*',
        art: { s: 'a stack of unlabeled music discs', c: 'upper right; the lower-left third stays open', k: 'deep violet dominant' } },
      { layout: 'claim', kicker: 'Fact', accent: 'accent-lime', title: 'Rights follow the *source*' },
      { layout: 'callout', kicker: 'Why', accent: 'accent-purple', title: 'Uploaded tracks carry *their own* rights', note: "Cast's music uses samples Mubert fully owns, with commercial licensing on eligible plans. Music you upload yourself does not." },
      { layout: 'statement', kicker: 'Myth', accent: 'accent-carrot', title: 'Just fix it *in post*',
        art: { s: 'a rescue-crane trying to lift a broken audio wave', c: 'upper right; the lower-left stays open', k: 'deep orange-red dominant' } },
      { layout: 'claim', kicker: 'Fact', accent: 'accent-lime', title: "Post can't fix a bad *take*" },
      { layout: 'iconRow', kicker: 'What helps', accent: 'accent-lime', title: 'Where Cast *actually* helps', items: [{ title: 'Voice cleanup', icon: 'eraser' }, { title: 'Generative music', icon: 'music' }, { title: 'Commercial licence', icon: 'gem' }] },
      { layout: 'splash', accent: 'accent-lime', title: 'Cleared on eligible *plans*.',
        art: { s: 'a single clean stamp of approval', c: 'open space around the centre for the logo', k: 'acid lime' } },
    ],
  },

  'before-after': {
    name: 'Before / After', bucket: 'product',
    promise: 'Raw recording vs finished episode — two states, hard contrast.',
    slides: [
      { layout: 'statement', kicker: 'Before', accent: 'accent-carrot', title: 'The raw file nobody should *hear*',
        art: { s: 'a jagged messy waveform full of spikes and gaps', c: 'runs across the upper half; the lower-left third stays open', k: 'deep orange-red dominant' } },
      { layout: 'checklist', kicker: 'The pass', accent: 'accent-green', title: 'Gone in one *pass*', items: ['Um, uh, like — removed', 'Dead air — trimmed', 'Room hum — cleaned', 'Levels — evened out'] },
      { layout: 'beforeAfter', accent: 'accent-lime', before: 'Boxy, hum, plosives', after: 'Clean, close, present' },
      { layout: 'beforeAfter', accent: 'accent-lime', before: '45 minutes of raw talk', after: '22 minutes, tight' },
      { layout: 'beforeAfter', accent: 'accent-lime', before: 'Silent gaps, no music', after: 'Scored, ducked, level' },
      { layout: 'claim', kicker: 'Same take', accent: 'accent-carrot', title: 'Same voice. *Finished*.' },
      { layout: 'stat', kicker: 'All of it in', value: '1', unit: 'pass', accent: 'accent-lime',
        art: { s: 'a smooth even waveform, perfectly level', c: 'small upper right; most of the frame empty', k: 'acid lime dominant' } },
      { layout: 'callout', kicker: 'How', accent: 'accent-purple', title: 'You edit the *words* — audio follows', note: 'Transcript-based editing, not waveform surgery. Change the text, the audio changes with it.' },
      { layout: 'splash', accent: 'accent-lime', title: 'Raw in, *ready* out.',
        art: { s: 'a raw wave smoothing into a clean line', c: 'open space around the centre for the logo', k: 'acid lime' } },
    ],
  },

  'unnecessary-censorship': {
    name: 'Unnecessary Censorship', bucket: 'bright',
    promise: 'Comedy — bleep ordinary words for effect, powered by custom censoring.',
    slides: [
      { layout: 'statement', kicker: 'New format', accent: 'accent-lime', title: 'Bleep the *boring* parts',
        art: { s: 'a mouth mid-word with a censor bar snapping across it', c: 'upper right macro; the lower-left third stays open', k: 'acid lime dominant' } },
      { layout: 'bigQuestion', kicker: 'What if', accent: 'accent-purple', title: 'You could bleep *anything*?' },
      { layout: 'statement', kicker: 'The bit', accent: 'accent-pink', title: 'Bleep the word ‘*algorithm*’. Every time.',
        art: { s: 'a censor beep bar mid-air', c: 'upper right; the lower-left stays open', k: 'hot magenta-pink dominant' } },
      { layout: 'statement', kicker: 'The bit', accent: 'accent-pink', title: "Bleep your co-host's *name*. All episode.",
        art: { s: 'two speech bubbles, one blacked out', c: 'upper right; the lower-left stays open', k: 'hot magenta-pink dominant' } },
      { layout: 'tags', kicker: 'Bleep-worthy', items: ['Buzzwords', 'Hot takes', 'Spoilers', 'The boss', '“Synergy”', 'Ad reads', 'Your ex', 'Mondays'],
        art: { s: 'a scatter of black censor bars', c: 'dense upper-right, thinning to the lower left', k: 'hot pink accents' } },
      { layout: 'callout', kicker: 'Yes, really', accent: 'accent-lime', title: 'Custom censoring — any *word* you pick', note: 'Auto-detect profanity, or add your own words and names. Replace it with a beep — or any sound.' },
      { layout: 'checklist', kicker: 'How it works', accent: 'accent-green', title: 'Four taps', items: ['Auto-detect profanity', 'Add your own words and names', 'See them flagged in the transcript', 'Swap for a beep or any sound'] },
      { layout: 'claim', kicker: 'The joke', accent: 'accent-carrot', title: 'Comedy is *precise* censoring' },
      { layout: 'splash', accent: 'accent-pink', title: 'Bleep it like you *mean* it.',
        art: { s: 'a single bold censor bar', c: 'open space around the centre for the logo', k: 'hot magenta-pink' } },
    ],
  },
};

// --- global image-prompt builder (the one place that decides "art, not stock") ---
export const ART_DIRECTIVE =
  "Render it EXACTLY in the reference's medium, mood and FINISH — match its brightness, gloss, saturation and "
  + "pop. A polished editorial / campaign image: confident, graphic, a striking crop, with real negative space. "
  + "Stay faithful to the reference's colour and lighting. Do NOT darken, dull, mute, dirty, distress or grunge "
  + "it; NO added grain, NO HDR crunch, NO crushed shadows, NO torn or gritty texture, NO glitch — unless the "
  + "reference itself already looks that way. Bright, saturated, glossy, clean and high-craft. Also avoid the "
  + "opposite: no soft dreamy blur, no gradient haze, no neutral stock-studio backdrop.";

// keep = the ref's KEEP recipe; lines = [ "SUBJECT: …", "COMPOSITION: …", "COLOUR: …" ]
export function composePrompt(keep, lines) {
  return [
    keep.join('\n'), '',
    "REPLACE — the subject and composition are new, but keep the reference's MEDIUM and its bold colour energy exactly; do NOT clean it up, soften it, or make it tasteful:",
    ...lines.map(l => `· ${l}`),
    '',
    ART_DIRECTIVE,
  ].join('\n');
}

// Map a ref number/name to its analysis file name in refs/analysis/.
export const refAnalysisFile = (ref) => {
  const n = String(ref).match(/\d+/)?.[0];
  return n ? `cast-ref-${String(n).padStart(2, '0')}.json` : String(ref);
};
