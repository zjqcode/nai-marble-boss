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

/* 胜利音效（笑声）。素材是纯音频 mp3，内联为 data URI。
   bgmEl 这个变量名沿用旧称，实际只用于胜利音效，和程序化 BGM 无关。 */
var bgmEl = null, victoryRetryBound = false;

function playVictoryAudio(){
  if(!bgmEl) bgmEl = $id('bgm');
  if(!bgmEl || !state.soundOn) return;
  bgmEl.pause();
  try{ bgmEl.currentTime = 0; }catch(e){}
  bgmEl.loop = false;
  bgmEl.muted = false;
  bgmEl.volume = 0.72;
  playVictoryAudioNow();
}

function playVictoryAudioNow(){
  if(!bgmEl || !state.soundOn) return;
  var p = bgmEl.play();
  if(p && p.catch){
    p.catch(function(){
      /* 被浏览器自动播放策略拦下时，等玩家下一次操作再补播，别让胜利静音 */
      if(victoryRetryBound) return;
      victoryRetryBound = true;
      var retry = function(){
        victoryRetryBound = false;
        window.removeEventListener('pointerdown', retry, true);
        window.removeEventListener('keydown', retry, true);
        if(state.mode === 'victory') playVictoryAudioNow();
      };
      window.addEventListener('pointerdown', retry, true);
      window.addEventListener('keydown', retry, true);
    });
  }
}

function stopBgm(){
  if(!bgmEl) bgmEl = $id('bgm');
  if(!bgmEl) return;
  bgmEl.pause();
  try{ bgmEl.currentTime = 0; }catch(e){}
}

