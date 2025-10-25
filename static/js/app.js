const API_ROOT = "/api";

let currentWeek = "2025-W43";
let currentWeekData = null;

function $id(s){ return document.getElementById(s); }

async function fetchWeek(weekId){
  const res = await fetch(`${API_ROOT}/week/${weekId}`);
  if (!res.ok) throw new Error("failed to load week");
  return res.json();
}

async function init(){
  // init canvas
  CanvasApp.init("#sky");
  CanvasApp.onAdd(handleAddStar);
  CanvasApp.onSelect(handleSelectStar);

  // UI bindings
  $id("prevWeek").addEventListener("click", ()=>navigateWeek(-1));
  $id("nextWeek").addEventListener("click", ()=>navigateWeek(1));
  $id("galaxyBtn").addEventListener("click", ()=>alert("Galaxy view — позже"));
  $id("finishWeekBtn").addEventListener("click", finishWeek);

  $id("saveTaskBtn").addEventListener("click", saveModalTask);
  $id("deleteTaskBtn").addEventListener("click", deleteModalTask);
  $id("closeModalBtn").addEventListener("click", ()=>closeModal());

  // mood buttons
  renderMoodButtons();

  // load initial
  await loadWeek(currentWeek);

  // small: load stats
  loadStats();
}

async function loadStats(){
  try {
    const res = await fetch(`${API_ROOT}/stats`);
    const stats = await res.json();
    $id("streakCount").innerText = stats.currentStreak || 0;
  } catch (e) { console.warn(e) }
}

async function loadWeek(weekId){
  try {
    currentWeek = weekId;
    $id("weekLabel").innerText = weekId;
    const wk = await fetchWeek(weekId);
    currentWeekData = wk;
    CanvasApp.setData({stars: wk.stars, connections: wk.connections, mood: wk.mood});
    renderTaskList();
    updateCounts();
    
    updateFinishButtonState(wk.isCompleted);
    
    if (wk.isCompleted) {
      disableEditing();
    } else {
      enableEditing();
    }
  } catch (e) {
    console.error(e);
  }
}

function updateFinishButtonState(isCompleted) {
  const finishBtn = $id("finishWeekBtn");
  if (!finishBtn) return;
  
  if (isCompleted) {
    finishBtn.disabled = true;
    finishBtn.textContent = "Неделя завершена";
    finishBtn.classList.add("disabled");
  } else {
    finishBtn.disabled = false;
    finishBtn.textContent = "Завершить неделю";
    finishBtn.classList.remove("disabled");
  }
}

function disableEditing() {
  document.querySelectorAll('.mood-btn').forEach(btn => {
    btn.style.pointerEvents = 'none';
    btn.style.opacity = '0.5';
  });
  
  const taskCheckboxes = document.querySelectorAll('#taskList input[type="checkbox"]');
  taskCheckboxes.forEach(cb => {
    cb.disabled = true;
    cb.classList.add("disabled-checkbox");
  });
  
  const taskSpans = document.querySelectorAll('#taskList span');
  taskSpans.forEach(span => {
    span.style.pointerEvents = 'none';
    span.style.opacity = '0.7';
  });
  
  if (CanvasApp.setReadOnly) {
    CanvasApp.setReadOnly(true);
  }
}

function enableEditing() {
  document.querySelectorAll('.mood-btn').forEach(btn => {
    btn.style.pointerEvents = 'auto';
    btn.style.opacity = '1';
  });
  
  const taskCheckboxes = document.querySelectorAll('#taskList input[type="checkbox"]');
  taskCheckboxes.forEach(cb => {
    cb.disabled = false;
    cb.classList.remove("disabled-checkbox");
  });

  const taskSpans = document.querySelectorAll('#taskList span');
  taskSpans.forEach(span => {
    span.style.pointerEvents = 'auto';
    span.style.opacity = '1';
  });
  
  if (CanvasApp.setReadOnly) {
    CanvasApp.setReadOnly(false);
  }
}

function renderMoodButtons(){
  const container = $id("moodButtons");
  container.innerHTML = "";
  for (let i=1;i<=5;i++){
    const btn = document.createElement("div");
    btn.className = "mood-btn";
    btn.dataset.mood = i;
    btn.title = `Настроение ${i}`;
    btn.innerText = ["🥶","🙂","😐","😊","🔥"][i-1];
    btn.style.background = CanvasApp.getMoodColor(i);
    btn.addEventListener("click", ()=>setMood(i));
    container.appendChild(btn);
  }
}

async function setMood(m){
  try {
    await fetch(`${API_ROOT}/week/${currentWeek}/mood`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({mood:m})
    });
    currentWeekData.mood = m;    
    CanvasApp.setData({stars: currentWeekData.stars, connections: currentWeekData.connections, mood: m});    
    Array.from(document.querySelectorAll(".mood-btn")).forEach(b=>b.classList.toggle("active", parseInt(b.dataset.mood)===m));
  } catch (e) { console.error(e) }
}

function renderTaskList(){
  const ul = $id("taskList");
  ul.innerHTML = "";
  (currentWeekData.stars || []).forEach(s=>{
    const li = document.createElement("li");
    li.className = s.completed ? "completed" : "";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!s.completed;
    cb.addEventListener("change", async ()=>{
      s.completed = cb.checked;
      await saveStar(s);
      // Обновляем CanvasApp после изменения состояния задачи
      CanvasApp.setData({stars: currentWeekData.stars, connections: currentWeekData.connections, mood: currentWeekData.mood});
      renderTaskList();
      updateCounts();
    });
    const span = document.createElement("span");
    span.innerText = s.title;
    span.style.flex = "1";
    span.addEventListener("click", ()=>openModalFor(s));
    li.appendChild(cb);
    li.appendChild(span);
    ul.appendChild(li);
  });
}

function updateCounts(){
  const total = (currentWeekData.stars || []).length;
  const done = (currentWeekData.stars || []).filter(s=>s.completed).length;
  $id("doneCount").innerText = done;
  $id("totalCount").innerText = total;
}

async function handleAddStar(pos){
  const payload = {
    x: Math.round(pos.x),
    y: Math.round(pos.y),
    title: "Новая задача",
    description: ""
  };
  const res = await fetch(`${API_ROOT}/week/${currentWeek}/star`, {
    method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(payload)
  });
  if (!res.ok) { alert("Не удалось добавить"); return; }
  const star = await res.json();
  currentWeekData.stars.push(star);
  CanvasApp.setData({stars: currentWeekData.stars, connections: currentWeekData.connections, mood: currentWeekData.mood});
  renderTaskList();
  updateCounts();
}

function handleSelectStar(star, opts = {}){
  // открыть модал
  openModalFor(star);
  // если moved, сохраняем координаты
  if (opts.moved){
    saveStar(star);
  }
}

function openModalFor(star){
  $id("modal").classList.remove("hidden");
  $id("modalTitle").innerText = star.title || "Задача";
  $id("taskTitleInput").value = star.title || "";
  $id("taskDescInput").value = star.description || "";
  $id("taskCompletedInput").checked = !!star.completed;
  // store current editing id
  $id("modal").dataset.editing = star.id;
}

function closeModal(){
  $id("modal").classList.add("hidden");
  delete $id("modal").dataset.editing;
  
  if (CanvasApp.stopDragging) {
    CanvasApp.stopDragging();
  }
}

async function saveModalTask(){
  const id = $id("modal").dataset.editing;
  if (!id) return;
  const star = currentWeekData.stars.find(s=>s.id===id);
  if (!star) return;
  star.title = $id("taskTitleInput").value;
  star.description = $id("taskDescInput").value;
  star.completed = $id("taskCompletedInput").checked;
  await saveStar(star);
  CanvasApp.setData({stars: currentWeekData.stars, connections: currentWeekData.connections, mood: currentWeekData.mood});
  renderTaskList();
  updateCounts();
  
  if (CanvasApp.stopDragging) {
    CanvasApp.stopDragging();
  }
  closeModal();
}

async function deleteModalTask(){
  const id = $id("modal").dataset.editing;
  if (!id) return;
  const res = await fetch(`${API_ROOT}/week/${currentWeek}/star/${id}`, {method:"DELETE"});
  if (res.ok){
    currentWeekData.stars = currentWeekData.stars.filter(s=>s.id!==id);
    CanvasApp.setData({stars: currentWeekData.stars, connections: currentWeekData.connections, mood: currentWeekData.mood});
    renderTaskList();
    updateCounts();
    closeModal();
  } else {
    alert("Ошибка удаления");
  }
}

async function saveStar(star){
  const res = await fetch(`${API_ROOT}/week/${currentWeek}/star/${star.id}`, {
    method:"PUT", headers:{"Content-Type":"application/json"}, body: JSON.stringify(star)
  });
  if (!res.ok){
    console.error("save failed");
  } else {
    const updated = await res.json();
    const idx = currentWeekData.stars.findIndex(s=>s.id===updated.id);
    if (idx>=0) currentWeekData.stars[idx] = updated;
    CanvasApp.setData({stars: currentWeekData.stars, connections: currentWeekData.connections, mood: currentWeekData.mood});
  }
}

async function finishWeek() {
  if (!confirm("Завершить неделю? Это заблокирует редактирование.")) return;

  const finishButton = document.getElementById("finishWeekBtn");
  if (finishButton) {
    finishButton.disabled = true;
    finishButton.textContent = "Завершение...";
  }

  try {
    const res = await fetch(`${API_ROOT}/week/${currentWeek}/finish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errorText}`);
    }

    const payload = await res.json();

    await loadWeek(currentWeek);
    await loadStats();

    playCompletionAnimation(payload.percent || 0);

  } catch (err) {
    console.error("Ошибка завершения недели:", err);
    
    if (finishButton) {
      finishButton.disabled = false;
      finishButton.textContent = "Завершить неделю";
      finishButton.classList.remove("disabled");
    }
    
    if (err.message.includes("already completed")) {
      alert("Неделя уже завершена");
    } else {
      alert("Не удалось завершить неделю: " + err.message);
    }
  }
}

function navigateWeek(dir){
  // простая навигация: изменяем номер Wnn
  const parts = currentWeek.split("-W");
  if (parts.length !== 2) return;
  let year = parseInt(parts[0],10);
  let w = parseInt(parts[1],10) + dir;
  if (w < 1) { year -= 1; w = 52; }
  if (w > 52) { year += 1; w = 1; }
  const newWeek = `${year}-W${String(w).padStart(2,"0")}`;
  loadWeek(newWeek);
}

function playCompletionAnimation(percent){
  // если >80% — confetti
  if (percent >= 80){
    confettiBurst();
  } else {
    // простое вспыхивание
    flashStars();
  }
}

function confettiBurst(){
  // легкий confetti: несколько цветных квадратиков на overlay
  const overlay = document.querySelector(".overlay");
  for (let i=0;i<40;i++){
    const el = document.createElement("div");
    el.style.position = "absolute";
    el.style.left = `${50 + (Math.random()-0.5)*60}%`;
    el.style.top = `${Math.random()*30}%`;
    el.style.width = el.style.height = `${6 + Math.random()*8}px`;
    el.style.background = ["#F4845F","#E8B86D","#6B8EC9","#9BA4D9"][Math.floor(Math.random()*4)];
    el.style.transform = `rotate(${Math.random()*360}deg)`;
    el.style.opacity = "1";
    overlay.appendChild(el);
    setTimeout(()=> el.style.transition = "transform 1.2s ease, top 1.2s ease, opacity 1.2s", 10);
    setTimeout(()=> {
      el.style.top = `${100 + Math.random()*30}%`;
      el.style.transform = `translateY(200px) rotate(${Math.random()*360}deg)`;
      el.style.opacity = "0";
    }, 20);
    setTimeout(()=> el.remove(), 1400);
  }
}

function flashStars(){
  // просто мигание
  const overlay = document.querySelector(".overlay");
  overlay.style.background = "radial-gradient(circle at center, rgba(255,255,255,0.08), transparent 30%)";
  setTimeout(()=> overlay.style.background = "transparent", 800);
}

function refreshCanvas() {
  if (currentWeekData) {
    CanvasApp.setData({
      stars: currentWeekData.stars, 
      connections: currentWeekData.connections, 
      mood: currentWeekData.mood
    });
  }
}

document.addEventListener("DOMContentLoaded", init);
