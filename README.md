# English Fill-in-the-Blanks

A static, client-side English exercise app.

## Test Locally

```bash
cd /path/to/english_tests
python -m http.server 8000
```

Open: <http://localhost:8000>

## Project Structure

```
english_tests/
├── index.html
├── css/
│   └── style.css
├── js/
│   └── script.js
├── data/
│   ├── beginner.json
│   ├── intermediate.json
│   └── advanced.json
└── README.md
```

## How It Works

- **Remove Words**: removes full words
- **Remove Letters**: removes parts of words
- **Re-blank Text**: re-applies blanks to the same text

## Add New Tests

Add entries to the JSON files in the data/ folder.

Each entry has this shape:

```json
{
 "title": "My Exercise Title",
 "text": "Full exercise text goes here.",
 "difficulty": "beginner"
}
```

Place it in:

- data/beginner.json
- data/intermediate.json
- data/advanced.json
