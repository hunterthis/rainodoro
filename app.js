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
const TIMER_STATE_KEY = 'rainodoro_timer_v1';
const COMPLETED_KEY = 'rainodoro_completed_v1';
const DISPLAY_KEY = 'rainodoro_display_v1';
const TASK_TIMER_KEY = 'rainodoro_task_timers_v1';

// completed pomodoros
let completedPomos = [];

// displayed active item (can be a task, short break, or long break)
let displayItem = { type: null, id: null };

// per-task timers (remember remaining seconds per task between switches)
let taskTimers = {};

function saveTaskTimers(){ try{ localStorage.setItem(TASK_TIMER_KEY, JSON.stringify(taskTimers)); console.debug('saveTaskTimers', TASK_TIMER_KEY, taskTimers); }catch(e){ console.error('saveTaskTimers error', e); } }
function loadTaskTimers(){ try{ const raw = localStorage.getItem(TASK_TIMER_KEY); taskTimers = raw ? JSON.parse(raw) : {}; console.debug('loadTaskTimers', TASK_TIMER_KEY, taskTimers); }catch(e){ taskTimers = {}; console.error('loadTaskTimers error', e); } }

function saveDisplay(){ try{ localStorage.setItem(DISPLAY_KEY, JSON.stringify(displayItem)); }catch(e){} }
function loadDisplay(){ try{ const raw = localStorage.getItem(DISPLAY_KEY); displayItem = raw ? JSON.parse(raw) : {type:null,id:null}; }catch(e){ displayItem = {type:null,id:null}; } renderCompleted(); updateActiveTaskDisplay(); updateFinishBtnState(); }

function setDisplayedItem(type, id){ displayItem = { type: type, id: id }; saveDisplay(); updateActiveTaskDisplay(); renderTasks(); renderBreaks(); updateFinishBtnState(); }

function updateFinishBtnState(){
  const btn = document.getElementById('finishTaskBtn');
  if(!btn) return;
  let enabled = false;
  if(displayItem && displayItem.type){
    if(displayItem.type === 'task') enabled = !!tasks.find(t=>t.id === displayItem.id);
    else if(displayItem.type === 'short') enabled = !!breaks.short.find(b=>b.id === displayItem.id);
    else if(displayItem.type === 'long') enabled = !!breaks.long.find(b=>b.id === displayItem.id);
  }
  // enforce that the displayed item type matches the current mode
  const modeMatches = (currentMode === 'pomodoro' && displayItem && displayItem.type === 'task') ||
                      (currentMode === 'short' && displayItem && displayItem.type === 'short') ||
                      (currentMode === 'long' && displayItem && displayItem.type === 'long');
  btn.disabled = !(enabled && modeMatches);
}

function saveCompleted(){ try{ localStorage.setItem(COMPLETED_KEY, JSON.stringify(completedPomos)); }catch(e){} }
function loadCompleted(){ try{ const raw = localStorage.getItem(COMPLETED_KEY); completedPomos = raw ? JSON.parse(raw) : []; }catch(e){ completedPomos = []; } renderCompleted(); }

function recordCompletedPomodoro(taskTitle, durSeconds){ try{
  const entry = { id: Date.now().toString(), taskTitle: taskTitle || null, duration: typeof durSeconds === 'number' ? durSeconds : modes.pomodoro, ts: new Date().toISOString(), mode: currentMode };
  // keep newest first
  completedPomos.unshift(entry);
  // cap history to a reasonable length (optional)
  if(completedPomos.length > 200) completedPomos.length = 200;
  saveCompleted(); renderCompleted();
}catch(e){}
}

function formatDuration(totalSeconds){ const hrs = Math.floor(totalSeconds/3600); const mins = Math.floor((totalSeconds%3600)/60); if(hrs>0) return `${hrs}h ${mins}m`; return `${mins}m`; }

function renderCompleted(){
  const $list = document.getElementById('completedList');
  const $total = document.getElementById('totalPomoTime');
  if(!$list || !$total) return;
  $list.innerHTML = '';
  let total = 0;
  completedPomos.forEach(e=>{
    total += (e.duration || modes.pomodoro);
    const li = document.createElement('li');
    const left = document.createElement('div'); left.style.flex = '1';
    left.textContent = (e.taskTitle ? e.taskTitle : 'Pomodoro') + ` (${(e.mode||'pomodoro')})`;
    const right = document.createElement('div'); right.style.marginLeft = '8px'; right.style.color = 'var(--muted)';
    try{ const d = new Date(e.ts); right.textContent = d.toLocaleString(); }catch(err){ right.textContent = e.ts; }
    li.appendChild(left); li.appendChild(right);
    $list.appendChild(li);
  });
  $total.textContent = formatDuration(total);
}

function renderTimePanel(){
  const el = document.getElementById('timeBreakdown');
  if(!el) return;
  const totals = { pomodoro:0, short:0, long:0 };
  const counts = { pomodoro:0, short:0, long:0 };
  completedPomos.forEach(e=>{
    const m = e.mode || 'pomodoro';
    totals[m] = (totals[m]||0) + (e.duration||modes[m]);
    counts[m] = (counts[m]||0) + 1;
  });
  const overall = (totals.pomodoro||0) + (totals.short||0) + (totals.long||0);
  el.innerHTML = `Overall: <strong>${formatDuration(overall)}</strong><br>
    Pomodoro: ${counts.pomodoro} (${formatDuration(totals.pomodoro||0)})<br>
    Short: ${counts.short} (${formatDuration(totals.short||0)})<br>
    Long: ${counts.long} (${formatDuration(totals.long||0)})`;
}

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

function tick(){ if(remaining<=0){ stopTimer(); $status.textContent='Finished'; setRainVolume(0); return; } remaining--; updateDisplay(); saveTimerState(); }

function startTimer(){
  if(isRunning) return;
  // require a selected task for Pomodoro mode; do not auto-select
  if(currentMode === 'pomodoro'){
    if(!(displayItem && displayItem.type === 'task' && tasks.find(t=>t.id === displayItem.id))){
      // prompt user in the active task area
      $activeTaskDisplay.textContent = 'Please make a task';
      return;
    }
    // ensure activeTaskId matches the displayed item
    activeTaskId = displayItem.id;
    saveTasks();
    // load per-task remaining if present
    duration = modes.pomodoro;
    remaining = (taskTimers[activeTaskId] && typeof taskTimers[activeTaskId].remaining === 'number') ? taskTimers[activeTaskId].remaining : duration;
    console.debug('startTimer: loaded remaining for', activeTaskId, remaining);
  } else if(currentMode === 'short'){
    if(breaks && breaks.short && breaks.short.length > 0){
      activeShortBreakId = breaks.short[0].id;
      saveBreaks();
      setDisplayedItem('short', activeShortBreakId);
    } else {
      setDisplayedItem(null, null);
    }
  } else if(currentMode === 'long'){
    if(breaks && breaks.long && breaks.long.length > 0){
      activeLongBreakId = breaks.long[0].id;
      saveBreaks();
      setDisplayedItem('long', activeLongBreakId);
    } else {
      setDisplayedItem(null, null);
    }
  }
  // update display immediately to reflect the selected item's remaining time
  try{
    previousWaterHeight = 100 * (1 - (remaining / duration));
  }catch(e){}
  updateDisplay();
  initAudio();
  isRunning=true;
  timerId = setInterval(tick,1000);
  $start.disabled=true;
  $pause.disabled=false;
  $status.textContent='Running';
  enableRainAnimation();
}
function pauseTimer(){ if(!isRunning) return; clearInterval(timerId); isRunning=false; $start.disabled=false; $pause.disabled=true; if(audioCtx) setRainVolume(0); $status.textContent='Paused'; disableRainAnimation();
  // save per-task remaining when pausing a running Pomodoro
  if(currentMode === 'pomodoro' && displayItem && displayItem.type === 'task' && displayItem.id){ try{ taskTimers[displayItem.id] = { remaining }; saveTaskTimers(); console.debug('pauseTimer: saved remaining for', displayItem.id, taskTimers[displayItem.id]); }catch(e){ console.error('pauseTimer save error', e); } }
  saveTimerState(); }
function stopTimer(){ clearInterval(timerId); isRunning=false; // when stopping/resetting, clear any saved per-task remaining so it restarts fresh
  if(currentMode === 'pomodoro' && displayItem && displayItem.type === 'task' && displayItem.id){ try{ if(taskTimers && taskTimers[displayItem.id]){ delete taskTimers[displayItem.id]; saveTaskTimers(); } }catch(e){} }
  remaining=duration; updateDisplay(); $start.disabled=false; $pause.disabled=true; setRainVolume(0); disableRainAnimation(); saveTimerState(); }

function finishPomodoroTask(){
  if(currentMode !== 'pomodoro') return;
  // guard: require an active displayed task matching pomodoro mode
  if(!(displayItem && displayItem.type === 'task')) return;
  // compute actual elapsed seconds before stopping
  const elapsed = (typeof duration === 'number' && typeof remaining === 'number') ? Math.max(0, duration - remaining) : undefined;
  if(isRunning){ clearInterval(timerId); isRunning=false; }
  // set remaining to zero to reflect finished state
  remaining = 0;
  updateDisplay();
  const pourBtn = document.getElementById('pourBtn');
  if(pourBtn) pourBtn.disabled = false;
  $start.disabled = false;
  $pause.disabled = true;
  $status.textContent = 'Finished';
  setRainVolume(0);
  disableRainAnimation();
  onPomodoroFinished(elapsed !== undefined ? elapsed : undefined, 'pomodoro');
  saveTimerState();
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
  if(!hasSortable()) return;
  Sortable.create($taskList, {
    animation: 150,
    onEnd: (evt)=>{ if(evt.oldIndex == null || evt.newIndex == null) return; reorderFromDom('tasks', $taskList); }
  });
  Sortable.create($shortBreakList, {
    animation: 150,
    onEnd: (evt)=>{ if(evt.oldIndex == null || evt.newIndex == null) return; reorderFromDom('shortBreaks', $shortBreakList); }
  });
  Sortable.create($longBreakList, {
    animation: 150,
    onEnd: (evt)=>{ if(evt.oldIndex == null || evt.newIndex == null) return; reorderFromDom('longBreaks', $longBreakList); }
  });
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
  const selectBtn=document.createElement('button'); selectBtn.textContent = (displayItem && displayItem.type==='task' && displayItem.id===t.id)?'Active':'Select';
  selectBtn.addEventListener('click', ()=>{ selectTask(t.id); });
  const del=document.createElement('button'); del.textContent='Delete'; del.addEventListener('click', ()=>{ deleteTask(t.id); });
  actions.appendChild(selectBtn); actions.appendChild(del);
  li.appendChild(left); li.appendChild(actions);
  setupDragHandlers(li, 'tasks', index);
  $taskList.appendChild(li);
}); updateActiveTaskDisplay(); }

function addTask(title){ const id=Date.now().toString(); const t={id,title,target:1,completed:0}; tasks.push(t); saveTasks(); renderTasks(); }
function deleteTask(id){
  tasks = tasks.filter(t=>t.id!==id);
  if(activeTaskId===id) activeTaskId=null;
  // clear displayed item if it pointed to this task
  if(displayItem && displayItem.type === 'task' && displayItem.id === id){ displayItem = {type:null,id:null}; saveDisplay(); }
  // remove any saved per-task timer state
  if(taskTimers && taskTimers[id]){ delete taskTimers[id]; saveTaskTimers(); }
  saveTasks(); renderTasks(); updateActiveTaskDisplay(); updateFinishBtnState();
}
function changeTarget(id, delta){ const t = tasks.find(x=>x.id===id); if(!t) return; t.target = Math.max(1, (t.target||1) + delta); saveTasks(); renderTasks(); }
function changeBreakTarget(type, id, delta){ const breaks_arr = type === 'short' ? breaks.short : breaks.long; const item = breaks_arr.find(x=>x.id===id); if(!item) return; item.target = Math.max(1, (item.target||1) + delta); saveBreaks(); renderBreaks(); }
function selectTask(id){
  // if switching tasks while a Pomodoro is running, save the current task's remaining and pause
  if(currentMode === 'pomodoro' && isRunning && displayItem && displayItem.type === 'task' && displayItem.id && displayItem.id !== id){
    // store remaining for current task
    try{ taskTimers[displayItem.id] = { remaining }; saveTaskTimers(); console.debug('selectTask: saved remaining for', displayItem.id, taskTimers[displayItem.id]); }catch(e){ console.error('selectTask save error', e); }
    pauseTimer();
    // switch displayed item to new task
    activeTaskId = id;
    saveTasks();
    setDisplayedItem('task', id);
    // load remaining for the newly selected task (or reset to full)
    duration = modes.pomodoro;
    remaining = (taskTimers[id] && typeof taskTimers[id].remaining === 'number') ? taskTimers[id].remaining : duration;
    console.debug('selectTask: loaded remaining for', id, remaining);
    updateDisplay();
    return;
  }
  activeTaskId = id; saveTasks(); renderTasks(); setDisplayedItem('task', id);
}
function updateActiveTaskDisplay(){
  if(displayItem && displayItem.type){
    if(displayItem.type === 'task'){
      const t = tasks.find(x=>x.id===displayItem.id);
      $activeTaskDisplay.textContent = t ? t.title : 'No task selected';
      return;
    }
    if(displayItem.type === 'short'){
      const it = breaks.short.find(x=>x.id===displayItem.id);
      $activeTaskDisplay.textContent = it ? it.text : 'No item selected';
      return;
    }
    if(displayItem.type === 'long'){
      const it = breaks.long.find(x=>x.id===displayItem.id);
      $activeTaskDisplay.textContent = it ? it.text : 'No item selected';
      return;
    }
  }
  // fallback to original mode-based behavior
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
function renderBreaks(){ setupListDropZone($shortBreakList, 'shortBreaks'); setupListDropZone($longBreakList, 'longBreaks'); $shortBreakList.innerHTML=''; $longBreakList.innerHTML=''; breaks.short.forEach((it, index)=>{ const li=document.createElement('li');
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
  const selectBtn=document.createElement('button'); selectBtn.textContent = (displayItem && displayItem.type==='short' && displayItem.id===it.id)?'Active':'Select';
  selectBtn.addEventListener('click', ()=>{ activeShortBreakId = it.id; saveBreaks(); renderBreaks(); setDisplayedItem('short', it.id); });
  const del=document.createElement('button'); del.textContent='Delete'; del.addEventListener('click', ()=>{ breaks.short = breaks.short.filter(x=>x.id!==it.id); if(activeShortBreakId===it.id) activeShortBreakId=null; // clear displayed if it was this
    if(displayItem && displayItem.type==='short' && displayItem.id===it.id){ displayItem = {type:null,id:null}; saveDisplay(); }
    saveBreaks(); renderBreaks(); updateActiveTaskDisplay(); updateFinishBtnState(); });
  actions.appendChild(selectBtn); actions.appendChild(del);
  li.appendChild(left); li.appendChild(actions);
  setupDragHandlers(li, 'shortBreaks', index);
  $shortBreakList.appendChild(li); });
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
  const selectBtn=document.createElement('button'); selectBtn.textContent = (displayItem && displayItem.type==='long' && displayItem.id===it.id)?'Active':'Select';
  selectBtn.addEventListener('click', ()=>{ activeLongBreakId = it.id; saveBreaks(); renderBreaks(); setDisplayedItem('long', it.id); });
  const del=document.createElement('button'); del.textContent='Delete'; del.addEventListener('click', ()=>{ breaks.long = breaks.long.filter(x=>x.id!==it.id); if(activeLongBreakId===it.id) activeLongBreakId=null; // clear displayed if it was this
    if(displayItem && displayItem.type==='long' && displayItem.id===it.id){ displayItem = {type:null,id:null}; saveDisplay(); }
    saveBreaks(); renderBreaks(); updateActiveTaskDisplay(); updateFinishBtnState(); });
  actions.appendChild(selectBtn); actions.appendChild(del);
  li.appendChild(left); li.appendChild(actions);
  setupDragHandlers(li, 'longBreaks', index);
  $longBreakList.appendChild(li); }); }

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

// render small tasks panel used by side tracker box
function renderTasksPanel(){
  const el = document.getElementById('tasksPanelList');
  const countEl = document.getElementById('tasksCount');
  if(!el || !countEl) return;
  el.innerHTML = '';
  countEl.textContent = tasks.length;
  tasks.forEach(t=>{
    const li = document.createElement('li');
    const left = document.createElement('div'); left.style.flex='1'; left.textContent = t.title;
    const right = document.createElement('div'); right.style.color='var(--muted)'; right.textContent = `${t.completed||0}/${t.target||1}`;
    li.appendChild(left); li.appendChild(right);
    li.addEventListener('click', ()=>{ selectTask(t.id); });
    el.appendChild(li);
  });
}

// Hook up budget controls
document.getElementById('pomoDec').addEventListener('click', ()=>{ budgets.pomodoro = Math.max(0, budgets.pomodoro-1); saveBudgets(); renderBudgets(); });
document.getElementById('pomoInc').addEventListener('click', ()=>{ budgets.pomodoro++; saveBudgets(); renderBudgets(); });
document.getElementById('shortDec').addEventListener('click', ()=>{ budgets.short = Math.max(0, budgets.short-1); saveBudgets(); renderBudgets(); });
document.getElementById('shortInc').addEventListener('click', ()=>{ budgets.short++; saveBudgets(); renderBudgets(); });
document.getElementById('longDec').addEventListener('click', ()=>{ budgets.long = Math.max(0, budgets.long-1); saveBudgets(); renderBudgets(); });
document.getElementById('longInc').addEventListener('click', ()=>{ budgets.long++; saveBudgets(); renderBudgets(); });

// When a pomodoro finishes, attribute to active task if present and record completion
function onPomodoroFinished(finishedDuration, mode){
  const usedMode = mode || currentMode || 'pomodoro';
  const dur = (typeof finishedDuration === 'number') ? finishedDuration : (modes[usedMode] || modes.pomodoro);
  // attribute to active task only for pomodoro mode
  if(usedMode === 'pomodoro' && activeTaskId){ const t = tasks.find(x=>x.id===activeTaskId); if(t){ t.completed = (t.completed||0) + 1; saveTasks(); renderTasks(); } }
  // clear any saved per-task timer state for the completed task
  if(usedMode === 'pomodoro' && activeTaskId){ if(taskTimers && taskTimers[activeTaskId]){ delete taskTimers[activeTaskId]; saveTaskTimers(); } }
  const taskTitle = activeTaskId ? (tasks.find(x=>x.id===activeTaskId) || {}).title : null;
  // temporarily set currentMode to usedMode when recording so entry stores proper mode
  const prevMode = currentMode;
  currentMode = usedMode;
  recordCompletedPomodoro(taskTitle, dur);
  currentMode = prevMode;
  saveTimerState();
  renderTimePanel();
}

// update tick to call onPomodoroFinished when finishing a pomodoro
function tick(){
  try{ console.debug('tick: remaining before', remaining, 'isRunning', isRunning); }catch(e){}
  if(remaining<=0){ clearInterval(timerId); isRunning=false; $start.disabled=false; $pause.disabled=true; $status.textContent='Finished'; setRainVolume(0); onPomodoroFinished(undefined, currentMode); return; }
  remaining--;
  try{ console.debug('tick: remaining after', remaining); }catch(e){}
  updateDisplay(); saveTimerState();
}

// initial load
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
loadTaskTimers();
loadCompleted();
loadDisplay();
renderTasksPanel();
renderTimePanel();
// default stats section when panel opens
showStatsSection && showStatsSection('tasks');
// ensure forms match the loaded mode on startup
updateFormsVisibility();
makeRain();
disableRainAnimation();
window.addEventListener('beforeunload', saveTimerState);
window.addEventListener('beforeunload', saveTaskTimers);

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
  // update which add-forms are visible for the selected mode
  updateFormsVisibility();
  // set displayed item to the active item for this mode (if present)
  if(currentMode === 'pomodoro'){
    if(activeTaskId) setDisplayedItem('task', activeTaskId);
    else setDisplayedItem(null, null);
  } else if(currentMode === 'short'){
    if(activeShortBreakId) setDisplayedItem('short', activeShortBreakId);
    else setDisplayedItem(null, null);
  } else if(currentMode === 'long'){
    if(activeLongBreakId) setDisplayedItem('long', activeLongBreakId);
    else setDisplayedItem(null, null);
  }
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

// focus mode toggle
if($focusToggle){ $focusToggle.addEventListener('click', ()=>{ focusMode = !focusMode; document.querySelector('.app').classList.toggle('focus-mode', focusMode); $focusToggle.textContent = focusMode ? 'Exit Focus Mode' : 'Ultra Focus Mode'; }); }

// info section toggle
const $infoToggle = document.getElementById('infoToggle');
const $infoSection = document.getElementById('infoSection');
if($infoToggle && $infoSection){ $infoToggle.addEventListener('click', ()=>{ const isVisible = $infoSection.style.display !== 'none'; $infoSection.style.display = isVisible ? 'none' : 'block'; }); }

// timer visibility toggle (available on both pages)
const $timerToggle = document.getElementById('timerToggle');
if($timerToggle){ $timerToggle.addEventListener('click', ()=>{ timerVisible = !timerVisible; document.getElementById('time').style.display = timerVisible ? 'block' : 'none'; $timerToggle.textContent = timerVisible ? 'Hide the Timer' : 'Show the Timer'; }); }

// Show only the relevant add-form for current mode
function updateFormsVisibility(){
  try{
    if(currentMode === 'pomodoro'){
      $taskForm.style.display = 'flex';
      $shortBreakForm.style.display = 'none';
      $longBreakForm.style.display = 'none';
      // hide sidebar sections not relevant
      const sShort = document.getElementById('sidebarShortBreaks'); if(sShort) sShort.style.display = 'none';
      const sLong = document.getElementById('sidebarLongBreaks'); if(sLong) sLong.style.display = 'none';
      const sTasks = document.getElementById('sidebarTasks'); if(sTasks) sTasks.style.display = 'block';
    } else if(currentMode === 'short'){
      $taskForm.style.display = 'none';
      $shortBreakForm.style.display = 'flex';
      $longBreakForm.style.display = 'none';
      const sShort = document.getElementById('sidebarShortBreaks'); if(sShort) sShort.style.display = 'block';
      const sLong = document.getElementById('sidebarLongBreaks'); if(sLong) sLong.style.display = 'none';
      const sTasks = document.getElementById('sidebarTasks'); if(sTasks) sTasks.style.display = 'none';
    } else if(currentMode === 'long'){
      $taskForm.style.display = 'none';
      $shortBreakForm.style.display = 'none';
      $longBreakForm.style.display = 'flex';
      const sShort = document.getElementById('sidebarShortBreaks'); if(sShort) sShort.style.display = 'none';
      const sLong = document.getElementById('sidebarLongBreaks'); if(sLong) sLong.style.display = 'block';
      const sTasks = document.getElementById('sidebarTasks'); if(sTasks) sTasks.style.display = 'none';
    }
  }catch(e){}
}

// unified Pomo Stats toggle
const $pomoStatsToggle = document.getElementById('pomoStatsToggle');
const $pomoStatsPanel = document.getElementById('pomoStatsPanel');
if($pomoStatsToggle && $pomoStatsPanel){
  $pomoStatsToggle.addEventListener('click', ()=>{
    const isVisible = $pomoStatsPanel.style.display !== 'block';
    $pomoStatsPanel.style.display = isVisible ? 'block' : 'none';
    $pomoStatsToggle.textContent = isVisible ? 'Hide Your Pomo Stats' : 'Your Pomo Stats';
    if(isVisible){ renderTasksPanel(); renderCompleted(); renderTimePanel(); }
  });
}

// stats section controls
const $statsTasksBtn = document.getElementById('statsTasksBtn');
const $statsPomosBtn = document.getElementById('statsPomosBtn');
const $statsTimeBtn = document.getElementById('statsTimeBtn');
function showStatsSection(name){
  const tasksSec = document.getElementById('tasksSection');
  const pomosSec = document.getElementById('pomosSection');
  const timeSec = document.getElementById('timeSection');
  if(tasksSec) tasksSec.style.display = (name === 'tasks') ? 'block' : 'none';
  if(pomosSec) pomosSec.style.display = (name === 'pomos') ? 'block' : 'none';
  if(timeSec) timeSec.style.display = (name === 'time') ? 'block' : 'none';
}
if($statsTasksBtn){ $statsTasksBtn.addEventListener('click', ()=>{ showStatsSection('tasks'); renderTasksPanel(); }); }
if($statsPomosBtn){ $statsPomosBtn.addEventListener('click', ()=>{ showStatsSection('pomos'); renderCompleted(); renderTimePanel(); }); }
if($statsTimeBtn){ $statsTimeBtn.addEventListener('click', ()=>{ showStatsSection('time'); renderTimePanel(); }); }

// reset handlers
function resetTasksProgress(){ tasks.forEach(t=>{ t.completed = 0; }); saveTasks(); renderTasks(); renderTasksPanel(); updateActiveTaskDisplay(); }
function resetPomos(){ completedPomos = []; saveCompleted(); renderCompleted(); renderTimePanel(); }
function resetTime(){ /* time is derived from completedPomos; clearing pomos resets time */ resetPomos(); }
const $resetTasksBtn = document.getElementById('resetTasksBtn'); if($resetTasksBtn) $resetTasksBtn.addEventListener('click', ()=>{ if(confirm('Reset all task progress?')) resetTasksProgress(); });
const $resetPomosBtn = document.getElementById('resetPomosBtn'); if($resetPomosBtn) $resetPomosBtn.addEventListener('click', ()=>{ if(confirm('Clear completed pomos?')) resetPomos(); });
const $resetTimeBtn = document.getElementById('resetTimeBtn'); if($resetTimeBtn) $resetTimeBtn.addEventListener('click', ()=>{ if(confirm('Clear completed pomos (resets time)?')) resetTime(); });

const $finishTaskBtn = document.getElementById('finishTaskBtn');
if($finishTaskBtn){ $finishTaskBtn.addEventListener('click', finishPomodoroTask); }
