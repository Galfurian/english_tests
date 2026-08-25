const INDEX_URL = './data/index.json';
const STORAGE_KEY = 'englishListeningProgress';
const THEME_KEY = 'englishTestsTheme';

let exerciseIndex = [];
let currentPosition = 0;
let currentExercise = null;
let progress = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');

const el = id => document.getElementById(id);

function applyTheme(){
  if(localStorage.getItem(THEME_KEY)==='light') document.body.classList.add('light');
  el('themeToggle').textContent=document.body.classList.contains('light')?'☀':'☾';
}

function toggleTheme(){
  document.body.classList.toggle('light');
  localStorage.setItem(THEME_KEY,document.body.classList.contains('light')?'light':'dark');
  applyTheme();
}

function populateExercisePicker(){
  const picker=el('exercisePicker');
  picker.innerHTML='';
  exerciseIndex.forEach((entry,index)=>{
    const option=document.createElement('option');
    const number=entry.exerciseId.split('-').pop();
    option.value=String(index);
    option.textContent=`#${number} · ${entry.title}`;
    picker.appendChild(option);
  });
}

async function loadIndex(){
  const res=await fetch(INDEX_URL);
  if(!res.ok) throw new Error(`Unable to load exercise index (${res.status})`);
  exerciseIndex=await res.json();
  if(!Array.isArray(exerciseIndex)||!exerciseIndex.length) throw new Error('No listening exercises found.');
  populateExercisePicker();
}

async function loadExercise(position){
  currentPosition=((position%exerciseIndex.length)+exerciseIndex.length)%exerciseIndex.length;
  const entry=exerciseIndex[currentPosition];
  const res=await fetch(entry.data);
  if(!res.ok) throw new Error(`Unable to load ${entry.data} (${res.status})`);
  currentExercise=await res.json();
  renderExercise();
}

function renderExercise(){
  el('loadingPanel').hidden=true;
  el('resultsPanel').hidden=true;
  el('exercisePanel').hidden=false;
  el('exerciseCounter').textContent=`Exercise ${currentPosition+1} / ${exerciseIndex.length}`;
  el('exercisePicker').value=String(currentPosition);
  const saved=progress[currentExercise.exerciseId];
  el('scoreSummary').textContent=saved?`Last score: ${saved.score}/${saved.total}`:'Not attempted';
  el('levelBadge').textContent=currentExercise.level||'B2';
  el('exerciseTitle').textContent=currentExercise.title;
  el('exerciseInstructions').textContent=currentExercise.instructions||'Listen and select the best answer for each item.';
  el('audioMeta').textContent=currentExercise.audio?.description||'Play the recording when you are ready.';

  const player=el('audioPlayer');
  const audioError=el('audioError');
  audioError.hidden=true;
  player.src=currentExercise.audio.url;
  player.load();
  player.onerror=()=>{
    audioError.textContent='Audio is not available yet. Upload the MP3 release asset specified by this exercise.';
    audioError.hidden=false;
  };

  const questions=el('questionsContainer');
  questions.innerHTML='';
  currentExercise.questions.forEach((q,index)=>{
    const card=document.createElement('div');
    card.className='question-card';
    const label=document.createElement('label');
    label.htmlFor=`question-${q.id}`;
    label.innerHTML=`<span class="question-number">${index+1}.</span>${escapeHtml(q.prompt)}`;
    const select=document.createElement('select');
    select.id=`question-${q.id}`;
    select.name=`question-${q.id}`;
    select.required=true;
    select.innerHTML='<option value="" selected disabled>Choose the best answer…</option>';
    q.options.forEach((option,i)=>{
      const opt=document.createElement('option'); opt.value=String(i); opt.textContent=option; select.appendChild(opt);
    });
    card.append(label,select); questions.appendChild(card);
  });
}

function escapeHtml(value){
  return String(value).replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}

function checkAnswers(event){
  event.preventDefault();
  let score=0;
  const feedback=[];
  for(const [index,q] of currentExercise.questions.entries()){
    const select=el(`question-${q.id}`);
    if(select.value===''){select.reportValidity();return;}
    const selected=Number(select.value);
    const correct=selected===q.correctIndex;
    if(correct) score++;
    feedback.push({index,q,selected,correct});
  }
  progress[currentExercise.exerciseId]={score,total:currentExercise.questions.length,at:new Date().toISOString()};
  localStorage.setItem(STORAGE_KEY,JSON.stringify(progress));
  renderResults(score,feedback);
}

function renderResults(score,feedback){
  el('exercisePanel').hidden=true;
  el('resultsPanel').hidden=false;
  el('scoreValue').textContent=score;
  el('scoreTotal').textContent=currentExercise.questions.length;
  el('scoreSummary').textContent=`Last score: ${score}/${currentExercise.questions.length}`;
  const container=el('feedbackContainer'); container.innerHTML='';
  feedback.forEach(({index,q,selected,correct})=>{
    const item=document.createElement('div');
    item.className=`feedback-item ${correct?'correct':'incorrect'}`;
    item.innerHTML=`<strong>${index+1}. ${correct?'Correct':'Incorrect'}</strong><p>Your answer: ${escapeHtml(q.options[selected])}<br>${correct?'':`Best answer: ${escapeHtml(q.options[q.correctIndex])}<br>`}${escapeHtml(q.explanation||'')}</p>`;
    container.appendChild(item);
  });
  const transcript=el('transcriptContainer'); transcript.innerHTML='';
  (currentExercise.transcript||[]).forEach(line=>{
    const p=document.createElement('p'); p.className='transcript-line';
    const speaker=currentExercise.entities?.[line.entity]?.name||line.entity;
    p.innerHTML=`<strong>${escapeHtml(speaker)}:</strong> ${escapeHtml(line.text)}`;
    transcript.appendChild(p);
  });
  el('transcriptDetails').open=false;
  window.scrollTo({top:0,behavior:'smooth'});
}

function clearAnswers(){
  document.querySelectorAll('#questionForm select').forEach(s=>s.value='');
}

async function initialize(){
  try{
    applyTheme();
    await loadIndex();
    await loadExercise(0);
  }catch(error){
    console.error(error);
    el('loadingPanel').textContent=`Error: ${error.message}`;
  }
}

el('themeToggle').addEventListener('click',toggleTheme);
el('exercisePicker').addEventListener('change',event=>loadExercise(Number(event.target.value)));
el('questionForm').addEventListener('submit',checkAnswers);
el('resetAnswersBtn').addEventListener('click',clearAnswers);
el('retryBtn').addEventListener('click',()=>renderExercise());
el('nextExerciseBtn').addEventListener('click',()=>loadExercise(currentPosition+1));
document.addEventListener('DOMContentLoaded',initialize);
