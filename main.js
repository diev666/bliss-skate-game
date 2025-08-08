// BLISS — Skate Trick v5
// - Hitbox do player aumentada (mais honesta/visível)
// - Partículas no pulo e na colisão
// - Camera shake na colisão
// - SFX por obstáculo + jump + CD

const cvs = document.getElementById('game');
const ctx = cvs.getContext('2d',{alpha:false});
const $ = s => document.querySelector(s);
const scoreEl=$('#score'), bestEl=$('#best'), multEl=$('#mult');
const lbEl=$('#leaderboard'), lbList=$('#lb-list');
const btnLB=$('#btn-leaderboard'), btnCloseLB=$('#btn-close-lb'), btnResetLB=$('#btn-reset-lb');
const btnHelp=$('#btn-help'), helpEl=$('#help'), btnCloseHelp=$('#btn-close-help');
const btnMute=$('#btn-mute');


// ==== HITBOX CONFIG (ajustável) ====
// Offsets relativos ao canto onde o sprite 32x32 é desenhado: (p.x, p.y-24)
// Pense no corpo + shape do skate.
const HB_OFFSET_X = 7;   // desloca para a direita
const HB_OFFSET_Y = 10;  // desloca para baixo (em relação ao topo do sprite)
// Tamanho da caixa (deixe um pouco menor que o sprite para não punir demais)
const HB_WIDTH    = 14;
const HB_HEIGHT   = 12;
// ===================================

// SFX
const sfxJump = $('#sfx-jump');
const sfxCD = $('#sfx-cd');
const sfxCone = $('#sfx-cone');
const sfxBag = $('#sfx-bag');
const sfxBottle = $('#sfx-bottle');

let muted=false; btnMute.addEventListener('click',()=>{muted=!muted;btnMute.textContent=muted?'🔇':'🔈'});
function play(s){ if(!muted){ try{ s.currentTime=0; s.play(); }catch(e){} } }

// Assets
const imgSkater = new Image(); imgSkater.src='assets/skater.png';
const imgObs    = new Image(); imgObs.src='assets/obstacles.png';
const imgCD     = new Image(); imgCD.src='assets/collectibles.png';
const imgGround = new Image(); imgGround.src='assets/ground.png';
const imgSky    = new Image(); imgSky.src='assets/skyline.png';

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
  mult:1, multTime:0,
  player:{x:60,y:groundY,vx:0,vy:0,w:22,h:18,onGround:true,frame:0,animTimer:0,anim:'roll'}, // hitbox maior
  obstacles:[], cds:[], popups:[], particles:[],
  spawnCooldown: 1000, cdCooldown: 1200,
  speedBase: 2.0,
  skyOffset:0, groundOffset:0, cdAnim:0,
  shake:0 // intensidade do shake
};
bestEl.textContent=state.best; multEl.textContent=state.mult.toFixed(1)+'×';

// Leaderboard
const LB_KEY='bliss_skate_lb_v5', BEST_KEY='bliss_skate_best';
const loadLB=()=>{try{return JSON.parse(localStorage.getItem(LB_KEY)||'[]')}catch{return[]}};
const saveLB=lb=>localStorage.setItem(LB_KEY,JSON.stringify(lb.slice(0,5)));
function submitScore(name,value){const lb=loadLB();lb.push({name,value,ts:Date.now()});lb.sort((a,b)=>b.value-a.value);saveLB(lb);}
function renderLB(){const lb=loadLB();lbList.innerHTML='';if(!lb.length){lbList.innerHTML='<li>Ninguém no ranking ainda.</li>';return}lb.forEach((r,i)=>{const li=document.createElement('li');li.textContent=`${i+1}. ${r.name} — ${r.value}`;lbList.appendChild(li);});}
btnLB.addEventListener('click',()=>{renderLB();lbEl.hidden=false;});btnCloseLB.addEventListener('click',()=>lbEl.hidden=true);
btnResetLB.addEventListener('click',()=>{if(confirm('Apagar ranking local?')){localStorage.removeItem(LB_KEY);renderLB();}});
btnHelp.addEventListener('click',()=>helpEl.hidden=false);btnCloseHelp.addEventListener('click',()=>helpEl.hidden=true);

// Obstáculos
const OB_TYPES=[
  {name:'cone',   sx:0,  sy:0, w:24,h:24, bbox:{x:4,y:6,w:16,h:16}, sfx:()=>play(sfxCone)},
  {name:'bag',    sx:24, sy:0, w:24,h:24, bbox:{x:3,y:8,w:18,h:14}, sfx:()=>play(sfxBag)},
  {name:'bottle', sx:48, sy:0, w:24,h:24, bbox:{x:8,y:4,w:8,h:18},  sfx:()=>play(sfxBottle)},
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
    const base = 1000 - Math.min(350, Math.floor(state.score/10)*15);
    state.spawnCooldown = Math.max(680, base) + Math.random()*180;
  }
  state.obstacles.forEach(o=>o.x-=o.speed);
  state.obstacles = state.obstacles.filter(o=>o.x+o.w>-30);
}

// CDs
function spawnCD(){
  const speed = state.speedBase + 1.2;
  let x = cvs.width + 30;
  if(state.obstacles.length){
    const last=state.obstacles[state.obstacles.length-1];
    x = Math.max(x, last.x + last.w + 60);
  }
  const minY = 120, maxY = 200;
  const y = Math.floor(minY + Math.random()*(maxY-minY));
  state.cds.push({x, y, w:16, h:16, speed});
}
function updateCDs(dt){
  state.cdCooldown -= dt;
  if(state.cdCooldown<=0){
    spawnCD();
    state.cdCooldown = 1400 + Math.random()*1200;
  }
  state.cds.forEach(c=>c.x -= (c.speed));
  state.cds = state.cds.filter(c=>c.x + c.w > -20);
  state.cdAnim = (state.cdAnim + dt) % 400;
}

// Partículas
function addParticles(x,y,n=10, col='#fffb7a'){
  for(let i=0;i<n;i++){
    state.particles.push({
      x, y, vx:(Math.random()*2-1)*1.2, vy:(Math.random()*-1.5)-0.5,
      life: 500 + Math.random()*400, color: col, size: 2+Math.random()*2
    });
  }
}
function updateParticles(dt){
  for(const p of state.particles){
    p.vy += 0.002*dt; // gravidade leve
    p.x += p.vx*dt*0.06; p.y += p.vy*dt*0.06;
    p.life -= dt;
  }
  state.particles = state.particles.filter(p=>p.life>0);
}

// Utils
function aabb(ax,ay,aw,ah,bx,by,bw,bh){ return ax<bx+bw && ax+aw>bx && ay<by+bh && ay+ah>by; }
function addPopup(text,x,y,color='#fffb7a'){ state.popups.push({text,x,y,vy:-0.3,life:900,color}); }
function updatePopups(dt){ state.popups.forEach(p=>{p.y+=p.vy*dt;p.life-=dt}); state.popups=state.popups.filter(p=>p.life>0); }

// Fluxo
function endRun(hitType){
  state.running=false;
  // shake forte
  state.shake = 14;
  // sfx de acordo com obstáculo
  if(hitType && hitType.sfx) hitType.sfx();
  if(state.score>state.best){state.best=state.score;bestEl.textContent=state.best;localStorage.setItem(BEST_KEY,String(state.best));}
  const raw=prompt('Seu nome para o ranking:','guest')||'guest';
  const name=raw.trim().slice(0,16)||'guest';
  submitScore(name,state.score);
  renderLB(); lbEl.hidden=false;
}
function resetRun(){
  Object.assign(state,{
    running:true,t:0,score:0,mult:1,multTime:0,
    player:{x:60,y:groundY,vx:0,vy:0,w:22,h:18,onGround:true,frame:0,animTimer:0,anim:'roll'},
    obstacles:[], cds:[], popups:[], particles:[],
    spawnCooldown:900, cdCooldown:1000, speedBase:2.0, skyOffset:0, groundOffset:0, cdAnim:0, shake:0
  });
  last=performance.now(); requestAnimationFrame(loop);
}
addEventListener('keydown',e=>{ if(!state.running && e.code==='KeyR') resetRun(); });

let last=0;
function update(dt){
  const p=state.player;
  // movimento + pulo
  p.vx += (input.right - input.left) * SPEED;
  p.vx *= FRICTION;
  p.vy += GRAV;
  if(input.jump && p.onGround){
    p.vy=JUMP; p.onGround=false; p.anim='ollie'; p.frame=1; p.animTimer=0;
    play(sfxJump); addParticles(p.x+12, p.y-10, 12, '#9d7bff');
  }
  p.x+=p.vx; p.y+=p.vy;
  if(p.y>groundY){ p.y=groundY; p.vy=0; p.onGround=true; if(p.anim!=='roll'){p.anim='roll';p.frame=0;} }
  if(p.x<8) p.x=8; if(p.x>cvs.width-8-p.w) p.x=cvs.width-8-p.w;
  p.animTimer+=dt; if(p.anim==='ollie'){ p.frame = p.vy<-2 ? 2 : 1; }

  // scroll e dificuldade
  const scroll = 1.2 + Math.min(2.5, state.score/120);
  state.skyOffset = (state.skyOffset + scroll*0.2) % cvs.width;
  state.groundOffset = (state.groundOffset + scroll) % cvs.width;
  state.speedBase = 2.0 + Math.min(2.0, state.score/200);

  // atualizações
  updateObstacles(dt); updateCDs(dt); updateParticles(dt);

  // colisão com obstáculos
  const pb = { x: p.x + HB_OFFSET_X, y: (p.y - 24) + HB_OFFSET_Y, w: HB_WIDTH, h: HB_HEIGHT }; // hitbox maior que v4
  for(const o of state.obstacles){
    if(o.x>cvs.width || o.x+o.w<0) continue;
    const b=o.type.bbox; const bx=o.x+b.x, by=o.y+b.y;
    if(aabb(pb.x,pb.y,pb.w,pb.h,bx,by,b.w,b.h)){
      addParticles(p.x+12, p.y-10, 24, '#ff5555'); // burst
      endRun(o.type); return;
    }
  }

  // CDs
  for(let i=state.cds.length-1;i>=0;i--){
    const c=state.cds[i];
    const cb = { x:c.x+3, y:c.y+3, w:10, h:10 };
    if(aabb(pb.x,pb.y,pb.w,pb.h,cb.x,cb.y,cb.w,cb.h)){
      state.cds.splice(i,1);
      play(sfxCD); addParticles(c.x+8, c.y+8, 14, '#fffb7a');
      state.mult = Math.min(5, +(state.mult + 1).toFixed(1));
      state.multTime = 0;
      const bonus = 10 * state.mult;
      state.score += Math.floor(bonus);
      addPopup(`CD +${Math.floor(bonus)} (${state.mult.toFixed(1)}×)`, p.x, p.y-30);
      scoreEl.textContent = state.score;
      multEl.textContent = state.mult.toFixed(1)+'×';
    }
  }

  // Decaimento do mult
  state.multTime += dt;
  if(state.mult>1 && state.multTime>4000){
    state.mult = Math.max(1, +(state.mult - 0.002*dt).toFixed(1));
    multEl.textContent = state.mult.toFixed(1)+'×';
  }

  // Pontos passivos * mult
  state.t+=dt;
  if(state.t>=60){
    const inc=Math.floor(state.t/60);
    state.score += Math.floor(inc * state.mult);
    state.t%=60;
    scoreEl.textContent = state.score;
  }

  updatePopups(dt);

  // redução do shake
  if(state.shake>0){ state.shake = Math.max(0, state.shake - 0.4*(dt/16.6)); }
}

function drawTiled(img,y,off){
  const w=img.width; const x1=-off, x2=x1+w; ctx.drawImage(img,x1,y); ctx.drawImage(img,x2,y);
}

function render(){
  // camera shake offset
  const sx = state.shake>0 ? (Math.random()*state.shake - state.shake/2) : 0;
  const sy = state.shake>0 ? (Math.random()*state.shake - state.shake/2) : 0;
  ctx.save(); ctx.translate(sx, sy);

  ctx.fillStyle='#0b0b0d'; ctx.fillRect(0,0,cvs.width,cvs.height);
  if(imgSky.complete) drawTiled(imgSky, 80, state.skyOffset);
  if(imgGround.complete) drawTiled(imgGround, groundTop, state.groundOffset);

  // CDs
  const cdFrame = (state.cdAnim<200)?0:1;
  for(const c of state.cds){
    if(imgCD.complete) ctx.drawImage(imgCD, cdFrame*16, 0, 16,16, c.x, c.y, 16,16);
    if(showHitbox){ ctx.strokeStyle='#0ff'; ctx.strokeRect(c.x+3,c.y+3,10,10); }
  }

  // Player
  const p=state.player;
  if(imgSkater.complete){
    const sxp=(p.frame%3)*32, sy=0;
    ctx.drawImage(imgSkater, sxp, sy, 32,32, p.x, p.y-24, 32,32);
    if(showHitbox){ ctx.strokeStyle='#0f0'; ctx.strokeRect(p.x + HB_OFFSET_X, (p.y - 24) + HB_OFFSET_Y, HB_WIDTH, HB_HEIGHT); }
  }

  // Obstáculos
  for(const o of state.obstacles){
    if(imgObs.complete){
      ctx.drawImage(imgObs, o.type.sx, o.type.sy, o.type.w, o.type.h, o.x, o.y, o.type.w, o.type.h);
      if(showHitbox){ const b=o.type.bbox; ctx.strokeStyle='#f00'; ctx.strokeRect(o.x+b.x,o.y+b.y,b.w,b.h); }
    }
  }

  // Partículas
  for(const prt of state.particles){
    ctx.globalAlpha = max(0, prt.life/900);
    ctx.fillStyle = prt.color;
    ctx.fillRect(prt.x, prt.y, prt.size, prt.size);
    ctx.globalAlpha = 1;
  }

  // Popups
  for(const pop of state.popups){
    ctx.font='bold 12px system-ui';
    ctx.fillStyle='black'; ctx.fillText(pop.text, pop.x+1, pop.y+1);
    ctx.fillStyle='#fffb7a'; ctx.fillText(pop.text, pop.x, pop.y);
  }

  ctx.restore();

  if(state.score===0){
    ctx.font='12px system-ui'; ctx.fillStyle='#a5a5ad';
    ctx.fillText('Pegue CDs para subir o MULT. H = hitboxes.', 14, 20);
  }
  if(!state.running){
    ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillRect(0,0,cvs.width,cvs.height);
    ctx.fillStyle='#fff'; ctx.font='16px system-ui'; ctx.fillText('Fim da corrida!',180,110);
    ctx.font='12px system-ui'; ctx.fillText('Pressione R para recomeçar.',165,130);
  }
}

function max(a,b){ return a>b?a:b; }

function loop(ts){ const dt=Math.min(33,ts-last); last=ts; if(state.running){update(dt);render();requestAnimationFrame(loop);} else {render();} }
requestAnimationFrame(ts=>{ last=ts; requestAnimationFrame(loop); });
