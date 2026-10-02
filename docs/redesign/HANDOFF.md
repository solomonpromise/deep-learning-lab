# Current approved redesign — 2 October 2026

The owner approved the standalone interactive prototype, then authorised applying it to this repository. This replaces the previous Activation boards and violet/viridis direction documented below.

- Palette: cream `#f7f7f2`, forest `#234c3c`, green ink `#202d28`, soft green `#eef1e8`, pale lime `#ddeaab`. Keep blue/orange for data classes and green/rust plus symbols for answer feedback.
- Archivo, Source Serif 4 and JetBrains Mono are bundled in `static/vendor/` with their licences; KaTeX is bundled too.
- `index.html` is always the course introduction; `dashboard.html` is the real learner workspace. `curriculum.html` lists all ten modules; `reference.html` connects the glossary, concept map and guide. Future modules have honest roadmap pages.
- Lessons default to one section at a time with a persistent title and outline. Existing section/question hashes open the right section. `F` enters read mode; the whole lesson remains available for continuous reading and printing.
- The homepage uses a native SVG representation-learning illustration: image input → edge features → parts → learned feature vector → predicted object. Buttons choose a mug, shoe or leaf and inspect each stage. It is explicitly illustrative, with no claimed live image classifier.
- The production learner record, mastery rules, spaced review, lab toolkit, Python worker, tutor service, sync, badges and discussions remain in use. Never copy prototype sample data, simplified review scheduling or its local tutor demonstration into production.
- Notebooks and teaching enrichments remain the content source for all 19 published lessons. Modules 1–4 have 32 redesigned teaching diagrams (19 replacements and 13 missing illustrations completed); Module 5 has ten. Their PNGs are portable Markdown attachments, with editable SVG originals and manifests in `static/img/course-figures/` and `static/img/module-5/`. Calculation code and saved experiment plots remain intact. Curated notebooks are locked against `make sync`. See the README's figure regeneration and download checks. The certificate stays disabled.

Run the build, `scripts/dev/redesign.mjs`, responsive screenshots and WCAG checks before merging. The existing browser scripts now include the new pages. New CSS belongs in `static/css/activation.css`; palette tokens remain in `site.css`.

The previous handoff below is historical context; its colour values and full-scroll default are superseded.

---

# UI redesign "Activation": handoff

This is everything needed to continue the redesign in a local Claude Code session (or by hand).
`CLAUDE.md` at the repo root points here, so Claude reads it automatically.

## Status

| Phase | What | State |
|---|---|---|
| 1 | Certificate switched off (`features.certificate: false`), three bugs from the UI review | Done, PR #7 |
| 2 | Foundation: colour tokens, fonts, top bar, footer, dark mode, shared components (`static/css/activation.css`) | Done, PR #7 |
| 3 | Lesson page: spine, margin notes, terminals, benches, prompts, read mode, phone | Done (see notes under Phase 3) |
| 4 | Home: today band, "Your network", module rows, first visit, phone tab bar | Done (see notes under Phase 4) |
| 5 | Module page and one-question-at-a-time module challenge | Done (see notes under Phase 5) |
| 6 | Daily review opens on the first question | Done (see notes under Phase 6) |
| 7 | Training log (progress), concept map, glossary, guide, 404 | Done (see notes under Phase 7) |
| 8 | Final QA and CSS clean-up | Done (see notes under Phase 8) |

Approved by the owner on 30 September 2026. Decisions already made (don't reopen them):
- Colour means progress only. Per-module colours are retired; modules are identified by their number.
- Lesson notes are set in a serif (Source Serif 4). The interface is Archivo; code and labels are JetBrains Mono.
- The certificate stays switched off for now. Module badges stay.
- No floating buttons. The tutor opens from the top bar.
- One pull request per phase where possible.

## The design

**Look at the mockups first**: `docs/redesign/mockups/` holds every page as HTML (open in a browser) and as an
image in `mockups/img/` (Claude can read these directly). The same boards live on the design canvas
at https://claude.ai/artifact/VdATE1YULdEuzw35kLmDBT and the UI review that led to them at
https://claude.ai/artifact/H6Jtbq7vJAnMYaDeWPcWh5 (both need the owner's claude.ai login).

| Board | File |
|---|---|
| Design language (colour, type, materials, controls) | `Main` |
| Home, returning learner / first visit / phone | `Home`, `HomeFirst`, `HomePhone` |
| Lesson top / inside a section / read mode / phone / phone section sheet | `Lesson`, `LessonSection`, `LessonRead`, `LessonPhone`, `LessonPhoneSheet` |
| Module page | `Module` |
| Daily review, desktop and phone | `Review`, `ReviewPhone` |
| Training log (My progress) | `Progress` |
| Concept map, glossary | `Concepts`, `Glossary` |

`mockups/dlx.css` is the reference CSS for every component in the mockups (class names `.prompt`, `.opt`,
`.bench`, `.term`, `.spine`, `.sp`, `.mnote`, `.annot`, `.node`, `.segbar`, `.nw` and so on). Port rules from it
into `static/css/activation.css` as each page is rebuilt; don't link it from the site.

### Rules of the design
- **Colour = activation.** Progress uses matplotlib's viridis in four steps: `--a1` started `#3b528b`,
  `--a2` practised `#21918c`, `--a3` strong `#5ec962`, `--a4` mastered `#fde725` (always with an ink outline in
  light mode; glows in dark mode). Not started is a hollow node. Nothing else uses these colours.
- Data classes in labs are blue `--c0` and orange `--c1`. Right and wrong are `--green` and `--red` (rust), always
  with a tick or cross too.
- **Three voices**: Archivo (interface; headings use `font-stretch: 110–120%`, big numerals `font-stretch: 62–70%`
  at weight 900), Source Serif 4 for `.prose` and summaries, JetBrains Mono for code, labels (small caps with
  letter-spacing) and measured numbers.
- **Four materials**: paper (prose, no box), prompt (white card with a "?" mark: every question), bench (graph-paper
  dot grid under a white name plate: every lab, wider than the text), terminal (dark: every code cell, one Run button,
  the rest in a ⋯ menu).
- Chrome gets out of the way: one navigation per page, nothing floating over the text, every page answers "what next?" first.
- Copy: plain, specific, active voice. No em-dash asides in UI copy.

## Where things live

- `templates/`: Jinja pages. `base.html` is the shell (top bar, course sidebar, footer). `_blocks.html` renders every
  lesson block (prose, code cells, questions, labs, explainers, checkpoints, quiz, module challenge).
  **Gotcha:** macros imported from `_blocks.html` don't see the page context unless imported `with context`
  (see `module.html`).
- `static/css/site.css`: colour tokens at the top (light, dark via `prefers-color-scheme`, and `[data-theme]`), then
  the old layout and components. `learn.css`: learning features (focus mode, mastery panels, review, progress).
  `widgets.css`: lab internals. `activation.css`: the new design system, loaded last. New rules go in
  `activation.css`; delete the old rules a page no longer uses when you rebuild it.
- `static/js/app.js`: theme, sidebar, top-bar menu, lesson progress and table of contents, code cells, questions,
  glossary popovers, search, labs mounting. `progress.js`: mastery model (`window.DLP.mastery`), module challenge.
  `record.js`: the learner record (`window.DLP.record`: answers, review queue, days, streak, week). `focus.js`: focus
  mode. `review.js`, `progress-page.js`, `concepts.js`, `tutor.js`, `sync.js`, `pyrun.js`.
- `scripts/build.py`: builds `dist/` from `notes/`, `enrichments/`, `course.yaml`, `glossary.yaml`, `concepts.yaml`.
  It writes `dist/static/course-map.js` (`window.DLP_COURSE`: modules, lessons, checkpoint and quiz ids, labs).
- Keep every `data-*` attribute that JavaScript reads when you change markup (search for the attribute in
  `static/js/` before renaming anything).
- Temporary bridge in `activation.css`: `[style*="--mc"] { --mc: var(--mod) !important; }` neutralises the
  per-module colours that templates and scripts still set inline. Remove the inline `--mc` styles as pages are
  rebuilt, and this rule at the end (phase 8).

## Workflow for each phase

1. Branch from `main` (or continue the open redesign branch), one phase per PR.
2. `make serve` builds and serves http://localhost:8000 (`python3 scripts/build.py` alone takes about 20 s).
3. Build the page to match its mockup board. Reuse the existing JS hooks.
4. Check it: `node scripts/dev/screenshots.mjs <pages>` writes full-page screenshots to `.shots/` at 1440 and 1280
   (desktop, laptop), 390 (phone) and 1440 dark, with a sample learner, and reports sideways scroll and JS errors.
   `CHANNEL=chrome` drives the installed Google Chrome, so `npm install --no-save playwright` is all it needs.
   Look at every screenshot. Also click through the features the page carries (list per phase below).
5. Commit with a message that says what changed for the learner; open a PR with a Testing section.

## Phase 3: lesson page (done)

What was built (all lesson CSS is the "lesson page (phase 3)" block at the end of `static/css/activation.css`):
- `base.html` wraps the course sidebar in `{% block sidebar %}`; `lesson.html` adds `aside.spine` after it. On lesson
  pages the course tree is a drawer at every width (`app.js`: `inPlace()` is false on `page-lesson`).
- Spine: `.sp-list[data-toc]` of `a.sp[data-toc-link]` (node, number, title). `app.js` marks `.is-active`/`.is-read`,
  `cp-done`; scroll container is `.spine-inner`. Fold to a rail with `[data-spine-toggle]` (`dlp:spine-collapsed`,
  class `spine-collapsed` on `<html>`, set in the head script). ≤980px the spine is a bottom sheet (`body.spine-open`,
  opened by `[data-spine-open]`, closed by `[data-spine-close]`, Esc, or following a link).
- Margin mode is a container query on `.lesson-layout` (`container: lesson`, min 1018px): sections get
  `padding-right: 298px`, `.mnote` floats into the margin, `.widget` spans text plus margin. Short explainers get
  `.mnote` in `_blocks.html` (styles plain/analogy/why/remember/tip/warning/recap, under 480 characters, no code,
  images, tables or display maths); collapsed ones get `.annot`.
- Read mode: `focus.js` creates a toggle in each `[data-focus-slot]` (spine and header); `F` toggles, `Esc` leaves;
  `body.focus-mode` hides the spine, top bar and footer.
- Phone: `nav.lesson-bar` (sections sheet, `[data-sec-step]` previous/next section, tutor). `[data-lb-where]` shows
  "n of N · title".
- Not done from the list below (small, can go in phase 8): code cell ⋯ menu (secondary actions are icon-only chips
  instead), reflective questions as margin notes, the end-of-lesson row.

Original spec:

Boards: `Lesson`, `LessonSection`, `LessonRead`, `LessonPhone`, `LessonPhoneSheet`.
Files: `templates/lesson.html`, `templates/_blocks.html`, `templates/base.html`, `static/js/app.js`,
`static/js/focus.js`, `static/css/activation.css` (remove replaced rules from `site.css` and `learn.css`).

1. **Spine instead of sidebar and contents panel.** Add a `{% block sidebar %}` in `base.html` around the course
   sidebar; `lesson.html` overrides it with the spine: lesson label and title, read % and checkpoints count, a row of
   actions (Read mode `F`, All lessons, Download notebook, Open in Colab), then the section list (Before you start,
   §1…§n, transition, Wrap-up) as nodes on a vertical line. Build the list from `lesson.sections` in the template.
   Keep the table-of-contents hooks (`data-toc`, `data-toc-link="<section id>"`) on the spine items so app.js keeps
   marking the current section (`.is-active`) and read sections (`.is-read`); style those as `.sp.cur` and read
   nodes (`--a2`). Delete the right-hand `.toc` aside. The spine is sticky at viewport height and collapsible
   (reuse the `nav-collapsed` pattern from app.js with a separate key, e.g. `dlp:spine-collapsed`).
   "All lessons" opens the existing course tree as a drawer.
2. **Header.** Mono label "Module N · title", the lesson title (no number pill), serif summary, and in the margin
   "In this lesson" (minutes, sections, code cells, labs, figures). "Before you start": goal, outcome and objectives
   as definition rows (hairlines, no cards); data used in the margin. Start button plus "Read one section at a time".
3. **Two-column reading area** at ≥1280px: text column 720px, margin column 250px, 48px apart. Short explainers
   (`ex-plain`, `ex-analogy`, `ex-why`, `ex-remember`, `ex-tip`, `ex-warning`, `ex-recap`) render as margin notes
   (`.mnote`: 2px ink top rule, mono label, sans text). Simplest robust layout: give sections `padding-right: 298px`
   and float the notes right with `margin-right: -298px`. Below 1280px they fall back inline, full width.
   Long ones (`ex-deep`, `ex-math`, `ex-code`, `ex-result`, and anything `collapsed`) become `.annot` rows:
   hairlines above and below, a glyph, label and title, expandable.
4. **Code cells as terminals.** Header: "python · N lines", Run (teal) where runnable, and a ⋯ menu holding Edit,
   Ask the tutor, Copy, Hide explanation. Keep `data-py-run`, `data-py-edit`, `data-explain-toggle`, `data-copy`
   and the tutor chip hooks. Line-note markers stay in the gutter (already teal). Output as a strip under the code.
5. **Labs as benches.** `figure.widget` gets the dot-grid background, a white plate ("Lab · 1.1 · 3 of 7" plus
   title), and spans text plus margin width. The lab challenge strip sits at the bench's foot.
6. **Questions as prompts.** `qcard`, `checkpoint`, `quiz`, `predict`, `stepper` share the prompt look: white card,
   "?" mark in an ink square, mono label, options as rows with key letters (`.opt` and `.opt-letter`, states
   `is-correct`, `is-wrong`, `is-picked`), explanation below a dashed rule. Reflective questions (`q-think`) can sit
   in the margin as a note with a "Write my answer" link.
7. **Read mode** replaces focus mode (`focus.js` already pages one section at a time). When on: hide the spine and
   top bar, centre a 700px column, dark-friendly, with the focus bar as a bottom bar (previous, a note that the
   checkpoint comes first, next). `F` toggles, `Esc` leaves.
8. **Phone.** Top bar shows back, "Lesson 1.1 · §6 of 12" and the section title. A bottom lesson bar: sections
   button (opens the spine list as a bottom sheet), previous, next, ask the tutor. The lesson text starts on the
   first screen (fold the long header actions into the sheet).
9. **End of lesson**: mastery panel, "Mark complete", and the next lesson as one wide link row.

Check: 1440, 1280, 1024, 390, light and dark. Answer a checkpoint and a quiz question (recorded, mastery updates),
predict, stepper, a code exercise, Run and Edit a cell in lesson 1.1 (Pyodide), explanation toggle, tutor from a
code cell, glossary popover, search, read mode, lesson progress %, mark complete, discussion button.

## Phase 4: home (done)

What was built:
- `templates/home.html` (no course sidebar: `{% block sidebar %}{% endblock %}`) and `static/js/home.js` (instead of
  the planned `network.js`; it also paints the today band and the module rows). The old hero canvas (`heroNetwork` in
  `app.js`), the path rings, `paintHome` in `progress.js` and the old home CSS are gone.
- Returning learner = at least one study day in `DLP.record.days()`; otherwise the `[data-welcome]` parts show.
- The course map (`dist/static/course-map.js`, built in `scripts/build.py`) now carries each module's `short` name
  (new `short:` field per module in `course.yaml`, used for the network's labels) and `question`, and each lesson's
  `secs` ([id, number, title] for every section the lesson page tracks, plus wrap-up) and `minutes`.
- Network: SVG, viewBox 1200×330 on wide screens, a vertical version below 640px of panel width (redrawn on resize).
  Travelling dots are `animateMotion` on lit edges (skipped under reduced motion); "You are here" is the last lesson
  opened (`store.get('last')`), "Start here" on a first visit.
- Phones: `nav.tabbar` in `base.html` on every page but lessons (`body.has-tabbar`); the brand name is back in the
  top bar; Review and tutor move from the top bar to the tab bar.

Original spec:

Boards: `Home`, `HomeFirst`, `HomePhone`. Files: `templates/home.html`, new `static/js/network.js`,
`static/css/activation.css`, remove `heroNetwork` from `app.js` and the old hero CSS.

- No course sidebar on home. Today band: resume card (from `store.get('last')` and the lesson's read progress),
  daily review card (`DLP.record.due()` count, by module), this week (`record.week()`, `record.streak()`).
- **Your network**: a dark panel with the course drawn as a network. One layer per module (left to right), one
  node per lesson, curved edges between consecutive layers, node colour from `DLP.mastery.all()` status (none,
  started, practised, mastered). Current lesson gets a pulsing ring and a "You are here" pill; small dots travel
  along edges out of lit nodes (SVG `animateMotion`, off under `prefers-reduced-motion`). Coming-soon modules are
  compressed dashed layers with one caption. Phones get a vertical version (rows of nodes).
- Module rows (condensed outlined number, title, serif question, lesson segment bar coloured by status, action) and a
  compact "Coming next" list. First visit (no study days yet): the untrained network with a "Start here" pill on 1.1.
- Phones: bottom tab bar (Learn, Review with count, Progress, Tutor) on non-lesson pages; then the brand name can
  come back in the top bar (it is hidden below 480px in `activation.css`).

## Phase 5: module page (done)

What was built:
- `templates/module.html`: numeral, title, question, `aside.m-prog` (segments `[data-seg]`, `[data-m-prog-t]`,
  `[data-m-go]`), topics as `.tags`, lessons as `ol.m-lessons > li.ml[data-ml]` (`[data-ml-state]`, `[data-ml-go]`).
  Module pages keep the course tree as a drawer, like lessons (`app.js` and the drawer rules in `activation.css`).
- `progress.js` `paintModule(mods)`: each lesson's state (Not started / In progress · n% read / Practised or
  Mastered · strength n%) and action (Start / Continue at §n / Practise / Revisit); the panel's action is the lesson
  you are in, else the first not mastered, else the challenge, else daily review. `resumeAt(id)` uses `secs` from
  the course map.
- `_blocks.html` `mchallenge`: an intro card (`[data-mc-intro]`, dots `[data-mc-dots]`, `[data-mc-start]`,
  `[data-mc-review]`) and a run (`[data-mc-run]`: one `.quiz-q` visible, `[data-mc-back]`, `[data-mc-next]`,
  `[data-mc-close]`). Answering the last question calls `R.challenge(id, right, true, {passed})` as before.

Original spec:

Board: `Module`. Files: `templates/module.html`, `_blocks.html` (`mchallenge`), `progress.js` (challenge logic).
Giant outlined numeral, title, the module's question in serif italic, progress panel with "Continue", topics as tags,
lessons as a connected list (node, number, title, 2-line summary, meta, state and one action). The module challenge
becomes one question at a time (show one `.quiz-q`, Next and Back, a score and explanations at the end); keep
`R.challenge(id, right, true, {passed})` so badges still record.

## Phase 6: daily review (done)

What was built (all review CSS is the "daily review (phase 6)" block at the end of `static/css/activation.css`; the old
`.rv-*` rules are gone from `learn.css`, except `.rv-stats`/`.rv-stat`, which the instructor page still uses):
- `templates/review.html` (no course sidebar): `section[data-rv-round]` (head with `[data-rv-where]`, `[data-rv-segs]`,
  `[data-rv-tally]`, and for phones `[data-rv-stop]` and `[data-rv-frac]`), the prompt `[data-rv-card]` (`[data-rv-from]`,
  `[data-rv-seen]`, `[data-rv-q]`, `[data-rv-options]`, `[data-rv-why]`, `[data-rv-when]`, `[data-rv-link]`, `[data-rv-skip]`,
  `[data-rv-next]`), `section[data-rv-state]` (between rounds) and the side panel (`[data-rv-due]`, `[data-rv-rows]`).
- `review.js` starts a round of up to 15 due questions on load (`#practice=<lesson>` still starts practice; `#start` is
  no longer needed). Answers record exactly as before (`R.reviewAnswer`, or `R.answer(…, {kind: 'practice'})`).
  Skip leaves a question due; Esc or the close button ends the round and keeps the answers. Between rounds:
  the score, what you missed with reread links, "Start round n" while anything is due (Enter starts it), otherwise
  continue the lesson or practise. Nothing due shows "Coming up" by day in the side panel.
- The question bank (`scripts/build.py`) has a new field `r`: the start of the question's section (`#s<n>`) or
  `#wrap-up` for quiz questions. `u` still points at the question itself (the instructor page uses it).
- On phones a running round adds `body.rv-running`, which hides the top bar, tab bar, footer, side panel and
  practice; the actions become a fixed bar at the foot.
- Shared change: the letter on a right or wrong option (`.opt.is-correct/.is-wrong .opt-letter`) now uses the page
  colour instead of white, which was unreadable on the light green and rust of dark mode. Lessons get this too.

Original spec:

Boards: `Review`, `ReviewPhone`. Files: `templates/review.html`, `static/js/review.js`.
Open straight into a 15-question round when anything is due. Segmented progress (green and rust per answer), the
question as a prompt, keys A–D and 1–4, Enter for next, Esc to stop. After each answer say when it comes back
("Missed, so it comes back tomorrow", "Right: back in 7 days", from `record.reviewOf(qid)`), with a link to reread the
section. Side panel: due count, due by lesson, how spacing works. Practise-a-lesson stays below.

## Phase 7: progress, concept map, glossary, guide, 404 (done)

What was built (one CSS block per page at the end of `activation.css`; the old `pg-`, `sk-`, `sy-card`, `cm-`,
`gloss-`, `alpha` and `guide-` rules are gone from `site.css` and `learn.css`). None of these pages has the course
sidebar any more.
- **Training log** (`progress.html`, `progress-page.js`): headline numbers (`[data-pg-nums]`; questions are answer ids
  starting `c:`, `q:` or `m:`), this week and goal (`[data-goal]`), "Do next" (uses `DLP.mastery.resumeAt`, which now
  also returns the section title), 26 weeks of study days (a CSS grid placed cell by cell), the skills map (tile colour
  by strength: `s1` under 45%, `s2`, `s3` from 70%, `s4` from 85%; not started is `s0`), badges as numerals, lab
  challenges in lessons you have reached. The lesson-by-lesson table is gone (each tile's title has those numbers).
  The certificate section still renders only when `features.certificate` is on.
- **Sync and privacy**: `sync.js` draws the card into `[data-pg-sync]` ("I have a code" opens the connect row,
  `[data-sy-have]`); the template has a static fallback when no API is configured.
- **Concept map** (`concepts.js`): a dark panel in both themes; `concepts.js` positions every node (`.cn`) and draws
  the links in one SVG, re-laid out when the map's width changes. Below 640px of map width it is a list per module.
  "Selected" fades unrelated concepts; "All links" (`[data-cm-links]`) shows every link. Direct links only (the old
  transitive highlight is gone).
- **Glossary**: rows grouped by letter (`[data-gloss-group]`), a sticky A–Z rail (`[data-gloss-rail]`, marked in
  `app.js`), "Taught in" from the concept map's home lesson (`build.py` passes `homes`). A new hook paints status
  dots anywhere: `data-st-lesson="1.2"` gets `st-none|started|practised|mastered` from `progress.js`. The unused
  `data-lesson-status` code in `app.js` and `progress.js` is gone.
- **Guide**: rewritten for the spine, read mode, top bar and the new review; "What things look like" shows a real
  question card, terminal, bench and the activation scale.
- **404**: outlined numeral, "Course home" and "Search the course".
- `.seg` (segmented control) and `.cn-dot` (status dot) are shared components now.

Original spec:

Boards: `Progress`, `Concepts`, `Glossary`. Files: the matching templates, `progress-page.js`, `concepts.js`.
- Training log: headline numbers (mastered, right first time, questions), this week and goal, "Do next", study days
  heatmap over 26 weeks with month and weekday labels on the viridis scale, skills map as a module-by-lesson matrix
  coloured by strength, badges as numerals, lab challenges as a list, sync and privacy (with the anonymous-counts
  switch). No certificate section.
- Concept map: module columns of nodes with curved edges; selecting a concept highlights what it builds on (solid)
  and leads to (dashed), others fade; side panel with definition, builds on, leads to, taught in.
- Glossary: dictionary rows (term with its home lesson's status node, serif definition, "taught in · used in",
  map link) and a sticky A–Z rail. Guide: update for the spine, read mode and top bar, and show small real
  component examples. 404 in the new type.

## Phase 8: QA and clean-up (done)

Done: the phase 3 leftovers (code cell ⋯ menu as a popover wired in `app.js`; a single short "Pause & think" question
is a margin note, `.q-note`; the end of a lesson is "Mark complete" plus the next lesson as one wide row, keeping the
`pager-link prev/next` classes). `--mc` is gone (inline styles and the bridge rule); everything uses `--mod`.
Dead selectors removed with `scripts/dev/css_audit.py --fix --all` (it also flags classes that clash with the code
highlighter: `.nf`, `.sa`, `.nn` … broke code display once; the spine buttons are now `.spa`, the 404 uses `.e404`).
`scripts/dev/a11y.mjs` (axe-core, WCAG 2.1 AA) is clean on every page, light and dark, at 1440 and 390: `--ink-3`
and `--red` darkened, `--a2-text` for teal text, Run button and note numbers `#1b7f7a`, the old gold replaced by the
activation scale, keyboard access for sideways-scrolling code, tables and maths, focus rings on terms and the editor,
Tab now starts at the skip link on lessons, scripted smooth scrolling respects reduced motion.
The README has a new "The interface" section (the rules and the three checks) and updated page descriptions. The
share images (`scripts/dlp/social.py`) use the dark panel, the site's mark and the activation scale; module colours
are no longer passed to them. They still use the bundled DejaVu fonts (Archivo is not bundled). Fonts: Google Fonts
already serves per-script subsets and browsers fetch only the faces a page uses, so no subsetting was done.

The redesign is complete. For future interface work, run the three checks in the README's "The interface" section
before committing.


Run the screenshot harness on every page; fix sideways scroll, clipped text, contrast (4.5:1 for text), focus
states, keyboard use, reduced motion. Delete dead CSS from `site.css` and `learn.css`, remove the `--mc` bridge rule
and the inline `--mc` styles, and consider subsetting the web fonts. Optionally restyle the share images
(`scripts/dlp/social.py`) to the new palette. Update the README sections that describe the interface.
