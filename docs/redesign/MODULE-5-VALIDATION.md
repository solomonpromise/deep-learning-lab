# Module 5 figures — 2 October 2026

- The four owner-supplied notebooks now follow the builder’s `lesson-5.N.ipynb` naming convention. All 19 lessons build, including Module 5’s four lessons and 48 sections.
- Ten image prompts were replaced by high-resolution PNG attachments with descriptive alt text and captions. The original code cells, saved code outputs and prose outside the figure prompts remain intact. SVG originals and a reproducible drawing/embedding script are included.
- The generator was rerun successfully against the already-illustrated notebooks. Module 5 is protected from replacement by `make sync` through the existing source-lock mechanism.
- All local HTML links and asset paths resolve. No Module 5 image prompts or unresolved attachment URLs remain in the generated pages.
- `scripts/dev/module5.mjs` passed 60 figure/viewport/theme cases: all ten figures at 1440, 1280 and 390 pixels, in light and dark mode. Every image decoded, retained its caption/alt description, fit the page and opened/closed in the zoom viewer; no JavaScript errors occurred.
- The figure-bearing sections passed automated WCAG 2.1 A/AA checks at 1440 and 390 pixels in both themes (40 cases). These checks are bounded, not a full accessibility audit.
- Phone testing identified a timing gap in keyboard access to newly visible code regions. Section navigation now immediately refreshes the existing scroll-region focus treatment, rather than waiting for the resize debounce.
- `scripts/dev/redesign.mjs` passed against all 19 lessons: 220 section destinations, 66 mounted lab instances, stored learner progress, scheduled review, checkpoints, notes, tutor opening, lesson modes, search, resume and mobile navigation.
- Notebook training/download cells were not rerun. Their owner-supplied saved results are preserved; automated browser checks block external services.

Figure concepts were checked against the [SimCLR paper](https://arxiv.org/abs/2002.05709) and [CLIP paper](https://arxiv.org/abs/2103.00020). Numeric convolution outputs and vector geometry are calculated from the displayed inputs. Illustrative activations, vector values and pair matrices are identified as schematic.
