/* =========================================================
   13. 结算
   ========================================================= */
function bossDie(){
  var boss = state.boss;
  if(!boss || boss.dead) return;
  boss.dead = true;
  state.mode = 'victory';
  state.telegraph = null;
  state.suck = null;
  state.beam = null;
  setWarn(false);
  $id('bossAtk').classList.remove('hot');
  $id('bossAtk').textContent = '击破！';
  state.comboQ = 0;
  state.flashHue = 'gold';
  state.flash = 1;
  state.slowmo = Math.max(state.slowmo, 0.6);
  state.shake = Math.max(state.shake, 26);
  cssShake('m');
  Sound.bgmStop();
  playVictoryAudio();
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
  setTimeout(function(){ if(state.mode === 'victory') showWin(); }, 1450);
}

function failLevel(){
  if(state.mode !== 'play') return;
  state.mode = 'lose';
  state.telegraph = null;
  state.suck = null;
  state.beam = null;
  state.comboQ = 0;
  setWarn(false);
  Sound.bgmStop();
  playLoseAudio();
  Sound.lose();
  state.shake = Math.max(state.shake, 10);
  state.result = {
    chapter: state.chapter,
    milk: 0,
    score: state.score,
    time: state.timeMax,
    hpLeft: state.boss ? state.boss.hp : 0,
    hpPct: state.boss ? Math.round(state.boss.hp/state.boss.maxHp*100) : 100,
    reason: 'time'
  };
  saveMeta();
  setTimeout(function(){ if(state.mode === 'lose') showLose(); }, 700);
}

