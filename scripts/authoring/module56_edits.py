"""Reviewed accuracy edits applied to copies of the author's Day 5/6 notebooks.

The originals in notebook_sources/ are immutable snapshots. Experimental results
are refreshed separately after execution; no measurements are fabricated here.
"""
import re


def edit(lid, index, text, kind):
    """Apply the approved clarification for this source cell, preserving its purpose."""
    if kind == 'code':
        if lid == '5.3' and index == 43:
            return '''SG_DOCS = 15000
rng = np.random.default_rng(0)
docs = [np.array([i for i in encode(doc) if i > UNK], dtype=np.int64)
        for doc in train_tokens[:SG_DOCS]]
all_ids = np.concatenate(docs)
freq = np.bincount(all_ids, minlength=len(itos)) / len(all_ids)
WINDOW = 5
centre, context = [], []
tokens_kept = 0
for doc in docs:
    # Subsample inside each review, then form pairs inside that review only.
    keep = rng.random(len(doc)) < np.minimum(1.0, np.sqrt(1e-4 / np.maximum(freq[doc], 1e-12)))
    ids = doc[keep]
    tokens_kept += len(ids)
    for k in range(1, min(WINDOW, len(ids) - 1) + 1):
        centre.extend([ids[:-k], ids[k:]])
        context.extend([ids[k:], ids[:-k]])
centre = torch.tensor(np.concatenate(centre))
context = torch.tensor(np.concatenate(context))
print("reviews used:", SG_DOCS, "| window: up to", WINDOW, "words either side")
print("tokens kept after subsampling:", tokens_kept, "| (centre, context) pairs:", len(centre))'''
        return text

    # Seeds reduce variation; they do not promise exact equality on every laptop.
    text = text.replace('so that your numbers match the ones written in this note',
                        'to make repeated runs more consistent; small numerical differences across computers are normal')
    text = text.replace('so that your results match the numbers written here',
                        'to make repeated runs more consistent; small numerical differences across computers are normal')

    if lid == '5.1':
        text = text.replace('These are **dead units**: their weighted sum is negative for every input, so ReLU always outputs 0, and they contribute nothing.',
                            'These units are **inactive on this validation sample**: their pre-activation is non-positive for every example we checked, so ReLU outputs 0. This alone does not prove they are dead for every possible input.')
        text = text.replace('Why one layer is not enough: hierarchy', 'How deeper networks build a hierarchy')
        text = text.replace('the encoder is really using 114 units, not 128',
                            'only 114 units are active on this validation sample')
        text = text.replace('one twentieth of the labels', 'one twentieth of the downstream labels, after the encoder used its separate 40,000 labelled examples')

    if lid == '5.2':
        text = text.replace('In doing so it throws away the one thing that makes an image an image: which pixels sit next to which.',
                            'Flattening removes the explicit 2D layout, not the underlying pixel information. A dense layer must learn spatial relationships from data, while a CNN builds locality and weight sharing into its architecture.')
        text = text.replace('the network designed to keep that information',
                            'a network whose architecture explicitly uses spatial neighbourhoods')
        text = text.replace('the MLP never knew the order meant anything',
                            'the dense architecture has no built-in preference for the original image neighbourhoods')
        text = text.replace('explain, with evidence, why flattening an image loses information;',
                            'explain why flattening preserves pixel information but a dense layer lacks built-in spatial locality;')
        text = text.replace('Why Flattening Images Loses Spatial Structure', 'Flattening Images: Preserved Values, Lost Explicit 2D Layout')
        if index == 13:
            text = '''The pixel at row 10, column 10 lands at position 290. Its right-hand neighbour is at 291, but its equally close neighbour below is at 318.

**Flattening removes the explicit 2D layout, not the underlying pixel information.** Every value remains in a fixed order. If we know the original dimensions, we can reshape the vector and reconstruct the image exactly.

The disadvantage appears when this vector enters a **dense layer**. That layer gives each input position its own weights. It does not explicitly treat nearby pixels as neighbours or reuse a local detector across positions. It can learn spatial patterns, but must discover useful relationships from data, often with more parameters. A CNN builds locality and weight sharing into its architecture.

We can investigate this difference by applying one fixed random **permutation** of the pixel positions to every image. The experiment changes which pixels appear adjacent while preserving all values and their consistent identities: physical pixel positions still map to fixed vector indices.'''
        if index == 22:
            text = '''The original-pixel MLP was correct on 90 examples where the shuffled one was wrong; the reverse happened on 89. The paired binomial test returns p = 1: these observations provide no evidence of an accuracy difference under its null hypothesis. This does not prove exact equivalence.

A dense layer can accommodate a fixed pixel permutation by learning a correspondingly permuted set of input weights. The experiment illustrates its lack of a built-in spatial preference; it does **not** show that the model cannot learn spatial relationships. In Section 8 we compare this with a CNN's explicit local connections.

> **Key terms**
> - **Spatial structure:** the arrangement of pixels in two dimensions.
> - **Permutation:** a rearrangement of positions, applied consistently here.
> - **Paired sign test:** compare the cases on which exactly one classifier is correct, using a binomial test with probability 0.5 under equal accuracy. It concerns these fitted models on these evaluation examples, not variation across training seeds.

> **Check yourself 2.** Why did we apply the *same* permutation to every image, instead of a different random shuffle for each one?'''
        text = text.replace('an MLP treats an image as an unordered list', 'a dense MLP does not build in local spatial connections')
        text = text.replace('so flattening no longer throws away anything important',
                            'so the head combines learned local features; flattening itself still preserves every feature-map value')
        text = text.replace('The p-value of 1 says this split is exactly what a fair coin would produce: no evidence of any difference.',
                            'The p-value of 1 provides no evidence against equal accuracy in this paired comparison; it does not prove equivalence.')
        text = text.replace('The sign test confirms it is not chance:',
                            'The paired sign test gives strong evidence of a difference for these fitted models:')
        text = text.replace('A split that lopsided essentially never happens by luck.',
                            'Such an imbalance is very unlikely under the equal-accuracy null; repeat training seeds to assess training variability too.')
        text = text.replace('Training has clearly pushed the filters towards edge detection.',
                            'Training has pushed many filters towards balanced, contrast-sensitive weights. Balance alone does not prove that a filter detects a particular edge orientation.')
        text = text.replace('Deeper features are more **selective**:', 'On this one image, the deeper features are more **sparse**:')
        text = text.replace('An MLP would flatten it immediately, and we proved that this discards spatial structure:',
                            'An MLP flattens it immediately, preserving values but removing the explicit grid interface. Its lack of built-in locality is illustrated here:')
        text = text.replace('An MLP scored the same on shuffled and real pixels, proving it ignores spatial structure.',
                            'An MLP scored similarly after a fixed pixel permutation, illustrating its lack of a built-in spatial preference.')
        text = text.replace('Flattening discards which pixels are neighbours.',
                            'Flattening preserves values in a fixed order but removes the explicit grid layout; dense layers lack built-in local connections and weight sharing.')
        text = text.replace('Its first-layer filters became edge detectors without being told to',
                            'Many first-layer filters developed balanced, contrast-sensitive weights')

    if lid == '5.3':
        text = text.replace('which every modern language model uses',
                            'which are widely used by modern language models')
        text = text.replace('Same architecture, same vocabulary, same reviews; different objective, different geometry.',
                            'Both demonstrations use learnable embedding tables and the same vocabulary, but they are not an objective-only controlled experiment: sentiment uses 32 dimensions and 20,000 reviews, while skip-gram uses 50 dimensions and 15,000 reviews, with a different prediction head and training procedure. The results illustrate task-shaped representations; they do not isolate the objective as the only cause of every difference.')
        text = text.replace('depending purely on the training objective', 'under different training objectives and setups')
        text = text.replace('because pairs like ("the", "movie") appear constantly and teach very little.',
                            'because very frequent words dominate the pair counts. We build each window within one review, so the end of one review never becomes the context of another.')
        text = text.replace('These are essentially random,', 'These neighbours are less clearly related in meaning,')
        text = text.replace('In the skip-gram panel, all four groups form their own clusters.',
                            'In the skip-gram panel, family and negative words form clear groups, while positive and music words also show structure but partly overlap in this 2D projection. The full-dimensional cosine measurements provide the stronger comparison.')
        text = text.replace('were never pushed into any meaningful arrangement',
                            'received no direct supervision for general semantic similarity')
        text = text.replace('Static embeddings cannot tell the two meanings of "bank" apart, cannot see that "not" reverses "good", and cannot tell "dog bites man" from "man bites dog" if the vectors are simply averaged.',
                            'The lookup table alone cannot change the vector of "bank" with context. A model that simply averages these vectors also loses word order and struggles with negation. An order-aware model can instead build contextual representations from the same static starting vectors.')

    if lid == '5.4':
        text = text.replace('At the default starting point, the forget gate is 0.500: the LSTM keeps only half of its memory per step.',
                            'In this zero-logit illustration, the forget gate is 0.500, retaining half the old cell state per step along this direct path. Actual gates vary with the inputs, previous state, random weights and biases; PyTorch does not fix them all at exactly 0.5.')

    if lid == '5.6':
        text = text.replace('Both differences are real.',
                            'For these fitted classifiers, the paired tests provide strong evidence of accuracy differences on this validation sample; they do not establish that every retraining will have the same ranking.')
        text = text.replace('**t-SNE preserves local neighbourhoods very well**: who is next to whom survives the flattening.',
                            '**Here, t-SNE retains class information useful to k-NN.** Similar classification accuracy does not prove that the identities of individual neighbours are preserved. This is a transductive visualisation diagnostic: t-SNE was fitted to all 2,000 points before cross-validation, so this is not an estimate of performance on unseen points. To measure neighbour preservation directly, use neighbour overlap or trustworthiness.')
        text = text.replace('The neighbourhoods are stable:', 'The class-prediction scores are similar across these runs:')
        text = text.replace('- **Trust:** which points are near which; which items form a cluster.',
                            '- **Use as hypotheses:** local groupings that remain stable across settings; verify important neighbours in the full representation.')
        text = text.replace('which is better (0.846 against 0.783)',
                            'which exposes more class information for this full-dimensional k-NN diagnostic (0.846 against 0.783)')
        text = text.replace('t-SNE preserved neighbourhoods (0.841 against 0.846)',
                            't-SNE retained similar class-prediction scores in this transductive diagnostic (0.841 against 0.846)')

    if lid == '6.1':
        text = text.replace(' *(Extension)*', '')
        text = text.replace('*This section is optional background. The core ideas are unchanged; the details below are refinements you will meet in research papers and model documentation.*',
                            '*This section is included in class. It connects our teaching model to refinements used in research papers and model documentation.*')
        text = text.replace('Encoders cannot generate text, because during generation the future tokens do not exist yet.',
                            'An ordinary bidirectional encoder is not trained for the left-to-right autoregressive generation loop we build here. It can predict masked tokens, and encoder architectures can be adapted for other generation procedures; "encoder" does not mean that text generation is fundamentally impossible.')

    if lid == '6.2':
        text = text.replace('**no text is ever unknown**', '**every validation character is covered in this dataset**')
        text = text.replace('Nothing is ever unknown, because any word can always fall back to single characters.',
                            'An unseen word made from known characters can fall back to those characters. Our character-based vocabulary cannot encode a genuinely new character without an unknown-token or byte fallback.')
        text = text.replace('BPE gets most of the length reduction of words, with a small vocabulary and no unknown tokens,',
                            'BPE shortens sequences with a small vocabulary and no unknown tokens on this validation text,')
        text = text.replace('so with random sampling the model will almost never see exactly the same window twice.',
                            'and sampling is with replacement: repeated windows are possible and become increasingly likely over many training steps.')
        text = text.replace('a batch of shape `(32, 64)` therefore contains 2,048 next-token predictions',
                            'a batch of shape `(32, 64)` therefore contains 2,048 next-token predictions')

    if lid == '6.3':
        text = text.replace('| Permutation (order) invariance | Giving the same result, rearranged, whatever the input order. |',
                            '| Permutation equivariance | Permuting the input tokens permutes the output vectors in the same way, for unmasked attention without positional information. |')
        text = text.replace('That is why every Transformer adds positional information to its token embeddings.',
                            'Transformers generally supply position through learned vectors, sinusoidal encodings, or mechanisms inside attention such as RoPE. The causal mask also carries some ordering information, so the unmasked permutation argument does not apply unchanged to causal attention.')
        text = text.replace('it treats every input as an unordered bag of tokens,',
                            'unmasked attention is permutation-equivariant, while causal attention has only the ordering information supplied by its mask,')

    if lid == '6.4':
        text = text.replace('the difference between post-norm and pre-norm blocks, and show why it matters in training',
                            'the difference between post-norm and pre-norm blocks, and test how it matters in a specified training setup')
        text = text.replace('decides whether a deep model trains or collapses',
                            'can strongly affect training stability, together with the learning rate and warmup')
        text = text.replace('**pre-norm** avoids the problem in the first place', '**pre-norm** avoided this failure in our experiment')
        text = text.replace('Residual connections are not an optional refinement; they are what makes a deep Transformer trainable.',
                            'This experiment shows how important residual connections are for this deep stack and training budget; it does not prove that every non-residual architecture is untrainable.')
        text = text.replace('Whatever happens upstream, every sub-layer receives inputs at the same, predictable scale.',
                            'At initialisation this gives a predictable scale. After training, the learned per-coordinate scale and shift can change the output mean and standard deviation; they need not remain exactly 0 and 1.')

    if lid == '6.5':
        text = text.replace(' *(Extension)*', '')

    if lid == '6.6':
        text = text.replace('This is a healthy **generalisation gap**, not yet overfitting:',
                            'This is a **generalisation gap**. There is no observed validation upturn in this run, although that alone cannot rule out all overfitting:')
        text = text.replace('So our small model uses roughly the last ten characters well, enough for spelling, word endings and common short phrases, but it gains little from context further back. Exploiting long-range context requires more capacity and more training; that is a large part of what makes big language models big.',
                            'Loss improves rapidly over the first few positions and then levels off in this diagnostic. This is consistent with useful short context, but it does not establish that the model ignores everything beyond ten characters: different positions predict different targets and use different learned position vectors. A controlled context-length test should predict the same held-out target tokens with progressively truncated histories. Longer-range ability depends on the data, training, architecture and task.')
        text = text.replace('The model uses about the last ten characters well.',
                            'Its loss-by-position diagnostic improves most over the first few positions; this does not establish a ten-character effective-context limit.')
        text = text.replace('used about the last ten characters effectively,',
                            'showed lower loss at positions with more short-range context,')
        text = text.replace('**Greedy decoding** is accurate but repetitive;',
                            '**Greedy decoding** repeated familiar words in this experiment;')
        text = text.replace('**Raising the temperature** steadily trades correctness for variety:',
                            '**Raising the temperature** trades training-vocabulary word coverage for variety in these samples:')
        text = text.replace('For a factual answer you want something close to greedy; for creative writing, more variety. Chat assistants typically sample with a moderate temperature together with top-p.',
                            'Lower temperature can make outputs more repeatable; more sampling can increase variety. Neither greedy decoding nor a low temperature guarantees factual accuracy. Our "real words" score only checks membership in the training vocabulary: repeated familiar words can still form meaningless or false sentences. Choose a strategy using evaluations appropriate to the task, including factuality when it matters.')
        text = text.replace('**Real words:** the share of generated words that appear somewhere in the training text, a rough measure of correctness.',
                            '**Training-vocabulary words:** the share of generated words that appear somewhere in the training text. This measures vocabulary coverage, not factuality, grammaticality or meaning.')
    return text
