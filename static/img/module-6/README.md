> Historical assets for the superseded notes. Current Modules 5–6 use `static/img/curriculum-v2/` and the authoring workflow in `scripts/authoring/`. The old generation commands below are retired.

# Module 6 teaching figures

Eleven original diagrams fill the image prompts in Lessons 6.1–6.6. Editable SVGs
live here; high-resolution PNG attachments travel with each downloadable notebook.
Captions and accessible descriptions are recorded in `figures.json`.

Regenerate with `MPLCONFIGDIR=/tmp/dlp-matplotlib python3 scripts/figures/module6.py`
using Python with matplotlib, NumPy and Pillow. The generator imports the shared
Module 5 drawing primitives and preserves code cells, saved outputs and prose
outside the image placeholders. It initially imports `notes/Day 6/` into the
site's standard `notes/module-6/lesson-6.N.ipynb` paths; later runs update only the
curated notebooks. Module 6 is locked against sync overwrites.

The cream, forest and lime palette matches the existing course. Attention weights
and the reversal heatmap are explicitly schematic. Token IDs, shapes and reversal
head averages come from the notebooks' saved outputs. Padding masks hide key
columns, not query rows; pooling excludes padded outputs separately. The MiniLM
and Qwen diagrams distinguish post-norm from pre-norm and show residual paths.

Concept references: [Attention Is All You Need](https://arxiv.org/abs/1706.03762),
[RoFormer](https://arxiv.org/abs/2104.09864), and
[Qwen3-0.6B configuration](https://huggingface.co/Qwen/Qwen3-0.6B/blob/main/config.json).
These are course illustrations, not copied figures or newly measured activations.
