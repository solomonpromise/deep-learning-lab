"""Learner-facing documentation for the replacement notebooks' named helpers."""
import ast,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from dlp.docstrings import find_defs
SUMMARIES={
'load_imdb_split':'Load the declared IMDb revision, remove exact duplicates and construct the seeded course splits.',
'fingerprint':'Hash sorted texts to identify membership; this does not check row order or labels.',
'ordered_fingerprint':'Hash ordered text/label pairs to verify alignment for paired comparisons.',
'benchmark_clock':'Read elapsed time after synchronising any queued CUDA work.',
'ensure_comparison_results':'Restore missing author reference artifacts while preserving existing learner-generated results.',
'dedup':'Keep the first occurrence of each exact text not already in the supplied seen set.',
'pipeline_predict':'Run the sentiment pipeline and return binary predicted class indices in input order.',
'bank_vectors':'Extract the contextual vector for the token bank at the embedding stage and each encoder layer.',
'mean_cos':'Average pairwise cosine similarity between the supplied sentence groups at one layer.',
'tfidf_predict':'Fit TF-IDF and logistic regression on the selected training reviews; predict the declared evaluation texts.',
'BagOfEmbeddings':'Classify a review by masked averaging of trainable token embeddings followed by a linear head.',
'scratch_predict':'Train the small embedding model from scratch; select its epoch on the separate selection set.',
'to_tensor':'Encode texts using the local training vocabulary, truncate and pad into integer rows.',
'sign_test':'Test paired correctness disagreements under equal probability of either method alone being correct.',
'tokenize':'Tokenise a text batch under the explicitly declared truncation policy.',
'padded_tokens':'Count processed tokens after padding each ordered batch to its longest example.',
'time_per_review':'Measure average elapsed time per review for the specified order and batching policy.',
'positive_prob':'Return the sentiment model probability assigned to positive, restoring original input order.',
'generate':'Generate continuation tokens under the declared decoding settings and return decoded new text.',
'repeated_trigram_share':'Measure repeated three-word sequences in this generated sample; this is not a general quality metric.',
'embed':'Mean-pool nonpadding token vectors and return unit-length sentence vectors.',
'image_vectors':'Preprocess Fashion-MNIST images, apply the CLIP image encoder and normalise projected features.',
'text_vectors':'Encode candidate descriptions with CLIP and normalise the projected text features.',
'review_likeness':'Return similarity to the nearest reference review; use this as a validated heuristic rather than a guarantee.',
'SentimentService':'Wrap sentiment inference with per-input validation, an out-of-domain heuristic and confidence abstention.',
'check':'Return a rejection reason for invalid input, or None for a permitted text.',
'predict':'Run the declared model or service and return predictions in the original example order.',
'logits_for':'Tokenise a text batch and return float32 CPU logits without tracking gradients.',
'weight_bytes':'Count the storage occupied by tensors in this state dictionary under their actual dtypes.',
'quantize_linear_weights':'Simulate per-row int8 rounding of linear weights and estimate the corresponding packed storage.',
'p_positive':'Compute the candidate model score for positive under the explicitly declared label mapping.',
'head_tail':'Fit each review into the declared token budget, retaining its first quarter and last three quarters.',
'ask':'Format the truncated review as a sentiment question using the instruction model interface.',
'features':'Extract masked mean-pooled features from the frozen encoder without parameter updates.',
'word_guessing_loss':'Measure masked-word loss after loading the body; the output projection remains tied to input embeddings.',
'normalise':'Normalise case, punctuation and spacing for a duplicate audit; this is separate from the exact-dedup split policy.',
'encode':'Keep the requested head, tail or head-and-tail tokens, add special tokens and pad the batch.',
'report':'Print accuracy, per-class recall and positive-class F1 for the declared predictions.',
'to_dataset':'Construct unpadded token-ID rows and integer labels for later dynamic batching.',
'metrics':'Calculate accuracy, both recalls and positive-class F1 under the binary label convention.',
'tfidf_rung':'Fit the declared TF-IDF representation and logistic regression; return fitted objects and elapsed time.',
'batches':'Group similarly sized examples and yield indices plus device-ready encoded batches.',
'sst2_predict':'Return SST-2 checkpoint class predictions in the original review order.',
'head_tail_ids':'Produce unpadded review token IDs with special tokens and the shared head-and-tail policy.',
'make_batch':'Use the padding collator to construct a device-ready input and optional-label batch.',
'LoRALinear':'Add a scaled trainable low-rank correction beside a frozen linear layer.',
'evaluate':'Score the declared validation subset using the restricted positive-versus-negative next-token comparison.',
'blockwise':'Simulate uniform symmetric blockwise quantisation and estimate storage; this is not an NF4 execution.',
'wilson':'Calculate a Wilson confidence interval for a binomial proportion under the stated normal quantile.',
'__init__':'Initialise the components and settings used by this model or service.',
'forward':'Compute this module\'s output from the input tensor without performing an optimiser update.',
}
PARAMS={
'seed':'Seed controlling the local split or sampling generator.','n_val':'Number of training-half reviews reserved for validation.','n_eval':'Size of the reproducible evaluation subset.','verbose':'Whether to print dataset audit counts.',
'texts':'Text strings in the order expected by the caller.','text':'One input text string.','sentence':'One sentence containing the target token.','review':'A movie review to classify or format.','labels':'Integer targets aligned with the input examples.',
'pred_a':'Predicted labels from the first method.','pred_b':'Predicted labels from the second method.','p_a':'Positive-class scores from the first method.','p_b':'Positive-class scores from the second method.',
'group_a':'First collection of sentence keys.','group_b':'Second collection of sentence keys.','layer':'Embedding-stage or encoder-layer index.',
'idx':'Indices selecting examples from the declared collection.','order':'Permutation describing processing order.','batch_size':'Maximum examples processed together.','size':'Requested batch size.',
'max_length':'Token budget including special tokens.','max_len':'Maximum encoded sequence length.','max_epochs':'Maximum full passes over the training examples.',
'model':'Model whose current parameters are used.','m':'Model or module being inspected or evaluated.','clf':'Fitted classifier or pipeline.',
'vocab_size':'Number of embedding-table rows.','dim':'Width of each token embedding.','x':'Input features or token IDs with the shape traced at the call site.','X':'Input example matrix.','y':'Targets aligned with the examples.','p':'Predicted binary classes.',
'C':'Inverse regularisation strength for logistic regression.','r':'Model repository ID or LoRA rank, as used at this call site.','base':'Frozen base linear layer.','alpha':'Scale numerator for the LoRA update.',
'invert':'Whether to reverse grayscale polarity before CLIP preprocessing.','prompt':'Text context supplied to the generator.','n':'Number of generated tokens or observations, as used by this helper.','words':'Maximum review words kept in the prompt.',
'bits':'Number of storage bits in the illustrative quantiser.','block':'Number of weights sharing one quantisation scale.','W':'Floating-point weight matrix to quantise.','body_state':'Body state dictionary loaded for the tied-output retention probe.',
'ids_list':'Unpadded integer token-ID sequences.','batch':'Dictionary or list of aligned batch fields.','strategy':'Explicit head, tail or head-and-tail truncation policy.',
'k':'Number of successful observations.','z':'Normal quantile used for the Wilson interval.','a':'First collection of paired predictions.','b':'Second collection of paired predictions.',
'seen':'Set of exact texts already retained.','t':'One text from the duplicate audit.','name':'Display label for the printed metric row.',
'classify':'Callable returning positive-class scores.','likeness':'Callable returning review-likeness scores.','ood_threshold':'Validation-selected cutoff for the review-likeness heuristic.','conf_threshold':'Validation-selected cutoff for answering confidently.','max_chars':'Maximum accepted input length in characters.','notes':'Lesson IDs whose result files are required.',
}

def docstrings(nb):
    docs={}
    for cell in nb.cells:
        if cell.cell_type!='code':continue
        for qual,node in find_defs(cell.source):
            short=qual.split('.')[-1];summary=SUMMARIES[short]
            if isinstance(node,ast.ClassDef):docs[qual]=summary;continue
            args=[a.arg for a in node.args.posonlyargs+node.args.args+node.args.kwonlyargs if a.arg not in ['self','cls']]
            descriptions=dict(PARAMS)
            if 'LoRALinear' in qual:descriptions['r']='Inner rank of the trainable low-rank update.'
            if short=='wilson':descriptions['n']='Total number of binomial observations.'
            if short=='generate':descriptions['n']='Maximum number of continuation tokens to generate.'
            lines=[f'    {a}: {descriptions[a]}' for a in args]
            if node.args.kwarg:lines.append(f'    **{node.args.kwarg.arg}: Explicit settings forwarded to the operation described above.')
            docs[qual]=summary+('\n\nArguments:\n'+'\n'.join(lines) if lines else '')
    return docs
