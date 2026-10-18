"""Exact PNG teaching figures for numerical image briefs in Modules 7–8.

Values are explicitly transcribed from the immutable author CPU reference run,
except the clearly labelled scalar quantisation example. No generated pixels
are used for measured charts. Run in the authoring environment with matplotlib.
"""
from pathlib import Path
import sys,textwrap
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch
import numpy as np
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'scripts/authoring'))
from register_module78_visual import register
OUT=ROOT/'static/img/module78-visuals';OUT.mkdir(exist_ok=True)
BG='#fbfbf5';INK='#173d31';BLUE='#356c9b';ORANGE='#c76931';GREEN='#56856a';GREY='#8c9991'
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':12,'text.color':INK,'axes.labelcolor':INK,'xtick.color':INK,'ytick.color':INK,'axes.spines.top':False,'axes.spines.right':False,'axes.spines.left':False,'axes.edgecolor':'#b9c7bc','axes.facecolor':BG,'figure.facecolor':BG,'savefig.facecolor':BG})

def figure(title,footer='Author CPU reference run • Interpret under the declared data and training budgets.'):
 f=plt.figure(figsize=(14,8));f.suptitle(title,fontsize=24,fontweight='bold',x=.06,ha='left',y=.95,color=INK)
 f.text(.06,.035,footer,fontsize=10,wrap=True,color='#465c4c');return f

def save(f,n):
 p=OUT/f'figure-{n.replace(".","-")}.png';f.savefig(p,dpi=150);plt.close(f);register(n,p,'code-rendered exact figure',reviewed=False)

def bars(ax,labels,values,unit='Accuracy',colors=None,maxval=1):
 y=np.arange(len(labels));ax.barh(y,values,color=colors or [BLUE]*len(y),height=.58);ax.set_yticks(y,labels,fontsize=12);ax.invert_yaxis();ax.set_xlim(0,maxval);ax.set_xlabel(unit);ax.grid(axis='x',alpha=.17);ax.set_axisbelow(True)
 for i,v in enumerate(values):ax.text(v+maxval*.012,i,f'{v:,.3f}' if maxval<=1 else f'{v:,.2f}',va='center',fontsize=12,fontweight='bold')

def cards(n,title,rows,footer,cols=2):
 f=figure(title,footer);count=len(rows);nr=int(np.ceil(count/cols));w=.88/cols;h=.71/nr
 for i,(heading,body) in enumerate(rows):
  ax=f.add_axes([.06+(i%cols)*w,.13+(nr-1-i//cols)*h,w-.025,h-.025]);ax.axis('off')
  ax.add_patch(FancyBboxPatch((0,0),1,1,boxstyle='round,pad=.0,rounding_size=.035',fc='#eef2e9',ec='#bccbbb',transform=ax.transAxes))
  ax.text(.055,.78,heading,fontsize=15,fontweight='bold',va='top',wrap=True)
  ax.text(.055,.51,textwrap.fill(body,49 if cols==2 else 86),fontsize=12,va='top',linespacing=1.6)
 save(f,n)

f=figure('The pretrained-model picture: compare the evidence');ax=f.add_axes([.35,.19,.55,.62]);bars(ax,['Random weights · 0 labels','SST-2 checkpoint · 0 IMDb labels','TF-IDF · 1,000 labels','Scratch network · 1,000 labels','TF-IDF · 22,404 labels'],[.486,.874,.826,.798,.918],colors=[GREY,BLUE,GREEN,ORANGE,GREEN]);ax.set_title('Same 500 validation reviews; upstream learning differs',fontsize=12);save(f,'7.1.5')
f=figure('Three readings of one model');ax=f.add_axes([.35,.2,.53,.61]);bars(ax,['Card prose · SST-2 dev','Card metadata · SST-2 validation','Reproduced SST-2 validation','Our IMDb validation'],[.913,.9106,.9106,.882],colors=[GREY,BLUE,BLUE,ORANGE]);ax.set_title('Different protocols and datasets must be named',fontsize=13);save(f,'7.3.2')
f=figure('How the service handled 1,000 test reviews');ax=f.add_axes([.08,.57,.84,.18]);start=0
for value,color in [(909,GREEN),(79,ORANGE),(12,GREY)]:ax.barh([0],[value],left=start,color=color,height=.5);start+=value
ax.set_xlim(0,1000);ax.set_yticks([]);ax.set_xlabel('Number of test reviews');ax.grid(axis='x',alpha=.15)
for x,heading,body,color in [(.08,'909 answered','Accuracy 0.899\nCoverage 0.909',GREEN),(.39,'79 abstentions','Low-confidence decisions\nHeld back from answering',ORANGE),(.70,'12 OOD flags','Genuine reviews flagged\nby a similarity heuristic',GREY)]:
 f.text(x,.42,heading,fontsize=19,fontweight='bold',color=color);f.text(x,.34,body,fontsize=13,linespacing=1.5)
f.text(.08,.18,'91 held back in total → accuracy 0.637 on those 91',fontsize=19,fontweight='bold');f.text(.08,.11,'Answering everything would give accuracy 0.875.',fontsize=14);save(f,'7.5.2')
cards('7.6.1','Deployment trade-offs',[('Shorter inputs','Less work, but truncation may discard task-relevant information.'),('Batching','Often improves throughput, while queueing and padding affect latency.'),('Lower precision','Changes storage, numerical error and kernel support; benchmark the workload.'),('Caching','Reuses prior work, but consumes memory and requires correct versioned keys.')],'Conceptual trade-offs • Measure on the hardware and workload you plan to deploy.')
f=figure('Quantisation: exact rounding and reconstruction','Illustrative scalar example • This figure does not claim measured model accuracy or an NF4 implementation.');ax=f.add_axes([.07,.24,.86,.5]);ax.axis('off');weights=np.array([.806,-.314,.052,-1.27]);q=np.rint(weights/.01).astype(int);back=q*.01
rows=[[f'{w:.3f}',str(int(v)),f'{b:.3f}',f'{abs(w-b):.3f}'] for w,v,b in zip(weights,q,back)]
t=ax.table(cellText=rows,colLabels=['Original weight','round(weight / 0.01)','Integer × 0.01','Absolute error'],loc='center',cellLoc='center');t.auto_set_font_size(False);t.set_fontsize(16);t.scale(1,3)
for (r,c),cell in t.get_celld().items():cell.set_edgecolor('#bac7b8');cell.set_facecolor('#e5ede1' if r==0 else BG)
f.text(.08,.13,'One scale (0.01) maps floating-point weights to int8 integers and back.',fontsize=16);save(f,'7.6.2')
cards('7.6.3','The deployment toolbox: measured examples',[('Parameter storage','DistilBERT: float32 267.8 MB; 16-bit 133.9 MB. These are weights, not peak memory.'),('Int8 linear weights','torchao saved state: 138.9 MB; 0.997 label agreement on 300 validation reviews.'),('Response-cache simulation','163 distinct model calls for 1,000 requests: 83.7% hits under this request distribution.'),('KV-cache example','5,950 versus 109 processed positions for the recorded generation example; identical text.')],'Author CPU reference run • Smaller storage does not guarantee faster execution.')
f=figure('Three candidates, five requirement checks','Author reference run • Missing licence evidence is not an established absence of any licence.');ax=f.add_axes([.05,.25,.9,.52]);ax.axis('off')
rows=[['SST-2 DistilBERT','Declared','No documented overlap','0.874','30.5 ms','267.8 MB'],['IMDb DistilBERT','Missing evidence','Known exposure','0.982','26.8 ms','267.8 MB'],['Twitter RoBERTa','Declared','No documented overlap','0.834','58.6 ms','498.6 MB']]
t=ax.table(cellText=rows,colLabels=['Candidate','Licence','Training exposure','Val. accuracy','CPU p95','Weights'],colWidths=[.20,.14,.24,.14,.14,.14],loc='center',cellLoc='left');t.auto_set_font_size(False);t.set_fontsize(12);t.scale(1,4)
for (r,c),cell in t.get_celld().items():cell.set_edgecolor('#bac7b8');cell.set_facecolor('#e5ede1' if r==0 else BG)
f.text(.06,.15,'Requirement: validation ≥ 0.85 · CPU p95 ≤ 100 ms · weights ≤ 600 MB',fontsize=15,fontweight='bold');save(f,'7.7.1')
f=figure('Two different risks: overfitting and retention');a=f.add_axes([.09,.23,.38,.57]);a.plot([1,2,3],[.519,.925,.969],'o-',color=BLUE,label='Training accuracy');a.plot([1,2,3],[.525,.850,.800],'s-',color=ORANGE,label='Validation accuracy');a.set_ylim(.4,1);a.set_xticks([1,2,3]);a.set_xlabel('Epoch');a.set_ylabel('Accuracy');a.legend(loc='lower right',fontsize=10);a.set_title('160 training / 200 validation reviews');a.grid(alpha=.2)
a=f.add_axes([.62,.23,.29,.57]);a.bar([0,1],[3.381,3.920],color=[BLUE,ORANGE]);a.set_xticks([0,1],['Pretrained','Adapted']);a.set_ylim(0,4.7);a.set_ylabel('Masked-word loss');a.set_title('A specific retention probe');
for i,v in enumerate([3.381,3.920]):a.text(i,v+.1,f'{v:.3f}',ha='center',fontweight='bold')
f.text(.57,.13,'Tied input/output weights;\nnot a complete capability audit.',fontsize=12);save(f,'8.1.2')
cards('8.2.2','What preparation changed on IMDb',[('Raw quality','50,000 labelled reviews; 58.4% contain HTML tags. No empty texts in this audit.'),('Duplicates','96 duplicate training rows, 199 duplicate test rows; 123 exact texts occur in both halves.'),('Split discipline','Splitting the raw training half first leaks 16 validation examples into training in the demo.'),('Token budget','At 128 tokens: head 0.842, head+tail 0.880, tail 0.888 on 500 validation reviews.')],'Author reference audit • Polar rating labels do not imply that every review contains no mixed opinions.')
f=figure('The baseline ladder: where the bar is');a=f.add_axes([.34,.19,.55,.62]);bars(a,['Majority class','TF-IDF · 1,000 labels','Frozen encoder + head · 1,000','SST-2 checkpoint · 0 IMDb labels','TF-IDF · all 22,404 labels'],[.485,.828,.837,.873,.913],colors=[GREY,GREEN,BLUE,ORANGE,GREEN]);a.set_title('Test accuracy on the same 1,000 reviews',fontsize=13);save(f,'8.3.2')
f=figure('Fine-tuning, measured');a=f.add_axes([.08,.24,.37,.56]);a.plot([16,32,48,63],[.475,.840,.865,.845],'o-',color=BLUE);a.scatter([48],[.865],s=180,facecolors='none',edgecolors=ORANGE,linewidths=3);a.set_ylim(0,1);a.set_xlabel('Optimizer step');a.set_ylabel('Validation accuracy · 200 reviews');a.set_title('Select checkpoint on validation');a.grid(alpha=.2)
a=f.add_axes([.68,.24,.23,.56]);bars(a,['TF-IDF 1k','Full fine-tuning','Frozen encoder','SST-2 checkpoint'],[.828,.834,.837,.873],colors=[GREEN,ORANGE,BLUE,BLUE]);a.set_title('Test · 1,000 reviews',fontsize=12);f.text(.08,.12,'Step 48 selected → test accuracy 0.834; not a general limit on fine-tuning.',fontsize=15);save(f,'8.4.2')
f=figure('LoRA and full fine-tuning: cost and observed quality');a=f.add_axes([.22,.49,.67,.27]);bars(a,['Full fine-tuning','LoRA + trained head'],[66.955010,.739586],unit='Trainable parameters (millions)',colors=[ORANGE,BLUE],maxval=78)
f.text(.08,.32,'Both source runs: 0.834 test accuracy',fontsize=20,fontweight='bold');f.text(.08,.23,'But 108 of 1,000 predicted labels differ. p = 1 does not prove equivalence.',fontsize=15)
f.text(.08,.13,'LoRA adapter: 3.0 MB · estimated training state: 280 MB vs 1,071 MB\nTraining-state estimates exclude activations and runtime workspaces.',fontsize=13,linespacing=1.6);save(f,'8.5.2')
f=figure('7B model storage: estimates, not GPU-fit guarantees','Illustrative arithmetic • Peak training memory must include activations, adapters, unquantised modules and runtime allocations.');a=f.add_axes([.37,.25,.52,.56]);bars(a,['Float32 full-model Adam state','Bfloat16 base weights','Illustrative 4-bit weight layout'],[121.85,15.23,4.28],unit='GB · decimal storage subtotal',colors=[ORANGE,BLUE,GREEN],maxval=140);f.text(.08,.14,'No fixed 20% margin can establish that training will fit an 8 GB GPU.',fontsize=17,fontweight='bold');save(f,'8.6.2')
cards('8.7.2','The verdict for this experiment',[('Adapted candidates','Full fine-tuning and LoRA: 0.834 test accuracy. Neither beat the selected SST-2 baseline here.'),('1,000-label budget','The off-the-shelf SST-2 checkpoint scored 0.873 without additional IMDb adaptation labels.'),('Separate all-label reference','TF-IDF with 22,404 training labels scored 0.913 and reads the whole review.'),('Next experiment','More labels, longer inputs, repeated runs and a fresh final test after further model selection.')],'Source reference verdict • One epoch, 1,000 adaptation labels and 128-token Transformer inputs; not a universal model ranking.')
print('Rendered and registered fourteen exact numerical figures.')
