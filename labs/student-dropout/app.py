"""Student dropout early-warning app (Lab 1). Run with:  python app.py

What it does: loads the MLP trained in the Lab 1 notebook, plus its preprocessor and decision threshold, from
artifacts/, and shows a small Gradio web page. You change a few key facts about a student (age, first-semester
units and grade, fees, debts, scholarship) and it shows the predicted dropout risk and whether that is high
enough to flag the student for a support conversation.

Needs: the notebook to have been run first, so that artifacts/ contains mlp.pt, preprocessor.joblib,
preprocessor_columns.json and example_student.json. Run it from the lab folder so those paths resolve.
"""
# Standard library and numerical tools.
import json
import joblib
import numpy as np
import pandas as pd
# PyTorch for the model; Gradio for the web interface.
import torch
import torch.nn as nn
import gradio as gr

# Load everything the notebook saved:
# - cfg: the coded and numeric column names, and the threshold chosen on validation students;
# - pre: the preprocessor fitted on training students (one-hot encoding + scaling);
# - example: one real test student whose record fills in every field the app doesn't ask about.
cfg = json.load(open("artifacts/preprocessor_columns.json"))
pre = joblib.load("artifacts/preprocessor.joblib")
example = json.load(open("artifacts/example_student.json"))
# The input columns, in the order the preprocessor expects them.
COLUMNS = cfg["nominal"] + cfg["numeric"]

class DropoutMLP(nn.Module):                                # the same model as in the lab notebook
    """The Lab 1 network: n_in inputs -> 32 -> 16 -> 1 logit, with ReLU and dropout between layers.

    It must match the notebook's definition exactly, or the saved weights won't load.
    """
    def __init__(self, n_in, p_drop=0.2):
        """Create the layers (n_in = number of features after preprocessing; p_drop = dropout probability)."""
        super().__init__()
        self.net = nn.Sequential(nn.Linear(n_in, 32), nn.ReLU(), nn.Dropout(p_drop),
                                 nn.Linear(32, 16), nn.ReLU(), nn.Dropout(p_drop), nn.Linear(16, 1))
    def forward(self, x):
        """Map a (batch, n_in) float32 tensor to a (batch,) tensor of logits (apply sigmoid for a probability)."""
        return self.net(x).squeeze(-1)

# Work out the input size by encoding the example student once (the number of one-hot columns depends on the data).
n_in = pre.transform(pd.DataFrame([example])[COLUMNS]).shape[1]
model = DropoutMLP(n_in)
# Load the trained weights. map_location="cpu" lets a model trained on a GPU load on any machine.
model.load_state_dict(torch.load("artifacts/mlp.pt", map_location="cpu"))
model.eval()                                                # prediction mode: dropout switched off

def predict(age, enrolled, approved, grade, tuition_ok, debtor, scholarship):
    """Return a one-line risk message for a student described by the app's inputs.

    Inputs (from the sliders and tick-boxes): age at enrolment, 1st-semester units enrolled and passed,
    1st-semester average grade (0-20), and three yes/no facts (fees up to date, debtor, scholarship holder).
    All other columns are copied from the example student.
    Output: a string giving the risk as a percentage, whether it is flagged, and the threshold.
    """
    # Start from a copy of the example student, then overwrite the fields the user controls.
    s = dict(example)
    # Tick-boxes give True/False; the model was trained on 0/1, hence int(...).
    s.update({"Age at enrollment": age, "Curricular units 1st sem (enrolled)": enrolled,
              "Curricular units 1st sem (approved)": approved, "Curricular units 1st sem (grade)": grade,
              "Tuition fees up to date": int(tuition_ok), "Debtor": int(debtor), "Scholarship holder": int(scholarship)})
    # Same preprocessing as in training -> (1, n_in) float32 tensor.
    x = torch.tensor(pre.transform(pd.DataFrame([s])[COLUMNS]).astype(np.float32))
    with torch.no_grad():                                   # no gradients needed for a prediction
        p = float(torch.sigmoid(model(x))[0])               # logit -> probability for the single student
    # Compare with the threshold chosen in the notebook (on validation students, aiming at 80% recall).
    flag = "FLAG for a support conversation" if p >= cfg["threshold"] else "no flag"
    return f"Dropout risk: {p:.0%}  ({flag}; threshold {cfg['threshold']:.0%})"

# The web interface: one input widget per argument of predict(), in the same order, and a text box for the result.
# Each widget starts at the example student's value.
demo = gr.Interface(
    fn=predict,
    inputs=[gr.Slider(17, 70, value=example["Age at enrollment"], step=1, label="Age at enrolment"),
            gr.Slider(0, 26, value=example["Curricular units 1st sem (enrolled)"], step=1, label="1st-semester units enrolled"),
            gr.Slider(0, 26, value=example["Curricular units 1st sem (approved)"], step=1, label="1st-semester units passed"),
            gr.Slider(0, 20, value=example["Curricular units 1st sem (grade)"], step=0.1, label="1st-semester average grade (0-20)"),
            gr.Checkbox(value=bool(example["Tuition fees up to date"]), label="Tuition fees up to date"),
            gr.Checkbox(value=bool(example["Debtor"]), label="Has debts to the institution"),
            gr.Checkbox(value=bool(example["Scholarship holder"]), label="Scholarship holder")],
    outputs=gr.Textbox(label="Early-warning result"),
    title="Student dropout early warning",
    description="A support tool, not a verdict: a high risk means 'reach out early'. Other details are taken from an example student.",
)

# Start the web server only when run as a script (python app.py); the notebook imports this file and launches it itself.
if __name__ == "__main__":
    demo.launch()
