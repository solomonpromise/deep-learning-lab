# Forest-and-cream redesign validation — 2 October 2026

- The site builds from its notebooks with all 15 published lessons. All local HTML links and asset paths resolve.
- Responsive route checks covered 14 destinations at 1440, 1280 and 390 pixels and in dark mode (56 combinations). Final captures of the homepage, workspace and lesson were repeated after the last style changes. No page-wide horizontal overflow or JavaScript errors.
- `scripts/dev/redesign.mjs` passed: homepage object/layer controls, course search, single-section navigation, existing question/section hashes, read mode, whole-lesson view, completion persistence, checkpoints, notes, tutor opening, dashboard resume, full curriculum, reference links, roadmap pages, review with an existing learner record, and mobile course/section drawers.
- All 172 section destinations across the 15 lessons opened correctly; 66 lab instances mounted. Every Lesson 1.1 section also fits 1280 and 390 pixels in both themes.
- Automated WCAG 2.1 A/AA checks passed on the 13 standard pages at 1440 and 390 pixels, in light and dark mode. Additional checks passed on Lesson 1.1 sections 3 and 6 and wrap-up in both widths/themes, plus instructor and roadmap pages. These are bounded automated checks, not a full accessibility audit.
- Actual Python execution in the in-app browser returned `X shape: (1000, 2) y shape: (1000,) class balance: [500 500]`.
- The live spiral network trained to 96.0% test accuracy after 125 epochs in the redesigned lesson.
- Tutor, sync and discussions retain the production integration code. Integration tests block external services; no live tutor request or discussion post was made.
- Fonts and KaTeX are bundled with their licences. The certificate remains disabled.
- Checks above ran against the local preview before the redesign commit; no production deployment was performed during validation.
