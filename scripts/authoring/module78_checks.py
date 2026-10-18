"""One content-specific checkpoint for every numbered replacement section."""
ROWS={
'7.1': '''
What changes between the pretrained and random-weight twins?|Learned parameter values, with architecture and tokenizer fixed.|The task labels.|The number of input reviews.
What is downstream adaptation?|Training for a target task after pretraining.|Downloading configuration alone.|Evaluating on training data only.
What makes a representation contextual?|Its output depends on surrounding tokens.|Every token gets a new vocabulary ID.|Its coordinates have guaranteed named meanings.
Can a newly attached random task head be trusted immediately?|No; the new head needs appropriate training.|Yes; the body makes every head trained.|Only if its logits are large.
What does the baseline comparison establish?|Results for these models, data budgets and settings.|Pretrained models always win.|Traditional ML is always better.
What does configuration specify?|The architecture and relevant model settings.|All learned parameter values.|A guarantee of task accuracy.
Why pin a checkpoint revision?|To identify the exact artifact loaded.|To guarantee identical results on every device.|To avoid evaluating the model.
''',
'7.2': '''
What connects a Hub name to a working model?|Repository files, a local cache, and compatible libraries.|The model card alone.|A dataset label column alone.
What should a benchmark score on a card tell you?|Performance under its stated evaluation protocol.|Guaranteed accuracy on your inputs.|Permission to ignore limitations.
Why keep a model with its matching tokenizer?|Token IDs and preprocessing must match the learned interface.|All vocabularies assign identical IDs.|The tokenizer supplies learned model weights.
What does missing licence metadata establish?|The inspected field supplies no licence evidence; check publisher terms.|The model has no licence anywhere.|Commercial reuse is automatically permitted.
''',
'7.3': '''
Where should model selection start?|Task requirements and representative inputs.|The largest parameter count.|The most downloads alone.
Which output supports semantic search directly?|Comparable document and query embedding vectors.|Arbitrary integer token IDs.|An unrelated classification label.
Does parameter storage equal total runtime memory?|No; activations, caches and runtime allocations also matter.|Yes, always.|Only for large models.
Why reproduce a card's benchmark then test your data?|To distinguish protocol differences from transfer to your task.|To tune on the final test set.|To make a card score universal.
What helps compare hosted and local inference?|Your measured quality, workload, cost and operational constraints.|Model size alone.|Assuming local inference is always cheaper.
''',
'7.4': '''
What connects raw text to a readable prediction?|Preprocessing, tokenization, model computation and output decoding.|The optimizer at inference.|A model card's prose alone.
What does the pipeline API bundle?|Task-specific preprocessing, inference and postprocessing.|Training on every request.|A guarantee of correct labels.
Why reproduce pipeline output explicitly?|To understand and control each inference stage.|To replace model weights with token IDs.|To avoid attention masks.
What does a padding mask prevent?|Reading padded positions as usable keys in attention.|All future access automatically in every model.|Truncation of every input.
Why use both eval mode and inference mode?|They control layer behaviour and gradient tracking separately.|They are interchangeable names.|Both update weights.
Why group similarly sized inputs?|To reduce padding work within batches.|To change the true labels.|To eliminate all batching latency.
What should be saved with the model?|Its tokenizer, configuration and relevant inference settings.|Only a screenshot of predictions.|Only the repository name with no revision.
''',
'7.5': '''
What turns a model capability into a usable feature?|Input validation, decision rules, failure handling and evaluation.|A larger confidence score alone.|Removing all uncertain inputs from reporting.
Does high confidence establish that an input is meaningful?|No; a model can be confident on nonsense.|Yes, above 0.99.|Only for English sentences.
What does temperature change?|The shape of the next-token probability distribution.|The model's learned weights at inference.|The input's ground-truth label.
Does high semantic similarity guarantee matching sentiment?|No; validate which distinctions a space preserves.|Yes, whenever cosine is positive.|Yes, for all sentence models.
What does zero-shot CLIP classification compare?|An image embedding with candidate text embeddings.|A generated caption's training loss.|Untrained task-head weights only.
Where should service thresholds be chosen?|Validation data matching the intended decision problem.|The final test after inspecting errors.|Whatever produces the nicest example.
Why report coverage with answered-case accuracy?|A service can raise conditional accuracy by answering fewer cases.|Coverage is the same as recall.|Abstention makes every remaining answer correct.
''',
'7.6': '''
What matters beyond notebook accuracy at deployment?|Latency, throughput, memory, reliability and workload.|Only the parameter count.|Only training loss.
Why report latency percentiles?|They reveal slower requests hidden by an average.|They remove queueing delays.|They guarantee throughput.
How should CUDA inference be timed?|Warm up and synchronise measurement boundaries or use CUDA events.|Time only the asynchronous launch.|Assume CPU timings apply.
What does parameters times bytes estimate?|Parameter storage under a declared dtype.|Peak memory of every training run.|GPU utilisation.
What does quantisation introduce?|A storage/computation trade-off with reconstruction error to evaluate.|Guaranteed faster inference.|Perfectly unchanged predictions.
How do response and KV caches differ?|They reuse whole responses versus internal attention keys and values.|They both update the weights.|They are training data stores.
What determines hosted versus local suitability?|Measured workload and operational constraints.|A universal rule that one is cheaper.|Whether the model is a Transformer.
What belongs in a reproducibility record?|Artifact revisions, settings, ordered data identity and environment.|The model name alone.|A seed with no other information.
''',
'7.7': '''
Why write requirements before comparing candidates?|To make acceptance criteria independent of attractive scores.|To guarantee one candidate wins.|To avoid evaluating representative inputs.
Why inspect training records and licence evidence?|They can reveal exposure or restrictions hidden by a score.|They replace task evaluation.|Missing metadata proves unrestricted use.
Why verify label mappings?|Models can use different label names, orders or neutral classes.|Every model uses index one identically.|A model's largest logit names its own class.
Where should settings be selected?|Validation data, with a declared final test for reporting.|Repeated final-test inspection.|Training accuracy alone.
Why keep a decision record?|To connect the choice to evidence, assumptions and failure cases.|To hide rejected candidates.|To guarantee future data never changes.
''',
'8.1': '''
What is the goal of adaptation?|Improve task suitability while measuring costs and retained abilities.|Change every parameter automatically.|Avoid baselines.
Which strategy leaves encoder weights fixed?|Feature extraction followed by a trained task head.|Full fine-tuning.|Updating LoRA matrices inside the encoder.
When should fine-tuning be considered?|When simpler measured approaches fail relevant requirements.|Whenever a pretrained model exists.|Before examining data quality.
What is trainable in full fine-tuning?|All selected model parameters, including the task head.|Only the tokenizer's vocabulary IDs.|Only the final prediction value.
What distinguishes overfitting from forgetting?|New-task generalisation can worsen while earlier capabilities are a separate concern.|They are the same measurement.|Forgetting is only a larger training loss.
How should an adaptation strategy be chosen?|By quality, data, compute and capability-retention requirements.|By trainable parameter count alone.|By assuming the newest method wins.
''',
'8.2': '''
What makes a dataset training-ready?|An explicit task, checked examples, honest splits and compatible preprocessing.|A large row count alone.|A public download link alone.
What do IMDb's polar labels mean?|Selection by low/high ratings; individual texts may mix opinions.|Every sentence has one unambiguous emotion.|All neutral language was removed.
Why inspect raw examples as well as counts?|Aggregates can miss labelling or content problems.|Counts are always wrong.|Manual inspection replaces held-out evaluation.
When should duplicate groups be handled?|Before splitting, with cross-split overlap checks.|After measuring final test accuracy.|Only after training.
How does classifier formatting differ from instruction formatting?|A class label versus a conversation with an answer target.|They require identical token sequences.|Instruction examples have no targets.
What should remain consistent across model comparisons?|The declared data protocol and ordered evaluation examples.|Only total row counts.|Different test reviews for every model.
Can a public checkpoint contaminate your evaluation?|Yes; upstream training and selection history can expose it.|No, if you personally held the data out.|Only when its architecture is identical.
Why is accuracy insufficient on imbalanced data?|A majority-only predictor may ignore the class you need.|Accuracy always equals positive recall.|F1 ignores errors completely.
How should a truncation strategy be chosen?|On validation with its information loss and compute cost stated.|By tuning on the final test.|By assuming the beginning always contains the answer.
What does a padding collator do?|Pads examples into compatible batch shapes and supplies masks.|Creates new ground-truth labels.|Deduplicates the dataset automatically.
''',
'8.3': '''
Why establish a baseline before adaptation?|To know whether added training delivers useful improvement.|To guarantee fine-tuning wins.|To avoid reporting costs.
Where should TF-IDF vocabulary be fitted?|Training data only.|Training plus test for more words.|Validation only after scoring.
What does zero IMDb labels mean for the off-the-shelf baseline?|No IMDb adaptation labels used here; upstream training still occurred.|The checkpoint was never trained.|Its labels are inherently correct.
What learns in a frozen-encoder linear probe?|The small downstream classifier, not the encoder.|Every pretrained weight.|The validation labels at inference.
Why save per-example predictions and ordered IDs?|To support correctly aligned paired comparisons.|To replace split checks.|To make test tuning acceptable.
''',
'8.4': '''
What makes fine-tuning familiar from earlier modules?|It uses a forward pass, task loss, backpropagation and optimiser updates.|It eliminates gradients.|It learns from final test labels.
Why does a fresh task head need training?|Its newly initialised parameters are not task-trained.|The pretrained body has no weights.|A task head cannot receive gradients.
What must labels and masks agree with?|The task output contract and real input positions.|The length of the model card.|The largest training loss.
What does cross-entropy consume here?|Raw class logits and integer class targets.|Already chosen labels alone.|Token IDs as probabilities.
What does gradient clipping at norm one do?|Rescales gradients exceeding the declared combined norm.|Sets every coordinate to one.|Guarantees a lower validation loss.
Why use a cautious learning rate?|To adapt useful pretrained weights without uncontrolled changes.|Small rates guarantee the best accuracy.|A larger head removes the need for validation.
How should a checkpoint be selected?|A declared validation criterion.|The best final-test score after repeated trials.|The smallest file alone.
Must Trainer and a custom loop give identical results?|No; ordering and implementation details can differ.|Yes, because they use the same architecture.|Only their model class matters.
What should a reload check establish?|Matching preprocessing, configuration and expected outputs.|That all future inputs will be correct.|That training data can be deleted without records.
''',
'8.5': '''
What does parameter-efficient adaptation aim to reduce?|Trainable updates and their associated costs.|All forward computation through frozen weights.|The need to evaluate quality.
What contributes to Adam training-state memory?|Weights, gradients and optimiser moments under stated dtypes.|Only saved adapter files.|Only input token IDs.
What does requires_grad false do?|Stops accumulating gradients for those parameters.|Removes their forward pass.|Makes them consume zero storage.
Why can a compact update be useful?|Task-relevant changes can sometimes be represented with fewer parameters.|Every real update is exactly rank one.|All pretrained matrices are low rank.
How does LoRA modify a linear computation?|A scaled low-rank update is added beside the frozen base.|The base is deleted.|The input mask becomes the weight matrix.
What are the usual initial LoRA factors?|A random A and zero B, giving a zero initial update.|Both factors zero and permanently stuck.|Both factors copied from the labels.
How do other PEFT methods differ?|They place small trainable components in different parts of the computation.|They all have the same runtime structure.|Every adapter can be merged identically.
Why count the classification head too?|It is trainable and saved alongside the adapter for this task.|It was trained automatically by the tokenizer.|It consumes no memory.
Does p equal one prove LoRA and full fine-tuning equivalent?|No; it does not establish equivalence or identical predictions.|Yes, for every future dataset.|It proves they share every mistake.
''',
'8.6': '''
What is the conceptual change in instruction tuning?|Train on task-oriented conversations and desired responses.|Replace next-token loss with accuracy.|Stop using causal prediction.
What does supervised fine-tuning use?|Examples with input instructions and desired responses.|Unlabelled logits only.|The final-test answers as training prompts.
Why use the model's chat template?|Its role and boundary tokens define the expected conversation interface.|Every model shares the same template.|It replaces model weights.
What does a target label of minus 100 do here?|Excludes that position from the loss.|Blocks attention to the token.|Deletes the token from input IDs.
Why shift logits and targets by one?|Position t predicts the next token.|The model predicts the previous token.|Padding needs a different class label.
What is trained in this LLM LoRA example?|The selected low-rank adapter parameters.|Every frozen base weight.|The tokenizer's vocabulary.
Is the uniform four-bit exercise an executed NF4 QLoRA run?|No; it illustrates quantisation arithmetic only.|Yes, NF4 means uniform int4.|Yes, because no gradients are stored.
Does a weight subtotal guarantee a GPU training fit?|No; measure the complete workload and runtime allocations.|Yes, with a fixed twenty-percent margin.|Only parameter count matters.
''',
'8.7': '''
What must be checked before combining result files?|Their provenance and aligned evaluation identities.|Only their filenames.|Only rounded accuracy values.
Does a lower training loss establish a better deployed model?|No; held-out quality and application constraints still matter.|Yes, for every task.|Only the final training batch matters.
What does an accuracy confidence interval describe?|Sampling uncertainty under its stated assumptions.|All variation across training seeds and domains.|A guaranteed bound for every future request.
Why inspect error overlap?|Equal aggregate accuracy can hide different individual failures.|To choose training labels from test errors repeatedly.|To prove two models are equivalent.
Does one retention probe measure every old capability?|No; it tests a specific setup and requires careful interpretation.|Yes, if the loss rises.|Only the adapter file size matters.
What should a fair comparison disclose?|Data budgets, input policy, tuning budget, quality and costs.|Only the largest accuracy.|Only trainable parameter count.
What does repeated TF-IDF training on different samples measure?|Variation from those data draws, not every neural seed effect.|All possible deployment uncertainty.|A guarantee the next draw matches.
How should a keep-or-reject decision be made?|Using declared quality and operational requirements with uncertainty.|A universal p-value rule divorced from the application.|The model's novelty alone.
What follows further selection using the reported test data?|Evaluate the new choice on a fresh final test.|Keep calling the same sample untouched.|Replace uncertainty with more decimal places.
''',
}

def questions(lid):
    out=[]
    for line in ROWS[lid].strip().splitlines():
        prompt,correct,*wrong=line.split('|')
        out.append(dict(q=prompt,options=[correct,*wrong],answer=0,why=correct))
    return out
