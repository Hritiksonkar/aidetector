# ML Service (FastAPI)

## Run

```bash
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## Media Mode

Set one of:

```bash
# deepfake-face (crop face + CLIP prompts tuned for faces)
set MEDIA_MODE=deepfake-face

# general-manipulated (whole image + generic manipulation prompts)
set MEDIA_MODE=general-manipulated
```

Optional:

```bash
set MEDIA_MODEL_ID=openai/clip-vit-base-patch32
set MEDIA_THRESHOLD=0.5
set VIDEO_MAX_FRAMES=12
```

## Video Deepfake Detection

The `/video` endpoint samples frames, crops the largest face when possible, and runs a Hugging Face image-classification deepfake model per frame.

Optional configuration:

```bash
set VIDEO_DEEPFAKE_MODEL_ID=dima806/deepfake_vs_real_image_detection
set VIDEO_DEEPFAKE_THRESHOLD=0.5

:: Better aggregation for deepfakes (artifacts can appear only in some frames)
set VIDEO_AGGREGATION=topk
set VIDEO_TOPK_FRACTION=0.33

:: Optional: downscale frames for speed (keeps face crop usable)
set VIDEO_FRAME_MAX_SIDE=720
```

## Text Detection

The `/text` endpoint uses Hugging Face model `openai-community/roberta-large-openai-detector` by default.

It returns **Real vs Fake** by picking the higher of the two probabilities (argmax).

Optional configuration:

```bash
set TEXT_MODEL_ID=openai-community/roberta-large-openai-detector

:: Aggregation over long-text chunks
set TEXT_AGGREGATION=topk
set TEXT_TOPK_FRACTION=0.30

:: Advanced (chunking for long text)
set TEXT_MAX_LENGTH=512
set TEXT_STRIDE=128
set TEXT_BATCH_SIZE=8
```

Note: this model was trained as a GPT-2 output detector; it may be inaccurate for other model families and languages.

## News Detection

The `/news` endpoint uses `facebook/bart-large-mnli` in a zero-shot setup to estimate whether the text is closer to **real news** or **fake news**.

Optional configuration:

```bash
set NEWS_MODEL_ID=facebook/bart-large-mnli
set NEWS_THRESHOLD=0.5

:: Aggregation over long-text chunks (default: topk)
set NEWS_AGGREGATION=topk
set NEWS_TOPK_FRACTION=0.33

:: Advanced (chunking for long text)
set NEWS_MAX_LENGTH=1024
set NEWS_PREMISE_MAX_TOKENS=768
set NEWS_STRIDE=128
set NEWS_BATCH_SIZE=4
```

Note: This is not a fact-checker; it cannot verify claims against sources. Treat outputs as a heuristic signal.
