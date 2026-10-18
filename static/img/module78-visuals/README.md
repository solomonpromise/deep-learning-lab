# Module 7 and 8 visual resources

38 requested figures: 24 conceptual illustrations generated with the built-in image generator, and 14 exact numerical charts drawn with Matplotlib. Seven additional worked figures accompany the app's paused step-by-step walkthroughs. All selected images were visually inspected; misleading prediction flow, arrow direction, masking and label examples were corrected before selection.

[Selected image paths and captions](manifest.json) record selected paths, SHA-256 hashes, captions and review status for all 38 requests. [Generation and refinement prompts](generation-provenance.json) record the selected generation or refinement prompt and original generated output. `prompts.json` preserves the initial adapted prompt set; the source review inventory preserves the author's original briefs. No generated illustration is presented as a real model activation, screenshot or measured chart.

Exact charts are rebuilt with `scripts/figures/module78_worked.py`. Walkthrough companions and their matching browser scenes are rebuilt with `scripts/authoring/module78_visuals.py`. Numerical chart values identify the author's reference run or an explicitly supplied toy calculation. Captions state the important limits, including prior training, budgets, tied retention outputs and storage versus runtime memory.
