# Listening comprehension

Static B2 listening exercises for the GitHub Pages site.

## Data model

`data/index.json` is the catalogue consumed by the UI. Each entry points to one exercise JSON file. Adding exercise 002 or exercise 050 does not require changing the HTML or JavaScript; add the JSON file and one entry to the index.

Each exercise contains:

- metadata (`exerciseId`, title, CEFR level)
- two or more configurable entities and their TTS voices
- the source transcript
- one public MP3 URL
- one SHA-256 URL
- five multiple-choice/dropdown questions, their correct answers and explanations

The transcript is hidden while the exercise is being attempted and becomes available on the results screen.

## Generate audio

Install Edge TTS and FFmpeg:

```bash
python -m pip install -r requirements-listening.txt
sudo apt install ffmpeg
```

Generate the first exercise:

```bash
python tools/generate_listening_audio.py \
  listening_comprehension/data/b2-listening-001.json \
  --gap-ms 140
```

This produces:

```text
dist/audio/b2-listening-001.mp3
dist/audio/b2-listening-001.mp3.sha256
```

Upload both files as assets of the GitHub release/tag `listening-audio-v1`. The exercise JSON already points to the corresponding release download URLs.

The MP3 is intentionally a single continuous recording rather than one file per turn. This keeps timing deterministic and gives the browser one audio resource to preload and play.

## Scaling to 20-50 exercises

Use stable IDs such as `b2-listening-001` through `b2-listening-050`. Keep source JSON in Git, while generated MP3 and SHA-256 files live as release assets. For a future storage migration (for example to object storage), only the `audio.url` and `audio.sha256Url` fields need to change.
