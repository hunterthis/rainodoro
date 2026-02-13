// Rainodoro - simple Pomodoro with bucket fill and rain sound
const modes = {pomodoro:25*60, short:5*60, long:15*60};
let currentMode = 'pomodoro';
let timerState = {
  pomodoro: {duration:25*60, remaining:25*60},
  short: {duration:5*60, remaining:5*60},
  long: {duration:15*60, remaining:15*60}
};
let duration = timerState[currentMode].duration;
let remaining = timerState[currentMode].remaining;
let timerId = null;
let isRunning = false;

const $time = document.getElementById('time');
const $start = document.getElementById('start');
const $pause = document.getElementById('pause');
const $reset = document.getElementById('reset');
const $water = document.getElementById('water');
const $status = document.getElementById('status');
const $taskForm = document.getElementById('taskForm');
const $taskTitle = document.getElementById('taskTitle');
const $taskList = document.getElementById('taskList');
const $activeTaskDisplay = document.getElementById('activeTaskDisplay');
const $shortBreakForm = document.getElementById('shortBreakForm');
const $shortBreakInput = document.getElementById('shortBreakInput');
const $shortBreakList = document.getElementById('shortBreakList');
const $longBreakForm = document.getElementById('longBreakForm');
const $longBreakInput = document.getElementById('longBreakInput');
const $longBreakList = document.getElementById('longBreakList');
const $focusToggle = document.getElementById('focusToggle');

let focusMode = false;
let timerVisible = true;

// data
let tasks = [];
let activeTaskId = null;
let breaks = {short: [], long: []};
let activeShortBreakId = null;
let activeLongBreakId = null;
let budgets = {pomodoro: 0, short: 0, long: 0};
let pourCounts = {pomodoro: 0, break: 0};

const TASKS_KEY = 'rainodoro_tasks_v1';
const BREAKS_KEY = 'rainodoro_breaks_v1';
const BUDGETS_KEY = 'rainodoro_budgets_v1';
const POURS_KEY = 'rainodoro_pours_v1';

// WebAudio rain noise
let audioCtx, rainGain, rainSource;
let masterVolume = 0.18;
function initAudio(){
  if(audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const bufferSize = audioCtx.sampleRate * 2;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for(let i=0;i<bufferSize;i++) data[i] = (Math.random()*2-1)*0.5;
  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer; noise.loop = true;
  const band = audioCtx.createBiquadFilter();
  band.type = 'bandpass'; band.frequency.value = 1000; band.Q.value = 0.6;
  rainGain = audioCtx.createGain(); rainGain.gain.value = 0.0;
  noise.connect(band); band.connect(rainGain); rainGain.connect(audioCtx.destination);
  rainSource = noise; noise.start();
}
function setRainVolume(scale){ if(!rainGain || !audioCtx) return; const v = (scale||0) * masterVolume; rainGain.gain.setTargetAtTime(v,audioCtx.currentTime,0.05); }

// Water animation effects - particles placed in rain-overlay to avoid water overflow clipping
function createRipple(){ const overlay = document.getElementById('rainOverlay'); if(!overlay) { console.log('Rain overlay not found'); return; } const ripple = document.createElement('div'); ripple.className = 'ripple'; const size = Math.random() * 24 + 12; const left = Math.random() * 100; const top = Math.random() * 60 + 20; ripple.style.width = size + 'px'; ripple.style.height = size + 'px'; ripple.style.left = left + '%'; ripple.style.top = top + '%'; ripple.style.animation = 'ripple 0.8s ease-out forwards'; overlay.appendChild(ripple); console.log('Ripple created at', size + 'px'); setTimeout(() => ripple.remove(), 800); }

function createBubble(){ const overlay = document.getElementById('rainOverlay'); if(!overlay) { console.log('Rain overlay not found for bubble'); return; } const bubble = document.createElement('div'); bubble.className = 'bubble'; const size = Math.random() * 4 + 2.5; const left = Math.random() * 90 + 5; bubble.style.width = size + 'px'; bubble.style.height = size + 'px'; bubble.style.left = left + '%'; bubble.style.bottom = '8%'; bubble.style.animation = `bubble-rise ${Math.random() * 1 + 1}s ease-in forwards`; overlay.appendChild(bubble); console.log('Bubble created at', size + 'px'); setTimeout(() => bubble.remove(), 2000); }

// Pour sound using WebAudio
function playPourSound(){ if(!audioCtx) initAudio(); const ctx = audioCtx; const now = ctx.currentTime; const osc = ctx.createOscillator(); const gain = ctx.createGain(); const filter = ctx.createBiquadFilter(); osc.frequency.setValueAtTime(150,now); osc.frequency.exponentialRampToValueAtTime(50, now+0.3); filter.type='lowpass'; filter.frequency.value=800; osc.connect(filter); filter.connect(gain); gain.connect(ctx.destination); gain.gain.setValueAtTime(0.3,now); gain.gain.exponentialRampToValueAtTime(0.01,now+0.3); osc.start(now); osc.stop(now+0.3); }

function formatTime(s){ const m=Math.floor(s/60); const ss=s%60; return `${m}:${ss.toString().padStart(2,'0')}` }
let previousWaterHeight = 0;
function updateDisplay(){ $time.textContent = formatTime(remaining); const pct = 100*(1 - remaining/duration); $water.style.height = pct + '%';
  // create ripple when water level changes
  if(isRunning && Math.abs(pct - previousWaterHeight) > 0.2){ createRipple(); }
  // create bubbles as water fills (much more frequently for visibility)
  if(isRunning && pct > 10 && Math.random() > 0.3){ createBubble(); }
  previousWaterHeight = pct;
  // update pour button state
  const pourBtn = document.getElementById('pourBtn');
  if(pourBtn){ if(pct >= 99 || remaining <= 0){ pourBtn.disabled = false; } else { pourBtn.disabled = true; } }
  // dynamic volume scaling with fill - only if timer is running and not muted
  if(isRunning && audioCtx && rainGain && !isMuted){ const fillFactor = Math.max(0, Math.min(1, pct/100)); const scaled = 0.15 + 0.85 * fillFactor; setRainVolume(scaled); } else { setRainVolume(0); }
}

function tick(){ if(remaining<=0){ stopTimer(); $status.textContent='Finished'; setRainVolume(0); return; } remaining--; updateDisplay(); }

function startTimer(){ if(isRunning) return; initAudio(); isRunning=true; timerId = setInterval(tick,1000); $start.disabled=true; $pause.disabled=false; $status.textContent='Running'; enableRainAnimation(); }
function pauseTimer(){ if(!isRunning) return; clearInterval(timerId); isRunning=false; $start.disabled=false; $pause.disabled=true; if(audioCtx) setRainVolume(0); $status.textContent='Paused'; disableRainAnimation(); saveTimerState(); }
function stopTimer(){ clearInterval(timerId); isRunning=false; remaining=duration; updateDisplay(); $start.disabled=false; $pause.disabled=true; setRainVolume(0); disableRainAnimation(); saveTimerState(); }

// Pour button behavior
const $pourBtn = document.getElementById('pourBtn');
if($pourBtn){ $pourBtn.addEventListener('click', ()=>{
  playPourSound();
  // animate pour: quickly reset water height
  $water.style.transition = 'height 0.6s ease';
  $water.style.height = '0%';
  setTimeout(()=>{ 
    $water.style.transition = 'height 0.4s linear'; 
    remaining = duration; 
    updateDisplay(); 
    $status.textContent='Poured'; 
    setRainVolume(0); 
    saveTimerState();
    // track pours
    if(currentMode === 'pomodoro'){ pourCounts.pomodoro++; } else { pourCounts.break++; }
    savePours();
    renderPours();
  }, 650);
}); }

// Timer state persistence
function saveTimerState(){ 
  timerState[currentMode].remaining = remaining; 
}
function loadTimerState(){ 
  try{ 
    const raw = localStorage.getItem('rainodoro_timer_v1'); 
    if(raw){ 
      const saved = JSON.parse(raw); 
      Object.keys(saved).forEach(mode=>{ if(timerState[mode]) timerState[mode] = {duration: timerState[mode].duration, remaining: saved[mode].remaining}; }); 
    } 
  }catch(e){} 
}

// Task & break persistence and UI
function loadTasks(){ try{ const raw = localStorage.getItem(TASKS_KEY); tasks = raw ? JSON.parse(raw) : []; activeTaskId = tasks.find(t=>t.isActive)?.id || null; }catch(e){ tasks=[] } renderTasks(); }
function saveTasks(){ localStorage.setItem(TASKS_KEY, JSON.stringify(tasks)); }
function renderTasks(){ $taskList.innerHTML=''; tasks.forEach(t=>{
  const li=document.createElement('li');
  li.dataset.id=t.id;
  const left=document.createElement('div'); left.style.display='flex'; left.style.flexDirection='column';
  const title=document.createElement('div'); title.textContent=t.title;
  const meta=document.createElement('div'); meta.className='task-meta';
  // target controls (decrease / display / increase)
  const targetWrap = document.createElement('div'); targetWrap.className = 'target-controls';
  const minus = document.createElement('button'); minus.textContent = '−'; minus.title = 'Decrease target'; minus.addEventListener('click', ()=>{ changeTarget(t.id, -1); });
  const targetSpan = document.createElement('span'); targetSpan.textContent = `${t.completed || 0}/${t.target || 1}`;
  const plus = document.createElement('button'); plus.textContent = '+'; plus.title = 'Increase target'; plus.addEventListener('click', ()=>{ changeTarget(t.id, 1); });
  targetWrap.appendChild(minus); targetWrap.appendChild(targetSpan); targetWrap.appendChild(plus);
  meta.appendChild(targetWrap);
  left.appendChild(title); left.appendChild(meta);
  const actions=document.createElement('div'); actions.className='task-actions';
  const selectBtn=document.createElement('button'); selectBtn.textContent = (t.id===activeTaskId)?'Active':'Select';
  selectBtn.addEventListener('click', ()=>{ selectTask(t.id); });
  const del=document.createElement('button'); del.textContent='Delete'; del.addEventListener('click', ()=>{ deleteTask(t.id); });
  actions.appendChild(selectBtn); actions.appendChild(del);
  li.appendChild(left); li.appendChild(actions); $taskList.appendChild(li);
}); updateActiveTaskDisplay(); }

function addTask(title){ const id=Date.now().toString(); const t={id,title,target:1,completed:0}; tasks.push(t); saveTasks(); renderTasks(); }
function deleteTask(id){ tasks = tasks.filter(t=>t.id!==id); if(activeTaskId===id) activeTaskId=null; saveTasks(); renderTasks(); }
function changeTarget(id, delta){ const t = tasks.find(x=>x.id===id); if(!t) return; t.target = Math.max(1, (t.target||1) + delta); saveTasks(); renderTasks(); }
function changeBreakTarget(type, id, delta){ const breaks_arr = type === 'short' ? breaks.short : breaks.long; const item = breaks_arr.find(x=>x.id===id); if(!item) return; item.target = Math.max(1, (item.target||1) + delta); saveBreaks(); renderBreaks(); }
function selectTask(id){ activeTaskId = id; saveTasks(); renderTasks(); updateActiveTaskDisplay(); }
function updateActiveTaskDisplay(){ 
  if(currentMode === 'pomodoro'){
    if(!activeTaskId){ $activeTaskDisplay.textContent='No task selected'; return } 
    const t = tasks.find(x=>x.id===activeTaskId); 
    if(!t){ $activeTaskDisplay.textContent='No task selected'; return } 
    $activeTaskDisplay.textContent = t.title
  } else if(currentMode === 'short'){
    if(!activeShortBreakId){ $activeTaskDisplay.textContent='No item selected'; return }
    const it = breaks.short.find(x=>x.id===activeShortBreakId);
    if(!it){ $activeTaskDisplay.textContent='No item selected'; return }
    $activeTaskDisplay.textContent = it.text;
  } else if(currentMode === 'long'){
    if(!activeLongBreakId){ $activeTaskDisplay.textContent='No item selected'; return }
    const it = breaks.long.find(x=>x.id===activeLongBreakId);
    if(!it){ $activeTaskDisplay.textContent='No item selected'; return }
    $activeTaskDisplay.textContent = it.text;
  }
}

function loadBreaks(){ try{ const raw=localStorage.getItem(BREAKS_KEY); breaks = raw ? JSON.parse(raw) : {short:[], long:[]}; }catch(e){ breaks={short:[], long:[]} } renderBreaks(); }
function saveBreaks(){ localStorage.setItem(BREAKS_KEY, JSON.stringify(breaks)); }
function renderBreaks(){ $shortBreakList.innerHTML=''; $longBreakList.innerHTML=''; breaks.short.forEach((it)=>{ const li=document.createElement('li');
  li.dataset.id=it.id;
  const left=document.createElement('div'); left.style.display='flex'; left.style.flexDirection='column';
  const title=document.createElement('div'); title.textContent=it.text;
  const meta=document.createElement('div'); meta.className='task-meta';
  const targetWrap = document.createElement('div'); targetWrap.className = 'target-controls';
  const minus = document.createElement('button'); minus.textContent = '−'; minus.title = 'Decrease target'; minus.addEventListener('click', ()=>{ changeBreakTarget('short', it.id, -1); });
  const targetSpan = document.createElement('span'); targetSpan.textContent = `${it.completed || 0}/${it.target || 1}`;
  const plus = document.createElement('button'); plus.textContent = '+'; plus.title = 'Increase target'; plus.addEventListener('click', ()=>{ changeBreakTarget('short', it.id, 1); });
  targetWrap.appendChild(minus); targetWrap.appendChild(targetSpan); targetWrap.appendChild(plus);
  meta.appendChild(targetWrap);
  left.appendChild(title); left.appendChild(meta);
  const actions=document.createElement('div'); actions.className='task-actions';
  const selectBtn=document.createElement('button'); selectBtn.textContent = (it.id===activeShortBreakId)?'Active':'Select';
  selectBtn.addEventListener('click', ()=>{ activeShortBreakId = it.id; saveBreaks(); renderBreaks(); updateActiveTaskDisplay(); });
  const del=document.createElement('button'); del.textContent='Delete'; del.addEventListener('click', ()=>{ breaks.short = breaks.short.filter(x=>x.id!==it.id); if(activeShortBreakId===it.id) activeShortBreakId=null; saveBreaks(); renderBreaks(); updateActiveTaskDisplay(); });
  actions.appendChild(selectBtn); actions.appendChild(del);
  li.appendChild(left); li.appendChild(actions); $shortBreakList.appendChild(li); });
  breaks.long.forEach((it)=>{ const li=document.createElement('li');
  li.dataset.id=it.id;
  const left=document.createElement('div'); left.style.display='flex'; left.style.flexDirection='column';
  const title=document.createElement('div'); title.textContent=it.text;
  const meta=document.createElement('div'); meta.className='task-meta';
  const targetWrap = document.createElement('div'); targetWrap.className = 'target-controls';
  const minus = document.createElement('button'); minus.textContent = '−'; minus.title = 'Decrease target'; minus.addEventListener('click', ()=>{ changeBreakTarget('long', it.id, -1); });
  const targetSpan = document.createElement('span'); targetSpan.textContent = `${it.completed || 0}/${it.target || 1}`;
  const plus = document.createElement('button'); plus.textContent = '+'; plus.title = 'Increase target'; plus.addEventListener('click', ()=>{ changeBreakTarget('long', it.id, 1); });
  targetWrap.appendChild(minus); targetWrap.appendChild(targetSpan); targetWrap.appendChild(plus);
  meta.appendChild(targetWrap);
  left.appendChild(title); left.appendChild(meta);
  const actions=document.createElement('div'); actions.className='task-actions';
  const selectBtn=document.createElement('button'); selectBtn.textContent = (it.id===activeLongBreakId)?'Active':'Select';
  selectBtn.addEventListener('click', ()=>{ activeLongBreakId = it.id; saveBreaks(); renderBreaks(); updateActiveTaskDisplay(); });
  const del=document.createElement('button'); del.textContent='Delete'; del.addEventListener('click', ()=>{ breaks.long = breaks.long.filter(x=>x.id!==it.id); if(activeLongBreakId===it.id) activeLongBreakId=null; saveBreaks(); renderBreaks(); updateActiveTaskDisplay(); });
  actions.appendChild(selectBtn); actions.appendChild(del);
  li.appendChild(left); li.appendChild(actions); $longBreakList.appendChild(li); }); }

// Budget persistence (pomodoro, short, long counts)
function loadBudgets(){ try{ const raw=localStorage.getItem(BUDGETS_KEY); budgets = raw ? JSON.parse(raw) : {pomodoro:0,short:0,long:0}; }catch(e){ budgets={pomodoro:0,short:0,long:0}; } renderBudgets(); }
function saveBudgets(){ localStorage.setItem(BUDGETS_KEY, JSON.stringify(budgets)); }
function renderBudgets(){ 
  document.getElementById('pomoCount').textContent = budgets.pomodoro;
  document.getElementById('shortCount').textContent = budgets.short;
  document.getElementById('longCount').textContent = budgets.long;
}

// Pour tracking
function loadPours(){ try{ const raw=localStorage.getItem(POURS_KEY); pourCounts = raw ? JSON.parse(raw) : {pomodoro:0,break:0}; }catch(e){ pourCounts={pomodoro:0,break:0}; } renderPours(); }
function savePours(){ localStorage.setItem(POURS_KEY, JSON.stringify(pourCounts)); }
function renderPours(){
  document.getElementById('pomoPours').textContent = pourCounts.pomodoro;
  document.getElementById('breakPours').textContent = pourCounts.break;
}

function savePours(){ localStorage.setItem(POURS_KEY, JSON.stringify(pourCounts)); }

function resetPomoPours(){ pourCounts.pomodoro = 0; savePours(); renderPours(); }
function resetBreakPours(){ pourCounts.break = 0; savePours(); renderPours(); }

// Hook up forms
$taskForm.addEventListener('submit', (e)=>{ e.preventDefault(); const t=$taskTitle.value.trim(); if(!t) return; addTask(t); $taskTitle.value=''; });
$shortBreakForm.addEventListener('submit',(e)=>{ e.preventDefault(); const v=$shortBreakInput.value.trim(); if(!v) return; breaks.short.push({id:Date.now().toString(),text:v,target:1,completed:0}); saveBreaks(); renderBreaks(); $shortBreakInput.value=''; });
$longBreakForm.addEventListener('submit',(e)=>{ e.preventDefault(); const v=$longBreakInput.value.trim(); if(!v) return; breaks.long.push({id:Date.now().toString(),text:v,target:1,completed:0}); saveBreaks(); renderBreaks(); $longBreakInput.value=''; });

// Hook up budget controls
document.getElementById('pomoDec').addEventListener('click', ()=>{ budgets.pomodoro = Math.max(0, budgets.pomodoro-1); saveBudgets(); renderBudgets(); });
document.getElementById('pomoInc').addEventListener('click', ()=>{ budgets.pomodoro++; saveBudgets(); renderBudgets(); });
document.getElementById('shortDec').addEventListener('click', ()=>{ budgets.short = Math.max(0, budgets.short-1); saveBudgets(); renderBudgets(); });
document.getElementById('shortInc').addEventListener('click', ()=>{ budgets.short++; saveBudgets(); renderBudgets(); });
document.getElementById('longDec').addEventListener('click', ()=>{ budgets.long = Math.max(0, budgets.long-1); saveBudgets(); renderBudgets(); });
document.getElementById('longInc').addEventListener('click', ()=>{ budgets.long++; saveBudgets(); renderBudgets(); });

// When a pomodoro finishes, attribute to active task if present
function onPomodoroFinished(){ if(activeTaskId){ const t = tasks.find(x=>x.id===activeTaskId); if(t){ t.completed = (t.completed||0) + 1; saveTasks(); renderTasks(); } } saveTimerState(); }

// update tick to call onPomodoroFinished when finishing a pomodoro
function tick(){ if(remaining<=0){ clearInterval(timerId); isRunning=false; $start.disabled=false; $pause.disabled=true; $status.textContent='Finished'; setRainVolume(0); if(currentMode==='pomodoro'){ onPomodoroFinished(); } return; } remaining--; updateDisplay(); }

// initial load
loadTimerState();
loadTasks(); 
loadBreaks();
loadBudgets();
loadPours();
makeRain();
disableRainAnimation();

document.querySelectorAll('.mode').forEach(b=>b.addEventListener('click',e=>{
  document.querySelectorAll('.mode').forEach(x=>x.classList.remove('active'));
  e.target.classList.add('active');
  const newMode = e.target.dataset.mode;
  // if same mode, do nothing
  if(newMode === currentMode) { return; }
  // save current mode state before switching
  saveTimerState();
  // switch mode
  if(isRunning) pauseTimer();
  currentMode = newMode;
  const state = timerState[currentMode];
  duration = state.duration;
  remaining = state.remaining;
  updateDisplay();
  $status.textContent = currentMode.charAt(0).toUpperCase()+currentMode.slice(1) + ' (paused)';
}));

$start.addEventListener('click', ()=> startTimer());
$pause.addEventListener('click', ()=> pauseTimer());
$reset.addEventListener('click', ()=> stopTimer());

// Reset pour buttons
const $resetPomoPours = document.getElementById('resetPomoPours');
const $resetBreakPours = document.getElementById('resetBreakPours');
if($resetPomoPours) $resetPomoPours.addEventListener('click', resetPomoPours);
if($resetBreakPours) $resetBreakPours.addEventListener('click', resetBreakPours);

const $muteBtn = document.getElementById('muteBtn');
let isMuted = false;
if($muteBtn){ 
  $muteBtn.addEventListener('click', ()=>{ 
    isMuted = !isMuted; 
    if(isMuted){ 
      $volumeControl.value = 0; 
      if(rainGain) setRainVolume(0);
      $muteBtn.textContent = '🔇 Unmute';
    } else { 
      $volumeControl.value = 0.18; 
      masterVolume = 0.18;
      if(isRunning && audioCtx && !isMuted) setRainVolume(0.18);
      $muteBtn.textContent = '🔊 Mute';
    }
  }); 
}

// create some raindrop elements for visual effect
function makeRain(){ const overlay = document.getElementById('rainOverlay'); if(!overlay) return; overlay.innerHTML=''; for(let i=0;i<80;i++){ const d=document.createElement('div'); d.className='raindrop'; d.style.left = (Math.random()*100)+'%'; d.style.top = (Math.random()*10)+'%'; d.style.height = (8+Math.random()*18)+'px'; d.style.animation = `drop ${0.9+Math.random()*1.6}s linear ${Math.random()*1.5}s infinite`; overlay.appendChild(d); } }

// Control raindrop animation
function enableRainAnimation(){ const raindrops = document.querySelectorAll('.raindrop'); raindrops.forEach(d=>d.style.animationPlayState='running'); }
function disableRainAnimation(){ const raindrops = document.querySelectorAll('.raindrop'); raindrops.forEach(d=>d.style.animationPlayState='paused'); }

// volume control hookup
const $volumeControl = document.getElementById('volumeControl'); if($volumeControl){ masterVolume = parseFloat($volumeControl.value); $volumeControl.addEventListener('input', ()=>{ masterVolume = parseFloat($volumeControl.value); updateDisplay(); }); }

// focus mode toggle
if($focusToggle){ $focusToggle.addEventListener('click', ()=>{ focusMode = !focusMode; document.querySelector('.app').classList.toggle('focus-mode', focusMode); $focusToggle.textContent = focusMode ? 'Exit Focus Mode' : 'Ultra Focus Mode'; }); }

// info section toggle
const $infoToggle = document.getElementById('infoToggle');
const $infoSection = document.getElementById('infoSection');
if($infoToggle && $infoSection){ $infoToggle.addEventListener('click', ()=>{ const isVisible = $infoSection.style.display !== 'none'; $infoSection.style.display = isVisible ? 'none' : 'block'; }); }

// timer visibility toggle (available on both pages)
const $timerToggle = document.getElementById('timerToggle');
if($timerToggle){ $timerToggle.addEventListener('click', ()=>{ timerVisible = !timerVisible; document.getElementById('time').style.display = timerVisible ? 'block' : 'none'; $timerToggle.textContent = timerVisible ? 'Hide the Timer' : 'Show the Timer'; }); }
