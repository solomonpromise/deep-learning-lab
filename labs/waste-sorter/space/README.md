---
title: Waste Sorter
emoji: ♻️
colorFrom: green
colorTo: blue
sdk: gradio
sdk_version: 6.30.0
python_version: "3.12"
app_file: app.py
pinned: false
license: mit
---

# Waste sorter

Take or upload a photo of a single item, and a fine-tuned ResNet18 suggests the recycling bin:
cardboard, glass, metal, paper, plastic or general trash.

Built in Lab 2 of the Deep Learning course. The model is ResNet18 (pretrained on ImageNet), with its
last block fine-tuned on the TrashNet dataset (Gary Thung and Mindy Yang, MIT licence) plus a small
set of web photos of everyday waste.

**Limitations:** trained on a few thousand photos; it works best on one item against a plain
background, and it can be wrong. Check your local recycling rules.
