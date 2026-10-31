/* =========================================================
   18. 结算面板
   ========================================================= */
function showWin(){
  var res = state.result;
  if(!res) return;
  var ch = res.chapter;
  $id('winTitle').textContent = ch.title + ' 击破！';
  $id('winMilk').textContent = '+' + res.milk;
  $id('winScore').textContent = fmt(res.score);
  $id('winTime').textContent = formatTime(res.time);

  var box = $id('unlockBox');
  var winEl = $id('win');
  if(res.unlock){
    var c = charByName(res.unlock);
    box.classList.remove('hide');
    /* 有解锁展示时左栏才有内容，横屏才能用两栏 */
    if(winEl) winEl.classList.remove('no-unlock');
    $id('unlockOrb').innerHTML = '<img src="' + assetURL(c.n) + '" alt="">';
    $id('unlockName').textContent = '【' + c.n + '】';
    $id('unlockSkill').textContent = c.sname + ' ' + skillText(c, 1) + ' · 已加入图鉴';
    setTimeout(function(){ Sound.upgrade(); }, 350);
  } else {
    box.classList.add('hide');
    /* 没有解锁展示：左栏会空掉大半，改成单栏居中 */
    if(winEl) winEl.classList.add('no-unlock');
    $id('winTitle').textContent = ch.title + ' 再次击破！';
  }

  var next = ch.id + 1;
  var btn = $id('bNext');
  if(next <= CHAPTERS.length){
    btn.querySelector('span').textContent = '进入第 ' + (next) + ' 章';
    btn.style.display = '';
  } else {
    btn.querySelector('span').textContent = '再战最终章';
    btn.style.display = '';
  }
  updateStartLabel();
  openScreen('win');
  updateMilkHUD();
  saveMeta();
}

function showLose(){
  var res = state.result;
  if(!res) return;
  $id('loseHp').textContent = (res.hpPct !== undefined ? res.hpPct : 100) + '%';
  $id('loseScore').textContent = fmt(res.score);
  if(res.reason === 'hero'){
    $id('loseTitle').textContent = '勇者倒下了…';
    $id('loseSub').textContent = '被「' + (res.attack || 'Boss 反击') + '」击倒 · 在蓄力时打中它能打断攻击';
  } else {
    $id('loseTitle').textContent = '时间耗尽，Boss 还在暴走…';
    $id('loseSub').textContent = 'Boss 还剩 ' + (res.hpLeft ? Math.ceil(res.hpLeft) : 0) + ' 点血 · 反弹越多，暴击越狠';
  }
  openScreen('lose');
}

