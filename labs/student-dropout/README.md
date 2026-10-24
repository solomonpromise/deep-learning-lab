# Lab 1: Student dropout early warning

Turn first-semester records into a support signal. Compare an MLP with simpler baselines, prevent time leakage, choose a threshold and inspect group-level results.

## Run the project

Use Python 3.12 in an isolated environment. From this extracted folder:

```sh
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python app.py
```

On Windows, activate with `.venv\Scripts\activate` instead. Open the local address printed by Gradio. To study or retrain, open `lab.ipynb` in Jupyter or VS Code and run cells in order. The notebook imports `app.py` from the same folder.

Saved MLP and preprocessing files are included, so `python app.py` can run immediately. The small public UCI table is included for offline notebook use.

## Included source and review

The original notebooks and apps came from the course's Labs folder. Originals remain untouched. The imported app architecture and notebook comments were corrected to 109 → 32 → 16 → 1, matching the actual saved checkpoint and executable notebook code. The nearby narrative numbers were also aligned with the saved code outputs (epochs, seed range, raw-input validation score, importance, example predictions and average precision). No model was retrained and reference metrics were not recomputed.

Saved notebook frames pointing to a temporary localhost Gradio session were removed; rerunning the launch cell creates a new session. Charts, teaching prose, code and other saved results are retained. Training uses the specified fixed splits/seeds; hardware and dependency differences can change rerun results.

The notebook contains dataset attribution and source links. The student dataset is UCI Predict Students’ Dropout and Academic Success (CC BY 4.0); phone recordings are UCI Human Activity Recognition Using Smartphones (CC BY 4.0); TrashNet examples are by Gary Thung and Mindy Yang (MIT). Additional web images in the CNN experiment remain at their original dataset providers and are not bundled.

These are educational models with the limitations discussed in the lab.
