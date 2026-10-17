"""Exact numerical teaching figures, also the offline companion to six web animations."""
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'static/img/module56-visuals'
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':13,'text.color':'#202d28','axes.labelcolor':'#202d28','figure.facecolor':'#f7f7f2','axes.facecolor':'#f7f7f2','savefig.facecolor':'#f7f7f2'})

def page(title,sub,n=3):
    fig,axes=plt.subplots(1,n,figsize=(14,6),squeeze=False)
    fig.suptitle(title,fontsize=24,fontweight='bold',y=.96)
    fig.text(.5,.86,sub,ha='center',fontsize=12)
    fig.subplots_adjust(left=.05,right=.95,bottom=.16,top=.74,wspace=.5)
    return fig,axes[0]

def save(fig,name,footer):
    fig.text(.5,.055,footer,ha='center',fontsize=11)
    fig.savefig(OUT/(name+'-worked.png'),dpi=150)
    plt.close(fig)

def matrix(ax,data,title,highlight=None):
    a=np.asarray(data)
    ax.imshow(a,cmap='Blues',vmin=min(-1,a.min()),vmax=max(1,a.max()),interpolation='nearest')
    for (r,c),v in np.ndenumerate(a): ax.text(c,r,f'{v:g}',ha='center',va='center',color='white' if v>max(1,a.max())*.65 else '#202d28',fontsize=17)
    if highlight: ax.add_patch(Rectangle((highlight[1]-.5,highlight[0]-.5),highlight[3],highlight[2],fill=False,edgecolor='#e0702f',linewidth=4))
    ax.set_xticks([]);ax.set_yticks([]);ax.set_title(title,pad=12,fontsize=14)
    ax.set_xticks(np.arange(-.5,a.shape[1]),minor=True);ax.set_yticks(np.arange(-.5,a.shape[0]),minor=True);ax.grid(which='minor',color='#f7f7f2',linewidth=2);ax.tick_params(which='minor',bottom=False,left=False)

def boxtext(ax,title,text):
    ax.axis('off');ax.set_title(title,fontsize=14,fontweight='bold');ax.text(.5,.5,text,ha='center',va='center',fontsize=15,linespacing=1.8,transform=ax.transAxes)

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    a=np.arange(1,17).reshape(4,4)
    f,axs=page('Flattening preserves values and row order','A 4 × 4 worked example. Each coloured row becomes four consecutive vector entries.')
    matrix(axs[0],a,'Original image grid', (1,0,1,4))
    boxtext(axs[1],'Flatten → 16 values','[1, 2, 3, 4,\n5, 6, 7, 8,\n9, 10, 11, 12,\n13, 14, 15, 16]\nRead as one continuous vector')
    matrix(axs[2],a,'Reshape → original grid',(1,0,1,4))
    save(f,'flatten','Known dimensions recover the grid. Dense layers have no built-in locality or weight sharing.')
    a=np.array([[0,0,1,0,0],[0,1,1,0,0],[0,1,1,1,0],[0,0,1,1,0],[0,0,0,0,0]])
    k=np.array([[1,0,-1],[1,0,-1],[1,0,-1]])
    out=np.array([[(a[r:r+3,c:c+3]*k).sum() for c in range(3)]for r in range(3)])
    f,axs=page('One shared convolution filter, nine output values','Stride 1 · no padding · no bias · no activation. Highlighted first output = −3.')
    matrix(axs[0],a,'Input · 5 × 5',(0,0,3,3));matrix(axs[1],k,'Shared filter · 3 × 3');matrix(axs[2],out,'Output · 3 × 3',(0,0,1,1))
    save(f,'convolution','At every position: multiply the 3 × 3 patch by the same weights and add. PyTorch uses cross-correlation.')
    f,axs=page('One coordinate through an LSTM','Supplied example gates: forget = 0.9 · input = 0.1 · candidate = 0.5 · output = 0.8')
    boxtext(axs[0],'1. Retain memory','old cell = 1\n0.9 × 1 = 0.90')
    boxtext(axs[1],'2. Write and add','new content = 0.1 × 0.5\nnew cell = 0.90 + 0.05\n= 0.95')
    boxtext(axs[2],'3. Expose hidden state','h = 0.8 × tanh(0.95)\n≈ 0.592')
    save(f,'memory','The cell state carries memory; the hidden state exposes a gated view. Vector operations are coordinate-wise.')
    f,axs=page('Causal attention mixes projected values','Fixed teaching scores for the query “sat”. The later token “down” is masked before softmax.')
    w=np.exp([0,2,1]);w=w/w.sum();v=np.array([[1,0],[0,2],[2,1]]);output=w@v
    boxtext(axs[0],'1. Scores → weights','the: 0 → 0.090\ncat: 2 → 0.665\nsat: 1 → 0.245\ndown: masked → 0')
    boxtext(axs[1],'2. Projected values','the: [1, 0]\ncat: [0, 2]\nsat: [2, 1]\ndown: [1, 3]')
    boxtext(axs[2],'3. Weighted sum',f'0.090[1, 0] +\n0.665[0, 2] +\n0.245[2, 1]\n≈ [{output[0]:.3f}, {output[1]:.3f}]')
    save(f,'attention','Allowed weights sum to 1. These numbers illustrate the calculation; they are not trained attention measurements.')
    f,axs=page('LayerNorm keeps coordinates different','One token: [1, 2, 3, 6]. Mean = 3; population variance = 3.5; ε = 0.00001.')
    boxtext(axs[0],'1. Centre','[1, 2, 3, 6] − 3\n= [−2, −1, 0, 3]')
    boxtext(axs[1],'2. Standardise','divide by √(3.5 + ε)\n[−1.069, −0.535,\n0.000, 1.604]')
    boxtext(axs[2],'3. Learned affine map','example: 1.5z + 0.2\n[−1.404, −0.602,\n0.200, 2.605]')
    save(f,'norm','Real LayerNorm learns scale and shift for each coordinate. It normalises within a token, not across tokens.')
    f,axs=page('Generation appends one chosen token at a time','Each row uses the final-position logits. The choices T, h, o are prescribed for this example.')
    for ax,j in zip(axs,range(3)):
        ctx='ROMEO:<newline>'+['','T','Th'][j]
        boxtext(ax,f'Round {j+1}',ctx+'\n↓ model forward pass\n↓ choose '+['T','h','o'][j]+'\n↓ append to context')
    save(f,'generation','Model weights remain fixed. No training loss, backpropagation or optimizer update occurs during generation.')
    print('Saved six exact worked figures.')

if __name__=='__main__': main()
