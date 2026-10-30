/* =========================================================
   14. HUD
   ========================================================= */
function updateBossHUD(){
  var b = state.boss;
  if(!b) return;
  $id('bossName').textContent = b.title;
  $id('bossHpText').textContent = Math.ceil(b.hp) + ' / ' + b.maxHp;
  $id('bossHpFill').style.width = Math.max(0, b.hp/b.maxHp*100) + '%';
}
function updateBreakHUD(){
  var b = state.boss;
  var fill = $id('brkFill'), pct = $id('brkPct'), lbl = $id('brkLabel'), row = fill && fill.closest('.brk-row');
  if(!fill || !pct || !lbl) return;
  if(!b){
    fill.style.width = '0%';
    pct.textContent = '0%';
    return;
  }
  if(b.brkT > 0){
    fill.style.width = '100%';
    if(row) row.classList.add('broken');
    lbl.textContent = '破防';
    pct.textContent = b.brkT.toFixed(1) + 's';
  } else {
    var p = clamp(b.brk / Math.max(1, b.brkMax), 0, 1);
    fill.style.width = (p*100) + '%';
    if(row) row.classList.remove('broken');
    lbl.textContent = '破防';
    pct.textContent = Math.round(p*100) + '%';
  }
}

function updateLevelHUD(){
  if(!state.chapter) return;
  $id('chapLabel').textContent = state.chapter.chap;
  $id('levelName').textContent = state.chapter.title;
  var tl = $id('timerLabel');
  tl.textContent = formatTime(state.timer);
  tl.classList.toggle('low', state.timer <= 15);
}
function updateHearts(hit){
  var el = $id('hearts');
  if(!el) return;
  var html = '';
  for(var i=0;i<state.maxHP;i++){
    var on = i < state.heroHP;
    var cls = on ? '' : 'off';
    if(hit && i === state.heroHP) cls += ' hit';
    html += '<i class="' + cls + '">♥</i>';
  }
  el.classList.toggle('many', state.maxHP > 7);
  el.innerHTML = html;
}
function updateHUD(){
  updateScore();
  updateMilkHUD();
  updateBossHUD();
  updateLevelHUD();
  updateBreakHUD();
  updateHearts();
  updateBuffs();
  updateItemBar();
}

var vsTimer = null;
function showVS(ch){
  var el = $id('vs');
  if(!el) return;
  $id('vsChap').textContent = ch.chap + ' · ' + ch.title;
  $id('vsBossName').textContent = ch.title;
  $id('vsTitle').textContent = ch.atkName;
  $id('vsBossImg').src = assetURL(ch.char, 'png');
  $id('vsHeroOrb').innerHTML = '<img src="' + assetURL('奶蛋', 'png') + '" alt="">';
  el.classList.add('show');
  clearTimeout(vsTimer);
  vsTimer = setTimeout(function(){ el.classList.remove('show'); }, 1500);
}

/* 结算音效：胜利笑声（#bgm）/ 失败音效（#loseSnd），两者都**循环播放**。
   变量名 bgmEl 沿用旧称，和程序化 BGM 无关。 */
var bgmEl = null, loseEl = null;
var sfxRetrying = { win: false, lose: false };
/* 音量：失败音已在文件里压过 −3dB 并削了高频，这里再低一档，避免刺耳 */
var SFX_VOL = { win: 0.72, lose: 0.62 };

function audioElFor(which){
  if(which === 'lose'){
    if(!loseEl) loseEl = $id('loseSnd');
    return loseEl;
  }
  if(!bgmEl) bgmEl = $id('bgm');
  return bgmEl;
}

function playSfxLoop(which){
  var el = audioElFor(which);
  if(!el || !state.soundOn) return;
  el.pause();
  try{ el.currentTime = 0; }catch(e){}
  el.loop = true;
  el.muted = false;
  el.volume = SFX_VOL[which] || 0.7;
  playSfxNow(which);
}

function playSfxNow(which){
  var el = audioElFor(which);
  if(!el || !state.soundOn) return;
  var p = el.play();
  if(p && p.catch){
    p.catch(function(){
      /* 被自动播放策略拦下时，等玩家下一次操作再补播，别让结算静音 */
      if(sfxRetrying[which]) return;
      sfxRetrying[which] = true;
      var retry = function(){
        sfxRetrying[which] = false;
        window.removeEventListener('pointerdown', retry, true);
        window.removeEventListener('keydown', retry, true);
        if(state.mode === (which === 'lose' ? 'lose' : 'victory')) playSfxNow(which);
      };
      window.addEventListener('pointerdown', retry, true);
      window.addEventListener('keydown', retry, true);
    });
  }
}

function playVictoryAudio(){ playSfxLoop('win'); }
function playLoseAudio(){ playSfxLoop('lose'); }

function stopBgm(){
  var which = ['win', 'lose'];
  for(var i=0;i<which.length;i++){
    var el = audioElFor(which[i]);
    if(!el) continue;
    el.pause();
    try{ el.currentTime = 0; }catch(e){}
  }
}

