"""Section checkpoints aligned to the author's replacement Module 5/6 notes.

Each row is question | correct answer | misconception | second misconception.
The correct answer also supplies a short, concrete feedback explanation.
"""
ROWS = {
'5.1': '''
What does a representation describe?|An example in features useful for a task.|Only the example's class name.|The optimizer's learning rate.
Why split a network into an encoder and a head?|The encoder builds features and the head maps them to task outputs.|Only the head receives gradients.|The encoder always needs fewer layers than the head.
Why keep representation-learning images separate from validation images?|Validation must measure performance on examples unseen during fitting.|The image dimensions differ between the sets.|Only the classifier can leak validation information.
How does a hierarchy reuse features?|Later layers combine earlier features into more complex patterns.|Every layer must rediscover all raw features independently.|A deeper layer necessarily contains human-readable object labels.
An encoder helps a probe with only 100 labels. What must we still report?|The data and labels used earlier to train the encoder.|Only the 100 probe labels, since earlier training is free.|Only the feature-vector length.
''',
'5.2': '''
What is shared when a convolution filter moves?|Its weights are reused at different spatial positions.|All feature-map values become identical.|Each position receives an unrelated filter.
What is the PyTorch shape for 16 RGB images of size 224 by 224?|(16, 3, 224, 224).|(16, 224, 224, 3).|(3, 224, 224, 16).
What is the disadvantage of a flattened input to a dense layer?|The layer lacks built-in spatial locality and weight sharing.|Flattening deletes pixel values.|The vector cannot be reshaped back to an image.
What must remain consistent between the encoder and classifier?|The flattened feature width must match the head's input width.|The class count must equal the number of convolution filters.|The image height must equal the batch size.
Why can an edge-like filter respond weakly to a uniform patch?|Its positive and negative weights can cancel on uniform brightness.|It has no parameters.|Every convolution automatically subtracts the image label.
What does increasing stride usually do?|It evaluates the filter at fewer positions, reducing spatial resolution.|It guarantees higher accuracy.|It adds more input channels.
How can a small receptive field support whole-image classification?|The head combines outputs from locations across the final feature maps.|Every first-layer unit sees the entire image.|Pooling adds missing label information.
Which set should choose the best training epoch?|Validation; the final test set remains reserved for evaluation.|The final test set, because it is the largest available score.|Whichever set gives the highest accuracy.
Does a balanced filter prove that it detects a specific object part?|No; inspect responses across inputs before assigning it a meaning.|Yes; a near-zero weight sum proves it detects heels.|Yes; all learned filters represent one class each.
''',
'5.3': '''
Which step makes token vectors learn useful task information?|Training the embedding parameters through an objective.|Assigning larger IDs to important words.|Alphabetically sorting the reviews.
Why are character codes poor semantic measurements?|Their numerical relationships encode symbols, not semantic similarity.|Characters have no numerical encoding.|All words have the same spelling.
Which reviews should define the vocabulary?|Training reviews, with an explicit policy for unseen validation tokens.|All reviews, including the final test set.|Only the reviews the model predicts correctly.
What is the dot product of two distinct one-hot vectors?|Zero; their nonzero entries occupy different coordinates.|One, because both represent words.|Their token IDs multiplied together.
Why does embedding lookup equal one-hot times a table?|The one nonzero entry selects the corresponding table row.|Both operations average every vocabulary row.|The table is fixed and cannot learn.
Does an individual embedding coordinate have to mean one named concept?|No; useful distinctions can be distributed across coordinates.|Yes; coordinate zero always means sentiment.|Yes; every coordinate is a dictionary definition.
What does cosine similarity ignore?|Vector length; it compares directions.|The angle between the vectors.|Every negative coordinate.
What distinguishes a contextual representation?|Its vector depends on surrounding tokens.|Its token ID changes every time the model runs.|Its vocabulary must contain whole sentences.
What does the sentiment versus skip-gram comparison demonstrate?|Different training objectives and setups can produce different useful geometries.|The objective is the only differing factor in these experiments.|Context-trained vectors must separate positive and negative words.
''',
'5.4': '''
Why do averaged word embeddings fail on reversed word order?|Averaging the same vectors gives the same result regardless of order.|The embedding vocabulary has no integers.|Reversing tokens changes every vector's length.
What changes from one RNN step to the next?|The hidden state; the update weights are shared.|Every step has entirely unrelated weights.|The hidden-state width grows by one per token.
Why is a long-range memory task harder for a basic RNN?|The learning signal passes through many recurrent transformations.|The correct first-token label changes with length.|The network is forbidden to process long tensors.
What makes an LSTM's memory path useful?|Learned gates can preserve cell-state information across steps.|The cell state always retains everything perfectly.|PyTorch fixes every forget gate at exactly one.
Which limitation remains even with good recurrent memory?|Hidden states still depend on sequential computation.|The model loses all ability to represent order.|The optimizer cannot update recurrent weights.
What does attention provide to a distant token?|A direct weighted path to relevant values, subject to the mask.|Guaranteed perfect memory for any sequence length.|A free operation whose cost never grows with context.
''',
'5.5': '''
Do independently trained image and text vectors align merely because their widths match?|No; equal width permits arithmetic but does not establish alignment.|Yes; matching width guarantees shared semantics.|Yes; normalising alone learns image-caption matches.
What do the projection layers accomplish?|They map encoder outputs into a shared coordinate space learned jointly.|They remove the need to train the encoders.|They turn similarities into calibrated class probabilities.
Why do same-class captions create false negatives in the toy loss?|The diagonal-only objective treats other valid same-class matches as negatives.|The images have no training labels.|The softmax omits its diagonal.
Why is the toy model's known-class classification not evidence of unseen-class zero-shot transfer?|Its training captions explicitly supplied those class names.|It has no conventional classifier head.|Its vectors are normalised.
Why cache the image vectors for retrieval?|Queries can rank stored vectors without re-encoding every image.|Caching makes the text encoder unnecessary.|Caching guarantees every result is correct.
''',
'5.6': '''
Why use the same downstream probe family across representations?|It helps compare how accessible task information is in each representation.|It guarantees every encoder has equal training cost.|It proves one representation is best for all tasks.
What does similar k-NN accuracy before and after t-SNE establish?|Some class information remains useful; individual neighbour preservation needs a separate metric.|Every pairwise distance is preserved.|The t-SNE model can place unseen points without fitting again.
What determines whether a representation is useful?|The task, data, training objective, architecture and evaluation evidence.|Its vector length alone.|How neatly its 2D clusters are separated.
''',
'6.1': '''
What does a Transformer block return for each input token?|A vector enriched by permitted context, with the same model width.|A new vocabulary containing every sentence.|Only one vector for the entire training dataset.
Which computation can causal Transformer training parallelise?|Predictions at known input positions in a training window.|Every future generated token before any is chosen.|All training updates without waiting for earlier updates.
What is the final axis of language-model logits?|One score per vocabulary entry.|One score per training epoch.|One score per attention head only.
Which component exchanges information between token positions?|Attention; the feed-forward network processes each resulting token vector separately.|The per-token feed-forward network alone.|The vocabulary's numerical IDs.
What distinguishes ordinary encoder and decoder self-attention?|Bidirectional versus causally restricted access to input positions.|Encoders have no embeddings.|Decoders cannot represent input context.
What does each residual sub-layer add?|A computed update to the existing token-vector stream.|A new token ID to the vocabulary.|An extra sequence position at every layer.
What is pre-norm?|Normalising the input of a sub-layer before adding its output to the residual stream.|Normalising the labels before tokenisation.|Removing every residual connection.
How does a Vision Transformer obtain patch tokens?|Flatten each patch and project it into the model's vector width.|Treat the full image label as every patch embedding.|Apply text token IDs directly to pixel values.
''',
'6.2': '''
Why split continuous text before sampling training windows?|It prevents overlapping windows from crossing the train-validation boundary.|It guarantees validation loss will equal training loss.|It removes the need for a causal mask.
Can this character-based BPE encode an unseen character automatically?|No; fallback is limited to known characters unless another policy is provided.|Yes; every character vocabulary contains all Unicode characters.|Yes; merging creates any missing character at inference.
Which model components grow with vocabulary size?|The token embedding table and vocabulary output head.|Only the number of Transformer blocks.|Only the context window.
What does a 64-token context limit?|How many recent input tokens this model receives for a prediction.|The total length of every text it can ever generate.|The number of model parameters.
How should next-token targets align with inputs?|Target at position t is the token following input at t.|Targets should equal inputs at the same positions.|Targets should be the preceding tokens.
''',
'6.3': '''
What does an attention weight express in this layer?|How much of a value vector is mixed into a query's output.|Proof of a human-readable causal explanation.|The probability that the whole sentence is factually true.
Why cannot independent per-token layers alone build context?|No information travels between positions through those layers.|Linear layers cannot take tensors.|The vocabulary must contain all possible phrases.
What is the attention pipeline?|Project Q/K/V, score, scale, mask if needed, softmax, mix values.|Average token IDs and then add labels.|Apply softmax only after choosing the final word.
Which vectors are compared to form attention scores?|Queries against keys; values supply the mixed content.|Values against labels; queries are never used.|Token IDs against position indices.
What is the shape of one head's score grid for T tokens?|T by T, one query-key score per pair.|T by vocabulary size in every layer.|Only one scalar for the whole input.
Why divide dot products by the square root of head width?|It controls score scale and reduces premature softmax saturation.|It makes every attention weight identical.|It guarantees that gradients can never vanish.
What does a row of attention weights do to the values?|It forms a weighted sum of value vectors.|It selects the class labels from the dataset.|It replaces all values with token IDs.
Where should a causal mask act?|Before softmax, excluding future key positions.|After the optimizer has updated the weights.|Only on the training labels.
Where is the model width split into heads?|After learned Q/K/V projections, so each head receives its projected subspace.|Before any projection, permanently hiding all other input coordinates from a head.|Only after the vocabulary output head.
What does unmasked attention without positional information do under a token permutation?|Its output vectors are permuted in the same way: equivariance.|Its output sequence is necessarily identical at every position.|It recovers the original order automatically.
What happens to a dense attention score grid when sequence length quadruples?|It has sixteen times as many entries.|It has four times as many entries.|It keeps the same number of entries.
Why compare the hand-written attention with PyTorch's implementation?|Agreement on the same Q/K/V and mask is a useful implementation check.|It proves that an untrained model understands language.|It makes evaluation data unnecessary.
''',
'6.4': '''
Why keep a block's input and output shapes equal?|The residual additions and stacking need compatible vector shapes.|It forces every token vector to remain unchanged.|It makes attention weights independent of the input.
What is attention's role within the block?|Gather information from permitted token positions.|Change token IDs into class names.|Apply a distinct optimizer to every word.
How are feed-forward weights used across positions?|The same small network processes each token vector separately.|Every position receives unrelated feed-forward weights.|The FFN directly mixes all token positions.
Why do residual additions help optimisation?|They provide a direct identity path in addition to the transformed branch.|They force gradients to equal one everywhere.|They eliminate every possible training instability.
What does LayerNorm normalise in this model?|Coordinates within each token vector, before learned scale and shift.|All tokens and examples together as one vector.|Only the class labels.
What does the pre-norm versus post-norm experiment support?|Stability depends on norm placement together with the specified learning rate and warmup.|Post-norm models can never train.|Pre-norm removes the need to choose a learning rate.
Why can depth add useful computation?|Later blocks process representations already contextualised by earlier blocks.|Each layer simply repeats the exact same token vector.|Every extra block guarantees better validation loss.
''',
'6.5': '''
What completes the language model after the stack of pre-norm blocks?|A final norm and a projection to vocabulary logits.|A label lookup that bypasses the blocks.|A new tokenizer learned during each forward pass.
For input shape (4, 64), vocabulary 65, what is the output shape?|(4, 64, 65).|(4, 65).|(65, 64, 4).
Why is log(vocabulary size) a useful initial-loss reference?|It is the cross-entropy of uniform predictions, a diagnostic rather than an exact requirement.|Every random initialisation must produce exactly that loss.|It is the minimum possible training loss.
What should changing token 40 do in a correctly causal model?|Leave logits at positions 0 through 39 unchanged.|Change all earlier logits because training is parallel.|Leave the logits at every position unchanged.
Where do cross-attention keys and values come from in an encoder-decoder?|The encoded source sequence; queries come from the decoder.|Only future target tokens.|The optimizer's state dictionary.
''',
'6.6': '''
What differs between the training and generation loops?|Training uses known histories and updates weights; generation chooses tokens from its evolving history.|Generation updates weights after every output token.|Training must sample its own history at every position.
Why is next-token prediction self-supervised?|The text supplies the targets without separately annotated labels.|The model never uses a loss.|Validation data supplies every training target.
What happens if targets are accidentally identical to inputs?|A causally masked model can learn an easy copying task.|The model necessarily learns better language modelling.|The causal mask will automatically correct the targets.
Why compare validation loss with a bigram baseline?|It checks whether a complex model adds value beyond one-token context.|It proves generated statements are factual.|It guarantees a human evaluator will prefer every sample.
Why does teacher forcing permit parallel training predictions?|All input histories are known, with future visibility blocked by the causal mask.|The model has already generated every correct answer.|Causal attention allows reading the next target token.
What does gradient clipping at norm 1 do?|Rescale gradients only when their combined norm exceeds 1.|Force every gradient coordinate to be exactly 1.|Guarantee that validation loss decreases at each step.
Does a flat loss-by-position curve prove that all longer context is ignored?|No; test the same target tokens under controlled history truncations.|Yes; attention heads beyond that position must be inactive.|Yes; it establishes a universal context limit for Transformers.
Which prediction is used to append a new generated token?|The vocabulary distribution at the last input position.|The highest score from every position concatenated together.|The first position's token ID.
Does greedy decoding guarantee factual answers?|No; it picks the most likely next token and can still be wrong or repetitive.|Yes; randomness is the only cause of false statements.|Yes; a high training-vocabulary word score proves truth.
Why use both evaluation mode and no-grad inference?|Evaluation mode controls relevant layers; no-grad disables gradient tracking.|They are two names for the same operation.|Evaluation mode updates the model from generated text.
''',
}


def questions(lid):
    """Return one reviewed checkpoint per numbered source section."""
    result = []
    for line in ROWS[lid].strip().splitlines():
        prompt, correct, *wrong = line.split('|')
        result.append(dict(q=prompt, options=[correct, *wrong], answer=0, why=correct))
    return result
