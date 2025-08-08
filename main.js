
// Skate Bliss — v8.0 (clean rebuild)

/* ---------- Utilities ---------- */
const $ = sel => document.querySelector(sel);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a,b)=> a + Math.random()*(b-a);
const chance = p => Math.random() < p;

/* ---------- DOM Refs ---------- */
const cvs = $('#game'), ctx = cvs.getContext('2d');
const scoreEl=$('#score'), bestEl=$('#best'), multEl=$('#mult'), cdsEl=$('#cds');
const btnHelp=$('#btn-help'), btnMuteSFX=$('#btn-mute-sfx');
const btnPrev=$('#prev'), btnPlay=$('#play'), btnNext=$('#next');
const trackEl=$('#track'), volEl=$('#vol'), btnMuteMusic=$('#btn-mute-music');

/* ---------- Options (init early) ---------- */
const OPTS_KEY='skate_bliss_opts';
function loadOpts(){
  try{
    const o = JSON.parse(localStorage.getItem(OPTS_KEY)||'{}');
    return {
      vol: typeof o.vol==='number'? o.vol : 0.30,
      sfx: typeof o.sfx==='boolean'? o.sfx : false,
      hit: typeof o.hit==='boolean'? o.hit : false,
      diff: (o.diff==='FAST'?'FAST':'NORMAL')
    };
  }catch{ return {vol:0.30,sfx:false,hit:false,diff:'NORMAL'}; }
}
function saveOpts(){ try{ localStorage.setItem(OPTS_KEY, JSON.stringify(opts)); }catch{} }
const opts = loadOpts();
let sfxMuted = opts.sfx;
let diffFactor = (opts.diff==='FAST')?1.25:1.0;

/* ---------- Music Player ---------- */
let playlist = [];
let curIdx = 0;
let musicEl = new Audio();
musicEl.loop = false;
musicEl.volume = clamp(opts.vol ?? 0.30, 0, 1);
if(volEl){ volEl.value = String(musicEl.volume.toFixed(2)); }
if(btnMuteMusic){ btnMuteMusic.textContent = '🔊 Música'; }

async function loadPlaylist(){
  try{
    const res = await fetch('assets/music/playlist.json', {cache:'no-store'});
    const data = await res.json();
    if(Array.isArray(data.tracks)) playlist = data.tracks;
  }catch{ playlist = []; }
  if(playlist.length===0){
    trackEl.textContent = 'Sem músicas na pasta (assets/music)';
    return;
  }
  curIdx = 0;
  setTrack(curIdx);
}

function setTrack(i){
  i = (i+playlist.length)%playlist.length;
  curIdx = i;
  const t = playlist[i];
  trackEl.textContent = t.title || t.file;
  musicEl.src = 'assets/music/' + t.file;
  if(autoplayWanted) musicEl.play().catch(()=>{});
}
let autoplayWanted=false;
btnPlay?.addEventListener('click',()=>{
  if(musicEl.paused){ musicEl.play().catch(()=>{}); autoplayWanted=true; }
  else musicEl.pause();
});
btnPrev?.addEventListener('click',()=>setTrack(curIdx-1));
btnNext?.addEventListener('click',()=>setTrack(curIdx+1));
volEl?.addEventListener('input',()=>{
  musicEl.volume = clamp(parseFloat(volEl.value||'0.3'),0,1);
  opts.vol = musicEl.volume; saveOpts();
});
btnMuteMusic?.addEventListener('click',()=>{
  musicEl.muted = !musicEl.muted;
  btnMuteMusic.textContent = musicEl.muted ? '🔇 Música' : '🔊 Música';
});

/* ---------- SFX ---------- */
const sfx = {
  jump: new Audio('assets/jump.wav'),
  cd:   new Audio('assets/cd_pick.wav'),
  cone: new Audio('assets/hit_cone.wav'),
  bag:  new Audio('assets/hit_bag.wav'),
  bottle: new Audio('assets/hit_bottle.wav'),
};
Object.values(sfx).forEach(a=>{ a.volume=0.9; a.preload='auto'; });

btnMuteSFX?.addEventListener('click',()=>{
  sfxMuted = !sfxMuted; opts.sfx = sfxMuted; saveOpts();
  btnMuteSFX.textContent = sfxMuted ? '🔇 SFX' : '🔈 SFX';
});
btnMuteSFX.textContent = sfxMuted ? '🔇 SFX' : '🔈 SFX';

function playSFX(a){ if(!sfxMuted){ try{ a.currentTime=0; a.play(); }catch{} }}

/* ---------- Assets (images) ---------- */
const img = {
  skater: new Image(),
  obs: new Image(),
  cds: new Image(),
  ground: new Image(),
  sky: new Image(),
};
img.skater.src='assets/skater.png';
img.obs.src='assets/obstacles.png';
img.cds.src='assets/collectibles.png';
img.ground.src='assets/ground.png';
img.sky.src='assets/skyline.png';

/* ---------- Input ---------- */
const input = {left:false,right:false,jump:false,justJump:false};
let lastSpaceTap=0;
addEventListener('keydown',e=>{
  if(e.code==='ArrowLeft'||e.code==='KeyA') input.left=true;
  if(e.code==='ArrowRight'||e.code==='KeyD') input.right=true;
  if(e.code==='Space'||e.code==='ArrowUp'){
    if(!input.jump) input.justJump=true;
    input.jump=true;
    const now=performance.now();
    if(now-lastSpaceTap<240 && !state.player.onGround) doKickflip();
    lastSpaceTap=now;
  }
  if(e.code==='KeyP'||e.code==='Escape'){
    if(state.mode==='PLAY'){ state.mode='PAUSE'; } else if(state.mode==='PAUSE'){ state.mode='PLAY'; }
  }
});
addEventListener('keyup',e=>{
  if(e.code==='ArrowLeft'||e.code==='KeyA') input.left=false;
  if(e.code==='ArrowRight'||e.code==='KeyD') input.right=false;
  if(e.code==='Space'||e.code==='ArrowUp') input.jump=false;
});

/* ---------- Game State ---------- */
const groundY = 230;
const GRAV = 0.45;
const JUMP = -7.6;

const state = {
  mode:'MENU',
  running:false,
  t:0,
  score:0,
  best: Number(localStorage.getItem('skate_bliss_best')||0),
  mult:1,
  multTime:0,
  cdCount:0,
  player:{x:60,y:groundY,vx:0,vy:0,w:22,h:18,onGround:true,frame:0,anim:'roll',animTimer:0},
  obstacles:[], cds:[], particles:[], popups:[],
  spawnCooldown:800, cdCooldown:900,
  speedBase:2.0, skyOffset:0, groundOffset:0,
  // tricks/combo HUD persistente
  combo:0, uiCombo:0, uiTrick:null, usedKick:false, usedShove:false, airTime:0, jumpHold:0,
  trickAnim:0, trickPhase:0,
  showHit: opts.hit,
};

if(bestEl) bestEl.textContent=state.best;
multEl.textContent = `${state.mult.toFixed(1)}×`;
cdsEl.textContent = '0';

function persistBest(){ localStorage.setItem('skate_bliss_best', String(state.best)); }

/* ---------- Tricks ---------- */
function doKickflip(){
  if(state.usedKick || state.player.onGround) return;
  state.usedKick=true;
  state.combo += 150; state.uiCombo = state.combo; state.uiTrick='KICKFLIP';
  state.trickAnim=0; state.trickPhase=0;
  addPopup('KICKFLIP +150', state.player.x, state.player.y-40);
}
function doShove(){
  if(state.usedShove || state.player.onGround) return;
  state.usedShove=true;
  state.combo += 100; state.uiCombo = state.combo; state.uiTrick='SHOVE-IT';
  state.trickAnim=0; state.trickPhase=0;
  addPopup('SHOVE-IT +100', state.player.x, state.player.y-40);
}

/* ---------- Helpers ---------- */
function addPopup(text,x,y,color='#fffb7a'){ state.popups.push({text,x,y,vy:-0.12,life:1600,color}); }
function addParticles(x,y,n=10,color='#9d7bff'){
  for(let i=0;i<n;i++){ state.particles.push({x,y,vx:rand(-1.2,1.2),vy:rand(-1.2,0.4),life:600,color}); }
}

/* ---------- Spawning ---------- */
function spawnObstacle(){
  const types = ['cone','bag','bottle'];
  const t = types[Math.floor(Math.random()*types.length)];
  state.obstacles.push({t, x:cvs.width+20, y:groundY-14, w:18, h:14, sfx:t});
}
function spawnCD(){
  const y = groundY - rand(40,110);
  state.cds.push({x:cvs.width+20, y, r:8, taken:false});
}

/* ---------- Update Loop ---------- */
function resetRun(){
  Object.assign(state, {
    mode:'PLAY', running:true, t:0, score:0, mult:1, multTime:0, cdCount:0,
    player:{x:60,y:groundY,vx:0,vy:0,w:22,h:18,onGround:true,frame:0,anim:'roll',animTimer:0},
    obstacles:[], cds:[], particles:[], popups:[],
    spawnCooldown:800, cdCooldown:900, speedBase:2.0, skyOffset:0, groundOffset:0,
    combo:0, uiCombo:0, uiTrick:null, usedKick:false, usedShove:false, airTime:0, jumpHold:0, trickAnim:0, trickPhase:0
  });
  if(scoreEl) scoreEl.textContent='0';
  cdsEl.textContent='0';
  multEl.textContent='1.0×';
}

function update(dt){
  if(state.mode!=='PLAY') return;

  const p = state.player;
  // movement
  if(input.left) p.vx=-1.5; else if(input.right) p.vx=1.5; else p.vx=0;

  // jump start
  if(input.justJump && p.onGround){
    p.vy = JUMP; p.onGround=false; p.anim='ollie'; p.frame=1; p.animTimer=0; state.jumpHold=180;
    playSFX(sfx.jump); addParticles(p.x+12,p.y-10,10,'#9d7bff');
  }
  input.justJump=false;

  // variable jump
  p.vy += GRAV;
  if(state.jumpHold>0 && input.jump && !p.onGround){ p.vy += -0.18; state.jumpHold -= dt; }

  // apply
  p.x += p.vx; p.y += p.vy;
  if(!p.onGround){
    state.airTime += dt;
    if(state.airTime>350 && state.uiTrick!=='OLLIE'){ state.uiTrick='OLLIE'; }
  }

  // land
  if(p.y>groundY){
    p.y=groundY; p.vy=0;
    if(!p.onGround){
      if(state.combo>0){
        const gain = Math.floor(state.combo * state.mult);
        state.score += gain; if(scoreEl) scoreEl.textContent = state.score;
        addPopup(`COMBO +${gain}`, p.x, p.y-50);
      }
      state.combo=0; state.usedKick=false; state.usedShove=false; state.airTime=0;
    }
    p.onGround=true; p.anim='roll'; p.frame=0;
  }

  // bounds
  p.x = clamp(p.x, 20, 200);

  // difficulty scaling
  state.speedBase = (2.0 + Math.min(2.0, state.score/200)) * diffFactor;

  // world scroll
  const speed = state.speedBase;
  state.skyOffset = (state.skyOffset + speed*0.3) % cvs.width;
  state.groundOffset = (state.groundOffset + speed) % cvs.width;

  // spawn
  state.spawnCooldown -= dt; state.cdCooldown -= dt;
  if(state.spawnCooldown<=0){
    spawnObstacle();
    state.spawnCooldown = (1000 - Math.min(500, Math.floor(state.score/10)*12)) / diffFactor;
  }
  if(state.cdCooldown<=0){
    spawnCD();
    state.cdCooldown = 1100 / diffFactor;
  }

  // move obstacles / cds
  for(const o of state.obstacles) o.x -= speed+2;
  for(const c of state.cds) c.x -= speed+2;

  // collisions
  for(const o of state.obstacles){
    if(rectRect(p.x,p.y-p.h,p.w,p.h, o.x,o.y-o.h,o.w||18,o.h||14)){
      // hit
      if(o.sfx && sfx[o.sfx]) playSFX(sfx[o.sfx]);
      shake(6);
      endRun();
      break;
    }
  }
  for(const c of state.cds){
    if(!c.taken && circleRect(c.x,c.y,c.r, p.x,p.y-p.h,p.w,p.h)){
      c.taken=true; state.cdCount++; cdsEl.textContent=state.cdCount;
      state.mult = Math.min(4, state.mult + 0.1); multEl.textContent=`${state.mult.toFixed(1)}×`;
      state.combo += 50; state.uiCombo = state.combo; state.uiTrick = 'CD';
      addPopup('+CD', c.x, c.y-10); playSFX(sfx.cd);
    }
  }

  // particles/popups cleanup
  state.particles = state.particles.filter(pt=> (pt.life-=dt) > 0);
  state.particles.forEach(pt=>{ pt.x+=pt.vx; pt.y+=pt.vy; pt.vy+=0.02; });
  state.popups = state.popups.filter(pu=> (pu.life-=dt) > 0); state.popups.forEach(pu=> pu.y += pu.vy);
}

function endRun(){
  state.running=false;
  if(state.score>state.best){ state.best=state.score; if(bestEl) bestEl.textContent=state.best; persistBest(); }
  state.mode='GAMEOVER';
}

/* ---------- Math Collisions ---------- */
function rectRect(ax,ay,aw,ah, bx,by,bw,bh){
  return ax < bx+bw && ax+aw > bx && ay < by+bh && ay+ah > by;
}
function circleRect(cx,cy,cr, rx,ry,rw,rh){
  const nx = clamp(cx, rx, rx+rw);
  const ny = clamp(cy, ry, ry+rh);
  const dx = cx-nx, dy = cy-ny;
  return dx*dx+dy*dy <= cr*cr;
}

/* ---------- Shake ---------- */
let shakeT=0;
function shake(a){ shakeT = 180; }
function applyShake(){ if(shakeT>0){ shakeT-=16; ctx.translate((Math.random()-0.5)*3,(Math.random()-0.5)*3); }}

/* ---------- Render ---------- */
function render(){
  ctx.clearRect(0,0,cvs.width,cvs.height);
  ctx.save(); applyShake();

  // sky
  if(img.sky.complete){
    const w=cvs.width,h=cvs.height;
    ctx.drawImage(img.sky, -state.skyOffset,0,w,h*0.8);
    ctx.drawImage(img.sky, w-state.skyOffset,0,w,h*0.8);
  }else{ ctx.fillStyle='#0b0b12'; ctx.fillRect(0,0,cvs.width,cvs.height*0.8); }

  // ground
  if(img.ground.complete){
    const w=cvs.width,h=cvs.height*0.22, y=cvs.height-h;
    ctx.drawImage(img.ground, -state.groundOffset,y,w,h);
    ctx.drawImage(img.ground, w-state.groundOffset,y,w,h);
  }else{ ctx.fillStyle='#101018'; ctx.fillRect(0,cvs.height*0.78,cvs.width,cvs.height*0.22); }

  // obstacles
  for(const o of state.obstacles){
    ctx.fillStyle='#000';
    if(img.obs.complete){ ctx.drawImage(img.obs,0,0,16,16, o.x,o.y-16, 24,16); }
    else{ ctx.fillRect(o.x,o.y-16,18,14); }
    if(state.showHit){ ctx.strokeStyle='lime'; ctx.strokeRect(o.x,o.y-(o.h||14), (o.w||18),(o.h||14)); }
  }

  // CDs
  for(const c of state.cds){
    if(c.taken) continue;
    if(img.cds.complete){ ctx.drawImage(img.cds,0,0,16,16, c.x-8,c.y-8, 16,16); }
    else{ ctx.fillStyle='#7ad4ff'; ctx.beginPath(); ctx.arc(c.x,c.y,8,0,Math.PI*2); ctx.fill(); }
  }

  // player
  const p = state.player;
  if(img.skater.complete){
    // frames: 0 roll,1 ollie,2 air,3 kickA,4 kickB,5 shoveA,6 shoveB
    let f=0;
    if(p.anim==='ollie'){ f = p.vy<-2?2:1; }
    if(state.uiTrick==='KICKFLIP'){ f = state.trickPhase?4:3; }
    else if(state.uiTrick==='SHOVE-IT'){ f = state.trickPhase?6:5; }
    ctx.drawImage(img.skater, f*32,0,32,32, p.x, p.y-24, 32,32);
  }else{
    ctx.fillStyle='#fff'; ctx.fillRect(p.x, p.y-18, 16,18);
  }
  if(state.showHit){ ctx.strokeStyle='cyan'; ctx.strokeRect(p.x,p.y-p.h,p.w,p.h); }

  // popups
  for(const pu of state.popups){
    ctx.font='bold 12px system-ui'; ctx.fillStyle='black'; ctx.fillText(pu.text,pu.x+1,pu.y+1);
    ctx.fillStyle='#fffb7a'; ctx.fillText(pu.text,pu.x,pu.y);
  }

  // persistent HUD (trick + combo)
  ctx.font='bold 12px system-ui';
  if(state.uiTrick){ ctx.fillStyle= '#fffb7a'; ctx.fillText(state.uiTrick, 14, 20); }
  if(state.uiCombo>0){ ctx.fillStyle='#fff'; ctx.fillText('COMBO: '+state.uiCombo, 14, 36); }

  ctx.restore();

  // menu/overlays
  if(state.mode==='MENU'){
    ctx.fillStyle='rgba(0,0,0,.35)'; ctx.fillRect(0,0,cvs.width,cvs.height);
    ctx.fillStyle='#fff'; ctx.font='bold 18px system-ui'; ctx.fillText('Skate Bliss', 170, 70);
    ctx.font='12px system-ui'; ctx.fillStyle='#a5a5ad'; ctx.fillText('Pressione ENTER para Jogar', 150, 100);
  }
  if(state.mode==='PAUSE'){
    ctx.fillStyle='rgba(0,0,0,.45)'; ctx.fillRect(0,0,cvs.width,cvs.height);
    ctx.fillStyle='#fff'; ctx.font='bold 16px system-ui'; ctx.fillText('Pausado', 200, 100);
    ctx.font='12px system-ui'; ctx.fillText('ESC/P: retomar', 192, 120);
  }
  if(state.mode==='GAMEOVER'){
    ctx.fillStyle='rgba(0,0,0,.45)'; ctx.fillRect(0,0,cvs.width,cvs.height);
    ctx.fillStyle='#fff'; ctx.font='bold 16px system-ui';
    ctx.fillText('Game Over', 190, 90);
    ctx.font='12px system-ui';
    ctx.fillText(`Score: ${state.score}  •  Best: ${state.best}  •  CDs: ${state.cdCount}`, 110, 114);
    ctx.fillText('ENTER para reiniciar • ESC para menu', 135, 138);
  }
}

addEventListener('keydown',e=>{
  if(e.code==='Enter'){
    if(state.mode==='MENU'){ resetRun(); }
    else if(state.mode==='GAMEOVER'){ resetRun(); }
  }
});

/* ---------- Main Loop ---------- */
let last=0;
function loop(ts){
  const dt = Math.min(33, ts-last); last=ts;
  // trick anim timer
  if(state.uiTrick==='KICKFLIP' || state.uiTrick==='SHOVE-IT'){
    state.trickAnim += dt; if(state.trickAnim>110){ state.trickAnim=0; state.trickPhase = 1-state.trickPhase; }
  }
  update(dt);
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* ---------- Start ---------- */
loadPlaylist();
