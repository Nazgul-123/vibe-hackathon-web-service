function fallingStar(duration = 1500){
  const overlay = document.querySelector(".overlay");
  const el = document.createElement("div");
  el.style.position = "absolute";
  el.style.width = "2px";
  el.style.height = "80px";
  el.style.top = `${Math.random()*40}%`;
  el.style.left = `${Math.random()*100}%`;
  el.style.background = "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(255,255,255,0))";
  el.style.transform = `rotate(${20 + Math.random()*30}deg)`;
  overlay.appendChild(el);
  setTimeout(()=> {
    el.style.transition = `transform ${duration}ms linear, top ${duration}ms linear, opacity ${duration}ms linear`;
    el.style.top = `${100 + Math.random()*20}%`;
    el.style.opacity = "0";
    el.style.transform = `translateX(${(Math.random()-0.5)*200}px) rotate(${50 + Math.random()*80}deg)`;
  }, 20);
  setTimeout(()=> el.remove(), duration + 100);
}

window.playFallingStar = fallingStar;
