# Lab 2: Waste sorter

Build a small CNN, reuse ResNet18 features and fine-tune a block. Test on different photos, examine mistakes and teach the app when to abstain.

## Run the project

Use Python 3.12 in an isolated environment. From this extracted folder:

```sh
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python app.py
```

On Windows, activate with `.venv\Scripts\activate` instead. Open the local address printed by Gradio. To study or retrain, open `lab.ipynb` in Jupyter or VS Code and run cells in order. The notebook imports `app.py` from the same folder.

The platform’s browser demo serves the supplied ONNX model and pinned runtime directly. The earlier standalone app is at https://solomonpromise.github.io/waste-sorter/. This lightweight teaching bundle contains code and saved notebook results, not the large image datasets or PyTorch checkpoints. Run `lab.ipynb` from top to bottom to download the public datasets, train, and write `artifacts/waste_resnet18_mixed.pt` before starting the Python app. The dataset downloads require internet; the later non-waste-photo stage can download hundreds of MB. Install `pyarrow` as well if your environment does not provide parquet support.

## Included source and review

The original notebooks and apps came from the course's Labs folder. Originals remain untouched. Saved results are reference runs, not new measurements. Run the notebook to obtain results for your environment.

Saved notebook frames pointing to a temporary localhost Gradio session were removed; rerunning the launch cell creates a new session. Charts, teaching prose, code and other saved results are retained. Training uses the specified fixed splits/seeds; hardware and dependency differences can change rerun results.

The notebook contains dataset attribution and source links. The student dataset is UCI Predict Students’ Dropout and Academic Success (CC BY 4.0); phone recordings are UCI Human Activity Recognition Using Smartphones (CC BY 4.0); TrashNet examples are by Gary Thung and Mindy Yang (MIT). Additional web images in the CNN experiment remain at their original dataset providers and are not bundled.

These are educational models with the limitations discussed in the lab.
