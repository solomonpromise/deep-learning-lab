"""Portable companions and paused walkthroughs for exact teaching examples."""
import base64,json,re
import nbformat
MOTIONS={
'7.4':(4,'padding78','Follow padding and attention masking',[
 ['Tokenize two inputs','A: [101, 42, 102] · B: [101, 17, 25, 102]','IDs are arbitrary vocabulary indices in this toy example; 101/102 mark boundaries and 0 is padding.'],
 ['Pad this batch','A: [101, 42, 102, 0] · B unchanged','The longest example has four tokens, so the shorter example receives one padding position.'],
 ['Construct masks','A: [1, 1, 1, 0] · B: [1, 1, 1, 1]','The mask allows attention to real tokens and prevents attending to the padded key. This is not a causal future-token mask.'],
 ['Run fixed weights','IDs + masks → logits → label','Padding creates a batch shape; it does not restore content discarded by truncation. Inference changes no weights.']]),
'7.5':(6,'service78','Trace three service decisions',[
 ['Validate the input','Empty input → reject','Validation happens before model inference. A model score cannot repair an invalid request.'],
 ['Check the declared domain','Flagged out of domain → hold back','This course uses a review-likeness heuristic, which can falsely accept or reject inputs.'],
 ['Apply a confidence threshold','Illustration: 0.88 ≥ 0.80 → answer','These are invented decision-rule values, not a measurement of model calibration.'],
 ['Abstain when required','Illustration: 0.63 < 0.80 → abstain','The source run answers 909, abstains on confidence for 79, and flags 12 as out of domain. All 91 non-answered cases form the held-back group.']]),
'7.6':(5,'quantize78','Round, reconstruct, measure error',[
 ['Choose an illustrative scale','w = 0.806 · scale = 0.01','This scalar example illustrates uniform rounding. The notebook separately measures an actual quantized model.'],
 ['Round to an integer','q = round(0.806 / 0.01) = 81','81 is inside signed int8 range. A full quantizer must define clipping and how scales are selected.'],
 ['Reconstruct the value','ŵ = 81 × 0.01 = 0.810','The integer and scale together approximate the original value.'],
 ['Measure reconstruction error','ŵ − w = 0.004','Smaller weight error need not imply an equal change in application quality. Measure quality, latency and peak memory on the intended workload.']]),
'8.2':(4,'split78','Keep duplicate groups in one split',[
 ['Find identical examples','A: “good film” · B: “bad film” · C: “good film”','This exact-match toy policy groups A and C; real preprocessing and near-duplicate policies must be declared.'],
 ['Group before splitting','Group 1: {A, C} · Group 2: {B}','Splitting rows first could place the same text in train and test and inflate evaluation.'],
 ['Assign whole groups','Train: {A, C} · Test: {B}','This two-group example explains the boundary; it is far too small for a useful model evaluation.'],
 ['Fit only on train','Learn preprocessing from train → apply to test','Test data never supplies gradients or fitted vocabulary/statistics under this protocol. Validation is a separate group-held-out split.']]),
'8.4':(5,'finetune78','Separate learning from selection',[
 ['Training forward pass','Training batch → logits → loss','The labels of this training batch define the optimization objective.'],
 ['Backward and update','loss.backward() → optimizer.step()','Trainable parameters change; clear gradients as required before the next accumulation cycle.'],
 ['Validation checkpoint','No gradients · score saved checkpoint','Validation selects settings and checkpoints. It does not directly update weights in this training loop.'],
 ['Final test reporting','Selected setup → held-out test','Repeatedly tuning after inspecting test results requires a fresh final test for an unbiased report.']]),
'8.5':(6,'lora78','See why the initial adapter update is zero',[
 ['Freeze a 2 × 2 base','W₀ = [[1, 0], [0, 1]] · x = [2, 1]','Use rank r = 1 and α = 1, so α/r = 1. This tiny matrix is an illustration, not a measured trained adapter.'],
 ['Initialize the adapter','A = [[0.2, −0.1]] · B = [[0], [0]]','A starts random; B starts zero. Ax = 0.3, but BAx = [0, 0]. The initial combined adapter update is zero.'],
 ['After an illustrative update','B = [[0.5], [−0.2]] · A held as shown','For illustration, B changes to these supplied values. We are not deriving an optimizer step or running training here.'],
 ['Add the low-rank path','W₀x + BAx = [2, 1] + [0.15, −0.06] = [2.15, 0.94]','The base remains frozen while adapters train. A task head may also train; include it when counting trainable parameters.']]),
'8.6':(4,'sft78','Separate visible context from supervised targets',[
 ['Format a toy exchange','Input tokens: [USER, hi, ASSISTANT, hello, EOS]','These names stand for token IDs in a simplified assistant-only supervised fine-tuning example.'],
 ['Keep context visible','Attention mask: [1, 1, 1, 1, 1]','All five positions are real tokens. A separate causal attention mask prevents future-token access.'],
 ['Mask prompt targets','Labels: [−100, −100, −100, hello, EOS]','−100 means ignore this target in cross-entropy. It does not hide the prompt from the model.'],
 ['Apply causal shifting','logits at ASSISTANT → hello; logits at hello → EOS','Causal-LM loss aligns logits[:-1] with labels[1:]. Only assistant-response targets contribute here. LoRA changes selected parameters during training.']])}

def inserts(lid):
    if lid not in MOTIONS:return []
    sec,scene,title,steps=MOTIONS[lid]
    return [dict(type='widget',name='concept-motion',section=sec,at='end',title=title,intro='Step through a fixed example; each stage explains its assumptions.',props=dict(scene=scene),caption='Paused on arrival. Use Previous step, Play/Pause, Next step or Reset. No model runs in this walkthrough.')]

def add_worked_figures(cells,lid,root):
    if lid not in MOTIONS:return cells
    sec,scene,title,steps=MOTIONS[lid];result=[];current=None;done=False
    def flush():
        nonlocal done
        if current!=sec or done:return
        p=root/f'static/img/module78-visuals/{scene}-worked.png'
        c=nbformat.v4.new_markdown_cell(f'**Visual walkthrough: {title}.**\n\n![{title}; exact steps are described below.](attachment:{p.name})\n\n'+'\n\n'.join(f'**{i+1}. {a}.** {b}. {t}' for i,(a,b,t) in enumerate(steps))+'\n\n*The app adds a paused animation of this same supplied example.*')
        c.attachments={p.name:{'image/png':base64.b64encode(p.read_bytes()).decode()}};c.metadata['visual_companion']=scene;result.append(c);done=True
    for c in cells:
        if c.cell_type=='markdown' and re.search(r'^## ',c.source,re.M):
            flush();h=re.search(r'^## (\d+)\.',c.source,re.M);current=int(h[1]) if h else None
        result.append(c)
    flush();assert done,lid
    return result

def write_assets(root):
    import matplotlib;matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import textwrap
    for lid,(sec,scene,title,steps) in MOTIONS.items():
        fig,axes=plt.subplots(4,1,figsize=(14,10),facecolor='#fffdf6');fig.suptitle(title,fontsize=21,color='#163e36',y=.98)
        for i,(ax,(a,b,t)) in enumerate(zip(axes,steps)):
            ax.axis('off');ax.text(.02,.92,f'{i+1}. {a}',fontsize=16,weight='bold',color='#174a3e',va='top');ax.text(.03,.63,'\n'.join(textwrap.wrap(b,100)),fontsize=14,color='#27668a',va='top');ax.text(.03,.30,'\n'.join(textwrap.wrap(t,130)),fontsize=11,color='#333333',va='top')
        fig.subplots_adjust(hspace=.15,top=.92,bottom=.02);fig.savefig(root/f'static/img/module78-visuals/{scene}-worked.png',dpi=130);plt.close(fig)
    p=root/'static/js/widgets/concept-motion.js';js=p.read_text();js=re.sub(r'  /\* Module 7/8 worked sequences \*/.*?  /\* End Module 7/8 sequences \*/\n','',js,flags=re.S)
    payload='  /* Module 7/8 worked sequences */\n'
    for lid,(sec,scene,title,steps) in MOTIONS.items():
        payload+='  scenes['+json.dumps(scene)+']={n:4,draw:function(s){var steps='+json.dumps(steps,ensure_ascii=False)+';return {html:\'<div class="cm-path">\'+steps.map(function(a,j){return \'<div class="cm-stage\'+(j===s?\' is-current\':\'\')+\'"><h4>\'+(j+1)+\'. \'+a[0]+\'</h4><p>\'+a[1]+\'</p></div>\';}).join(arrow())+\'</div>\',text:steps[s][2]};}};\n'
    payload+='  /* End Module 7/8 sequences */\n';js=js.replace("  window.DLP.widgets['concept-motion']",payload+"  window.DLP.widgets['concept-motion']");p.write_text(js)

if __name__=='__main__':
    from pathlib import Path
    write_assets(Path(__file__).resolve().parents[2])
