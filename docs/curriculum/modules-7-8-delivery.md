# Replacement Modules 7 and 8

The updated Day 7 and Day 8 notebooks are the authoritative teaching structure. Original files remain untouched; exact snapshots and source hashes are in `scripts/authoring/module78_sources/`. Approved corrections are reproducible in `module78_edits.py`; no previous draft supplies replacement content.

## Delivered material

- Fourteen self-study notebooks and matching local app lessons.
- Ninety-nine numbered sections, 66 source check-yourself questions with adjacent worked answers, 99 section checkpoints, lesson quizzes and module challenges covering all seven lessons in each module.
- All 38 requested image briefs: 24 generated conceptual illustrations and 14 exact reference charts. Seven extra worked figures have corresponding paused browser walkthroughs.
- Existing author plots and reference outputs retained. Independent execution results are recorded separately and are not substituted for the author's experiment evidence.
- A reproducible notebook bundle, pinned Python 3.12 environment requirements, model/dataset revisions, and original reference JSON artifacts. Requirements can be downloaded from each lesson's Setup panel.

## Teaching route

Module 7: 7.1–7.5 classroom; 7.6–7.7 further learning. Module 8: 8.1–8.5 and 8.7 classroom; 8.6 further learning. Section 7 of 8.5 remains an extension. All fourteen lessons are complete and accessible locally.

## Accuracy recommendations addressed

- Scope benchmark conclusions to the actual budgets, input policies, upstream training and small reference runs. IMDb rating polarity does not imply prose without mixed opinions.
- Explain that tied DistilBERT input/output weights make the retention probe a combined-system diagnostic. It is not a strictly fixed-output-head experiment or a full capability audit.
- Distinguish equal observed accuracy from equal predictions or statistical equivalence: the full/LoRA reference runs differ on 108 of 1,000 predictions.
- Correct the held-back service denominator to 91 (79 confidence abstentions plus 12 out-of-domain flags).
- Initialize LoRA A randomly and B at zero; clarify rank/alpha scaling and trainable task-head costs.
- Separate 7B storage subtotals from peak training memory and GPU fit. The illustrated uniform quantizer is not an NF4/QLoRA execution.
- Pin public model and dataset artifacts, synchronize CUDA timers, and explain cross-platform limits of reproducibility.
- Record ordered text/label fingerprints for new paired comparison artifacts. Legacy author records remain clearly identified as reference artifacts.
- Restore only missing reference results for independent 8.4, 8.5 and 8.7 use; preserve learner-generated results.
- Distinguish missing Hub licence metadata from an established absence of a licence. Explain validation selection versus repeatedly inspected teaching test results.

## Validation

`module78-execution-report.json` records fresh CPU kernels for all 14 notebooks and 278 code cells. Final model-revision additions and memory-estimate code were rechecked. `module78-standalone-evaluation-report.json` records 8.7 starting with no result files. `module78-verification-report.json` checks source hashes, approved executable transformations, complete answers, section coverage, image hashes, downloadable code/outputs and learning routes.

All 14 app notebook downloads also render to offline HTML with embedded images (`module78-portability-report.json`); the browser-downloaded 8.7 file matches its generated notebook byte for byte.

Browser checks cover desktop and phone layout, images, glossary/answers, checkpoint feedback and the paused walkthrough controls. Modules 5–6 migration checks remain passing. Source notebooks, shared app downloads and the delivery bundle preserve the same executable lesson code; function docstrings are added for self-study.

## Rebuild

Use the project build environment for importing/building and the separate pinned Python 3.12 notebook environment for execution. Run the authoring scripts in this order:

1. `scripts/figures/module78_worked.py` (numeric plotting environment).
2. `scripts/authoring/module78_visuals.py` (numeric plotting environment).
3. `scripts/authoring/import_module78.py`.
4. `scripts/build.py`.
5. `scripts/authoring/execute_module78.py 7.1 7.2 7.3 7.4 7.5 7.6 7.7 8.1 8.2 8.3 8.4 8.5 8.6 8.7` (pinned notebook environment; network for initial downloads).
6. `scripts/authoring/verify_module78.py`.
7. `scripts/authoring/package_module78.py`.

The generated ZIP and `dist/` are rebuildable local delivery artifacts. Merging the curriculum PR into main triggers the existing site build and deployment workflow.
