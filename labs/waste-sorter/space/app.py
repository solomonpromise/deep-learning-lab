"""Waste sorter app (Lab 2): a photo in, a recycling bin out, or "this doesn't look like waste".

Run it from this folder with:  python app.py   (then open the local address it prints)
It needs the files that the Lab 2 notebook saves in artifacts/:
  - waste_resnet18_mixed.pt  the fine-tuned ResNet18 (TrashNet + 200 web photos)
  - classes.json             the six bin names, in the model's output order
  - waste_gate.json          the "is it waste at all?" check from Section 7 of the notebook

How a photo is handled:
  1. resize to 224 x 224 and normalise it the way ImageNet models expect;
  2. run the shared layers 1-3 of ResNet18 once;
  3. branch A, the fine-tuned layer 4 and head: which of the six bins? (softmax probabilities);
  4. branch B, the original ImageNet layer 4 and the gate: is this a waste item at all? (a score from 0 to 1);
  5. if the waste score is below the threshold, say so; otherwise name the bin, or say "not sure" below 60%.
"""
import json
import torch
import torch.nn as nn
import torch.nn.functional as F
import torchvision as tv
import gradio as gr

# --- The bin classifier: ResNet18 with a 6-way head, loaded with the weights trained in the notebook ---------------
CLASSES = json.load(open("artifacts/classes.json"))["classes"]   # ["cardboard", "glass", "metal", "paper", "plastic", "trash"]
model = tv.models.resnet18()                                     # the architecture only; weights come next
model.fc = nn.Linear(512, len(CLASSES))                          # replace ImageNet's 1000-way head with our 6-way head
model.load_state_dict(torch.load("artifacts/waste_resnet18_mixed.pt", map_location="cpu"))   # map_location: works without a GPU
model.eval()                                                     # evaluation mode: BatchNorm uses its stored statistics

# --- The waste check: the ORIGINAL ImageNet layer 4 (general-purpose features) plus a logistic-regression gate -----
imagenet = tv.models.resnet18(weights=tv.models.ResNet18_Weights.IMAGENET1K_V1).eval()   # downloaded once, then cached
GATE = json.load(open("artifacts/waste_gate.json"))              # {"w": 512 weights, "b": bias, "threshold": ...}
gate_w, gate_b = torch.tensor(GATE["w"]), GATE["b"]

prep = tv.transforms.Compose([
    tv.transforms.Resize((224, 224)),                            # squash to 224 x 224, as in the notebook
    tv.transforms.ToTensor(),                                    # PIL image -> float tensor (3, 224, 224) in [0, 1]
    tv.transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),   # what ImageNet models expect
])

ADVICE = {"cardboard": "Flatten it and put it in the paper and cardboard bin.",
          "paper": "Paper bin. Keep it dry and clean.",
          "glass": "Glass bin. Rinse it first; lids go separately.",
          "metal": "Metal and cans bin. Rinse it first.",
          "plastic": "Plastics bin. Rinse it and check the recycling number.",
          "trash": "General waste: this item probably can't be recycled."}


def predict(x):
    """Run both branches on one prepared photo.

    x: float tensor (1, 3, 224, 224), already normalised.
    Returns (probs, waste_score): probs is a (6,) tensor of bin probabilities that sum to 1;
    waste_score is a float from 0 to 1, how much the photo looks like a waste item at all.
    """
    m = model
    with torch.no_grad():                                        # inference only: no gradients needed
        a3 = m.layer3(m.layer2(m.layer1(m.maxpool(m.relu(m.bn1(m.conv1(x)))))))   # shared layers 1-3: (1, 256, 14, 14)
        probs = m.fc(m.avgpool(m.layer4(a3)).flatten(1)).softmax(1)[0]           # fine-tuned layer 4 -> 6 bins
        g = F.normalize(imagenet.layer4(a3).mean((2, 3)), dim=1)[0]              # ImageNet layer 4 -> (512,), length 1
        waste_score = torch.sigmoid(g @ gate_w + gate_b).item()                  # the gate: logistic regression
    return probs, waste_score


def sort_waste(img):
    """Gradio's callback: a PIL image in; (label scores for the Label box, advice text) out."""
    if img is None:                                              # the user pressed Submit without a photo
        return {}, "Please take or upload a photo."
    probs, waste_score = predict(prep(img.convert("RGB")).unsqueeze(0))   # unsqueeze(0): add the batch dimension
    if waste_score < GATE["threshold"]:                          # below the threshold: don't pretend to know the bin
        return ({"not a waste item": round(1 - waste_score, 3)},
                "This doesn't look like a waste item, so no bin is suggested. "
                "Try one item (a bottle, can, box or paper) on a plain background.")
    best = CLASSES[int(probs.argmax())]                          # the most likely bin
    confidence = float(probs.max())
    note = ADVICE[best] if confidence >= 0.6 else "Not sure. Please check the label on the item, or try another photo."
    return {c: float(v) for c, v in zip(CLASSES, probs)}, note  # gr.Label shows the top 3 as bars


demo = gr.Interface(                                             # the user interface: one input, two outputs
    fn=sort_waste,
    inputs=gr.Image(type="pil", sources=["upload", "webcam"], label="Photo of one item"),
    outputs=[gr.Label(num_top_classes=3, label="Which bin?"), gr.Textbox(label="Advice")],
    title="Waste sorter",
    description="Take or upload a photo of a single item. A fine-tuned ResNet18 (Lab 2) suggests the recycling bin, "
                "after checking that the photo looks like a waste item at all.",
)

if __name__ == "__main__":                                       # only when run as a script, not when imported
    demo.launch()
