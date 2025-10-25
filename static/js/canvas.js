const CanvasApp = (function () {
  let canvas, ctx, width, height;
  let stars = []; // локальная копия
  let connections = [];
  let mood = 3;
  let dragging = null;
  let onAddStar = null;
  let onSelectStar = null;
  let scale = 1;
  let readOnly = false; 

  function init(selector = "#sky", opts = {}) {
    canvas = document.querySelector(selector);
    ctx = canvas.getContext("2d");
    resize();
    window.addEventListener("resize", resize);
    canvas.addEventListener("dblclick", handleDoubleClick);
    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", handlePointerUp);
    // touch
    canvas.addEventListener("pointercancel", handlePointerUp);
    requestAnimationFrame(loop);
  }

  function setReadOnly(ro) {
    readOnly = ro;
  }

  function resize() {
    if (!canvas) return;
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.floor(width * devicePixelRatio);
    canvas.height = Math.floor(height * devicePixelRatio);
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }

  function setData({stars: s = [], connections: c = [], mood: m = 3}) {
    stars = s.map(x => Object.assign({}, x));
    connections = c.slice();
    mood = m;
  }

  function toScreenCoords(x, y) {
    return { x, y };
  }

  function loop() {
    draw();
    requestAnimationFrame(loop);
  }

  function clear() {
    // фон и звездный шум
    const g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, "#0A0E27");
    g.addColorStop(1, "#1A1B3E");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);

    // звездный фон (subtle)
    for (let i = 0; i < 60; i++) {
      const x = (i * 97) % width;
      const y = (i * 61) % height;
      ctx.fillStyle = "rgba(255,255,255,0.03)";
      ctx.fillRect(x, y, 1, 1);
    }
  }

  function draw() {
    if (!ctx) return;
    clear();

    // линии
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.9;
    for (const conn of connections) {
      const a = stars.find(s => s.id === conn.from);
      const b = stars.find(s => s.id === conn.to);
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = hexWithOpacity(getMoodColor(mood), 0.3);
      ctx.stroke();
    }

    // звезды
    for (const s of stars) {
      drawStar(s);
    }

    ctx.globalAlpha = 1;
  }

  function drawStar(s) {
    const completed = !!s.completed;
    const baseSize = 6;
    const size = baseSize * (completed ? 1.2 : 1);
    const color = completed ? lightenColor(getMoodColor(mood), 20) : (s.title ? getMoodColor(mood) : "#7e7e8a");
    
    // glow для завершенных задач
    if (completed) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 14;
        // Добавляем дополнительное свечение
        ctx.beginPath();
        ctx.fillStyle = hexWithOpacity(color, 0.3);
        ctx.arc(s.x, s.y, size + 4, 0, Math.PI * 2);
        ctx.fill();
    } else {
        ctx.shadowBlur = 0;
    }
    
    // Основная звезда
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(s.x, s.y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    }

  function hexWithOpacity(hex, alpha) {
    // hex like #RRGGBB
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function lightenColor(hex, percent) {
    const num = parseInt(hex.replace("#",""),16);
    const r = Math.min(255, ((num >> 16) & 0xFF) + percent);
    const g = Math.min(255, ((num >> 8) & 0xFF) + percent);
    const b = Math.min(255, (num & 0xFF) + percent);
    return `rgb(${r},${g},${b})`;
  }

  function getMoodColor(m) {
    const map = {
      1:"#4A5899",
      2:"#6B8EC9",
      3:"#9BA4D9",
      4:"#E8B86D",
      5:"#F4845F"
    };
    return map[m] || map[3];
  }

  function hitTest(x,y){
    for (let s of stars){
      const dx = s.x - x;
      const dy = s.y - y;
      const r = 8;
      if (dx*dx + dy*dy <= r*r) return s;
    }
    return null;
  }

  function handleDoubleClick(e){
    if (readOnly) return; // Блокируем в режиме только чтение
    
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left);
    const y = (e.clientY - rect.top);
    if (typeof onAddStar === "function") {
      onAddStar({x, y});
    }
  }

  function handlePointerDown(e){
    if (readOnly) return; // Блокируем в режиме только чтение
    
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left);
    const y = (e.clientY - rect.top);
    const hit = hitTest(x,y);
    if (hit){
      dragging = { id: hit.id, offsetX: hit.x - x, offsetY: hit.y - y };
      if (typeof onSelectStar === "function") onSelectStar(hit);
    }
  }

  function handlePointerMove(e){
    if (!dragging || readOnly) return; // Блокируем в режиме только чтение
    
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left);
    const y = (e.clientY - rect.top);
    const s = stars.find(s=>s.id===dragging.id);
    if (s) {
      s.x = Math.max(10, Math.min(width-10, x + dragging.offsetX));
      s.y = Math.max(10, Math.min(height-10, y + dragging.offsetY));
    }
  }

  function handlePointerUp(e){
    if (dragging){
      const s = stars.find(s=>s.id===dragging.id);
      if (s){
        // уведомим об окончании drag, чтобы сохранить координаты
        if (typeof onSelectStar === "function") onSelectStar(s, {moved:true});
      }
    }
    dragging = null;
  }

  function stopDragging() {
    dragging = null;
  }

  // API
  return {
    init,
    setData,
    onAdd: (fn) => { onAddStar = fn; },
    onSelect: (fn) => { onSelectStar = fn; },
    getState: () => ({stars, connections, mood}),
    getCanvasSize: () => ({width, height}),
    getMoodColor: getMoodColor,
    stopDragging,
    setReadOnly
  };
})();
