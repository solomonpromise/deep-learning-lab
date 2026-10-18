"""Approved accuracy corrections applied to immutable replacement sources."""
import ast,base64,gzip,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
SOURCES=Path(__file__).parent/'module78_sources'
REVISIONS=json.loads((SOURCES/'revisions.json').read_text())
REFERENCE={n:json.loads((SOURCES/'reference_results'/f'{n}.json').read_text()) for n in ['8.3','8.4','8.5']}
REFERENCE_B64=base64.b64encode(gzip.compress(json.dumps(REFERENCE,separators=(',',':')).encode(),mtime=0)).decode()


def pin_calls(src):
    """Pin public model/dataset loads, leaving local adapter reloads unchanged."""
    tree=ast.parse(src); lines=src.splitlines(keepends=True); offsets=[0]
    for line in lines:offsets.append(offsets[-1]+len(line))
    edits=[]
    for n in ast.walk(tree):
        if not isinstance(n,ast.Call) or not n.args or any(k.arg=='revision' for k in n.keywords):continue
        func=n.func.attr if isinstance(n.func,ast.Attribute) else n.func.id if isinstance(n.func,ast.Name) else ''
        arg=n.args[0]
        if func=='pipeline':
            arg=next((k.value for k in n.keywords if k.arg=='model'),None)
            if not isinstance(arg,ast.Constant) and not (isinstance(arg,ast.Name) and arg.id in ['BASE','SST2','GPT','MINILM','CLIP']):continue
        elif func not in ['from_pretrained','load_dataset','hf_hub_download','model_info']:continue
        if not isinstance(arg,(ast.Constant,ast.Name)):continue
        if isinstance(arg,ast.Constant) and not isinstance(arg.value,str):continue
        if isinstance(n.func,ast.Attribute) and isinstance(n.func.value,ast.Name) and n.func.value.id=='PeftModel':continue
        name=ast.get_source_segment(src,arg)
        namespace='DATASET_REVISIONS' if func=='load_dataset' else 'MODEL_REVISIONS'
        end=offsets[n.end_lineno-1]+n.end_col_offset-1
        sep='' if src[:end].rstrip().endswith(',') else ','
        edits.append((end,f'{sep} revision={namespace}.get({name})'))
    for pos,text in sorted(edits,reverse=True):src=src[:pos]+text+src[pos:]
    return src


def setup(lid):
    txt='\n\n# Freeze the public artifacts used by the recorded experiments.\nMODEL_REVISIONS = '+repr(REVISIONS['models'])+'\nDATASET_REVISIONS = '+repr(REVISIONS['datasets'])+'''\n
def benchmark_clock():
    """Read elapsed time after completing any queued CUDA work."""
    if torch.cuda.is_available():
        torch.cuda.synchronize()
    import time
    return time.perf_counter()

def ordered_fingerprint(texts, labels):
    """Hash ordered text/label pairs so paired predictions cannot be silently misaligned."""
    import json, hashlib
    rows = [[str(t), int(y)] for t, y in zip(texts, labels)]
    return hashlib.sha256(json.dumps(rows, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
'''
    if lid in ['8.4','8.5','8.7']:
        txt+='\n# Author reference results are embedded for standalone downloads, never fetched secretly.\nREFERENCE_RESULTS_GZIP = '+repr(REFERENCE_B64)+'''\n
def ensure_comparison_results(notes):
    """Restore only missing reference files; preserve every learner-generated result file.

    Arguments:
        notes: Lesson IDs whose comparison artifacts are required.
    """
    import base64, gzip, json, pathlib, hashlib
    reference = json.loads(gzip.decompress(base64.b64decode(REFERENCE_RESULTS_GZIP)))
    folder = pathlib.Path('results'); folder.mkdir(exist_ok=True)
    for note in notes:
        target = folder / (note + '.json')
        if not target.exists():
            target.write_text(json.dumps(reference[note], indent=1))
            print('Using bundled AUTHOR REFERENCE results for', note, '(not a new training run).')
'''
    return txt


def edit(lid,index,text,kind):
    if kind=='code':
        text=text.replace('time.perf_counter()', 'benchmark_clock()')
        text=text.replace('swap in a body, keep the head', 'swap body; output projection remains tied to input embeddings')
        text=pin_calls(text)
        if index==1:text+=setup(lid)
        if lid=='8.4' and index==40:text='ensure_comparison_results(["8.3"])\n'+text
        if lid=='8.5' and index==38:text='ensure_comparison_results(["8.3", "8.4"])\n'+text
        if lid=='8.7' and index==5:
            text='ensure_comparison_results(["8.3", "8.4", "8.5"])\n'+text
            text+='''\n# The legacy membership digest does not establish prediction order. New runs\n# also record the ordered text/label digest; bundled original records are\n# explicitly identified as source reference artifacts, with their declared order.\nfor note, rec in files.items():
    ordered = rec.get('ordered_test_fingerprint')
    if ordered is not None:
        assert ordered == ordered_fingerprint(test_x, test_y), 'Prediction ordering differs: ' + note
'''
        if lid in ['8.3','8.4','8.5'] and 'json.dump(record, f' in text:
            marker='with open("results/'
            at=text.index(marker)
            text=text[:at]+'''record['ordered_test_fingerprint'] = ordered_fingerprint(test_x, test_y)
record['artifact_origin'] = 'learner execution of this notebook'
record['model_revisions'] = MODEL_REVISIONS
record['dataset_revisions'] = DATASET_REVISIONS
'''+text[at:]
        if lid=='8.6' and index==35:
            text=text.replace('QLoRA, 4-bit weights (adapters tiny)', 'Illustrative 4-bit base layout')
            text=text.replace('fits =','weight_only_candidates =').replace('fits a GPU of:', 'storage estimate below:').replace('for g in fits','for g in weight_only_candidates')
            text=text.replace('# leave 20% for activations etc.','# illustrative 20% allowance; NOT a training-fit test')
        # A zero-disagreement comparison carries no evidence of a difference.
        text=text.replace('binomtest(only_a, only_a + only_b).pvalue','(binomtest(only_a, only_a + only_b).pvalue if only_a + only_b else 1.0)')
        text=text.replace('binomtest(a, a + b).pvalue','(binomtest(a, a + b).pvalue if a + b else 1.0)')
        return text
    # Global precision repairs, including summaries, answers and image briefs.
    text=text.replace('A short code computed from a set of texts; identical sets give identical fingerprints.', 'A digest of sorted texts identifies membership under this implementation; a separate ordered text/label digest is needed to check paired prediction alignment.')
    text=text.replace('Strongly one-sided, with no neutral or mixed examples.', 'Labels derived from extreme ratings; review prose may still contain mixed opinions.')
    text=text.replace('A pretrained model that is never updated.', 'A pretrained model whose parameters stay fixed during the current training stage.')
    text=text.replace('A range likely to contain the true value of a measured quantity.', 'An interval from a method designed to cover the target quantity at a stated rate over repeated samples; this is not a probability assigned to the fixed unknown value.')
    text=text.replace('Always predicting the most common label; the minimum any model must beat.', 'A constant-label baseline selected from training data and evaluated under the same protocol; it is not a guaranteed lower bound.')
    text=text.replace('detect overfitting and catastrophic forgetting from saved results', 'identify overfitting warnings and interpret the limitations of a saved retention probe')
    if lid=='8.7':
        text=text.replace('run Notes 8.3, 8.4 and 8.5 first. This note reads their files in `results/`, and stops with a message if any is missing.', 'Run Notes 8.3, 8.4 and 8.5 first to compare your own experiments. You can also study this note independently: it restores missing comparison files from clearly labelled author reference data, preserving any result files you already have.')
    text=text.replace("or the model can't learn the task at all", "to implement the intended trainable-head setup")
    text=text.replace('With a single run each, a 0.010 difference on 1,000 reviews (ten reviews) is within the noise.', 'A difference of 0.010 on 1,000 reviews is ten reviews in these runs. Repeated runs and a paired uncertainty analysis are needed before claiming the recipes have equivalent quality.')
    text=text.replace("and the update's overall size stays comparable, so you don't have to re-tune the learning rate", "which changes the explicit scaling factor α/r. The realised update also depends on initialization and optimization, so learning-rate tuning may still be needed")
    text=text.replace('fixes the random seeds so your numbers match the ones written here','fixes the random seeds to reduce variation within a controlled environment')
    text=text.replace('the same 500 reviews it has never seen','the same 500 reviews held out from our own training')
    text=text.replace('500 reviews it has never seen','500 reviews held out from our own training')
    text=text.replace('**The knowledge is entirely in the weights.**','**With architecture and tokeniser held fixed, the trained weights make the difference in this experiment.**')
    text=text.replace('the value is entirely in those numbers','trained weights matter with the architecture and tokeniser held fixed')
    text=text.replace('Its value is in the weights:', 'With the architecture and tokeniser fixed, trained weights matter:')
    text=text.replace('A pretrained model is the strongest choice when labels are scarce:', 'In this experiment, the pretrained checkpoint was strongest at the smaller label budgets:')
    text=text.replace('only a small head changes','a task-specific head provides the output interface; adapting the body is a separate choice')
    text=text.replace('Fine-tuning for sentiment changed every weight in the body by only about 2%.','The mean relative tensor-norm changes in the body were around 2%; this is not a percentage change for every scalar weight.')
    text=text.replace('changed every body tensor by only about 2%','gave mean relative tensor-norm changes of around 2% across the body groups')
    text=text.replace('indistinguishable','not significantly different in this paired comparison')
    text=text.replace('statistically the same as','not significantly different from')
    text=text.replace('identical to full fine-tuning on the same reviews (p = 1)','equal in observed accuracy to full fine-tuning in this run (p = 1; not proof of equivalence)')
    text=text.replace('the same as full fine-tuning (p = 1)','equal in observed accuracy to full fine-tuning in this run (p = 1)')
    text=text.replace('IMDb is *highly polar* (no mixed reviews)','IMDb uses polar rating labels (negative ratings at most 4/10, positive ratings at least 7/10); the prose can still contain mixed opinions')
    text=text.replace('**highly polar** (no mixed reviews)','**labelled from polar ratings**, although the prose can mix praise and criticism')
    text=text.replace('small new matrices that start at zero','small new matrices whose combined update starts at zero (A is random; B is zero)')
    text=text.replace('the 79 it held back would have been right only 0.637 of the time','the 91 it held back (79 abstentions plus 12 out-of-domain flags) would have been right only 0.637 of the time')
    text=text.replace('The test set, not validation, decides comparisons','A declared final test evaluates the selection made on validation')
    text=text.replace("That's why the test set, not validation, decides comparisons", "That is why final test reporting must remain separate from selecting settings on validation")
    text=text.replace('each with its own small head','each with its task-specific output head; fine-tuning may update the body too')
    if lid in ['8.1','8.4','8.5','8.7']:
        text=text.replace('keep the head','keep the original non-embedding head layers (the output projection remains tied to input embeddings)')
        text=text.replace('head unchanged','non-embedding head layers unchanged; the output projection stays tied')
        text=text.replace('**catastrophic forgetting**:','**degradation on this retention probe**:')
        text=text.replace('**Catastrophic forgetting:** the fine-tuned body', '**Retention probe:** the fine-tuned body')
    additions={
      ('7.1',14):'The comparison fixes architecture, preprocessing and tokeniser; it isolates the benefit of trained weights in that setup. These reviews are held out from our own training. Upstream documentation is evidence about earlier training data, not an exhaustive proof that a public checkpoint never encountered related material.',
      ('7.3',18):'The 4,608-token crossover is from this simplified multiplication count for DistilBERT\'s width and feed-forward expansion. It is not a universal Transformer boundary or a measured runtime crossover. Configured position limits also do not guarantee equal quality at every length.',
      ('7.5',40):'Review-likeness is a heuristic demonstrated on these inputs, not a guarantee of robust out-of-domain detection. Validate false accepts and false rejects on representative in-domain and out-of-domain examples before deploying it.',
      ('7.5',50):'Here the 0.637 held-back accuracy applies to all 91 non-answered reviews, not just the 79 low-confidence abstentions. The semantic-similarity and repetition observations are results of these particular examples, models and settings, not universal properties of embeddings or sampling.',
      ('7.7',34):'The documentation check rejects a known contaminated candidate. For other candidates, “no documented overlap found” is more accurate than a guarantee of clean upstream training. An absent licence field is missing evidence; inspect original publisher terms before concluding that no licence exists.',
      ('8.1',26):'This is one masked-word retention probe on 200 IMDb reviews, not a complete test of general knowledge. DistilBERT ties its vocabulary projection to its input embeddings: loading a changed body also changes those shared output weights. The other masked-word head layers remain original. This setup measures the resulting combined system; it is not a strictly fixed-decoder experiment.',
      ('8.4',43):'The retention comparison uses the same tied-output setup explained in 8.1. A loss increase here is evidence of reduced performance on this specific probe, not a comprehensive measure of catastrophic forgetting.',
      ('8.5',39):'Equal observed accuracy does not mean the classifiers make identical predictions. In the source reference results, full fine-tuning and LoRA disagree on 108 of 1,000 reviews. A paired p-value of 1 does not establish equivalence; stronger equivalence claims need a declared tolerance and an appropriate analysis.',
      ('8.5',41):'This remains the tied-output retention probe from 8.1. Disabling the adapter restores the frozen base path for this comparison; it does not by itself prove retention of every ability a deployed application might need.',
      ('8.7',24):'A validation–test gap alone cannot diagnose overfitting: sampling variation and selection on validation can also produce one. Examine training and held-out learning curves, and reserve a fresh final test after any further model selection.',
    }
    if (lid,index) in additions:text+='\n\n> **Interpret the evidence carefully.** '+additions[lid,index]
    if lid=='7.2' and index==53:
        text+='\n\nThe missing Hub metadata field is not proof that the original project has no licence. The [original CLIP repository includes an MIT licence](https://github.com/openai/CLIP/blob/main/LICENSE); verify the terms and provenance applicable to the exact weights and distribution you intend to use. Licence terms and intended-use recommendations are different questions.'
    if lid=='8.6':
        if index == -3:
            return "QLoRA is a reasonable candidate to benchmark because quantizing the frozen base can reduce storage substantially. The 15.23 GB bfloat16 base leaves insufficient room on a nominal 16 GB device for ordinary training allocations. The illustrative 4.28 GB four-bit subtotal does not guarantee a fit: measure peak memory with the intended sequence length, batch size, adapters, optimizer and implementation. Try smaller batches, shorter inputs, checkpointing or a smaller model if necessary. Compare held-out quality against prompting before deciding that adaptation is worthwhile."
        text=text.replace('**Full fine-tuning** of a large model is for teams with large GPU clusters and a strong reason, such as changing the model deeply or training on very large datasets.', '**Full fine-tuning** deserves a clear measured benefit for its cost. Hardware needs depend on model size, precision, sequence length, batch size, sharding and offload; large GPU clusters are not a universal requirement.')
        text=text.replace('Four bits allow only 15 values (here -7 to 7)','Four bits can encode 16 levels; this symmetric teaching example uses 15 of them (-7 to 7)')
        text=text.replace('For SmolLM2-135M, everything fits everywhere: even full fine-tuning needs only 2.15 GB.', 'For SmolLM2-135M, the illustrated float32 training-state subtotal is 2.15 GB; activations and runtime allocations are additional.')
        text=text.replace('It takes several large GPUs.', 'That exceeds the listed 80 GB device under this float32/Adam estimate; other precision, sharding and offload choices change the requirement.')
        text=text.replace('so it fits a 24 GB or 80 GB GPU','before adapters, activations and runtime workspaces; actual training fit must be measured')
        text=text.replace('small enough for an 8 GB consumer GPU','before the remaining runtime allocations; this alone does not establish an 8 GB training fit')
        text=text.replace('so fine-tuning fits on an 8 GB GPU','as an illustrative storage subtotal, not a guarantee of fitting training on an 8 GB GPU')
        text=text.replace('| Memory for weights + training state | Fits |','| Simplified storage subtotal | What this establishes |')
        text=text.replace('| no single GPU listed |','| Exceeds listed 80 GB under these float32 assumptions |').replace('| 24 GB, 80 GB |','| Weight storage only; measure peak training memory |').replace('| 8 GB and up |','| Weight storage only; no training-fit guarantee |')
        text=text.replace('QLoRA about 4.28 GB of weights and state','QLoRA about 4.28 GB in this illustrative weight-storage layout, before other training allocations')
        if index==36:text+='\n\nThe 20% margin is illustrative rather than a sufficient bound. Peak memory depends on sequence length, batch size, saved activations, checkpointing, unquantised modules, adapter/optimizer state and implementation workspaces. The hand-written uniform quantiser is not an executed NF4/QLoRA implementation. Full fine-tuning does not universally require a cluster; that statement depends on model size, hardware and the chosen precision/optimizer/offload recipe.'
    return text
