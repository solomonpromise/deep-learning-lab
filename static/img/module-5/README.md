# Module 5 teaching figures

Ten original diagrams replace the image prompts in Lessons 5.1–5.4. The SVG files here are editable originals. Each notebook embeds a high-resolution PNG attachment, so downloaded notebooks retain the figures without a separate asset folder. The site build extracts and compresses those attachments into responsive, zoomable images.

Regenerate with `python scripts/figures/module5.py` using Python with matplotlib, NumPy and Pillow. These libraries are needed only for regeneration, not for the normal site build. The generator preserves code cells, their saved outputs and prose outside each image prompt. Notebook filenames follow the existing `lesson-N.M.ipynb` convention so the builder discovers them.

`figures.json` holds the captions and accessible descriptions. All diagrams use the approved cream, forest, lime, blue and rust palette. Pair roles use symbols as well as colour. Feature motifs, predictions and training batches are expressly illustrative; they do not claim to be captured model activations or measured similarities.

The pipeline and patch diagrams reuse photos already present in the owner's notebook outputs (Beans and the CLIP lesson's church example). The convolution diagram calculates every displayed output from its shown input/kernel. The distance diagram preserves the lengths and angles of the notebook's 3D vectors in the plane they span.

Concept checks used the original papers: [SimCLR](https://arxiv.org/abs/2002.05709) and [CLIP](https://arxiv.org/abs/2103.00020). The diagrams were drawn for this course; they are not copied paper figures. The 512-dimensional CLIP space and 768-dimensional patch tokens refer specifically to the lesson's ViT-B/32 model.
