// BLISS — Skate Trick v2
// Sprites, skyline/rua, obstáculos urbanos, e spawn balanceado com progressão.

const cvs = document.getElementById('game');
const ctx = cvs.getContext('2d',{alpha:false});
const $ = s => document.querySelector(s);
const scoreEl=$('#score'), bestEl=$('#best');
const lbEl=$('#leaderboard'), lbList=$('#lb-list');
const btnLB=$('#btn-leaderboard'), btnCloseLB=$('#btn-close-lb'), btnResetLB=$('#btn-reset-lb');
const btnHelp=$('#btn-help'), helpEl=$('#help'), btnCloseHelp=$('#btn-close-help');
const btnMute=$('#btn-mute');

// --- Assets ---
const imgSkater = new Image(); imgSkater.src = 'assets/skater.png'; // 3 frames 32x32
const imgObs = new Image(); imgObs.src = 'assets/obstacles.png';   // cone, bag, bottle (24x24 each, horizontal)
const imgGround = new Image(); imgGround.src = 'assets/ground.png'; // 480x40
const imgSky = new Image(); imgSky.src = 'assets/skyline.png';      // 480x120 (parallax)

// --- Audio placeholder ---
let muted=false; btnMute.addEventListener('click',()=>{muted=!muted; btnMute.textContent=muted?'🔇':'🔈';});

// --- Input ---
const input={left:false,right:false,jump:false};
addEventListener('keydown',e=>{
  if(['ArrowLeft','KeyA'].includes(e.code)) input.left=true;
  if(['ArrowRight','KeyD'].includes(e.code)) input.right=true;
  if(['Space','ArrowUp'].includes(e.code)) input.jump=true;
});
addEventListener('keyup',e=>{
  if(['ArrowLeft','KeyA'].includes(e.code)) input.left=false;
  if(['ArrowRight','KeyD'].includes(e.code)) input.right=false;
  if(['Space','ArrowUp'].includes(e.code)) input.jump=false;
});
cvs.addEventListener('pointerdown',()=>input.jump=true);
cvs.addEventListener('pointerup',()=>input.jump=false);

// --- Constantes ---
const GRAV=0.65, FRICTION=0.86, SPEED=0.95, JUMP=-10;
const groundY = 230-10; // superfície visual da rua (ground image fica aos 230)

// --- Estado ---
const state = {
  running:true, t:0, score:0, best:+(localStorage.getItem('bliss_skate_best')||0),
  player:{x:60,y:groundY,vx:0,vy:0,w:22,h:22,onGround:true, frame:0, animTimer:0, anim:'roll'},
  obstacles:[],
  spawnCooldown: 1100, // ms
  speedBase: 2.0,
  skyOffset:0, groundOffset:0
};
bestEl.textContent = state.best;

// --- Leaderboard local ---
const LB_KEY='bliss_skate_lb_v2', BEST_KEY='bliss_skate_best';
const loadLB = ()=>{ try{return JSON.parse(localStorage.getItem(LB_KEY)||'[]')}catch{return[]}};
const saveLB = lb => localStorage.setItem(LB_KEY, JSON.stringify(lb.slice(0,5)));
function submitScore(name,value){ const lb=loadLB(); lb.push({name,value,ts:Date.now()}); lb.sort((a,b)=>b.value-a.value); saveLB(lb); }
function renderLB(){ const lb=loadLB(); lbList.innerHTML=''; if(!lb.length){lbList.innerHTML='<li>Ninguém no ranking ainda.</li>';return} lb.forEach((r,i)=>{ const li=document.createElement('li'); li.textContent=`${i+1}. ${r.name} — ${r.value}`; lbList.appendChild(li); }); }
btnLB.addEventListener('click',()=>{ renderLB(); lbEl.hidden=false; });
btnCloseLB.addEventListener('click',()=> lbEl.hidden=true);
btnResetLB.addEventListener('click',()=>{ if(confirm('Apagar ranking local?')){ localStorage.removeItem(LB_KEY); renderLB(); }});
btnHelp.addEventListener('click',()=> helpEl.hidden=false);
btnCloseHelp.addEventListener('click',()=> helpEl.hidden=true);

// --- Obstáculos ---
const OB_TYPES = [
  {name:'cone', sx:0, sy:0, w:24, h:24, yOff: -14},
  {name:'bag',  sx:24, sy:0, w:24, h:24, yOff: -12},
  {name:'bottle',sx:48, sy:0, w:24, h:24, yOff: -13},
];

function spawnObstacle(){
  // Balanceamento: respeita distância mínima com base na velocidade, e alterna tipos.
  const type = OB_TYPES[Math.floor(Math.random()*OB_TYPES.length)];
  const speed = state.speedBase + Math.random()*1.6;
  const minGap = 110 + speed*45; // distancia mínima em px (~reage ao speed)
  let x = cvs.width + 30;
  // evita ficar colado no último obstáculo
  if (state.obstacles.length){
    const last = state.obstacles[state.obstacles.length-1];
    x = Math.max(x, last.x + last.w + minGap);
  }
  state.obstacles.push({ x, y: groundY + type.yOff, w: type.w, h: type.h, speed, type });
}

function updateObstacles(dt){
  // cooldown dinâmico: diminui um pouco com a progressão, mas nunca abaixo de 650ms
  state.spawnCooldown -= dt;
  if (state.spawnCooldown <= 0){
    spawnObstacle();
    const base = 1100 - Math.min(400, Math.floor(state.score/10)*15);
    state.spawnCooldown = Math.max(650, base) + Math.random()*200;
  }
  state.obstacles.forEach(o => o.x -= o.speed);
  state.obstacles = state.obstacles.filter(o => o.x + o.w > -40);
}

// --- Colisão ---
function collide(a,b){ return (a.x<b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y); }

// --- Fluxo ---
function endRun(){
  state.running=false;
  if(state.score>state.best){ state.best=state.score; bestEl.textContent=state.best; localStorage.setItem(BEST_KEY,String(state.best)); }
  const raw=prompt('Seu nome para o ranking:','guest')||'guest';
  const name=raw.trim().slice(0,16)||'guest';
  submitScore(name,state.score);
  renderLB();
  lbEl.hidden=false;
}

function resetRun(){
  Object.assign(state, {
    running:true, t:0, score:0,
    player:{x:60,y:groundY,vx:0,vy:0,w:22,h:22,onGround:true,frame:0,animTimer:0,anim:'roll'},
    obstacles:[], spawnCooldown: 900, speedBase: 2.0, skyOffset:0, groundOffset:0
  });
  last = performance.now();
  requestAnimationFrame(loop);
}
addEventListener('keydown',e=>{ if(!state.running && e.code==='KeyR') resetRun(); });

// --- Update/Render ---
let last=0;
function update(dt){
  const p=state.player;
  // movimento horizontal leve
  p.vx += (input.right - input.left) * SPEED;
  p.vx *= FRICTION;
  // gravidade
  p.vy += GRAV;
  // pulo
  if (input.jump && p.onGround){ p.vy=JUMP; p.onGround=false; p.anim='ollie'; p.frame=1; p.animTimer=0; }
  // integrar
  p.x += p.vx; p.y += p.vy;

  // chão
  if (p.y > groundY){ p.y=groundY; p.vy=0; p.onGround=true; if(p.anim!=='roll'){ p.anim='roll'; p.frame=0; } }

  // limites
  if (p.x < 8) p.x=8;
  if (p.x > cvs.width-8-p.w) p.x=cvs.width-8-p.w;

  // animação simples
  p.animTimer += dt;
  if (p.anim==='roll'){
    if (p.animTimer>120){ p.frame = (p.frame+1)%1; p.animTimer=0; } // frame 0 parado (um frame só)
  } else if (p.anim==='ollie'){
    // troca para frame 2 (ar) quando está subindo e volta para 1 descendo
    p.frame = p.vy < -2 ? 2 : 1;
  }

  // parallax scroll
  const scrollSpeed = 1.2 + Math.min(2.5, state.score/120);
  state.skyOffset = (state.skyOffset + scrollSpeed*0.2) % cvs.width;
  state.groundOffset = (state.groundOffset + scrollSpeed) % cvs.width;

  // progressão de velocidade base
  state.speedBase = 2.0 + Math.min(2.0, state.score/200);

  // obstáculos e colisão
  updateObstacles(dt);
  for (const o of state.obstacles){
    if (collide({x:p.x,y:p.y-p.h,w:p.w,h:p.h}, {x:o.x,y:o.y,w:o.w,h:o.h})){ endRun(); break; }
  }

  // score
  state.t += dt;
  if (state.t>=60){ const inc=Math.floor(state.t/60); state.score+=inc; state.t%=60; scoreEl.textContent=state.score; }
}

function drawTiled(img, y, offset){
  // desenha duas cópias lado a lado para simular scroll infinito
  const w = img.width, h = img.height;
  const x1 = -offset, x2 = x1 + w;
  ctx.drawImage(img, x1, y);
  ctx.drawImage(img, x2, y);
}

function render(){
  // céu com skyline
  ctx.fillStyle='#0b0b0d'; ctx.fillRect(0,0,cvs.width,cvs.height);
  if (imgSky.complete) drawTiled(imgSky, 80, state.skyOffset);
  // rua
  if (imgGround.complete) drawTiled(imgGround, 230, state.groundOffset);

  // skater (sprites 32x32): 0=em cima do skate, 1=ollie, 2=ar
  const p=state.player;
  if (imgSkater.complete){
    const sx = (p.frame%3)*32, sy = 0;
    ctx.drawImage(imgSkater, sx, sy, 32,32, p.x, p.y-24, 32,32);
  } else {
    ctx.fillStyle='#9d7bff'; ctx.fillRect(p.x, p.y-p.h, p.w, p.h);
  }

  // obstáculos
  for (const o of state.obstacles){
    if (imgObs.complete){
      ctx.drawImage(imgObs, o.type.sx, o.type.sy, o.type.w, o.type.h, o.x, o.y, o.type.w, o.type.h);
    } else {
      ctx.fillStyle='#2a2a36'; ctx.fillRect(o.x,o.y,o.w,o.h);
    }
  }

  if (state.score===0){
    ctx.font='12px system-ui'; ctx.fillStyle='#a5a5ad';
    ctx.fillText('Espaço/↑/toque para pular. Desvie dos obstáculos.', 14, 20);
  }
  if (!state.running){
    ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillRect(0,0,cvs.width,cvs.height);
    ctx.fillStyle='#fff'; ctx.font='16px system-ui'; ctx.fillText('Fim da corrida!', 180, 110);
    ctx.font='12px system-ui'; ctx.fillText('Pressione R para recomeçar.', 165, 130);
  }
}

function loop(ts){ const dt=Math.min(33, ts-last); last=ts;
  if (state.running){ update(dt); render(); requestAnimationFrame(loop); } else { render(); } }
requestAnimationFrame(ts=>{ last=ts; requestAnimationFrame(loop); });
