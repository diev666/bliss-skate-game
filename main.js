// BLISS — Skate Trick v4
// - CDs colecionáveis (aumentam multiplicador e dão bônus)
// - Multiplicador de pontos visível (reseta ao bater, decai levemente com o tempo sem pegar CDs)
// - PS1 vibe sutil: HUD bold, cores punk, popups
// - Mantém obstáculos distintos e colisões justas

const cvs = document.getElementById('game');
const ctx = cvs.getContext('2d',{alpha:false});
const $ = s => document.querySelector(s);
const scoreEl=$('#score'), bestEl=$('#best'), multEl=$('#mult');
const lbEl=$('#leaderboard'), lbList=$('#lb-list');
const btnLB=$('#btn-leaderboard'), btnCloseLB=$('#btn-close-lb'), btnResetLB=$('#btn-reset-lb');
const btnHelp=$('#btn-help'), helpEl=$('#help'), btnCloseHelp=$('#btn-close-help');
const btnMute=$('#btn-mute');

// Assets
const imgSkater = new Image(); imgSkater.src='assets/skater.png'; // 3 frames 32x32
const imgObs    = new Image(); imgObs.src='assets/obstacles.png'; // 3 sprites 24x24
const imgCD     = new Image(); imgCD.src='assets/collectibles.png'; // 2 frames 16x16
const imgGround = new Image(); imgGround.src='assets/ground.png';
const imgSky    = new Image(); imgSky.src='assets/skyline.png';

let muted=false; btnMute.addEventListener('click',()=>{muted=!muted;btnMute.textContent=muted?'🔇':'🔈'});
let showHitbox=false;
addEventListener('keydown',e=>{ if(e.code==='KeyH') showHitbox=!showHitbox; });

// Input
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

// Constantes
const GRAV=0.65, FRICTION=0.86, SPEED=0.95, JUMP=-10;
const groundTop = 230, groundY = groundTop-10;

// Estado
const state = {
  running:true,t:0,score:0,best:+(localStorage.getItem('bliss_skate_best')||0),
  mult:1, multTime:0, // tempo desde o último CD (para decaimento suave)
  player:{x:60,y:groundY,vx:0,vy:0,w:20,h:20,onGround:true,frame:0,animTimer:0,anim:'roll'},
  obstacles:[],
  cds:[],
  popups:[],
  spawnCooldown: 1100,
  cdCooldown: 1500,
  speedBase: 2.0,
  skyOffset:0, groundOffset:0,
  cdAnim:0
};
bestEl.textContent=state.best; multEl.textContent=state.mult.toFixed(1)+'×';

// Leaderboard
const LB_KEY='bliss_skate_lb_v4', BEST_KEY='bliss_skate_best';
const loadLB=()=>{try{return JSON.parse(localStorage.getItem(LB_KEY)||'[]')}catch{return[]}};
const saveLB=lb=>localStorage.setItem(LB_KEY,JSON.stringify(lb.slice(0,5)));
function submitScore(name,value){const lb=loadLB();lb.push({name,value,ts:Date.now()});lb.sort((a,b)=>b.value-a.value);saveLB(lb);}
function renderLB(){const lb=loadLB();lbList.innerHTML='';if(!lb.length){lbList.innerHTML='<li>Ninguém no ranking ainda.</li>';return}lb.forEach((r,i)=>{const li=document.createElement('li');li.textContent=`${i+1}. ${r.name} — ${r.value}`;lbList.appendChild(li);});}
btnLB.addEventListener('click',()=>{renderLB();lbEl.hidden=false;});btnCloseLB.addEventListener('click',()=>lbEl.hidden=true);
btnResetLB.addEventListener('click',()=>{if(confirm('Apagar ranking local?')){localStorage.removeItem(LB_KEY);renderLB();}});
btnHelp.addEventListener('click',()=>helpEl.hidden=false);btnCloseHelp.addEventListener('click',()=>helpEl.hidden=true);

// Obstáculos
const OB_TYPES=[
  {name:'cone',   sx:0,  sy:0, w:24,h:24, bbox:{x:4,y:6,w:16,h:16}},
  {name:'bag',    sx:24, sy:0, w:24,h:24, bbox:{x:3,y:8,w:18,h:14}},
  {name:'bottle', sx:48, sy:0, w:24,h:24, bbox:{x:8,y:4,w:8,h:18}},
];
function spawnObstacle(){
  const type=OB_TYPES[Math.floor(Math.random()*OB_TYPES.length)];
  const speed = state.speedBase + Math.random()*1.6;
  const minGap = 120 + speed*45;
  let x=cvs.width + 30;
  if(state.obstacles.length){
    const last=state.obstacles[state.obstacles.length-1];
    x=Math.max(x, last.x + last.w + minGap);
  }
  const y = groundTop - type.h;
  state.obstacles.push({x,y,w:type.w,h:type.h,speed,type});
}
function updateObstacles(dt){
  state.spawnCooldown-=dt;
  if(state.spawnCooldown<=0){
    spawnObstacle();
    const base = 1100 - Math.min(400, Math.floor(state.score/10)*15);
    state.spawnCooldown = Math.max(700, base) + Math.random()*180;
  }
  state.obstacles.forEach(o=>o.x-=o.speed);
  state.obstacles = state.obstacles.filter(o=>o.x+o.w>-30);
}

// CDs
function spawnCD(){
  const speed = state.speedBase + 1.2; // um pouco mais rápido que o scroll base
  let x = cvs.width + 30;
  // evite nascer colado em obstáculo recente
  if(state.obstacles.length){
    const last=state.obstacles[state.obstacles.length-1];
    x = Math.max(x, last.x + last.w + 60);
  }
  const minY = 120, maxY = 200; // altura para coletar com salto
  const y = Math.floor(minY + Math.random()*(maxY-minY));
  state.cds.push({x, y, w:16, h:16, speed});
}
function updateCDs(dt){
  state.cdCooldown -= dt;
  if(state.cdCooldown<=0){
    spawnCD();
    state.cdCooldown = 1500 + Math.random()*1200;
  }
  state.cds.forEach(c=>c.x -= (c.speed));
  state.cds = state.cds.filter(c=>c.x + c.w > -20);
  // animação simples (gira 2 frames)
  state.cdAnim = (state.cdAnim + dt) % 400;
}

// Colisão util
function aabb(ax,ay,aw,ah,bx,by,bw,bh){ return ax<bx+bw && ax+aw>bx && ay<by+bh && ay+ah>by; }

function addPopup(text,x,y,color='#fffb7a'){
  state.popups.push({text,x,y,vy:-0.3,life:900,color});
}
function updatePopups(dt){
  state.popups.forEach(p=>{p.y += p.vy*dt; p.life -= dt;});
  state.popups = state.popups.filter(p=>p.life>0);
}

// Fluxo
function endRun(){
  state.running=false;
  if(state.score>state.best){state.best=state.score;bestEl.textContent=state.best;localStorage.setItem(BEST_KEY,String(state.best));}
  const raw=prompt('Seu nome para o ranking:','guest')||'guest';
  const name=raw.trim().slice(0,16)||'guest';
  submitScore(name,state.score);
  renderLB(); lbEl.hidden=false;
}
function resetRun(){
  Object.assign(state,{
    running:true,t:0,score:0,mult:1,multTime:0,
    player:{x:60,y:groundY,vx:0,vy:0,w:20,h:20,onGround:true,frame:0,animTimer:0,anim:'roll'},
    obstacles:[], cds:[], popups:[],
    spawnCooldown:900, cdCooldown:1000, speedBase:2.0, skyOffset:0, groundOffset:0, cdAnim:0
  });
  last=performance.now(); requestAnimationFrame(loop);
}
addEventListener('keydown',e=>{ if(!state.running && e.code==='KeyR') resetRun(); });

let last=0;
function update(dt){
  const p=state.player;
  // movimento
  p.vx += (input.right - input.left) * SPEED;
  p.vx *= FRICTION;
  p.vy += GRAV;
  if(input.jump && p.onGround){ p.vy=JUMP; p.onGround=false; p.anim='ollie'; p.frame=1; p.animTimer=0; }
  p.x+=p.vx; p.y+=p.vy;
  // chão
  if(p.y>groundY){ p.y=groundY; p.vy=0; p.onGround=true; if(p.anim!=='roll'){p.anim='roll';p.frame=0;} }
  // limites
  if(p.x<8) p.x=8;
  if(p.x>cvs.width-8-p.w) p.x=cvs.width-8-p.w;
  // animação do skater
  p.animTimer+=dt;
  if(p.anim==='ollie'){ p.frame = p.vy<-2 ? 2 : 1; }

  // scroll visual
  const scroll = 1.2 + Math.min(2.5, state.score/120);
  state.skyOffset = (state.skyOffset + scroll*0.2) % cvs.width;
  state.groundOffset = (state.groundOffset + scroll) % cvs.width;
  // progressão
  state.speedBase = 2.0 + Math.min(2.0, state.score/200);

  // Obstáculos/CDs
  updateObstacles(dt);
  updateCDs(dt);

  // Colisão com obstáculos (visíveis)
  const pb = { x:p.x+6, y:(p.y-24)+6, w:8, h:12 };
  for(const o of state.obstacles){
    if(o.x>cvs.width || o.x+o.w<0) continue;
    const b=o.type.bbox; const bx=o.x+b.x, by=o.y+b.y;
    if(aabb(pb.x,pb.y,pb.w,pb.h,bx,by,b.w,b.h)){
      endRun(); return;
    }
  }

  // Coleta de CDs
  const cdFrame = (state.cdAnim<200)?0:1;
  for(let i=state.cds.length-1;i>=0;i--){
    const c=state.cds[i];
    // hitbox pequena para coleta justa
    const cb = { x:c.x+3, y:c.y+3, w:10, h:10 };
    if(aabb(pb.x,pb.y,pb.w,pb.h,cb.x,cb.y,cb.w,cb.h)){
      state.cds.splice(i,1);
      // aumentar mult e dar bônus
      state.mult = Math.min(5, +(state.mult + 1).toFixed(1));
      state.multTime = 0;
      const bonus = 10 * state.mult;
      state.score += Math.floor(bonus);
      addPopup(`CD +${Math.floor(bonus)} (${state.mult.toFixed(1)}×)`, p.x, p.y-30);
      scoreEl.textContent = state.score;
      multEl.textContent = state.mult.toFixed(1)+'×';
    }
  }

  // Decaimento leve do multiplicador se passar tempo sem pegar CDs
  state.multTime += dt;
  if(state.mult>1 && state.multTime>4000){ // após 4s começa a cair devagar
    state.mult = Math.max(1, +(state.mult - 0.002*dt).toFixed(1));
    multEl.textContent = state.mult.toFixed(1)+'×';
  }

  // Score passivo multiplicado
  state.t+=dt;
  if(state.t>=60){
    const inc=Math.floor(state.t/60);
    state.score += Math.floor(inc * state.mult);
    state.t%=60;
    scoreEl.textContent = state.score;
  }

  updatePopups(dt);
}

function drawTiled(img,y,off){ const w=img.width; const x1=-off, x2=x1+w; ctx.drawImage(img,x1,y); ctx.drawImage(img,x2,y); }

function render(){
  ctx.fillStyle='#0b0b0d'; ctx.fillRect(0,0,cvs.width,cvs.height);
  if(imgSky.complete) drawTiled(imgSky, 80, state.skyOffset);
  if(imgGround.complete) drawTiled(imgGround, groundTop, state.groundOffset);

  // CDs (2 frames 16x16)
  const cdFrame = (state.cdAnim<200)?0:1;
  for(const c of state.cds){
    if(imgCD.complete){
      ctx.drawImage(imgCD, cdFrame*16, 0, 16,16, c.x, c.y, 16,16);
      if(showHitbox){ ctx.strokeStyle='#0ff'; ctx.strokeRect(c.x+3,c.y+3,10,10); }
    }
  }

  // Player
  const p=state.player;
  if(imgSkater.complete){
    const sx=(p.frame%3)*32, sy=0;
    ctx.drawImage(imgSkater, sx, sy, 32,32, p.x, p.y-24, 32,32);
    if(showHitbox){ ctx.strokeStyle='#0f0'; ctx.strokeRect(p.x+6,(p.y-24)+6,8,12); }
  }

  // Obstáculos
  for(const o of state.obstacles){
    if(imgObs.complete){
      ctx.drawImage(imgObs, o.type.sx, o.type.sy, o.type.w, o.type.h, o.x, o.y, o.type.w, o.type.h);
      if(showHitbox){ const b=o.type.bbox; ctx.strokeStyle='#f00'; ctx.strokeRect(o.x+b.x,o.y+b.y,b.w,b.h); }
    }
  }

  // Popups estilo arcade
  for(const pop of state.popups){
    ctx.font='bold 12px system-ui';
    ctx.fillStyle='black'; ctx.fillText(pop.text, pop.x+1, pop.y+1);
    ctx.fillStyle='#fffb7a'; ctx.fillText(pop.text, pop.x, pop.y);
  }

  if(state.score===0){
    ctx.font='12px system-ui'; ctx.fillStyle='#a5a5ad';
    ctx.fillText('Pegue CDs para subir o MULT. H para hitboxes.', 14, 20);
  }
  if(!state.running){
    ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillRect(0,0,cvs.width,cvs.height);
    ctx.fillStyle='#fff'; ctx.font='16px system-ui'; ctx.fillText('Fim da corrida!',180,110);
    ctx.font='12px system-ui'; ctx.fillText('Pressione R para recomeçar.',165,130);
  }
}

function loop(ts){ const dt=Math.min(33,ts-last); last=ts; if(state.running){update(dt);render();requestAnimationFrame(loop);} else {render();} }
requestAnimationFrame(ts=>{ last=ts; requestAnimationFrame(loop); });
