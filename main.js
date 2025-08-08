
// Skate Bliss v9.1.2 — menu ENTER fix + special reset + world-only slow-mo

/* Utils */
const $ = s => document.querySelector(s);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rand=(a,b)=>a+Math.random()*(b-a);

/* DOM */
const cvs=$('#game'), ctx=cvs.getContext('2d');
const scoreEl=$('#score'), bestEl=$('#best'), multEl=$('#mult'), cdsEl=$('#cds');
const btnMuteSFX=$('#btn-mute-sfx'), btnHelp=$('#btn-help');
const btnPrev=$('#prev'), btnPlay=$('#play'), btnNext=$('#next'); const trackEl=$('#track'); const volEl=$('#vol'); const btnMuteMusic=$('#btn-mute-music');

/* Options */
const OPTS_KEY='skate_bliss_opts';
function loadOpts(){ try{ const o=JSON.parse(localStorage.getItem(OPTS_KEY)||'{}'); return {vol:typeof o.vol==='number'?o.vol:0.3, sfx:!!o.sfx, hit:!!o.hit, diff:(o.diff==='FAST'?'FAST':'NORMAL')}; }catch{return {vol:0.3,sfx:false,hit:false,diff:'NORMAL'};} }
function saveOpts(){ try{ localStorage.setItem(OPTS_KEY, JSON.stringify(opts)); }catch{} }
const opts = loadOpts();

/* Music */
let playlist=[]; let curIdx=0;
let musicEl=new Audio(); musicEl.loop=false; musicEl.volume=clamp(opts.vol,0,1);
volEl.value=String(musicEl.volume.toFixed(2));
btnMuteMusic.textContent='🔊 Música';
async function loadPlaylist(){ try{ const res=await fetch('assets/music/playlist.json',{cache:'no-store'}); const data=await res.json(); if(Array.isArray(data.tracks)) playlist=data.tracks; }catch{} if(playlist.length){ setTrack(0);} else { trackEl.textContent='Sem músicas'; } }
function setTrack(i){ if(!playlist.length) return; curIdx=(i+playlist.length)%playlist.length; const t=playlist[curIdx]; trackEl.textContent=t.title||t.file; musicEl.src='assets/music/'+t.file; }
btnPlay.addEventListener('click',()=>{ if(musicEl.paused) musicEl.play().catch(()=>{}); else musicEl.pause(); });
btnPrev.addEventListener('click',()=>setTrack(curIdx-1)); btnNext.addEventListener('click',()=>setTrack(curIdx+1));
volEl.addEventListener('input',()=>{ musicEl.volume=clamp(parseFloat(volEl.value||'0.3'),0,1); opts.vol=musicEl.volume; saveOpts(); });
btnMuteMusic.addEventListener('click',()=>{ musicEl.muted=!musicEl.muted; btnMuteMusic.textContent= musicEl.muted?'🔇 Música':'🔊 Música'; });

/* SFX */
let sfxMuted=opts.sfx;
btnMuteSFX.textContent = sfxMuted?'🔇 SFX':'🔈 SFX';
btnMuteSFX.addEventListener('click',()=>{ sfxMuted=!sfxMuted; btnMuteSFX.textContent = sfxMuted?'🔇 SFX':'🔈 SFX'; opts.sfx=sfxMuted; saveOpts(); });
const sfx={ jump:new Audio('assets/jump.wav'), cd:new Audio('assets/cd_pick.wav'), cone:new Audio('assets/hit_cone.wav'), bag:new Audio('assets/hit_bag.wav'), bottle:new Audio('assets/hit_bottle.wav') };
Object.values(sfx).forEach(a=>{ a.preload='auto'; a.volume=0.9; });
function playSFX(a){ if(!sfxMuted){ try{ a.currentTime=0; a.play(); }catch{} }}

/* Images */
const img={ skater:new Image(), obs:new Image(), cds:new Image(), ground:new Image(), sky:new Image() };
img.skater.src='assets/skater.png'; img.obs.src='assets/obstacles.png'; img.cds.src='assets/collectibles.png'; img.ground.src='assets/ground.png'; img.sky.src='assets/skyline.png';

/* Input */
const input={left:false,right:false,jump:false,justJump:false,special:false};
let lastSpaceTap=0;
addEventListener('keydown',e=>{
  // Global navigation controlled by mode switch below
  if(e.code==='ArrowLeft'||e.code==='KeyA') input.left=true;
  if(e.code==='ArrowRight'||e.code==='KeyD') input.right=true;
  if(e.code==='ControlLeft'||e.code==='ControlRight') input.special=true;
  if(e.code==='Space'||e.code==='ArrowUp'){
    if(!input.jump) input.justJump=true; input.jump=true;
    const now=performance.now(); if(now-lastSpaceTap<240 && !state.player.onGround) doKickflip(); lastSpaceTap=now;
  }
  // Mode-aware keys:
  if(state.mode==='PLAY'){
    if(e.code==='Escape'){ state.prevMode='PLAY'; state.mode='MENU'; }
    if(e.code==='KeyP'){ state.prevMode='PLAY'; state.mode='MENU'; }
  } else if(state.mode==='MENU'){
    if(e.code==='ArrowDown'||e.code==='KeyS') menuIndex=(menuIndex+1)%MENU_MAIN.length;
    if(e.code==='ArrowUp'||e.code==='KeyW') menuIndex=(menuIndex-1+MENU_MAIN.length)%MENU_MAIN.length;
    if(e.code==='Enter'){
      const pick=MENU_MAIN[menuIndex];
      if(pick==='JOGAR'){ if(state.prevMode==='PLAY'){ state.prevMode=null; state.mode='PLAY'; } else { resetRun(); } }
      if(pick==='OPÇÕES'){ state.mode='OPTIONS'; optIndex=0; }
      if(pick==='COMO JOGAR'){ state.mode='HELP'; }
      if(pick==='CRÉDITOS'){ state.mode='CREDITS'; }
    }
    if(e.code==='Escape' && state.prevMode==='PLAY'){ state.prevMode=null; state.mode='PLAY'; }
  } else if(state.mode==='OPTIONS'){
    if(e.code==='ArrowDown'||e.code==='KeyS') optIndex=(optIndex+1)%MENU_OPT.length;
    if(e.code==='ArrowUp'||e.code==='KeyW') optIndex=(optIndex-1+MENU_OPT.length)%MENU_OPT.length;
    if(e.code==='ArrowLeft'||e.code==='KeyA'||e.code==='ArrowRight'||e.code==='KeyD'){
      const dir=(e.code==='ArrowRight'||e.code==='KeyD')?1:-1;
      if(MENU_OPT[optIndex]==='DIFICULDADE'){ opts.diff = (opts.diff==='NORMAL'?'FAST':'NORMAL'); saveOpts(); }
    }
    if(e.code==='Enter'){
      const pick=MENU_OPT[optIndex];
      if(pick==='MÚSICA'){ musicEl.muted=!musicEl.muted; btnMuteMusic.textContent= musicEl.muted?'🔇 Música':'🔊 Música'; }
      if(pick==='SFX'){ sfxMuted=!sfxMuted; btnMuteSFX.textContent = sfxMuted?'🔇 SFX':'🔈 SFX'; opts.sfx=sfxMuted; saveOpts(); }
      if(pick==='HITBOXES'){ state.showHit=!state.showHit; opts.hit=state.showHit; saveOpts(); }
      if(pick==='DIFICULDADE'){ opts.diff = (opts.diff==='NORMAL'?'FAST':'NORMAL'); saveOpts(); }
      if(pick==='VOLTAR'){ state.mode='MENU'; }
    }
    if(e.code==='Escape'){ state.mode='MENU'; }
  } else if(state.mode==='HELP' || state.mode==='CREDITS'){
    if(e.code==='Escape' || e.code==='Enter') state.mode='MENU';
  } else if(state.mode==='GAMEOVER'){
    if(e.code==='Enter'){ resetRun(); }
    if(e.code==='Escape'){ state.mode='MENU'; state.prevMode=null; }
  }
});
addEventListener('keyup',e=>{
  if(e.code==='ArrowLeft'||e.code==='KeyA') input.left=false;
  if(e.code==='ArrowRight'||e.code==='KeyD') input.right=false;
  if(e.code==='Space'||e.code==='ArrowUp') input.jump=false;
  if(e.code==='ControlLeft'||e.code==='ControlRight') input.special=false;
});

/* Menu structures */
const MENU_MAIN=['JOGAR','OPÇÕES','COMO JOGAR','CRÉDITOS']; let menuIndex=0;
const MENU_OPT=['MÚSICA','SFX','HITBOXES','DIFICULDADE','VOLTAR']; let optIndex=0;

/* Game State */
const groundY=230, GRAV=0.45, JUMP=-7.6;
let diffFactor = (opts.diff==='FAST')?1.25:1.0;
const state={
  mode:'MENU', prevMode:null, running:false, t:0,
  score:0, best:Number(localStorage.getItem('skate_bliss_best')||0), mult:1, multTime:0, cdCount:0,
  player:{x:60,y:groundY,vx:0,vy:0,w:22,h:18,onGround:true,frame:0,anim:'roll',animTimer:0},
  obstacles:[], cds:[], particles:[], popups:[],
  spawnCooldown:900, cdCooldown:1100,
  speedBase:2.0, skyOffset:0, groundOffset:0,
  // Tricks/combos
  combo:0, uiCombo:0, uiTrick:null, usedKick:false, usedShove:false, airTime:0, jumpHold:0, trickAnim:0, trickPhase:0,
  showHit:opts.hit,
  // Special
  special:0, specialActive:false, specialDrainPerSec:0.20, cdRespawnLock:0,
};
bestEl.textContent=state.best; multEl.textContent=`${state.mult.toFixed(1)}×`;

function persistBest(){ localStorage.setItem('skate_bliss_best', String(state.best)); }

/* Helpers */
function addPopup(text,x,y,color='#fffb7a'){ state.popups.push({text,x,y,vy:-0.12,life:1600,color}); }
function addParticles(x,y,n=10,color='#9d7bff'){ for(let i=0;i<n;i++){ state.particles.push({x,y,vx:rand(-1.2,1.2),vy:rand(-1.2,0.4),life:600,color}); } }
function drawCentered(text,y,color='#fff',size=18){ ctx.save(); ctx.fillStyle=color; ctx.font=`bold ${size}px system-ui`; const w=ctx.measureText(text).width; ctx.fillText(text,(cvs.width-w)/2,y); ctx.restore(); }

/* Tricks */
function doKickflip(){ if(state.usedKick || state.player.onGround) return; state.usedKick=true; state.combo+=150; state.uiCombo=state.combo; state.uiTrick='KICKFLIP'; state.trickAnim=0; state.trickPhase=0; addPopup('KICKFLIP +150', state.player.x, state.player.y-40); }
function doShove(){ if(state.usedShove || state.player.onGround) return; state.usedShove=true; state.combo+=100; state.uiCombo=state.combo; state.uiTrick='SHOVE-IT'; state.trickAnim=0; state.trickPhase=0; addPopup('SHOVE-IT +100', state.player.x, state.player.y-40); }

/* Spawning */
function spawnObstacle(){ const types=['cone','bag','bottle']; const t=types[Math.floor(Math.random()*types.length)]; state.obstacles.push({t, x:cvs.width+20, y:groundY, w:18, h:18, sfx:t}); }
function spawnCD(){ const y=groundY - rand(40,110); state.cds.push({x:cvs.width+20, y, r:8, taken:false}); }

/* Reset & End */
function resetRun(){
  Object.assign(state, {
    mode:'PLAY', running:true, t:0,
    score:0, mult:1, multTime:0, cdCount:0,
    player:{x:60,y:groundY,vx:0,vy:0,w:22,h:18,onGround:true,frame:0,anim:'roll',animTimer:0},
    obstacles:[], cds:[], particles:[], popups:[],
    spawnCooldown:900, cdCooldown:1100, speedBase:2.0, skyOffset:0, groundOffset:0,
    combo:0, uiCombo:0, uiTrick:null, usedKick:false, usedShove:false, airTime:0, jumpHold:0, trickAnim:0, trickPhase:0,
    // ESPECIAL reset ALWAYS
    special:0, specialActive:false, cdRespawnLock:0,
  });
  diffFactor = (opts.diff==='FAST')?1.25:1.0;
  scoreEl.textContent='0'; cdsEl.textContent='0'; multEl.textContent='1.0×';
}
function endRun(){
  state.running=false;
  if(state.score>state.best){ state.best=state.score; bestEl.textContent=state.best; persistBest(); }
  // Also hard reset special so ele nunca persiste entre runs
  state.special=0; state.specialActive=false; state.cdRespawnLock=0;
  state.mode='GAMEOVER'; state.prevMode=null;
}

/* Collisions */
function rectRect(ax,ay,aw,ah,bx,by,bw,bh){ return ax<bx+bw && ax+aw>bx && ay<by+bh && ay+ah>by; }
function circleRect(cx,cy,cr, rx,ry,rw,rh){ const nx=clamp(cx,rx,rx+rw), ny=clamp(cy,ry,ry+rh); const dx=cx-nx, dy=cy-ny; return dx*dx+dy*dy<=cr*cr; }

/* Shake */
let shakeT=0; function shake(a=6){ shakeT=180; }
function applyShake(){ if(shakeT>0){ shakeT-=16; ctx.translate((Math.random()-0.5)*3,(Math.random()-0.5)*3); }}

/* Update */
function update(dt){
  if(state.mode!=='PLAY') return;

  // --- Special (world-only slow) ---
  const wasActive = state.specialActive;
  state.specialActive = (input.special && state.special>0);
  const drainDt = dt; // real time for drain
  if(state.specialActive){ state.special = Math.max(0, state.special - state.specialDrainPerSec*(drainDt/1000)); if(state.special===0) state.specialActive=false; }
  if(wasActive && !state.specialActive){ state.cdRespawnLock = 2000; } // 2s lock
  if(state.cdRespawnLock>0) state.cdRespawnLock = Math.max(0, state.cdRespawnLock - dt);

  const worldScale = state.specialActive ? 0.5 : 1.0;
  const dtWorld = dt * worldScale;
  const dtPlayer = dt; // player unaffected

  // Player move
  const p=state.player;
  p.vx = (input.left?-1.5:0) + (input.right?1.5:0);
  if(input.justJump && p.onGround){ p.vy=JUMP; p.onGround=false; p.anim='ollie'; p.frame=1; p.animTimer=0; addParticles(p.x+12,p.y-10,10,'#9d7bff'); playSFX(sfx.jump); }
  input.justJump=false;
  p.vy += GRAV; // gravity not scaled
  p.x += p.vx; p.y += p.vy;
  if(!p.onGround){ state.airTime += dtPlayer; }
  if(p.y>groundY){ // land
    p.y=groundY; p.vy=0;
    if(!p.onGround){
      if(state.combo>0){ const gain=Math.floor(state.combo*state.mult); state.score+=gain; scoreEl.textContent=state.score; addPopup(`COMBO +${gain}`, p.x, p.y-50); }
      state.combo=0; state.usedKick=false; state.usedShove=false; state.airTime=0;
    }
    p.onGround=true; p.anim='roll'; p.frame=0;
  }
  p.x = clamp(p.x, 20, 200);

  // Difficulty scaling for world speed
  state.speedBase = (2.0 + Math.min(2.0, state.score/200)) * diffFactor;

  // Scroll world with worldScale
  const speed = state.speedBase * worldScale;
  state.skyOffset = (state.skyOffset + speed*0.3) % cvs.width;
  state.groundOffset = (state.groundOffset + speed) % cvs.width;

  // Spawns using dtWorld; CD inhibited during special or lock
  state.spawnCooldown -= dtWorld; state.cdCooldown -= (state.specialActive? 0 : dtWorld);
  if(state.spawnCooldown<=0){ spawnObstacle(); state.spawnCooldown = (1200 - Math.min(600, Math.floor(state.score/10)*10)) / diffFactor; }
  if(state.cdCooldown<=0 && state.cdRespawnLock===0){ spawnCD(); state.cdCooldown = 1100 / diffFactor; }

  // Move entities by world speed
  for(const o of state.obstacles) o.x -= speed+2;
  for(const c of state.cds) c.x -= speed+2;

  // Collisions
  for(const o of state.obstacles){
    const oy = o.y-24, oh=18, ow=18;
    if(rectRect(p.x,p.y-p.h,p.w,p.h, o.x,oy, ow,oh)){ if(o.sfx && sfx[o.sfx]) playSFX(sfx[o.sfx]); shake(6); endRun(); break; }
  }
  for(const c of state.cds){
    if(!c.taken && circleRect(c.x,c.y,c.r, p.x,p.y-p.h,p.w,p.h)){
      c.taken=true; state.cdCount++; cdsEl.textContent=state.cdCount;
      state.mult = Math.min(4, state.mult + 0.1); multEl.textContent=`${state.mult.toFixed(1)}×`;
      state.special = Math.min(1, state.special + 0.10); // +10%
      state.combo += 50; state.uiCombo=state.combo; state.uiTrick='CD';
      addPopup('+CD', c.x, c.y-10); playSFX(sfx.cd);
    }
  }

  // Popups/particles (world speed for visual coherence)
  state.particles = state.particles.filter(pt=> (pt.life-=dtWorld) > 0); state.particles.forEach(pt=>{ pt.x+=pt.vx; pt.y+=pt.vy; pt.vy+=0.02; });
  state.popups = state.popups.filter(pu=> (pu.life-=dtWorld) > 0); state.popups.forEach(pu=> pu.y += pu.vy);

  // Trick anim timer *player time* (unaffected)
  if(state.uiTrick==='KICKFLIP' || state.uiTrick==='SHOVE-IT'){ state.trickAnim += dtPlayer; if(state.trickAnim>110){ state.trickAnim=0; state.trickPhase=1-state.trickPhase; } }
}

/* Render */
function render(){
  ctx.clearRect(0,0,cvs.width,cvs.height);
  ctx.save(); if(shakeT>0){ applyShake(); }

  // sky
  if(img.sky.complete){ const w=cvs.width,h=cvs.height; ctx.drawImage(img.sky,-state.skyOffset,0,w,h*0.8); ctx.drawImage(img.sky,w-state.skyOffset,0,w,h*0.8); } else { ctx.fillStyle='#0b0b12'; ctx.fillRect(0,0,cvs.width,cvs.height*0.8); }
  // ground
  if(img.ground.complete){ const w=cvs.width,h=cvs.height*0.22,y=cvs.height-h; ctx.drawImage(img.ground,-state.groundOffset,y,w,h); ctx.drawImage(img.ground,w-state.groundOffset,y,w,h); } else { ctx.fillStyle='#101018'; ctx.fillRect(0,cvs.height*0.78,cvs.width,cvs.height*0.22); }

  // obstacles
  for(const o of state.obstacles){ const frame=(o.t==='cone'?0:(o.t==='bag'?1:2)); const sx=frame*24, sy=0; if(img.obs.complete){ ctx.drawImage(img.obs,sx,sy,24,24, Math.floor(o.x), Math.floor(o.y-24), 24,24);} else { ctx.fillStyle='#ff7'; ctx.fillRect(o.x,o.y-16,18,14);} if(state.showHit){ ctx.strokeStyle='lime'; ctx.strokeRect(o.x,o.y-18,18,18);} }

  // CDs
  for(const c of state.cds){ if(c.taken) continue; if(img.cds.complete){ ctx.drawImage(img.cds,0,0,16,16, c.x-8,c.y-8, 16,16);} else { ctx.fillStyle='#7ad4ff'; ctx.beginPath(); ctx.arc(c.x,c.y,8,0,Math.PI*2); ctx.fill(); } }

  // player
  const p=state.player;
  if(img.skater.complete){ let f=0; if(p.anim==='ollie'){ f = p.vy<-2?2:1; } if(state.uiTrick==='KICKFLIP'){ f= state.trickPhase?4:3;} else if(state.uiTrick==='SHOVE-IT'){ f= state.trickPhase?6:5;} ctx.drawImage(img.skater,f*32,0,32,32, p.x, p.y-24, 32,32);} else { ctx.fillStyle='#fff'; ctx.fillRect(p.x,p.y-18,16,18); }
  if(state.showHit){ ctx.strokeStyle='cyan'; ctx.strokeRect(p.x,p.y-p.h,p.w,p.h); }

  // SPECIAL bar (top center)
  const pct=state.special; const bw=140,bh=10; const bx=Math.floor((cvs.width-bw)/2), by=8;
  ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillRect(bx-1,by-1,bw+2,bh+2);
  ctx.fillStyle='#2b2b36'; ctx.fillRect(bx,by,bw,bh);
  ctx.fillStyle = state.specialActive? '#7aff9d':'#9d7bff'; ctx.fillRect(bx,by,Math.floor(bw*pct),bh);
  ctx.font='10px system-ui'; ctx.fillStyle='#fff'; const label='ESPECIAL'; const lw=ctx.measureText(label).width; ctx.fillText(label, Math.floor(bx+(bw-lw)/2), by+bh+10);

  // popups
  for(const pu of state.popups){ ctx.font='bold 12px system-ui'; ctx.fillStyle='black'; ctx.fillText(pu.text,pu.x+1,pu.y+1); ctx.fillStyle='#fffb7a'; ctx.fillText(pu.text,pu.x,pu.y); }

  // HUD trick/combo persistente
  ctx.font='bold 12px system-ui'; if(state.uiTrick){ ctx.fillStyle='#fffb7a'; ctx.fillText(state.uiTrick, 14, 20);} if(state.uiCombo>0){ ctx.fillStyle='#fff'; ctx.fillText('COMBO: '+state.uiCombo, 14, 36); }

  ctx.restore();

  // Menus & overlays
  if(state.mode==='MENU'){ ctx.fillStyle=(state.prevMode==='PLAY'?'rgba(0,0,0,.6)':'rgba(0,0,0,.35)'); ctx.fillRect(0,0,cvs.width,cvs.height);
    drawCentered('Skate Bliss', 80,'#fff',18); drawCentered('↑/↓ navega  •  Enter seleciona',100,'#a5a5ad',12);
    ctx.font='12px system-ui';
    for(let i=0;i<MENU_MAIN.length;i++){ const y=132+i*20; const txt=MENU_MAIN[i]; ctx.fillStyle=(i===menuIndex)?'#fffb7a':'#fff'; const w=ctx.measureText(txt).width; ctx.fillText(txt,(cvs.width-w)/2,y); }
  }
  if(state.mode==='OPTIONS'){ ctx.fillStyle=(state.prevMode==='PLAY'?'rgba(0,0,0,.6)':'rgba(0,0,0,.35)'); ctx.fillRect(0,0,cvs.width,cvs.height);
    drawCentered('Opções', 80,'#fff',18);
    const items=[`MÚSICA: ${musicEl.muted?'OFF':'ON'}`, `SFX: ${sfxMuted?'OFF':'ON'}`, `HITBOXES: ${state.showHit?'ON':'OFF'}`, `DIFICULDADE: ${opts.diff}`, 'VOLTAR'];
    ctx.font='12px system-ui';
    for(let i=0;i<items.length;i++){ const y=120+i*20; const txt=items[i]; ctx.fillStyle=(i===optIndex)?'#fffb7a':'#fff'; const w=ctx.measureText(txt).width; ctx.fillText(txt,(cvs.width-w)/2,y); }
    drawCentered('ESPECIAL: segure CTRL (mundo lento; você normal). CDs pausam; e +2s de lock ao sair.', 220,'#a5a5ad',11);
  }
  if(state.mode==='HELP'){ ctx.fillStyle='rgba(0,0,0,.35)'; ctx.fillRect(0,0,cvs.width,cvs.height);
    drawCentered('Como jogar',80,'#fff',18);
    ['←/→ move • Espaço pula • duplo Espaço = Kickflip • ←/→ no ar = Shove-it','Pegue CDs para MULT/COMBO • Barra ESPECIAL enche +10% por CD','Segure CTRL para slow-mo do mundo; ao soltar, volta.'].forEach((t,i)=> drawCentered(t, 120+i*18, '#ddd',12));
    drawCentered('ESC para voltar', 220, '#a5a5ad', 12);
  }
  if(state.mode==='CREDITS'){ ctx.fillStyle='rgba(0,0,0,.35)'; ctx.fillRect(0,0,cvs.width,cvs.height);
    drawCentered('Créditos',80,'#fff',18); ['BLISS','DIEV','dievbliss.com'].forEach((t,i)=> drawCentered(t, 120+i*18, '#ddd',12)); drawCentered('ESC para voltar', 220, '#a5a5ad', 12);
  }
  if(state.mode==='GAMEOVER'){ ctx.fillStyle='rgba(0,0,0,.45)'; ctx.fillRect(0,0,cvs.width,cvs.height);
    drawCentered('Game Over', 100,'#fff',18);
    drawCentered(`Score: ${state.score}  •  Best: ${state.best}  •  CDs: ${state.cdCount}`, 124,'#fff',12);
    drawCentered('ENTER para reiniciar • ESC para menu', 148,'#ddd',12);
  }
}

/* Loop */
let last=0;
function loop(ts){ const dt=Math.min(33, ts-last); last=ts; update(dt); render(); requestAnimationFrame(loop); }
requestAnimationFrame(loop);

/* Start */
loadPlaylist();
