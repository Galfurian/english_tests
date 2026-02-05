# English Fill-in-the-Blanks

A beautiful, fully static English language exercise website that runs without a server. Perfect for GitHub Pages deployment!

## Features

✨ **Stunning Dark Mode Design**

- Modern gradient UI with smooth animations
- Responsive design (works on all devices)
- Beautiful purple gradient buttons and accents

📚 **Interactive Exercises**

- Three difficulty levels: Beginner, Intermediate, Advanced
- Adjustable blank difficulty (1-10 slider)
- Optional random words for extra challenge
- Instant answer checking with detailed feedback

💾 **Offline Support**

- Works completely offline
- Saves your exercise state in browser localStorage
- No server required - pure client-side processing

## Directory Structure

```
english_tests/
├── index.html              # Main HTML page
├── css/
│   └── style.css          # All styling
├── js/
│   └── script.js          # All JavaScript logic
├── data/
│   ├── beginner.json      # Beginner exercises
│   ├── intermediate.json  # Intermediate exercises
│   └── advanced.json      # Advanced exercises
├── README.md              # This file
└── .gitignore             # Git ignore rules
```

## Testing Locally

### Option 1: Using Python (Recommended)

```bash
cd /path/to/english_tests
python -m http.server 8000
```

Then open your browser to: **<http://localhost:8000>**

### Option 2: Using Node.js

```bash
npx http-server
```

### Option 3: Using VS Code Live Server

1. Install the "Live Server" extension
2. Right-click on `index.html` → "Open with Live Server"

## Deploying to GitHub Pages

Push to GitHub and enable Pages in Settings:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/yourusername.github.io.git
git push -u origin main
```

Your site is now live at: **<https://yourusername.github.io>**

## How It Works

- **Get New Test**: Loads random exercise with configurable difficulty
- **Re-blank Text**: Creates new blanks for same text
- **Check Answers**: Compares answers and shows score

## Technical Details

- Pure HTML/CSS/JavaScript
- localStorage for state management
- Fully responsive design
- No dependencies required

## Browser Support

Chrome, Firefox, Safari, Edge (v90+)

---

Enjoy learning English! 📚✨
