// Skate Bliss v7.6.1
// - Playlist {file,title} + volume slider (default 30%)
// - Fallbacks robustos (sem travar o canvas/jogo)
// - Sem placeholders de música

// Safe DOM helpers
function $(s){ return document.querySelector(s); }
const VERSION='768'; const CB='?v='+VERSION; let assetErrors=[];
function on(el,ev,fn){ if(el && el.addEventListener) el.addEventListener(ev,fn); }

// Canvas
const cvs = document.getElementById('game');
const ctx = cvs ? cvs.getContext('2d',{alpha:false}) : null;
if(!cvs || !ctx){ console.error('Canvas/Context ausente.'); }

// UI refs
const scoreEl=$('#score'), bestEl=$('#best'), multEl=$('#mult'), cdsEl=$('#cds');
const lbEl=$('#leaderboard'), lbList=$('#lb-list');
const btnLB=$('#btn-leaderboard'), btnCloseLB=$('#btn-close-lb'), btnResetLB=$('#btn-reset-lb');
const btnHelp=$('#btn-help'), helpEl=$('#help'), btnCloseHelp=$('#btn-close-help');
const btnMuteSFX=$('#btn-mute-sfx');

// Music refs
const musicEl=$('#music');
const btnPrev=$('#prev'), btnPlay=$('#play'), btnNext=$('#next');
const trackEl=$('#track'); const volEl=$('#vol'); const btnMuteMusic=$('#btn-mute-music');
// ====== OPTIONS (init early) ======
const OPTS_KEY='skate_bliss_opts';
function loadOpts(){
  try{
    const o = JSON.parse(localStorage.getItem(OPTS_KEY)||'{}');
    return {
      vol: (typeof o.vol==='number')? o.vol : 0.30,
      sfx: (typeof o.sfx==='boolean')? o.sfx : false,
      hit: (typeof o.hit==='boolean')? o.hit : false,
      diff: (o.diff==='FAST'?'FAST':'NORMAL')
    };
  }catch(_){ return {vol:0.30, sfx:false, hit:false, diff:'NORMAL'}; }
}
function saveOpts(){ try{ localStorage.setItem(OPTS_KEY, JSON.stringify(opts)); }catch(_){} }
const opts = loadOpts();
if (musicEl) musicEl.volume = opts.vol;
if (volEl)   try{ volEl.value = String(opts.vol.toFixed(2)); }catch(_){}
let sfxMuted = opts.sfx; // single declaration
if (btnMuteSFX) btnMuteSFX.textContent = sfxMuted ? '🔇 SFX' : '🔈 SFX';
let diffFactor = (opts.diff==='FAST') ? 1.25 : 1.0;
// NOTE: we'll apply state.showHit after state is created.


// SFX
const sfxJump = $('#sfx-jump'), sfxCD=$('#sfx-cd'), sfxCone=$('#sfx-cone'), sfxBag=$('#sfx-bag'), sfxBottle=$('#sfx-bottle');
sfxMuted=opts.sfx; if(btnMuteSFX){ btnMuteSFX.textContent=sfxMuted?'🔇 SFX':'🔈 SFX'; }
 on(btnMuteSFX,'click',()=>{ sfxMuted=!sfxMuted; if(btnMuteSFX) btnMuteSFX.textContent=sfxMuted?'🔇 SFX':'🔈 SFX'; opts.sfx=sfxMuted; saveOpts(); });
function playSFX(a){ if(!sfxMuted && a){ try{ a.currentTime=0; a.play(); }catch(_){} }}

// Assets
const imgSkater=new Image(); imgSkater.onerror=()=>assetErrors.push('skater.png'); imgSkater.src='assets/skater.png'+CB;
const imgObs=new Image();    imgObs.onerror=()=>assetErrors.push('obstacles.png'); imgObs.src='assets/obstacles.png'+CB;
const imgCDs=new Image();    imgCDs.onerror=()=>assetErrors.push('collectibles.png'); imgCDs.src='assets/collectibles.png'+CB;
const imgGround=new Image(); imgGround.onerror=()=>assetErrors.push('ground.png'); imgGround.src='assets/ground.png'+CB;
const imgSky=new Image();    imgSky.onerror=()=>assetErrors.push('skyline.png'); imgSky.src='assets/skyline.png'+CB;

// Input
const input={left:false,right:false,jump:false};
on(window,'keydown',e=>{
  if(['ArrowLeft','KeyA'].includes(e.code)) input.left=true;
  if(['ArrowRight','KeyD'].includes(e.code)) input.right=true;
  if(['Space','ArrowUp'].includes(e.code)) input.jump=true;
});
on(window,'keyup',e=>{
  if(['ArrowLeft','KeyA'].includes(e.code)) input.left=false;
  if(['ArrowRight','KeyD'].includes(e.code)) input.right=false;
  if(['Space','ArrowUp'].includes(e.code)) input.jump=false;
});
on(cvs,'pointerdown',()=>input.jump=true);
on(cvs,'pointerup',()=>input.jump=false);

// Constantes
const GRAV=0.65, FRICTION=0.86, SPEED=0.95, JUMP=-10;
const groundTop=230, groundY=groundTop-10;

// Hitbox tunável
const HB_OFFSET_X=7, HB_OFFSET_Y=10, HB_WIDTH=14, HB_HEIGHT=12;

// Estado
const state={
  running:true,t:0,score:0,best:+(localStorage.getItem('bliss_skate_best')||0),
  mult:1,multTime:0, cdCount:0,
  player:{x:60,y:groundY,vx:0,vy:0,w:22,h:18,onGround:true,frame:0,anim:'roll',animTimer:0}, jumpHold:0,
  obstacles:[], cds:[], popups:[], particles:[],
  spawnCooldown:1000, cdCooldown:1200, speedBase:2.0,
  skyOffset:0, groundOffset:0, cdAnim:0, shake:0, showHit:false
};
if(bestEl) bestEl.textContent=state.best;
state.showHit = opts.hit;
// ====== GAME MODES ======
// Modes: 'MENU', 'PLAY', 'PAUSE', 'HELP', 'OPTIONS', 'SKINS', 'CREDITS', 'GAMEOVER'
state.mode = 'MENU';
state.fade = 0; // for transitions
// apply opts to current session
if(musicEl){ musicEl.volume = opts.vol; }
if(volEl){ volEl.value = String(opts.vol.toFixed(2)); }
sfxMuted = opts.sfx;

diffFactor = (opts.diff==='FAST') ? 1.25 : 1.0;

// Menu navigation
let menuIndex = 0;
const MENU_ITEMS = ['JOGAR','COMO JOGAR','OPÇÕES','SKINS','CRÉDITOS'];
let pauseIndex = 0;
const PAUSE_ITEMS = ['RETOMAR','REINICIAR','MENU'];
let overIndex = 0;
const OVER_ITEMS = ['REINICIAR','MENU'];

// Options navigation
let optIndex = 0;
const OPT_ITEMS = ['VOLUME','SFX','HITBOXES','DIFICULDADE','VOLTAR'];

// Skins placeholder
let skinIndex = 0;
const SKINS = ['Default']; // placeholder for future unlocks

// Fade helpers
function startFade(){ state.fade = 1.0; }
function drawFade(){ if(state.fade>0){ ctx.fillStyle='rgba(0,0,0,'+Math.min(0.4,state.fade)+')'; ctx.fillRect(0,0,cvs.width,cvs.height); state.fade -= 0.02; } }

// Credits data
const CREDITS = ['Skate Bliss','—','BLISS','DIEV','dievbliss.com'];


// Leaderboard
const LB_KEY='bliss_skate_lb_v7', BEST_KEY='bliss_skate_best';
function loadLB(){ try{return JSON.parse(localStorage.getItem(LB_KEY)||'[]')}catch(_){return[]} }
function saveLB(lb){ localStorage.setItem(LB_KEY, JSON.stringify(lb.slice(0,5))); }
function submitScore(name,value){ const lb=loadLB(); lb.push({name,value,ts:Date.now()}); lb.sort((a,b)=>b.value-a.value); saveLB(lb); }
function renderLB(){ const lb=loadLB(); if(!lbList) return; lbList.innerHTML=''; if(!lb.length){lbList.innerHTML='<li>Ninguém no ranking ainda.</li>';return} lb.forEach((r,i)=>{const li=document.createElement('li'); li.textContent=`${i+1}. ${r.name} — ${r.value}`; lbList.appendChild(li);}); }
on(btnLB,'click',()=>{ renderLB(); if(lbEl) lbEl.hidden=false; });
on(btnCloseLB,'click',()=>{ if(lbEl) lbEl.hidden=true; });
on(btnResetLB,'click',()=>{ if(confirm('Apagar ranking local?')){ localStorage.removeItem(LB_KEY); renderLB(); }});
on(btnHelp,'click',()=>{ if(helpEl) helpEl.hidden=false; });
on(btnCloseHelp,'click',()=>{ if(helpEl) helpEl.hidden=true; });
on(window,'keydown',e=>{ if(!state.running && e.code==='KeyR') resetRun(); });
on(window,'keydown',e=>{ if(e.code==='KeyH') state.showHit=!state.showHit; });

// Obstáculos
const OB_TYPES=[
  {name:'cone',   sx:0,  sy:0, w:24,h:24, bbox:{x:4,y:6,w:16,h:16}, sfx:()=>playSFX(sfxCone)},
  {name:'bag',    sx:24, sy:0, w:24,h:24, bbox:{x:3,y:8,w:18,h:14}, sfx:()=>playSFX(sfxBag)},
  {name:'bottle', sx:48, sy:0, w:24,h:24, bbox:{x:8,y:4,w:8,h:18},  sfx:()=>playSFX(sfxBottle)},
];
function spawnObstacle(){
  const type=OB_TYPES[Math.floor(Math.random()*OB_TYPES.length)];
  const speed=state.speedBase+Math.random()*1.6;
  const minGap=120+speed*45;
  let x=cvs.width+30;
  if(state.obstacles.length){
    const last=state.obstacles[state.obstacles.length-1];
    x=Math.max(x,last.x+last.w+minGap);
  }
  const y=groundTop-type.h;
  state.obstacles.push({x,y,w:type.w,h:type.h,speed,type});
}
function updateObstacles(dt){
  state.spawnCooldown-=dt;
  if(state.spawnCooldown<=0){
    spawnObstacle();
    const base=(1000-Math.min(350,Math.floor(state.score/10)*15))/diffFactor;
    state.spawnCooldown=Math.max(680,base)+Math.random()*180;
  }
  state.obstacles.forEach(o=>o.x-=o.speed);
  state.obstacles=state.obstacles.filter(o=>o.x+o.w>-30);
}

// CDs
function spawnCD(){
  const speed=state.speedBase+1.2;
  let x=cvs.width+30;
  if(state.obstacles.length){
    const last=state.obstacles[state.obstacles.length-1];
    x=Math.max(x,last.x+last.w+60);
  }
  const y=Math.floor(120+Math.random()*(200-120));
  state.cds.push({x,y,w:16,h:16,speed});
}
function updateCDs(dt){
  state.cdCooldown-=dt;
  if(state.cdCooldown<=0){
    spawnCD();
    state.cdCooldown=1400+Math.random()*1200;
  }
  state.cds.forEach(c=>c.x-=c.speed);
  state.cds=state.cds.filter(c=>c.x+c.w>-20);
  state.cdAnim=(state.cdAnim+dt)%400;
}

// Partículas
function addParticles(x,y,n=10,col='#fffb7a'){
  for(let i=0;i<n;i++){
    state.particles.push({x,y,vx:(Math.random()*2-1)*1.2,vy:(Math.random()*-1.5)-0.5,life:500+Math.random()*400,color:col,size:2+Math.random()*2});
  }
}
function updateParticles(dt){
  for(const p of state.particles){
    p.vy+=0.002*dt; p.x+=p.vx*dt*0.06; p.y+=p.vy*dt*0.06; p.life-=dt;
  }
  state.particles=state.particles.filter(p=>p.life>0);
}

// Utils
function aabb(ax,ay,aw,ah,bx,by,bw,bh){ return ax<bx+bw && ax+aw>bx && ay<by+bh && ay+ah>by; }
function addPopup(text,x,y,color='#fffb7a'){ state.popups.push({text,x,y,vy:-0.12,life:1600,color}); }
function updatePopups(dt){ state.popups.forEach(p=>{p.y+=p.vy*dt;p.life-=dt}); state.popups=state.popups.filter(p=>p.life>0); }

function endRun(hitType){
  state.running=false; state.shake=14; if(hitType&&hitType.sfx) hitType.sfx();
  if(state.score>state.best){state.best=state.score; if(bestEl) bestEl.textContent=state.best;
state.showHit = opts.hit;
// ====== GAME MODES ======
// Modes: 'MENU', 'PLAY', 'PAUSE', 'HELP', 'OPTIONS', 'SKINS', 'CREDITS', 'GAMEOVER'
state.mode = 'MENU';
state.fade = 0; // for transitions
// Options persisted

');
    return {
      vol: typeof o.vol==='number'? o.vol : 0.30,
      sfx: typeof o.sfx==='boolean'? o.sfx : false,
      hit: typeof o.hit==='boolean'? o.hit : false,
      diff: (o.diff==='FAST'?'FAST':'NORMAL')
    };
  }catch(_){ return {vol:0.30,sfx:false,hit:false,diff:'NORMAL'}; }
}


// apply opts to current session
if(musicEl){ musicEl.volume = opts.vol; }
if(volEl){ volEl.value = String(opts.vol.toFixed(2)); }
sfxMuted = opts.sfx;

diffFactor = (opts.diff==='FAST') ? 1.25 : 1.0;

// Menu navigation
let menuIndex = 0;
const MENU_ITEMS = ['JOGAR','COMO JOGAR','OPÇÕES','SKINS','CRÉDITOS'];
let pauseIndex = 0;
const PAUSE_ITEMS = ['RETOMAR','REINICIAR','MENU'];
let overIndex = 0;
const OVER_ITEMS = ['REINICIAR','MENU'];

// Options navigation
let optIndex = 0;
const OPT_ITEMS = ['VOLUME','SFX','HITBOXES','DIFICULDADE','VOLTAR'];

// Skins placeholder
let skinIndex = 0;
const SKINS = ['Default']; // placeholder for future unlocks

// Fade helpers
function startFade(){ state.fade = 1.0; }
function drawFade(){ if(state.fade>0){ ctx.fillStyle='rgba(0,0,0,'+Math.min(0.4,state.fade)+')'; ctx.fillRect(0,0,cvs.width,cvs.height); state.fade -= 0.02; } }

// Credits data
const CREDITS = ['Skate Bliss','—','BLISS','DIEV','dievbliss.com'];
 localStorage.setItem(BEST_KEY,String(state.best));}
  // Ranking prompt opcional (desativado no fluxo de menu)
  // const raw=prompt('Seu nome para o ranking:','guest')||'guest';
  // submitScore((raw.trim().slice(0,16)||'guest'),state.score);
  // renderLB(); if(lbEl) lbEl.hidden=false;
  state.mode='GAMEOVER'; startFade();
}
function resetRun(){
  Object.assign(state,{running:true,t:0,score:0,mult:1,multTime:0,cdCount:0, uiTrick:null, uiCombo:0, uiLive:false,
    player:{x:60,y:groundY,vx:0,vy:0,w:22,h:18,onGround:true,frame:0,anim:'roll',animTimer:0}, jumpHold:0,
    obstacles:[],cds:[],popups:[],particles:[],spawnCooldown:900,cdCooldown:1000,speedBase:2.0,skyOffset:0,groundOffset:0,cdAnim:0,shake:0
  });
  last=performance.now(); if(typeof requestAnimationFrame==='function') requestAnimationFrame(loop);
  if(scoreEl) scoreEl.textContent='0'; if(multEl) multEl.textContent='1.0×'; if(cdsEl) cdsEl.textContent='0';
}

// Update principal
let last=0, lastDt=16;
function update(dt){
  if(state.mode!=='PLAY'){ return; }

  const p=state.player;
  // movimento
  p.vx+=(input.right-input.left)*SPEED; p.vx*=FRICTION; p.vy+=GRAV;
  if(input.jump && p.onGround){ p.vy=JUMP; p.onGround=false; p.anim='ollie'; p.frame=1; p.animTimer=0; state.jumpHold=180; playSFX(sfxJump); addParticles(p.x+12,p.y-10,12,'#9d7bff'); }
  p.x+=p.vx; p.y+=p.vy;
  if(!p.onGround){ state.airTime += dt; if(state.airTime>350 && state.trickNow!=='OLLIE'){ state.trickNow='OLLIE'; state.trickFlash=500; } }
  if(p.y>groundY){ p.y=groundY; p.vy=0; if(!p.onGround){ // landing event
      if(state.combo>0){ const gain = Math.floor(state.combo * state.mult); state.score += gain; addPopup(`COMBO +${gain}`, p.x, p.y-50); if(scoreEl) scoreEl.textContent=state.score; }
      // freeze last shown trick/combo until next trick/combo
      state.uiLive = false;
      state.combo=0; state.usedKickflip=false; state.usedShove=false; state.trickNow=null; state.trickFlash=0; state.airTime=0; }
    p.onGround=true; if(p.anim!=='roll'){p.anim='roll';p.frame=0;} }
  if(p.x<8) p.x=8; if(p.x>cvs.width-8-p.w) p.x=cvs.width-8-p.w;
  p.animTimer+=dt; if(p.anim==='ollie'){ p.frame=p.vy<-2?2:1; }

  // scroll e dificuldade
  const scroll=1.2+Math.min(2.5,state.score/120);
  state.skyOffset=(state.skyOffset+scroll*0.2)%cvs.width;
  state.groundOffset=(state.groundOffset+scroll)%cvs.width;
  state.speedBase=(2.0+Math.min(2.0,state.score/200)) * diffFactor;

  updateObstacles(dt); updateCDs(dt); updateParticles(dt);

  // colisão
  const pb={x:p.x+HB_OFFSET_X, y:(p.y-24)+HB_OFFSET_Y, w:HB_WIDTH, h:HB_HEIGHT};
  for(const o of state.obstacles){
    if(o.x>cvs.width || o.x+o.w<0) continue;
    const b=o.type.bbox; const bx=o.x+b.x, by=o.y+b.y;
    if(aabb(pb.x,pb.y,pb.w,pb.h,bx,by,b.w,b.h)){ addParticles(p.x+12,p.y-10,24,'#ff5555'); endRun(o.type); return; }
  }

  // CDs
  for(let i=state.cds.length-1;i>=0;i--){
    const c=state.cds[i]; const cb={x:c.x+3,y:c.y+3,w:10,h:10};
    if(aabb(pb.x,pb.y,pb.w,pb.h,cb.x,cb.y,cb.w,cb.h)){
      state.cds.splice(i,1); playSFX(sfxCD); addParticles(c.x+8,c.y+8,14,'#fffb7a');
      state.cdCount++; if(cdsEl) cdsEl.textContent=state.cdCount;
      state.mult=Math.min(5, +(state.mult+1).toFixed(1)); state.multTime=0;
      const bonus=10*state.mult; state.score+=Math.floor(bonus);
      addPopup(`CD +${Math.floor(bonus)} (${state.mult.toFixed(1)}×)`, p.x, p.y-30);
      if(scoreEl) scoreEl.textContent=state.score; if(multEl) multEl.textContent=state.mult.toFixed(1)+'×';
    }
  }

  // mult decai
  state.multTime+=dt; if(state.mult>1 && state.multTime>4000){ state.mult=Math.max(1, +(state.mult-0.002*dt).toFixed(1)); if(multEl) multEl.textContent=state.mult.toFixed(1)+'×'; }

  // score passivo
  state.t+=dt; if(state.t>=60){ const inc=Math.floor(state.t/60); state.score+=Math.floor(inc*state.mult); state.t%=60; if(scoreEl) scoreEl.textContent=state.score; }

  updatePopups(dt);
  if(state.shake>0){ state.shake=Math.max(0,state.shake-0.4*(dt/16.6)); }
}

// Render
function drawTiled(img,y,off){ const w=img.width; const x1=-off, x2=x1+w; ctx.drawImage(img,x1,y); ctx.drawImage(img,x2,y); }
function render(){
  const sx=state.shake>0?(Math.random()*state.shake - state.shake/2):0;
  const sy=state.shake>0?(Math.random()*state.shake - state.shake/2):0;
  ctx.save(); ctx.translate(sx,sy);
  ctx.fillStyle='#0b0b0d'; ctx.fillRect(0,0,cvs.width,cvs.height);
  if(imgSky.complete) drawTiled(imgSky, 80, state.skyOffset);
  if(imgGround.complete) drawTiled(imgGround, groundTop, state.groundOffset);
  // CDs
  const cdFrame=(state.cdAnim<200)?0:1;
  for(const c of state.cds){
    if(imgCDs.complete) ctx.drawImage(imgCDs, cdFrame*16, 0, 16,16, c.x, c.y, 16,16);
    if(state.showHit){ ctx.strokeStyle='#0ff'; ctx.strokeRect(c.x+3,c.y+3,10,10); }
  }
  // Player
  const p=state.player;
  if(imgSkater.complete){
    // Frame map: 0 roll,1 ollie,2 air,3 kickflipA,4 kickflipB,5 shove-it
    let f = p.frame%3;
    if(state.trickNow==='KICKFLIP'){ f = (Math.floor(performance.now()/120)%2) ? 3 : 4; }
    else if(state.trickNow==='SHOVE-IT'){ f = 5; }
    const sxp = f*32;
    ctx.drawImage(imgSkater, sxp, 0, 32,32, p.x, p.y-24, 32,32);
    if(state.showHit){ ctx.strokeStyle='#0f0'; ctx.strokeRect(p.x+HB_OFFSET_X,(p.y-24)+HB_OFFSET_Y,HB_WIDTH,HB_HEIGHT); } }
  // Obstacles
  for(const o of state.obstacles){
    if(imgObs.complete){ ctx.drawImage(imgObs,o.type.sx,o.type.sy,o.type.w,o.type.h,o.x,o.y,o.type.w,o.type.h);
      if(state.showHit){ const b=o.type.bbox; ctx.strokeStyle='#f00'; ctx.strokeRect(o.x+b.x,o.y+b.y,b.w,b.h); } }
  }
  // Partículas
  for(const prt of state.particles){ ctx.globalAlpha=Math.max(0,prt.life/900); ctx.fillStyle=prt.color; ctx.fillRect(prt.x,prt.y,prt.size,prt.size); ctx.globalAlpha=1; }
  // Popups
  for(const pop of state.popups){ ctx.font='bold 12px system-ui'; ctx.fillStyle='black'; ctx.fillText(pop.text,pop.x+1,pop.y+1); ctx.fillStyle='#fffb7a'; ctx.fillText(pop.text,pop.x,pop.y); }

  // Trick/Combo overlay
  ctx.font='bold 12px system-ui';
  if(state.combo>0){ ctx.fillStyle='#fff'; ctx.fillText(`COMBO: ${state.combo}`, 14, 48); }
  if(state.trickFlash>0 && state.trickNow){ ctx.fillStyle='#fffb7a'; ctx.fillText(state.trickNow, 14, 32); state.trickFlash -= lastDt; if(state.trickFlash<=0) state.trickNow=null; }

  ctx.restore();

  // Asset health banner
  if(assetErrors.length){
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,.65)'; ctx.fillRect(10,10, c.width-20, 40);
    ctx.font='12px system-ui'; ctx.fillStyle='#ff7b7b';
    ctx.fillText('Arquivos faltando: '+assetErrors.join(', ')+' — confira a pasta /assets no GitHub.', 20, 35);
    ctx.restore();
  }


  // === UI Screens ===
  ctx.save();
  ctx.fillStyle='#fff';
  ctx.font='bold 18px system-ui';
  if(state.mode==='MENU'){
    ctx.fillText('Skate Bliss', 170, 70);
    ctx.font='12px system-ui'; ctx.fillStyle='#a5a5ad';
    ctx.fillText('↑/↓ navega  •  Enter seleciona  •  ESC fecha', 110, 95);
    const items = MENU_ITEMS;
    for(let i=0;i<items.length;i++){
      const y = 130 + i*22;
      ctx.fillStyle = (i===menuIndex)? '#fffb7a' : '#fff';
      ctx.fillText(items[i], 200, y);
    }
  }
  if(state.mode==='PAUSE'){
    ctx.fillText('PAUSADO', 195, 90);
    ctx.font='12px system-ui'; ctx.fillStyle='#a5a5ad'; ctx.fillText('P/ESC: Retomar/Fechar', 170, 110);
    const items = PAUSE_ITEMS;
    for(let i=0;i<items.length;i++){
      const y = 150 + i*22;
      ctx.fillStyle = (i===pauseIndex)? '#fffb7a' : '#fff';
      ctx.fillText(items[i], 200, y);
    }
  }
  if(state.mode==='HELP'){
    ctx.fillText('Como jogar', 185, 70);
    ctx.font='12px system-ui'; ctx.fillStyle='#ddd';
    const lines=[
      'PC: ←/→ ou A/D para mover, Espaço/↑ para pular.',
      'Mobile: toque no canvas para pular.',
      'Tricks: duplo Espaço = Kickflip • ←/→ no ar = Shove-it.',
      'Pegue CDs para aumentar MULT e pontuar combos ao pousar.'
    ];
    for(let i=0;i<lines.length;i++){ ctx.fillText(lines[i], 60, 110+i*18); }
    ctx.fillStyle='#a5a5ad'; ctx.fillText('ESC para voltar', 190, 210);
  }
  if(state.mode==='OPTIONS'){
    ctx.fillText('Opções', 200, 70);
    ctx.font='12px system-ui'; ctx.fillStyle='#ddd';
    const vlabel = 'VOLUME: ' + (musicEl? (musicEl.volume*100).toFixed(0) : Math.round(opts.vol*100)) + '%';
    const sfxLabel = 'SFX: ' + (sfxMuted?'OFF':'ON');
    const hitLabel = 'HITBOXES: ' + (state.showHit?'ON':'OFF');
    const diffLabel = 'DIFICULDADE: ' + opts.diff;
    const items=[vlabel, sfxLabel, hitLabel, diffLabel, 'VOLTAR'];
    for(let i=0;i<items.length;i++){
      const y = 120 + i*22;
      ctx.fillStyle = (i===optIndex)? '#fffb7a' : '#fff';
      ctx.fillText(items[i], 150, y);
    }
    ctx.fillStyle='#a5a5ad'; ctx.fillText('←/→ ajusta • Enter alterna • ESC volta', 120, 230);
  }
  if(state.mode==='SKINS'){
    ctx.fillText('Skins', 210, 70);
    ctx.font='12px system-ui'; ctx.fillStyle='#ddd';
    ctx.fillText('Em breve: desbloqueie skins com CDs totais.', 110, 120);
    ctx.fillStyle='#a5a5ad'; ctx.fillText('ESC para voltar', 190, 210);
  }
  if(state.mode==='CREDITS'){
    ctx.fillText('Créditos', 200, 70);
    ctx.font='12px system-ui'; ctx.fillStyle='#ddd';
    const lines = CREDITS;
    for(let i=0;i<lines.length;i++){ ctx.fillText(lines[i], 200 - (lines[i].length*3), 110+i*18); }
    ctx.fillStyle='#a5a5ad'; ctx.fillText('ESC para voltar', 190, 220);
  }
  if(state.mode==='GAMEOVER'){
    ctx.fillText('Game Over', 190, 70);
    ctx.font='12px system-ui'; ctx.fillStyle='#ddd';
    ctx.fillText('Score: '+state.score+'   Best: '+state.best+'   CDs: '+state.cdCount, 100, 100);
    const items = OVER_ITEMS;
    for(let i=0;i<items.length;i++){
      const y = 150 + i*22;
      ctx.fillStyle = (i===overIndex)? '#fffb7a' : '#fff';
      ctx.fillText(items[i], 200, y);
    }
  }
  ctx.restore();

  // Asset health banner
  if(assetErrors.length){
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,.65)'; ctx.fillRect(10,10, c.width-20, 40);
    ctx.font='12px system-ui'; ctx.fillStyle='#ff7b7b';
    ctx.fillText('Arquivos faltando: '+assetErrors.join(', ')+' — confira a pasta /assets no GitHub.', 20, 35);
    ctx.restore();
  }

  drawFade();

}

function loop(ts){ const dt=Math.min(33, ts-last); last=ts; lastDt=dt; if(state.running){ update(dt); render(); if(typeof requestAnimationFrame==='function') requestAnimationFrame(loop); } else { render(); } }
if(typeof requestAnimationFrame==='function'){ requestAnimationFrame(ts=>{ last=ts; requestAnimationFrame(loop); }); }

// ==== Music Player (playlist {file,title}) ====
let playlist=[], current=0, musicMuted=false;
function trkFile(i){ const it=playlist[i]; return (typeof it==='string')? it : it.file; }
function trkTitle(i){ const it=playlist[i]; return (typeof it==='string')? it : (it.title||it.file); }

async function loadPlaylist(){
  try{
    const res = await fetch('assets/music/playlist.json'+CB, {cache:'no-store'});
    if(res.ok){
      const arr = await res.json();
      playlist = Array.isArray(arr) ? arr.map(it => (typeof it==='string') ? ({file:it,title:it}) : it) : [];
    } else { playlist=[]; }
  } catch(_) { playlist=[]; }
  if(!trackEl) return;
  if(playlist.length){
    current=0;
    musicEl.src = 'assets/music/' + encodeURIComponent(trkFile(current));
    trackEl.textContent = trkTitle(current);
  } else {
    trackEl.textContent = 'Sem músicas na pasta (assets/music)';
  }
}

function playMusic(){ if(!playlist.length||!musicEl) return; musicEl.play().catch(()=>{}); if(btnPlay) btnPlay.textContent='⏸'; }
function pauseMusic(){ if(!musicEl) return; musicEl.pause(); if(btnPlay) btnPlay.textContent='▶'; }

on(btnPlay,'click',()=>{ if(!playlist.length){ return; } if(musicEl.paused) playMusic(); else pauseMusic(); });
on(btnPrev,'click',()=>{ if(!playlist.length) return; current=(current-1+playlist.length)%playlist.length; musicEl.src='assets/music/'+encodeURIComponent(trkFile(current)); if(trackEl) trackEl.textContent=trkTitle(current); playMusic(); });
on(btnNext,'click',()=>{ if(!playlist.length) return; current=(current+1)%playlist.length; musicEl.src='assets/music/'+encodeURIComponent(trkFile(current)); if(trackEl) trackEl.textContent=trkTitle(current); playMusic(); });
on(musicEl,'ended',()=>{ if(!playlist.length) return; current=(current+1)%playlist.length; musicEl.src='assets/music/'+encodeURIComponent(trkFile(current)); if(trackEl) trackEl.textContent=trkTitle(current); playMusic(); });
on(musicEl,'error',()=>{ if(trackEl) trackEl.textContent='Erro ao carregar faixa'; });
on(btnMuteMusic,'click',()=>{ musicMuted=!musicMuted; if(musicEl) musicEl.muted=musicMuted; if(btnMuteMusic) btnMuteMusic.textContent=musicMuted?'🔈 Música':'🔊 Música'; });
if(musicEl){ musicEl.volume=0.30; }
if(volEl){ volEl.value=String(opts.vol.toFixed(2)); on(volEl,'input',()=>{ if(musicEl){ musicEl.volume=parseFloat(volEl.value||'0.3'); opts.vol = musicEl.volume; saveOpts(); } }); }

loadPlaylist();

// ===== Global UI Controls =====
on(window,'keydown',e=>{
  // ESC toggles pause or back to menu/help/options
  if(e.code==='Escape'){
    if(state.mode==='PLAY'){ state.mode='PAUSE'; startFade(); }
    else if(state.mode==='PAUSE'){ state.mode='PLAY'; }
    else if(state.mode==='HELP' || state.mode==='OPTIONS' || state.mode==='SKINS' || state.mode==='CREDITS'){ state.mode='MENU'; startFade(); }
  }
  if(state.mode==='MENU'){
    if(['ArrowDown','KeyS'].includes(e.code)) menuIndex=(menuIndex+1)%MENU_ITEMS.length;
    if(['ArrowUp','KeyW'].includes(e.code)) menuIndex=(menuIndex-1+MENU_ITEMS.length)%MENU_ITEMS.length;
    if(e.code==='Enter' || e.code==='Space'){
      const pick = MENU_ITEMS[menuIndex];
      if(pick==='JOGAR'){ state.mode='PLAY'; resetRun(); }
      if(pick==='COMO JOGAR'){ state.mode='HELP'; }
      if(pick==='OPÇÕES'){ state.mode='OPTIONS'; }
      if(pick==='SKINS'){ state.mode='SKINS'; }
      if(pick==='CRÉDITOS'){ state.mode='CREDITS'; }
      startFade();
    }
  } else if(state.mode==='PAUSE'){
    if(['ArrowDown','KeyS'].includes(e.code)) pauseIndex=(pauseIndex+1)%PAUSE_ITEMS.length;
    if(['ArrowUp','KeyW'].includes(e.code)) pauseIndex=(pauseIndex-1+PAUSE_ITEMS.length)%PAUSE_ITEMS.length;
    if(e.code==='Enter' || e.code==='Space'){
      const pick=PAUSE_ITEMS[pauseIndex];
      if(pick==='RETOMAR'){ state.mode='PLAY'; }
      if(pick==='REINICIAR'){ resetRun(); state.mode='PLAY'; }
      if(pick==='MENU'){ state.mode='MENU'; }
      startFade();
    }
  } else if(state.mode==='GAMEOVER'){
    if(['ArrowDown','KeyS'].includes(e.code)) overIndex=(overIndex+1)%OVER_ITEMS.length;
    if(['ArrowUp','KeyW'].includes(e.code)) overIndex=(overIndex-1+OVER_ITEMS.length)%OVER_ITEMS.length;
    if(e.code==='Enter' || e.code==='Space'){
      const pick=OVER_ITEMS[overIndex];
      if(pick==='REINICIAR'){ resetRun(); state.mode='PLAY'; }
      if(pick==='MENU'){ state.mode='MENU'; }
      startFade();
    }
  } else if(state.mode==='OPTIONS'){
    if(['ArrowDown','KeyS'].includes(e.code)) optIndex=(optIndex+1)%OPT_ITEMS.length;
    if(['ArrowUp','KeyW'].includes(e.code)) optIndex=(optIndex-1+OPT_ITEMS.length)%OPT_ITEMS.length;
    if(['ArrowLeft','KeyA'].includes(e.code) || ['ArrowRight','KeyD'].includes(e.code)){
      const dir = (['ArrowRight','KeyD'].includes(e.code))? 1 : -1;
      if(OPT_ITEMS[optIndex]==='VOLUME'){
        let v = (musicEl?musicEl.volume:opts.vol) + dir*0.05; v = Math.min(1, Math.max(0, v));
        if(musicEl) musicEl.volume=v; opts.vol=v; if(volEl) volEl.value=String(v.toFixed(2)); saveOpts();
      }
      if(OPT_ITEMS[optIndex]==='DIFICULDADE'){
        opts.diff = (dir>0)? (opts.diff==='NORMAL'?'FAST':'NORMAL') : (opts.diff==='NORMAL'?'FAST':'NORMAL');
        diffFactor = (opts.diff==='FAST')?1.25:1.0; saveOpts();
      }
    }
    if(e.code==='Enter' || e.code==='Space'){
      const pick = OPT_ITEMS[optIndex];
      if(pick==='SFX'){ opts.sfx=!opts.sfx; sfxMuted=opts.sfx; if(btnMuteSFX) btnMuteSFX.textContent=sfxMuted?'🔇 SFX':'🔈 SFX'; saveOpts(); }
      if(pick==='HITBOXES'){ opts.hit=!opts.hit; state.showHit=opts.hit; saveOpts(); }
      if(pick==='VOLTAR'){ state.mode='MENU'; startFade(); }
    }
  } else if(state.mode==='SKINS'){
    if(e.code==='Escape'){ state.mode='MENU'; startFade(); }
  } else if(state.mode==='HELP' || state.mode==='CREDITS'){
    if(e.code==='Escape' || e.code==='Enter' || e.code==='Space'){ state.mode='MENU'; startFade(); }
  }
});


on(window,'keydown',e=>{
  const p = state.player;
  const now = performance.now?performance.now():Date.now();
  // detect double-tap for kickflip (space/up)
  if(['Space','ArrowUp'].includes(e.code)){
    // rising-edge only matters; Our input already set jump=true; allow trick if in air and not used
    if(!p.onGround && !state.usedKickflip){
      if(now - state.lastJumpTap < 250){
        state.trickNow = 'KICKFLIP';
        state.usedKickflip = true;
        state.combo += 150; // base trick points
        state.uiCombo = state.combo; state.uiLive = true;
        state.trickFlash = 1600; // ms
        addPopup('KICKFLIP +150', p.x, p.y-40);
        addParticles(p.x+12, p.y-10, 12, '#ffd36b');
      }
      state.lastJumpTap = now;
    } else {
      state.lastJumpTap = now;
    }
  }
  // shove-it with lateral tap while airborne
  if(['ArrowLeft','KeyA','ArrowRight','KeyD'].includes(e.code)){
    if(!p.onGround && !state.usedShove){
      state.trickNow = 'SHOVE-IT';
      state.usedShove = true;
      state.combo += 100;
      state.uiCombo = state.combo; state.uiLive = true;
      state.trickFlash = 1400;
      addPopup('SHOVE-IT +100', p.x, p.y-40);
      addParticles(p.x+12, p.y-12, 10, '#9d7bff');
    }
  }
});

