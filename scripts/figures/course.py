"""Redraw teaching diagrams in Modules 1–4; embed portable notebook attachments.

Run with Python + matplotlib + NumPy + Pillow. Code and measured outputs are not
changed by this script. Editable SVG originals, captions and alt text are saved.
"""
from pathlib import Path
import base64,html,json,re,io
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.patches import Circle,Rectangle,FancyArrowPatch,Arc,Ellipse
import module5 as art
from module5 import canvas,text,box,arrow,INK,GREEN,SOFT,LIME,BLUE,RUST,LINE,MUTED
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'static/img/course-figures';art.OUT=OUT
ITEMS=[]


def finish(fig,lid,cell,number,caption,alt,prompt=False):
    art.save(fig,number,caption,alt)
    ITEMS.append({'lesson':lid,'cell':cell,'number':number,'caption':caption,'alt':alt,'prompt':prompt})


def panels(ax,labels,y=188,h=350):
    width=(1116-24*(len(labels)-1))/len(labels)
    points=[]
    for i,label in enumerate(labels):
        x=42+i*(width+24);box(ax,x,y,width,h);text(ax,x+18,y+32,label,17,weight='bold');points.append((x,width))
    return points


def chain(ax,labels,y=288,x=42,w=1116,h=82,sub=None,size=15):
    cell=(w-35*(len(labels)-1))/len(labels)
    for i,label in enumerate(labels):
        xx=x+i*(cell+35);box(ax,xx,y,cell,h,LIME if i==len(labels)-1 else SOFT,GREEN)
        text(ax,xx+cell/2,y+h/2,label,size,align='center',weight='bold')
        if sub:text(ax,xx+cell/2,y+h+32,sub[i],11,MUTED,align='center')
        if i<len(labels)-1:arrow(ax,xx+cell+3,y+h/2,xx+cell+32,y+h/2)


def matrix(ax,x,y,rows,cols,cell=30,color=SOFT,values=None):
    for r in range(rows):
        for c in range(cols):
            box(ax,x+c*cell,y+r*cell,cell,cell,color,GREEN,.8)
            if values is not None:text(ax,x+(c+.5)*cell,y+(r+.5)*cell,str(values[r][c]),11,align='center')


def tinyplot(fig,area):
    ax=fig.add_axes(area,facecolor='white')
    for s in ['top','right']:ax.spines[s].set_visible(False)
    for s in ['bottom','left']:ax.spines[s].set_color(LINE)
    ax.tick_params(colors=MUTED,labelsize=10);ax.grid(axis='y',color=SOFT,lw=1);return ax


def course_path():
    n='1.1.1';fig,ax=canvas(n,'A course built around the learning mechanism.', 'Follow the representation from its first weights to a model you can evaluate.',780)
    stages=[('01','ML → DL','Learn representations'),('02','PyTorch','Build the model'),('03','Training dynamics','Diagnose the learning'),('04','Engineering','Trust the experiment'),('05','Embeddings','Compare representations'),('06','Transformers','Connect tokens'),('07','Pretrained models','Reuse an encoder'),('08','Fine-tuning','Adapt efficiently'),('09','Evaluation','Measure usefulness'),('10','Model engineering','Ship a reproducible project')]
    for i,(num,title,desc) in enumerate(stages):
        r,c=divmod(i,5);x=42+c*225;y=190+r*218;box(ax,x,y,212,179,SOFT,GREEN);text(ax,x+16,y+30,num,21,GREEN,weight='bold');text(ax,x+16,y+76,title,12,weight='bold');text(ax,x+16,y+134,desc,10,MUTED)
        if c<4:arrow(ax,x+214,y+88,x+223,y+88,lw=1.2)
    text(ax,42,670,'Then: Generative AI and the capstone',19,GREEN,weight='bold')
    text(ax,42,714,'Each module adds something you will build, run, inspect or measure.',13,MUTED)
    finish(fig,'1.1',9,n,'The ten Deep Learning Lab modules, followed by Generative AI and the capstone. Read each row left to right.','Ten module cards follow the learning path from machine learning to PyTorch, training, engineering, embeddings, Transformers, pretrained models, efficient fine-tuning, evaluation and model engineering.')


def pipelines():
    n='1.1.2';fig,ax=canvas(n,'Who decides what the model can see?', 'Feature design happens before learning in one pipeline, and inside learning in the other.',710)
    for x,w in panels(ax,['Features written by a person','Features learned from data'],h=438):
        idx=0 if x==42 else 1
        labels=['Raw data','Feature engineering','Learning algorithm','Prediction'] if not idx else ['Raw data','Learned encoder','Task head','Prediction']
        for i,label in enumerate(labels):
            yy=254+i*82;box(ax,x+25,yy,w-50,57,LIME if i==1 else SOFT,GREEN);text(ax,x+w/2,yy+28,label,17,align='center',weight='bold')
            if i<3:arrow(ax,x+w/2,yy+59,x+w/2,yy+79)
        text(ax,x+w/2,604,'People still choose the data and objective.' if idx else 'Domain knowledge becomes explicit measurements.',11,MUTED,align='center')
    finish(fig,'1.1',12,n,'Both pipelines learn to make predictions. Representation learning also learns the feature transformation; people still choose data, architecture and objective.','Two pipelines compare raw data to hand-engineered features to a learning algorithm and prediction, versus raw data to a learned encoder to a task head and prediction.')


def ruler_coil():
    n='1.1.3';fig,ax=canvas(n,'One straight boundary cannot unwind a spiral.', 'Geometry can make the same learning rule succeed or fail.',660)
    panels(ax,['Two separated groups','Two interleaved spirals'],h=369)
    rng=np.random.default_rng(9)
    for i,area in enumerate([[.085,.25,.365,.30],[.575,.25,.365,.30]]):
        p=tinyplot(fig,area)
        if i==0:
            a=rng.normal([-.9,.7],.25,(35,2));b=rng.normal([.9,-.7],.25,(35,2))
        else:
            theta=np.linspace(0,3.5*np.pi,65);r=np.linspace(.1,1.7,65);a=np.c_[r*np.cos(theta),r*np.sin(theta)];b=-a
        p.scatter(*a.T,s=17,c=BLUE,label='class 0');p.scatter(*b.T,s=17,c=RUST,label='class 1');p.plot([-2,2],[-2,2],c=GREEN,lw=2);p.set(xlim=(-2,2),ylim=(-2,2),xticks=[],yticks=[])
    text(ax,322,586,'A straight line can separate these classes.',12,GREEN,align='center');text(ax,893,586,'A straight line cuts through both classes.',12,RUST,align='center')
    finish(fig,'1.1',22,n,'Schematic data geometry: a linear separator suits separated groups but not interleaved spirals. These points illustrate the concept, not a measured experiment.','Two panels show blue and rust classes. A straight line separates two clusters in the first panel but crosses both interleaved spiral classes in the second.')


def learned_features():
    n='1.1.4';fig,ax=canvas(n,'Write a transformation or learn one.', 'Both approaches change the representation before the final decision.',650)
    text(ax,42,188,'Hand-engineered representation',18,weight='bold')
    chain(ax,['Raw (x, y)','r, sin(α), cos(α)','Linear classifier','Prediction'],y=224,sub=['2 input values','Rules chosen by a person','Fit the final coefficients','A class label'],size=13)
    text(ax,42,423,'Learned representation',18,weight='bold')
    chain(ax,['Raw (x, y)','64 learned features','Task head','Prediction'],y=459,sub=['2 input values','Fit by gradient descent','Learned output weights','A class label'],size=13)
    finish(fig,'1.1',53,n,'The lesson compares hand-designed polar features with a learned hidden representation. The encoder and head are trained together in the neural network.','A top pipeline transforms coordinates by hand into radius and angular features before a linear classifier. A bottom pipeline learns sixty-four hidden features before the output head.')


def hand_design():
    n='1.1.5';fig,ax=canvas(n,'Useful features depend on relationships.', 'More input values do not automatically make a task harder; structure matters.',640)
    labels=['2 coordinates','20 tabular columns','64 digit pixels','A large photograph'];points=panels(ax,labels,h=298)
    for i,(x,w) in enumerate(points):
        if i==0:
            ax.plot([x+45,x+170],[371,281],color=GREEN,lw=3);text(ax,x+w/2,425,'A geometric rule',12,MUTED,align='center')
        elif i==1:
            matrix(ax,x+50,267,4,5,27);text(ax,x+w/2,425,'Domain measurements',12,MUTED,align='center')
        elif i==2:
            matrix(ax,x+60,263,6,6,23);text(ax,x+w/2,425,'Spatial relationships',12,MUTED,align='center')
        else:
            art.leaf(ax,x+w/2,337,.9,True);text(ax,x+w/2,425,'Textures, parts, context',12,MUTED,align='center')
    text(ax,42,552,'One brightness average cannot preserve the strokes that distinguish handwritten digits.',15,GREEN,weight='bold')
    text(ax,42,592,'Representation learning is useful when writing all the relevant measurements by hand becomes impractical.',12,MUTED)
    finish(fig,'1.1',84,n,'A task’s useful information can live in relationships between values. The panels are examples, not a universal dimensionality threshold for deep learning.','Four panels contrast a geometric rule on two coordinates, human-designed tabular columns, the spatial arrangement of digit pixels, and textures and context in a photograph.')


def neuron(cell,number,compact=False):
    if compact:
        fig,ax=canvas(number,'ReLU turns a weighted sum into an activation.', 'A negative pre-activation is clipped to zero. A positive one passes through.',660)
        box(ax,42,208,446,274,SOFT,GREEN)
        text(ax,265,255,'First: compute the weighted sum',16,align='center',weight='bold')
        text(ax,265,335,'z = Σ wᵢxᵢ + b',25,align='center')
        text(ax,265,423,'Then: a = max(0, z)',18,GREEN,align='center')
        arrow(ax,494,346,575,346)
        p=tinyplot(fig,[.55,.31,.37,.36]);p.plot([-3,0,3],[0,0,3],color=GREEN,lw=3)
        p.set(xlim=(-3.3,3.3),ylim=(-.3,3.3),xticks=[-3,0,3],yticks=[0,1,2,3],xlabel='pre-activation z',ylabel='activation a')
        p.scatter([-2,2],[0,2],s=60,color=RUST,zorder=3)
        p.annotate('z = −2 → a = 0',(-2,0),xytext=(-32,17),textcoords='offset points',fontsize=10,color=RUST)
        p.annotate('z = 2 → a = 2',(2,2),xytext=(-94,10),textcoords='offset points',fontsize=10,color=RUST)
        text(ax,42,563,'The activation supplies the nonlinearity; the weights and bias remain learnable.',14,GREEN,weight='bold')
        finish(fig,'1.2',cell,number,'The same neuron computation viewed through its ReLU response. Negative z gives zero; positive z gives a=z.','A weighted-sum equation feeds a ReLU graph. The graph is flat at zero for negative inputs and rises with slope one for positive inputs. Examples show z=-2 giving a=0 and z=2 giving a=2.')
        return
    fig,ax=canvas(number,'A neuron: weighted sum, then activation.', 'The nonlinearity changes what layers can represent.',660)
    for i in range(3):
        yy=242+i*111;ax.add_patch(Circle((115,yy),34,fc=SOFT,ec=GREEN,lw=1.5));text(ax,115,yy,f'x{i+1}',17,align='center');arrow(ax,152,yy,375,353);text(ax,242,yy+(-15 if i<2 else 12),f'w{i+1}',14,GREEN)
    box(ax,383,267,294,179,SOFT,GREEN);text(ax,530,314,'Weighted sum + bias',17,align='center',weight='bold');text(ax,530,382,'z = Σ wᵢxᵢ + b',20,align='center');arrow(ax,682,354,746,354)
    box(ax,755,267,233,179,LIME,GREEN);text(ax,871,314,'Activation',17,align='center',weight='bold');text(ax,871,382,'a = max(0, z)',17,align='center');arrow(ax,993,354,1142,354);text(ax,1071,328,'a',20,GREEN,align='center')
    text(ax,530,489,'Linear transformation',13,MUTED,align='center');text(ax,871,489,'ReLU in this example',13,MUTED,align='center')
    text(ax,42,563,'Remove the activation and a stack of linear layers is still a linear transformation.',15,GREEN,weight='bold')
    finish(fig,'1.2',cell,number,'Each input is multiplied by its weight, a bias is added, and an activation acts on the result. ReLU is the example shown.','Inputs x1, x2 and x3 are weighted and summed with a bias to form z. A ReLU box computes a=max(0,z), producing the neuron activation a.')


def small_network():
    n='1.2.3';fig,ax=canvas(n,'The smallest network that shows the mechanism.', 'Two inputs → two ReLU hidden activations → one sigmoid probability.',695)
    inputs=[(130,305),(130,473)];hidden=[(572,305),(572,473)];output=(977,389)
    for ii,a in enumerate(inputs):
        for jj,b in enumerate(hidden):
            arrow(ax,a[0]+42,a[1],b[0]-45,b[1])
    text(ax,351,241,'W₁: all four connections',13,GREEN,align='center')
    for i,p in enumerate(hidden):arrow(ax,p[0]+47,p[1],output[0]-51,output[1]);text(ax,760,p[1]+(35 if i==0 else -35),f'W₂[{i}, 0]',12,GREEN)
    for i,(x,y) in enumerate(inputs):ax.add_patch(Circle((x,y),42,fc=SOFT,ec=GREEN));text(ax,x,y,f'x{i+1}',20,align='center')
    for i,(x,y) in enumerate(hidden):ax.add_patch(Circle((x,y),46,fc=SOFT,ec=GREEN));text(ax,x,y,f'a{i+1}',20,align='center');text(ax,x,y+78,f'+ b₁[{i}]',12,MUTED,align='center')
    ax.add_patch(Circle(output,50,fc=LIME,ec=GREEN));text(ax,*output,'ŷ',23,align='center');text(ax,output[0],output[1]+86,'+ b₂[0]',12,MUTED,align='center')
    text(ax,42,604,'W₁: (2, 2)     b₁: (2,)     W₂: (2, 1)     b₂: (1,)     Total: 9 learned parameters',14,GREEN,weight='bold')
    finish(fig,'1.2',16,n,'The lesson’s two-hidden-unit network. Weight and bias indexing matches the NumPy arrays used by its forward pass.','Two input nodes connect fully to two ReLU hidden nodes, which connect to one sigmoid output. W1 has four weights, b1 two biases, W2 two weights and b2 one bias: nine parameters.')


def forward_shapes():
    n='1.2.4';fig,ax=canvas(n,'The batch dimension travels through the network.', 'Four examples are transformed together; each receives one predicted probability.',620)
    chain(ax,['X\n(4, 2)','Z₁\n(4, 2)','A₁\n(4, 2)','Z₂\n(4, 1)','A₂\n(4, 1)'],y=257,h=126,size=18)
    for x,label in [(235,'@ W₁ + b₁'),(477,'ReLU'),(716,'@ W₂ + b₂'),(956,'sigmoid')]:text(ax,x,223,label,11,GREEN,align='center')
    text(ax,42,470,'First axis = examples. Second axis = features or output units.',18,GREEN,weight='bold')
    text(ax,42,534,'Hidden width: 2. Output width: 1. Neither matrix multiplication mixes different examples.',12,MUTED)
    finish(fig,'1.2',42,n,'A four-row batch keeps its first dimension at each stage: input, hidden pre-activation, ReLU activation, output logit and probability.','The forward sequence is X shape (4,2), Z1 (4,2), A1 (4,2), Z2 (4,1), A2 (4,1). Weighted sums and activations change features, while four batch rows remain four.')


def graph(reverse=False):
    n='1.2.6' if reverse else '1.2.5';fig,ax=canvas(n,'Backward follows the graph with the chain rule.' if reverse else 'The forward pass is a computation graph.', 'Keep track of both the computed values and the operation that produced each one.',690)
    labels=['X','Linear 1','ReLU','Linear 2','sigmoid','BCE','Loss']
    chain(ax,labels,y=292,h=91,size=14)
    text(ax,276,244,'W₁, b₁',13,GREEN,align='center');arrow(ax,276,259,276,285)
    text(ax,605,244,'W₂, b₂',13,GREEN,align='center');arrow(ax,605,259,605,285)
    text(ax,935,244,'Targets y',13,GREEN,align='center');arrow(ax,935,259,935,285)
    if reverse:
        arrow(ax,1125,474,72,474,color=RUST,lw=3);text(ax,597,513,'Backward: multiply local derivatives; accumulate parameter gradients',15,RUST,align='center',weight='bold')
    else:
        arrow(ax,72,474,1125,474);text(ax,597,513,'Forward: compute values; remember the operations and their inputs',15,GREEN,align='center',weight='bold')
    text(ax,42,604,'The loss is one scalar. Each learned weight and bias receives its own derivative of that scalar.',12,MUTED)
    finish(fig,'1.2',70 if reverse else 67,n,'The same graph supports both directions. Forward computes predictions and loss; backward follows dependencies to compute gradients.','Inputs pass through two linear transformations separated by ReLU, then sigmoid, binary cross-entropy and scalar loss. Weights and biases enter the linear operations, targets enter the loss. '+('A reverse arrow shows the chain rule walking from loss back toward inputs.' if reverse else 'A forward arrow shows computation from input to loss.'))


def learning_rate():
    n='1.2.7';fig,ax=canvas(n,'The step size changes the route to the minimum.', 'Illustrative gradient descent on L(w) = w².',660)
    panels(ax,['Too small','A useful step','Too large'],h=389)
    for i,rate in enumerate([.04,.3,1.1]):
        limit=3.5 if i==2 else 2.6
        p=tinyplot(fig,[.065+i*.319,.235,.263,.36]);xx=np.linspace(-limit,limit,200);p.plot(xx,xx**2,color=LINE,lw=2)
        ws=[-1.6]
        for _ in range(4 if i==2 else 6):ws.append(ws[-1]-rate*2*ws[-1])
        ws=np.array(ws);p.plot(ws,ws**2,'o-',color=RUST if i==2 else GREEN,lw=1.8,markersize=4);p.set(xlim=(-limit,limit),ylim=(-.3,13 if i==2 else 6.8),xticks=[],yticks=[])
    text(ax,42,613,'Correct direction can still mean slow progress. An oversized update can increase the loss.',13,MUTED)
    finish(fig,'1.2',104,n,'Calculated descent paths on a simple quadratic: η=0.04, 0.3 and 1.1. This is a learning-rate illustration, not the network’s measured training run.','Three quadratic loss panels show tiny steps toward zero, effective steps converging to zero, and overshooting steps whose loss increases on alternating sides.')


def ranks():
    n='1.3.1';fig,ax=canvas(n,'A tensor adds axes, not mystery.', 'Rank counts axes. Shape tells you the size and meaning of each axis.',720)
    points=panels(ax,['Rank 0','Rank 1','Rank 2','Rank 3','Rank 4'],h=348)
    labels=[('()','one loss'),('(E,)','one embedding'),('(N, F)','tabular batch'),('(N, L, E)','token embeddings'),('(N, C, H, W)','image batch')]
    for i,(x,w) in enumerate(points):
        if i==0:box(ax,x+w/2-17,308,34,34,LIME,GREEN)
        elif i==1:matrix(ax,x+20,310,1,5,30)
        elif i==2:matrix(ax,x+42,280,4,4,28)
        else:
            for k in range(3 if i==3 else 5):matrix(ax,x+26+k*9,298-k*13,3,4,24,color=LIME if k==0 else SOFT)
        shape,desc=labels[i];text(ax,x+w/2,440,shape,13,GREEN,align='center',weight='bold');text(ax,x+w/2,488,desc,11,MUTED,align='center')
    text(ax,42,602,'N = batch  ·  F = features  ·  L = sequence length  ·  E = embedding size',13,GREEN,weight='bold')
    text(ax,42,645,'C = channels  ·  H = height  ·  W = width. The layouts shown are this course’s conventions.',12,MUTED)
    finish(fig,'1.3',11,n,'Scalar, vector, matrix, token-embedding batch and image batch. Axis conventions depend on the operation; these are the layouts used in this course.','Ranks zero through four are drawn as a scalar, row, matrix, stacked matrices and image batches. Shapes are (), (E,), (N,F), (N,L,E), and (N,C,H,W), with each symbol defined.')


def training_loop():
    n='1.3.2';fig,ax=canvas(n,'Six lines connect the whole training mechanism.', 'PyTorch carries out the same operations you traced in NumPy.',805)
    steps=[('model.train()','Use training behaviour for mode-sensitive layers'),('optimizer.zero_grad()','Clear accumulated parameter gradients'),('logits = model(X)','Compute the forward pass'),('loss = loss_fn(logits, y)','Measure the prediction error'),('loss.backward()','Compute gradients by the chain rule'),('optimizer.step()','Update weights using those gradients')]
    for i,(code,meaning) in enumerate(steps):
        y=189+i*81;box(ax,42,y,1116,66,LIME if i==4 else SOFT);text(ax,66,y+33,f'{i+1:02}',15,GREEN,weight='bold');text(ax,134,y+33,code,15,weight='bold');text(ax,593,y+33,meaning,12,MUTED)
    text(ax,42,725,'Repeat over batches and epochs. Evaluation changes mode and disables gradient recording.',13,GREEN,weight='bold')
    finish(fig,'1.3',80,n,'The canonical training loop links mode, gradient reset, forward pass, loss, backward pass and parameter update.','Six numbered rows pair PyTorch training calls with their purpose: train mode, zero gradients, forward logits, loss, backward gradients and optimizer update.')


def layouts():
    n='2.1.1';fig,ax=canvas(n,'Read the axes before you read the values.', 'Four common tensor layouts, with different meanings for the same position.',810)
    points=panels(ax,['Tabular rows','Images','Token IDs','Token embeddings'],h=500)
    for i,(x,w) in enumerate(points):
        if i==0:matrix(ax,x+41,295,5,6,28)
        elif i==1:
            for k in reversed(range(3)):matrix(ax,x+60+k*14,310-k*15,4,4,30,color=[LIME,SOFT,'#dbe5ed'][k])
        elif i==2:matrix(ax,x+28,327,3,7,28,values=np.arange(21).reshape(3,7))
        else:
            for k in reversed(range(3)):matrix(ax,x+47+k*14,304-k*16,4,5,27)
        text(ax,x+w/2,513,['(N, F)','(N, C, H, W)','(N, L)','(N, L, E)'][i],17,GREEN,align='center',weight='bold')
        for j,line in enumerate([['N examples','F features'],['N images','C channels; H × W grid'],['N sequences','L token IDs per sequence'],['N sequences, L tokens','E values per token']][i]):text(ax,x+17,579+j*40,line,11,MUTED)
    text(ax,42,749,'A batch of token IDs and a batch of token embeddings differ by an entire feature axis.',13,GREEN,weight='bold')
    finish(fig,'2.1',52,n,'Examples of the four tensor layouts used in this lesson. Drawn grids illustrate axes; token numbers are examples rather than a real vocabulary encoding.','Four panels label tabular (N,F), images (N,C,H,W), token IDs (N,L), and token embeddings (N,L,E), explaining what each axis holds.')


def broadcasting():
    n='2.1.2';fig,ax=canvas(n,'Broadcasting starts at the rightmost axis.', 'At each aligned axis, sizes must match or one must be 1.',745)
    examples=[('(8, 5)','(5,)','(8, 5)','Compatible','Missing axis behaves like 1.'),('(8, 5)','(8, 1)','(8, 5)','Compatible','The last 1 expands to 5.'),('(8, 5)','(8,)','Error','Incompatible','5 and 8 differ; neither is 1.'),('(6,)','(6, 1)','(6, 6)','Valid, but dangerous','Pairwise grid, not six losses.')]
    for (x,w),e in zip(panels(ax,[v[3] for v in examples],h=451),examples):
        a,b,out,_,why=e;text(ax,x+w/2,305,a,21,align='center');text(ax,x+w/2,361,b,21,align='center');ax.plot([x+20,x+w-20],[406,406],color=LINE);text(ax,x+w/2,453,out,21,RUST if out=='Error' or out=='(6, 6)' else GREEN,align='center',weight='bold')
        lines=why.split('; ') if ';' in why else [why]
        if len(why)>29:lines=why.split(', ')
        for j,line in enumerate(lines):text(ax,x+13,556+j*28,line,10,MUTED)
    text(ax,42,699,'No exception does not guarantee the intended shape. Print it before calculating a loss.',14,GREEN,weight='bold')
    finish(fig,'2.1',117,n,'Three dimension checks and a silent broadcasting trap. A (6,) vector and a (6,1) column produce a (6,6) grid.','Four shape examples show (8,5)+(5,) yields (8,5); (8,5)+(8,1) yields (8,5); (8,5)+(8,) is incompatible; and (6,)+(6,1) yields an unintended (6,6) grid.')


def batches():
    n='2.2.1';fig,ax=canvas(n,'Same number of epochs. Different update counts.', 'A full-batch epoch takes one step; a mini-batch epoch takes one step per batch.',660)
    for (x,w),count in zip(panels(ax,['Full batch','Mini-batches'],h=343),[20,2840]):
        text(ax,x+w/2,287,f'{count:,} updates',29,GREEN,align='center',weight='bold');text(ax,x+w/2,344,'20 epochs',17,align='center');text(ax,x+w/2,404,'1 batch per epoch' if count==20 else '142 batches per epoch',15,MUTED,align='center')
    text(ax,42,576,'Mini-batch gradients are noisier estimates. More updates does not by itself prove better learning.',13,GREEN,weight='bold')
    finish(fig,'2.2',36,n,'The update counts in the lesson’s example: 20 full-batch updates versus 2,840 mini-batch updates for 20 passes through the training data.','Two cards compare twenty epochs with one batch per epoch, giving twenty updates, against one hundred forty-two batches per epoch, giving two thousand eight hundred forty updates.')


def module_tree():
    n='2.3.1';fig,ax=canvas(n,'One model. A storage tree and a tensor flow.', 'state_dict names the modules; forward determines how tensors move.',850)
    panels(ax,['The module tree','The tensor flow'],h=548)
    rows=[('BankMLP',0),('blocks (ModuleList)',1),('0: DenseBlock',2),('linear: Linear(50, 64)',3),('act: ReLU',3),('1: DenseBlock',2),('linear: Linear(64, 32)',3),('act: ReLU',3),('head: Linear(32, 1)',1)]
    for i,(label,indent) in enumerate(rows):
        x=66+indent*23;y=258+i*45;text(ax,x,y,('└ ' if indent else '')+label,12,GREEN if indent==0 else INK,weight='bold' if indent<=1 else 'normal')
    for i,label in enumerate(['X (N, 50)','Linear → ReLU','Hidden (N, 64)','Linear → ReLU','Hidden (N, 32)','Head → logits (N, 1)']):
        yy=254+i*68;box(ax,643,yy,464,48,LIME if i==5 else SOFT,GREEN);text(ax,875,yy+24,label,14,align='center',weight='bold');
        if i<5:arrow(ax,875,yy+49,875,yy+65)
    text(ax,42,792,'The tree describes how parameters are registered. The forward method describes what actually runs.',13,GREEN,weight='bold')
    finish(fig,'2.3',44,n,'The lesson’s BankMLP stores two DenseBlocks and a head. The forward method applies them in order, carrying shapes (N,50) → (N,64) → (N,32) → (N,1).','Left, BankMLP has a ModuleList of two DenseBlocks and a linear head. Right, a batch of fifty features passes through widths sixty-four and thirty-two, then one output logit per example.')


def project():
    n='2.4.1';fig,ax=canvas(n,'Extract responsibilities, not just notebook cells.', 'The same model becomes importable, testable and runnable from a terminal.',775)
    labels=[('Load & encode data','src/data/dataset.py'),('Define the model','src/models/mlp.py'),('Train & checkpoint','src/training/train.py'),('Evaluate predictions','src/evaluation/metrics.py'),('Load & predict','src/inference/predict.py'),('Explore & plot','notebooks/')]
    for i,(label,path) in enumerate(labels):
        y=191+i*73;box(ax,42,y,369,54,SOFT);text(ax,63,y+27,label,14,weight='bold');arrow(ax,420,y+27,539,y+27);box(ax,550,y,608,54,LIME if i==5 else 'white');text(ax,572,y+27,path,14,GREEN)
    text(ax,42,687,'Also record configuration, dependencies and a README; test shapes and the full training path.',12,MUTED)
    finish(fig,'2.4',27,n,'Move reusable responsibilities into modules and leave exploration in notebooks. Configuration, tests and documentation complete the project.','Six notebook responsibilities map to dataset, model, training, evaluation and inference Python modules, plus a notebooks directory for exploration and plots.')


def noise():
    n='3.2.1';fig,ax=canvas(n,'A small improvement needs a scale for the noise.', 'One configuration, ten validation splits. Positions below are illustrative.',650)
    p=tinyplot(fig,[.08,.35,.84,.29]);vals=np.array([.762,.775,.779,.785,.791,.798,.805,.812,.819,.828]);mean=vals.mean();sd=vals.std(ddof=1)
    p.axvspan(mean-2*sd,mean+2*sd,color=SOFT);p.scatter(vals,np.zeros(10),s=47,c=GREEN);p.scatter([.795,.801],[.25,.25],s=90,c=[BLUE,RUST],marker='D');p.text(.795,.35,'A',ha='center',color=BLUE);p.text(.801,.35,'B',ha='center',color=RUST);p.set(xlim=(.74,.85),ylim=(-.22,.58),yticks=[],xlabel='validation AUC');p.spines['left'].set_visible(False)
    text(ax,42,527,'The shaded ±2 SD band is a descriptive yardstick, not a universal significance test.',13,GREEN,weight='bold')
    text(ax,42,584,'Repeat the experiment. Compare paired results when the models share the same evaluation rows.',12,MUTED)
    finish(fig,'3.2',56,n,'A schematic noise floor: close configuration scores can be small relative to split-to-split variation. No measured scores are substituted by these example points.','Ten illustrative split scores lie along a validation-AUC number line inside a shaded plus-or-minus two-standard-deviation band. Configuration A and B differ by a small amount within that variation.',True)


def gradient():
    n='3.3.1';fig,ax=canvas(n,'A falling loss can hide a weak early-layer signal.', 'Backpropagation multiplies local derivatives through the network.',920)
    for i,label in enumerate(['Sigmoid stack','ReLU stack']):
        x=145+i*552;text(ax,x,187,label,19,weight='bold')
        for j in range(12):
            y=226+j*45;box(ax,x,y,270,29,SOFT if i or j<8 else '#e1e5df',LINE);text(ax,x+135,y+14,f'layer {12-j:02}',11,align='center');
            if j<11:arrow(ax,x+340,y+18,x+340,y+54,lw=(3.0-(j*.25) if i==0 else 3-.1*j),color=GREEN)
        text(ax,x,796,'Early gradients can be tiny.' if i==0 else 'Active ReLU has derivative 1.',12,MUTED)
    text(ax,42,862,'Arrow widths illustrate attenuation. Read the measured log-scale gradient profiles for actual magnitudes.',12,GREEN)
    finish(fig,'3.3',13,n,'Schematic backward signal through twelve layers. Sigmoid can strongly attenuate gradients; active ReLU avoids attenuation by the activation itself but does not guarantee healthy flow.','Two stacks of twelve layers run from output at the top to input at the bottom. Descending gradient arrows thin sharply for sigmoid and more gently for ReLU. The drawing is conceptual, not a quantitative gradient scale.',True)


def curve_card():
    n='3.4.1';fig,ax=canvas(n,'Read the curve. Then check the metric.', 'A diagnosis starts with a pattern; it is confirmed with other evidence.',955)
    labels=['Healthy','Overfit','Undertrained','Collapsed','Unstable','Suspicious'];e=np.linspace(0,1,100)
    curves=[(.2+.5*np.exp(-e*6),.25+.45*np.exp(-e*6)),(.2+.5*np.exp(-e*6),.3+.35*np.exp(-e*4)+.3*e**2),(.65-.18*e,.67-.17*e),(e*0+.69,e*0+.69),(.5+.17*np.sin(e*44),.58+.18*np.sin(e*44+.4)),(.03+.5*np.exp(-e*10),.03+.5*np.exp(-e*10))]
    for i,label in enumerate(labels):
        r,c=divmod(i,3);x=42+c*377;y=181+r*310;box(ax,x,y,362,289);text(ax,x+18,y+31,f'{chr(65+i)}  {label}',17,GREEN,weight='bold')
        p=tinyplot(fig,[x/1200+.026,1-(y+236)/955,.25,.17]);p.plot(e,curves[i][0],color=GREEN,lw=2,label='train');p.plot(e,curves[i][1],color=RUST,lw=2,ls='--',label='validation');p.set(xticks=[],yticks=[],ylim=(0,.9))
    text(ax,42,864,'A flat loss is not automatically a useful model. A near-perfect metric is not automatically a valid test.',13,GREEN,weight='bold')
    text(ax,42,911,'Schematic shapes. Inspect predictions, gradients, data splits and feature availability before assigning a cause.',12,MUTED)
    finish(fig,'3.4',4,n,'Six illustrative signatures support the diagnosis gallery. Training is solid green; validation is dashed rust. Shapes suggest questions, not a definitive cause.','A six-panel reference card shows healthy convergence, overfitting, slow undertraining, flat collapse, instability and suspiciously perfect results. Each uses solid training and dashed validation curves.',True)


def leakage():
    n='3.4.2';fig,ax=canvas(n,'When does this value exist?', 'Prediction time is a boundary for every input feature.',710)
    arrow(ax,71,404,1129,404);ax.plot([648,648],[198,604],color=RUST,lw=2,ls='--')
    text(ax,648,642,'Prediction made',17,RUST,align='center',weight='bold');text(ax,183,454,'Before the call',15,GREEN,align='center');text(ax,1006,454,'After the call',15,MUTED,align='center')
    for i,label in enumerate(['age','job','balance','housing']):box(ax,74+i*128,267,116,61,SOFT,GREEN);text(ax,132+i*128,297,label,13,align='center')
    box(ax,872,267,213,61,'#f4e5de',RUST);text(ax,978,297,'duration',17,RUST,align='center',weight='bold');arrow(ax,977,254,400,254,color=RUST,connectionstyle='arc3,rad=.28');text(ax,1045,538,'Unavailable when\nchoosing who to call',12,RUST,align='center',linespacing=1.7)
    text(ax,42,677,'Cross-validation cannot make a feature available earlier than the event that creates it.',13,GREEN,weight='bold')
    finish(fig,'3.4',41,n,'Call duration is predictive in a historical table but unavailable when deciding who to call. The violation is about feature availability at prediction time.','A timeline places age, job, balance and housing before the prediction boundary. Call duration appears after the call, yet a rust arrow carries it backward across the boundary as an invalid input.',True)


def split_simulation():
    n='4.1.1';fig,ax=canvas(n,'A split is a simulation of future use.', 'Choose evaluation rows that stand in for the examples you will actually predict.',685)
    panels(ax,['What you split','What the test set stands in for'],h=365)
    for x,width,col,label in [(67,278,SOFT,'Train 60%'),(345,93,LIME,'Val'),(438,92,'#dbe5ed','Test')]:box(ax,x,303,width,89,col,GREEN);text(ax,x+width/2,348,label,13,align='center',weight='bold')
    text(ax,66,439,'This lesson’s introductory split.',12,MUTED)
    arrow(ax,658,348,1116,348);ax.plot([866,866],[266,452],color=RUST,ls='--',lw=1.5);text(ax,766,303,'Past training rows',12,GREEN,align='center');text(ax,999,392,'Future examples',12,BLUE,align='center');text(ax,866,477,'Deployment',12,RUST,align='center')
    text(ax,42,604,'Random and chronological splits can estimate different things. The question determines the split.',13,GREEN,weight='bold')
    finish(fig,'4.1',10,n,'A 60/20/20 split is an introductory example. The crucial question is whether the held-out rows realistically represent deployment conditions.','A sixty-percent train, twenty-percent validation and twenty-percent test strip is compared with a timeline of past training data, a deployment boundary and future examples.',True)


def clock():
    n='4.1.2';fig,ax=canvas(n,'The row order carries a clock.', 'The file has no year column; the lesson infers three periods from month resets.',675)
    counts=[27729,14862,2620];rates=['≈ 5% yes','≈ 17% yes','≈ 52% yes'];years=['2008','2009','2010'];x=42
    for count,year,rate,col in zip(counts,years,rates,[SOFT,'#c9dbbc',LIME]):
        width=1116*count/sum(counts);box(ax,x,269,width,94,col,GREEN);text(ax,x+width/2,316,year,15,align='center',weight='bold');x+=width
    for i,(year,count,rate) in enumerate(zip(years,counts,rates)):
        xx=42+i*377;box(ax,xx,415,362,147,'white');text(ax,xx+18,445,year,19,GREEN,weight='bold');text(ax,xx+18,487,f'{count:,} rows',16);text(ax,xx+18,531,rate,16,GREEN)
    text(ax,42,610,'Two December → January transitions. A short later period has a much higher positive rate.',13,GREEN,weight='bold')
    finish(fig,'4.1',69,n,'Year-sized segments are proportional to the row counts reported in the lesson. The percentages are its rounded rates, not predictions.','A proportional ribbon shows 27,729 rows for 2008, 14,862 for 2009 and 2,620 for 2010. Cards report approximately five, seventeen and fifty-two percent positive outcomes.',True)


def split_questions():
    n='4.1.3';fig,ax=canvas(n,'Same model. Two different questions.', 'Keep model and preprocessing fixed; change which examples play the future.',740)
    for (x,w),title,desc in zip(panels(ax,['Random stratified split','Chronological split'],h=431),['A random historical customer','A future campaign'],['Years are mixed across splits.','Train on earlier rows; test on later rows.']):
        text(ax,x+20,292,title,17,GREEN,weight='bold');text(ax,x+20,340,desc,12,MUTED)
        for j in range(15):
            col=[SOFT,LIME,'#dbe5ed'][j%3] if x==42 else SOFT if j<12 else LIME if j==12 else '#dbe5ed';box(ax,x+23+j*32,399,29,75,col,GREEN)
        text(ax,x+20,527,'“How well on the old population?”' if x==42 else '“How well after time has moved?”',14,weight='bold')
    text(ax,42,676,'Use the reported scores with the question they measured. The splits are not interchangeable.',13,GREEN,weight='bold')
    finish(fig,'4.1',74,n,'Stratification mixes time periods; a chronological split preserves them. Both can be valid, but they answer different deployment questions.','Two panels contrast a random mixture of historical rows across train, validation and test with earlier training rows followed by later validation and test rows.',True)


def reproducibility():
    n='4.2.1';fig,ax=canvas(n,'Reproducibility has three different tests.', 'An identical number, an explainable difference, and a stable conclusion are distinct goals.',715)
    labels=['Repeatable','Portable','Robust'];details=[('Same code, data, machine','0.7871 = 0.7871','Identical in the same environment'),('Different machine or versions','0.7871 ≈ 0.7869','Record enough to explain differences'),('Different seeds or splits','Does the conclusion survive?','Report the variation, not one score')]
    for (x,w),(a,b,c) in zip(panels(ax,labels,h=406),details):
        text(ax,x+18,287,a,12,MUTED);text(ax,x+w/2,374,b,19 if x<790 else 13,GREEN,align='center',weight='bold');text(ax,x+18,498,c,11,MUTED)
    text(ax,42,654,'The two numeric pairs are illustrations of the definitions, not new experimental measurements.',12,MUTED)
    finish(fig,'4.2',4,n,'Repeatability, portability and robustness ask different questions. The numeric pairs illustrate definitions; actual noise estimates appear in the lesson’s experiments.','Three panels distinguish same-environment identical results, close and explainable results across environments, and conclusions that survive changes to seeds or splits.',True)


def checkpoint():
    n='4.2.2';fig,ax=canvas(n,'A resumable checkpoint carries the run state.', 'Restoring weights is sufficient for inference; resuming training needs more.',810)
    panels(ax,['Checkpoint for resuming training','Weights for inference'],h=493)
    rows=['Model parameters','Optimizer state','Row-order generator','Global random generators','Epoch, history & best-so-far']
    for i,label in enumerate(rows):box(ax,69,259+i*66,480,51,SOFT,GREEN);text(ax,89,284+i*66,label,14,weight='bold')
    box(ax,647,259,480,51,LIME,GREEN);text(ax,667,284,'Model parameters',14,weight='bold');text(ax,648,387,'The file loads successfully.',16,GREEN,weight='bold');text(ax,648,442,'It does not restore optimizer averages,\nrandom streams or training history.',14,MUTED,linespacing=1.7)
    text(ax,42,744,'A successful load is not proof that a resumed run follows the uninterrupted trajectory.',13,GREEN,weight='bold')
    finish(fig,'4.2',51,n,'The state categories used by the lesson’s checkpoint. Matching software, hardware and deterministic operations also matter for repeatable continuation.','A full checkpoint contains model parameters, optimizer state, row-order and global random generators, and epoch/history/best state. A weights-only file holds only model parameters.',True)


def memory():
    n='4.3.1';fig,ax=canvas(n,'Count the tensors before booking the GPU.', '7 billion parameters. Static memory only: no activations, workspace or overhead.',910)
    p=tinyplot(fig,[.105,.17,.70,.53]);units=7e9*4/(1024**3);counts=[.5,1,2,4];labels=['Inference\nfp16','Inference\nfp32','Training fp32\nSGD, no momentum','Training fp32\nAdamW']
    for i,count in enumerate(counts):
        parts=[units*.5] if count==.5 else [units]*int(count)
        bottom=0
        for j,value in enumerate(parts):
            p.bar(i,value,bottom=bottom,color=[GREEN,BLUE,'#526b41',RUST][j],width=.61,edgecolor='white');p.text(i,bottom+value/2,f'{value:.1f}',ha='center',va='center',fontsize=12,color='white');bottom+=value
        p.text(i,bottom+3,f'{bottom:.1f} GiB',ha='center',fontsize=10,color=GREEN,weight='bold')
    for val,label in [(15,'~15 GiB'),(24,'24 GiB'),(80,'80 GiB')]:p.axhline(val,color=LINE,lw=1,ls='--');p.text(3.48,val+1,label,fontsize=10,color=MUTED)
    p.set(xticks=range(4),xticklabels=labels,ylabel='GiB',ylim=(0,117),xlim=(-.6,4.4))
    for j,label in enumerate(['Weights','Gradients','First moment','Second moment']):box(ax,990,213+j*71,25,25,[GREEN,BLUE,'#526b41',RUST][j]);text(ax,1028,225+j*71,label,11)
    text(ax,42,806,'AdamW fp32 static training state ≈ 4 × fp32 inference weights. Compared with fp16 inference, it is ≈ 8 ×.',12,GREEN,weight='bold')
    text(ax,42,855,'Actual peak memory also depends on activations, implementation and hardware. Reference capacities are illustrative.',11,MUTED)
    finish(fig,'4.3',14,n,'Memory is computed using 2³⁰ bytes per GiB, as in the notebook. Counts omit activations and other overhead; the four-times comparison uses the same fp32 weight precision.','A calculated stacked bar chart compares 7B-parameter static memory: fp16 inference 13.0 GiB, fp32 inference 26.1, fp32 SGD training 52.2, and fp32 AdamW training 104.3. Components are weights, gradients and two optimizer moments.',True)


def oom():
    n='4.3.2';fig,ax=canvas(n,'Work down the out-of-memory playbook.', 'Start with retained state and evaluation habits; change capacity after cheaper fixes.',850)
    rows=[('Tier 0 / free','Restart; release retained graphs; use no_grad; delete unused tensors.',SOFT),('Tier 1 / change the run','Smaller batches + accumulation; mixed precision; shorter sequences.',LIME),('Tier 2 / change computation','Checkpoint activations; freeze parameters; quantise frozen weights.', '#dbe5ed')]
    for i,(label,desc,col) in enumerate(rows):
        yy=191+i*164;box(ax,96,yy,1062,140,col,GREEN);text(ax,119,yy+39,label,19,GREEN,weight='bold');text(ax,119,yy+94,desc,13)
    arrow(ax,62,202,62,708,lw=3);text(ax,96,737,'Then consider a smaller model or more hardware.',16,GREEN,weight='bold');text(ax,96,793,'Savings depend on the cause. The order expresses troubleshooting cost, not guaranteed memory savings.',11,MUTED)
    finish(fig,'4.3',45,n,'The lesson’s troubleshooting order: eliminate needless retained state, change the run, then change computation or capacity. Savings are workload-dependent.','Three descending tiers list free cleanup and no-grad checks; smaller batches, accumulation, mixed precision and sequence length; then activation checkpointing, freezing and quantisation. Model size and hardware come last.',True)


def pairing():
    n='4.4.1';fig,ax=canvas(n,'Pairing removes the split difficulty both models share.', 'The ten split results reported in this notebook, rounded to four decimals.',790)
    nn=np.array([.7776,.8098,.7850,.7795,.7906,.7952,.8144,.8034,.8101,.7904]);gb=np.array([.7903,.8174,.7923,.7936,.7983,.7969,.8164,.8169,.8127,.7993]);dif=gb-nn
    p=tinyplot(fig,[.08,.25,.40,.43]);p.plot(range(10),nn,'o-',color=BLUE,label='network');p.plot(range(10),gb,'s--',color=RUST,label='boosting');p.set(xlabel='shared split seed',ylabel='test AUC',xticks=range(10));p.legend(frameon=False,fontsize=11)
    q=tinyplot(fig,[.59,.25,.33,.43]);q.bar(range(10),dif,color=GREEN);q.axhline(0,color=LINE);q.set(xlabel='shared split seed',ylabel='boosting − network',xticks=range(10),ylim=(-.001,.016))
    text(ax,42,665,'Separate spreads: 0.0132 and 0.0111  /  Paired difference: mean +0.0078, SD 0.0047',13,GREEN,weight='bold')
    text(ax,42,727,'Boosting is ahead on 10 of 10 splits. A small effect can be consistent when measured on the same rows.',12,MUTED)
    finish(fig,'4.4',23,n,'Recorded split results show common movement and a consistently positive paired difference. The points use the table’s four-decimal values.','Two measured-data panels show network and boosting AUC moving together over ten shared splits, then boosting-minus-network differences. Every difference is positive, with reported mean 0.0078 and standard deviation 0.0047.',True)


def reversal():
    n='4.4.2';fig,ax=canvas(n,'The ranking changes when the question changes.', 'Keep the score attached to the population it measured.',795)
    p=tinyplot(fig,[.20,.25,.59,.48]);p.plot([0,1],[.7956,.6141],'o-',color=BLUE,lw=3,markersize=8,label='neural network');p.plot([0,1],[.8034,.5841],'s--',color=RUST,lw=3,markersize=8,label='gradient boosting');p.set(xlim=(-.25,1.25),ylim=(.55,.85),xticks=[0,1],xticklabels=['Random historical customer','Later chronological campaign'],ylabel='test AUC');p.legend(frameon=False,loc='lower left',fontsize=11)
    for x,y,label,col in [(0,.8034,'0.8034',RUST),(0,.7956,'0.7956',BLUE),(1,.6141,'0.6141',BLUE),(1,.5841,'0.5841',RUST)]:p.annotate(label,(x,y),xytext=(-66 if x==0 else 14,13 if y in [.8034,.6141] else -18),textcoords='offset points',fontsize=11,color=col,weight='bold')
    text(ax,42,681,'On the later period both models lose much of their discriminative performance.',14,GREEN,weight='bold');text(ax,42,734,'A reversed ranking does not make either model ready to deploy. Calibration and shift still need attention.',12,MUTED)
    finish(fig,'4.4',34,n,'The reported AUC ranking reverses between random and chronological splits: boosting 0.8034 vs network 0.7956, then boosting 0.5841 vs network 0.6141.','A two-model slope chart shows both AUCs falling from historical random splits to later chronological rows. Boosting starts above the network at 0.8034 versus 0.7956 but ends below at 0.5841 versus 0.6141.',True)


def embed():
    for lid in sorted({r['lesson'] for r in ITEMS}):
        path=ROOT/f'notes/module-{lid[0]}/lesson-{lid}.ipynb';nb=json.loads(path.read_text())
        for row in [r for r in ITEMS if r['lesson']==lid]:
            cell=nb['cells'][row['cell']];data=art.FIGURES[row['number']];name='figure-'+row['number']+'.png'
            block=art.attachment_block(row['number'],row['caption'],row['alt'])
            src=''.join(cell['source'])
            if row['prompt']:
                if cell.get('metadata',{}).get('dlp_figure')==row['number']:src=re.sub(r'<div align="center">.*?</div>',lambda m:block,src,count=1,flags=re.S)
                else:
                    pattern=r'^>[^\n]*🖼[^\n]*(?:\n[ \t]*>[^\n]*)*'
                    src,count=re.subn(pattern,lambda m:block,src,count=1,flags=re.M)
                    if count!=1:raise ValueError(f'Missing prompt: {lid} cell {row["cell"]}')
            else:
                src=block
                if row['cell'] and re.fullmatch(r'\s*>\s*\*\*\s*🖼.*', ''.join(nb['cells'][row['cell']-1]['source']).strip(),re.S):
                    prev=nb['cells'][row['cell']-1];prev['source']=[];prev.setdefault('metadata',{})['dlp_figure_label']=row['number']
            cell['source']=src.splitlines(keepends=True);cell['attachments']={name:{'image/png':data['png']}};cell.setdefault('metadata',{})['dlp_figure']=row['number']
        path.write_text(json.dumps(nb,ensure_ascii=False,indent=1)+'\n')
        print(lid, 'diagrams:',sum(r['lesson']==lid for r in ITEMS))
    (OUT/'figures.json').write_text(json.dumps(ITEMS,ensure_ascii=False,indent=2)+'\n')


if __name__=='__main__':
    OUT.mkdir(parents=True,exist_ok=True)
    for draw in [course_path,pipelines,ruler_coil,learned_features,hand_design]:draw()
    neuron(11,'1.2.1');neuron(12,'1.2.2',True)
    for draw in [small_network,forward_shapes,graph,lambda:graph(True),learning_rate,ranks,training_loop,layouts,broadcasting,batches,module_tree,project,noise,gradient,curve_card,leakage,split_simulation,clock,split_questions,reproducibility,checkpoint,memory,oom,pairing,reversal]:draw()
    embed()
