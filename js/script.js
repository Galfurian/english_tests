// =========================================================================
// GLOBAL STATE AND CONSTANTS
// =========================================================================

const PUNCTUATION = ".!,?;:'\"()[]{}<>—";
const STORAGE_KEY = 'englishTestsState';
const THEME_KEY = 'englishTestsTheme';

// Timer constants.
const TIMER_INCREMENT = 60;

// Blank percentage slider configuration.
const MIN_BLANK_PERCENTAGE = 10;
const MAX_BLANK_PERCENTAGE = 50;
const DEFAULT_BLANK_PERCENTAGE = MIN_BLANK_PERCENTAGE + Math.floor((MAX_BLANK_PERCENTAGE - MIN_BLANK_PERCENTAGE) / 2);

// Partial blank mode: 'random' for current behavior, 'begin_end' for beginning or end only
const PARTIAL_BLANK_MODE = 'begin_end';

// Partial blank removal count configuration.
const MIN_REMOVE_COUNT = 2;
const MAX_REMOVE_COUNT = 6;

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
// STATISTICS SYSTEM
// =========================================================================

let userStats = {
    totalExercises: 0,
    totalCorrect: 0,
    totalIncorrect: 0,
    exercisesByDifficulty: {
        beginner: 0,
        intermediate: 0,
        advanced: 0
    }
};

const STATS_KEY = 'englishTestsStats';

function loadStats() {
    const saved = localStorage.getItem(STATS_KEY);
    if (saved) {
        userStats = { ...userStats, ...JSON.parse(saved) };
    }
    updateStatsDisplay();
}

function saveStats() {
    localStorage.setItem(STATS_KEY, JSON.stringify(userStats));
}

function updateStatsDisplay() {
    const accuracy = userStats.totalExercises > 0 
        ? Math.round((userStats.totalCorrect / (userStats.totalCorrect + userStats.totalIncorrect)) * 100) 
        : 0;
    
    
    document.getElementById('totalExercises').textContent = userStats.totalExercises;
    document.getElementById('totalCorrect').textContent = userStats.totalCorrect;
    document.getElementById('totalIncorrect').textContent = userStats.totalIncorrect;
    
    // Set accuracy with dynamic gradient color
    const accuracyElement = document.getElementById('accuracyRate');
    accuracyElement.textContent = accuracy + '%';
    
    // Calculate gradient color from red (0%) to green (100%)
    const red = Math.round(244 - (244 - 76) * (accuracy / 100));   // 244 (red) to 76 (green)
    const green = Math.round(67 + (175 - 67) * (accuracy / 100));  // 67 (red) to 175 (green) 
    const blue = Math.round(54 - (54 - 80) * (accuracy / 100));    // 54 (red) to 80 (green)
    
    accuracyElement.style.color = `rgb(${red}, ${green}, ${blue})`;
}

function resetStats() {
    if (confirm('Are you sure you want to reset all statistics? This cannot be undone.')) {
        userStats = {
            totalExercises: 0,
            totalCorrect: 0,
            totalIncorrect: 0,
            lastExerciseDate: null,
            exercisesByDifficulty: {
                beginner: 0,
                intermediate: 0,
                advanced: 0
            }
        };
        saveStats();
        updateStatsDisplay();
    }
}

function updateStatsAfterExercise(score, totalBlanks) {
    // Update basic stats
    userStats.totalExercises++;
    userStats.totalCorrect += score;
    userStats.totalIncorrect += (totalBlanks - score);
    // Update difficulty stats
    const difficulty = document.getElementById('difficultySelect').value;
    if (difficulty !== 'all' && userStats.exercisesByDifficulty[difficulty] !== undefined) {
        userStats.exercisesByDifficulty[difficulty]++;
    }
    saveStats();
    updateStatsDisplay();
}

function toggleStatsPanel() {
    const panel = document.getElementById('statsPanel');
    const isCollapsed = panel.classList.contains('collapsed');
    
    if (isCollapsed) {
        panel.classList.remove('collapsed');
    } else {
        panel.classList.add('collapsed');
    }
}

// =========================================================================
// TIMER FUNCTIONALITY
// =========================================================================

let timerState = {
    timeRemaining: 0, // in seconds
    presetDuration: 0, // remember the last set duration for reset
    isRunning: false,
    intervalId: null
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

function updateTimerButtons() {
    const increaseBtn = document.getElementById('increaseTimeBtn');
    const decreaseBtn = document.getElementById('decreaseTimeBtn');
    const startStopBtn = document.getElementById('startStopBtn');
    const resetBtn = document.getElementById('resetBtn');
    
    // + button: enabled when not running
    const canIncrease = !timerState.isRunning;
    increaseBtn.disabled = !canIncrease;
    increaseBtn.style.opacity = canIncrease ? 1 : 0.5;
    
    // - button: enabled when not running and time > 0
    const canDecrease = !timerState.isRunning && timerState.timeRemaining > 0;
    decreaseBtn.disabled = !canDecrease;
    decreaseBtn.style.opacity = canDecrease ? 1 : 0.5;
    
    // Start/Pause button: enabled when time > 0
    const canStart = timerState.timeRemaining > 0;
    startStopBtn.disabled = !canStart;
    startStopBtn.style.opacity = canStart ? 1 : 0.5;
    startStopBtn.textContent = timerState.isRunning ? '⏸️' : '▶️';
    
    // Reset button: always enabled
    resetBtn.disabled = false;
    resetBtn.style.opacity = 1;
}

function startTimer() {
    if (timerState.isRunning || timerState.timeRemaining <= 0) return;
    
    timerState.isRunning = true;
    const startStopBtn = document.getElementById('startStopBtn');
    startStopBtn.classList.add('running');
    
    timerState.intervalId = setInterval(() => {
        timerState.timeRemaining--;
        updateTimerDisplay();
        
        if (timerState.timeRemaining <= 0) {
            stopTimer();
            alert('Time\'s up!');
        }
    }, 1000);
    
    updateTimerButtons();
}

function stopTimer() {
    timerState.isRunning = false;
    clearInterval(timerState.intervalId);
    timerState.intervalId = null;
    
    const startStopBtn = document.getElementById('startStopBtn');
    startStopBtn.classList.remove('running');
    
    updateTimerButtons();
}

function resetTimer() {
    stopTimer();
    timerState.timeRemaining = timerState.presetDuration; // Reset to preset duration
    updateTimerDisplay();
    updateTimerButtons();
}

function increaseTime() {
    if (timerState.isRunning) return;
    timerState.timeRemaining += TIMER_INCREMENT;
    timerState.presetDuration = timerState.timeRemaining; // Update preset when adjusting
    updateTimerDisplay();
    updateTimerButtons();
}

function decreaseTime() {
    if (timerState.isRunning || timerState.timeRemaining <= 0) return;
    timerState.timeRemaining = Math.max(0, timerState.timeRemaining - TIMER_INCREMENT);
    timerState.presetDuration = timerState.timeRemaining; // Update preset when adjusting
    updateTimerDisplay();
    updateTimerButtons();
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

function getLongestBlankLength(blanksData) {
    let maxLength = 0;
    for (const blank of Object.values(blanksData)) {
        maxLength = Math.max(maxLength, blank.length);
    }
    return maxLength;
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

function createExerciseWithBlanksPercentage(exerciseText, percentageBlanks, includeRandomWords = false, extraWordsMultiplier = 0.5) {
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
        // Add random partial words from non-blanked words
        const nonBlankWords = words
            .filter((w, idx) => !blanksData[idx])
            .map(w => parseToken(w).coreWord)
            .filter(w => w && w.length > 4);
        const numRandomWords = Math.ceil(wordBank.length * extraWordsMultiplier);
        const randomParts = nonBlankWords.slice(0, numRandomWords).map(w => w.toLowerCase());
        wordBank = wordBank.concat(randomParts);
    }
    wordBank = shuffleArray(wordBank);

    return {
        displayParts,
        blanksData,
        wordBank
    };
}

function createExerciseWithPartialWords(exerciseText, percentageBlanks, includeRandomWords = false, extraWordsMultiplier = 0.5) {
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
                const removeCount = Math.max(MIN_REMOVE_COUNT, Math.min(MAX_REMOVE_COUNT, Math.floor(coreWord.length * removePercent)));
                
                // Choose position to start removing based on mode
                const maxStartPos = coreWord.length - removeCount;
                let startPos;
                if (PARTIAL_BLANK_MODE === 'begin_end') {
                    // Choose either beginning or end
                    startPos = Math.random() < 0.5 ? 0 : maxStartPos;
                } else {
                    // Current random behavior
                    startPos = Math.floor(Math.random() * maxStartPos);
                }
                
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
        const numRandomWords = Math.ceil(wordBank.length * extraWordsMultiplier);
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
    resetTimer(); // Reset timer when starting new exercise
    if (currentState.isLoadingExercises) return;
    const difficulty = document.getElementById('difficultySelect').value;
    const sliderValue = parseInt(document.getElementById('blankSlider').value);
    const includeRandomWords = document.getElementById('includeRandomWords').checked;
    const extraWordsMultiplier = includeRandomWords ? parseFloat(document.getElementById('extraWordsSlider').value) : 0;

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
        includeRandomWords,
        extraWordsMultiplier
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
    resetTimer(); // Reset timer when starting new exercise
    if (currentState.isLoadingExercises) return;
    const difficulty = document.getElementById('difficultySelect').value;
    const sliderValue = parseInt(document.getElementById('blankSlider').value);
    const includeRandomWords = document.getElementById('includeRandomWords').checked;
    const extraWordsMultiplier = includeRandomWords ? parseFloat(document.getElementById('extraWordsSlider').value) : 0;

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
        includeRandomWords,
        extraWordsMultiplier
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
    resetTimer(); // Reset timer when re-blanking exercise
    if (currentState.isLoadingExercises) return;
    if (!currentState.originalFullText) {
        alert('No exercise loaded. Click "Remove Words" or "Remove Letters" first.');
        return;
    }

    const sliderValue = parseInt(document.getElementById('blankSlider').value);
    const includeRandomWords = document.getElementById('includeRandomWords').checked;
    const extraWordsMultiplier = includeRandomWords ? parseFloat(document.getElementById('extraWordsSlider').value) : 0;

    const { displayParts, blanksData, wordBank } = createExerciseWithBlanksPercentage(
        currentState.originalFullText,
        sliderValue,  // sliderValue is now the actual percentage (20-80)
        includeRandomWords,
        extraWordsMultiplier
    );

    currentState.displayParts = displayParts;
    currentState.blanksData = blanksData;
    currentState.wordBank = wordBank;
    currentState.exerciseType = 'full';
    saveState();
    updateExerciseDisplay();
}

function reblankPartialText() {
    resetTimer(); // Reset timer when re-blanking partial exercise
    if (currentState.isLoadingExercises) return;
    if (!currentState.originalFullText) {
        alert('No exercise loaded. Click "Remove Words" or "Remove Letters" first.');
        return;
    }

    const sliderValue = parseInt(document.getElementById('blankSlider').value);
    const includeRandomWords = document.getElementById('includeRandomWords').checked;
    const extraWordsMultiplier = includeRandomWords ? parseFloat(document.getElementById('extraWordsSlider').value) : 0;

    const { displayParts, blanksData, wordBank } = createExerciseWithPartialWords(
        currentState.originalFullText,
        sliderValue,
        includeRandomWords,
        extraWordsMultiplier
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

    // Define the className postfix if the exercise type is 'partial' to indicate partial blanks in CSS.
    const inputClassNamePostfix = currentState.exerciseType === 'partial' ? ' partial' : '';
    // For partial exercises, use the longest blank length for all inputs
    const longestBlankLength = getLongestBlankLength(currentState.blanksData);

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
                    // Create input element for the blank.
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.name = `BLANK_${index}`;
                    input.className = 'blank-input' + inputClassNamePostfix;
                    input.placeholder = '?';
                    input.autocomplete = 'off';
                    // Set the input width based on exercise type
                    let calculatedInputWidth;
                    if (currentState.exerciseType === 'partial') {
                        const randomExtra = Math.floor(Math.random() * 3) + 1;
                        calculatedInputWidth = (Math.max(9, longestBlankLength) + randomExtra) * 5;
                    } else {
                        // For full exercises, use the individual answer length
                        const correctAnswer = currentState.blanksData[index] || '';
                        const randomExtra = Math.floor(Math.random() * 3) + 1;
                        calculatedInputWidth = (Math.max(9, correctAnswer.length) + randomExtra) * 8;
                    }
                    input.style.width = calculatedInputWidth + 'px';
                    // Add the input to the text container.
                    textContainer.appendChild(input);
                    // Add suffix text if exists.
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
        // Update the title with number of blanks and words
        const wordBankTitle = document.querySelector('.word-bank h3');
        const numBlanks = Object.keys(currentState.blanksData).length;
        wordBankTitle.textContent = `Word Bank (${numBlanks} blanks)`;

        const exerciseTitle = document.getElementById('exerciseTitle');
        const textLength = currentState.originalFullText.split(/\s+/).length;
        exerciseTitle.textContent = `${currentState.exerciseTitle} (${textLength} words)`;
    } else {
        wordBankContainer.innerHTML = '<p style="color: #888;">Words will appear here after you get a test.</p>';
        // Reset title when no word bank
        const wordBankTitle = document.querySelector('.word-bank h3');
        wordBankTitle.textContent = 'Word Bank';
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

    // Update statistics
    updateStatsAfterExercise(score, totalBlanks);

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

// Statistics event listeners
document.getElementById('statsToggle').addEventListener('click', toggleStatsPanel);
document.getElementById('resetStatsBtn').addEventListener('click', resetStats);

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
    const value = parseFloat(slider.value);
    let displayValue;
    
    if (slider.id === 'extraWordsSlider') {
        // For extra words slider, show as percentage of blanks count
        displayValue = Math.round(value * 100) + '%';
    } else {
        // For blank percentage slider, show as percentage
        displayValue = Math.round(value) + '%';
    }
    
    const tooltip = slider.parentElement.querySelector('.slider-tooltip');
    
    // Update tooltip content
    tooltip.textContent = displayValue;
    
    // Simple positioning: place tooltip at percentage position across slider
    const min = parseFloat(slider.min);
    const max = parseFloat(slider.max);
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

// Extra words toggle and slider event listeners
document.getElementById('includeRandomWords').addEventListener('change', (e) => {
    const sliderContainer = document.getElementById('extraWordsSliderContainer');
    if (e.target.checked) {
        sliderContainer.style.display = 'flex';
    } else {
        sliderContainer.style.display = 'none';
    }
});

document.getElementById('extraWordsSlider').addEventListener('input', (e) => {
    updateSliderTooltip(e.target, true);
});

document.getElementById('extraWordsSlider').addEventListener('touchstart', (e) => {
    updateSliderTooltip(e.target, true);
});

document.getElementById('extraWordsSlider').addEventListener('touchend', (e) => {
    updateSliderTooltip(e.target, false);
});

document.getElementById('extraWordsSlider').addEventListener('mouseenter', (e) => {
    updateSliderTooltip(e.target, true);
});

document.getElementById('extraWordsSlider').addEventListener('mouseleave', (e) => {
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
    updateTimerButtons();
    
    // Initialize statistics
    loadStats();
    
    // Configure blank percentage slider dynamically
    const slider = document.getElementById('blankSlider');
    slider.min = MIN_BLANK_PERCENTAGE;
    slider.max = MAX_BLANK_PERCENTAGE;
    slider.value = DEFAULT_BLANK_PERCENTAGE;
    
    // Set initial tooltip text
    const tooltip = slider.parentElement.querySelector('.slider-tooltip');
    tooltip.textContent = DEFAULT_BLANK_PERCENTAGE + '%';
    
    // Configure extra words slider
    const extraWordsSlider = document.getElementById('extraWordsSlider');
    const extraWordsTooltip = extraWordsSlider.parentElement.querySelector('.slider-tooltip');
    extraWordsTooltip.textContent = (extraWordsSlider.value * 100) + '%';
    
    // Check if extra words toggle is initially checked and show/hide slider accordingly
    const includeRandomWordsToggle = document.getElementById('includeRandomWords');
    const sliderContainer = document.getElementById('extraWordsSliderContainer');
    if (includeRandomWordsToggle.checked) {
        sliderContainer.style.display = 'flex';
    } else {
        sliderContainer.style.display = 'none';
    }
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
