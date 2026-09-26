# Deep Learning Lab

An interactive learning platform generated from the course notebooks of **Modern Deep Learning & AI Engineering**.
Every lesson is the full teaching note, restructured for the web and enriched with explainers, animations,
interactive labs, worked answers to every question, and a quiz.

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
course.yaml           (modules, terminology, sources)             │
glossary.yaml         (hover definitions)                         │
templates/ + static/  (design, behaviour, widgets)               ─┘
```

| Path | What it is |
|---|---|
| `course.yaml` | Course title, the 10 modules (question, topics, hands-on), terminology rules ("Day" → "Module", "Note" → "Lesson"), and where notebooks come from |
| `notes/` | The lesson notebooks the site is built from (one per lesson). `notes/sources.json` records which original file each came from |
| `enrichments/` | The hand-written teaching layer, one YAML file per lesson. Never modifies the notebook |
| `glossary.yaml` | Terms shown with a dotted underline; hover or tap for a definition |
| `templates/` | Jinja2 page templates |
| `static/css`, `static/js` | Styles, page behaviour (`app.js`), the widget toolkit (`js/lib/core.js`) and widgets (`js/widgets/*.js`) |
| `scripts/build.py` | The generator. `scripts/dlp/` contains the notebook parser, renderers, enrichment and glossary logic |
| `tutor-proxy/` | Cloudflare Worker that relays AI-tutor requests to Groq while keeping the API key secret |
| `dist/` | Build output. Don't edit; it's regenerated every build (and ignored by git) |

### What the converter understands in a notebook

| In the notebook | On the platform |
|---|---|
| `# Day N — Title` | Module title |
| `## Note N.M — Title` | Lesson number and title |
| Headings before section 1 (*Goal/Outcome*, *Objectives*, *Dataset*, *Runtime*, *Setup*, *Table of contents*) | The lesson's "Before you start" cards; setup cells fold into a Setup panel; the table of contents is replaced by the live sidebar |
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
    type: explainer              # explainer | widget | predict | steps | compare | figure | quiz | html
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

- `make defs L=2.2` lists every function/class in a lesson with its docstring status.
- The build **warns** about any definition with no docstring, or with a one-line docstring despite taking arguments.
- For new modules, `GROQ_API_KEY=gsk_... make docstrings L=5.1` drafts the missing ones with the AI model into
  `enrichments/5.1.docstrings.yaml` (add `ARGS=--all` to also upgrade one-liners). Review the drafts; anything you write
  under `docstrings:` in `enrichments/5.1.yaml` overrides them.

### Widgets available

| Name | What it does | Used in |
|---|---|---|
| `pipeline-flow` | Animated classical-ML vs deep-learning pipeline | 1.1 |
| `spiral-lab` | Trains logistic regression / engineered features / a neural network live on the two spirals; shows hidden units | 1.1 |
| `spiral-unroll` | Morphs the spiral into (radius, aligned angle) space | 1.1 |
| `results-bars` | Animated comparison bars for recorded results (`props.metrics`) | 1.1 |
| `dl-or-not` | Gradient boosting vs neural network rule-of-thumb helper | 1.1 |
| `scale-contours` | Gradient descent on loss contours; feature-scale and learning-rate sliders | 1.1 |
| `pixel-lab` | 8×8 digits as 64 numbers, one-pixel shifts, the "ink" feature | 1.1 |

**Adding a widget:** create `static/js/widgets/<name>.js` that registers
`window.DLP.widgets['<name>'] = function (mountEl, props) { … }`. Use the helpers in `static/js/lib/core.js`
(`L.canvas`, `L.slider`, `L.segmented`, `L.MLP`, `L.lineChart`, `L.palette`, `L.onTheme`, …).
Read colours from `L.palette()` so the widget follows light and dark mode. Pages only load the widgets they use.

---

## AI tutor (Qwen on Groq)

Every page has an **Ask the tutor** button. The tutor sees the lesson, the section being read and, from a question
card, the learner's own written answer plus the course's reference answer, so it can **check answers**, give **hints**,
**explain code cells**, explain any **selected passage**, quiz the learner, or summarise the lesson.

Configuration lives under `tutor:` in `course.yaml` (model `qwen/qwen3.8-27b` on Groq). There are two ways to connect it:

| Mode | How | Who pays |
|---|---|---|
| **Course key (recommended)** | Deploy `tutor-proxy/` (a Cloudflare Worker) with your Groq key as a secret, then set `tutor.endpoint` to its URL | You |
| **Personal key** | Leave `endpoint` empty; each learner pastes their own free Groq key in the tutor panel (stored only in their browser) | Each learner |

**Never put an API key in `course.yaml` or anywhere in this repository.** The website is public.

Deploying the proxy (one-time, needs a free Cloudflare account):

```bash
cd tutor-proxy
npx wrangler login
npx wrangler deploy                    # prints https://deep-learning-lab-tutor.<you>.workers.dev
npx wrangler secret put GROQ_API_KEY   # paste the key when prompted
```

Then set `tutor.endpoint: "https://deep-learning-lab-tutor.<you>.workers.dev"` in `course.yaml` and run `make publish`.
`ALLOWED_ORIGINS` in `tutor-proxy/wrangler.toml` restricts which sites may use it. Uncomment the rate-limit block to cap
requests per visitor.

To test locally with a key: `GROQ_API_KEY=gsk_... python scripts/tutor_dev_proxy.py`, set
`tutor.endpoint: "http://localhost:8787"`, then `make serve`.

## Hosting on GitHub Pages

1. Create a repository (for example `deep-learning-lab`) and push this folder to its `main` branch.
2. In the repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Every push to `main` runs `.github/workflows/deploy.yml`, which builds the site and publishes it at
   `https://<user>.github.io/<repo>/`.
4. Optional: set `course.github_repo: "<user>/<repo>"` in `course.yaml` to add **Open in Colab** buttons to every lesson.

The site uses relative links, so it works under any sub-path and on a custom domain.

## Requirements

Python 3.10+ with the packages in `requirements.txt` (`pip install -r requirements.txt`). No Node.js needed.
