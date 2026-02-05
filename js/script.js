// =========================================================================
// GLOBAL STATE AND CONSTANTS
// =========================================================================

const PUNCTUATION = ".!,?;:'\"()[]{}<>";
const STORAGE_KEY = 'englishTestsState';

let exercisesData = {
    beginner: [],
    intermediate: [],
    advanced: []
};

let currentState = {
    exerciseTitle: '',
    originalFullText: '',
    displayParts: [],
    blanksData: {},
    wordBank: []
};

// =========================================================================
// UTILITY FUNCTIONS
// =========================================================================

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentState));
}

function loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        currentState = JSON.parse(saved);
    }
}

function shuffleArray(arr) {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function getRandomItem(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
}

// =========================================================================
// EXERCISE LOGIC
// =========================================================================

function getRandomExercise(difficulty = null) {
    if (difficulty === 'all' || !difficulty) {
        const allExercises = [
            ...exercisesData.beginner,
            ...exercisesData.intermediate,
            ...exercisesData.advanced
        ];
        return getRandomItem(allExercises);
    }

    const exercises = exercisesData[difficulty] || [];
    return getRandomItem(exercises);
}

function getBlankSelectionPopulation(words) {
    return words
        .map((word, index) => ({ word, index }))
        .filter(({ word }) => {
            return word && word.length > 3 && !PUNCTUATION.includes(word[0]);
        });
}

function determineNumBlanks(populationSize, minBlanks, maxBlanks) {
    if (populationSize === 0) return 0;
    const numBlanks = Math.floor((minBlanks + maxBlanks) / 2);
    return Math.max(minBlanks, Math.min(maxBlanks, numBlanks));
}

function selectRandomBlanks(population, numBlanks) {
    const selected = {};
    const indices = new Set();

    while (indices.size < Math.min(numBlanks, population.length)) {
        const randomIdx = Math.floor(Math.random() * population.length);
        if (!indices.has(randomIdx)) {
            indices.add(randomIdx);
            const { word, index } = population[randomIdx];
            selected[index] = word;
        }
    }

    return selected;
}

function createExerciseWithBlanksPercentage(exerciseText, difficultyLevel, includeRandomWords = false) {
    const words = exerciseText.match(/\S+/g) || [];
    const textLength = exerciseText.length;

    // Calculate blank percentages
    const minBlanksPercent = 0.05 + (difficultyLevel - 1) * 0.02;
    const maxBlanksPercent = 0.10 + (difficultyLevel - 1) * 0.015;

    const minBlanks = Math.max(1, Math.floor(words.length * minBlanksPercent));
    const maxBlanks = Math.max(minBlanks, Math.floor(words.length * maxBlanksPercent));

    const population = getBlankSelectionPopulation(words);
    const numBlanks = determineNumBlanks(population.length, minBlanks, maxBlanks);
    const blanksData = selectRandomBlanks(population, numBlanks);

    // Create display parts
    const displayParts = [];
    words.forEach((word, index) => {
        if (blanksData[index]) {
            displayParts.push(`BLANK_${index}`);
        } else {
            displayParts.push(word);
        }
    });

    // Create word bank
    let wordBank = Object.values(blanksData);
    if (includeRandomWords) {
        const nonBlankWords = words.filter((_, idx) => !blanksData[idx]);
        const numRandomWords = Math.min(5, Math.ceil(wordBank.length / 2));
        const randomWords = shuffleArray(nonBlankWords).slice(0, numRandomWords);
        wordBank = wordBank.concat(randomWords);
    }
    wordBank = shuffleArray(wordBank);

    return {
        displayParts,
        blanksData,
        wordBank
    };
}

// =========================================================================
// EVENT HANDLERS
// =========================================================================

async function loadExercises() {
    try {
        const response = await fetch('data/beginner.json');
        const beginner = await response.json();
        exercisesData.beginner = beginner;

        const response2 = await fetch('data/intermediate.json');
        const intermediate = await response2.json();
        exercisesData.intermediate = intermediate;

        const response3 = await fetch('data/advanced.json');
        const advanced = await response3.json();
        exercisesData.advanced = advanced;

        console.log('Loaded exercises:', {
            beginner: exercisesData.beginner.length,
            intermediate: exercisesData.intermediate.length,
            advanced: exercisesData.advanced.length
        });
    } catch (error) {
        console.error('Error loading exercises:', error);
        alert('Failed to load exercises. Make sure data folder with JSON files exists.');
    }
}

function generateNewTest() {
    const difficulty = document.getElementById('difficultySelect').value;
    const sliderValue = parseInt(document.getElementById('blankSlider').value);
    const includeRandomWords = document.getElementById('includeRandomWords').checked;

    console.log('Generating new test:', { difficulty, sliderValue, includeRandomWords });

    const exercise = getRandomExercise(difficulty);
    if (!exercise) {
        alert('No exercises available for the selected difficulty.');
        return;
    }

    const exerciseText = exercise.text || '';
    const exerciseTitle = exercise.title || 'Untitled Exercise';

    const { displayParts, blanksData, wordBank } = createExerciseWithBlanksPercentage(
        exerciseText,
        sliderValue,
        includeRandomWords
    );

    currentState = {
        exerciseTitle,
        originalFullText: exerciseText,
        displayParts,
        blanksData,
        wordBank
    };

    saveState();
    updateExerciseDisplay();
}

function reblankText() {
    if (!currentState.originalFullText) {
        alert('No exercise loaded. Click "Get New Test" first.');
        return;
    }

    const sliderValue = parseInt(document.getElementById('blankSlider').value);
    const includeRandomWords = document.getElementById('includeRandomWords').checked;

    const { displayParts, blanksData, wordBank } = createExerciseWithBlanksPercentage(
        currentState.originalFullText,
        sliderValue,
        includeRandomWords
    );

    currentState.displayParts = displayParts;
    currentState.blanksData = blanksData;
    currentState.wordBank = wordBank;

    saveState();
    updateExerciseDisplay();
}

function updateExerciseDisplay() {
    const titleEl = document.getElementById('exerciseTitle');
    const textContainer = document.getElementById('exerciseTextContainer');
    const wordBankContainer = document.getElementById('wordBankContainer');

    // Title
    if (currentState.exerciseTitle) {
        titleEl.textContent = currentState.exerciseTitle;
        titleEl.style.display = 'block';
    } else {
        titleEl.style.display = 'none';
    }

    // Exercise text with blanks
    if (currentState.displayParts && currentState.displayParts.length > 0) {
        textContainer.innerHTML = '';
        currentState.displayParts.forEach(part => {
            if (part.startsWith('BLANK_')) {
                const index = part.split('_')[1];
                const input = document.createElement('input');
                input.type = 'text';
                input.name = `BLANK_${index}`;
                input.className = 'blank-input';
                input.placeholder = '?';
                textContainer.appendChild(input);
            } else {
                const text = document.createTextNode(part + ' ');
                textContainer.appendChild(text);
            }
        });
    } else {
        textContainer.innerHTML = '<div class="empty-state"><p>Click "Get New Test" to start an exercise.</p></div>';
    }

    // Word bank
    if (currentState.wordBank && currentState.wordBank.length > 0) {
        wordBankContainer.innerHTML = '';
        currentState.wordBank.forEach(word => {
            const span = document.createElement('span');
            span.textContent = word;
            wordBankContainer.appendChild(span);
        });
    } else {
        wordBankContainer.innerHTML = '<p style="color: #888;">Words will appear here after you get a test.</p>';
    }

    document.getElementById('exercisePanel').style.display = 'block';
    document.getElementById('resultsPanel').style.display = 'none';
}

function checkAnswers(e) {
    e.preventDefault();

    if (!currentState.blanksData || Object.keys(currentState.blanksData).length === 0) {
        alert('No exercise loaded. Click "Get New Test" first.');
        return;
    }

    const form = document.getElementById('exerciseForm');
    const userAnswers = {};
    const formData = new FormData(form);

    for (let [key, value] of formData.entries()) {
        if (key.startsWith('BLANK_')) {
            const index = parseInt(key.split('_')[1]);
            userAnswers[index] = value.trim().toLowerCase();
        }
    }

    // Evaluate answers
    const results = {};
    let score = 0;
    let totalBlanks = 0;

    for (const [index, correctWord] of Object.entries(currentState.blanksData)) {
        const indexNum = parseInt(index);
        const userWord = userAnswers[indexNum] || '';
        const isCorrect = userWord === correctWord.toLowerCase();

        results[indexNum] = {
            user: userWord || '[empty]',
            correct: correctWord,
            isCorrect
        };

        totalBlanks++;
        if (isCorrect) score++;
    }

    // Show results
    showResults(results, score, totalBlanks);
}

function showResults(results, score, totalBlanks) {
    const resultsPanel = document.getElementById('resultsPanel');
    const scoreDisplay = document.getElementById('scoreDisplay');
    const totalDisplay = document.getElementById('totalDisplay');
    const resultsTitle = document.getElementById('resultsTitle');
    const resultsContent = document.getElementById('resultsContent');
    const originalTextDisplay = document.getElementById('originalTextDisplay');

    scoreDisplay.textContent = score;
    totalDisplay.textContent = totalBlanks;
    resultsTitle.textContent = currentState.exerciseTitle;
    originalTextDisplay.textContent = currentState.originalFullText;

    // Build results HTML
    resultsContent.innerHTML = '';
    currentState.displayParts.forEach(part => {
        if (part.startsWith('BLANK_')) {
            const index = parseInt(part.split('_')[1]);
            const result = results[index];
            const span = document.createElement('span');
            if (result.isCorrect) {
                span.className = 'correct';
                span.textContent = result.user;
            } else {
                span.className = 'incorrect';
                span.textContent = `${result.user} (Correct: ${result.correct})`;
            }
            resultsContent.appendChild(span);
        } else {
            const text = document.createTextNode(part + ' ');
            resultsContent.appendChild(text);
        }
    });

    document.getElementById('exercisePanel').style.display = 'none';
    resultsPanel.style.display = 'block';
}

// =========================================================================
// EVENT LISTENERS
// =========================================================================

document.getElementById('getNewTestBtn').addEventListener('click', generateNewTest);
document.getElementById('reblankTextBtn').addEventListener('click', reblankText);
document.getElementById('exerciseForm').addEventListener('submit', checkAnswers);
document.getElementById('backToExerciseBtn').addEventListener('click', () => {
    document.getElementById('exercisePanel').style.display = 'block';
    document.getElementById('resultsPanel').style.display = 'none';
});

document.getElementById('blankSlider').addEventListener('input', (e) => {
    document.getElementById('sliderValue').textContent = e.target.value;
});

// =========================================================================
// INITIALIZATION
// =========================================================================

async function initialize() {
    loadState();
    await loadExercises();
    updateExerciseDisplay();
}

document.addEventListener('DOMContentLoaded', initialize);
