"""Register a project-owned selected image and its auditable provenance."""
import argparse,hashlib,json,shutil
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'static/img/module78-visuals'
CAPTIONS={
'7.1.1':'The architecture and tokenizer are held fixed. The saved CPU run scores 0.486 with random weights and 0.874 with pretrained/adapted weights on the same 500 validation reviews; this does not audit all upstream exposure.',
'7.1.2':'Pretraining produces reusable weights. Inference can use a checkpoint directly; optional adaptation changes selected weights for a downstream objective.',
'7.1.3':'A pretrained body can support different output interfaces. Newly initialised heads require training, and task adaptation can update the body as well as the head.',
'7.1.4':'Configuration describes the architecture, weights supply learned numbers, and the matching tokenizer defines the text interface. These schematic file objects are not a screenshot.',
'7.1.5':'Author CPU reference results on the same 500 validation reviews. Label budgets and prior training differ; these measurements do not establish a universal winner.',
'7.2.1':'The Hub and local cache supply compatible artifacts. Tokenizers, Datasets and Transformers serve different stages of the application; cards supply evidence to inspect.',
'7.2.2':'A repository can contain documentation, configuration, weights and tokenizer artifacts in several formats. Download only the compatible files required by your framework.',
'7.2.3':'Inspect examples, transform them under a declared policy, then dynamically pad and mask each batch. Learned preprocessing must be fitted on training data only.',
'7.2.4':'The repository name resolves to artifacts; the tokenizer prepares IDs and masks, and compatible model code loads the architecture and weights before inference.',
'7.3.1':'Requirements narrow a shortlist; documentation and representative evaluation determine whether a candidate actually fits. Popularity and parameter count alone do not decide.',
'7.3.2':'The card text, structured metadata, and reproduced SST-2 score refer to a different evaluation context from the IMDb run. All displayed numbers come from the source reference results.',
'7.3.3':'Check interface, parameter storage versus runtime memory, context, benchmark protocol, training exposure and deployment terms before adopting a model.',
'7.4.1':'Tokenization, model computation, logits, probabilities and label mapping are separate steps. Weights stay fixed during this inference flow.',
'7.4.2':'Padding adds positions, an attention mask restricts access to padded positions, and truncation discards input. This illustration is not a causal future-token mask.',
'7.4.3':'Evaluation mode controls layers such as dropout; no-gradient inference controls autograd. Model and inputs must use compatible devices. Save preprocessing and settings too.',
'7.5.1':'An application adds input validation, decision rules, error handling and measured quality to a pretrained capability. The OOD check is a heuristic to validate, not a guarantee.',
'7.5.2':'Of 1,000 source test reviews, 909 were answered, 79 received a confidence abstention and 12 were flagged out of domain. Held-back accuracy 0.637 applies to all 91 non-answered reviews.',
'7.5.3':'Each capability has failure modes. The notebook measures particular examples; similarity, confidence and fluent generation do not by themselves establish correctness.',
'7.6.1':'Deployment choices trade quality, latency, throughput and memory. The directions shown are engineering considerations to test on the target workload, not measured universal laws.',
'7.6.2':'Illustrative symmetric rounding with scale 0.01. The exact reconstruction arithmetic is computed in the figure script; it is separate from the notebook\'s measured model experiment.',
'7.6.3':'Source CPU reference measurements and counts. Weight storage is not peak runtime memory, and positions processed with a KV cache are not a direct FLOP or speedup ratio.',
'7.7.1':'Source validation and CPU measurements under declared requirements. The IMDb-trained candidate has known evaluation exposure and missing licence evidence; other candidates are screened by documented information.',
'7.7.2':'Requirements, documentation, representative inputs, validation choices and final reporting belong in a recorded process. Repeated selection on a test sample requires a new final test.',
'8.1.1':'Prompting changes the input; a frozen encoder supports a trained head; LoRA changes selected adapters; full fine-tuning makes the selected base parameters trainable. More complexity need not improve quality.',
'8.1.2':'Source small-run measurements illustrate an overfitting warning and degraded masked-word retention. The retention experiment uses a tied output projection and is not a complete capability audit.',
'8.1.3':'Measure simpler options before adding training cost. The order is a decision aid, not a guaranteed quality ranking or a claim that every task requires an LLM prompt.',
'8.2.1':'Group duplicate examples before splitting; keep validation and test out of training updates. Fit learned preprocessing on train, then apply the declared policy to held-out data.',
'8.2.2':'Counts and token-budget comparisons from the supplied IMDb audit. Exact deduplication defines this course split; the separate normalised audit is not silently substituted for it.',
'8.3.1':'Baselines share a declared evaluation protocol. Off-the-shelf, frozen-feature and trained alternatives use different upstream training and sometimes different input information; disclose those differences.',
'8.3.2':'Source test accuracy on 1,000 reviews, with training-label budgets shown. All-label TF-IDF is a separate reference budget; it reads the full text rather than 128 Transformer tokens.',
'8.4.1':'Only training batches drive gradients and optimizer updates. Validation selects checkpoints; a declared final test reports the selected setup.',
'8.4.2':'Source CPU reference run: the custom-loop checkpoint was chosen on 200 validation reviews and then reported on 1,000 test reviews. The small experiment is not an optimised comparison of all training recipes.',
'8.5.1':'LoRA adds (alpha/r) BA beside a frozen weight matrix. A starts random and B starts at zero, so the initial adapter update is zero; the task head may also train.',
'8.5.2':'Both source runs achieved 0.834 test accuracy but disagreed on 108 of 1,000 predictions. Equal observed accuracy and p=1 do not prove equivalence. Memory estimates exclude activations.',
'8.6.1':'This assistant-only SFT setup keeps prompt tokens visible as context while masking their targets from loss. Causal prediction shifts targets by one; LoRA adapts selected parameters.',
'8.6.2':'Simplified storage arithmetic, not measured peak training memory: float32 full-model Adam state, bfloat16 base weights, and an illustrative four-bit layout. No bar guarantees a GPU training fit or implements NF4.',
'8.7.1':'Evaluation combines training behaviour, held-out metrics, errors, retention, costs, reproducibility and the application decision. A p-value alone does not settle suitability.',
'8.7.2':'Keep/reject conclusions apply to the supplied one-epoch, 1,000-label experiment and declared requirements. Future tuning needs new validation work and a fresh final test sample.',
}

def register(number,path,mode,prompt=None,reviewed=False):
    row=next(r for r in json.loads((ROOT/'docs/curriculum/module78-visual-requests.json').read_text()) if r['id']==number)
    OUT.mkdir(exist_ok=True);target=OUT/f'figure-{number.replace(".","-")}.png'
    if Path(path).resolve()!=target.resolve():shutil.copy2(path,target)
    with Image.open(target) as img:dimensions=list(img.size);img.verify()
    manifest_path=OUT/'manifest.json';manifest=json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    digest=hashlib.sha256(target.read_bytes()).hexdigest()
    previous=manifest.get(number,{})
    reviewed=reviewed or (previous.get('reviewed',False) and previous.get('sha256')==digest)
    manifest[number]=dict(file=str(target.relative_to(ROOT)),lesson=row['lesson'],section=row['section'],source_cell=row['source_cell'],title=row['title'],alt=row['title']+'. '+CAPTIONS[number],caption=CAPTIONS[number],mode=mode,sha256=digest,dimensions=dimensions,reviewed=reviewed)
    manifest_path.write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')
    if prompt:
        p=OUT/'generation-provenance.json';d=json.loads(p.read_text()) if p.exists() else {};d[number]=dict(tool='built-in image_gen',prompt=prompt,source_output=str(path),selected_file=str(target.relative_to(ROOT)));p.write_text(json.dumps(d,indent=2,ensure_ascii=False)+'\n')
    return target

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('id');ap.add_argument('image');ap.add_argument('--prompt');args=ap.parse_args();print(register(args.id,args.image,'built-in image_gen',args.prompt))
