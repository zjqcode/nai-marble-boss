/* =========================================================
   6. 关卡
   ========================================================= */
function makeBall(x, y, lv, vx, vy){
  var r = RADII[lv];
  return {
    x:x, y:y, vx:vx||0, vy:vy||0, lv:lv, r:r, m:r*r, invM:1/(r*r),
    life:15, age:0, dead:false, sq:0, tilt:0, portalCd:0, springCd:0, bossCd:0,
    plateCd:0, bounce:0, trail:[], trailT:0, ghost:0
  };
}

function refreshLoadLevel(){
  state.loadLv = Math.min(MAXLV, state.eff.startLv + (state.superT > 0 ? 3 : 0));
  return state.loadLv;
}

/* 空放惩罚：每连续空放一次，装填 +9%，最多 +45%；打中 Boss 立刻清零。
   目的是让「乱按发射」自己变慢，而不是靠数值硬堆。 */
function applyMissPenalty(){
  var base = state.reloadBase || state.reloadMax;
  var id = (state.chapter && state.chapter.id) || 1;
  /* 惩罚上限按章节放宽：新手区最多 +25%，后期 +45%，别把人劝退 */
  var cap = id <= 2 ? 0.25 : (id <= 5 ? 0.35 : 0.45);
  state.reloadMax = base * (1 + Math.min(cap, (state.missStreak || 0) * 0.08));
  if(state.missStreak >= 2) updateBuffs();
}

function flashStart(){
  var el = $id('startFlash');
  if(el){ el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); }
  state.flash = Math.max(state.flash, .7);
}

function startLevel(idx){
  idx = clamp(idx|0, 0, CHAPTERS.length-1);
  var ch = CHAPTERS[idx];
  state.chapter = ch;
  state.chapterIndex = idx;
  state.eff = buildEff();
  Sound.init();
  Sound.setOn(state.soundOn);
  state.mode = 'play';
  state.settlePanelShown = false;
  state.settleReopenT = 0;
  /* ?tutorial=1 强制进入新手演习（忽略「已看过教程」的记录） */
  if(typeof tutStart === 'function'){ tutStart(idx, state.tutForce || /[?&]tutorial=1/.test(location.search)); state.tutForce = false; }
  state.paused = false;
  state.balls.length = 0;
  state.rocks.length = 0;
  state.coins.length = 0;
  state.parts.length = 0;
  state.pops.length = 0;
  state.rings.length = 0;
  state.bolts.length = 0;
  state.beams.length = 0;
  state.springFx.length = 0;
  state.mergeQ.length = 0;
  state.telegraph = null;
  state.suck = null;
  state.beam = null;
  state.warn = false;
  state.combo = 0;
  state.comboT = 0;
  state.score = 0;
  state.hits = 0;
  state.maxLv = state.eff.startLv;
  state.runMilk = 0;
  state.atkIndex = 0;
  state.lowTimeWarned = false;
  state.victoryT = 0;
  state.result = null;
  state.timer = ch.time;
  state.timeMax = ch.time;
  state.atkEvery = ch.every * state.eff.attackDelay;
  state.atkBase = state.atkEvery;      /* 狂暴阶梯的基准，改 atkEvery 时按它推算 */
  state.rageLv = 0;
  state.atkTimer = state.atkEvery;
  state.atkDmg = [1,1,1,2,2,2,2,3][ch.id - 1];
  state.cannonX = view.cx;
  state.moveDir = 0;
  state.dodgeStreak = 0;
  state.slowmo = 0;
  state.flashHue = 'blue';
  state.comboQ = 0;
  state.comboT2 = 0;
  state.trails.length = 0;
  state.ceilFx.length = 0;
  state.plates = [];
  cancelPlatePlacement(true);   /* 换关时不要留着没放下的反弹板预览 */
  state.potionCd = 0;
  var hb = heroBonus();
  state.maxHP = 5 + hb.hp;
  state.heroDmg = hb.dmg;
  setHeroHP(state.maxHP);
  state.shield = 0;
  state.superT = 0;
  state.frenzyT = 0;
  state.items = [];
  state.itemTimer = 8.5;
  state.interrupt = 0;
  state.interruptNeed = 0;
  state.stun = 0;
  state.atkAnim = null;
  state.gasT = 0;
  state.cineT = 1.7;
  state.deadReason = '';
  state.reloadT = 0.5;
  /* 装填按章节分档：前两章慢一点，逼玩家认真对待每一发；后期维持原速 */
  var loadTier = ch.id <= 2 ? 1.24 : (ch.id <= 5 ? 1.12 : 1);
  state.reloadMax = 0.42 * loadTier / state.eff.reload;
  state.reloadBase = state.reloadMax;    /* 空放惩罚在这个基准上叠加 */
  state.missStreak = 0;
  state.aim.active = false;
  state.aim.power = 0;
  state.aim.dx = 0; state.aim.dy = -1;
  state.pendingShot = null;
  state.stunT = 0; state.stunCd = 0; state.invulnT = 0;
  document.body.classList.remove('stunned');
  state.stickX = 0;
  state.boss = {
    char: ch.char, title: ch.title, chap: ch.chap,
    hp: ch.hp, maxHp: ch.hp,
    x: view.cx, y: view.bossY, baseY: view.bossY,
    r: Math.round(view.bossH*0.34), w: Math.round(view.bossH*0.62), h: view.bossH,
    flash: 0, hitScale: 1, entrance: 0, dead: false,
    movePhase: rand(0,TAU), charge: 0, dir: 1, hopT: 0,
    dodgeCd: 0.8, dashT: 0, dashX: view.cx, enraged: false, invuln: 0,
    brk: 0, brkMax: Math.max(20, Math.round(ch.hp * (ch.breakPct || 0.09))), brkT: 0, brkCount: 0
  };
  buildBossTexture(true);
  state.loadLv = refreshLoadLevel();

  state.springs = [];
  if(ch.springs){
    var sy = arenaY(0.58);
    var padH = Math.min(96*view.s, view.arenaH*0.26);
    state.springs.push({x:view.left+7, y:sy, h:padH, side:1});
    state.springs.push({x:view.right-7, y:sy, h:padH, side:-1});
  }
  state.portals = [];
  if(ch.portal){
    /* 贴边摆放，让出中间的发射通道 */
    state.portals.push({x:view.left + view.w*0.13, y:arenaY(0.34), r:24*view.s, id:0, pair:0});
    state.portals.push({x:view.right - view.w*0.13, y:arenaY(0.80), r:24*view.s, id:1, pair:0});
  }
  state.bumpers = [
    {x:view.left + view.w*0.28, y:arenaY(0.64), r:20*view.s, rot:0},
    {x:view.right - view.w*0.28, y:arenaY(0.46), r:20*view.s, rot:0}
  ];
  state.dust = [];
  for(var d=0; d<26; d++){
    state.dust.push({x:rand(view.left,view.right), y:rand(view.top,view.bottom), r:rand(.6,2.2), vy:rand(-7,-2), vx:rand(-3,3), a:rand(.05,.2), ph:rand(0,TAU)});
  }

  document.body.classList.add('playing');
  hideIntro();
  flashStart();
  closeAllScreens();
  updateScore();
  updateMilkHUD();
  updateBossHUD();
  updateLevelHUD();
  updateHearts();
  updateBuffs();
  updateItemBar();
  updateBreakHUD();
  setWarn(false);
  showVS(ch);
  stopBgm();
  Sound.bgmIntensity(0);
  Sound.bgmStart();
  $id('bossAtk').classList.remove('hot');

  var eb = state.eff.extraBalls;
  for(var i=0;i<eb;i++){
    var bx = view.cx + rand(-view.w*0.24, view.w*0.24);
    var bb = makeBall(clamp(bx, view.left+40, view.right-40), view.bottom - 90*view.s, 1, rand(-160,160), rand(-620,-420));
    state.balls.push(bb);
  }
  state.startAt = performance.now();
  state.usedTime = 0;
}

