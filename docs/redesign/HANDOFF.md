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
| 5 | Module page and one-question-at-a-time module challenge | **Next** |
| 6 | Daily review opens on the first question | To do |
| 7 | Training log (progress), concept map, glossary, guide, 404 | To do |
| 8 | Final QA and CSS clean-up | To do |

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

## Phase 5: module page

Board: `Module`. Files: `templates/module.html`, `_blocks.html` (`mchallenge`), `progress.js` (challenge logic).
Giant outlined numeral, title, the module's question in serif italic, progress panel with "Continue", topics as tags,
lessons as a connected list (node, number, title, 2-line summary, meta, state and one action). The module challenge
becomes one question at a time (show one `.quiz-q`, Next and Back, a score and explanations at the end); keep
`R.challenge(id, right, true, {passed})` so badges still record.

## Phase 6: daily review

Boards: `Review`, `ReviewPhone`. Files: `templates/review.html`, `static/js/review.js`.
Open straight into a 15-question round when anything is due. Segmented progress (green and rust per answer), the
question as a prompt, keys A–D and 1–4, Enter for next, Esc to stop. After each answer say when it comes back
("Missed, so it comes back tomorrow", "Right: back in 7 days", from `record.reviewOf(qid)`), with a link to reread the
section. Side panel: due count, due by lesson, how spacing works. Practise-a-lesson stays below.

## Phase 7: progress, concept map, glossary, guide, 404

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

## Phase 8: QA and clean-up

Run the screenshot harness on every page; fix sideways scroll, clipped text, contrast (4.5:1 for text), focus
states, keyboard use, reduced motion. Delete dead CSS from `site.css` and `learn.css`, remove the `--mc` bridge rule
and the inline `--mc` styles, and consider subsetting the web fonts. Optionally restyle the share images
(`scripts/dlp/social.py`) to the new palette. Update the README sections that describe the interface.
