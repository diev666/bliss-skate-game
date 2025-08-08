
// Skate Bliss v9.0 — rebuild focado no ESPECIAL

/* ===== Helpers ===== */
const $=q=>document.querySelector(q);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rand=(a,b)=>a+Math.random()*(b-a);

/* ===== DOM ===== */
const cvs=$('#game'), ctx=cvs.getContext('2d');
const scoreEl=$('#score'), bestEl=$('#best'), multEl=$('#mult'), cdsEl=$('#cds');
const volEl=$('#vol'), btnMusic=$('#btn-music'), trackEl=$('#track');
const btnSFX=$('#btn-sfx');

/* ===== Options ===== */
const OPTS_KEY='skate_bliss_opts_v9';
function loadOpts(){
  try{ const o=JSON.parse(localStorage.getItem(OPTS_KEY)||'{}');
    return { vol:(o.vol??0.30), sfx:(o.sfx??false), hit:(o.hit??false) }; }catch{ return {vol:0.30,sfx:false,hit:false}; }
}
function saveOpts(){ try{ localStorage.setItem(OPTS_KEY, JSON.stringify(opts)); }catch{} }
const opts=loadOpts();

/* ===== Assets ===== */
const img={ skater:new Image(), obs:new Image(), cds:new Image(), ground:new Image(), sky:new Image() };
img.skater.src='assets/skater.png';
img.obs.src='assets/obstacles.png';   // 3 frames 24x24 lado a lado
img.cds.src='assets/collectibles.png';
img.ground.src='assets/ground.png';
img.sky.src='assets/skyline.png';

const sfx={ jump:new Audio('assets/jump.wav'), cd:new Audio('assets/cd_pick.wav'), cone:new Audio('assets/hit_cone.wav'), bag:new Audio('assets/hit_bag.wav'), bottle:new Audio('assets/hit_bottle.wav') };
Object.values(sfx).forEach(a=>{ a.preload='auto'; a.volume=0.9; });
let sfxMuted = opts.sfx;
btnSFX.textContent = sfxMuted?'🔇 SFX':'🔈 SFX';
btnSFX.addEventListener('click',()=>{ sfxMuted=!sfxMuted; opts.sfx=sfxMuted; saveOpts(); btnSFX.textContent=sfxMuted?'🔇 SFX':'🔈 SFX'; });
const playSFX=a=>{ if(!sfxMuted){ try{ a.currentTime=0; a.play(); }catch{} } };

/* ===== Music ===== */
let music=new Audio(); music.loop=false;
music.volume=clamp(opts.vol,0,1); volEl.value=String(music.volume.toFixed(2));
btnMusic.textContent='🔊 Música';
btnMusic.addEventListener('click',()=>{ music.muted=!music.muted; btnMusic.textContent=music.muted?'🔇 Música':'🔊 Música'; });
volEl.addEventListener('input',()=>{ music.volume=clamp(parseFloat(volEl.value||'0.3'),0,1); opts.vol=music.volume; saveOpts(); });
(async function loadPlaylist(){
  try{ const r=await fetch('assets/music/playlist.json',{cache:'no-store'}); const j=await r.json(); 
    if(Array.isArray(j.tracks) && j.tracks.length){ music.src='assets/music/'+j.tracks[0].file; trackEl.textContent=j.tracks[0].title||j.tracks[0].file; } 
    else trackEl.textContent='Sem músicas na pasta (assets/music)';
  }catch{ trackEl.textContent='Sem músicas na pasta (assets/music)'; }
})();

/* ===== Input ===== */
const input={left:false,right:false,jump:false,justJump:false,special:false};
addEventListener('keydown',e=>{
  if(e.code==='ArrowLeft'||e.code==='KeyA') input.left=true;
  if(e.code==='ArrowRight'||e.code==='KeyD') input.right=true;
  if(e.code==='Space'||e.code==='ArrowUp'){ if(!input.jump) input.justJump=true; input.jump=true; lastPress=performance.now(); }
  if(e.code==='ControlLeft'||e.code==='ControlRight') input.special=true;
  if(e.code==='Enter'){ if(state.mode==='MENU'){ startRun(); } else if(state.mode==='GAMEOVER'){ startRun(); } }
  if(e.code==='Escape'){ if(state.mode==='PLAY') state.mode='MENU'; else if(state.mode==='MENU') state.mode='PLAY'; }
});
addEventListener('keyup',e=>{
  if(e.code==='ArrowLeft'||e.code==='KeyA') input.left=false;
  if(e.code==='ArrowRight'||e.code==='KeyD') input.right=false;
  if(e.code==='Space'||e.code==='ArrowUp') input.jump=false;
  if(e.code==='ControlLeft'||e.code==='ControlRight') input.special=false;
});
let lastPress=0;

/* ===== State ===== */
const GRAV=0.45, JUMP=-7.6, groundY=230;
const state={
  mode:'MENU',
  t:0, running:false,
  score:0, best:Number(localStorage.getItem('skate_bliss_best_v9')||0),
  mult:1, cdCount:0,
  player:{x:60,y:groundY,vx:0,vy:0,w:22,h:18,onGround:true},
  obstacles:[], cds:[], particles:[], popups:[],
  speedBase:2.0, skyOff:0, groundOff:0,
  // tricks (simples)
  usedKick:false, usedShove:false, combo:0, uiCombo:0, uiTrick:null, airTime:0, jumpHold:0,
  // ESPECIAL
  special:0.0,           // 0..1
  specialActive:false,
  specialDrain:0.20,     // por segundo -> 5s cheio
  cdCooldown:900, spawnCooldown:800, cdRespawnLock:0,
  showHit: opts.hit,
};

function persistBest(){ localStorage.setItem('skate_bliss_best_v9', String(state.best)); }
if(bestEl) bestEl.textContent=state.best;

/* ===== Game control ===== */
function startRun(){
  Object.assign(state, {
    mode:'PLAY', running:true, t:0, score:0, mult:1, cdCount:0,
    player:{x:60,y:groundY,vx:0,vy:0,w:22,h:18,onGround:true},
    obstacles:[], cds:[], particles:[], popups:[],
    speedBase:2.0, skyOff:0, groundOff:0,
    usedKick:false, usedShove:false, combo:0, uiCombo:0, uiTrick:null, airTime:0, jumpHold:0,
    special:0, specialActive:false, cdCooldown:900, spawnCooldown:800, cdRespawnLock:0
  });
  scoreEl.textContent='0'; multEl.textContent='1.0×'; cdsEl.textContent='0';
}

/* ===== Spawns ===== */
function spawnObstacle(){
  const types=['cone','bag','bottle']; const t=types[Math| (Math.random()*types.length)];
  state.obstacles.push({t,x:cvs.width+20,y:groundY,w:18,h:18});
}
function spawnCD(){
  const y=groundY - rand(50,120);
  state.cds.push({x:cvs.width+20,y,r:8,taken:false});
}

/* ===== Collisions ===== */
function rectRect(ax,ay,aw,ah, bx,by,bw,bh){ return ax<bx+bw && ax+aw>bx && ay<by+bh && ay+ah>by; }
function circleRect(cx,cy,cr, rx,ry,rw,rh){
  const nx=Math.max(rx, Math.min(cx, rx+rw));
  const ny=Math.max(ry, Math.min(cy, ry+rh));
  const dx=cx-nx, dy=cy-ny; return dx*dx+dy*dy<=cr*cr;
}

/* ===== Update ===== */
function update(dt){
  if(state.mode!=='PLAY') return;
  // ESPECIAL: ativação (hold) + drenagem em tempo real
  const wasActive = state.specialActive;
  state.specialActive = input.special && state.special>0;
  const timeScale = state.specialActive ? 0.5 : 1.0;
  const dtEff = dt * timeScale;

  if(state.specialActive){
    state.special = Math.max(0, state.special - state.specialDrain*(dt/1000)); // drena por tempo real
    if(state.special===0) state.specialActive=false;
  }
  if(wasActive && !state.specialActive){ state.cdRespawnLock = 5000; }

  // movimento / física
  const p=state.player;
  if(input.justJump && p.onGround){ p.vy=JUMP; p.onGround=false; state.jumpHold=180; playSFX(sfx.jump); }
  input.justJump=false;
  p.vy += GRAV * timeScale;
  if(state.jumpHold>0 && input.jump && !p.onGround){ p.vy += -0.18 * timeScale; state.jumpHold -= dtEff; }
  p.x += p.vx * timeScale; p.y += p.vy * timeScale;
  if(p.y>groundY){ p.y=groundY; p.vy=0; if(!p.onGround){ // pousou
    if(state.combo>0){ const gain=Math.floor(state.combo*state.mult); state.score+=gain; scoreEl.textContent=state.score; }
    state.combo=0; state.usedKick=false; state.usedShove=false; state.airTime=0; } p.onGround=true; }

  // limites / scaling
  p.x = clamp(p.x,20,200);
  state.speedBase = (2.0 + Math.min(2.0, state.score/200));

  // scroll
  const speed = (state.speedBase+2) * timeScale;
  state.skyOff = (state.skyOff + speed*0.3) % cvs.width;
  state.groundOff = (state.groundOff + speed) % cvs.width;

  // spawn timers
  state.spawnCooldown -= dtEff;
  if(state.cdRespawnLock>0) state.cdRespawnLock -= dt; // tempo real
  if(!state.specialActive) state.cdCooldown -= dtEff;

  if(state.spawnCooldown<=0){ spawnObstacle(); state.spawnCooldown = 1000 - Math.min(500, state.score*0.6); }
  if(state.cdCooldown<=0 && state.cdRespawnLock<=0){ spawnCD(); state.cdCooldown = 1100; }

  // mover entidades
  for(const o of state.obstacles) o.x -= speed+1;
  for(const c of state.cds) c.x -= speed+1;

  // colisões
  for(const o of state.obstacles){
    if(rectRect(p.x,p.y-p.h,p.w,p.h, o.x,o.y-18,18,18)){
      playSFX(sfx[o.t]||sfx.cone); return endRun();
    }
  }
  for(const c of state.cds){
    if(!c.taken && circleRect(c.x,c.y,c.r, p.x,p.y-p.h,p.w,p.h)){
      c.taken=true; state.cdCount++; cdsEl.textContent=state.cdCount;
      state.mult = Math.min(4, state.mult + 0.1); multEl.textContent=`${state.mult.toFixed(1)}×`;
      state.special = Math.min(1, state.special + 0.10);
      state.combo += 50; state.uiCombo=state.combo; state.uiTrick='CD';
      playSFX(sfx.cd);
    }
  }

  // limpar
  state.cds = state.cds.filter(c=>!c.taken && c.x>-20);
  state.obstacles = state.obstacles.filter(o=>o.x>-24);
}

/* ===== End Run ===== */
function endRun(){
  state.running=false; state.mode='GAMEOVER';
  if(state.score>state.best){ state.best=state.score; bestEl.textContent=state.best; persistBest(); }
}

/* ===== Render ===== */
function render(){
  ctx.clearRect(0,0,cvs.width,cvs.height);
  ctx.save();

  // sky
  if(img.sky.complete){
    const w=cvs.width,h=cvs.height*0.8;
    ctx.drawImage(img.sky, -state.skyOff,0,w,h);
    ctx.drawImage(img.sky, w-state.skyOff,0,w,h);
  }else{ ctx.fillStyle='#09090f'; ctx.fillRect(0,0,cvs.width,cvs.height*0.8); }

  // ground
  if(img.ground.complete){
    const w=cvs.width,h=cvs.height*0.22,y=cvs.height-h;
    ctx.drawImage(img.ground, -state.groundOff,y,w,h);
    ctx.drawImage(img.ground, w-state.groundOff,y,w,h);
  }else{ ctx.fillStyle='#111118'; ctx.fillRect(0,cvs.height*0.78,cvs.width,cvs.height*0.22); }

  // obstacles (24x24)
  for(const o of state.obstacles){
    if(img.obs.complete){ const frame=(o.t==='cone'?0:(o.t==='bag'?1:2)); ctx.drawImage(img.obs, frame*24,0,24,24, Math.floor(o.x), Math.floor(o.y-24), 24,24); }
    else { ctx.fillStyle='#c53'; ctx.fillRect(o.x,o.y-18,18,18); }
    if(state.showHit){ ctx.strokeStyle='lime'; ctx.strokeRect(o.x,o.y-18,18,18); }
  }

  // CDs
  for(const c of state.cds){
    if(img.cds.complete) ctx.drawImage(img.cds,0,0,16,16, c.x-8,c.y-8,16,16);
    else { ctx.fillStyle='#7af'; ctx.beginPath(); ctx.arc(c.x,c.y,8,0,Math.PI*2); ctx.fill(); }
  }

  // player
  const p=state.player;
  if(img.skater.complete) ctx.drawImage(img.skater,0,0,32,32, p.x, p.y-24, 32,32);
  else { ctx.fillStyle='#fff'; ctx.fillRect(p.x,p.y-18,16,18); }
  if(state.showHit){ ctx.strokeStyle='cyan'; ctx.strokeRect(p.x,p.y-p.h,p.w,p.h); }

  // SPECIAL BAR
  const bw=160,bh=10, bx=(cvs.width-bw)/2, by=8;
  ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(bx-1,by-1,bw+2,bh+2);
  ctx.fillStyle='#2b2b36'; ctx.fillRect(bx,by,bw,bh);
  ctx.fillStyle = state.specialActive ? '#7aff9d' : '#9d7bff';
  ctx.fillRect(bx,by,bw*state.special,bh);
  ctx.font='10px system-ui'; ctx.fillStyle='#fff';
  const t='ESPECIAL'; const tw=ctx.measureText(t).width; ctx.fillText(t, bx+(bw-tw)/2, by+bh+10);

  // overlays
  if(state.mode==='MENU'){
    ctx.fillStyle='rgba(0,0,0,.55)'; ctx.fillRect(0,0,cvs.width,cvs.height);
    drawTextCentered('Skate Bliss', 18, 100);
    drawSmallCentered('Pressione ENTER para jogar  •  ESC troca menu/jogo', 12, 122);
  }
  if(state.mode==='GAMEOVER'){
    ctx.fillStyle='rgba(0,0,0,.45)'; ctx.fillRect(0,0,cvs.width,cvs.height);
    drawTextCentered('Game Over',18,100);
    drawSmallCentered(`Score: ${state.score}  •  Best: ${state.best}  •  CDs: ${state.cdCount}`,12,124);
    drawSmallCentered('ENTER para reiniciar • ESC para menu',12,146);
  }

  ctx.restore();
}
function drawTextCentered(txt,size,y){ ctx.fillStyle='#fff'; ctx.font=`bold ${size}px system-ui`; const w=ctx.measureText(txt).width; ctx.fillText(txt,(cvs.width-w)/2,y); }
function drawSmallCentered(txt,size,y){ ctx.fillStyle='#ddd'; ctx.font=`${size}px system-ui`; const w=ctx.measureText(txt).width; ctx.fillText(txt,(cvs.width-w)/2,y); }

/* ===== Loop ===== */
let last=0;
function loop(ts){
  const dt=Math.min(33, ts-last); last=ts;
  update(dt); render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
