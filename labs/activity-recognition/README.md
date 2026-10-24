# Lab 3: Activity recognition

Read real phone-sensor windows with three recurrent networks. Split by person, compare models and investigate confident mistakes on people never seen in training.

## Run the project

Use Python 3.12 in an isolated environment. From this extracted folder:

```sh
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python app.py
```

On Windows, activate with `.venv\Scripts\activate` instead. Open the local address printed by Gradio. To study or retrain, open `lab.ipynb` in Jupyter or VS Code and run cells in order. The notebook imports `app.py` from the same folder.

Saved RNN/LSTM/GRU weights, training scaling statistics and six example recordings are included, so `python app.py` can run immediately. The full UCI HAR training dataset is downloaded by the notebook on first use.

## Included source and review

The original notebooks and apps came from the course's Labs folder. Originals remain untouched. Saved results are reference runs, not new measurements. Run the notebook to obtain results for your environment.

Saved notebook frames pointing to a temporary localhost Gradio session were removed; rerunning the launch cell creates a new session. Charts, teaching prose, code and other saved results are retained. Training uses the specified fixed splits/seeds; hardware and dependency differences can change rerun results.

The notebook contains dataset attribution and source links. The student dataset is UCI Predict Students’ Dropout and Academic Success (CC BY 4.0); phone recordings are UCI Human Activity Recognition Using Smartphones (CC BY 4.0); TrashNet examples are by Gary Thung and Mindy Yang (MIT). Additional web images in the CNN experiment remain at their original dataset providers and are not bundled.

These are educational models with the limitations discussed in the lab.
