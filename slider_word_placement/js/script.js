// =========================================================================
// GLOBAL STATE AND CONSTANTS
// =========================================================================

const STORAGE_KEY = 'englishTestsStateSlider';
const THEME_KEY = 'englishTestsTheme';
const STATS_KEY = 'englishTestsStats';
const TIMER_INCREMENT = 60;

// Holds the loaded JSON dataset (single array now)
let exercisesData = [];

// Holds the currently active exercise state
let currentState = {
    exercise: null, 
    isLoadingExercises: false,
    selectedAnswers: {},
    choiceCount: 3
};

let exercisesState = {
    disabledIds: [],
    progressById: {}
};

function loadExercisesState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
        const parsed = JSON.parse(raw);
        exercisesState = {
            disabledIds: Array.isArray(parsed.disabledIds) ? parsed.disabledIds : [],
            progressById: parsed.progressById || {}
        };
    } catch (error) {
        console.warn('[WARN] Impossibile leggere lo stato esercizi:', error);
    }
}

function saveExercisesState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(exercisesState));
}

function getExerciseKey(exercise) {
    return exercise.exerciseId ? String(exercise.exerciseId) : exercise.title;
}

function isExerciseDisabled(exercise) {
    return exercisesState.disabledIds.includes(getExerciseKey(exercise));
}

function getExerciseProgress(exercise) {
    return exercisesState.progressById[getExerciseKey(exercise)] || null;
}

function getGapCorrectWord(gap) {
    return gap.options[gap.correctIndex];
}

function getMaxChoiceCount() {
    if (!currentState.exercise || !Array.isArray(currentState.exercise.gaps) || currentState.exercise.gaps.length === 0) {
        return 4;
    }

    return Math.max(...currentState.exercise.gaps.map(gap => gap.options.length));
}

function shuffleArray(items) {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index--) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
}

function clampChoiceCount(choiceCount, maxChoiceCount) {
    const safeMax = Math.max(2, maxChoiceCount || 2);
    const parsedChoiceCount = Number.isFinite(choiceCount) ? choiceCount : 4;
    return Math.min(safeMax, Math.max(2, parsedChoiceCount));
}

function updateChoiceCountDisplay(maxChoiceCount) {
    const slider = document.getElementById('choiceCountSlider');
    const value = document.getElementById('choiceCountValue');
    if (!slider || !value) return;

    const safeChoiceCount = clampChoiceCount(currentState.choiceCount, maxChoiceCount);
    currentState.choiceCount = safeChoiceCount;
    slider.min = '2';
    slider.max = String(Math.max(2, maxChoiceCount || 2));
    slider.value = String(safeChoiceCount);
    value.textContent = String(safeChoiceCount);
}

function getCurrentChoiceCount() {
    return clampChoiceCount(currentState.choiceCount, getMaxChoiceCount());
}

function buildWordBankWords(exercise, choiceCount) {
    const wordBank = [];

    exercise.gaps.forEach(gap => {
        const correctWord = getGapCorrectWord(gap);
        const uniqueOptions = [...new Set(gap.options)];
        const distractors = uniqueOptions.filter(option => option !== correctWord);
        const maxForGap = Math.min(choiceCount, uniqueOptions.length);
        const selectedOptions = shuffleArray([correctWord, ...shuffleArray(distractors).slice(0, Math.max(0, maxForGap - 1))]);
        wordBank.push(...selectedOptions);
    });

    return shuffleArray(wordBank);
}

function renderGapChoices() {
    if (!currentState.exercise) return;

    const totalGaps = currentState.exercise.gaps.length;
    const choiceCount = getCurrentChoiceCount();
    const wordBankContainer = document.getElementById('wordBankContainer');
    const wordBank = buildWordBankWords(currentState.exercise, choiceCount);

    updateChoiceCountDisplay(totalGaps);

    if (!wordBankContainer) return;

    wordBankContainer.innerHTML = '';
    wordBank.forEach(word => {
        const span = document.createElement('span');
        span.textContent = word;
        wordBankContainer.appendChild(span);
    });

    const wordBankTitle = document.querySelector('.word-bank h3');
    if (wordBankTitle) {
        wordBankTitle.textContent = `Word Bank (${choiceCount} choice${choiceCount === 1 ? '' : 's'} per gap)`;
    }
}

function escapeHtml(text) {
    return String(text).replace(/[&<>"]|'/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[character]));
}

function markExerciseCompleted(exercise, score, totalBlanks) {
    const key = getExerciseKey(exercise);
    exercisesState.progressById[key] = {
        lastScore: score,
        lastTotal: totalBlanks
    };

    if (!exercisesState.disabledIds.includes(key)) {
        exercisesState.disabledIds.push(key);
    }

    saveExercisesState();
}

function renderExerciseManager() {
    const list = document.getElementById('exerciseManagerList');
    const poolInfo = document.getElementById('exercisePoolInfo');
    if (!list || !poolInfo) return;

    const enabled = exercisesData.filter(ex => !isExerciseDisabled(ex));
    const notDoneEnabled = enabled.filter(ex => !getExerciseProgress(ex));
    poolInfo.textContent = `Disponibili: ${notDoneEnabled.length}/${enabled.length} nuovi (${exercisesData.length} totali)`;

    list.innerHTML = '';

    exercisesData.forEach(exercise => {
        const key = getExerciseKey(exercise);
        const progress = getExerciseProgress(exercise);
        const disabled = isExerciseDisabled(exercise);
        const item = document.createElement('div');
        item.className = 'exercise-manager-item';

        const main = document.createElement('div');
        main.className = 'exercise-manager-main';

        const idCol = document.createElement('div');
        idCol.className = 'exercise-manager-id';
        idCol.textContent = `ID ${exercise.exerciseId || '-'}`;
        main.appendChild(idCol);

        const title = document.createElement('div');
        title.className = 'exercise-manager-title';
        title.textContent = exercise.title;
        main.appendChild(title);

        const status = document.createElement('div');
        status.className = 'exercise-manager-summary';
        if (progress) {
            status.textContent = `Svolto (${progress.lastScore}/${progress.lastTotal})`;
        } else {
            status.textContent = 'Mai svolto';
        }
        main.appendChild(status);

        const toggleWrap = document.createElement('div');
        toggleWrap.className = 'exercise-toggle-wrap';

        const toggleLabel = document.createElement('label');
        toggleLabel.className = 'exercise-toggle';
        const toggle = document.createElement('input');
        toggle.type = 'checkbox';
        toggle.checked = !disabled;
        toggle.addEventListener('change', () => {
            if (toggle.checked) {
                exercisesState.disabledIds = exercisesState.disabledIds.filter(id => id !== key);
            } else if (!exercisesState.disabledIds.includes(key)) {
                exercisesState.disabledIds.push(key);
            }
            saveExercisesState();
            renderExerciseManager();
        });
        toggleLabel.appendChild(toggle);
        toggleLabel.appendChild(document.createTextNode(''));

        toggleWrap.appendChild(toggleLabel);

        const actions = document.createElement('div');
        actions.className = 'exercise-manager-actions';

        const retryBtn = document.createElement('button');
        retryBtn.type = 'button';
        retryBtn.className = 'retry-btn';
        retryBtn.textContent = progress ? 'Rifai' : 'Apri';
        retryBtn.disabled = disabled;
        retryBtn.addEventListener('click', () => {
            currentState.exercise = exercise;
            renderExercise();
            document.getElementById('resultsPanel').style.display = 'none';
            document.getElementById('exercisePanel').style.display = 'block';
        });

        actions.appendChild(retryBtn);

        item.appendChild(main);
    item.appendChild(toggleWrap);
        item.appendChild(actions);

        list.appendChild(item);
    });
}

function toggleExerciseManagerPanel() {
    const panel = document.getElementById('exerciseManagerPanel');
    panel.classList.toggle('collapsed');
    if (!panel.classList.contains('collapsed')) {
        renderExerciseManager();
    }
}

// =========================================================================
// STATISTICS SYSTEM
// =========================================================================

let userStats = {
    totalExercises: 0,
    totalCorrect: 0,
    totalIncorrect: 0
};

function loadStats() {
    const saved = localStorage.getItem(STATS_KEY);
    if (saved) userStats = { ...userStats, ...JSON.parse(saved) };
    updateStatsDisplay();
}

function saveStats() {
    localStorage.setItem(STATS_KEY, JSON.stringify(userStats));
}

function updateStatsDisplay() {
    const totalAnswers = userStats.totalCorrect + userStats.totalIncorrect;
    const accuracy = totalAnswers > 0 
        ? Math.round((userStats.totalCorrect / totalAnswers) * 100) 
        : 0;
    
    document.getElementById('totalExercises').textContent = userStats.totalExercises;
    document.getElementById('totalCorrect').textContent = userStats.totalCorrect;
    document.getElementById('totalIncorrect').textContent = userStats.totalIncorrect;
    
    const accuracyElement = document.getElementById('accuracyRate');
    accuracyElement.textContent = accuracy + '%';
    
    const red = Math.round(244 - (244 - 76) * (accuracy / 100));   
    const green = Math.round(67 + (175 - 67) * (accuracy / 100));  
    const blue = Math.round(54 - (54 - 80) * (accuracy / 100));    
    
    accuracyElement.style.color = `rgb(${red}, ${green}, ${blue})`;
}

function resetStats() {
    if (confirm('Sei sicuro di voler resettare tutte le statistiche?')) {
        userStats = {
            totalExercises: 0, totalCorrect: 0, totalIncorrect: 0
        };
        saveStats();
        updateStatsDisplay();
    }
}

function updateStatsAfterExercise(score, totalBlanks) {
    userStats.totalExercises++;
    userStats.totalCorrect += score;
    userStats.totalIncorrect += (totalBlanks - score);
    saveStats();
    updateStatsDisplay();
}

function toggleStatsPanel() {
    document.getElementById('statsPanel').classList.toggle('collapsed');
}

// =========================================================================
// TIMER FUNCTIONALITY
// =========================================================================

let timerState = { timeRemaining: 0, presetDuration: 0, isRunning: false, intervalId: null };

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function updateTimerDisplay() {
    document.getElementById('countdownDisplay').textContent = formatTime(timerState.timeRemaining);
}

function updateTimerButtons() {
    document.getElementById('increaseTimeBtn').disabled = timerState.isRunning;
    document.getElementById('decreaseTimeBtn').disabled = timerState.isRunning || timerState.timeRemaining <= 0;
    document.getElementById('startStopBtn').disabled = timerState.timeRemaining <= 0;
    document.getElementById('startStopBtn').textContent = timerState.isRunning ? '⏸️' : '▶️';
}

function startTimer() {
    if (timerState.isRunning || timerState.timeRemaining <= 0) return;
    timerState.isRunning = true;
    timerState.intervalId = setInterval(() => {
        timerState.timeRemaining--;
        updateTimerDisplay();
        if (timerState.timeRemaining <= 0) {
            stopTimer();
            alert('Tempo scaduto!');
        }
    }, 1000);
    updateTimerButtons();
}

function stopTimer() {
    timerState.isRunning = false;
    clearInterval(timerState.intervalId);
    updateTimerButtons();
}

function resetTimer() {
    stopTimer();
    timerState.timeRemaining = timerState.presetDuration;
    updateTimerDisplay();
    updateTimerButtons();
}

// =========================================================================
// THEME MANAGEMENT
// =========================================================================

function toggleTheme() {
    const isLight = document.body.classList.toggle('light-theme');
    document.getElementById('themeToggle').textContent = isLight ? '🌞' : '🌙';
    localStorage.setItem(THEME_KEY, isLight ? 'light' : 'dark');
}

function loadTheme() {
    if (localStorage.getItem(THEME_KEY) === 'light') {
        document.body.classList.add('light-theme');
        document.getElementById('themeToggle').textContent = '🌞';
    }
}

// =========================================================================
// DATA LOADING & EXERCISE GENERATION
// =========================================================================

async function loadExercises() {
    try {
        currentState.isLoadingExercises = true;
        document.getElementById('getNewTestBtn').disabled = true;

        console.log('[DEBUG] Inizio caricamento esercizi...');

        // Fetchs a single JSON file containing an array of exercises
        const res = await fetch('../data/exercises.json');
        console.log('[DEBUG] Risposta fetch:', res.status, res.statusText);
        console.log('[DEBUG] URL caricato:', res.url);

        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }

        exercisesData = await res.json();
        exercisesData.forEach((exercise, index) => {
            if (!exercise.exerciseId) {
                exercise.exerciseId = index + 1;
            }
        });
        console.log('[DEBUG] Esercizi caricati:', exercisesData.length, 'esercizi');
        console.log('[DEBUG] Primo esercizio:', exercisesData[0]);
        renderExerciseManager();

    } catch (error) {
        console.error('[ERROR] Errore nel caricamento degli esercizi:', error);
        console.error('[ERROR] Stack:', error.stack);
        alert('Errore nel caricamento dei test. Assicurati che il file data/exercises.json esista e sia formattato correttamente.');
    } finally {
        currentState.isLoadingExercises = false;
        document.getElementById('getNewTestBtn').disabled = false;
    }
}

function getRandomExercise() {
    if (exercisesData.length === 0) return null;
    return exercisesData[Math.floor(Math.random() * exercisesData.length)];
}

function generateNewTest() {
    console.log('[DEBUG] generateNewTest() - Inizio generazione nuovo test');
    resetTimer();
    if (currentState.isLoadingExercises) {
        console.log('[DEBUG] Esercizi ancora in caricamento, uscita');
        return;
    }

    const exercise = getRandomExercise();
    console.log('[DEBUG] Esercizio selezionato:', exercise);

    if (!exercise) {
        console.warn('[WARN] Nessun esercizio disponibile');
        const enabledExercises = exercisesData.filter(item => !isExerciseDisabled(item));
        if (enabledExercises.length === 0) {
            alert('Tutti gli esercizi sono disattivati. Apri "Gestisci Esercizi" e riattivane almeno uno.');
        } else {
            alert('Hai gia completato tutti gli esercizi attivi almeno una volta. Usa "Gestisci Esercizi" per rifarli o disattivarli/riattivarli.');
        }
        return;
    }

    currentState.exercise = exercise;
    currentState.selectedAnswers = {};
    currentState.choiceCount = clampChoiceCount(currentState.choiceCount || 3, getMaxChoiceCount());
    console.log('[DEBUG] Esercizio impostato nello stato, rendering...');
    renderExercise();
}

// =========================================================================
// RENDERING & VALIDATION
// =========================================================================

function renderExercise() {
    if (!currentState.exercise) return;

    currentState.selectedAnswers = {};

    const titleEl = document.getElementById('exerciseTitle');
    const wordBankContainer = document.getElementById('wordBankContainer');
    const container = document.getElementById('exerciseTextContainer');
    const submitBtn = document.getElementById('submitBtn');

    titleEl.textContent = currentState.exercise.title;
    titleEl.style.display = 'block';

    const maxChoiceCount = getMaxChoiceCount();
    currentState.choiceCount = clampChoiceCount(currentState.choiceCount || 3, maxChoiceCount);
    updateChoiceCountDisplay(maxChoiceCount);

    let htmlText = currentState.exercise.text;

    currentState.exercise.gaps.forEach(gap => {
        const gapMarker = `[GAP_${gap.id}]`;
        const correctWord = getGapCorrectWord(gap);
        const inputWidth = Math.max(90, (correctWord.length + 2) * 10);
        const inputHtml = `<input type="text" name="gap_${gap.id}" class="blank-input" autocomplete="off" placeholder="?" style="width: ${inputWidth}px;">`;

        htmlText = htmlText.replace(gapMarker, inputHtml);
    });

    container.innerHTML = `<p class="slider-exercise-text">${htmlText}</p>`;
    submitBtn.disabled = false;
    renderGapChoices();

    document.getElementById('exercisePanel').style.display = 'block';
    document.getElementById('resultsPanel').style.display = 'none';
}

function clearBlanks() {
    document.querySelectorAll('.blank-input').forEach(input => {
        input.value = '';
    });
}

function checkAnswers(e) {
    e.preventDefault();
    if (!currentState.exercise) return;

    const form = document.getElementById('exerciseForm');
    let score = 0;
    const totalBlanks = currentState.exercise.gaps.length;
    let resultsData = [];

    currentState.exercise.gaps.forEach(gap => {
        const input = form.querySelector(`input[name="gap_${gap.id}"]`);
        const userSelectedWord = input ? input.value.trim() : '';
        const correctWord = getGapCorrectWord(gap);
        const isCorrect = userSelectedWord.toLowerCase() === correctWord.toLowerCase();

        if (isCorrect) score++;

        resultsData.push({
            gapId: gap.id,
            userSelectedWord: userSelectedWord,
            isCorrect: isCorrect,
            correctOptionText: correctWord,
            userOptionText: userSelectedWord || '[Nessuna Risposta]',
            focus: gap.focus,
            explanation: gap.explanation
        });
    });

    updateStatsAfterExercise(score, totalBlanks);
    markExerciseCompleted(currentState.exercise, score, totalBlanks);
    renderExerciseManager();
    showResults(resultsData, score, totalBlanks);
}

function showResults(resultsData, score, totalBlanks) {
    document.getElementById('scoreDisplay').textContent = score;
    document.getElementById('totalDisplay').textContent = totalBlanks;

    const resultsTitleEl = document.getElementById('resultsTitle');
    const resultsContentEl = document.getElementById('resultsContent');
    const originalTextDisplayEl = document.getElementById('originalTextDisplay');
    resultsTitleEl.textContent = currentState.exercise.title;

    const resultsByGapId = new Map(resultsData.map(item => [item.gapId, item]));

    const renderText = (highlightOriginal = false) => {
        const parts = currentState.exercise.text.split(/(\[GAP_\d+\])/g);
        return parts.map(part => {
            const match = part.match(/^\[GAP_(\d+)\]$/);
            if (!match) {
                return part;
            }

            const gapId = parseInt(match[1], 10);
            const result = resultsByGapId.get(gapId);
            if (!result) {
                return part;
            }

            if (highlightOriginal) {
                return `<span class="correct">${escapeHtml(result.correctOptionText)}</span>`;
            }

            if (result.isCorrect) {
                return `<span class="correct">${escapeHtml(result.userOptionText || '')}</span>`;
            }

            return `<span class="incorrect">${escapeHtml(result.userOptionText || '[empty]')} (Correct: ${escapeHtml(result.correctOptionText)})</span>`;
        }).join('');
    };

    resultsContentEl.innerHTML = renderText(false);
    originalTextDisplayEl.innerHTML = renderText(true);

    document.getElementById('exercisePanel').style.display = 'none';
    document.getElementById('resultsPanel').style.display = 'block';
}

// =========================================================================
// EVENT LISTENERS & INITIALIZATION
// =========================================================================

document.getElementById('themeToggle').addEventListener('click', toggleTheme);
document.getElementById('startStopBtn').addEventListener('click', () => timerState.isRunning ? stopTimer() : startTimer());
document.getElementById('increaseTimeBtn').addEventListener('click', () => { timerState.timeRemaining += TIMER_INCREMENT; timerState.presetDuration = timerState.timeRemaining; updateTimerDisplay(); updateTimerButtons();});
document.getElementById('decreaseTimeBtn').addEventListener('click', () => { timerState.timeRemaining = Math.max(0, timerState.timeRemaining - TIMER_INCREMENT); timerState.presetDuration = timerState.timeRemaining; updateTimerDisplay(); updateTimerButtons();});
document.getElementById('resetBtn').addEventListener('click', resetTimer);
document.getElementById('statsToggle').addEventListener('click', toggleStatsPanel);
document.getElementById('resetStatsBtn').addEventListener('click', resetStats);

document.getElementById('getNewTestBtn').addEventListener('click', generateNewTest);
document.getElementById('clearBlanksBtn').addEventListener('click', clearBlanks);
document.getElementById('choiceCountSlider').addEventListener('input', event => {
    currentState.choiceCount = clampChoiceCount(parseInt(event.target.value, 10), currentState.exercise ? getMaxChoiceCount() : 4);
    updateChoiceCountDisplay(currentState.exercise ? getMaxChoiceCount() : 4);
    renderGapChoices();
});
document.getElementById('exerciseForm').addEventListener('submit', checkAnswers);

document.getElementById('backToExerciseBtn').addEventListener('click', () => {
    document.getElementById('exercisePanel').style.display = 'none';
    document.getElementById('resultsPanel').style.display = 'none';
    generateNewTest(); 
});

async function initialize() {
    console.log('[DEBUG] ========== INIZIALIZZAZIONE APPLICAZIONE ==========');
    console.log('[DEBUG] URL della pagina:', window.location.href);
    loadTheme();
    loadStats();
    loadExercisesState();
    updateTimerDisplay();
    updateTimerButtons();
    console.log('[DEBUG] Avvio caricamento esercizi...');
    await loadExercises();
    console.log('[DEBUG] Esercizi caricati, pronto per usare l\'applicazione');
}

document.addEventListener('DOMContentLoaded', initialize);