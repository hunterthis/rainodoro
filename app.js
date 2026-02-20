// Rainodoro - simple Pomodoro with bucket fill and rain sound
const modes = {pomodoro:25*60, short:5*60};
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
const $breakPlusTenBtn = document.getElementById('breakPlusTenBtn');
const $focusToggle = document.getElementById('focusToggle');
const $finishTaskBtn = document.getElementById('finishTaskBtn');

let focusMode = false;
let timerVisible = true;
let toastHideTimer = null;

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
const TIMER_STATE_KEY = 'rainodoro_timer_v1';
const BREAK_PLUS_TEN_KEY = 'rainodoro_break_plus_ten_v1';

// WebAudio rain noise
let audioCtx, rainGain, rainSource;
let masterVolume = 0.18;
let breakPlusTen = false;
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

function tick(){ if(remaining<=0){ stopTimer(); $status.textContent='Finished'; setRainVolume(0); return; } remaining--; updateDisplay(); saveTimerState(); }

function startTimer(){ if(isRunning) return; initAudio(); isRunning=true; timerId = setInterval(tick,1000); $start.disabled=true; $pause.disabled=false; $status.textContent='Running'; enableRainAnimation(); }
function pauseTimer(){ if(!isRunning) return; clearInterval(timerId); isRunning=false; $start.disabled=false; $pause.disabled=true; if(audioCtx) setRainVolume(0); $status.textContent='Paused'; disableRainAnimation(); saveTimerState(); }
function stopTimer(){ clearInterval(timerId); isRunning=false; remaining=duration; updateDisplay(); $start.disabled=false; $pause.disabled=true; setRainVolume(0); disableRainAnimation(); saveTimerState(); }

function getBreakDurationSeconds(){ return (breakPlusTen ? 15 : 5) * 60; }
function updateBreakPlusTenButton(){
  if(!$breakPlusTenBtn) return;
  $breakPlusTenBtn.textContent = breakPlusTen ? '+10 Min Break: On' : '+10 Min Break: Off';
}
function applyBreakDuration(adjustRemaining = true){
  const prevDuration = timerState.short.duration;
  const nextDuration = getBreakDurationSeconds();
  timerState.short.duration = nextDuration;
  updateBreakPlusTenButton();
  if(currentMode !== 'short') return;
  duration = nextDuration;
  if(adjustRemaining){
    const elapsed = Math.max(0, prevDuration - remaining);
    remaining = Math.max(0, nextDuration - elapsed);
  }
  updateDisplay();
  saveTimerState();
}
function loadBreakPlusTenPreference(){
  try{ breakPlusTen = localStorage.getItem(BREAK_PLUS_TEN_KEY) === '1'; }
  catch(e){ breakPlusTen = false; }
  updateBreakPlusTenButton();
  applyBreakDuration(false);
}

function showToast(message){
  let toast = document.getElementById('toastAlert');
  if(!toast){
    toast = document.createElement('div');
    toast.id = 'toastAlert';
    toast.className = 'toast-alert';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastHideTimer);
  toastHideTimer = setTimeout(()=>{ toast.classList.remove('show'); }, 2600);
}

function updateFinishButtonLabel(){
  if(!$finishTaskBtn) return;
  if(currentMode === 'pomodoro'){
    $finishTaskBtn.textContent = 'Finished Task';
    $finishTaskBtn.title = 'Finish Pomodoro Task';
  } else {
    $finishTaskBtn.textContent = 'Finished Break';
    $finishTaskBtn.title = 'Finish Break Item';
  }
}

function updateFinishButtonState(){
  if(!$finishTaskBtn) return;
  if(currentMode === 'pomodoro'){
    $finishTaskBtn.disabled = !activeTaskId;
    return;
  }
  if(currentMode === 'short'){
    $finishTaskBtn.disabled = !activeShortBreakId;
    return;
  }
  if(currentMode === 'long'){
    $finishTaskBtn.disabled = !activeLongBreakId;
    return;
  }
  $finishTaskBtn.disabled = true;
}

function setMode(newMode, options = {}){
  const {reset = false, statusText = ''} = options;
  if(!timerState[newMode]) return;
  if(isRunning) pauseTimer();
  if(newMode !== currentMode) saveTimerState();
  currentMode = newMode;
  if(reset){ timerState[currentMode].remaining = timerState[currentMode].duration; }
  const state = timerState[currentMode];
  duration = state.duration;
  remaining = state.remaining;
  document.querySelectorAll('.mode').forEach(btn=>{
    btn.classList.toggle('active', btn.dataset.mode === currentMode);
  });
  updateDisplay();
  $status.textContent = statusText || (currentMode.charAt(0).toUpperCase()+currentMode.slice(1) + ' (paused)');
  updateFormsVisibility();
  updateActiveTaskDisplay();
  updateFinishButtonLabel();
  updateFinishButtonState();
  saveTimerState();
}

function handlePomodoroCompletion(){
  onPomodoroFinished();
  showToast('Pomodoro finished — now it\'s time for a short break.');
  setMode('short', {reset:true, statusText:'Short break (ready)'});
}

function onBreakFinished(){
  if(currentMode === 'short'){
    const item = breaks.short.find(x=>x.id===activeShortBreakId);
    if(item){ item.completed = (item.completed||0) + 1; saveBreaks(); renderBreaks(); }
  } else if(currentMode === 'long'){
    const item = breaks.long.find(x=>x.id===activeLongBreakId);
    if(item){ item.completed = (item.completed||0) + 1; saveBreaks(); renderBreaks(); }
  }
  saveTimerState();
}

function finishCurrentItem(){
  if(isRunning){ clearInterval(timerId); isRunning=false; }
  remaining = 0;
  updateDisplay();
  const pourBtn = document.getElementById('pourBtn');
  if(pourBtn) pourBtn.disabled = false;
  $start.disabled = false;
  $pause.disabled = true;
  setRainVolume(0);
  disableRainAnimation();
  if(currentMode === 'pomodoro'){
    handlePomodoroCompletion();
    return;
  }
  if(currentMode === 'short' || currentMode === 'long'){
    onBreakFinished();
    $status.textContent = 'Break finished';
    showToast('Break finished.');
  }
}

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
  try{
    const payload = {
      currentMode,
      states: {
        pomodoro: {remaining: timerState.pomodoro.remaining},
        short: {remaining: timerState.short.remaining},
        long: {remaining: timerState.long.remaining}
      }
    };
    localStorage.setItem(TIMER_STATE_KEY, JSON.stringify(payload));
  }catch(e){}
}
function loadTimerState(){ 
  try{ 
    const raw = localStorage.getItem(TIMER_STATE_KEY); 
    if(raw){ 
      const saved = JSON.parse(raw);
      if(saved && saved.currentMode && timerState[saved.currentMode]) currentMode = saved.currentMode;
      if(currentMode === 'long') currentMode = 'short';
      if(saved && saved.states){
        Object.keys(saved.states).forEach(mode=>{
          if(timerState[mode] && typeof saved.states[mode].remaining === 'number'){
            timerState[mode].remaining = saved.states[mode].remaining;
          }
        });
      } else if(saved){
        Object.keys(saved).forEach(mode=>{ if(timerState[mode] && saved[mode] && typeof saved[mode].remaining === 'number') timerState[mode].remaining = saved[mode].remaining; });
      }
    } 
  }catch(e){} 
}

// Task & break persistence and UI
function loadTasks(){ try{ const raw = localStorage.getItem(TASKS_KEY); tasks = raw ? JSON.parse(raw) : []; activeTaskId = tasks.find(t=>t.isActive)?.id || null; }catch(e){ tasks=[] } renderTasks(); }
function saveTasks(){ localStorage.setItem(TASKS_KEY, JSON.stringify(tasks)); }
function hasSortable(){ return typeof Sortable !== 'undefined'; }
function isTouchDevice(){
  return window.matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
}
function reorderFromDom(listType, listEl){
  const list = getListByType(listType);
  if(!list) return;
  const ids = Array.from(listEl.children).map(li=>li.dataset.id);
  if(ids.length === 0) return;
  const map = new Map(list.map(item=>[item.id, item]));
  const reordered = ids.map(id=>map.get(id)).filter(Boolean);
  list.forEach(item=>{ if(!ids.includes(item.id)) reordered.push(item); });
  if(listType === 'tasks'){ tasks = reordered; saveTasks(); renderTasks(); }
  else if(listType === 'shortBreaks'){ breaks.short = reordered; saveBreaks(); renderBreaks(); }
  else if(listType === 'longBreaks'){ breaks.long = reordered; saveBreaks(); renderBreaks(); }
  updateActiveTaskDisplay();
}
function setupSortable(){
  if(isTouchDevice()) return;
  if(!hasSortable()) return;
  if($taskList){
    Sortable.create($taskList, {
      animation: 150,
      delayOnTouchOnly: true,
      delay: 150,
      touchStartThreshold: 6,
      filter: 'button, input, textarea, select, option',
      preventOnFilter: false,
      onEnd: (evt)=>{ if(evt.oldIndex == null || evt.newIndex == null) return; reorderFromDom('tasks', $taskList); }
    });
  }
  if($shortBreakList){
    Sortable.create($shortBreakList, {
      animation: 150,
      delayOnTouchOnly: true,
      delay: 150,
      touchStartThreshold: 6,
      filter: 'button, input, textarea, select, option',
      preventOnFilter: false,
      onEnd: (evt)=>{ if(evt.oldIndex == null || evt.newIndex == null) return; reorderFromDom('shortBreaks', $shortBreakList); }
    });
  }
  if($longBreakList){
    Sortable.create($longBreakList, {
      animation: 150,
      delayOnTouchOnly: true,
      delay: 150,
      touchStartThreshold: 6,
      filter: 'button, input, textarea, select, option',
      preventOnFilter: false,
      onEnd: (evt)=>{ if(evt.oldIndex == null || evt.newIndex == null) return; reorderFromDom('longBreaks', $longBreakList); }
    });
  }
}
function getDragData(event){
  try{ return JSON.parse(event.dataTransfer.getData('text/plain')); }
  catch(e){ return null; }
}
function getListByType(listType){
  if(listType === 'tasks') return tasks;
  if(listType === 'shortBreaks') return breaks.short;
  if(listType === 'longBreaks') return breaks.long;
  return null;
}
function moveItem(listType, fromIndex, toIndex){
  const list = getListByType(listType);
  if(!list || fromIndex < 0 || fromIndex >= list.length) return;
  const [item] = list.splice(fromIndex, 1);
  const maxIndex = list.length;
  const targetIndex = Math.max(0, Math.min(maxIndex, toIndex));
  list.splice(targetIndex, 0, item);
  if(listType === 'tasks'){ saveTasks(); renderTasks(); }
  else { saveBreaks(); renderBreaks(); }
  updateActiveTaskDisplay();
}
function setupListDropZone(listEl, listType){
  if(hasSortable()) return;
  if(listEl.dataset.dropzone === 'true') return;
  listEl.dataset.dropzone = 'true';
  listEl.addEventListener('dragover', (event)=>{ event.preventDefault(); });
  listEl.addEventListener('drop', (event)=>{
    event.preventDefault();
    const data = getDragData(event);
    if(!data || data.list !== listType) return;
    const list = getListByType(listType);
    if(!list) return;
    moveItem(listType, data.index, list.length);
  });
}
function setupDragHandlers(li, listType, index){
  if(hasSortable()) return;
  li.classList.add('draggable-item');
  li.draggable = true;
  li.addEventListener('dragstart', (event)=>{
    if(event.target.closest('button')){ event.preventDefault(); return; }
    li.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', JSON.stringify({list: listType, index}));
  });
  li.addEventListener('dragend', ()=>{ li.classList.remove('dragging'); });
  li.addEventListener('dragover', (event)=>{ event.preventDefault(); event.dataTransfer.dropEffect = 'move'; });
  li.addEventListener('drop', (event)=>{
    event.preventDefault();
    const data = getDragData(event);
    if(!data || data.list !== listType) return;
    const from = data.index;
    const to = index;
    if(from === to) return;
    moveItem(listType, from, to);
  });
  li.querySelectorAll('button').forEach(btn=>{ btn.draggable = false; });
}
function renderTasks(){ setupListDropZone($taskList, 'tasks'); $taskList.innerHTML=''; tasks.forEach((t, index)=>{
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
  li.appendChild(left); li.appendChild(actions);
  setupDragHandlers(li, 'tasks', index);
  $taskList.appendChild(li);
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
  updateFinishButtonState();
}

function loadBreaks(){ try{ const raw=localStorage.getItem(BREAKS_KEY); breaks = raw ? JSON.parse(raw) : {short:[], long:[]}; }catch(e){ breaks={short:[], long:[]} } renderBreaks(); }
function saveBreaks(){ localStorage.setItem(BREAKS_KEY, JSON.stringify(breaks)); }
function renderBreaks(){
  if($shortBreakList){
    setupListDropZone($shortBreakList, 'shortBreaks');
    $shortBreakList.innerHTML='';
  }
  if($longBreakList){
    setupListDropZone($longBreakList, 'longBreaks');
    $longBreakList.innerHTML='';
  }
  breaks.short.forEach((it, index)=>{ const li=document.createElement('li');
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
  selectBtn.addEventListener('click', ()=>{ activeShortBreakId = it.id; saveBreaks(); renderBreaks(); updateActiveTaskDisplay(); updateFinishButtonState(); });
  const del=document.createElement('button'); del.textContent='Delete'; del.addEventListener('click', ()=>{ breaks.short = breaks.short.filter(x=>x.id!==it.id); if(activeShortBreakId===it.id) activeShortBreakId=null; saveBreaks(); renderBreaks(); updateActiveTaskDisplay(); updateFinishButtonState(); });
  actions.appendChild(selectBtn); actions.appendChild(del);
  li.appendChild(left); li.appendChild(actions);
  setupDragHandlers(li, 'shortBreaks', index);
  if($shortBreakList) $shortBreakList.appendChild(li); });
  if(!$longBreakList) return;
  breaks.long.forEach((it, index)=>{ const li=document.createElement('li');
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
  selectBtn.addEventListener('click', ()=>{ activeLongBreakId = it.id; saveBreaks(); renderBreaks(); updateActiveTaskDisplay(); updateFinishButtonState(); });
  const del=document.createElement('button'); del.textContent='Delete'; del.addEventListener('click', ()=>{ breaks.long = breaks.long.filter(x=>x.id!==it.id); if(activeLongBreakId===it.id) activeLongBreakId=null; saveBreaks(); renderBreaks(); updateActiveTaskDisplay(); updateFinishButtonState(); });
  actions.appendChild(selectBtn); actions.appendChild(del);
  li.appendChild(left); li.appendChild(actions);
  setupDragHandlers(li, 'longBreaks', index);
  $longBreakList.appendChild(li); }); }

// Budget persistence (pomodoro, short, long counts)
function loadBudgets(){ try{ const raw=localStorage.getItem(BUDGETS_KEY); budgets = raw ? JSON.parse(raw) : {pomodoro:0,short:0,long:0}; }catch(e){ budgets={pomodoro:0,short:0,long:0}; } renderBudgets(); }
function saveBudgets(){ localStorage.setItem(BUDGETS_KEY, JSON.stringify(budgets)); }
function renderBudgets(){ 
  const $pomoCount = document.getElementById('pomoCount');
  const $shortCount = document.getElementById('shortCount');
  const $longCount = document.getElementById('longCount');
  if($pomoCount) $pomoCount.textContent = budgets.pomodoro;
  if($shortCount) $shortCount.textContent = budgets.short;
  if($longCount) $longCount.textContent = budgets.long;
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
if($shortBreakForm && $shortBreakInput){ $shortBreakForm.addEventListener('submit',(e)=>{ e.preventDefault(); const v=$shortBreakInput.value.trim(); if(!v) return; breaks.short.push({id:Date.now().toString(),text:v,target:1,completed:0}); saveBreaks(); renderBreaks(); $shortBreakInput.value=''; }); }
if($longBreakForm && $longBreakInput){ $longBreakForm.addEventListener('submit',(e)=>{ e.preventDefault(); const v=$longBreakInput.value.trim(); if(!v) return; breaks.long.push({id:Date.now().toString(),text:v,target:1,completed:0}); saveBreaks(); renderBreaks(); $longBreakInput.value=''; }); }

// Hook up budget controls
const $pomoDec = document.getElementById('pomoDec');
const $pomoInc = document.getElementById('pomoInc');
const $shortDec = document.getElementById('shortDec');
const $shortInc = document.getElementById('shortInc');
const $longDec = document.getElementById('longDec');
const $longInc = document.getElementById('longInc');
if($pomoDec) $pomoDec.addEventListener('click', ()=>{ budgets.pomodoro = Math.max(0, budgets.pomodoro-1); saveBudgets(); renderBudgets(); });
if($pomoInc) $pomoInc.addEventListener('click', ()=>{ budgets.pomodoro++; saveBudgets(); renderBudgets(); });
if($shortDec) $shortDec.addEventListener('click', ()=>{ budgets.short = Math.max(0, budgets.short-1); saveBudgets(); renderBudgets(); });
if($shortInc) $shortInc.addEventListener('click', ()=>{ budgets.short++; saveBudgets(); renderBudgets(); });
if($longDec) $longDec.addEventListener('click', ()=>{ budgets.long = Math.max(0, budgets.long-1); saveBudgets(); renderBudgets(); });
if($longInc) $longInc.addEventListener('click', ()=>{ budgets.long++; saveBudgets(); renderBudgets(); });

// When a pomodoro finishes, attribute to active task if present
function onPomodoroFinished(){ if(activeTaskId){ const t = tasks.find(x=>x.id===activeTaskId); if(t){ t.completed = (t.completed||0) + 1; saveTasks(); renderTasks(); } } saveTimerState(); }

// update tick to call onPomodoroFinished when finishing a pomodoro
function tick(){
  if(remaining<=0){
    clearInterval(timerId);
    isRunning=false;
    $start.disabled=false;
    $pause.disabled=true;
    setRainVolume(0);
    disableRainAnimation();
    if(currentMode==='pomodoro'){
      handlePomodoroCompletion();
    } else {
      $status.textContent='Finished';
      saveTimerState();
    }
    return;
  }
  remaining--;
  updateDisplay();
  saveTimerState();
}

// initial load
loadBreakPlusTenPreference();
loadTimerState();
duration = timerState[currentMode].duration;
remaining = timerState[currentMode].remaining;
updateDisplay();
document.querySelectorAll('.mode').forEach(btn=>{
  btn.classList.toggle('active', btn.dataset.mode === currentMode);
});
$status.textContent = (remaining === duration) ? 'Ready' : 'Paused';
loadTasks(); 
loadBreaks();
setupSortable();
loadBudgets();
loadPours();
makeRain();
disableRainAnimation();
// ensure forms match the loaded mode on startup
updateFormsVisibility();
updateFinishButtonLabel();
updateFinishButtonState();
window.addEventListener('beforeunload', saveTimerState);

if($breakPlusTenBtn){
  $breakPlusTenBtn.addEventListener('click', ()=>{
    breakPlusTen = !breakPlusTen;
    try{ localStorage.setItem(BREAK_PLUS_TEN_KEY, breakPlusTen ? '1' : '0'); }catch(e){}
    applyBreakDuration(true);
  });
}

document.querySelectorAll('.mode').forEach(b=>b.addEventListener('click',e=>{
  const newMode = e.target.dataset.mode;
  if(newMode === currentMode) return;
  setMode(newMode);
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
function enableRainAnimation(){ const raindrops = document.querySelectorAll('.raindrop'); raindrops.forEach(d=>{ d.style.display='block'; d.style.animationPlayState='running'; }); }
function disableRainAnimation(){ const raindrops = document.querySelectorAll('.raindrop'); raindrops.forEach(d=>{ d.style.display='none'; d.style.animationPlayState='paused'; }); }

// volume control hookup
const $volumeControl = document.getElementById('volumeControl'); if($volumeControl){ masterVolume = parseFloat($volumeControl.value); $volumeControl.addEventListener('input', ()=>{ masterVolume = parseFloat($volumeControl.value); updateDisplay(); }); }

// Show only the relevant add-form for current mode
function updateFormsVisibility(){
  try{
    if(currentMode === 'pomodoro'){
      $taskForm.style.display = 'flex';
      $shortBreakForm.style.display = 'none';
      if($longBreakForm) $longBreakForm.style.display = 'none';
      // hide sidebar sections not relevant
      const sShort = document.getElementById('sidebarShortBreaks'); if(sShort) sShort.style.display = 'none';
      const sLong = document.getElementById('sidebarLongBreaks'); if(sLong) sLong.style.display = 'none';
      const sTasks = document.getElementById('sidebarTasks'); if(sTasks) sTasks.style.display = 'block';
    }
    else if(currentMode === 'short'){
      $taskForm.style.display = 'none';
      $shortBreakForm.style.display = 'flex';
      if($longBreakForm) $longBreakForm.style.display = 'none';
      const sShort = document.getElementById('sidebarShortBreaks'); if(sShort) sShort.style.display = 'block';
      const sLong = document.getElementById('sidebarLongBreaks'); if(sLong) sLong.style.display = 'none';
      const sTasks = document.getElementById('sidebarTasks'); if(sTasks) sTasks.style.display = 'none';
    }
    else if(currentMode === 'long'){
      $taskForm.style.display = 'none';
      $shortBreakForm.style.display = 'none';
      if($longBreakForm) $longBreakForm.style.display = 'flex';
      const sShort = document.getElementById('sidebarShortBreaks'); if(sShort) sShort.style.display = 'none';
      const sLong = document.getElementById('sidebarLongBreaks'); if(sLong) sLong.style.display = 'block';
      const sTasks = document.getElementById('sidebarTasks'); if(sTasks) sTasks.style.display = 'none';
    }
  }catch(e){}
}

// focus mode toggle
if($focusToggle){ $focusToggle.addEventListener('click', ()=>{ focusMode = !focusMode; document.querySelector('.app').classList.toggle('focus-mode', focusMode); $focusToggle.textContent = focusMode ? 'Exit Focus Mode' : 'Ultra Focus Mode'; }); }

// info section toggle
const $infoToggle = document.getElementById('infoToggle');
const $infoSection = document.getElementById('infoSection');
if($infoToggle && $infoSection){ $infoToggle.addEventListener('click', ()=>{ const isVisible = $infoSection.style.display !== 'none'; $infoSection.style.display = isVisible ? 'none' : 'block'; }); }

// timer visibility toggle (available on both pages)
const $timerToggle = document.getElementById('timerToggle');
if($timerToggle){ $timerToggle.addEventListener('click', ()=>{ timerVisible = !timerVisible; document.getElementById('time').style.display = timerVisible ? 'block' : 'none'; $timerToggle.textContent = timerVisible ? 'Hide the Timer' : 'Show the Timer'; }); }

if($finishTaskBtn){ $finishTaskBtn.addEventListener('click', finishCurrentItem); }

const $buildVersion = document.getElementById('buildVersion');
if($buildVersion){
  const appScript = Array.from(document.scripts).find(script=>/app\.js(\?|$)/.test(script.getAttribute('src') || ''));
  const src = appScript ? appScript.getAttribute('src') || '' : '';
  let version = '';
  try{ version = new URL(src, window.location.href).searchParams.get('v') || ''; }catch(e){}
  $buildVersion.textContent = version ? `Build ${version}` : 'Build local';
}
