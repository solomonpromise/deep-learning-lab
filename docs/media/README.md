# Animated curriculum lessons

The 11 videos supplied in `Video Lessons` are integrated into the existing lesson flow. They are visual recaps after the relevant concepts have been introduced, rather than a separate video library. No original video or notebook was rewritten for this integration.

## Placement

| Animation | Duration | Lesson / section | Teaching purpose |
| --- | --- | --- | --- |
| How a neural network learns | 7:12 | 1.2 §10 | Recap forward pass, loss, backpropagation and updates |
| How a CNN learns | 2:46 | 5.2 §7 | Connect hierarchical features to the coming practical CNN |
| How networks learn from text | 2:31 | 5.3 §7 | Connect token identity, embeddings and cosine similarity |
| How an RNN learns | 2:48 | 5.4 §3 | Revisit hidden states and long-range gradients before gates |
| What is a Transformer? | 3:58 | 6.1 §7 | Recap the architecture and families; preview vision |
| Getting text ready | 3:34 | 6.2 §5 | Consolidate tokenization, positions, splits and shifted targets |
| Attention, step by step | 3:06 | 6.3 §7 | Follow the score-to-weight-to-value calculation |
| Masks, heads and positions | 2:59 | 6.3 §11 | Connect causal masking, head dimensions, positions and cost |
| The Transformer block | 2:26 | 6.4 §7 | Combine residuals, normalization, attention and feed-forward layers |
| Assembling a language model | 2:41 | 6.5 §5 | Recap the complete model, checks, weight tying and cross-attention |
| Training a Transformer | 2:54 | 6.6 §7 | Read training results before the generation section |

The supplied collection covers Modules 1, 5 and 6. No supplied file specifically teaches a Module 7 or 8 topic, so none is forced into those modules. The closing Film 8 preview refers to a film not supplied; the player note directs learners to existing generation material in 6.6 §8.

## Learner experience

- Inline, responsive native players with sound controls, full screen, playback speed and chapter links.
- Deliberate loading: no MP4 source is assigned until Play or a chapter/timestamp is selected. Posters load with the lesson; video does not autoplay.
- Playback pauses when its lesson section is hidden, the document is backgrounded, or another lesson video starts.
- One narrated film has reviewed speech captions and a timestamped transcript. Ten music-backed films have clearly labelled editorial visual guides and optional English guide subtitles. These descriptions are not presented as spoken transcripts. The full original on-screen text remains in each video.
- Plain text guides remain available without JavaScript. A direct video download/open link is the playback fallback.
- Short adjacent notes distinguish illustrations from measurements, causal from bidirectional context, and training fit from generalization. They clarify cosine geometry and head projections without modifying the original media.
- Estimated lesson time includes video duration. The AI tutor receives the existing section text as before; transcripts are displayed as their own learning resource.

## Source and hosting

`video-source-inventory.json` records source filenames, original hashes, codec/dimensions/duration and optimized-file hashes. Absolute source paths are retained only in the local preparation environment; the public inventory uses filenames.

Web files: H.264, yuv420p, AAC audio, 1920×1080, at most 30 fps, fast-start MP4. Total 181,228,306 bytes versus 753,862,800 source bytes (about 76% smaller). Transcoding changes compression and frame rate, not lesson content or duration. No MP4 is stored in Git.

Public media release, explicitly approved by the owner: [curriculum-videos-v1](https://github.com/solomonpromise/deep-learning-lab/releases/tag/curriculum-videos-v1). Application source publication is separate from this media release. All eleven uploaded assets were checked against SHA-256 digests reported by GitHub.

GitHub asset metadata identifies `video/mp4`; its redirected download endpoint may return `application/octet-stream`. The native browser player was tested against the actual public endpoint. Byte-range responses are verified separately; do not assume a release upload alone proves playback works.

The catalog `media/videos.json` is the canonical placement/chapters/teaching-context configuration. Each directory in `static/media/videos/` contains the actual-frame poster, reviewed `transcript.json`, and WebVTT track. `text_kind` distinguishes narration from a visual guide.

## Build and preview

```sh
python scripts/build.py                 # auto: local optimized media if present, else public URLs
DLP_MEDIA_MODE=remote python scripts/build.py  # verify published URLs even on the authoring machine
DLP_MEDIA_MODE=local python scripts/build.py   # require local optimized MP4 files
python scripts/build.py --serve --port 8815   # preview with byte-range seeking support
PYTHONPATH=scripts python -m unittest discover -s scripts/media -p 'test_*.py' -v
```

Use the provided preview server for local MP4 seeking. A generic `python -m http.server` does not implement byte ranges. The preview server uses concurrent requests and supports single byte ranges; public hosting handles production delivery.

A clean CI build has no `.local-media/` files and uses stable public release URLs automatically. Captions and posters are shipped with the app, so they remain under the same origin as the lesson. No external player SDK, API key, tracking player or account is required.

## Reproducing optimized assets

Use an isolated media environment, separate from the site build requirements. The authoring environment used `imageio-ffmpeg==0.6.0`, `faster-whisper==1.2.1`, `ctranslate2==4.8.3`, `av==19.0.2` and `numpy==2.5.4`. Build dependencies also include Pillow. `prepare_videos.py` decodes audio through FFmpeg into a NumPy array, avoiding a PyAV API incompatibility. ASR outputs are drafts and must never be published without review.

```sh
python scripts/media/prepare_videos.py inspect --source '/path/to/Video Lessons'
python scripts/media/prepare_videos.py encode --source '/path/to/Video Lessons'
python scripts/media/prepare_videos.py transcribe --source '/path/to/Video Lessons' --model '/path/to/faster-whisper-base.en'
```

Transcription runs locally; media was not sent to a transcription service. Optimized copies and review frames live under ignored `.local-media/`. Preserve originals. For a future media revision, publish a new versioned release, verify hashes and range playback, then update catalog URLs. Do not silently replace a versioned video while retaining old captions.

References: [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases), [native HTML video](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/video), [multimedia accessibility](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Accessibility/Multimedia).
