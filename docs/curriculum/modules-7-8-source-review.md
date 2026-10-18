# Review of the replacement Module 7 and 8 notebooks

Reviewed 18 October 2026. The notebooks in the author's Day 7 and Day 8 folders are the source of truth. Earlier local drafts of Modules 7–8 are superseded. This document records the review before app migration; it does not publish the lessons or modify the author files.

## What the review established

There are fourteen notebooks: seven per module, 99 numbered sections, 278 code cells with saved execution counts, 66 check-yourself questions, 14 saved plot/image outputs, and 38 explicit image briefs (23 in Module 7 and 15 in Module 8). Every notebook contains an answers section. All fourteen pass nbformat validation; parsing the code cells found no Python syntax errors after excluding notebook magics. No saved error outputs were found.

These are checks of the supplied notebooks and saved records, not an independent execution of all 278 cells. Clean-kernel execution, output reconciliation, portable downloads and browser verification remain implementation-stage work. A small offline diagnostic was executed separately to confirm the tied-weight finding below. CUDA hardware was unavailable for independent GPU timing verification.

## Educational assessment and curriculum connections

Keep the new lesson order. The sequence is coherent and considerably more useful than simply touring APIs. Each note starts with motivation and objectives, develops the concept through code and observations, defines terms, asks questions, supplies answers, and closes with synthesis, summary and glossary. Preserve this structure and its depth.

Module 7 connects Module 5's encoder/head and representation ideas to Module 6's Transformer mechanics, then moves into engineering with pretrained models. Module 8 connects that inference workflow to the training loops, optimisation, splits and experimental discipline of Modules 2–4. The recurring IMDb protocol makes the comparisons traceable. Connecting the toy CLIP in 5.5 to the pretrained CLIP in 7.5 is especially useful.

The notebooks include negative findings rather than forcing every new method to win. Preserve that: the adaptation experiments demonstrate an engineering workflow, not a general ranking of architectures or proof that fine-tuning is ineffective.

| Lesson | Learning objective and role in the progression | Migration focus |
| --- | --- | --- |
| 7.1 Understanding Pretrained Models | Distinguish architecture, weights, base/task checkpoints and revisions; compare pretrained, random and scratch models | Keep the numerical comparisons, contextual `bank` experiment and configuration inspection; qualify knowledge and reproducibility claims |
| 7.2 The Hugging Face Ecosystem | Connect Hub repositories, caches, cards, Transformers, Datasets and Tokenizers | Retain code walkthroughs and navigation appendix; describe absent licence metadata accurately |
| 7.3 Finding and Selecting the Right Model | Match task, context, size, benchmark evidence and deployment needs | Preserve benchmark reproduction and domain comparison; scope theoretical compute and context claims |
| 7.4 Loading and Using Pretrained Models | Reproduce pipelines explicitly, control masks/truncation/devices, batch, save and reload | Strong bridge from Module 6; add a worked visual of padding masks and token flow |
| 7.5 Building Applications with Pretrained Models | Apply sentiment, generation, embeddings and CLIP; build a validated, abstaining service | Preserve all four applications and failures; correct the summary's held-back count and distinguish an OOD heuristic from a guarantee |
| 7.6 Inference and Deployment Constraints | Measure latency/throughput, precision, quantisation and caching; record reproducibility | Keep further-learning classification and actual CPU measurements; scope size estimates and audit GPU timing |
| 7.7 Practical Model Selection and Integration | Make a requirement-driven choice using documentation, representative inputs, metrics and a decision record | Keep further learning and the contaminated-candidate case; separate known exposure from undocumented uncertainty |
| 8.1 Understanding Model Adaptation | Compare prompting, frozen features, PEFT and full fine-tuning; introduce overfitting/retention | Preserve the whole-picture introduction; narrow claims drawn from the retention probe |
| 8.2 Preparing Data for Fine-Tuning | Define labels, inspect quality/duplicates, create splits, handle imbalance and choose token budgets | Keep explicit data audits; correct the meaning of IMDb's polar labels |
| 8.3 Establishing Baselines | Build TF-IDF, off-the-shelf and frozen-encoder baselines under a declared protocol | Preserve separate label budgets and saved predictions; distinguish baselines' training histories and input lengths |
| 8.4 The Fine-Tuning Workflow | Trace loss, gradients, clipping, schedule, checkpoint choice and save/reload; compare loop with Trainer | Keep both implementations; preserve the pinned API version and avoid implying their outputs must be identical |
| 8.5 Parameter-Efficient Fine-Tuning | Build LoRA by hand, count trainable weights, train adapters, save/reload/merge and compare costs | Keep PEFT here; qualify equal-accuracy claims and preserve the trained classification head in saving/reloading |
| 8.6 Fine-Tuning Large Language Models (Conceptual) | Explain chat templates, response-only targets, shifted causal loss, LLM LoRA and QLoRA | Treat tiny SFT as a mechanics demonstration; distinguish illustrative quantisation arithmetic from actual training-memory requirements |
| 8.7 Evaluating Adapted Models | Combine saved experiments, uncertainty, error analysis, costs and a keep/reject decision | Deliver required result artifacts; preserve comparable row ordering and make future test-set discipline explicit |

## Teaching routes

Module 7 remains settled: lessons 7.1–7.5 in class; 7.6–7.7 further learning. Publish all seven with full notes and downloads.

For Module 8, the equivalent of the earlier agreement is now 8.1–8.5 and 8.7 in class, with 8.6 as further learning. The former further-learning LLM topic has moved to 8.6; applying the old numeric label 8.5 would incorrectly exclude practical PEFT/LoRA. Section 7 inside 8.5 is explicitly an extension on other PEFT approaches and can retain that distinction. This is a proposed mapping to the new numbering, not a new agreement from the user.

Both modules are substantial for 3.5-hour sessions. The app should keep all the material, while classroom guidance identifies live demonstrations, discussion points and cells learners can inspect through saved outputs. Provide a pre-class download/environment checklist so model downloads do not consume the lesson. Do not imply all source prose and experiments can be taught line by line within that allocation.

## Corrections and delivery issues before publishing

### 1. Make the evaluation notebook runnable from a delivered download

8.7 cell 5 asserts that `results/8.3.json`, `results/8.4.json` and `results/8.5.json` exist. Those files are not in Day 8. They do exist in the related author work directory, and their declared split fingerprints and 1,000 prediction entries per method agree.

Provide those artifacts in the notebook bundle, with provenance and clear reference-run labelling, and document how running 8.3–8.5 regenerates them. A learner who downloads only 8.7 needs an explicit artifact download or a self-contained reference-data fallback. Do not silently present supplied reference results as the learner's newly executed experiments.

The existing fingerprint sorts texts, so it checks membership rather than row order or label alignment. Paired prediction comparisons need ordered example IDs or an ordered text-and-label digest. Add that alongside the existing set fingerprint; preserve the original data split unless there is a reason to change it. Record the model and dataset revisions used at load time, not merely the latest Hub commit queried afterwards.

### 2. Tighten experimental conclusions and statistical language

7.1 attributes all model value to weights and says validation reviews were never seen by the downloaded model. The matched-architecture experiment demonstrates the benefit of trained weights with architecture and tokenizer fixed; it does not establish that architecture is irrelevant or independently audit all upstream training data. Say the reviews were held out from our own training and state documented upstream data and remaining uncertainty.

A tensor's relative norm change is not the percentage change of every scalar weight. Keep those summaries consistent with the code's group averages.

8.5 reports equal test accuracy of 0.834 and a paired-test p-value of 1. The supplied predictions disagree on 108 of 1,000 reviews. Say “equal observed accuracy in this run”; neither identical predictions nor statistical equivalence follows from p = 1. Likewise, replace “indistinguishable” with “no statistically significant difference detected” when that is what the test supports. These qualifications must also reach captions, summaries and image briefs.

Do not generalise small demonstrations into claims that embeddings cannot capture sentiment, sampling prevents repetition, or fine-tuning generally loses to pretrained inference. The notes already contain useful limitations; carry them into the shorter summaries and diagrams.

### 3. Correct the interpretation of the retention/forgetting probe

8.1 cell 25 and 8.4/8.5 describe reattaching the changed body while keeping the masked-word head unchanged. In the pinned Transformers implementation, DistilBERT's vocabulary projection shares its weight with the input word embeddings. Loading changed input embeddings therefore also changes the output projection.

An offline small-model diagnostic confirmed both the shared parameter identity and the output-weight change after reloading the body. This does not make the entire probe worthless: it means its description is inaccurate. Either describe the tied-output setup precisely, or explicitly create a fixed decoder for a fixed-head experiment and regenerate the affected results. Interpret the loss on this one 200-review masked-word probe as retention evidence for that setup, not a comprehensive measurement of general capabilities or proof of catastrophic forgetting across tasks. Avoid declaring all abilities recovered simply by disabling one adapter without an appropriate evaluation.

### 4. Keep hardware estimates separate from measured peak memory

8.6 estimates 15.23 GB for 7B bfloat16 weights and about 4.28 GB for an illustrative 4-bit layout, then labels GPUs as “fits” with fixed 20% headroom. Its introductory caveat is helpful, but the summary and image brief again state that 7B QLoRA fits an 8 GB GPU.

Call these simplified storage estimates, not measured training requirements or fit guarantees. Activations, sequence length, batch size, adapter states, unquantised modules, quantisation metadata and runtime workspaces affect the outcome; a constant 20% allowance does not settle it. The uniform blockwise example is not an executed NF4/QLoRA run. Scope the 121.85 GB full-fine-tuning figure to the stated float32/Adam assumptions; it is not a universal requirement for every fine-tuning configuration. Revise IMAGE 8.6.2 before making the picture.

Several timing cells auto-select CUDA but surround asynchronous calls only with a CPU clock. Preserve the supplied CPU reference timings; before presenting a GPU-compatible runner, add warmup and device synchronisation or CUDA-event timing at the relevant measurement boundaries. Do not extrapolate one CPU's bfloat16 speed to all CPUs.

### 5. Repair smaller accuracy and terminology issues

- 7.5: 909 of 1,000 answered means 91 held back: 79 abstentions plus 12 out-of-domain flags. The 0.637 held-back accuracy is computed over all 91. Its synthesis currently associates this with 79. Keep the categories separate in the summary and picture.
- 8.2: IMDb's selected labels exclude middle ratings; this does not mean every review's prose contains no mixed opinion. Say reviews were selected by polar ratings, while individual texts may still mix praise and criticism.
- 7.2/7.7: distinguish “no licence declared in the inspected metadata/card” from an established absence of any licence. Follow the original publisher's licence and checkpoint provenance; intended-use discussion and legal licence terms are distinct.
- 8.5: at standard LoRA initialisation B is zero while A is random; not both small matrices start at zero. The code is correct, but one prose statement in the training recipe is too loose.
- Seeds and pins support controlled reproduction; they do not promise identical outputs on every device or library stack. Keep saved numerical outputs labelled as the author's CPU reference run until independently reproduced.
- Several lessons reuse the same test sample for teaching. Preserve the educational comparison, but distinguish it from repeatedly tuning a deployed system against a supposedly untouched final test. The existing 8.7 next step to use a fresh test sample is valuable.

## Version checks that should not become unnecessary changes

The author's environment is Transformers 5.20.1. Its installed `TrainingArguments` accepts a fractional `warmup_steps` and uses `ceil(total_steps * fraction)`. The note's 0.1 warmup setting is valid for this version; do not replace it with advice based on an older API.

The installed CLIP feature helpers return structured outputs whose `pooler_output` has already passed through the projection. The 7.5 code follows that version's behaviour. Preserve the pinned environment and document the version dependency instead of rewriting against older examples.

## Visual and app migration plan

Inventory all 38 named image briefs and preserve their intended teaching role. Use the same quality and visual language as the reviewed Module 5/6 illustrations. Use generated illustrations for conceptual relationships; use reproducible charts and worked figures for exact numbers and measurements. Every numerical caption must match the corrected experiment and identify the reference run. Do not generate misleading pseudo-measurements.

Useful additional visual walkthroughs include padding versus attention masks (7.4), the service's routing and abstention thresholds (7.5), quantisation and reconstruction (7.6), deduplication and splitting (8.2), loss/gradients/checkpoint selection (8.4), the frozen W plus trainable A/B paths (8.5), and the difference between attention masks, prompt target masks and shifted labels (8.6). Keep static equivalents embedded in downloadable notebooks. Use actual public Hub screenshots if showing the real interface, with capture dates, rather than fabricated UI images.

Before app changes: snapshot the new sources and hashes, preserve their text/section sequence, incorporate agreed corrections, include the result artifacts and environments, and author fresh lesson checks/answers matched to these notes. Rebuild all seven lessons per module; update course routes, glossary/concept links and tutor context; preserve any useful bookmarks; then validate source fidelity, fresh-kernel execution, offline notebook images, actual app downloads, mobile/desktop layouts and purposeful animations. The old Module 7/8 drafts are reference-only.

## Reference checks

- [Transformers Trainer documentation](https://huggingface.co/docs/transformers/main/en/main_classes/trainer), checked alongside the installed 5.20.1 `training_args.py`.
- [Transformers CLIP documentation](https://huggingface.co/docs/transformers/main/en/model_doc/clip), checked alongside the installed 5.20.1 CLIP implementation.
- [PEFT LoRA reference](https://huggingface.co/docs/peft/main/package_reference/lora).
- [PyTorch CUDA semantics and timing](https://docs.pytorch.org/docs/2.14/notes/cuda.html).
- [Transformers bitsandbytes/QLoRA documentation](https://huggingface.co/docs/transformers/main/en/quantization/bitsandbytes).
- [Original IMDb dataset](https://ai.stanford.edu/~amaas/data/sentiment/) and [dataset card](https://huggingface.co/datasets/stanfordnlp/imdb/raw/main/README.md).
- [SST-2 checkpoint card](https://huggingface.co/distilbert/distilbert-base-uncased-finetuned-sst-2-english), [Qwen2.5-7B card](https://huggingface.co/Qwen/Qwen2.5-7B), [CLIP card](https://huggingface.co/openai/clip-vit-base-patch32) and [original CLIP repository licence](https://github.com/openai/CLIP/blob/main/LICENSE).
