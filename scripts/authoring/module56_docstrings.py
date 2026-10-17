"""Concise learner-facing docstrings for the replacement notebooks' helpers.

Applied through the established enrichment layer, without changing executable
behaviour or the author's source snapshots.
"""
import ast
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from dlp.docstrings import find_defs

SUMMARIES = {
'read_idx': 'Read a cached gzip-compressed IDX array, skipping its binary header.',
'handcrafted_features': 'Compute the seven explicitly designed image measurements described above.',
'linear_probe': 'Fit a standardised logistic regression on fixed features and evaluate held-out examples.',
'unit_summary': 'Find the most activating validation images and summarise their class concentration.',
'flat_index': 'Convert a grid coordinate into its row-major flattened index.',
'shuffle_pixels': 'Apply the same fixed pixel permutation to every image; no pixel values are discarded.',
'evaluate': 'Predict in batches without gradients; return accuracy and predicted class indices.',
'train': 'Train with the declared split, optimiser and budget; return the measurements described at the call site.',
'sign_test': 'Compare paired correctness disagreements with a two-sided binomial test under equal accuracy.',
'conv_out': 'Calculate convolution output size along one axis, for unit dilation.',
'receptive_field': 'Backpropagate from a central output to measure the active input support in this controlled probe.',
'balance': 'Measure absolute weight sum divided by absolute-weight total for each filter; low values indicate cancellation.',
'tokenize': 'Lowercase, remove the stated HTML breaks and extract letter/apostrophe tokens.',
'encode': 'Map tokens through the training vocabulary, using the unknown-token policy defined above.',
'one_hot': 'Return the vocabulary-length indicator vector for a known word.',
'cosine': 'Return the cosine similarity of two nonzero vectors: their dot product divided by their norms.',
'vec': 'Select a known word\'s row from an embedding table.',
'to_tensor': 'Truncate to MAX_LEN and pad shorter token lists with PAD; return an integer batch.',
'neighbours': 'Rank other vocabulary entries by cosine similarity to a word\'s embedding.',
'rnn_by_hand': 'Apply the shared RNN update in temporal order and return every hidden state.',
'gradient_reach': 'Average input-gradient norms across initialisation seeds, indexed by distance back from the last output.',
'make_task': 'Generate random sequences whose binary label is encoded only in the first token.',
'run_task': 'Train and validate a fresh recurrent classifier on the controlled first-token memory task.',
'open_lstm': 'Create an LSTM with both forget-gate bias slices set to 1.5, then wrap its sequence output.',
'class_prompts': 'Create one caption per clothing class from a shared template.',
'zero_shot_accuracy': 'Classify images by their most similar text description; return accuracy and predictions. Known training classes are not an unseen-class benchmark.',
'contrastive_loss': 'Average image-to-text and text-to-image cross-entropy with diagonal matching targets.',
'sample_batch': 'Sample training images and one class-derived caption per image using a seeded generator.',
'train_clip': 'Jointly train the toy image/text encoders and record loss plus the same-class collision diagnostic.',
'search': 'Rank cached validation image vectors by cosine similarity to the encoded query; return indices and scores.',
'features': 'Collect fixed encoder outputs in batches without tracking gradients.',
'nearest': 'Return reference-image indices nearest to one query in squared feature distance.',
'neighbour_agreement': 'Measure the fraction of retrieved neighbours sharing each query\'s label.',
'mask_grid': 'Construct an illustrative allowed-attention grid for the selected Transformer family.',
'encode_chars': 'Map known characters to integer IDs using the fitted character vocabulary.',
'decode_chars': 'Reconstruct text from character-vocabulary IDs.',
'split_words': 'Split into words, individual punctuation marks and whitespace, preserving reconstructable text.',
'count_pairs': 'Count adjacent token pairs, weighting each word by its corpus frequency.',
'apply_merge': 'Merge non-overlapping occurrences of one adjacent pair in a token sequence.',
'encode_bpe_word': 'Apply the learned BPE merges in order to a word and cache its pieces.',
'encode_bpe': 'Split text and concatenate each piece\'s BPE encoding.',
'get_batch': 'Sample input windows and their one-position-shifted targets; return two integer tensors.',
'head_weights': 'Compute a hand-designed causal attention pattern from the specified query/key projections.',
'sinusoidal': 'Build fixed sinusoidal position encodings with alternating sine and cosine dimensions.',
'input_gradient': 'Measure the input-gradient norm of a controlled block stack, with or without residual additions.',
'train_run': 'Run the specified block-stability experiment and return training losses and measured gradient norms.',
'generate': 'Generate additional characters autoregressively from the prompt; return the prompt and continuation.',
'val_loss': 'Average loss on the fixed validation batches without gradients, then restore training mode.',
'lr_at': 'Compute the warmup/cosine learning rate at a zero-based training step.',
'next_distribution': 'Return last-position vocabulary logits for the prompt\'s retained context.',
'loss_by_position': 'Average validation cross-entropy by position; targets differ between positions, so this is not a controlled context ablation.',
'attention_weights': 'Recompute causal attention weights for one selected block and input line.',
'quality': 'Measure training-vocabulary word coverage and distinct 8-character spans; neither measures factuality.',
}
CLASSES = {
'MLP': 'Flattened-image MLP with a learned hidden representation and a classification head.',
'SmallCNN': 'Two convolution/pooling stages followed by the dense head traced in the lesson.',
'BagOfEmbeddings': 'Masked-mean word embeddings followed by a binary sentiment-logit head.',
'RNNWrap': 'Expose a recurrent layer\'s sequence output through the shared probe interface.',
'SeqClassifier': 'Embed a sequence and classify from its final recurrent hidden state.',
'TinyAttention': 'Let the last input position attend directly to all input positions for the gradient probe.',
'ImageEncoder': 'Project CNN features into a unit-length image vector in the shared space.',
'TextEncoder': 'Average word embeddings and project into a unit-length text vector in the shared space.',
'MLPEncoder': 'Expose the MLP\'s 128-feature encoder separately from its classification head.',
'CNNEncoder': 'Expose the CNN\'s 64-feature encoder separately from its classification head.',
'TinyTransformer': 'Ready-made PyTorch attention blocks assembled into the introductory character model.',
'CausalSelfAttention': 'Projected multi-head self-attention with a causal mask and output projection.',
'FeedForward': 'Shared per-token nonlinear network expanding model width by four and projecting back.',
'Block': 'Attention and feed-forward sub-layers with normalisation and residual additions.',
'TinyLM': 'Small language model used in the norm-placement and residual-connection experiments.',
'GPT': 'Character-level decoder-only Transformer returning vocabulary logits and optional next-token loss.',
}
PARAMS = {
 'img_enc': 'Image encoder producing shared-space unit vectors.',
 'txt_enc': 'Text encoder producing shared-space unit vectors.',
'd_model': 'Feature width of each token vector.', 'n_heads': 'Number of attention heads; divides model width.',
'n_layers': 'Number of Transformer blocks.', 'context': 'Maximum input-window length in tokens.',
'vocab_size': 'Number of token IDs represented by the embedding table.', 'dim': 'Learned vector width.',
'pre_norm': 'Whether to normalise sub-layer inputs before their residual additions.',
'residual': 'Whether to retain the residual additions in this controlled experiment.',
'return_weights': 'Whether to return attention weights alongside the output vectors.',
'ids': 'Integer token IDs, usually shaped (batch, tokens).',
'targets': 'Optional next-token integer targets aligned with the input positions.',
'causal': 'Whether to prevent attending to future positions.',
'texts': 'Caption strings, containing words from the teaching vocabulary.',
'forget_bias': 'Optional value assigned to each of the two LSTM forget-gate bias slices.',
'cell': 'The recurrent PyTorch layer whose sequence outputs are exposed.',
'kind': 'The model or mask family selected in the surrounding example.',
'd': 'Input vector width (or sinusoidal feature width in sinusoidal).', 'h': 'Projected attention width.',
'f': 'Cached gzip filename.', 'name': 'Key selecting the cached IDX file.',
'path': 'Path of the cached gzip file.', 'offset': 'Bytes to skip before reading array values.',
'F_train': 'Fixed representation rows used to fit the probe.', 'y_train': 'Training class labels.',
'F_val': 'Held-out representation rows.', 'y_val': 'Held-out class labels.',
'Fm': 'Matrix containing one feature vector per image.', 'train_idx': 'Indices used to fit the probe.',
'eval_idx': 'Indices used only to score the fitted probe.',
'row': 'Zero-based pixel row.', 'col': 'Zero-based pixel column.', 'width': 'Grid width in pixels.',
'X': 'Image/input tensor for the experiment.', 'X_': 'Input tensor to encode in batches.',
'Xv': 'Validation input tensor.', 'y': 'Class labels aligned with the input examples.',
'yv': 'Validation class labels.', 'bs': 'Number of examples per processing batch.',
'batch_size': 'Number of windows sampled per batch.', 'B': 'Number of examples in a contrastive batch.',
'epochs': 'Number of complete training passes.', 'lr': 'Learning rate.', 'peak_lr': 'Peak learning rate.',
'seed': 'Random seed for this experiment.', 'seeds': 'Initialisation seeds to average over.',
'verbose': 'Whether to print progress.', 'snapshots': 'Optional list receiving copied epoch weight dictionaries.',
'steps': 'Number of optimiser updates.', 'warmup': 'Number of initial learning-rate warmup steps.',
'schedule': 'Whether to use the warmup/cosine schedule rather than a constant rate.',
'clip': 'Threshold for the combined gradient norm.', 'eval_every': 'Interval between validation measurements.',
'size': 'Input length along one spatial axis.', 'kernel': 'Filter width along this axis.',
'padding': 'Padding added on each side.', 'stride': 'Distance between filter starting positions.',
'layers': 'Controlled sequence of spatial layers.', 'w': 'Weight tensor or selected vocabulary word, as defined in this helper.',
'tokens': 'Ordered token strings to encode.', 'word': 'Vocabulary word, or tuple of BPE pieces in the merge helpers.',
'text': 'Input text string.', 'text_': 'Input line to inspect.', 's': 'Text string to encode or split.',
'a': 'First vector.', 'b': 'Second vector.', 'table': 'Embedding weight matrix indexed by vocabulary ID.',
'token_lists': 'A list of variable-length token sequences.', 'k': 'Number of neighbours, or unit index in unit_summary.',
'top': 'Number of highest-activation images used in the unit summary.',
'xs': 'Input-vector sequence in temporal order.', 'T': 'Sequence length, or text-vector batch in contrastive_loss.',
'S': 'Source-sequence length for the cross-attention grid.',
'make_model': 'Factory creating a fresh model for each probe seed.', 'n': 'Number of synthetic examples.',
'template': 'Caption template containing a class-name slot.', 'I': 'Unit-length image-vector batch.',
'scale': 'Similarity multiplier before the contrastive softmax.',
'gen': 'Seeded generator for image/caption sampling.', 'generator': 'Seeded generator for sampling.',
'query': 'Text query to encode and compare with cached image vectors.',
'qi': 'Index of the query image in the feature matrix.', 'queries': 'Query-image indices.',
'vocab': 'Word-piece tuples mapped to corpus frequencies.', 'pair': 'The adjacent token pair to merge.',
'cache': 'Dictionary memoising a word\'s pieces for the current learned merges.',
'data': 'One-dimensional integer corpus tensor.', 'split': 'Training or validation corpus selector.',
'Wq': 'Hand-designed query-projection matrix.', 'Wk': 'Hand-designed key-projection matrix.',
'n_pos': 'Number of position vectors to construct.', 'depth': 'Number of stacked blocks.',
'model': 'Model being trained, evaluated or inspected.', 'm': 'Model being evaluated.',
'prompt': 'Nonempty known-character text prefix.', 'n_new': 'Number of new characters to append.',
'temperature': 'Positive logit divisor; zero selects greedy decoding in this implementation.',
'top_k': 'Optional number of highest-scoring candidate tokens to retain.',
'top_p': 'Optional cumulative-probability threshold for nucleus sampling.',
'step': 'Zero-based optimiser update index.', 'peak': 'Peak learning rate.',
'layer': 'Zero-based Transformer block index.', 'sample': 'Generated text including its prompt.',
'prompt_len': 'Number of initial characters excluded from generation metrics.',
'pa': 'First classifier\'s predicted class indices.', 'pb': 'Second classifier\'s predicted class indices.',
'pred_a': 'First classifier\'s predicted class indices.', 'pred_b': 'Second classifier\'s predicted class indices.',
}


def docstrings(nb):
    """Build validated documentation entries for every named helper in this notebook."""
    docs = {}
    for cell in nb.cells:
        if cell.cell_type != 'code':
            continue
        for name, node in find_defs(cell.source):
            short = name.split('.')[-1]
            cls = name.split('.')[0]
            if isinstance(node, ast.ClassDef):
                docs[name] = CLASSES[short]
                continue
            if short == '__init__':
                summary = 'Create the components of this model; the forward computation is traced in the lesson.'
            elif short == 'forward':
                summary = CLASSES[cls]
            else:
                summary = SUMMARIES[short]
            params = node.args.posonlyargs + node.args.args + node.args.kwonlyargs
            lines = []
            for arg in params:
                if arg.arg in ('self', 'cls'):
                    continue
                description = PARAMS.get(arg.arg)
                if arg.arg == 'x':
                    description = ('Integer token-ID batch shaped (B, T).' if cls in ['SeqClassifier', 'BagOfEmbeddings']
                        else 'Floating-point tensor; image models use (B, C, H, W), token-vector models use (B, T, D).')
                assert description, (name, arg.arg)
                lines.append(f'    {arg.arg}: {description}')
            if node.args.kwarg:
                lines.append(f'    **{node.args.kwarg.arg}: Recurrent-classifier options forwarded to SeqClassifier.')
            docs[name] = summary + ('\n\nArguments:\n' + '\n'.join(lines) if lines else '')
    return docs
