/* =========================================================
   19. 通用 UI
   ========================================================= */
function toast(msg){
  var el = $id('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(function(){ el.classList.remove('show'); }, 1800);
}

/* ---------- 横屏 ----------
   不少手机浏览器/WebView 不会因为"页面想要横屏"就自动转，得主动请求：
   1) 先全屏（Android Chrome 只有全屏状态下才允许锁方向）
   2) 再 screen.orientation.lock('landscape')
   iOS Safari 没有 lock API，但系统本身跟随旋转，所以失败也不影响。
   全部静默失败，绝不因为锁不上就卡住玩家。 */
function isPortraitNow(){ return window.innerHeight > window.innerWidth; }

function lockLandscape(){
  var so = screen.orientation;
  if(!so || !so.lock) return Promise.resolve(false);
  try{
    return so.lock('landscape').then(function(){ return true; }, function(){ return false; });
  }catch(e){ return Promise.resolve(false); }
}

/* 返回 Promise<boolean>：true 表示尝试完仍是竖屏（需要提示用户手动旋转） */
function enterLandscape(){
  var el = document.documentElement;
  var fsFn = el.requestFullscreen || el.webkitRequestFullscreen;
  var inFull = document.fullscreenElement || document.webkitFullscreenElement;
  var step;
  if(!inFull && fsFn){
    try{ step = Promise.resolve(fsFn.call(el)); }
    catch(e){ step = Promise.resolve(); }
  } else {
    step = Promise.resolve();
  }
  return step.then(function(){ return lockLandscape(); }, function(){ return false; })
    .then(function(){ return isPortraitNow(); });
}

/* ---------- 暂停 ----------
   暂停走的是现成的 screen 机制（openScreen 会把 state.paused 置 true，
   update() 因此整帧跳过：计时、Boss、物理、冷却全部冻结）。
   切换逻辑集中在这里，按钮和快捷键都调它，避免两处写法不一致。 */
function togglePause(){
  if(state.mode !== 'play') return false;
  var open = document.querySelector('.screen.show');
  if(open){ closeScreen(open.id); return true; }
  /* 暂停时把进行中的瞄准/放置取消掉，回来不会留着一半的状态 */
  state.aim.active = false;
  state.aim.power = 0;
  if(typeof cancelPlatePlacement === 'function') cancelPlatePlacement(true);
  openScreen('pause');
  Sound.ui();
  return true;
}

function hideIntro(){
  var el = $id('intro');
  if(!el || el.classList.contains('hide')) return;
  el.classList.add('hide');
  document.body.classList.add('playing');
  setTimeout(function(){ el.style.display = 'none'; }, 800);
}

function updateStartLabel(){
  var b = $id('bStart');
  if(!b) return;
  var label = '开 始 讨 伐';
  if(META.progress >= CHAPTERS.length) label = '再 战 最 终 章';
  else if(META.progress > 0) label = '继 续 第 ' + (META.progress + 1) + ' 章';
  b.querySelector('span').textContent = label;
}

function toggleSound(){
  Sound.init();
  Sound.resume();
  state.soundOn = !state.soundOn;
  Sound.setOn(state.soundOn);
  store('nai_boss_sound', state.soundOn ? '1' : '0');
  updateSoundButton();
  if(state.soundOn){
    Sound.ui();
    if(state.mode === 'play') Sound.bgmStart();
    /* 结算界面重新开音效时，把对应的循环音效接上 */
    else if(state.mode === 'victory') playVictoryAudio();
    else if(state.mode === 'lose') playLoseAudio();
  } else {
    stopBgm();
  }
}
function updateSoundButton(){
  var btns = document.querySelectorAll('.snd-btn');
  for(var i=0;i<btns.length;i++){
    var btn = btns[i];
    btn.classList.toggle('on', state.soundOn);
    btn.setAttribute('aria-pressed', String(state.soundOn));
    var onIco = btn.querySelector('.ico-on');
    var offIco = btn.querySelector('.ico-off');
    if(onIco) onIco.style.display = state.soundOn ? '' : 'none';
    if(offIco) offIco.style.display = state.soundOn ? 'none' : '';
    var tx = btn.querySelector('.tx');
    if(tx) tx.textContent = state.soundOn ? '音效' : '静音';
  }
}

function buildIntroOrbs(){
  var names = ['奶蛙','奶蛋','小奶蛙','奶猫','奶狗'];
  var html = '';
  for(var i=0;i<names.length;i++){
    html += '<div class="orb" style="animation-delay:' + (i*0.22) + 's"><img src="' + assetURL(names[i]) + '" alt=""></div>';
  }
  $id('orbRow').innerHTML = html;
}

