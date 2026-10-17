"""Reviewed figure captions and exact worked visual sequences for the replacement notes."""
import base64
import json
from pathlib import Path

CAPTIONS = {
 '5.1.1': 'The boot is described first by pixel intensities, then by task-useful features. The named properties are an intuition; learned coordinates need not have individual human-readable meanings or fewer dimensions.',
 '5.1.2': 'The encoder builds a representation and the head uses it. In joint supervised training, one loss sends gradients through both parts. The displayed class bars are illustrative; a linear head produces logits before softmax.',
 '5.1.3': 'A conceptual hierarchy from local edges to larger combinations. These are explanatory illustrations, not measured filters from the notebook experiment.',
 '5.1.4': 'The reference run compares representations with the same kind of linear probe and 10,000 probe labels. The learned encoder had prior labelled training, so these results do not isolate representation choice at an equal total data budget.',
 '5.2.1': 'The exact lesson architecture: 1×28×28 → 16×28×28 → 16×14×14 → 32×14×14 → 32×7×7 → 1,568 features → a classifier. Batch dimension is omitted; feature-map appearance is schematic.',
 '5.2.2': 'For this model, receptive-field widths grow from 3 after conv1 to 4 after pool1, 8 after conv2, and 10 after pool2. This describes theoretical input coverage, not a measured activation map.',
 '5.2.3': 'Convolution applies local shared weights; feature maps retain spatial organisation, pooling reduces resolution, and the head combines features into class scores. The feature maps shown are conceptual.',
 '5.3.1': 'Token IDs are arbitrary vocabulary indices. An embedding lookup turns each index into a learned vector. The displayed IDs are an example vocabulary, not the recorded IDs of this experiment.',
 '5.3.2': 'Selecting row 49 is equivalent to multiplying a one-hot vector by the table, without materialising that dense one-hot vector. Both table entries and the chosen row are illustrative.',
 '5.3.3': 'Cosine similarity compares directions rather than lengths: 1 for the same direction, 0 for perpendicular vectors, and −1 for opposite directions. It is undefined for a zero vector without a numerical convention.',
 '5.3.4': 'A static table returns the same vector for a token type in every sentence. A contextual model produces different output vectors as surrounding tokens change; a static vector can still encode multiple usages.',
 '5.3.5': 'Illustrative geometry, not the experiment’s measured projection. Objectives, data, dimensions and training can all change an embedding space. Read the actual cosine tables and PCA plots above for evidence from this run.',
 '5.4.1': 'One recurrent update with shared weights reads dog → bites → man. Each hidden state depends on the current token and previous state; the final state is a finite-dimensional sequence summary.',
 '5.4.2': 'The forget gate retains old cell state, the input gate admits a candidate, and the output gate exposes tanh of the new state. A near-one forget gate helps preserve the direct memory path; it does not guarantee perfect long-range learning.',
 '5.4.3': 'Recurrent information follows sequential updates; attention can directly mix allowed context positions. Connection strengths are illustrative. A causal model can consult only the current and earlier positions.',
 '5.4.4': 'Order-aware recurrence, gated memory and direct attention address different limitations. Attention supports parallel training, while autoregressive generation still proceeds one new token at a time.',
 '5.5.1': 'Separate encoders do not automatically align their coordinates. Joint contrastive training can make projected image and text vectors comparable in a shared space. Cluster positions here are schematic.',
 '5.5.2': 'In this toy batch each image has one designated matching caption. Contrastive loss raises matched scores relative to other batch entries; semantically similar off-diagonal pairs can be false negatives.',
 '5.5.3': 'Training aligns image–caption pairs. At inference, compare a new image with candidate text descriptions. Bars are illustrative similarities, not measured confidence or calibrated probabilities.',
 '5.5.4': 'Each encoder is projected into the same 32-dimensional, unit-length space. The contrastive objective trains the projections and encoders; image–text comparison then supports retrieval or classification. The clusters are schematic.',
 '5.6.1': 'Conceptual projection analogy. PCA retains directions of greatest variance; t-SNE emphasises local neighbourhoods. Both can distort structure, so validate claims using appropriate measurements in the full representation space.',
 '5.6.2': 'Module 5 connects representation learning for images, text and sequences with shared spaces and measurement. A learned representation need not be compact or have individually interpretable coordinates.',
 '6.1.1': 'The lesson’s causal decoder-only Transformer adds token and position embeddings, applies three blocks, then normalises and predicts 65 next-character logits per position. The short row illustrates part of a 64-token context.',
 '6.1.2': 'A schematic residual stream: the same character can acquire different context-dependent representations. The coloured updates are an analogy, not measured semantic coordinates or guaranteed attention behaviour.',
 '6.1.3': 'Follow the same system from inputs (6.2), through attention (6.3), the block (6.4), the full architecture (6.5), and training and generation (6.6). All Module 6 material is covered in class.',
 '6.2.1': 'Split the data without crossing the boundary, tokenise and encode, then sample windows. For next-token learning y is x shifted one position forward in the source stream. The real batch shape is (32, 64); the short example is illustrative.',
 '6.2.2': 'This line has 18 characters including its three spaces. The lesson’s word tokenizer preserves spaces, and the illustrated BPE segmentation has 10 tokens. Vocabulary size and sequence length trade off; unknown handling depends on the tokenizer.',
 '6.3.1': 'Bidirectional illustration with invented attention weights. Later tired or wide can affect an earlier position only when the mask permits it. A causal model at it cannot see those future words. Attention mixes projected values and is not a guaranteed explanation of a decision.',
 '6.3.2': 'Project Q, K and V; compare queries with keys; scale by √dₖ; apply the mask before row-wise softmax; then mix values. Each output is a weighted sum of projected value vectors.',
 '6.3.3': 'Learn Q, K and V from the full 64-coordinate input, then reshape into four 16-coordinate heads. Concatenate their outputs and apply an output projection. Heads do not receive disjoint slices of the original unprojected input.',
 '6.4.1': 'The pre-norm block adds attention and feed-forward updates to the residual stream, with LayerNorm on each branch. Every stage preserves (B, T, 64). The feed-forward network is shared across positions.',
 '6.4.2': 'Post-norm puts normalisation on the residual path after each addition. Pre-norm puts it at each branch input, leaving an identity route within the block. A final model-level norm may still follow the stack; training behaviour depends on the full setup.',
 '6.4.3': 'Attention gathers across allowed positions, the feed-forward network transforms each position, residual addition preserves a direct path, and LayerNorm standardises coordinates within each token before learned scale and shift. LayerNorm does not make coordinates equal.',
 '6.5.1': 'The untied reference model has 162,561 parameters. A 64-token input produces logits of shape (B, 64, 65). Cross-entropy consumes raw logits during training; softmax converts them to probabilities for inspection or sampling.',
 '6.5.2': 'Decoder queries attend to keys and values from encoded source tokens. Target self-attention is causal; source self-attention is bidirectional apart from any padding mask. Residual connections and norms are omitted for clarity.',
 '6.6.1': 'Teacher forcing compares every position with its true next character in one masked pass. Generation samples from the last position, appends the choice, and repeats with fixed weights. ↵ denotes a newline; the sample text is illustrative.',
 '6.6.2': 'The training loop predicts real next tokens, measures loss and updates model weights. Generation branches from the trained model and feeds chosen tokens back into its context; it never runs the optimizer.',
}

MOTIONS = {
 '5.2': [(3,'flatten','Follow a grid into a vector','Watch the same values move in row order. Reshaping with the original dimensions recovers the image grid.'),
         (5,'convolution','Slide one shared filter','Step through nine exact dot products. Notice which values change and which filter weights stay fixed.')],
 '5.4': [(4,'memory','Inspect one LSTM memory update','Follow one scalar coordinate through the forget, input and output gates. The values are a worked example.')],
 '6.3': [(7,'attention','Mix values with causal attention','Choose each query position in turn. Masked future tokens receive zero weight; allowed weights sum to one.')],
 '6.4': [(5,'norm','Normalise one token, coordinate by coordinate','Follow centring, scaling and the learned affine transformation. The coordinates remain different.')],
 '6.6': [(8,'generation','Follow the autoregressive loop','Play or step through three character choices. Each chosen character becomes part of the next input; model weights stay fixed.')],
}

def inserts(lid):
    return [dict(type='widget',name='concept-motion',section=sec,at='end',title=title,
                 intro=intro,props=dict(scene=scene),
                 caption='Paused on arrival. Use Previous step, Play/Pause, Next step or Reset. This is a fixed worked example, not a live trained model.')
            for sec,scene,title,intro in MOTIONS.get(lid,[])]

def load_manifest(root):
    p=root/'static/img/module56-visuals/manifest.json'
    return json.loads(p.read_text()) if p.exists() else {}

def attachment(root,row):
    p=root/row['file']
    return p.name,base64.b64encode(p.read_bytes()).decode()

def add_worked_figures(cells,lid,root):
    """Add portable numerical companions at the end of the relevant sections."""
    import re
    import nbformat
    pending={sec:(scene,title,intro) for sec,scene,title,intro in MOTIONS.get(lid,[])}
    result=[]
    current=None
    def flush():
        if current not in pending: return
        scene,title,intro=pending.pop(current)
        p=root/f'static/img/module56-visuals/{scene}-worked.png'
        if not p.exists(): raise FileNotFoundError(p)
        payload=base64.b64encode(p.read_bytes()).decode()
        cell=nbformat.v4.new_markdown_cell(f'**Visual walkthrough: {title}.**\n\n{intro}\n\n![{title}: a numerical worked example.](attachment:{p.name})\n\n*These supplied numbers illustrate the calculation. The web app adds a paused, step-by-step animation of the same example.*')
        cell.attachments={p.name:{'image/png':payload}}
        cell.metadata['visual_companion']=scene
        result.append(cell)
    for cell in cells:
        heading=re.search(r'^## (.+)',cell.source,re.M) if cell.cell_type=='markdown' else None
        if heading:
            flush()
            numbered=re.match(r'(\d+)\.',heading[1])
            current=int(numbered[1]) if numbered else None
        result.append(cell)
    flush()
    assert not pending, (lid,pending)
    return result
