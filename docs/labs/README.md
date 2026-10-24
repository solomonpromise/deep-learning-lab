# Project lab integration

Three supplied projects are available at `projects.html`, through the Projects navigation item, the dashboard, and relevant module overviews. Each has an inline application, a complete rendered notebook walkthrough, a portable notebook download, a project ZIP and links back to related lessons.

| Project | Course connections | Application |
| --- | --- | --- |
| Student dropout early warning | Modules 2, 3, 4 | Saved MLP, original fitted preprocessing and validation-selected threshold |
| Waste sorter | Modules 5, 7, 8 | Supplied ResNet18 ONNX model with waste gate; example photos and local image upload |
| Activity recognition | Module 5; data-splitting connection to 4.1 | Saved RNN/LSTM/GRU models, original scaling, real held-out recordings, CSV upload and sensor plot |

These are the existing projects, separate from the proposed text-data lab for the final class. No implementation of that separate class project is included.

## Canonical files

- `labs/catalog.json`: titles, module placement, related lessons and original source hashes.
- `labs/<id>/lab.ipynb`: imported teaching notebook, retaining charts and saved reference outputs.
- `labs/<id>/app.py`, requirements and README: downloadable Python project source.
- `static/labs/`: browser inference weights, example windows/images and the CNN app/model.
- `scripts/dlp/projects.py`: notebook rendering, source-bundle generation, search entries and placement checks.
- `scripts/labs/export_models.py`: converts trusted saved MLP/recurrent checkpoints to browser JSON without training.
- `static/js/project-inference.js`: inference with the exported parameters; no synthetic predictions or hard-coded example answers.

The course build still contains 41 lessons. Project labs have their own pages and do not alter lesson mastery counts. Their sections are searchable. The source folder is read only; originals were not modified.

## Review fixes in the imported copies

Lab 1's saved checkpoint and executable notebook architecture are 109 → 32 → 16 → 1, while its original app defined 64 → 32 hidden layers. The imported app now matches the actual checkpoint. Notebook architecture comments were corrected too. Narrative examples that quoted an older run were aligned with their adjacent saved outputs: 26 epochs / best epoch 12, seed range 0.889–0.895, raw-input validation ROC-AUC 0.517, average precision, permutation importance and the default student's what-if scores. These edits do not claim a new training run or change saved numerical outputs.

All three notebooks contained a saved Gradio iframe pointing to a temporary localhost session. Those obsolete frames were removed from the imported copies. The launch code remains available, and running it starts a fresh Python application. Other code, plots and reference outputs are retained.

Lab 2's browser model and matching runtime are served with the platform. Initial cross-site model loading failed during browser verification; local delivery fixed it. The separate existing Waste Sorter website remains linked as an alternative. The embedded view follows the platform theme and resizes to its contents. Camera access is requested only if a learner chooses the camera action; no camera capture was used in verification.

## Dependencies and delivery

The site build uses only its existing Python build dependencies plus standard-library project packaging. Training/Python-app requirements are separate and supplied in each project download.

ONNX Runtime Web **1.20.1** is pinned and vendored in `static/vendor/onnxruntime/` with its MIT license and third-party notices. Its JavaScript, module loader and WASM binary come from the same release; the CNN uses one WASM thread to work without cross-origin isolation. See the [official runtime configuration documentation](https://onnxruntime.ai/docs/tutorials/web/env-flags-and-session-options.html). The supplied CNN model is approximately 39 MB; its runtime adds approximately 12 MB. These files are loaded only when the learner opens the waste-sorter app. All three applications perform prediction on the learner's device. No inference service, credential or new public hosting account is required.

Small trained Python artifacts are bundled for Labs 1 and 3, so their standalone apps can run without retraining. The CNN source ZIP excludes large datasets and PyTorch checkpoints; its README explains how to run the notebook to recreate those artifacts. The browser CNN uses the supplied ONNX model directly. Extra web-image datasets are not redistributed in the source bundle. Dataset attribution remains in the notebooks and project READMEs.

A normal build prepares all pages and downloads:

```sh
python scripts/build.py
python scripts/build.py --serve --port 8815
node scripts/labs/test_inference.cjs
```

To re-export MLP/recurrent JSON after changing a trained checkpoint, use the lab Python environment (PyTorch, scikit-learn, joblib, NumPy and pandas), then regenerate the reference fixtures and rerun the numerical comparison:

```sh
python scripts/labs/export_models.py
node scripts/labs/test_inference.cjs
```

Application code and assets are packaged in a dedicated pull request. The platform is published by the existing deployment workflow after the owner merges that PR; this work does not change the separate Waste Sorter deployment.
