// =========================================================================
// GLOBAL STATE AND CONSTANTS
// =========================================================================

const STORAGE_KEY = 'englishTestsState';
const THEME_KEY = 'englishTestsTheme';
const STATS_KEY = 'englishTestsStats';
const TIMER_INCREMENT = 60;

// Holds the loaded JSON dataset (single array now)
let exercisesData = [];

// Holds the currently active exercise state
let currentState = {
    exercise: null, 
    isLoadingExercises: false
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
        const res = await fetch('data/exercises.json');
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
    console.log('[DEBUG] getRandomExercise() - Totale esercizi disponibili:', exercisesData.length);
    const enabledExercises = exercisesData.filter(exercise => !isExerciseDisabled(exercise));
    if (enabledExercises.length === 0) return null;

    const unseenEnabled = enabledExercises.filter(exercise => !getExerciseProgress(exercise));
    const pool = unseenEnabled.length > 0 ? unseenEnabled : enabledExercises;
    return pool[Math.floor(Math.random() * pool.length)];
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
    console.log('[DEBUG] Esercizio impostato nello stato, rendering...');
    renderExercise();
}

// =========================================================================
// RENDERING & VALIDATION
// =========================================================================

function renderExercise() {
    if (!currentState.exercise) return;

    const titleEl = document.getElementById('exerciseTitle');
    const headingRowEl = document.getElementById('exerciseHeadingRow');
    const idEl = document.getElementById('exerciseId');
    const container = document.getElementById('exerciseTextContainer');
    const submitBtn = document.getElementById('submitBtn');

    titleEl.textContent = currentState.exercise.title;
    headingRowEl.style.display = 'flex';
    if (currentState.exercise.exerciseId) {
        idEl.textContent = `EXERCISE ID ${currentState.exercise.exerciseId}`;
        idEl.style.display = 'inline-flex';
    } else {
        idEl.style.display = 'none';
    }

    let htmlText = currentState.exercise.text;

    // Replace [GAP_1], [GAP_2] etc. with HTML <select> dropdowns
    currentState.exercise.gaps.forEach(gap => {
        const gapMarker = `[GAP_${gap.id}]`;
        
        let selectHtml = `<select name="gap_${gap.id}" class="blank-select" required>`;
        selectHtml += `<option value="" disabled selected>---</option>`;
        
        gap.options.forEach((option, index) => {
            selectHtml += `<option value="${index}">${option}</option>`;
        });
        selectHtml += `</select>`;

        htmlText = htmlText.replace(gapMarker, selectHtml);
    });

    container.innerHTML = `<p>${htmlText}</p>`;
    submitBtn.disabled = false;

    document.getElementById('exercisePanel').style.display = 'block';
    document.getElementById('resultsPanel').style.display = 'none';
}

function clearBlanks() {
    document.querySelectorAll('.blank-select').forEach(select => {
        select.value = "";
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
        const selectElement = form.querySelector(`select[name="gap_${gap.id}"]`);
        const userSelectedIndex = selectElement ? parseInt(selectElement.value) : -1;
        const isCorrect = userSelectedIndex === gap.correctIndex;

        if (isCorrect) score++;

        resultsData.push({
            gapId: gap.id,
            userSelectedIndex: userSelectedIndex,
            isCorrect: isCorrect,
            correctOptionText: gap.options[gap.correctIndex],
            userOptionText: userSelectedIndex >= 0 ? gap.options[userSelectedIndex] : '[Nessuna Risposta]',
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
    const resultsIdEl = document.getElementById('resultsExerciseId');
    resultsTitleEl.textContent = currentState.exercise.title;
    if (currentState.exercise.exerciseId) {
        resultsIdEl.textContent = `EXERCISE ID ${currentState.exercise.exerciseId}`;
        resultsIdEl.style.display = 'inline-flex';
    } else {
        resultsIdEl.style.display = 'none';
    }

    let htmlText = currentState.exercise.text;
    let feedbackHtml = '';

    currentState.exercise.gaps.forEach((gap, index) => {
        const res = resultsData[index];
        const gapMarker = `[GAP_${gap.id}]`;
        
        let resultSpan = '';
        if (res.isCorrect) {
            resultSpan = `<strong style="color: green;">${res.userOptionText}</strong>`;
        } else {
            resultSpan = `<span style="color: red; text-decoration: line-through;">${res.userOptionText}</span> <strong style="color: green;">(${res.correctOptionText})</strong>`;
        }
        htmlText = htmlText.replace(gapMarker, `[ ${resultSpan} ]`);

        feedbackHtml += `
            <div class="feedback-item">
                <strong>Gap ${gap.id}:</strong> 
                ${res.isCorrect ? '✅ Corretto' : '❌ Errato'} <br>
                <em>Regola:</em> ${res.focus} <br>
                <p style="margin: 5px 0 0 0; color: var(--text-primary);">💡 <em>${res.explanation}</em></p>
            </div>
        `;
    });

    document.getElementById('resultsTextDisplay').innerHTML = htmlText;
    document.getElementById('feedbackList').innerHTML = feedbackHtml;

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
document.getElementById('exerciseForm').addEventListener('submit', checkAnswers);
document.getElementById('toggleExerciseManagerBtn').addEventListener('click', toggleExerciseManagerPanel);
document.getElementById('reactivateAllBtn').addEventListener('click', () => {
    exercisesState.disabledIds = [];
    saveExercisesState();
    renderExerciseManager();
});
document.getElementById('resetExerciseStateBtn').addEventListener('click', () => {
    if (!confirm('Vuoi azzerare stato e punteggi di tutti gli esercizi?')) return;
    exercisesState = {
        disabledIds: [],
        progressById: {}
    };
    saveExercisesState();
    renderExerciseManager();
});

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