// BLISS — Skate Trick v3
// - Obstáculos separados (cone, saco, garrafa)
// - Colisões alinhadas ao sprite (hitboxes "justas")
// - Sem "fantasmas": só colide quando visível no canvas
// - Debug de hitbox (H)

const cvs = document.getElementById('game');
const ctx = cvs.getContext('2d',{alpha:false});
const $ = s => document.querySelector(s);
const scoreEl=$('#score'), bestEl=$('#best');
const lbEl=$('#leaderboard'), lbList=$('#lb-list');
const btnLB=$('#btn-leaderboard'), btnCloseLB=$('#btn-close-lb'), btnResetLB=$('#btn-reset-lb');
const btnHelp=$('#btn-help'), helpEl=$('#help'), btnCloseHelp=$('#btn-close-help');
const btnMute=$('#btn-mute');

// Assets
const imgSkater = new Image(); imgSkater.src='assets/skater.png'; // 3 frames 32x32
const imgObs    = new Image(); imgObs.src='assets/obstacles.png'; // 3 sprites 24x24 (cone, bag, bottle)
const imgGround = new Image(); imgGround.src='assets/ground.png';  // 480x40
const imgSky    = new Image(); imgSky.src='assets/skyline.png';    // 480x120

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
const groundTop = 230; // onde desenhamos a rua (topo)
const groundY = groundTop-10; // linha de apoio do skater

// Estado
const state = {
  running:true,t:0,score:0,best:+(localStorage.getItem('bliss_skate_best')||0),
  player:{x:60,y:groundY,vx:0,vy:0,w:20,h:20,onGround:true,frame:0,animTimer:0,anim:'roll'},
  obstacles:[],
  spawnCooldown: 1100,
  speedBase: 2.0,
  skyOffset:0, groundOffset:0
};
bestEl.textContent=state.best;

// Leaderboard
const LB_KEY='bliss_skate_lb_v3', BEST_KEY='bliss_skate_best';
const loadLB=()=>{try{return JSON.parse(localStorage.getItem(LB_KEY)||'[]')}catch{return[]}};
const saveLB=lb=>localStorage.setItem(LB_KEY,JSON.stringify(lb.slice(0,5)));
function submitScore(name,value){const lb=loadLB();lb.push({name,value,ts:Date.now()});lb.sort((a,b)=>b.value-a.value);saveLB(lb);}
function renderLB(){const lb=loadLB();lbList.innerHTML='';if(!lb.length){lbList.innerHTML='<li>Ninguém no ranking ainda.</li>';return}lb.forEach((r,i)=>{const li=document.createElement('li');li.textContent=`${i+1}. ${r.name} — ${r.value}`;lbList.appendChild(li);});}
btnLB.addEventListener('click',()=>{renderLB();lbEl.hidden=false;});btnCloseLB.addEventListener('click',()=>lbEl.hidden=true);
btnResetLB.addEventListener('click',()=>{if(confirm('Apagar ranking local?')){localStorage.removeItem(LB_KEY);renderLB();}});
btnHelp.addEventListener('click',()=>helpEl.hidden=false);btnCloseHelp.addEventListener('click',()=>helpEl.hidden=true);

// Obstáculos distintos
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
  const y = groundTop - type.h; // base encostada na rua visual
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

// Colisão justa (considera bbox reduzida de cada sprite)
function aabb(ax,ay,aw,ah,bx,by,bw,bh){ return ax<bx+bw && ax+aw>bx && ay<by+bh && ay+ah>by; }

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
    running:true,t:0,score:0,
    player:{x:60,y:groundY,vx:0,vy:0,w:20,h:20,onGround:true,frame:0,animTimer:0,anim:'roll'},
    obstacles:[], spawnCooldown:900, speedBase:2.0, skyOffset:0, groundOffset:0
  });
  last=performance.now(); requestAnimationFrame(loop);
}
addEventListener('keydown',e=>{ if(!state.running && e.code==='KeyR') resetRun(); });

let last=0;
function update(dt){
  const p=state.player;
  // move
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
  // anim
  p.animTimer+=dt;
  if(p.anim==='ollie'){ p.frame = p.vy<-2 ? 2 : 1; }
  // scroll
  const scroll = 1.2 + Math.min(2.5, state.score/120);
  state.skyOffset = (state.skyOffset + scroll*0.2) % cvs.width;
  state.groundOffset = (state.groundOffset + scroll) % cvs.width;
  // dificuldade
  state.speedBase = 2.0 + Math.min(2.0, state.score/200);
  // obstáculos
  updateObstacles(dt);
  // colisão (só se visível na tela)
  const pb = { x:p.x+6, y:(p.y-24)+6, w:20-12, h:20-8 }; // hitbox do player dentro do sprite 32x32
  for(const o of state.obstacles){
    if(o.x>cvs.width || o.x+o.w<0) continue; // fora da tela, ignora
    const bb = o.type.bbox;
    const bx = o.x + bb.x;
    const by = o.y + bb.y;
    if(aabb(pb.x,pb.y,pb.w,pb.h,bx,by,bb.w,bb.h)){ endRun(); break; }
  }
  // score
  state.t+=dt; if(state.t>=60){const inc=Math.floor(state.t/60);state.score+=inc;state.t%=60;scoreEl.textContent=state.score;}
}

function drawTiled(img,y,off){ const w=img.width; const x1=-off, x2=x1+w; ctx.drawImage(img,x1,y); ctx.drawImage(img,x2,y); }

function render(){
  ctx.fillStyle='#0b0b0d'; ctx.fillRect(0,0,cvs.width,cvs.height);
  if(imgSky.complete) drawTiled(imgSky, 80, state.skyOffset);
  if(imgGround.complete) drawTiled(imgGround, groundTop, state.groundOffset);

  // player sprite (32x32) desenhado com offset para alinhar aos pés
  const p=state.player;
  if(imgSkater.complete){
    const sx=(p.frame%3)*32, sy=0;
    ctx.drawImage(imgSkater, sx, sy, 32,32, p.x, p.y-24, 32,32);
    if(showHitbox){ ctx.strokeStyle='#0f0'; ctx.strokeRect(p.x+6,(p.y-24)+6,8,12); }
  } else { ctx.fillStyle='#9d7bff'; ctx.fillRect(p.x,p.y-p.h,p.w,p.h); }

  // obstacles
  for(const o of state.obstacles){
    if(imgObs.complete){
      ctx.drawImage(imgObs, o.type.sx, o.type.sy, o.type.w, o.type.h, o.x, o.y, o.type.w, o.type.h);
      if(showHitbox){ const b=o.type.bbox; ctx.strokeStyle='#f00'; ctx.strokeRect(o.x+b.x,o.y+b.y,b.w,b.h); }
    } else { ctx.fillStyle='#2a2a36'; ctx.fillRect(o.x,o.y,o.w,o.h); }
  }

  if(state.score===0){ ctx.font='12px system-ui'; ctx.fillStyle='#a5a5ad'; ctx.fillText('Espaço/↑/toque para pular. H para hitboxes.',14,20); }
  if(!state.running){ ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillRect(0,0,cvs.width,cvs.height);
    ctx.fillStyle='#fff'; ctx.font='16px system-ui'; ctx.fillText('Fim da corrida!',180,110);
    ctx.font='12px system-ui'; ctx.fillText('Pressione R para recomeçar.',165,130); }
}

function loop(ts){ const dt=Math.min(33,ts-last); last=ts; if(state.running){update(dt);render();requestAnimationFrame(loop);} else {render();} }
requestAnimationFrame(ts=>{ last=ts; requestAnimationFrame(loop); });
