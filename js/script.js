// =========================================================================
// GLOBAL STATE AND CONSTANTS
// =========================================================================

const PUNCTUATION = ".!,?;:'\"()[]{}<>";
const STORAGE_KEY = 'englishTestsState';
const THEME_KEY = 'englishTestsTheme';

// Timer constants
const TIMER_INCREMENT = 30; // seconds to add/subtract

// Blank percentage slider configuration.
const MIN_BLANK_PERCENTAGE = 10;
const MAX_BLANK_PERCENTAGE = 50;
const DEFAULT_BLANK_PERCENTAGE = MIN_BLANK_PERCENTAGE + Math.floor((MAX_BLANK_PERCENTAGE - MIN_BLANK_PERCENTAGE) / 2);

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
// TIMER FUNCTIONALITY
// =========================================================================

let timerState = {
    timeRemaining: 0, // in seconds
    isRunning: false,
    intervalId: null,
    hasFinished: false // Track if timer reached 0 naturally
};

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function updateTimerDisplay() {
    const display = document.getElementById('countdownDisplay');
    display.textContent = formatTime(timerState.timeRemaining);
}

function updateTimerButtonStates() {
    const increaseBtn = document.getElementById('increaseTimeBtn');
    const decreaseBtn = document.getElementById('decreaseTimeBtn');
    const startStopBtn = document.getElementById('startStopBtn');
    const resetBtn = document.getElementById('resetBtn');
    
    const isReset = timerState.timeRemaining === 0 && !timerState.isRunning && !timerState.hasFinished;
    const isSet = timerState.timeRemaining > 0 && !timerState.isRunning && !timerState.hasFinished;
    const isRunning = timerState.isRunning;
    const isPaused = timerState.timeRemaining > 0 && !timerState.isRunning && !timerState.hasFinished;
    const isFinished = timerState.hasFinished;
    
    // + button: enabled when not running
    increaseBtn.disabled = isRunning;
    increaseBtn.style.opacity = isRunning ? 0.5 : 1;
    
    // - button: enabled when not running and time > 0
    decreaseBtn.disabled = isRunning || timerState.timeRemaining === 0;
    decreaseBtn.style.opacity = (isRunning || timerState.timeRemaining === 0) ? 0.5 : 1;
    
    // Start/Pause button: enabled when there's time to run or when paused
    startStopBtn.disabled = timerState.timeRemaining === 0 || isFinished;
    startStopBtn.style.opacity = (timerState.timeRemaining === 0 || isFinished) ? 0.5 : 1;
    
    // Update start/pause icon
    if (isRunning) {
        startStopBtn.textContent = '◼';
    } else {
        startStopBtn.textContent = '▶';
    }
    
    // Reset button: enabled when not in reset state
    resetBtn.disabled = isReset;
    resetBtn.style.opacity = isReset ? 0.5 : 1;
}

function startTimer() {
    if (timerState.isRunning || timerState.timeRemaining <= 0 || timerState.hasFinished) return;
    
    timerState.isRunning = true;
    timerState.hasFinished = false; // Clear finished flag when starting
    const startStopBtn = document.getElementById('startStopBtn');
    startStopBtn.classList.add('running');
    
    timerState.intervalId = setInterval(() => {
        timerState.timeRemaining--;
        updateTimerDisplay();
        
        if (timerState.timeRemaining <= 0) {
            // Mark as finished when it reaches 0.
            timerState.hasFinished = true; 
            stopTimer();
            // Update buttons for finished state.
            updateTimerButtonStates(); 
            alert('Time\'s up!');
        }
    }, 1000);
    
    updateTimerButtonStates();
}

function stopTimer() {
    timerState.isRunning = false;
    clearInterval(timerState.intervalId);
    timerState.intervalId = null;
    
    const startStopBtn = document.getElementById('startStopBtn');
    startStopBtn.classList.remove('running');
    
    updateTimerButtonStates();
}

function resetTimer() {
    stopTimer();
    timerState.timeRemaining = 0;
    timerState.hasFinished = false; // Clear finished flag on reset
    updateTimerDisplay();
    updateTimerButtonStates();
}

function increaseTime() {
    if (timerState.isRunning) return;
    timerState.timeRemaining += TIMER_INCREMENT;
    updateTimerDisplay();
    updateTimerButtonStates();
}

function decreaseTime() {
    if (timerState.isRunning || timerState.timeRemaining <= 0) return;
    timerState.timeRemaining = Math.max(0, timerState.timeRemaining - TIMER_INCREMENT);
    updateTimerDisplay();
    updateTimerButtonStates();
}

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
        document.getElementById('reblankPartialBtn'),
        document.getElementById('clearBlanksBtn'),
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
            selected[index] = coreWord.toLowerCase();
        }
    }

    return selected;
}

function createExerciseWithBlanksPercentage(exerciseText, percentageBlanks, includeRandomWords = false) {
    const words = exerciseText.match(/\S+/g) || [];

    // Use percentageBlanks directly as the target percentage of words to blank
    const targetBlanksPercent = percentageBlanks / 100;
    const numBlanks = Math.max(1, Math.floor(words.length * targetBlanksPercent));

    console.log(`Total words: ${words.length}, Percentage to blank: ${percentageBlanks}%, Number of blanks to create: ${numBlanks}`);

    const population = getBlankSelectionPopulation(words);
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
            .map(w => parseToken(w).coreWord.toLowerCase())
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

function createExerciseWithPartialWords(exerciseText, percentageBlanks, includeRandomWords = false) {
    const words = exerciseText.match(/\S+/g) || [];
    
    // Use percentageBlanks directly as the target percentage of words to blank
    const targetBlanksPercent = percentageBlanks / 100;
    const numBlanks = Math.max(1, Math.floor(words.length * targetBlanksPercent));

    const population = getBlankSelectionPopulation(words);
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
        sliderValue,  // sliderValue is now the actual percentage (20-80)
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
        sliderValue,  // sliderValue is now the actual percentage (20-80)
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

    const { displayParts, blanksData, wordBank } = createExerciseWithBlanksPercentage(
        currentState.originalFullText,
        sliderValue,  // sliderValue is now the actual percentage (20-80)
        includeRandomWords
    );

    currentState.displayParts = displayParts;
    currentState.blanksData = blanksData;
    currentState.wordBank = wordBank;
    currentState.exerciseType = 'full';
    saveState();
    updateExerciseDisplay();
}

function reblankPartialText() {
    if (currentState.isLoadingExercises) return;
    if (!currentState.originalFullText) {
        alert('No exercise loaded. Click "Remove Words" or "Remove Letters" first.');
        return;
    }

    const sliderValue = parseInt(document.getElementById('blankSlider').value);
    const includeRandomWords = document.getElementById('includeRandomWords').checked;

    const { displayParts, blanksData, wordBank } = createExerciseWithPartialWords(
        currentState.originalFullText,
        sliderValue,  // sliderValue is now the actual percentage (20-80)
        includeRandomWords
    );

    currentState.displayParts = displayParts;
    currentState.blanksData = blanksData;
    currentState.wordBank = wordBank;
    currentState.exerciseType = 'partial';
    saveState();
    updateExerciseDisplay();
}

function clearBlanks() {
    if (!currentState.originalFullText) {
        return;
    }

    const inputs = document.querySelectorAll('.blank-input');
    inputs.forEach(input => {
        input.value = '';
    });
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
                    
                    // Set width based on expected word length
                    if (currentState.blanksData && currentState.blanksData[index]) {
                        const expectedWord = currentState.blanksData[index];
                        const baseWidth = prefix || suffix ? 60 : 90;
                        const calculatedWidth = Math.max(baseWidth, expectedWord.length * 12 + 16);
                        input.style.width = calculatedWidth + 'px';
                    }
                    
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

// Timer event listeners
document.getElementById('startStopBtn').addEventListener('click', () => {
    if (timerState.isRunning) {
        stopTimer();
    } else {
        startTimer();
    }
});

document.getElementById('increaseTimeBtn').addEventListener('click', increaseTime);
document.getElementById('decreaseTimeBtn').addEventListener('click', decreaseTime);
document.getElementById('resetBtn').addEventListener('click', resetTimer);

document.getElementById('getNewTestBtn').addEventListener('click', generateNewTest);
document.getElementById('getPartialTestBtn').addEventListener('click', generatePartialTest);
document.getElementById('reblankTextBtn').addEventListener('click', reblankText);
document.getElementById('reblankPartialBtn').addEventListener('click', reblankPartialText);
document.getElementById('clearBlanksBtn').addEventListener('click', clearBlanks);
document.getElementById('exerciseForm').addEventListener('submit', checkAnswers);
document.getElementById('backToExerciseBtn').addEventListener('click', () => {
    document.getElementById('exercisePanel').style.display = 'block';
    document.getElementById('resultsPanel').style.display = 'none';
});

function updateSliderTooltip(slider, show = false) {
    const value = parseInt(slider.value);
    const percentage = value;
    const tooltip = slider.parentElement.querySelector('.slider-tooltip');
    
    // Update tooltip content
    tooltip.textContent = percentage + '%';
    
    // Simple positioning: place tooltip at percentage position across slider
    const min = slider.min;
    const max = slider.max;
    const percentagePosition = (value - min) / (max - min);
    const sliderWidth = slider.offsetWidth;
    
    // Position tooltip centered at the percentage position
    const tooltipLeft = percentagePosition * sliderWidth;
    
    tooltip.style.left = tooltipLeft + 'px';
    
    // Show/hide tooltip
    tooltip.style.opacity = show ? '1' : '0';
}

document.getElementById('blankSlider').addEventListener('input', (e) => {
    updateSliderTooltip(e.target, true);
});

document.getElementById('blankSlider').addEventListener('touchstart', (e) => {
    updateSliderTooltip(e.target, true);
});

document.getElementById('blankSlider').addEventListener('touchend', (e) => {
    setTimeout(() => updateSliderTooltip(e.target, false), 1000);
});

document.getElementById('blankSlider').addEventListener('mouseenter', (e) => {
    updateSliderTooltip(e.target, true);
});

document.getElementById('blankSlider').addEventListener('mouseleave', (e) => {
    updateSliderTooltip(e.target, false);
});

// =========================================================================
// INITIALIZATION
// =========================================================================

async function initialize() {
    loadTheme();
    loadState();
    await loadExercises();
    updateExerciseDisplay();
    
    // Initialize timer display
    updateTimerDisplay();
    updateTimerButtonStates();
    
    // Configure blank percentage slider dynamically
    const slider = document.getElementById('blankSlider');
    slider.min = MIN_BLANK_PERCENTAGE;
    slider.max = MAX_BLANK_PERCENTAGE;
    slider.value = DEFAULT_BLANK_PERCENTAGE;
    
    // Set initial tooltip text
    const tooltip = slider.parentElement.querySelector('.slider-tooltip');
    tooltip.textContent = DEFAULT_BLANK_PERCENTAGE + '%';
    
    // Initialize slider tooltip after a short delay to ensure DOM is ready
    setTimeout(() => {
        // Ensure slider value is within new range
        const currentValue = parseInt(slider.value);
        if (currentValue < MIN_BLANK_PERCENTAGE || currentValue > MAX_BLANK_PERCENTAGE) {
            slider.value = DEFAULT_BLANK_PERCENTAGE; // Reset to middle value if out of range
        }
        updateSliderTooltip(slider, false);
    }, 100);
}

document.addEventListener('DOMContentLoaded', initialize);
