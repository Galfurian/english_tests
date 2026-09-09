const INDEX_URL = './data/index.json';
const CONFIG_URL = '../config/site.json';
const STORAGE_KEY = 'englishListeningProgress';

let exerciseIndex = [];
let currentPosition = 0;
let currentExercise = null;
let progress = {};
let toolbar = null;

const el = (id) => document.getElementById(id);

function readProgress() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (error) { return {}; }
}

function saveProgress() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); } catch (error) { /* optional */ }
}

async function loadIndex() {
  const response = await fetch(INDEX_URL);
  if (!response.ok) throw new Error('Unable to load exercise index (' + response.status + ')');
  exerciseIndex = await response.json();
  if (!Array.isArray(exerciseIndex) || !exerciseIndex.length) throw new Error('No listening exercises found.');
}

async function loadExercise(position) {
  currentPosition = ((position % exerciseIndex.length) + exerciseIndex.length) % exerciseIndex.length;
  const entry = exerciseIndex[currentPosition];
  const response = await fetch(entry.data);
  if (!response.ok) throw new Error('Unable to load ' + entry.data + ' (' + response.status + ')');
  currentExercise = await response.json();
  renderExercise();
}

function hasAnswers() {
  return [...document.querySelectorAll('#questionsContainer select')].some((select) => select.value !== '');
}

function changeExercise(position) {
  if (position === currentPosition) return true;
  if (!el('exercisePanel').hidden && hasAnswers() && !window.confirm('Change exercise and discard the current answers?')) return false;
  loadExercise(position).catch(showError);
  return true;
}

function renderExercise() {
  el('loadingPanel').hidden = true;
  el('resultsPanel').hidden = true;
  el('exercisePanel').hidden = false;
  const saved = progress[currentExercise.exerciseId];
  el('scoreSummary').textContent = saved ? 'Last score: ' + saved.score + '/' + saved.total : 'Not attempted';
  el('levelBadge').textContent = currentExercise.level || 'B2';
  el('exerciseTitle').textContent = currentExercise.title;
  el('exerciseInstructions').textContent = currentExercise.instructions || 'Listen and select the best answer for each item.';
  el('audioMeta').textContent = currentExercise.audio?.description || 'Play the recording when you are ready.';
  toolbar?.update(currentPosition);

  const player = el('audioPlayer');
  player.pause();
  player.src = currentExercise.audio.url;
  player.load();
  const audioError = el('audioError');
  audioError.hidden = true;
  player.onerror = () => { audioError.textContent = 'Audio is not available for this exercise.'; audioError.hidden = false; };

  const questions = el('questionsContainer');
  questions.replaceChildren();
  currentExercise.questions.forEach((question, index) => {
    const card = document.createElement('div');
    card.className = 'question-card';
    const label = document.createElement('label');
    label.htmlFor = 'question-' + question.id;
    label.textContent = (index + 1) + '. ' + question.prompt;
    const select = document.createElement('select');
    select.id = 'question-' + question.id;
    select.name = 'question-' + question.id;
    select.required = true;
    select.setAttribute('aria-label', 'Answer for question ' + (index + 1));
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = 'Choose the best answer…';
    empty.selected = true;
    empty.disabled = true;
    select.appendChild(empty);
    question.options.forEach((optionText, optionIndex) => {
      const option = document.createElement('option');
      option.value = String(optionIndex);
      option.textContent = optionText;
      select.appendChild(option);
    });
    card.append(label, select);
    questions.appendChild(card);
  });
  el('exerciseTitle').focus();
}

function checkAnswers(event) {
  event.preventDefault();
  let score = 0;
  const feedback = [];
  for (const [index, question] of currentExercise.questions.entries()) {
    const select = el('question-' + question.id);
    if (select.value === '') { select.reportValidity(); return; }
    const selected = Number(select.value);
    const correct = selected === question.correctIndex;
    if (correct) score++;
    feedback.push({ index, question, selected, correct });
  }
  progress[currentExercise.exerciseId] = { score, total: currentExercise.questions.length, at: new Date().toISOString() };
  saveProgress();
  renderResults(score, feedback);
}

function renderResults(score, feedback) {
  el('exercisePanel').hidden = true;
  el('resultsPanel').hidden = false;
  el('scoreValue').textContent = score;
  el('scoreTotal').textContent = currentExercise.questions.length;
  el('scoreSummary').textContent = 'Last score: ' + score + '/' + currentExercise.questions.length;
  const container = el('feedbackContainer');
  container.replaceChildren();
  feedback.forEach(({ index, question, selected, correct }) => {
    const item = document.createElement('article');
    item.className = 'feedback-item ' + (correct ? 'correct' : 'incorrect');
    const heading = document.createElement('strong');
    heading.textContent = (index + 1) + '. ' + (correct ? 'Correct' : 'Incorrect');
    const detail = document.createElement('p');
    detail.textContent = 'Your answer: ' + question.options[selected] + (correct ? '' : '. Best answer: ' + question.options[question.correctIndex] + '.') + ' ' + (question.explanation || '');
    item.append(heading, detail);
    container.appendChild(item);
  });
  const transcript = el('transcriptContainer');
  transcript.replaceChildren();
  (currentExercise.transcript || []).forEach((line) => {
    const paragraph = document.createElement('p');
    paragraph.className = 'transcript-line';
    const speaker = currentExercise.entities?.[line.entity]?.name || line.entity;
    const name = document.createElement('strong');
    name.textContent = speaker + ': ';
    paragraph.append(name, document.createTextNode(line.text));
    transcript.appendChild(paragraph);
  });
  el('transcriptDetails').open = false;
  el('resultsHeading').focus();
}

function clearAnswers() { el('questionForm').reset(); }
function showError(error) { console.error(error); el('loadingPanel').hidden = false; el('exercisePanel').hidden = true; el('loadingPanel').textContent = 'Error: ' + error.message; }

async function initialize() {
  try {
    progress = readProgress();
    const config = await window.EnglishTestsSiteConfig.load(CONFIG_URL);
    const configuredExercise = window.EnglishTestsSiteConfig.getExercise(config, 'listening');
    if (configuredExercise && configuredExercise.enabled === false) { el('loadingPanel').textContent = 'This exercise is currently unavailable.'; return; }
    const features = config.loaded === false ? { exerciseSelector: true, progress: true, timer: false } : window.EnglishTestsSiteConfig.resolveFeatures(config, 'listening');
    await loadIndex();
    toolbar = window.EnglishTestsToolbar.mount(el('exerciseToolbar'), { exercises: exerciseIndex, currentIndex: 0, features, onExerciseChange: changeExercise });
    await loadExercise(0);
  } catch (error) { showError(error); }
}

el('questionForm').addEventListener('submit', checkAnswers);
el('resetAnswersBtn').addEventListener('click', clearAnswers);
el('retryBtn').addEventListener('click', () => renderExercise());
el('nextExerciseBtn').addEventListener('click', () => loadExercise(currentPosition + 1).catch(showError));
window.addEventListener('DOMContentLoaded', initialize);
