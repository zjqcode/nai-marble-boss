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

/* 造一个 Boss 实例（普通关和无限波次共用） */
function buildBoss(ch){
  return {
    char: ch.char, title: ch.title, chap: ch.chap,
    hp: ch.hp, maxHp: ch.hp,
    x: view.cx, y: view.bossY, baseY: view.bossY,
    r: Math.round(view.bossH*0.34), w: Math.round(view.bossH*0.62), h: view.bossH,
    flash: 0, hitScale: 1, entrance: 0, dead: false,
    movePhase: rand(0,TAU), charge: 0, dir: 1, hopT: 0,
    dodgeCd: 0.8, dashT: 0, dashX: view.cx, enraged: false, invuln: 0,
    brk: 0, brkMax: Math.max(20, Math.round(ch.hp * (ch.breakPct || 0.09))), brkT: 0, brkCount: 0
  };
}


/* =========================================================
   无尽模式（8 波 = 8 个 Boss）
   - 第 N 波固定是第 N 章的 Boss，打完自动进下一波
   - 难度在章节本身之上再叠一层：血量 ×1.12/波、攻击间隔 ×0.97/波
   - 打完全部 8 波 = 通关；中途倒下也记录最高波次
   - 全程禁用道具
   ========================================================= */
var ENDLESS_WAVES = 8;

function endlessChapter(w){
  return CHAPTERS[clamp(w - 1, 0, CHAPTERS.length - 1)];
}

/* 8 波血量表：以每章基础血量为底，再叠逐波增幅，并强制比上一波高 12% 以上 */
var ENDLESS_HP = (function(){
  var arr = [], prev = 0;
  for(var w = 1; w <= 8; w++){
    var ch = CHAPTERS[Math.min(w - 1, CHAPTERS.length - 1)];
    var hp = ch.hp * (1 + 0.20 * (w - 1));
    if(w > 1) hp = Math.max(hp, prev * 1.12);
    prev = hp;
    arr.push(Math.round(hp));
  }
  return arr;
})();

/* 攻击间隔表：也要强制单调递减，否则某章基础间隔较慢时，
   后面一波反而比前面好打（第 3 章调慢后就出现过这个问题）。 */
var ENDLESS_EVERY = (function(){
  var arr = [], prev = 0;
  for(var w = 1; w <= 8; w++){
    var ch = CHAPTERS[Math.min(w - 1, CHAPTERS.length - 1)];
    var e = ch.every * Math.pow(0.97, w - 1);
    if(w > 1) e = Math.min(e, prev * 0.97);
    prev = e;
    arr.push(Math.max(2.0, Math.round(e * 100) / 100));
  }
  return arr;
})();

function endlessWaveCfg(w){
  var ch = endlessChapter(w);
  return {
    hp: ENDLESS_HP[Math.min(w - 1, ENDLESS_HP.length - 1)],
    every: ENDLESS_EVERY[Math.min(w - 1, ENDLESS_EVERY.length - 1)],
    dmg: Math.min(4, [1,1,1,2,2,2,2,3][ch.id - 1] + Math.floor((w - 1) / 4)),
    time: Math.max(50, Math.round(ch.time * Math.pow(0.98, w - 1)))
  };
}

function applyEndlessWave(){
  var w = state.wave;
  var ch = endlessChapter(w);
  var cfg = endlessWaveCfg(w);

  /* 这一波是哪个 Boss，HUD / 立绘都跟着换 */
  state.chapter = ch;
  state.chapterIndex = clamp(w - 1, 0, CHAPTERS.length - 1);

  var b = state.boss;
  if(b){
    b.char = ch.char; b.title = ch.title; b.chap = ch.chap;
    b.maxHp = cfg.hp; b.hp = cfg.hp;
    b.brkMax = Math.max(20, Math.round(cfg.hp * 0.09));
    b.brk = 0; b.brkT = 0;
    b.dead = false; b.enraged = false; b.invuln = 0;
  }
  state.atkEvery = cfg.every * state.eff.attackDelay;
  state.atkBase = state.atkEvery;
  state.atkTimer = state.atkEvery;
  state.atkDmg = cfg.dmg;
  state.rageLv = 0;
  state.timer = cfg.time;
  state.timeMax = cfg.time;

  var label = $id('chapLabel');
  if(label) label.textContent = '无尽 ' + w + '/' + ENDLESS_WAVES;
  /* 换 Boss 后必须刷新血条/名字，否则会一直显示上一个 Boss 的数据 */
  if(typeof updateBossHUD === 'function') updateBossHUD();
  var name = $id('levelName');
  if(name) name.textContent = ch.title;
  updateLevelHUD && updateLevelHUD();
}

function startEndless(){
  startLevel(0);
  state.endless = true;
  state.wave = 1;
  state.endlessCleared = false;
  document.body.classList.add('endless');
  document.body.classList.remove('endless-clear');
  /* 无尽模式不弹新手教程（想学操作请走「新手演习」） */
  if(typeof tutStop === 'function') tutStop(false);
  applyEndlessWave();
  updateItemBar();
  toast('无尽模式 · 共 ' + ENDLESS_WAVES + ' 波，不能使用道具');
}

/* 一波打完 */
function endlessWaveClear(boss){
  boss.dead = true;
  state.flashHue = 'gold';
  state.flash = 1;
  state.slowmo = Math.max(state.slowmo, 0.55);
  state.shake = Math.max(state.shake, 22);
  cssShake('m');
  Sound.win();
  ring(boss.x, boss.y, boss.r*0.3, boss.r*4.0, '255,235,170', .9, 6);
  burst(boss.x, boss.y, boss.r, 48, 11, '#ffe9b0');
  state.score += 400 + state.wave*250;
  state.runMilk += 8 + state.wave*3;
  state.telegraph = null;
  state.atkAnim = null;

  var cleared = state.wave;

  /* 8 波全清：走胜利结算（无尽通关） */
  if(cleared >= ENDLESS_WAVES){
    state.endlessCleared = true;
    state.score += 3000;
    state.runMilk += 80;
    settleLevel('win');
    setTimeout(function(){
      if(state.mode !== 'victory') return;
      document.body.classList.add('endless-clear');
      var t = $id('winTitle');
      if(t) t.textContent = '无尽通关 · ' + ENDLESS_WAVES + ' 波全清！';
      var kicker = document.querySelector('#win .result-kicker');
      if(kicker) kicker.innerHTML = '<span aria-hidden="true">✦</span> ENDLESS CLEARED <span aria-hidden="true">✦</span>';
      META.bestEndless = Math.max(META.bestEndless || 0, ENDLESS_WAVES);
      saveMeta();
    }, 220);
    return;
  }

  state.wave++;
  var nextName = endlessChapter(state.wave).title;
  toast('第 ' + cleared + ' 波击破！下一波：' + nextName);
  setTimeout(function(){
    if(!state.endless || state.mode !== 'play') return;
    state.boss = buildBoss(endlessChapter(state.wave));
    buildBossTexture(true);
    applyEndlessWave();
    state.cineT = Math.max(state.cineT, 0.8);
  }, 950);
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
  state.endless = false;
  state.wave = 1;
  if(document.body) document.body.classList.remove('endless');
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
  state.boss = buildBoss(ch);
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

