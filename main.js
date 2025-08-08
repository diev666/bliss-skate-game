// BLISS — Skate Trick (HTML5 Canvas)
// Mecânica: corredor com obstáculos, pulo, score com tempo e fim de run com ranking local.

const cvs = document.getElementById('game');
const ctx = cvs.getContext('2d', { alpha:false });
const $ = sel => document.querySelector(sel);
const scoreEl = $('#score');
const bestEl  = $('#best');
const lbEl    = $('#leaderboard');
const lbList  = $('#lb-list');
const btnLB   = $('#btn-leaderboard');
const btnCloseLB = $('#btn-close-lb');
const btnResetLB = $('#btn-reset-lb');
const btnHelp = $('#btn-help');
const helpEl  = $('#help');
const btnCloseHelp = $('#btn-close-help');
const btnMute = $('#btn-mute');

// --- Audio (placeholders sem arquivo; mantido pra expansão futura) ---
let muted = false;
btnMute.addEventListener('click', () => {
  muted = !muted;
  btnMute.textContent = muted ? '🔇' : '🔈';
});

// --- Input ---
const input = { left:false, right:false, jump:false };
addEventListener('keydown', e => {
  if (['ArrowLeft','KeyA'].includes(e.code)) input.left = true;
  if (['ArrowRight','KeyD'].includes(e.code)) input.right = true;
  if (['Space','ArrowUp'].includes(e.code)) input.jump = true;
});
addEventListener('keyup', e => {
  if (['ArrowLeft','KeyA'].includes(e.code)) input.left = false;
  if (['ArrowRight','KeyD'].includes(e.code)) input.right = false;
  if (['Space','ArrowUp'].includes(e.code)) input.jump = false;
});
cvs.addEventListener('pointerdown', () => input.jump = true);
cvs.addEventListener('pointerup',   () => input.jump = false);

// --- Mundo ---
const GRAV = 0.65, FRICTION = 0.86, SPEED = 0.95, JUMP = -10;
const groundY = 220;

const state = {
  running: true,
  t: 0,
  score: 0,
  best: 0,
  player: { x:60, y:groundY, vx:0, vy:0, w:18, h:18, onGround:true },
  obstacles: [],
  spawnTimer: 0
};

// Storage helpers
const LB_KEY = 'bliss_skate_lb';
const BEST_KEY = 'bliss_skate_best';

function loadLB(){ try { return JSON.parse(localStorage.getItem(LB_KEY)||'[]'); } catch { return []; } }
function saveLB(lb){ localStorage.setItem(LB_KEY, JSON.stringify(lb.slice(0,5))); }
function submitScore(name, value){
  const lb = loadLB();
  lb.push({name, value, ts: Date.now()});
  lb.sort((a,b)=> b.value - a.value);
  saveLB(lb);
}
function renderLB(){
  const lb = loadLB();
  lbList.innerHTML = '';
  if (!lb.length){ lbList.innerHTML = '<li>Ninguém no ranking ainda.</li>'; return; }
  lb.forEach((r,i)=>{
    const li = document.createElement('li');
    li.textContent = `${i+1}. ${r.name} — ${r.value}`;
    lbList.appendChild(li);
  });
}

function loadBest(){ return +(localStorage.getItem(BEST_KEY)||0); }
function saveBest(v){ localStorage.setItem(BEST_KEY, String(v)); }

state.best = loadBest();
bestEl.textContent = state.best;

// Obstáculos (caixas)
function spawnObstacle(){
  const h = 12 + Math.random()*18; // altura
  const w = 14 + Math.random()*18; // largura
  const y = groundY + (18 - h); // alinhado no chão
  const speed = 2 + Math.random()*2.5;
  state.obstacles.push({ x: cvs.width + 20, y, w, h, speed });
}
function updateObstacles(dt){
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0){
    spawnObstacle();
    state.spawnTimer = 900 + Math.random()*900; // ms
  }
  state.obstacles.forEach(o => o.x -= o.speed);
  // remove fora da tela
  state.obstacles = state.obstacles.filter(o => o.x + o.w > -40);
}

function rectsCollide(a,b){
  return (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y);
}

function endRun(){
  state.running = false;
  // Atualiza best
  if (state.score > state.best){
    state.best = state.score;
    bestEl.textContent = state.best;
    saveBest(state.best);
  }
  // Leaderboard
  const raw = prompt('Seu nome para o ranking:', 'guest') || 'guest';
  const name = raw.trim().slice(0,16) || 'guest';
  submitScore(name, state.score);
  renderLB();
  lbEl.hidden = false;
}

function resetRun(){
  state.running = true;
  state.t = 0;
  state.score = 0;
  state.player.x = 60;
  state.player.y = groundY;
  state.player.vx = 0;
  state.player.vy = 0;
  state.player.onGround = true;
  state.obstacles = [];
  state.spawnTimer = 400;
  last = performance.now();
  requestAnimationFrame(loop);
}

// HUD / Panels
btnLB.addEventListener('click', ()=>{ renderLB(); lbEl.hidden = false; });
btnCloseLB.addEventListener('click', ()=> lbEl.hidden = true);
btnResetLB.addEventListener('click', ()=>{
  if (confirm('Tem certeza que deseja resetar o ranking local?')){
    localStorage.removeItem(LB_KEY);
    renderLB();
  }
});

btnHelp.addEventListener('click', ()=> helpEl.hidden = false);
btnCloseHelp.addEventListener('click', ()=> helpEl.hidden = true);

// --- Game Loop ---
let last = 0;
function update(dt){
  const p = state.player;
  // movimento horizontal leve (só pra dar controle mínimo)
  p.vx += (input.right - input.left) * SPEED;
  p.vx *= FRICTION;
  // gravidade
  p.vy += GRAV;
  // pulo
  if (input.jump && p.onGround){
    p.vy = JUMP;
    p.onGround = false;
    // sfx placeholder
  }
  // integrar
  p.x += p.vx;
  p.y += p.vy;

  // chão
  if (p.y > groundY){
    p.y = groundY;
    p.vy = 0;
    p.onGround = true;
  }

  // limites laterais
  if (p.x < 8) p.x = 8;
  if (p.x > cvs.width-8-p.w) p.x = cvs.width-8-p.w;

  // obstáculos
  updateObstacles(dt);

  // colisão
  for (const o of state.obstacles){
    if (rectsCollide({x:p.x, y:p.y, w:p.w, h:p.h}, o)){
      endRun();
      break;
    }
  }

  // score: +1 a cada ~60ms
  state.t += dt;
  if (state.t >= 60){
    const inc = Math.floor(state.t / 60);
    state.score += inc;
    state.t = state.t % 60;
    scoreEl.textContent = state.score;
  }
}

function render(){
  // fundo
  ctx.fillStyle = '#0b0b0d';
  ctx.fillRect(0,0,cvs.width,cvs.height);

  // piso
  ctx.fillStyle = '#1a1a20';
  ctx.fillRect(0, 230, cvs.width, 40);

  // faixa
  ctx.fillStyle = '#17171c';
  ctx.fillRect(0, 228, cvs.width, 2);

  // player (quadrado representando o skater)
  ctx.fillStyle = '#9d7bff';
  const p = state.player;
  ctx.fillRect(p.x, p.y - p.h, p.w, p.h);

  // obstáculos
  ctx.fillStyle = '#2a2a36';
  for (const o of state.obstacles){
    ctx.fillRect(o.x, o.y, o.w, o.h);
  }

  // dica inicial
  if (state.score === 0){
    ctx.font = '12px system-ui';
    ctx.fillStyle = '#a5a5ad';
    ctx.fillText('Espaço/↑/toque para pular. Desvie dos obstáculos.', 14, 24);
  }

  // status quando acabou
  if (!state.running){
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0,0,cvs.width,cvs.height);
    ctx.fillStyle = '#f3f3f3';
    ctx.font = '16px system-ui';
    ctx.fillText('Fim da corrida!', 180, 110);
    ctx.font = '12px system-ui';
    ctx.fillText('Pressione R para recomeçar.', 165, 130);
  }
}

// restart por teclado
addEventListener('keydown', e => {
  if (!state.running && e.code === 'KeyR') resetRun();
});

function loop(ts){
  const dt = Math.min(33, ts - last);
  last = ts;
  if (state.running){
    update(dt);
    render();
    requestAnimationFrame(loop);
  } else {
    render(); // desenha overlay de fim
  }
}

// inicia
requestAnimationFrame(ts => { last = ts; requestAnimationFrame(loop); });
