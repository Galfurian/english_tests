// =========================================================================
// GLOBAL STATE AND CONSTANTS
// =========================================================================

const PUNCTUATION = ".!,?;:'\"()[]{}<>";
const STORAGE_KEY = 'englishTestsState';
const THEME_KEY = 'englishTestsTheme';

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
    wordBank: [],
    exerciseType: 'full', // 'full' for whole words, 'partial' for letter removal
    isLoadingExercises: false
};

// =========================================================================
// THEME MANAGEMENT
// =========================================================================

function toggleTheme() {
    const body = document.body;
    const themeToggle = document.getElementById('themeToggle');
    const isLight = body.classList.toggle('light-theme');
    
    themeToggle.textContent = isLight ? '🌞' : '🌙';
    localStorage.setItem(THEME_KEY, isLight ? 'light' : 'dark');
}

function loadTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    const themeToggle = document.getElementById('themeToggle');
    
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        themeToggle.textContent = '🌞';
    }
}

// =========================================================================
// UTILITY FUNCTIONS
// =========================================================================

function setControlsDisabled(disabled) {
    const elements = [
        document.getElementById('getNewTestBtn'),
        document.getElementById('getPartialTestBtn'),
        document.getElementById('reblankTextBtn'),
        document.getElementById('difficultySelect'),
        document.getElementById('blankSlider'),
        document.getElementById('includeRandomWords'),
        document.querySelector('#exerciseForm button[type="submit"]')
    ];

    elements.forEach(el => {
        if (el) el.disabled = disabled;
    });
}

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

function parseToken(token) {
    let leadingPunct = '';
    let trailingPunct = '';
    let coreWord = token;
    
    // Extract leading punctuation
    while (coreWord.length > 0 && PUNCTUATION.includes(coreWord[0])) {
        leadingPunct += coreWord[0];
        coreWord = coreWord.substring(1);
    }
    
    // Extract trailing punctuation
    while (coreWord.length > 0 && PUNCTUATION.includes(coreWord[coreWord.length - 1])) {
        trailingPunct = coreWord[coreWord.length - 1] + trailingPunct;
        coreWord = coreWord.substring(0, coreWord.length - 1);
    }
    
    return { leadingPunct, coreWord, trailingPunct };
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
        .map((word, index) => {
            const { coreWord } = parseToken(word);
            return { word, coreWord, index };
        })
        .filter(({ coreWord }) => {
            return coreWord && coreWord.length > 3;
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
            const { coreWord, index } = population[randomIdx];
            selected[index] = coreWord;
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
            const { leadingPunct, trailingPunct } = parseToken(word);
            displayParts.push(`${leadingPunct}<BLANK_${index}>${trailingPunct}`);
        } else {
            displayParts.push(word);
        }
    });

    // Create word bank
    let wordBank = Object.values(blanksData);
    if (includeRandomWords) {
        const nonBlankWords = words
            .filter((_, idx) => !blanksData[idx])
            .map(w => parseToken(w).coreWord)
            .filter(w => w && w.length > 0);
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

function createExerciseWithPartialWords(exerciseText, difficultyLevel, includeRandomWords = false) {
    const words = exerciseText.match(/\S+/g) || [];
    
    // Calculate blank percentages
    const minBlanksPercent = 0.05 + (difficultyLevel - 1) * 0.02;
    const maxBlanksPercent = 0.10 + (difficultyLevel - 1) * 0.015;

    const minBlanks = Math.max(1, Math.floor(words.length * minBlanksPercent));
    const maxBlanks = Math.max(minBlanks, Math.floor(words.length * maxBlanksPercent));

    const population = getBlankSelectionPopulation(words);
    const numBlanks = determineNumBlanks(population.length, minBlanks, maxBlanks);
    
    // Select random words from population to partially blank
    const selectedItems = shuffleArray([...population]).slice(0, numBlanks);
    const selectedIndicesSet = new Set(selectedItems.map(item => item.index));

    const blanksData = {};
    const displayParts = [];
    
    words.forEach((word, index) => {
        if (selectedIndicesSet.has(index)) {
            const { leadingPunct, coreWord, trailingPunct } = parseToken(word);
            
            // Only create partial blank if word is long enough
            if (coreWord.length > 4) {
                // Remove 30-40% of the word, minimum 2 letters
                const removePercent = 0.3 + Math.random() * 0.1; // 30-40%
                const removeCount = Math.max(2, Math.floor(coreWord.length * removePercent));
                
                // Choose random position to start removing (not at very beginning or end)
                const maxStartPos = coreWord.length - removeCount;
                const startPos = Math.floor(Math.random() * maxStartPos);
                
                const prefix = coreWord.substring(0, startPos);
                const missing = coreWord.substring(startPos, startPos + removeCount);
                const suffix = coreWord.substring(startPos + removeCount);
                
                blanksData[index] = missing.toLowerCase();
                displayParts.push(`${leadingPunct}${prefix}<BLANK_${index}>${suffix}${trailingPunct}`);
            } else {
                // Word too short for partial blanking, just display it
                displayParts.push(word);
            }
        } else {
            displayParts.push(word);
        }
    });

    // Create word bank
    let wordBank = Object.values(blanksData);
    if (includeRandomWords) {
        // Add random partial words from non-blanked words
        const nonBlankWords = words
            .filter((w, idx) => !blanksData[idx])
            .map(w => parseToken(w).coreWord)
            .filter(w => w && w.length > 4);
        const numRandomWords = Math.min(3, Math.ceil(wordBank.length / 2));
        const randomParts = nonBlankWords.slice(0, numRandomWords).map(w => {
            const len = Math.max(1, Math.floor(w.length * 0.90));
            const pos = Math.floor(Math.random() * (w.length - len));
            return w.substring(pos, pos + len).toLowerCase();
        });
        wordBank = wordBank.concat(randomParts);
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
        currentState.isLoadingExercises = true;
        setControlsDisabled(true);

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
    } finally {
        currentState.isLoadingExercises = false;
        setControlsDisabled(false);
    }
}

function generateNewTest() {
    if (currentState.isLoadingExercises) return;
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
        wordBank,
        exerciseType: 'full'
    };

    saveState();
    updateExerciseDisplay();
}

function generatePartialTest() {
    if (currentState.isLoadingExercises) return;
    const difficulty = document.getElementById('difficultySelect').value;
    const sliderValue = parseInt(document.getElementById('blankSlider').value);
    const includeRandomWords = document.getElementById('includeRandomWords').checked;

    console.log('Generating partial word test:', { difficulty, sliderValue, includeRandomWords });

    const exercise = getRandomExercise(difficulty);
    if (!exercise) {
        alert('No exercises available for the selected difficulty.');
        return;
    }

    const exerciseText = exercise.text || '';
    const exerciseTitle = exercise.title || 'Untitled Exercise';

    const { displayParts, blanksData, wordBank } = createExerciseWithPartialWords(
        exerciseText,
        sliderValue,
        includeRandomWords
    );

    currentState = {
        exerciseTitle,
        originalFullText: exerciseText,
        displayParts,
        blanksData,
        wordBank,
        exerciseType: 'partial'
    };

    saveState();
    updateExerciseDisplay();
}

function reblankText() {
    if (currentState.isLoadingExercises) return;
    if (!currentState.originalFullText) {
        alert('No exercise loaded. Click "Remove Words" or "Remove Letters" first.');
        return;
    }

    const sliderValue = parseInt(document.getElementById('blankSlider').value);
    const includeRandomWords = document.getElementById('includeRandomWords').checked;

    const createFunc = currentState.exerciseType === 'partial' 
        ? createExerciseWithPartialWords 
        : createExerciseWithBlanksPercentage;

    const { displayParts, blanksData, wordBank } = createFunc(
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
            if (part.includes('<BLANK_')) {
                // Parse parts with <BLANK_index> markers
                const blankMatch = part.match(/(.*)<BLANK_(\d+)>(.*)/); 
                if (blankMatch) {
                    const [, prefix, index, suffix] = blankMatch;
                    
                    // Add prefix text if exists
                    if (prefix) {
                        textContainer.appendChild(document.createTextNode(prefix));
                    }
                    
                    // Add input
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.name = `BLANK_${index}`;
                    input.className = 'blank-input';
                    // Add 'partial' class if this is a partial word blank
                    if (prefix || suffix) {
                        input.className += ' partial';
                    }
                    input.placeholder = '?';
                    textContainer.appendChild(input);
                    
                    // Add suffix text if exists
                    if (suffix) {
                        textContainer.appendChild(document.createTextNode(suffix));
                    }
                    
                    // Add space after the word
                    textContainer.appendChild(document.createTextNode(' '));
                }
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
        if (part.includes('<BLANK_')) {
            // Parse parts with <BLANK_index> markers
            const blankMatch = part.match(/(.*)<BLANK_(\d+)>(.*)/); 
            if (blankMatch) {
                const [, prefix, index, suffix] = blankMatch;
                const result = results[parseInt(index)];
                
                // Add prefix
                if (prefix) {
                    resultsContent.appendChild(document.createTextNode(prefix));
                }
                
                // Add the answer (correct or incorrect)
                const span = document.createElement('span');
                if (result.isCorrect) {
                    span.className = 'correct';
                    span.textContent = result.user;
                } else {
                    span.className = 'incorrect';
                    span.textContent = `${result.user} (Correct: ${result.correct})`;
                }
                resultsContent.appendChild(span);
                
                // Add suffix
                if (suffix) {
                    resultsContent.appendChild(document.createTextNode(suffix));
                }
                
                // Add space
                resultsContent.appendChild(document.createTextNode(' '));
            }
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

document.getElementById('themeToggle').addEventListener('click', toggleTheme);
document.getElementById('getNewTestBtn').addEventListener('click', generateNewTest);
document.getElementById('getPartialTestBtn').addEventListener('click', generatePartialTest);
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
    loadTheme();
    loadState();
    await loadExercises();
    updateExerciseDisplay();
}

document.addEventListener('DOMContentLoaded', initialize);
