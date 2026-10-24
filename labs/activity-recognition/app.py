"""Activity recognition app (Lab 3): 2.56 seconds of phone sensor data in, an activity out.
Run with:  python app.py

What it needs (all written by the Lab 3 notebook into artifacts/):
- scaling.json   per-channel mean and standard deviation from the training people, plus the activity names;
- app_model.json which model kind ("RNN", "LSTM" or "GRU") was chosen on validation;
- <kind>.pt      the trained weights of that model;
- examples.npz   one raw test window (128 x 9) per activity, from people the model never saw.
Run the notebook once before starting the app, so these files exist."""
import json
import numpy as np
import torch
import torch.nn as nn
import matplotlib
matplotlib.use("Agg")                     # draw plots off-screen (no window); Gradio displays the figure itself
import matplotlib.pyplot as plt
import gradio as gr

# Load what the notebook saved. New data MUST be scaled with the same training statistics as in the notebook,
# otherwise the model sees numbers on a different scale from the ones it learned on.
scale = json.load(open("artifacts/scaling.json"))
MU, SD, ACTIVITIES = np.array(scale["mu"]), np.array(scale["sd"]), scale["activities"]   # MU, SD: shape (9,)
KIND = json.load(open("artifacts/app_model.json"))["model"]          # e.g. "GRU"
EXAMPLES = dict(np.load("artifacts/examples.npz"))                   # {name: (128, 9) raw window}

class SequenceClassifier(nn.Module):                          # the same model as in the lab notebook
    """Recurrent activity classifier, identical to the notebook's so the saved weights fit.

    kind: "RNN", "LSTM" or "GRU". A recurrent layer reads the 128 time steps in order, keeping a hidden state
    of 64 numbers; a linear layer turns the final hidden state into 6 activity scores.
    Input (batch, 128, 9) -> output (batch, 6) logits.
    """
    def __init__(self, kind, hidden=64, n_in=9, n_classes=6):
        """Create the recurrent layer of the chosen kind and the linear head (same sizes as in training)."""
        super().__init__()
        # batch_first=True: tensors are (batch, time, channels).
        self.rnn = {"RNN": nn.RNN, "LSTM": nn.LSTM, "GRU": nn.GRU}[kind](n_in, hidden, batch_first=True)
        self.head = nn.Linear(hidden, n_classes)
    def forward(self, x):
        """x: (batch, 128, 9) scaled readings -> (batch, 6) scores, taken from the last time step's hidden state."""
        out, _ = self.rnn(x)                  # out: (batch, 128, 64), the hidden state after every step
        return self.head(out[:, -1])          # the last step has seen the whole window

model = SequenceClassifier(KIND)
# map_location="cpu" lets weights trained on a GPU load on a laptop without one.
model.load_state_dict(torch.load(f"artifacts/{KIND.lower()}.pt", map_location="cpu"))
model.eval()                                  # evaluation mode: we only predict, never train, in the app

def recognise(window):
    """Classify one window.

    window: numpy array (128, 9) of raw, unscaled sensor readings.
    Returns {activity name: probability} for all 6 activities (gr.Label shows the top 3).
    """
    # Scale with the training statistics, add a batch axis (1, 128, 9), and convert to float32 for PyTorch.
    x = torch.tensor(((window - MU) / SD)[None].astype(np.float32))
    with torch.no_grad():                     # no gradients needed for prediction
        p = model(x).softmax(1)[0].numpy()    # softmax: 6 scores -> 6 probabilities summing to 1
    return {a: float(q) for a, q in zip(ACTIVITIES, p)}

def plot(window):
    """Plot the total acceleration (channels 6-8: x, y, z) of a (128, 9) window against time; returns the figure."""
    fig, ax = plt.subplots(figsize=(6, 2.6))
    t = np.arange(len(window)) / 50           # 50 readings per second -> time in seconds
    for c, name in zip(range(6, 9), ("x", "y", "z")):
        ax.plot(t, window[:, c], label=f"acceleration {name}")
    ax.set_xlabel("seconds"); ax.set_ylabel("g"); ax.legend(fontsize=7); ax.grid(alpha=0.3); fig.tight_layout()
    return fig

def from_example(name):
    """Dropdown handler: look up the named example window and return (plot, probabilities)."""
    w = EXAMPLES[name]
    return plot(w), recognise(w)

def from_csv(file):
    """Upload handler: read a CSV of 128 rows x 9 columns (same channel order as the notebook) and classify it.

    Raises a friendly gr.Error, shown in the app, if the file has the wrong shape.
    """
    # Gradio may pass a file object (with .name) or a plain path, depending on the version; handle both.
    # ndmin=2 keeps the result 2-D even for a one-row file, so the shape check below works.
    w = np.loadtxt(file.name if hasattr(file, "name") else file, delimiter=",", ndmin=2)
    if w.shape != (128, 9):
        raise gr.Error(f"Expected 128 rows x 9 columns (50 readings per second for 2.56 s), got {w.shape}")
    return plot(w), recognise(w)

# --- The user interface: a dropdown of examples, a CSV upload, a plot and the top-3 activities ---
with gr.Blocks(title="Activity recognition") as demo:
    gr.Markdown(f"## What are you doing?\nA {KIND} reads 2.56 s of phone motion sensors and names the activity (Lab 3).")
    with gr.Row():                            # the two input options side by side
        pick = gr.Dropdown(list(EXAMPLES), label="Try a recording from a person the model never saw")
        upload = gr.File(label="...or upload a CSV: 128 rows x 9 sensor columns", file_types=[".csv"])
    chart, label = gr.Plot(label="Sensor readings"), gr.Label(num_top_classes=3, label="Activity")
    # Wire events to handlers: choosing an example or uploading a file updates both outputs.
    pick.change(from_example, pick, [chart, label])
    upload.upload(from_csv, upload, [chart, label])

# Start the web server only when run as a script (python app.py), not when the notebook imports this file.
if __name__ == "__main__":
    demo.launch()
