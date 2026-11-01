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

/* CDN 兜底：任意 <img> 加载失败且指向主节点时，换镜像节点重试一次。
   放在捕获阶段，能收到不冒泡的 img error 事件。 */
document.addEventListener('error', function(e){
  var el = e.target;
  if(!el || el.tagName !== 'IMG' || el.__alt) return;
  var src = el.getAttribute('src') || '';
  if(src.indexOf('cdn.jsdelivr.net') < 0) return;
  el.__alt = true;
  el.setAttribute('src', src.replace('cdn.jsdelivr.net', 'gcore.jsdelivr.net'));
}, true);

/* 首页「全屏」按钮跟随静音按钮：`.intro-snd` 在多个媒体查询里换了 right/top/尺寸，
   与其到处复制断点，不如量一次它的位置，把全屏按钮摆到它左边。 */
var FS_HINT_KEY = 'nai_fs_hint_seen';
function fsHintSeen(){
  try { return localStorage.getItem(FS_HINT_KEY) === '1'; } catch(e) { return false; }
}
function markFsHintSeen(){
  try { localStorage.setItem(FS_HINT_KEY, '1'); } catch(e) {}
}
function hideFsHint(remember){
  if(remember) markFsHintSeen();
  var el = $id('fsHint');
  if(el){
    el.classList.remove('show');
    el.classList.remove('pulse');
    el.classList.add('hide');
  }
  var btn = $id('bIntroFull');
  if(btn) btn.classList.remove('hint-on');
  var spot = $id('fsSpot');
  if(spot) spot.classList.remove('show');
}
/* 没进过全屏、且确实支持全屏时，才提示一次 */
function maybeShowFsHint(){
  var el = $id('fsHint'), btn = $id('bIntroFull');
  if(!el || !btn) return;
  /* 不再用永久标记拦：只要当前不在全屏，每次进首页都提示一次（8 秒自动收），
     避免玩家第一次没注意、之后就永远看不到入口。 */
  if(document.fullscreenElement || document.webkitFullscreenElement) return;
  var can = document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen;
  if(!can) return;
  el.classList.remove('hide');
  el.classList.add('show');
  el.classList.add('pulse');
  var spot = $id('fsSpot');
  if(spot) spot.classList.add('show');
  btn.classList.add('hint-on');
  /* 8 秒后自动收，别一直挡着 */
  setTimeout(function(){ hideFsHint(false); }, 8000);
}

function syncIntroTools(){
  var fs = $id('bIntroFull'), snd = $id('bIntroSound');
  if(!fs || !snd) return;
  var par = fs.offsetParent;
  if(!par) return;
  var w = snd.offsetWidth, h = snd.offsetHeight;
  if(!w || !h) return;
  fs.style.width = w + 'px';
  fs.style.height = h + 'px';
  fs.style.top = snd.offsetTop + 'px';
  fs.style.right = (par.clientWidth - snd.offsetLeft + 10) + 'px';
  var spot = $id('fsSpot');
  if(spot){
    /* 渐变圆心的坐标 = 全屏按钮中心（相对 #intro） */
    var bx = snd.offsetLeft - 10 - w + w / 2;
    var by = snd.offsetTop + h / 2;
    spot.style.setProperty('--sx', Math.round(bx) + 'px');
    spot.style.setProperty('--sy', Math.round(by) + 'px');
    spot.style.setProperty('--sr', Math.round(w / 2 + 9) + 'px');
  }
  var hint = $id('fsHint');
  if(hint){
    hint.style.top = (snd.offsetTop + h + 10) + 'px';
    hint.style.right = (par.clientWidth - (snd.offsetLeft + 10 - h) - w) + 'px';
  }
}

/* 回主页面：清掉本关运行时状态，把首页重新显示出来（不保存这一局的进度） */
function goHome(){
  closeAllScreens();
  Sound.ui();
  /* 停掉结算音轨（BGM 是程序化生成的，跟着游戏状态停） */
  var plays = ['bgm', 'loseSnd'];
  for(var i=0;i<plays.length;i++){
    var el = $id(plays[i]);
    if(el){ try{ el.pause(); el.currentTime = 0; }catch(e){} }
  }
  /* 清场：球/岩石/粒子/弹道全部收掉，回到干净状态 */
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
  state.aim.active = false;
  state.aim.power = 0;
  state.mode = 'intro';
  state.paused = false;
  state.stunT = 0;
  state.invulnT = 0;
  document.body.classList.remove('playing');
  document.body.classList.remove('stunned');
  var el = $id('intro');
  if(el){ el.classList.remove('hide'); el.style.display = ''; }
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
  var portrait = $id('heroPortrait');
  if(portrait) portrait.innerHTML = '<img class="hero-main" src="' + assetURL('奶蛋') + '" alt=""><div class="hero-friend friend-a"><img src="' + assetURL('小奶蛙') + '" alt=""></div><div class="hero-friend friend-b"><img src="' + assetURL('奶猫') + '" alt=""></div>';

}


/* Presentation only: disclosure dismissal, modal focus, reduced-motion preference.
   No game state, save data, input curve or gameplay timing is changed here. */
(function(){
  var menu = $id('utilityMenu');
  if(menu){
    menu.addEventListener('click', function(e){
      if(e.target.closest('button')) menu.open = false;
    });
    document.addEventListener('pointerdown', function(e){
      if(menu.open && !menu.contains(e.target)) menu.open = false;
    });
  }
  var returnFocus = null;
  var currentPanel = null;
  var observer = new MutationObserver(function(){
    var panel = document.querySelector('.screen.show');
    document.body.classList.toggle('panel-open', !!panel);
    if(panel === currentPanel) return;
    if(panel){
      if(!currentPanel) returnFocus = menu && menu.contains(document.activeElement) ? menu.querySelector('summary') : document.activeElement;
      if(menu) menu.open = false;
      var focus = panel.querySelector('[data-close], .start-btn, button');
      if(focus) focus.focus({preventScroll:true});
    } else if(returnFocus && returnFocus.isConnected){
      returnFocus.focus({preventScroll:true});
      returnFocus = null;
    }
    currentPanel = panel;
  });
  document.querySelectorAll('.screen').forEach(function(el){
    observer.observe(el, {attributes:true, attributeFilter:['class']});
  });
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && menu && menu.open){ menu.open = false; e.stopPropagation(); return; }
    if(e.key !== 'Tab') return;
    var panel = document.querySelector('.screen.show');
    if(!panel) return;
    var all = Array.from(panel.querySelectorAll('button, [tabindex="0"]')).filter(function(el){
      return !el.disabled && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
    });
    if(!all.length) return;
    var first = all[0], last = all[all.length-1];
    if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  });
})();
