# Deep Learning Lab

A static site generated from course notebooks: `notes/` + `enrichments/` + `course.yaml` → `dist/` via
`scripts/build.py`. Plain HTML/CSS/JS, no bundler. `dist/` is build output: never commit it.

## Commands
- `make serve`: build and serve at http://localhost:8000
- `python3 scripts/build.py`: build only (about 20 s)
- `node scripts/dev/screenshots.mjs [pages…]`: screenshots at desktop, laptop, phone and dark with a sample
  learner, into `.shots/` (needs `make serve` running and `npm install --no-save playwright`; add `CHANNEL=chrome` to
  use the installed Google Chrome instead of downloading Playwright's browser)

## UI redesign in progress
A full redesign ("Activation") was approved and is being built phase by phase.
**Read `docs/redesign/HANDOFF.md` before any UI work**: it has the status, the design rules, the mockups
(`docs/redesign/mockups/`), and a spec for each remaining phase.

## Conventions
- New styles go in `static/css/activation.css`; colour tokens are at the top of `static/css/site.css`.
- Keep the `data-*` hooks that `static/js/` reads when changing markup.
- Check every UI change at 1440, 1280 and 390 px, light and dark, and with no JS errors, before committing.
- The certificate is switched off (`features.certificate: false` in `course.yaml`); keep it off unless asked.
- Commit messages and PR descriptions say what changed for the learner, then the technical detail.
