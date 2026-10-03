"""Rebuild Module 5 teaching diagrams and embed PNGs in the lesson notebooks.

Run with Python + matplotlib + Pillow (only needed to regenerate, not to build).
SVG originals retain editable text; notebook attachments travel with downloads.
Existing code cells, outputs, metadata and non-figure prose are preserved.
"""
from pathlib import Path
import base64
import html
import io
import json
import re
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle, Circle, Ellipse, Polygon, FancyArrowPatch, Arc
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'static/img/module-5'
INK, GREEN, SOFT, LIME = '#202d28', '#234c3c', '#eef1e8', '#ddeaab'
BLUE, RUST, LINE, MUTED = '#356784', '#a04e32', '#bfcac0', '#52645a'
plt.rcParams.update({'font.family': 'DejaVu Sans', 'svg.fonttype': 'none', 'svg.hashsalt': 'dlp-module5'})
FIGURES = {}


def canvas(number, title, subtitle, height=650):
    fig = plt.figure(figsize=(12, height / 100), facecolor='#f7f7f2')
    ax = fig.add_axes([0, 0, 1, 1]); ax.set(xlim=(0, 1200), ylim=(height, 0)); ax.axis('off')
    text(ax, 42, 37, 'DEEP LEARNING LAB  /  FIGURE ' + number, 10, MUTED, weight='bold')
    text(ax, 42, 79, title, 24, GREEN, weight='bold')
    text(ax, 42, 113, subtitle, 12, MUTED)
    ax.plot([42, 1158], [136, 136], color=LINE, lw=1)
    return fig, ax


def text(ax, x, y, value, size=15, color=INK, align='left', weight='normal', **kw):
    return ax.text(x, y, value, fontsize=size, color=color, ha=align, va='center', weight=weight, **kw)


def box(ax, x, y, w, h, fill='white', edge=LINE, lw=1.2):
    ax.add_patch(Rectangle((x, y), w, h, fc=fill, ec=edge, lw=lw))


def arrow(ax, x, y, xx, yy, color=GREEN, style='-|>', lw=2, **kw):
    ax.add_patch(FancyArrowPatch((x, y), (xx, yy), arrowstyle=style, mutation_scale=16,
                                color=color, linewidth=lw, **kw))


def leaf(ax, x, y, scale=1, spots=False):
    ax.add_patch(Ellipse((x, y), 70*scale, 110*scale, angle=35, fc='#8bb272', ec=GREEN, lw=1.5))
    ax.plot([x-28*scale, x+28*scale], [y+44*scale, y-44*scale], color=GREEN, lw=2)
    for a in [-1, 0, 1]:
        ax.plot([x+a*15*scale, x+(a*15+24)*scale], [y-a*23*scale, y-(a*23-5)*scale], color=GREEN, lw=1)
    if spots:
        for dx,dy,r in [(-13,4,8),(12,-24,6),(17,20,9)]:
            ax.add_patch(Circle((x+dx*scale,y+dy*scale),r*scale,fc=RUST,ec='none'))


def picture(ax, x, y, w, h, data):
    ax.imshow(data, extent=(x,x+w,y+h,y), aspect='auto', zorder=2)


def notebook(lid):
    folder = ROOT / 'notes/module-5'
    candidates = list(folder.glob('lesson-' + lid + '.ipynb')) or list(folder.glob('Day5_Note' + lid + '_*.ipynb'))
    if len(candidates) != 1:
        raise ValueError(f'Expected one notebook for {lid}, got {candidates}')
    return candidates[0], json.loads(candidates[0].read_text())


def existing_photo(lid, cell, crop):
    _, nb = notebook(lid)
    raw = next(o['data']['image/png'] for o in nb['cells'][cell]['outputs'] if 'image/png' in o.get('data', {}))
    return Image.open(io.BytesIO(base64.b64decode(raw))).convert('RGB').crop(crop)


def save(fig, number, caption, alt):
    name = 'figure-' + number
    svg = OUT / (name + '.svg')
    fig.savefig(svg, metadata={'Date': None, 'Description': alt})
    svg.write_text(re.sub(r'[ \t]+\n', '\n', svg.read_text()))
    buf = io.BytesIO(); fig.savefig(buf, format='png', dpi=160, metadata={'Description': alt})
    plt.close(fig)
    FIGURES[number] = {'caption': caption, 'alt': alt, 'png': base64.b64encode(buf.getvalue()).decode()}


def attachment_block(number, caption, alt):
    """Use Markdown attachment syntax so Jupyter and nbconvert resolve images.

    The HTML wrapper lets the site extract the caption; the image itself must be
    Markdown because nbconvert does not resolve attachment URLs in raw HTML img tags.
    """
    # Entities protect literal vector brackets from the site's LaTeX \[...\] pass.
    alt = html.escape(alt, quote=True).replace('[', '&#91;').replace(']', '&#93;').replace('\\', '&#92;')
    return (f'<div align="center">\n\n![{alt}](attachment:figure-{number}.png)\n\n'
            f'<p><b>Figure {number}.</b> {html.escape(caption)}</p>\n\n</div>')


def pipeline():
    number='5.1.1'; fig,ax=canvas(number,'One image. Many possible representations.', 'An encoder decides which information the downstream task can use.', 610)
    for i,(label,sub) in enumerate([('Raw input','Pixels from a field photo'),('Encoder','Rules or learned weights'),('Representation','One vector per image'),('Task','Predict a disease label')]):
        x=42+i*285; box(ax,x,180,260,320);text(ax,x+18,213,label,18,weight='bold');text(ax,x+18,474,sub,11,MUTED)
        if i<3:arrow(ax,x+262,334,x+281,334)
    picture(ax,66,247,205,205,existing_photo('5.1',27,(10,32,318,340)))
    for j in range(3):
        box(ax,358+j*24,265+j*25,146,135,SOFT,GREEN)
    text(ax,469,399,'f(x)',19,GREEN,align='center',weight='bold')
    for j,(v,c) in enumerate([('0.12',SOFT),('−0.80','#d9e3d7'),('1.43',LIME),('…',SOFT)]):
        box(ax,677,252+j*45,134,43,c);text(ax,744,274+j*45,v,18,align='center')
    for j,(lab,c) in enumerate([('angular leaf spot','white'),('bean rust',LIME),('healthy','white')]):
        box(ax,915,262+j*57,217,45,c,GREEN if j==1 else LINE)
        text(ax,1023,284+j*57,lab,13,align='center',weight='bold' if j==1 else 'normal')
    text(ax,42,550,'The same photo can become 3,072 raw-pixel values, 7 hand-made features or 512 learned features.',12,MUTED)
    save(fig,number,'Raw input → encoder → representation → task. A real Beans photo illustrates the input; the vector and prediction are schematic.', 'A bean-rust field photo passes through an encoder to a numerical vector, then a disease classifier. The example output selects bean rust.')


def convolution():
    number='5.1.2';fig,ax=canvas(number,'Nine products become one feature.', 'One Sobel filter, reused across every 3 × 3 patch. Stride 1; no padding.',700)
    inp=np.tile([0,0,0,1,1,1,1],(7,1));kernel=np.array([[-1,0,1],[-2,0,2],[-1,0,1]])
    out=np.array([(inp[r:r+3,c:c+3]*kernel).sum() for r in range(5) for c in range(5)]).reshape(5,5)
    for x,label in [(42,'Input pixels'),(466,'Filter weights'),(840,'Feature map')]:text(ax,x,185,label,18,weight='bold')
    for r in range(7):
        for c in range(7):
            v=inp[r,c];box(ax,42+c*43,219+r*43,43,43,SOFT if v==0 else 'white');text(ax,63+c*43,241+r*43,str(v),14,align='center')
    box(ax,42+2*43,219+2*43,129,129,'none',RUST,3)
    for r in range(3):
        for c in range(3):
            box(ax,466+c*63,285+r*63,63,63,SOFT,GREEN);text(ax,497+c*63,316+r*63,str(kernel[r,c]).replace('-','−'),18,align='center')
    arrow(ax,364,361,445,361);arrow(ax,678,361,813,361)
    for r in range(5):
        for c in range(5):
            v=out[r,c];box(ax,840+c*57,238+r*57,57,57,LIME if v else 'white');text(ax,868+c*57,266+r*57,str(v),16,align='center')
    box(ax,840+2*57,238+2*57,57,57,'none',RUST,3)
    text(ax,466,511,'Same weights at every position',12,MUTED)
    box(ax,42,561,1116,97,SOFT)
    text(ax,65,591,'Highlighted patch:  (−1×0 + 0×1 + 1×1) + (−2×0 + 0×1 + 2×1) + (−1×0 + 0×1 + 1×1) = 4',12,weight='bold')
    text(ax,65,628,'A vertical dark-to-light edge gives a strong response. Move the filter one cell to compute the next value.',12,MUTED)
    save(fig,number,'A 7 × 7 input and a 3 × 3 Sobel kernel produce a 5 × 5 feature map. The outlined output is exactly 4.', 'A seven by seven binary image changes from zero to one at a vertical edge. The Sobel kernel [-1,0,1; -2,0,2; -1,0,1] yields repeated output rows [0,4,4,0,0]. The highlighted patch and output correspond.')


def hierarchy():
    number='5.1.3';fig,ax=canvas(number,'Features combine into richer features.', 'A conceptual hierarchy, not a recording of this notebook’s ResNet activations.',630)
    for i,(label,sub) in enumerate([('Edges & colour','Local contrasts'),('Textures','Repeated patterns'),('Parts','Veins, spots and outlines'),('Object patterns','Combinations over a wider area')]):
        x=42+i*285;box(ax,x,187,260,300);text(ax,x+16,219,label,17,weight='bold')
        for j in range(2):box(ax,x+23+j*115,254,98,169,SOFT)
        if i==0:
            for k in range(3):ax.plot([x+40,x+90],[285+k*40,265+k*40],color=GREEN,lw=5)
            for yy,col in [(281,GREEN),(330,LIME),(379,RUST)]:ax.add_patch(Circle((x+186,yy),18,fc=col))
        elif i==1:
            for k in range(5):ax.plot([x+39,x+104],[275+k*28,275+k*28],color=GREEN,lw=3)
            for a in range(3):
                for b in range(4):ax.add_patch(Circle((x+157+a*23,278+b*37),6,fc=RUST))
        elif i==2:
            ax.plot([x+48,x+105],[395,273],color=GREEN,lw=3)
            for k in range(4):ax.plot([x+57+k*10,x+87+k*8],[379-k*24,383-k*27],color=GREEN,lw=2)
            ax.add_patch(Circle((x+186,336),32,fc='#a9b99a',ec=GREEN,lw=2));ax.add_patch(Circle((x+186,336),18,fc=RUST))
        else:
            leaf(ax,x+72,339,.68);leaf(ax,x+184,339,.68,True)
        text(ax,x+16,456,sub,10,MUTED)
        if i<3:arrow(ax,x+262,335,x+282,335)
    arrow(ax,64,538,1138,538);text(ax,602,580,'Local evidence → larger receptive fields → useful image representation',15,GREEN,align='center',weight='bold')
    save(fig,number,'Early layers detect local patterns; deeper layers combine evidence over wider receptive fields. These are illustrative motifs, not literal feature maps.', 'Four panels progress from edges and colour, to stripes and dots, to leaf veins and spots, to combined healthy and rusty leaf patterns. Real learned features need not align with a single named concept.')


def roadmap():
    number='5.1.4';fig,ax=canvas(number,'Five ideas that changed the encoder.', 'A conceptual path: these approaches still coexist.',630)
    labels=[('Hand-made','features','A person writes','the measurements.'),('CNNs','','Learn local filters;','share their weights.'),('Transfer','learning','Reuse features from','another training task.'),('Vision','Transformers','Compare patches','with attention.'),('Multimodal','models','Align images and text','in one vector space.')]
    for i,(a,b,c,d) in enumerate(labels):
        x=42+i*225;box(ax,x,185,212,320);text(ax,x+15,218,a,17,weight='bold');text(ax,x+15,247,b,17,weight='bold')
        cx=x+106
        if i==0:
            box(ax,cx-52,293,104,25,LIME,GREEN)
            for k in range(7):ax.plot([cx-40+k*13,cx-40+k*13],[293,305],color=GREEN,lw=1)
            ax.plot([cx-40,cx+40],[367,332],color=RUST,lw=6)
        elif i==1:
            for r in range(3):
                for cc in range(3):box(ax,cx-48+cc*32,291+r*32,32,32,SOFT,GREEN)
        elif i==2:
            box(ax,cx-64,299,58,73,SOFT,GREEN);arrow(ax,cx-1,335,cx+22,335)
            for k in range(3):box(ax,cx+28,293+k*32,47,23,LIME,GREEN)
        elif i==3:
            for r in range(4):
                for cc in range(4):box(ax,cx-48+cc*24,291+r*24,24,24,LIME if r==cc else SOFT,GREEN)
        else:
            leaf(ax,cx-37,332,.5);box(ax,cx+9,301,61,52,SOFT,GREEN);text(ax,cx+39,328,'text',10,align='center');arrow(ax,cx-26,376,cx-3,397);arrow(ax,cx+34,362,cx+3,397);ax.add_patch(Ellipse((cx,409),76,23,fc=LIME,ec=GREEN))
        text(ax,x+15,449,c,10,MUTED);text(ax,x+15,473,d,10,MUTED)
        if i<4:arrow(ax,x+214,341,x+223,341,lw=1.5)
    text(ax,42,553,'Lesson 5.1: features & CNNs     /     Module 6: attention     /     Lesson 5.4: CLIP',13,GREEN)
    save(fig,number,'From hand-written measurements to learned and shared representations. The sequence is a learning roadmap, not a claim that newer models replace every older one.', 'Five connected milestones show hand-made feature rules, learned CNN filters, pretrained features reused across tasks, image patches with attention, and images plus text embedded into a shared space.')


def recurrence():
    number='5.2.1';fig,ax=canvas(number,'A chain of summaries or direct connections?', 'The same four words, processed by two different mechanisms.',740)
    text(ax,42,183,'RNN  /  one word at a time',18,weight='bold')
    words=['my','card','was','stolen']
    for i,word in enumerate(words):
        x=191+i*245;box(ax,x,218,180,58);text(ax,x+90,247,word,17,align='center');arrow(ax,x+90,280,x+90,308)
        box(ax,x+48,312,84,49,SOFT,GREEN);text(ax,x+90,337,'h'+str(i+1),17,GREEN,align='center')
        if i<3:arrow(ax,x+135,337,x+48+245,337)
    text(ax,42,337,'h0',17,GREEN);arrow(ax,81,337,235,337)
    text(ax,42,405,'Each state mixes the next word with the previous state. Information travels through the chain.',12,MUTED)
    ax.plot([42,1158],[441,441],color=LINE,lw=1)
    text(ax,42,477,'Self-attention  /  direct word-to-word access',18,weight='bold')
    for i in range(4):
        for j in range(i+1,4):
            ax.add_patch(FancyArrowPatch((281+i*245,596),(281+j*245,596),connectionstyle=f'arc3,rad={-.18-.01*(j-i)}',arrowstyle='<->',color=GREEN,lw=1.5,mutation_scale=10))
    for i,word in enumerate(words):
        x=191+i*245;box(ax,x,599,180,58,SOFT,GREEN);text(ax,x+90,628,word,17,align='center')
    text(ax,42,705,'Connections show access, not equal weights. Attention learns how much each word should contribute.',12,MUTED)
    save(fig,number,'RNN states pass a running summary along a sequence. Unmasked self-attention gives tokens direct access to each other; learned weights need not be equal.', 'For “my card was stolen”, an RNN updates h0 through h4 sequentially. A second panel connects every pair of words directly for bidirectional self-attention. The links represent access, not equal attention weights.')


def closeness():
    number='5.2.2';fig,ax=canvas(number,'Length, distance and direction are different.', 'Notebook vectors: a = [1, 2, 0], b = [2, 4, 0], c = [0, 1, 2].',705)
    # Draw their actual geometry in the 2D plane spanned by a and c.
    a=np.array([np.sqrt(5),0]);b=2*a;c=np.array([2/np.sqrt(5),np.sqrt(21/5)])
    theta=np.pi/6;rotate=np.array([[np.cos(theta),-np.sin(theta)],[np.sin(theta),np.cos(theta)]])
    a,b,c=[rotate@v for v in (a,b,c)]
    for i,(name,metric) in enumerate([('Dot product','a · b = 10  |  a · c = 2'),('Euclidean distance','‖a − b‖ = √5 ≈ 2.24'),('Cosine similarity','cos(a, b) = 1  |  cos(a, c) = 0.4')]):
        x=42+i*377;box(ax,x,180,362,424);text(ax,x+18,213,name,17,weight='bold')
        origin=np.array([x+74,488]);scale=54
        for v,col,label in [(b,RUST,'b'),(c,BLUE,'c'),(a,GREEN,'a')]:
            end=origin+v*np.array([scale,-scale]);arrow(ax,*origin,*end,color=col,lw=2.4);text(ax,end[0]+9,end[1]-10,label,15,col,weight='bold')
        text(ax,origin[0]-15,origin[1]+23,'0',11,MUTED)
        if i==0:
            proj=a*np.dot(c,a)/np.dot(a,a);pp=origin+proj*np.array([scale,-scale]);tip=origin+c*np.array([scale,-scale])
            ax.plot([tip[0],pp[0]],[tip[1],pp[1]],'--',color=BLUE,lw=1.3);ax.plot([origin[0],pp[0]],[origin[1],pp[1]],color=BLUE,lw=5,alpha=.4)
        elif i==1:
            aa=origin+a*np.array([scale,-scale]);bb=origin+b*np.array([scale,-scale]);ax.plot([aa[0]+13,bb[0]+13],[aa[1]+23,bb[1]+23],'--',color=INK,lw=1.5)
        else:
            ax.add_patch(Circle(origin,scale,fc='none',ec=LINE,ls='--',lw=1.2))
            ax.add_patch(Arc(origin,80,80,theta1=-96.422,theta2=-30,color=BLUE,lw=2))
        text(ax,x+18,546,metric,10,weight='bold')
        text(ax,x+18,581,['Magnitude affects the score.','Compare the endpoints.','Normalise; compare directions.'][i],11,MUTED)
    text(ax,42,650,'The 3D vectors are drawn in their shared 2D plane; their lengths and angles are preserved.',12,MUTED)
    save(fig,number,'The lesson’s three-dimensional vectors drawn in the plane they span. Doubling a vector changes dot product and distance but preserves cosine similarity.', 'Vectors a=[1,2,0] and b=[2,4,0] share a direction; c=[0,1,2] differs. Dot products are 10 and 2. The distance between a and b is square root of 5. Cosine scores are 1 and 0.4. Geometry is preserved in a two-dimensional drawing.')


def pairs():
    number='5.3.1';fig,ax=canvas(number,'Same source image. Two different views.', 'Instance contrastive learning constructs pairs without digit labels.',725)
    ax.add_patch(Ellipse((597,414),983,435,fc=SOFT,ec=LINE,lw=1.5))
    points={'A1':(474,402,'3',GREEN),'A2':(668,406,'3',GREEN),'B':(253,316,'5',RUST),'C':(864,289,'0',RUST),'D':(887,542,'3',RUST)}
    for dest in ['B','C','D']:
        x,y,_,_=points[dest];arrow(ax,590,410,x,y,color=RUST,lw=2)
    arrow(ax,484,406,648,406,color=GREEN,style='<->',lw=4)
    for name,(x,y,digit,col) in points.items():
        box(ax,x-43,y-51,86,96,'white',col,2);text(ax,x,y-5,digit,37,col,align='center',weight='bold',rotation=-8 if name=='A2' else 0);text(ax,x,y+71,name,13,col,align='center',weight='bold')
    text(ax,575,323,'Positive pair',15,GREEN,align='center',weight='bold');text(ax,574,346,'Increase similarity',12,GREEN,align='center')
    text(ax,590,541,'Other source images are negatives.',14,RUST,align='center',weight='bold')
    text(ax,590,573,'Decrease their similarity in the batch.',12,RUST,align='center')
    text(ax,42,683,'D is also a “3”, but is a negative because it comes from a different image. Labels are not used.',12,MUTED)
    save(fig,number,'A1 and A2 are augmentations of one source image. B, C and D come from other images; D shows why false negatives can occur.', 'Two views of the same digit three form a positive pair with an inward arrow. Other source images, a five, zero and another three, are negative pairs with outward arrows. The second three remains a negative because labels are unavailable.')


def similarity_matrix():
    number='5.3.2';fig,ax=canvas(number,'Read one row: one positive, six negatives.', 'Four source images × two views = eight embeddings. Self-comparisons are masked.',770)
    labels=['A1','B1','C1','D1','A2','B2','C2','D2'];x0,y0,size=111,222,56
    for i,lab in enumerate(labels):text(ax,x0+size*(i+.5),y0-24,lab,12,align='center',weight='bold');text(ax,x0-19,y0+size*(i+.5),lab,12,align='right',weight='bold')
    for r in range(8):
        for c in range(8):
            positive=(r-c)%8==4;self_pair=r==c
            box(ax,x0+c*size,y0+r*size,size,size,'#e1e5df' if self_pair else LIME if positive else '#f4e5de','white')
            text(ax,x0+(c+.5)*size,y0+(r+.5)*size,'×' if self_pair else '+' if positive else '−',15,MUTED if self_pair else GREEN if positive else RUST,align='center',weight='bold')
    for yy,col,sym,label in [(253,'#e1e5df','×','Self: excluded from the loss'),(325,LIME,'+','Positive: same source image'),(397,'#f4e5de','−','Negative: another source image')]:
        box(ax,640,yy-20,38,38,col);text(ax,659,yy-1,sym,17,align='center',weight='bold');text(ax,696,yy-1,label,13,weight='bold')
    text(ax,641,480,'Row A1 targets column A2.',16,GREEN,weight='bold')
    text(ax,641,522,'Increase the positive similarity\nrelative to the six negatives.',14,MUTED,linespacing=1.8)
    text(ax,641,603,'The symbols show pair roles,\nnot measured similarity values.',12,MUTED,linespacing=1.8)
    text(ax,42,728,'Rows A2–D2 mirror the positive-pair assignments in rows A1–D1. No class labels define these pairs.',12,MUTED)
    save(fig,number,'Pair assignments for the lesson’s eight-view batch. The diagonal is masked; offset diagonals are positives, and six remaining entries per row are negatives.', 'An eight by eight matrix ordered A1 B1 C1 D1 A2 B2 C2 D2 uses crosses on the self diagonal, plus signs at A1/A2, B1/B2, C1/C2, D1/D2 and their mirrors, and minus signs elsewhere. Each row has one positive and six negatives.')


def icon(ax,x,y,kind,scale=.6):
    if kind=='dog':
        ax.add_patch(Ellipse((x,y),80*scale,45*scale,fc='#ac8b63',ec=GREEN));ax.add_patch(Circle((x+41*scale,y-18*scale),23*scale,fc='#ac8b63',ec=GREEN));ax.add_patch(Polygon([[x+30*scale,y-35*scale],[x+28*scale,y-60*scale],[x+49*scale,y-39*scale]],fc=GREEN))
        for dx in [-25,24]:ax.plot([x+dx*scale,x+dx*scale],[y+15*scale,y+42*scale],color=GREEN,lw=3)
    elif kind=='bus':
        box(ax,x-54*scale,y-35*scale,108*scale,60*scale,'#c76e54',GREEN)
        for dx in [-35,-4,27]:box(ax,x+dx*scale,y-25*scale,22*scale,20*scale,SOFT,GREEN)
        for dx in [-32,32]:ax.add_patch(Circle((x+dx*scale,y+29*scale),12*scale,fc=GREEN))
    elif kind=='soup':
        ax.add_patch(Ellipse((x,y),110*scale,52*scale,fc=SOFT,ec=GREEN));ax.add_patch(Ellipse((x,y-8*scale),91*scale,28*scale,fc='#c76e54',ec=GREEN))
    else:
        box(ax,x-42*scale,y-25*scale,84*scale,74*scale,SOFT,GREEN);box(ax,x+2*scale,y-56*scale,32*scale,106*scale,'#e0dccb',GREEN);ax.add_patch(Polygon([[x-5*scale,y-56*scale],[x+18*scale,y-94*scale],[x+41*scale,y-56*scale]],fc=GREEN));box(ax,x-28*scale,y+18*scale,22*scale,31*scale,'white',GREEN)


def clip():
    number='5.4.1';fig,ax=canvas(number,'Learn which image belongs with which caption.', 'A schematic four-pair CLIP training batch; optimise image-to-text and text-to-image.',910)
    x0,y0,size=287,270,123;names=['dog','bus','soup','church']
    text(ax,537,174,'Text embeddings →',14,GREEN,align='center',weight='bold')
    for i,name in enumerate(names):
        xx=x0+(i+.5)*size;box(ax,xx-56,196,112,58,SOFT);text(ax,xx,224,'a '+name,13,align='center')
        box(ax,102,y0+i*size+12,150,98,'white');icon(ax,176,y0+(i+.5)*size,name,.68)
    for r in range(4):
        for c in range(4):
            match=r==c;box(ax,x0+c*size,y0+r*size,size,size,LIME if match else '#f4e5de','white')
            text(ax,x0+(c+.5)*size,y0+(r+.5)*size,'+ match' if match else '− other',12,GREEN if match else RUST,align='center',weight='bold')
    text(ax,842,310,'Diagonal: paired',15,GREEN,weight='bold');text(ax,842,347,'Increase similarity.',12,MUTED)
    text(ax,842,437,'Off-diagonal:',15,RUST,weight='bold');text(ax,842,469,'Competing captions',12,MUTED);text(ax,842,495,'and images.',12,MUTED)
    text(ax,842,591,'Pair identity supplies',12,MUTED);text(ax,842,620,'the training target.',12,MUTED)
    box(ax,102,806,264,51,SOFT,GREEN);text(ax,234,831,'Image encoder',15,align='center',weight='bold');arrow(ax,371,831,466,831)
    box(ax,480,795,239,73,LIME,GREEN);text(ax,599,821,'Shared 512D space',14,align='center',weight='bold');text(ax,599,851,'CLIP ViT-B/32 in this lesson',10,align='center')
    box(ax,831,806,265,51,SOFT,GREEN);text(ax,963,831,'Text encoder',15,align='center',weight='bold');arrow(ax,826,831,732,831)
    save(fig,number,'CLIP uses paired images and captions as contrastive targets in both directions. The icons represent example images; the matrix shows pair roles, not measured scores.', 'Dog, bus, soup and church images align with their matching captions on the diagonal of a four by four matrix. Off-diagonal pairs compete. An image encoder and text encoder map into the shared 512-dimensional embedding space used by CLIP ViT-B/32.')


def patches():
    number='5.4.2';fig,ax=canvas(number,'A photo becomes 49 patch tokens + 1 class token.', 'CLIP ViT-B/32: 224 × 224 pixels → 7 × 7 patches, each 32 × 32 pixels.',875)
    text(ax,42,179,'1  Divide the image',17,weight='bold');text(ax,454,179,'2  Embed each patch',17,weight='bold')
    photo=existing_photo('5.4',38,(10,31,243,264));picture(ax,42,218,322,322,photo)
    for i in range(8):
        ax.plot([42+i*46,42+i*46],[218,540],color='white',lw=1)
        ax.plot([42,364],[218+i*46,218+i*46],color='white',lw=1)
    arrow(ax,376,380,435,380)
    box(ax,455,226,700,309,SOFT)
    box(ax,476,323,59,76,LIME,GREEN);text(ax,505,355,'CLS',11,align='center',weight='bold')
    for i in range(7):
        box(ax,552+i*83,323,67,76,'white',GREEN);text(ax,585+i*83,355,str(i+1) if i<5 else '…' if i==5 else '49',13,align='center')
    for i,j in [(0,3),(1,5),(2,6)]:
        ax.add_patch(FancyArrowPatch((585+i*83,317),(585+j*83,317),connectionstyle='arc3,rad=-.34',arrowstyle='<->',color=GREEN,lw=1.5,mutation_scale=10))
    text(ax,476,447,'50 tokens, each with 768 numbers',16,GREEN,weight='bold')
    text(ax,476,489,'Position information preserves each patch’s place in the image.',11,MUTED)
    text(ax,42,585,'3  Compare tokens with attention',17,weight='bold')
    box(ax,42,617,345,97,SOFT,GREEN);text(ax,214,650,'Vision Transformer',17,align='center',weight='bold');text(ax,214,686,'Tokens exchange information',12,align='center')
    arrow(ax,392,666,439,666)
    box(ax,449,617,292,97,'white',GREEN);text(ax,595,650,'Class-token output',17,align='center',weight='bold');text(ax,595,686,'768 numbers',13,align='center')
    arrow(ax,746,666,793,666)
    box(ax,805,617,351,97,LIME,GREEN);text(ax,980,650,'Visual projection',17,align='center',weight='bold');text(ax,980,686,'768 → 512 image embedding',13,align='center')
    text(ax,42,784,'Only selected attention links are drawn. Tokens also attend to themselves; their weights are learned.',12,MUTED)
    text(ax,42,821,'The 49 patches are independent input pieces, not 49 object labels.',12,MUTED)
    save(fig,number,'The lesson’s church photo is split into 49 patches. A class token makes 50 input tokens; the final class-token output is projected from 768 to 512 numbers.', 'A church photo is divided into a seven by seven grid. Forty-nine patch embeddings plus a class token enter a Vision Transformer with position information. Each token has 768 values. The final class token is projected into a 512-dimensional image embedding.')


def embed():
    for lid in ['5.1','5.2','5.3','5.4']:
        path,nb=notebook(lid);count=0
        for cell in nb['cells']:
            if cell['cell_type']!='markdown':continue
            src=''.join(cell['source'])
            for number,data in FIGURES.items():
                if not number.startswith(lid+'.'):continue
                # Idempotent: generated cells carry the image number as metadata.
                if cell.get('metadata',{}).get('dlp_figure')==number:
                    pat=re.compile(r'<div align="center">.*?</div>',re.S)
                else:
                    pat=re.compile(r'^>.*🖼.*\bIMAGE '+re.escape(number)+r'\b.*$',re.M)
                if not pat.search(src):continue
                name='figure-'+number+'.png'
                replacement=attachment_block(number,data['caption'],data['alt'])
                src=pat.sub(lambda _:replacement,src,count=1)
                cell.setdefault('attachments',{})[name]={'image/png':data['png']}
                cell.setdefault('metadata',{})['dlp_figure']=number
                count+=1
            cell['source']=src.splitlines(keepends=True)
        target=path.with_name('lesson-'+lid+'.ipynb')
        target.write_text(json.dumps(nb,ensure_ascii=False,indent=1)+'\n')
        if target!=path:path.unlink()
        print(f'{target.name}: {count} teaching diagrams embedded')
    manifest={k:{'caption':v['caption'],'alt':v['alt']} for k,v in FIGURES.items()}
    (OUT/'figures.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')


if __name__=='__main__':
    OUT.mkdir(parents=True,exist_ok=True)
    for draw in [pipeline,convolution,hierarchy,roadmap,recurrence,closeness,pairs,similarity_matrix,clip,patches]:draw()
    embed()
