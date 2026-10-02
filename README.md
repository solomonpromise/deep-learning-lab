# Deep Learning Lab

An interactive learning platform generated from the course notebooks of **Modern Deep Learning & AI Engineering**.
Every lesson is the full teaching note, restructured for the web and enriched with explainers, animations,
interactive labs, worked answers to every question, and a quiz. Learners answer a checkpoint at the end of every section,
run Python in the browser, review what they answered with spaced repetition, earn module badges, and can carry their
progress between devices with a private code. (A verifiable certificate is built in but switched off for now: see
`features.certificate` below.)

The site is **static** (plain HTML, CSS and JavaScript), so it can be hosted for free on GitHub Pages, Netlify or any web server.
It also opens straight from disk.

---

## Everyday workflow

```bash
make update     # 1. pull new/changed notebooks from ../Day N folders and rebuild the site
make serve      # 2. preview at http://localhost:8000   (make defs L=5.1 → check docstrings)
make publish    # 3. commit + push; GitHub Actions rebuilds and redeploys the live site
```

### Adding a new module (e.g. Day 5)

1. Put the notebooks in `../Day 5/` as usual (any file names).
2. Run `make update`. The sync step reads each notebook's `## Note 5.1 — Title` heading, picks the best version of
   each lesson (files named `*_self_sufficient*` or `*_updated*` win; otherwise the newest), and copies it to
   `notes/module-5/lesson-5.1.ipynb`.
3. Module 5 lights up on the course map automatically, with every section, figure, code cell, output and question.
4. *(Optional, recommended)* write `enrichments/5.1.yaml` to add the teaching layer (see below).

You can also drop notebooks straight into `notes/module-N/lesson-N.M.ipynb`.

---

## How the pieces fit

```text
../Day N/*.ipynb ──make sync──▶ notes/module-N/lesson-N.M.ipynb ─┐
                                                                  ├─▶ scripts/build.py ──▶ dist/  (the website)
enrichments/N.M.yaml  (teaching layer)                            │
enrichments/N.M.checkpoints.yaml, module-N.challenge.yaml        │
course.yaml           (modules, terminology, sources, services)   │
glossary.yaml         (hover definitions)                         │
concepts.yaml         (how the terms connect)                     │
templates/ + static/  (design, behaviour, widgets)               ─┘
```

| Path | What it is |
|---|---|
| `course.yaml` | Course title, the 10 modules (question, topics, hands-on), terminology rules ("Day" → "Module", "Note" → "Lesson"), and where notebooks come from |
| `notes/` | The lesson notebooks the site is built from (one per lesson). `notes/sources.json` records which original file each came from |
| `enrichments/` | The hand-written teaching layer, one YAML file per lesson (plus its checkpoints, and one challenge per module). Never modifies the notebook |
| `glossary.yaml` | Terms shown with a dotted underline; hover or tap for a definition |
| `concepts.yaml` | For the concept map: the lesson that teaches each glossary term and the terms it builds on |
| `templates/` | Jinja2 page templates |
| `static/css`, `static/js` | Styles (colour tokens at the top of `site.css`, the design system in `activation.css`), page behaviour (`app.js`), the widget toolkit (`js/lib/core.js`) and widgets (`js/widgets/*.js`) |
| `scripts/dev/` | Checks for the built site: screenshots, an accessibility audit and a CSS audit (see *The interface* below) |
| `scripts/build.py` | The generator. `scripts/dlp/` contains the notebook parser, renderers, enrichment and glossary logic |
| `tutor-proxy/` | Cloudflare Worker: relays AI-tutor requests to Groq while keeping the API key secret, and serves the course API (sync, answer counts, certificates, challenge results) from a D1 database |
| `dist/` | Build output. Don't edit; it's regenerated every build (and ignored by git) |

### What the converter understands in a notebook

| In the notebook | On the platform |
|---|---|
| `# Day N — Title` | Module title |
| `## Note N.M — Title` | Lesson number and title |
| Headings before section 1 (*Goal/Outcome*, *Objectives*, *Dataset*, *Runtime*, *Setup*, *Table of contents*) | The lesson's "Before you start" rows; setup cells fold into a Setup panel; the table of contents is replaced by the lesson's spine (its outline on the left) |
| `## 3. Section title` | A numbered section (with progress tracking and a TOC entry) |
| `### Sub-heading` | A sub-section (listed in the TOC) |
| `## Conclusion`, `## Transition to …` | Styled summary and an "Up next" card linking the next lesson |
| `**Questions.**`, `**Check your understanding**`, `**Question.**`, `**Check yourself.**` + a list | *Check your understanding* card with a notes box and (if written) explanations |
| `**Think before you continue.**`, `**Predict**` | *Pause & think* card |
| `**Try it.**`, `**Your turn**`, `**Exercise**` | *Try it yourself* card |
| `> quote` | A highlighted *key idea* |
| `> **🖼️ IMAGE 1.1.2 — Title**` followed by an image | A numbered figure with that caption |
| Math `$…$` / `$$…$$` | Typeset with KaTeX |
| Code cells + outputs | Highlighted code with copy button, text / table / plot / error outputs (long ones fold) |
| `%%writefile path/to/file.yaml` cells | Labelled "Writes path/to/file.yaml" and highlighted by file type (Python files also get docstrings) |

---

## The teaching layer (`enrichments/N.M.yaml`)

Everything is optional. Anchors are **text snippets** copied from the notebook, so re-exporting a notebook doesn't break them.
The build prints a warning if an anchor can't be found.

```yaml
summary: |                       # "the big idea" shown under the lesson title
  One paragraph, markdown allowed.

inserts:                         # things placed inside sections
  - section: 3                   # section number (optional: search all sections)
    after: "text from a cell"    # or: before: "…"   or: at: start|end
    type: explainer              # explainer | widget | predict | steps | compare | figure | quiz | exercise | html
    style: plain                 # plain | analogy | why | deep | warning | tip | math | recap | remember | code | result
    title: "Radius and angle in plain English"
    md: |
      Markdown **with** $math$.

  - section: 6
    after: "The earlier layers are the feature engineering"
    type: widget
    name: spiral-lab             # a file in static/js/widgets/
    title: "Spiral Lab"
    props: { model: network }    # passed to the widget
    intro: "Shown above the widget (markdown)."
    caption: "Shown below the widget (markdown)."

  - section: 1
    after: "Suppose every input feature"   # a worked question written as prose …
    type: questions              # … becomes a question card with a hidden explanation
    replace: 2                   # remove the anchor block and the one before it (e.g. its heading)
    items:
      - { q: "Question text?", a: "Explanation (markdown)" }

  - type: predict                # "commit to a guess, then reveal"
    mode: choice                 # or: number (slider with min/max/step/answer/tolerance)
    prompt: "What accuracy do you expect?"
    options: ["~50%", "~60%", "~99%"]
    answer: 1
    reveal: "Explanation shown after answering."

  - type: steps                  # a step-by-step walkthrough (optional svg per step)
    title: "Backprop by hand"
    steps:
      - { title: "Forward pass", md: "…", svg: "<svg …>…</svg>" }

  - type: compare                # side-by-side cards
    items:
      - { title: "Raw space", tone: orange, icon: alert, md: "…" }
      - { title: "Engineered space", tone: green, icon: check, md: "…" }

answers:                         # explanations for the lesson's question cards
  "3-1":                         # "<section>-<n-th question card in that section>"
    - "Answer to question 1 (markdown)"
    - "Answer to question 2"

explain:                         # line-by-line notes on a code cell
  - cell: "def make_spirals"     # text that identifies the cell
    summary: "What the whole cell does."
    lines:
      - { match: "rng = np.random.default_rng", note: "What this line does." }

takeaways: ["…", "…"]            # the Key takeaways box
quiz:                            # end-of-lesson multiple-choice quiz
  - q: "Question?"
    options: ["A", "B", "C"]
    answer: 1
    why: "Why B is right."
```

**Finding question IDs:** `make questions L=1.2` prints every question card with its ID and text, ready to paste into `answers:`.

Quiz and checkpoint options are **shuffled at build time**, seeded by the question's id, so write the right answer
wherever it reads best: the same question always shows its options in the same order, and the correct letter is spread
evenly across a lesson.

### Checkpoints (`enrichments/N.M.checkpoints.yaml`)

A checkpoint closes each section: one or two multiple-choice questions with instant feedback, and optionally an
"explain it back" prompt that the AI tutor grades against key points (without a tutor, the learner compares their
answer with the key points themselves). The build warns about section numbers that don't exist.

```yaml
skill: Optimizers & learning rate      # the skill this lesson feeds on My progress
sections:
  2:                                   # section number
    questions:
      - q: "In a long, narrow valley, plain SGD zig-zags. What does momentum do?"
        options: ["…", "…", "…", "…"]
        answer: 1
        why: "Shown after answering, right or wrong."
    explain: "Explain in two sentences why momentum helps in a narrow valley."
    key: |                             # what a good answer contains (the tutor grades against it)
      - Sign-flipping components cancel in the velocity, so the zig-zag shrinks.
```

Every answered question joins the learner's **daily review** (Leitner boxes, `static/js/record.js`): a miss comes back
tomorrow, a first-time right answer in a week, and each later right answer after a longer gap (3, 7, 16, 35, then 90 days). Question ids are `c:<lesson>:<section>:<n>`, so reordering questions resets their review history.

### Code exercises (`type: exercise`)

A small function to complete in the browser. `check` runs after the learner's code, in the same namespace; a failed
`assert` shows its message as the hint. Blanks are written `___`. Exercises run with Pyodide (NumPy, pandas,
scikit-learn, Matplotlib; no PyTorch) and work in every lesson.

```yaml
  - section: 4
    after: "text from a cell"
    type: exercise
    title: "Standardise per feature"
    prompt: "Complete `standardise` (markdown)."
    starter: |
      def standardise(X):
          return (X - X.mean(axis=___, keepdims=True)) / X.std(axis=___, keepdims=True)
    check: |
      Z = standardise(np.random.default_rng(0).normal(size=(200, 4)) * 50)
      assert np.allclose(Z.mean(axis=0), 0), "Each COLUMN should have mean 0: reduce along axis 0"
    solution: |
      …
    hints: ["Axis 0 is the batch."]
    success: "Shown when every check passes."
```

**Runnable code cells.** Lessons listed under `run_in_browser` in `course.yaml` also get **Run** and **Edit** buttons
on their notebook cells, which share one namespace per lesson like a notebook. Cells that need PyTorch or install
packages (the `skip` patterns) are left alone.

### Lab challenges

Any widget insert can carry a challenge: a goal, the conditions that count as meeting it, and the number that ranks a
result. Widgets report their state through a `dlp:metrics` event (spiral-lab, unit-health, clip-lab, precision-lab,
seed-roulette and case-library do). The learner sees their best result, the share of other results it beats (when the
course API is on) and a share button.

```yaml
    challenge:
      id: clip-fast                                   # unique across the course
      title: "Down the cliff, fast"
      goal: "Choose a learning rate and `max_norm` so the clipped path reaches the minimum in **6 steps or fewer**."
      require: [["clippedSteps", "<=", 6, "reach the minimum in 6 clipped steps or fewer"]]
      score: clippedSteps                             # the metric that ranks results
      better: lower                                   # or: higher
      unit: steps
      share: "I got clipped gradient descent down a cliff in {clippedSteps} steps (lr {lr})"
```

### Module challenges (`enrichments/module-N.challenge.yaml`)

Harder scenario questions that mix a module's lessons, shown on the module's overview page. Passing (`pass_mark`
of them right) earns the module badge. With the certificate switched on, the badges are what it lists.

```yaml
title: "Module 3 challenge: why a network learns well, badly, or not at all"
pass_mark: 0.75
questions:
  - { q: "…", options: ["…", "…", "…", "…"], answer: 1, why: "…" }
```

### The concept map (`concepts.yaml`)

`concepts.html` shows every glossary term in the module of the lesson that teaches it, with arrows to the terms it
builds on. Selecting one highlights everything it rests on and everything that rests on it.

```yaml
Adam: { home: "3.1", builds_on: [Optimizer, Momentum, Learning rate], later: { 8: "AdamW state is why full fine-tuning is expensive" } }
```

`home` is the lesson that teaches the term; `later` names unpublished modules that pick it up again. The other lessons
that use a term come from the glossary at build time. The build warns when a term builds on one taught in a later
module, or names a term the glossary doesn't have. A new glossary term appears on the map without being listed here,
placed by where it is used most.

### Docstrings for every function and class

Every function and class shown in a lesson gets a complete, Google-style docstring: a summary, what it does and
why, `Args:`, `Returns:` and `Raises:`. Docstrings live in the lesson's enrichment file and are inserted into both the
displayed code and the **downloadable notebook**. The original notebooks are never edited.

```yaml
docstrings:
  make_spirals: |            # top-level function
    Generate two interleaved spiral arms, one per class.

    Args:
        n_per_class: Number of points for each class.
    Returns:
        A tuple ``(X, y)`` ...
  SpiralNet.forward: |       # a method: Class.method
    Run a batch through the network. ...
  encode_features.finish: |  # a nested function: outer.inner
    ...
```

- A docstring in the notebook that starts with "Placeholder" marks a stub the notebook replaces further down; it is
  kept as written, and only the real definition takes the docstring from the enrichment file.
- `make defs L=2.2` lists every function/class in a lesson with its docstring status.
- The build **warns** about any definition with no docstring, or with a one-line docstring despite taking arguments.
- For new modules, `GROQ_API_KEY=gsk_... make docstrings L=5.1` drafts the missing ones with the AI model into
  `enrichments/5.1.docstrings.yaml` (add `ARGS=--all` to also upgrade one-liners). Review the drafts; anything you write
  under `docstrings:` in `enrichments/5.1.yaml` overrides them.

### Widgets available

This table is generated: run `make widgets` after adding or changing a lab.

<!-- widgets:start -->
| Name | What it does | Used in |
|---|---|---|
| `broadcast-bug` | predictions (N,) against targets (N,1) silently become an N×N comparison | 2.1 |
| `bug-lab` | the three silent bugs of Lesson 1.3, reproduced live on the spirals | 1.3 |
| `case-library` | diagnose broken training runs the way Lesson 3.4's protocol orders the checks | 3.4 |
| `clip-lab` | one step off a cliff, with and without gradient clipping | 3.3 |
| `contiguity-viz` | why view() sometimes refuses and reshape() copies | 2.1 |
| `curve-doctor` | diagnose a training run from its loss curves alone | 1.3, 3.1, 3.2, 3.4 |
| `dataloader-viz` | how a Dataset's examples become batches | 2.2 |
| `dl-or-not` | a rule-of-thumb decision helper: gradient boosting vs a neural network | 1.1 |
| `dropout-lab` | one hidden layer of 12 units feeding one output, for one fixed input row | 3.2 |
| `early-stopping` | keep the best weights, not the last | 2.3 |
| `gitignore-lab` | edit the rules and watch which files of the Lesson 2.4 project git would keep | 2.4 |
| `gradient-flow` | Lesson 3.3's per-layer gradient probe, computed live | 3.3 |
| `leakage-lab` | the score your split reports against the score the model earns in real use | 4.1 |
| `logit-stability` | why the loss takes logits, not probabilities | 2.3 |
| `logit-temperature` | what loss, ROC-AUC and accuracy can each see | 3.2 |
| `loss-contract` | what shapes and dtypes each loss function expects, and what happens if you get it wrong | 2.1 |
| `loss-vs-accuracy` | why we train on a smooth loss, not on accuracy | 1.2 |
| `lr-explorer` | the same gradient, three completely different outcomes | 1.2 |
| `lr-schedules` | the learning rate each epoch trains with, under four common schedules | 3.1 |
| `memory-planner` | the bytes a run needs before it starts, from the parameter count, the number format, the optimizer, the trainable share and the batch | 4.3 |
| `minibatch-paths` | full-batch vs mini-batch gradient descent on the same loss surface | 2.2 |
| `module-registry` | what nn.Module can see, and what the optimizer therefore updates | 2.3 |
| `momentum-valley` | plain SGD and SGD with momentum, side by side in a long, narrow valley | 3.1 |
| `neuron-playground` | one neuron: weighted sum + bias, then an activation | 1.2 |
| `noise-floor` | how far a validation score moves when only the split changes | 3.2 |
| `notebook-state` | hidden state, reproduced | 2.4 |
| `onehot-viz` | ordinal codes invent distances; one-hot keeps every category equally far apart | 2.2 |
| `paired-lab` | why comparing two models on the same splits beats comparing their averages | 4.4 |
| `param-counter` | parameters and memory of a stack of Linear layers, from their widths alone | 2.1, 2.3, 2.4 |
| `pipeline-flow` | classical ML vs deep learning pipelines, animated | 1.1 |
| `pixel-lab` | why raw pixels defeat hand-written features | 1.1 |
| `precision-lab` | what fp32, fp16 and bf16 can hold, and why fp16 training needs a loss scaler | 4.3 |
| `predict-rounds` | commit to a prediction, then see the lesson's real result, one round at a time | 4.4 |
| `project-map` | the bank_marketing_project repository built in Lesson 2.4, file by file | 2.4 |
| `relu-bends` | why non-linearity is structurally necessary | 1.2 |
| `results-bars` | animated side-by-side comparison of recorded results | 1.1, 3.1, 3.2, 4.1 |
| `scale-contours` | why feature scale matters to gradient descent | 1.1 |
| `seed-roulette` | train the same small network ten times and watch the score move when nothing that matters changed | 4.2 |
| `slope-probe` | a gradient is a local slope | 1.2 |
| `spiral-lab` | train three models on the two-spirals problem, live in the browser | 1.1, 1.3 |
| `spiral-unroll` | animate the change of representation from (x1, x2) to (radius, aligned angle) | 1.1 |
| `tensor-shapes` | see shapes instead of imagining them | 1.3, 2.1 |
| `threshold-explorer` | ranking vs classification on an imbalanced problem | 2.3, 4.1 |
| `tiny-net` | "be the optimiser" on the exact 2-2-1 network of Lesson 1.2 | 1.2 |
| `training-loop` | the six canonical lines, executed one at a time on a model you can watch | 1.3 |
| `unit-health` | watch every hidden unit of a real network: identical twins from a symmetric start, dead ReLUs from a learning rate that is too large | 3.3 |
<!-- widgets:end -->

**Adding a widget:** create `static/js/widgets/<name>.js` that registers
`window.DLP.widgets['<name>'] = function (mountEl, props) { … }`. Use the helpers in `static/js/lib/core.js`
(`L.canvas`, `L.slider`, `L.segmented`, `L.MLP`, `L.lineChart`, `L.palette`, `L.onTheme`, …).
Read colours from `L.palette()` so the widget follows light and dark mode. Pages only load the widgets they use.

---

## AI tutor (Qwen on Groq)

Every page has an **Ask the tutor** button. The tutor sees the lesson, the section being read and, from a question
card, the learner's own written answer plus the course's reference answer, so it can **check answers**, give **hints**,
**explain code cells**, explain any **selected passage**, quiz the learner, or summarise the lesson. It also gets an
outline of the whole course (`static/course-map.js`, written by the build), and when the learner mentions another module
or lesson ("Module 2", "Lesson 3.4", "day 4") it receives that lesson's summary, objectives and section titles, so it can
answer questions about the rest of the course and link to the right lesson.

Configuration lives under `tutor:` in `course.yaml` (model `qwen/qwen3.8-27b` on Groq). There are two ways to connect it:

| Mode | How | Who pays |
|---|---|---|
| **Course key (recommended)** | Deploy `tutor-proxy/` (a Cloudflare Worker) with your Groq key as a secret, then set `tutor.endpoint` to its URL | You |
| **Personal key** | Leave `endpoint` empty; each learner pastes their own free Groq key in the tutor panel (stored only in their browser) | Each learner |

Both can be on at once: a learner who saves their own key always uses it, which keeps them off the course key's shared
rate limit; everyone else uses the course proxy.

**Never put an API key in `course.yaml` or anywhere in this repository.** The website is public.

The tutor's Markdown renderer (marked, DOMPurify) and KaTeX load from jsDelivr at pinned versions with
[Subresource Integrity](https://developer.mozilla.org/docs/Web/Security/Subresource_Integrity) hashes, so a tampered CDN
copy is refused by the browser instead of running next to a learner's saved key. When upgrading one of them, update its
hash too (`templates/base.html`, `static/js/tutor.js`): download the file from the npm package and run
`openssl dgst -sha384 -binary FILE | openssl base64 -A`.

Deploying the proxy (one-time, needs a free Cloudflare account):

```bash
cd tutor-proxy
npx wrangler login
npx wrangler deploy                    # prints https://deep-learning-lab-tutor.<you>.workers.dev
npx wrangler secret put GROQ_API_KEY   # paste the key when prompted
```

Then set `tutor.endpoint: "https://deep-learning-lab-tutor.<you>.workers.dev"` in `course.yaml` and run `make publish`.
`ALLOWED_ORIGINS` in `tutor-proxy/wrangler.toml` restricts which sites may use it, and its `[[ratelimits]]` block caps each
visitor at 20 questions a minute (change `limit` there; `period` must be 10 or 60 seconds). Redeploy after editing either.

To test locally with a key: `GROQ_API_KEY=gsk_... python scripts/tutor_dev_proxy.py`, set
`tutor.endpoint: "http://localhost:8787"`, then `make serve`.

## Progress, sync and the course API

Everything a learner does (answers, notes, review schedule, streak, badges) is kept in their browser under one
record (`static/js/record.js`). No account is needed. The pages built on it:

| Page | What it shows |
|---|---|
| `review.html` | The daily review: opens on the first question due (rounds of 15, keys A–D, Enter, Esc), and practice for any lesson |
| `progress.html` | The training log: lessons mastered, this week and the weekly goal, what to do next, 26 weeks of study days, the skills map, badges, lab challenge results, and sync and privacy |
| `certificate.html` | The certificate, listing the modules passed; printable, downloadable as PNG. Only built when `features.certificate` is `true` |
| `concepts.html` | The concept map: each glossary term in the module that teaches it, its links, and how far you are with its lesson |
| `instructor.html` | Answer counts per question, for the course author (not linked, not indexed; needs the stats token) |

With `services.api` set in `course.yaml`, the same Worker as the tutor adds a small API (`tutor-proxy/api.js`, storage in
the D1 database from `tutor-proxy/schema.sql`):

- **Sync**: a learner turns it on under *My progress* and gets a private 20-character code. Entering it (or opening
  the link it gives) on another device merges the two records. The tutor key is never synced.
- **Anonymous answer counts**: a question id and right or wrong, nothing else. Learners can switch it off, and it is
  off for browsers that send Do Not Track and on local previews (`make serve`), so testing doesn't skew the counts. The instructor page reads them with a token.
- **Certificates** get an id and a public verification link (when `features.certificate` is on).
- **Lab challenges** report the share of earlier results a new one beats.

`features.certificate` in `course.yaml` switches the certificate on or off. It is off for now: `certificate.html` is not
built, and the progress page, the module challenges and the guide stop mentioning it. Module badges keep working. The
Worker's certificate endpoints and records are untouched, so setting it back to `true` restores everything.

One-time setup, after the tutor proxy (below) is deployed:

```bash
cd tutor-proxy
npx wrangler d1 create deep-learning-lab          # copy the database_id into wrangler.toml
npx wrangler d1 execute deep-learning-lab --remote --file=schema.sql
npx wrangler secret put STATS_TOKEN               # any long random string; you type it on instructor.html
npx wrangler deploy
```

Leave `services.api` empty to turn all of this off: the site then keeps everything in each learner's browser.

## Discussions (giscus)

With the `discussions:` block in `course.yaml`, every lesson ends with a discussion thread on the repository's GitHub
Discussions, through [giscus](https://giscus.app). Reading needs nothing; posting needs a GitHub account. Nothing loads
from giscus until a learner opens the discussion. Setup: enable Discussions on the repository, install the
[giscus app](https://github.com/apps/giscus) on it, and copy `repo_id` and `category_id` from giscus.app.

## Sharing previews

Each lesson, module and the home page gets a 1200×630 preview image (drawn at build time, `scripts/dlp/social.py`) and
Open Graph tags, so a link shared in a chat or on social media shows the lesson's title and module. Set `site_url` in
`course.yaml` to the live address so the tags carry absolute URLs.

## The interface

The design ("Activation") has a few rules, which `docs/redesign/HANDOFF.md` sets out with the mockups in
`docs/redesign/mockups/`:

- **Colour means progress, and only progress.** Matplotlib's viridis in four steps: started (blue), practised (teal),
  strong (green), mastered (yellow); not started is a hollow node. Data classes in labs are blue and orange; green and
  rust mean right and wrong, always with a tick or cross. Modules are told apart by their number, not a colour.
- **Three typefaces.** Archivo for the interface, Source Serif 4 for the lesson text, JetBrains Mono for code, labels and
  numbers you can measure.
- **Four materials.** Paper for prose; a white card with a "?" for every question; a dotted bench, wider than the text,
  for every lab; a dark terminal for every code cell (Run in the header, the rest in its ⋯ menu).
- **One navigation per page.** Lessons have a spine (their outline) with the course tree as a drawer; other pages have the
  top bar, and phones a tab bar. Short notes sit in the margin beside the text they explain. Read mode (`F`) leaves
  only the text.

New styles go in `static/css/activation.css`; the colour tokens (light and dark) are at the top of `static/css/site.css`.
Before committing a change to the interface, build, run `make serve`, and check it:

```bash
npm install --no-save playwright axe-core           # once (Node.js is only needed for these checks)
CHANNEL=chrome node scripts/dev/screenshots.mjs      # every page at 1440, 1280 and 390 px and in dark, into .shots/;
                                                     # reports sideways scroll and JavaScript errors
CHANNEL=chrome node scripts/dev/a11y.mjs             # WCAG 2.1 AA (contrast, names, keyboard), light and dark
python3 scripts/dev/css_audit.py                     # selectors nothing uses, and classes that clash with the code
                                                     # highlighter (.nf, .sa …); --fix removes the dead ones
```

`CHANNEL=chrome` uses the installed Google Chrome; leave it out after `npx playwright install chromium`. Both browser
scripts load a sample learner partway through Module 3, so the pages show real progress.

## Hosting on GitHub Pages

1. Create a repository (for example `deep-learning-lab`) and push this folder to its `main` branch.
2. In the repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Every push to `main` runs `.github/workflows/deploy.yml`, which builds the site and publishes it at
   `https://<user>.github.io/<repo>/`.
4. Optional: set `course.github_repo: "<user>/<repo>"` in `course.yaml` to add **Open in Colab** buttons to every lesson.

The site uses relative links, so it works under any sub-path and on a custom domain.

## Requirements

Python 3.10+ with the packages in `requirements.txt` (`pip install -r requirements.txt`). Building and serving need no
Node.js; only the checks in `scripts/dev/` do.
