const DATA_URL = '../data/exercises.json';
const STORAGE_KEY = 'englishTests.dropdown.progress.v1';
let exercises = [];
let currentExercise = null;
const get = (id) => document.getElementById(id);

function readProgress() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (error) { return {}; } }
function writeProgress(progress) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); } catch (error) { /* optional */ } }
function showStatus(message, kind = '') { const status = get('status'); status.textContent = message; status.className = `status${kind ? ` status-${kind}` : ''}`; }
function chooseExercise(exclude = null) {
    if (!exercises.length) return null;
    const available = exercises.length > 1 && exclude
        ? exercises.filter((exercise) => exercise.exerciseId !== exclude.exerciseId)
        : exercises;
    return available[Math.floor(Math.random() * available.length)];
}

function makeAnswerSelect(gap) {
    const select = document.createElement('select');
    select.className = 'answer-select'; select.name = `gap_${gap.id}`; select.id = `gap-${gap.id}`;
    select.setAttribute('aria-label', `Answer for gap ${gap.id}`);
    const empty = document.createElement('option'); empty.value = ''; empty.textContent = 'Choose an answer'; select.appendChild(empty);
    gap.options.forEach((optionText, index) => { const option = document.createElement('option'); option.value = String(index); option.textContent = optionText; select.appendChild(option); });
    return select;
}

function renderAttempt(exercise) {
    currentExercise = exercise;
    const progress = readProgress()[String(exercise.exerciseId)];
    get('exerciseTitle').textContent = exercise.title;
    get('exerciseProgress').textContent = `${exercise.gaps.length} gaps${progress ? ` · Last score ${progress.score}/${progress.total}` : ''}`;
    const container = get('exerciseTextContainer'); container.replaceChildren();
    const paragraph = document.createElement('p');
    exercise.text.split(/(\[GAP_\d+\])/g).forEach((part) => {
        const match = part.match(/^\[GAP_(\d+)\]$/);
        if (!match) { paragraph.appendChild(document.createTextNode(part)); return; }
        const gap = exercise.gaps.find((candidate) => candidate.id === Number(match[1]));
        if (gap) paragraph.appendChild(makeAnswerSelect(gap));
    });
    container.appendChild(paragraph); get('resultsPanel').hidden = true; get('exercisePanel').hidden = false;
    get('submitBtn').disabled = false; showStatus('Exercise ready.'); get('exerciseTitle').focus();
}

function clearAnswers() {
    get('exerciseForm').reset(); showStatus('Answers cleared.');
}

function renderResults(results, score) {
    const unansweredCount = results.filter((result) => result.unanswered).length;
    get('scoreDisplay').textContent = score; get('totalDisplay').textContent = currentExercise.gaps.length;
    get('resultsSummary').textContent = `${score} of ${currentExercise.gaps.length} answers correct.${unansweredCount ? ` ${unansweredCount} unanswered.` : ''}`;
    const text = get('resultsTextDisplay'); text.replaceChildren(); const paragraph = document.createElement('p');
    currentExercise.text.split(/(\[GAP_\d+\])/g).forEach((part) => { const match = part.match(/^\[GAP_(\d+)\]$/); if (!match) { paragraph.appendChild(document.createTextNode(part)); return; } const result = results.find((item) => item.gapId === Number(match[1])); const answer = document.createElement('strong'); answer.textContent = result.answer; answer.className = `result-status ${result.state.toLowerCase()}`; paragraph.appendChild(answer); });
    text.appendChild(paragraph);
    const feedback = get('feedbackList'); feedback.replaceChildren();
    results.forEach((result) => { const item = document.createElement('article'); item.className = `result-item ${result.state.toLowerCase()}`; const heading = document.createElement('p'); const status = document.createElement('span'); status.className = `result-status ${result.state.toLowerCase()}`; status.textContent = `Gap ${result.gapId}: ${result.state}`; heading.appendChild(status); item.appendChild(heading); const detail = document.createElement('p'); detail.textContent = `Your answer: ${result.answer}. Correct answer: ${result.correctAnswer}. Focus: ${result.focus}. ${result.explanation}`; item.appendChild(detail); feedback.appendChild(item); });
    get('exercisePanel').hidden = true; get('resultsPanel').hidden = false; get('resultsHeading').focus(); showStatus('Results ready.');
}

function checkAnswers(event) {
    event.preventDefault(); if (!currentExercise) return;
    const results = currentExercise.gaps.map((gap) => { const value = get(`gap-${gap.id}`).value; const unanswered = value === ''; const selected = unanswered ? null : Number(value); const correct = !unanswered && selected === gap.correctIndex; return { gapId: gap.id, answer: unanswered ? 'No answer' : gap.options[selected], correctAnswer: gap.options[gap.correctIndex], correct, unanswered, state: unanswered ? 'Unanswered' : (correct ? 'Correct' : 'Incorrect'), focus: gap.focus || 'Grammar', explanation: gap.explanation || '' }; });
    const score = results.filter((result) => result.correct).length; const progress = readProgress(); progress[String(currentExercise.exerciseId)] = { score, total: results.length, at: new Date().toISOString() }; writeProgress(progress); renderResults(results, score);
}

async function initialize() {
    try { const response = await fetch(DATA_URL); if (!response.ok) throw new Error(`HTTP ${response.status}`); exercises = await response.json(); if (!Array.isArray(exercises) || !exercises.length) throw new Error('No exercises found'); renderAttempt(chooseExercise()); }
    catch (error) { console.error(error); showStatus('Exercises could not be loaded. Please try again later.', 'error'); }
}

get('exerciseForm').addEventListener('submit', checkAnswers);
get('clearAnswersBtn').addEventListener('click', clearAnswers);
get('backToExerciseBtn').addEventListener('click', () => renderAttempt(chooseExercise(currentExercise)));
window.addEventListener('DOMContentLoaded', initialize);
