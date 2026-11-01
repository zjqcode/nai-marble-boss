/* =========================================================
   13. 结算
   =========================================================
   结算只允许经过 settleLevel()：
     - 它是唯一设置 state.mode = 'victory' / 'lose' 的地方
     - 清场（telegraph / suck / beam / 连段）与结算音效都在这里统一做
   这样新增任何结束方式（新 Boss 机制、平局、复活失败…）都不会漏播音效、
   也不会漏清状态。之前 failLevel / heroDown 各写一份，就漏过一次音效。
   ========================================================= */
var SETTLE_MODE = { win: 'victory', lose: 'lose' };

function settleLevel(kind){
  if(state.mode !== 'play') return false;      /* 已经结算过，幂等 */
  var mode = SETTLE_MODE[kind];
  if(!mode) return false;
  state.mode = mode;
  state.telegraph = null;
  state.suck = null;
  state.beam = null;
  state.comboQ = 0;
  setWarn(false);
  Sound.bgmStop();
  /* 结算音效只在这里触发一次，任何结束路径都自动带上 */
  if(kind === 'win') playVictoryAudio();
  else playLoseAudio();
  return true;
}

/* 失败面板共用的结果字段，两条失败路径只在差异字段上有区别 */
function loseResult(extra){
  var boss = state.boss;
  var base = {
    chapter: state.chapter,
    milk: 0,
    score: state.score,
    time: Math.max(0, state.timeMax - state.timer),
    hpLeft: boss ? boss.hp : 0,
    hpPct: boss ? Math.round(boss.hp/boss.maxHp*100) : 100
  };
  if(extra) for(var k in extra) if(extra.hasOwnProperty(k)) base[k] = extra[k];
  return base;
}

function bossDie(){
  var boss = state.boss;
  if(!boss || boss.dead) return;
  /* 无尽模式：打完直接进下一波，不弹结算面板 */
  if(state.endless){ endlessWaveClear(boss); return; }
  boss.dead = true;
  if(!settleLevel('win')) return;
  $id('bossAtk').classList.remove('hot');
  $id('bossAtk').textContent = '击破！';
  state.flashHue = 'gold';
  state.flash = 1;
  state.slowmo = Math.max(state.slowmo, 0.6);
  state.shake = Math.max(state.shake, 26);
  cssShake('m');
  setTimeout(function(){ Sound.win(); }, 700);
  ring(boss.x, boss.y, boss.r*0.3, boss.r*4.2, '255,235,170', .9, 6);
  ring(boss.x, boss.y, boss.r*0.3, boss.r*2.6, '255,150,120', .7, 4);
  burst(boss.x, boss.y, boss.r, 60, 12, '#ffe9b0');
  addBolt(boss.x, view.top, boss.x, boss.y);
  addBolt(boss.x-80, view.top, boss.x, boss.y);
  addBolt(boss.x+80, view.top, boss.x, boss.y);

  var ch = state.chapter;
  var bonus = Math.round((25 + ch.id*5) * state.eff.milk);
  addMilk(bonus);
  var unlocked = null;
  if(!isUnlocked(ch.char)){
    META.unlocked[ch.char] = 1;
    if(!META.lv[ch.char]) META.lv[ch.char] = 1;
    unlocked = ch.char;
  }
  if(META.progress < ch.id) META.progress = ch.id;
  META.best = Math.max(META.best, state.score);
  saveMeta();
  state.result = {
    chapter: ch,
    milk: bonus,
    score: state.score,
    time: Math.max(1, state.timeMax - state.timer),
    unlock: unlocked,
    hpLeft: boss.hp
  };
  setTimeout(function(){ if(state.mode === 'victory'){ showWin(); state.settlePanelShown = true; } }, 1450);
}

/* 失败：时间耗尽（另一种是 10-boss.js 的 heroDown：血量归零） */
function failLevel(){
  if(!settleLevel('lose')) return;
  Sound.lose();
  state.shake = Math.max(state.shake, 10);
  state.result = loseResult({ reason: 'time' });
  saveMeta();
  setTimeout(function(){ if(state.mode === 'lose'){ showLose(); state.settlePanelShown = true; } }, 700);
}

