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

        // Fetchs a single JSON file containing an array of exercises
        const res = await fetch('data/exercises.json');
        exercisesData = await res.json();

    } catch (error) {
        console.error('Error loading exercises:', error);
        alert('Errore nel caricamento dei test. Assicurati che il file data/exercises.json esista e sia formattato correttamente.');
    } finally {
        currentState.isLoadingExercises = false;
        document.getElementById('getNewTestBtn').disabled = false;
    }
}

function getRandomExercise() {
    return exercisesData.length > 0 ? exercisesData[Math.floor(Math.random() * exercisesData.length)] : null;
}

function generateNewTest() {
    resetTimer();
    if (currentState.isLoadingExercises) return;

    const exercise = getRandomExercise();

    if (!exercise) {
        alert('Nessun esercizio disponibile nel file JSON.');
        return;
    }

    currentState.exercise = exercise;
    renderExercise();
}

// =========================================================================
// RENDERING & VALIDATION
// =========================================================================

function renderExercise() {
    if (!currentState.exercise) return;

    const titleEl = document.getElementById('exerciseTitle');
    const container = document.getElementById('exerciseTextContainer');
    const submitBtn = document.getElementById('submitBtn');

    titleEl.textContent = currentState.exercise.title;
    titleEl.style.display = 'block';

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
    showResults(resultsData, score, totalBlanks);
}

function showResults(resultsData, score, totalBlanks) {
    document.getElementById('scoreDisplay').textContent = score;
    document.getElementById('totalDisplay').textContent = totalBlanks;
    document.getElementById('resultsTitle').textContent = currentState.exercise.title;

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
                <p style="margin: 5px 0 0 0; color: #555;">💡 <em>${res.explanation}</em></p>
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

document.getElementById('backToExerciseBtn').addEventListener('click', () => {
    document.getElementById('exercisePanel').style.display = 'none';
    document.getElementById('resultsPanel').style.display = 'none';
    generateNewTest(); 
});

async function initialize() {
    loadTheme();
    loadStats();
    updateTimerDisplay();
    updateTimerButtons();
    await loadExercises();
}

document.addEventListener('DOMContentLoaded', initialize);