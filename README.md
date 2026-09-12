# English Tests

A personal, browser-based prototype for English language exercises and test-style practice.

The project is intentionally lightweight: the user interface is implemented with HTML, CSS, and JavaScript, exercise content is stored as structured data, and the site can be served as static files. A live version is available through GitHub Pages at:

https://galfurian.github.io/english_tests/

## Exercise types

- **Full Word Placement** — replace complete missing words in a text.
- **Partial Word Placement** — complete words from which letters have been removed.
- **Dropdown Word Placement** — choose the correct answer from a set of alternatives.
- **Guided Grammar Gaps** — grammar-focused gaps with configurable word-bank coverage.
- **B2 Listening Comprehension** — listen to a dialogue and answer comprehension questions, with scoring, explanations, and transcript review.

The interfaces include light/dark presentation modes on the exercise pages, local progress/statistics where applicable, responsive layouts, and keyboard-visible focus safeguards.

## Architecture

The project is static and client-side. Exercise data is kept separately from presentation logic so that additional exercises can be added without rewriting the interface.

```text
english_tests/
├── index.html
├── data/
├── dropdown_word_placement/
├── full_word_placement/
├── listening_comprehension/
├── partial_word_placement/
├── slider_word_placement/
├── shared/
└── tools/
```

The listening section uses a catalogue of exercise JSON files. Each exercise can contain metadata, a source transcript, audio metadata, questions, correct answers, and explanations. Generated audio assets can be stored separately from the source data.

## Running locally

From the repository root:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

A local HTTP server is recommended because browser security rules may prevent data files from loading correctly when pages are opened directly with `file://`.

## Listening audio generation

See [`listening_comprehension/README.md`](listening_comprehension/README.md) for the listening data model and audio-generation workflow.

## Scope

This repository is an educational and technical prototype. It demonstrates interaction patterns, exercise formats, content separation, and client-side presentation. A production assessment system would additionally require appropriate server-side controls for identity, protected assessment material, grading, persistence, auditing, and integration with external systems.

## Author

Designed and developed by **Enrico Fraccaroli**.

## License

Copyright (c) 2025-2026 Enrico Fraccaroli.

Released under the [MIT License](LICENSE.md).
