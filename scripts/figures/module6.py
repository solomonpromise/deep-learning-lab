"""Generate Module 6's editable SVGs and portable notebook PNG attachments.

Uses the same drawing primitives and palette as Module 5. Run with matplotlib,
NumPy and Pillow. Code, saved outputs and prose outside figure prompts are kept.
"""
import json
import re
import numpy as np
import module5 as draw
from module5 import canvas, text, box, arrow, GREEN, SOFT, LIME, BLUE, RUST, LINE, MUTED
from matplotlib.patches import Circle

ROOT = draw.ROOT
OUT = ROOT / 'static/img/module-6'
draw.OUT = OUT
COLORS = [GREEN, BLUE, RUST]


def card(ax, x, y, w, h, label, fill=SOFT, size=14):
    box(ax, x, y, w, h, fill, GREEN)
    text(ax, x+w/2, y+h/2, label, size, align='center')


def finish(fig, number, caption, alt):
    draw.save(fig, number, caption, alt)


def pipeline():
    n='6.1.1'; fig,ax=canvas(n, 'Open the Transformer box.', 'Follow one sentence from text to a sentence embedding.', 660)
    card(ax,42,177,1116,64,'“my card was stolen”',size=20)
    for x,w,label,sub in [(42,250,'Tokenizer','Text → pieces → IDs'),(367,385,'Transformer','MiniLM: 6 encoder layers'),(827,331,'Pool + normalise','Masked mean → unit length')]:
        card(ax,x,328,w,116,label,LIME if x==367 else SOFT,19)
        text(ax,x+w/2,474,sub,12,align='center')
    arrow(ax,296,386,357,386);arrow(ax,757,386,817,386)
    for i,t in enumerate(['[CLS]','my','card','was','stolen','[SEP]']):
        card(ax,58+i*184,262,164,40,t,'white',12)
    text(ax,560,528,'Module 6: look inside these layers',17,GREEN,align='center',weight='bold')
    text(ax,42,595,'Six contextual token vectors',14,weight='bold');arrow(ax,365,595,640,595)
    card(ax,662,564,496,62,'One sentence vector: 384 numbers',LIME,16)
    finish(fig,n,'MiniLM produces one vector per token. Masked mean pooling and normalisation then produce the sentence vector.', 'The sentence my card was stolen becomes six tokens: CLS, my, card, was, stolen, SEP. Token IDs enter six MiniLM encoder layers. Six contextual vectors are pooled with the padding mask and normalised into one 384-number sentence vector.')


def lookup():
    n='6.1.2';fig,ax=canvas(n,'An embedding is a row lookup.', 'MiniLM’s word table: 30,522 rows × 384 numbers. Rows below are selected, not to scale.',740)
    text(ax,42,180,'Token / ID',16,weight='bold');text(ax,428,180,'Word embedding table',16,weight='bold');text(ax,880,180,'In sentence order',16,weight='bold')
    tokens=['[CLS]','my','card','was','stolen','[SEP]'];ids=[101,2026,4003,2001,7376,102]
    ordered=sorted(ids)
    for i,idx in enumerate(ordered):
        y=236+i*61;card(ax,420,y,335,42,f'row {idx}   ··· 384 values ···',SOFT,12)
    for i,(tok,idx) in enumerate(zip(tokens,ids)):
        y=236+i*61;card(ax,42,y,205,42,f'{tok}   →   {idx}','white',13)
        ty=257+ordered.index(idx)*61
        arrow(ax,252,y+21,414,ty,lw=1.2)
        arrow(ax,760,ty,870,y+21,lw=1.2)
        card(ax,876,y,280,42,f'{tok} vector  ···',LIME,12)
    text(ax,42,665,'Lookup = select a row; no arithmetic is needed.',15,GREEN,weight='bold')
    text(ax,876,665,'Shape: (1, 6, 384)',16,GREEN,weight='bold')
    text(ax,876,703,'batch × tokens × width',11,MUTED)
    finish(fig,n,'Each token ID selects a 384-number row. The six rows are stacked in sentence order to form a (1, 6, 384) tensor.', 'CLS selects row 101, my 2026, card 4003, was 2001, stolen 7376 and SEP 102 from the 30,522 by 384 word table. Selected rows are copied into sentence order. Vector colours are schematic; no learned values are shown.')


def mixing():
    n='6.2.1';fig,ax=canvas(n,'Attention builds a weighted mixture.', 'One query compares with every key, then blends the corresponding value vectors.',650)
    card(ax,450,174,300,64,'Query from “bit”',LIME,19)
    weights=[.05,.40,.10,.05,.40]
    for i,(token,w) in enumerate(zip(['the','dog','bit','the','man'],weights)):
        x=42+i*227;arrow(ax,600,242,x+99,320,lw=1+w*7)
        card(ax,x,326,200,58,token,'white',18)
        text(ax,x+100,411,f'weight {w:.2f}',13,align='center')
        arrow(ax,x+100,435,600,517,lw=1+w*7)
    card(ax,250,524,700,63,'New vector for “bit” = Σ weight × value',LIME,19)
    text(ax,600,621,'Illustrative weights, not measured MiniLM attention. The five weights sum to 1.',12,MUTED,align='center')
    finish(fig,n,'Attention uses query–key scores to choose how much of each value vector to mix into the output.', 'An illustrative query for bit assigns weights 0.05, 0.40, 0.10, 0.05 and 0.40 to the five tokens the, dog, bit, the, man. Thicker arrows indicate larger weights. The output is the weighted sum of value vectors, not a mixture of token IDs.')


def qkv():
    n='6.2.2';fig,ax=canvas(n,'One token, three learned projections.', 'Queries and keys determine the weights. Values supply the information being mixed.',640)
    card(ax,42,296,245,110,'“card”\ninput vector x',LIME,19)
    for y,col,name,formula,role in [(190,GREEN,'Query','q = xWq + bq','What am I looking for?'),(341,BLUE,'Key','k = xWk + bk','What can match me?'),(492,RUST,'Value','v = xWv + bv','What information do I pass on?')]:
        arrow(ax,292,351,418,y+30,color=col)
        card(ax,426,y,260,62,formula,'white',16);arrow(ax,691,y+30,769,y+30,color=col)
        text(ax,796,y+13,name,20,col,weight='bold');text(ax,796,y+49,role,12)
    text(ax,42,603,'The same three projections are applied at every token position. Their weights are learned during training.',12,MUTED)
    finish(fig,n,'Separate learned projections turn the same input vector into a query, a key and a value.', 'The input vector for card branches into three linear projections, including biases as in MiniLM. Query and key vectors are compared to obtain attention weights. The value vector is the content passed into the weighted sum.')


def padding():
    n='6.2.3';fig,ax=canvas(n,'Padding keys receive zero attention.', 'Mask scores before softmax. Rows are queries; columns are keys.',790)
    labels=['CLS','my','card','was','stolen','SEP','PAD'];s=66;x0=161;y0=247
    rng=np.random.default_rng(6);scores=rng.normal(size=(7,6));w=np.exp(scores);w/=w.sum(1,keepdims=True)
    for i,t in enumerate(labels):
        text(ax,x0+(i+.5)*s,222,t,11,align='center');text(ax,x0-16,y0+(i+.5)*s,t,11,align='right')
        for j in range(7):
            col='#e1e3dd' if j==6 else draw.plt.cm.Greens(.1+.75*w[i,j]/w.max())
            box(ax,x0+j*s,y0+i*s,s,s,col,'white')
            if j==6:text(ax,x0+(j+.5)*s,y0+(i+.5)*s,'0',15,align='center')
    text(ax,695,280,'attention_mask',17,weight='bold');text(ax,695,320,'1  1  1  1  1  1  0',17,GREEN)
    for y,line in [(400,'PAD key score = −∞'),(440,'softmax(−∞) = 0'),(519,'A padding query can still'),(549,'produce an output vector.'),(604,'Exclude padded outputs'),(634,'from sentence pooling.')]:text(ax,695,y,line,14)
    text(ax,161,749,'Non-padding weights are illustrative; the last column is exactly zero.',12,MUTED)
    finish(fig,n,'The padding mask blocks the PAD key column. It does not automatically zero the PAD query row.', 'A seven by seven attention matrix for CLS, my, card, was, stolen, SEP, PAD has a grey last column containing zeros. All other weights are illustrative. The mask is 1 1 1 1 1 1 0. Padding outputs must also be excluded from mean pooling.')


def heads():
    n='6.3.1';fig,ax=canvas(n,'384 numbers become 12 heads of 32.', 'Split each token’s projected query, key and value in the same way.',850)
    text(ax,42,179,'One token’s projected query: 384 numbers',17,weight='bold')
    for i in range(12):
        x=42+i*93;box(ax,x,219,93,64,[SOFT,LIME,'#dde9f0'][i%3]);text(ax,x+46,250,str(i),14,align='center')
        text(ax,x+46,300,'32',11,MUTED,align='center')
    arrow(ax,290,332,290,391);text(ax,330,360,'split_heads',16,GREEN)
    for i in range(12):
        y=405+i*30;text(ax,42,y+12,f'head {i:2}',12)
        for j in range(32):box(ax,150+j*9,y,9,23,[SOFT,LIME,'#dde9f0'][i%3],LINE,.3)
    text(ax,550,447,'Before: (1, 7, 384)',20,GREEN,weight='bold')
    text(ax,550,493,'After: (1, 12, 7, 32)',20,GREEN,weight='bold')
    text(ax,550,539,'batch × heads × tokens × head width',13,MUTED)
    text(ax,550,622,'Each head attends independently.',15)
    text(ax,550,661,'merge_heads joins the 12 outputs;',15)
    text(ax,550,696,'the output projection mixes them.',15)
    text(ax,42,807,'The coloured segments show dimensions, not different groups of tokens.',13,MUTED)
    finish(fig,n,'MiniLM splits a width of 384 into 12 heads of width 32, preserving all seven token positions in every head.', 'A 384-dimensional query is divided into twelve segments of 32 and stacked as heads 0 through 11. Tensor shape changes from 1 by 7 by 384 to 1 by 12 by 7 by 32. Merging reverses the reshape; an output projection follows attention.')


def stack():
    n='6.3.2';fig,ax=canvas(n,'Six blocks turn tokens into context.', 'MiniLM is post-norm: each sublayer is followed by residual addition and LayerNorm.',960)
    card(ax,80,840,440,65,'Word + position + type → LayerNorm',SOFT,14)
    for i in range(6):
        y=745-i*80;card(ax,130,y,340,55,f'Encoder block {i+1}',LIME if i==0 else SOFT,17)
        arrow(ax,300,835 if i==0 else y+75,300,y+59)
    card(ax,80,193,440,90,'Masked mean pooling\n→ normalise → 384-number vector',LIME,15)
    arrow(ax,300,339,300,287)
    text(ax,650,206,'Inside each block (read upward)',17,GREEN,weight='bold')
    items=[(790,'Multi-head attention'),(679,'Add + LayerNorm'),(568,'Feed-forward: 384 → 1536 → 384'),(457,'Add + LayerNorm')]
    for y,label in items:card(ax,650,y,460,65,label,SOFT,14)
    arrow(ax,880,880,880,859)
    for y in [790,679,568]:arrow(ax,880,y-5,880,y-41)
    for y,end in [(880,711),(650,489)]:
        ax.plot([880,1140,1140],[y,y,end],color=GREEN,lw=2);arrow(ax,1140,end,1115,end)
    text(ax,650,367,'Output: one vector per token',15,weight='bold');arrow(ax,880,452,880,392)
    text(ax,650,915,'Residual paths keep the input to each sublayer.',12,MUTED)
    finish(fig,n,'MiniLM repeats the same post-norm block six times. The lesson reconstructs its sentence embedding and checks it against sentence-transformers.', 'Embeddings combine word, position and type vectors followed by LayerNorm. Six encoder blocks each contain multi-head attention, residual addition and LayerNorm, then a feed-forward network, residual addition and LayerNorm. Masked mean pooling and normalisation produce the final 384-dimensional sentence embedding.')


def reverse():
    n='6.4.1';fig,ax=canvas(n,'Reversing a sequence means looking in a mirror.', 'Schematic attention pattern: query i reads key 7 − i.',800)
    x0=112;y0=245;s=57
    text(ax,340,178,'Key position',14,align='center',weight='bold');text(ax,38,471,'Query position',13,rotation=90,align='center')
    for i in range(8):
        text(ax,x0+(i+.5)*s,217,str(i),12,align='center');text(ax,89,y0+(i+.5)*s,str(i),12,align='center')
        for j in range(8):box(ax,x0+j*s,y0+i*s,s,s,GREEN if j==7-i else SOFT,'white')
    seq=[3,7,7,0,9,1,4,7]
    text(ax,650,215,'Input digits',17,weight='bold')
    for i,v in enumerate(seq):
        card(ax,650+i*63,255,53,53,str(v),'white',16)
        card(ax,650+i*63,505,53,53,str(seq[7-i]),LIME,16)
        arrow(ax,676+i*63,315,676+(7-i)*63,497,lw=1)
    text(ax,650,596,'Reversed output',17,weight='bold')
    text(ax,650,652,'Block 1: mean mirror weights',13,MUTED)
    text(ax,650,686,'0.961   0.932   0.971   0.973',15,GREEN,weight='bold')
    text(ax,112,751,'The dark cells show the ideal pattern; the numbers are the notebook’s saved head averages.',12,MUTED)
    finish(fig,n,'The reversal task routes position i to position 7 − i. The schematic anti-diagonal illustrates the measured preference for mirror positions.', 'An eight by eight grid highlights the anti-diagonal from query zero, key seven to query seven, key zero. Input 3 7 7 0 9 1 4 7 becomes 7 4 1 9 0 7 7 3. Saved first-block mean mirror weights are 0.961, 0.932, 0.971, 0.973; the grid is schematic, not an exact heatmap.')


def mask_grid(ax,x,y,rows,cols,causal=False,s=45):
    for r in range(rows):
        for c in range(cols):
            allowed=not causal or c<=r
            box(ax,x+c*s,y+r*s,s,s,LIME if allowed else '#e1e3dd','white')
            text(ax,x+(c+.5)*s,y+(r+.5)*s,'•' if allowed else '×',13,GREEN if allowed else MUTED,align='center')


def families():
    n='6.5.1';fig,ax=canvas(n,'Three families, three attention patterns.', 'Rows are queries, columns are keys. A dot means allowed; a cross means blocked.',820)
    for x,title,sub in [(42,'Encoder','See both directions'),(425,'Decoder','See only self + earlier tokens'),(808,'Encoder–decoder','Read input; generate output')]:
        text(ax,x,185,title,20,GREEN,weight='bold');text(ax,x,224,sub,12,MUTED)
    mask_grid(ax,70,275,5,5);mask_grid(ax,453,275,5,5,True)
    text(ax,42,554,'Bidirectional self-attention',14,weight='bold');text(ax,425,554,'Causal self-attention',14,weight='bold')
    text(ax,42,598,'Example: MiniLM / BERT',13);text(ax,425,598,'Example: GPT-2',13)
    text(ax,808,264,'Encoder self-attention',12,weight='bold');mask_grid(ax,808,290,4,4,s=40)
    text(ax,808,483,'Decoder self-attention',12,weight='bold');mask_grid(ax,808,506,3,3,True,s=40)
    text(ax,808,657,'Cross-attention: output → input',12,weight='bold');mask_grid(ax,808,680,3,4,s=30)
    text(ax,1005,734,'T5',17,GREEN,weight='bold')
    text(ax,42,710,'Cross-attention uses queries from the decoder',15)
    text(ax,42,747,'and keys / values from the encoder’s output.',15)
    finish(fig,n,'Encoders use bidirectional attention; decoders use causal attention. Encoder–decoders add cross-attention from output positions to encoded input.', 'Allowed-attention grids show all five by five pairs for an encoder and the lower triangle including the diagonal for a decoder. An encoder-decoder has a full four by four encoder grid, causal three by three decoder grid, and full three by four cross-attention grid. Padding masks are omitted for clarity.')


def positions():
    n='6.6.1';fig,ax=canvas(n,'Position can enter at three different places.', 'The common job: make token order available to attention.',760)
    for x,title,sub in [(42,'Learned table','Add to the input vectors'),(425,'Relative bias','Add to attention scores'),(808,'Rotary / RoPE','Rotate queries and keys')]:
        text(ax,x,185,title,21,GREEN,weight='bold');text(ax,x,228,sub,12,MUTED)
    card(ax,68,290,270,65,'Token embedding',SOFT,16);text(ax,203,385,'+',28,GREEN,align='center')
    card(ax,68,418,270,65,'Position 2 embedding',LIME,15);arrow(ax,203,488,203,553)
    card(ax,68,560,270,65,'Input to the blocks',SOFT,15)
    for r in range(4):
        for c in range(4):
            # Replace the generic allow-dot with a distance label.
            card(ax,458+c*54,290+r*54,54,54,str(c-r),SOFT,14)
    text(ax,425,549,'Signed distance = key − query',12)
    text(ax,425,590,'score + learned bucket bias',13,GREEN,weight='bold')
    text(ax,425,628,'T5 groups distances into buckets.',12,MUTED)
    for i in range(4):
        cx=862+(i%2)*190;cy=337+(i//2)*186
        ax.add_patch(Circle((cx,cy),46,fc='white',ec=LINE,lw=2))
        theta=i*.55;arrow(ax,cx,cy,cx+36*np.cos(theta),cy-36*np.sin(theta))
        text(ax,cx,cy+72,f'position {i}',12,align='center')
    text(ax,808,662,'One dimension pair is shown.',11,MUTED)
    text(ax,42,713,'Learned table: before attention. Relative bias: on scores. RoPE: on Q and K before their dot product.',12,GREEN,weight='bold')
    finish(fig,n,'Learned positions modify input vectors, relative bias modifies attention scores, and RoPE rotates queries and keys before scoring.', 'Three panels show adding a token vector to a position vector, adding a learned bias based on signed distance buckets to each attention score, and rotating a query or key dimension pair by position. For each RoPE frequency the angle difference is proportional to relative distance; different dimension pairs have different frequencies.')


def modern():
    n='6.6.2';fig,ax=canvas(n,'Read a modern decoder block from bottom to top.', 'Qwen3-0.6B uses pre-norm, grouped-query attention, rotary position and a gated FFN.',1130)
    # Residual paths are drawn first so they remain behind the labels.
    for y,end in [(1025,601),(574,253)]:
        ax.plot([350,70,70,350],[y,y,end,end],color=GREEN,lw=2)
    card(ax,175,977,350,64,'Token vectors in',LIME,17)
    card(ax,148,875,404,65,'RMSNorm: input_layernorm',SOFT,14)
    card(ax,119,648,462,190,'',SOFT)
    text(ax,350,676,'Masked self-attention',17,GREEN,align='center',weight='bold')
    text(ax,350,716,'q_proj: 16 heads; k_proj / v_proj: 8',13,align='center')
    text(ax,350,751,'Q/K head norms → RoPE on Q and K',12,align='center')
    text(ax,350,788,'Causal attention → merge → o_proj',13,align='center')
    card(ax,148,477,404,65,'RMSNorm: post_attention_layernorm',SOFT,12)
    card(ax,119,300,462,140,'Gated FFN\ndown_proj(SiLU(gate_proj(x))\n× up_proj(x))',SOFT,15)
    card(ax,175,177,350,40,'Token vectors out',LIME,16)
    for y,end in [(977,945),(875,842),(648,624),(577,547),(477,445),(300,276),(229,220)]:arrow(ax,350,y,350,end)
    for y in [601,253]:
        ax.add_patch(Circle((350,y),23,fc='white',ec=GREEN,lw=2));text(ax,350,y,'+',23,GREEN,align='center')
    text(ax,670,207,'Compare: MiniLM post-norm',18,GREEN,weight='bold')
    for y,label in [(846,'Token vectors in'),(731,'Multi-head attention'),(616,'Add + LayerNorm'),(501,'Feed-forward'),(386,'Add + LayerNorm'),(271,'Token vectors out')]:
        card(ax,692,y,435,63,label,'white',16)
    for y in [846,731,616,501,386]:arrow(ax,910,y-5,910,y-47)
    for y,end in [(925,647),(594,417)]:
        ax.plot([910,1150,1150],[y,y,end],color=LINE,lw=2);arrow(ax,1150,end,1131,end,color=MUTED)
    text(ax,670,989,'Pre-norm: normalise before each sublayer.',12)
    text(ax,670,1027,'Post-norm: normalise after residual addition.',12)
    text(ax,42,1088,'Masks and rotary position do not need learned weight matrices, so a module printout can hide them.',12,MUTED)
    finish(fig,n,'Qwen3-0.6B applies RMSNorm before attention and before its gated FFN, with a residual addition after each. MiniLM applies LayerNorm after each addition.', 'Read upward: input, RMSNorm, attention with sixteen query heads and eight shared key/value heads, per-head Q/K normalisation, RoPE, causal attention and output projection, residual addition, RMSNorm, gated SiLU feed-forward, residual addition, output. A side diagram shows MiniLM’s post-norm ordering. Dropout is omitted in both inference diagrams.')


def embed():
    dest=ROOT/'notes/module-6';dest.mkdir(parents=True,exist_ok=True)
    for i in range(1,7):
        lid=f'6.{i}';path=dest/f'lesson-{lid}.ipynb'
        source=path if path.exists() else next((ROOT/'notes/Day 6').glob(lid+'_*.ipynb'))
        nb=json.loads(source.read_text());count=0
        for cell in nb['cells']:
            if cell['cell_type']!='markdown':continue
            src=''.join(cell['source'])
            for number,data in draw.FIGURES.items():
                if not number.startswith(lid+'.'):continue
                if cell.get('metadata',{}).get('dlp_figure')==number:
                    pat=re.compile(r'<div align="center">\s*\n\n!\[.*?\]\(attachment:figure-'+re.escape(number)+r'\.png\).*?</div>',re.S)
                else:pat=re.compile(r'^>.*🖼.*\bIMAGE '+re.escape(number)+r'\b.*$',re.M)
                if not pat.search(src):continue
                src=pat.sub(lambda _:draw.attachment_block(number,data['caption'],data['alt']),src,count=1)
                cell.setdefault('attachments',{})[f'figure-{number}.png']={'image/png':data['png']}
                cell.setdefault('metadata',{})['dlp_figure']=number;count+=1
            cell['source']=src.splitlines(keepends=True)
        expected=sum(n.startswith(lid+'.') for n in draw.FIGURES)
        assert count==expected,(lid,count,expected)
        path.write_text(json.dumps(nb,ensure_ascii=False,indent=1)+'\n')
        print(f'{path.name}: {count} figures embedded')
    (OUT/'figures.json').write_text(json.dumps({n:{'caption':v['caption'],'alt':v['alt']} for n,v in draw.FIGURES.items()},indent=2,ensure_ascii=False)+'\n')


if __name__=='__main__':
    raise SystemExit('These diagrams describe superseded notes. Use scripts/authoring/build_notes.py for Modules 5–6.')
    OUT.mkdir(parents=True,exist_ok=True)
    for fn in [pipeline,lookup,mixing,qkv,padding,heads,stack,reverse,families,positions,modern]:fn()
    embed()
