/* =========================================================
   20. 交互 / 启动
   ========================================================= */
function startCampaign(){
  var idx = Math.min(CHAPTERS.length-1, META.progress);
  startLevel(idx);
}

function bindEvents(){
  var c = cvs;

  c.addEventListener('pointerdown', function(e){
    Sound.init(); Sound.resume();
    if(state.mode !== 'play' || state.paused) return;
    if(state.reloadT > 0.02) return;
    var hudEl = $id('hud');
    if(hudEl && e.clientY <= hudEl.getBoundingClientRect().bottom + 2) return;
    try{ c.setPointerCapture(e.pointerId); }catch(err){}
    var a = state.aim;
    a.active = true;
    a.sx = e.clientX;
    a.sy = e.clientY;
    a.px = e.clientX;
    a.py = e.clientY;
    a.pull = 0;
    a.power = 0;
    a.moved = false;
    a.downAt = Date.now();
    updateAimVectors();
    e.preventDefault();
  });

  c.addEventListener('pointermove', function(e){
    if(!state.aim.active) return;
    state.aim.px = e.clientX;
    state.aim.py = e.clientY;
    if(Math.hypot(e.clientX - state.aim.sx, e.clientY - state.aim.sy) > 8) state.aim.moved = true;
    updateAimVectors();
    e.preventDefault();
  });

  function endAim(e){
    var a = state.aim;
    if(!a.active) return;
    updateAimVectors();
    if(a.power >= 0.1){
      fireBall();
    } else if(!a.moved && Date.now() - a.downAt < 320){
      var mp = Math.min(168, view.w*0.44);
      a.dx = 0; a.dy = -1; a.power = 0.62; a.pull = mp*0.62;
      fireBall();
    } else {
      a.active = false;
      a.power = 0;
    }
    if(e) e.preventDefault();
  }
  c.addEventListener('pointerup', endAim);
  c.addEventListener('pointercancel', function(e){
    state.aim.active = false;
    state.aim.power = 0;
  });

  $id('bStart').addEventListener('click', function(){
    Sound.init(); Sound.resume(); Sound.ui();
    startCampaign();
  });
  $id('bIntroLevels').addEventListener('click', openLevels);
  $id('bIntroGallery').addEventListener('click', showGallery);
  $id('bIntroShop').addEventListener('click', function(){
    Sound.init(); Sound.resume(); Sound.ui();
    openShop();
  });
  $id('bIntroSound').addEventListener('click', toggleSound);
  $id('bSound').addEventListener('click', toggleSound);

  $id('bRestart').addEventListener('click', function(){
    Sound.init(); Sound.resume(); Sound.ui();
    if(state.mode === 'intro'){ startCampaign(); return; }
    closeAllScreens();
    startLevel(state.chapterIndex);
  });
  $id('bLevels').addEventListener('click', openLevels);
  $id('bGallery').addEventListener('click', showGallery);
  $id('bShop').addEventListener('click', function(){ Sound.ui(); openShop(); });
  $id('itemBar').addEventListener('click', function(e){
    var btn = e.target.closest('[data-item]');
    if(!btn) return;
    useItem(btn.getAttribute('data-item'));
  });

  /* 炮台移动按钮：按住持续移动。按钮在 canvas 之上，不会触发瞄准 */
  function bindMove(id, dir){
    var btn = $id(id);
    if(!btn) return;
    var hold = function(e){
      Sound.init(); Sound.resume();
      state.moveDir = dir;
      btn.classList.add('held');
      e.preventDefault();
    };
    var rel = function(e){
      if(state.moveDir === dir) state.moveDir = 0;
      btn.classList.remove('held');
      if(e) e.preventDefault();
    };
    btn.addEventListener('pointerdown', hold);
    btn.addEventListener('pointerup', rel);
    btn.addEventListener('pointercancel', rel);
    btn.addEventListener('pointerleave', rel);
    btn.addEventListener('contextmenu', function(e){ e.preventDefault(); });
  }
  bindMove('bMoveL', -1);
  bindMove('bMoveR', 1);

  $id('bFull').addEventListener('click', function(){
    Sound.ui();
    var el = document.documentElement;
    var fs = document.fullscreenElement || document.webkitFullscreenElement;
    try{
      if(!fs){
        var fn = el.requestFullscreen || el.webkitRequestFullscreen;
        if(!fn){ toast('当前浏览器不支持全屏'); return; }
        fn.call(el);
      } else {
        var ex = document.exitFullscreen || document.webkitExitFullscreen;
        if(ex) ex.call(document);
      }
    }catch(e){ toast('全屏切换失败'); }
  });

  $id('bNext').addEventListener('click', function(){
    Sound.ui();
    var res = state.result;
    if(!res){ closeAllScreens(); startLevel(0); return; }
    var nextIdx = res.chapter.id;
    closeAllScreens();
    if(nextIdx < CHAPTERS.length) startLevel(nextIdx);
    else startLevel(CHAPTERS.length-1);
  });
  $id('bWinLevels').addEventListener('click', openLevels);
  $id('bLoseLevels').addEventListener('click', openLevels);
  $id('bRetry').addEventListener('click', function(){
    Sound.ui();
    closeAllScreens();
    startLevel(state.chapterIndex);
  });

  $id('shopList').addEventListener('click', function(e){
    var btn = e.target.closest('[data-buy]');
    if(!btn) return;
    var key = btn.getAttribute('data-buy');
    var it = shopItem(key);
    if(!it) return;
    if(META.milk < it.cost){ toast('奶瓶不够，还差 ' + (it.cost - META.milk)); return; }
    META.milk -= it.cost;
    META.items[key] = itemCount(key) + 1;
    saveMeta();
    Sound.upgrade();
    buildShop();
    updateItemBar();
    updateMilkHUD();
    toast('已购买：' + it.n + ' ×' + META.items[key] + '，局内点击左下角使用');
  });

  $id('charGrid').addEventListener('click', function(e){
    var card = e.target.closest('[data-char]');
    if(!card) return;
    var name = card.getAttribute('data-char');
    if(!isUnlocked(name)){
      var ch = chapterOfChar(name);
      toast('击败「' + (ch ? ch.chap + ' · ' + ch.title : 'BOSS') + '」解锁');
      return;
    }
    selectedChar = name;
    Sound.ui();
    buildGallery();
  });
  $id('charDetail').addEventListener('click', function(e){
    if(e.target.closest('#bUpgrade')) upgradeSelected();
  });

  $id('levelList').addEventListener('click', function(e){
    var btn = e.target.closest('[data-lv]');
    if(!btn) return;
    var idx = parseInt(btn.getAttribute('data-lv'), 10);
    if(isNaN(idx)) return;
    Sound.ui();
    closeAllScreens();
    startLevel(idx);
  });

  var closers = document.querySelectorAll('[data-close]');
  for(var i=0;i<closers.length;i++){
    closers[i].addEventListener('click', function(){
      Sound.ui();
      var sc = this.closest('.screen');
      if(sc) closeScreen(sc.id);
    });
  }
  var screens = document.querySelectorAll('.screen');
  for(i=0;i<screens.length;i++){
    screens[i].addEventListener('click', function(e){
      if(e.target === this) closeScreen(this.id);
    });
  }

  $id('bRotateOk').addEventListener('click', function(){
    document.body.classList.add('landscape-ok');
    Sound.ui();
    setTimeout(layout, 60);
  });

  window.addEventListener('keydown', function(e){
    if(e.repeat) return;
    var k = e.key.toLowerCase();
    var modal = document.querySelector('.screen.show');
    if(modal){
      if(k === 'escape') closeScreen(modal.id);
      return;
    }
    if(k === ' ' || k === 'enter'){
      e.preventDefault();
      if(state.mode === 'intro') startCampaign();
      else if(state.mode === 'play' && !state.paused && state.reloadT <= 0.02){
        state.aim.active = true;
        state.aim.dx = 0; state.aim.dy = -1; state.aim.power = 1;
        fireBall();
      }
    } else if(k === 'arrowleft' || k === 'a'){
      e.preventDefault();
      state.moveDir = -1;
    } else if(k === 'arrowright' || k === 'd'){
      e.preventDefault();
      state.moveDir = 1;
    } else if(k === 'r'){
      $id('bRestart').click();
    } else if(k === 'g'){
      openScreen('gallery'); buildGallery();
    } else if(k === 'l'){
      openLevels();
    } else if(k === 'escape'){
      closeAllScreens();
    }
  });

  window.addEventListener('keyup', function(e){
    var k = e.key.toLowerCase();
    if((k === 'arrowleft' || k === 'a') && state.moveDir < 0) state.moveDir = 0;
    if((k === 'arrowright' || k === 'd') && state.moveDir > 0) state.moveDir = 0;
  });
  window.addEventListener('blur', function(){ state.moveDir = 0; });

  window.addEventListener('resize', function(){ layout(); });
  window.addEventListener('orientationchange', function(){
    setTimeout(layout, 250);
  });
  document.addEventListener('visibilitychange', function(){
    if(document.hidden) saveMeta();
  });
  window.addEventListener('beforeunload', saveMeta);
}

function boot(){
  loadMeta();
  state.soundOn = store('nai_boss_sound') !== '0';
  state.eff = buildEff();
  loadImages();
  buildIntroOrbs();
  layout();
  bindEvents();
  updateStartLabel();
  updateSoundButton();
  updateMilkHUD();
  updateScore();
  updateHearts();
  updateBuffs();
  updateItemBar();
  buildGallery();

  bgmEl = $id('bgm');
  if(bgmEl && ASSET_DATA && ASSET_DATA.audio){
    bgmEl.src = ASSET_DATA.audio;
    bgmEl.volume = 0.72;
    bgmEl.loop = false;
    bgmEl.pause();
  }

  if(!ASSET_DATA) document.title = '奶系弹珠 · 弹射讨伐（源码调试）';

  var q = location.search || '';
  if(q.indexOf('debug') >= 0){
    window.__NAI__ = {
      state: state,
      view: view,
      META: META,
      startLevel: startLevel,
      damage: function(d){ damageBossRaw(view.cx, view.bossY, d, false, 5); },
      spawn: function(lv, x, y, vx, vy){
        var b = makeBall(x, y, lv, vx, vy);
        state.balls.push(b);
        return b;
      },
      win: bossDie,
      lose: failLevel,
      addMilk: addMilk,
      eff: buildEff,
      save: saveMeta,
      setBossHp: function(hp){ if(state.boss){ state.boss.hp = hp; updateBossHUD(); } },
      /* 手动推进 n 帧逻辑，供无头测试使用 */
      step: function(n){ for(var i=0;i<(n|0);i++) update(1/60); },
      draw: draw
    };
  }
  var lm = q.match(/level=(\d+)/);
  if(lm){
    hideIntro();
    startLevel(clamp(parseInt(lm[1],10)-1, 0, CHAPTERS.length-1));
  }
  if(q.indexOf('autoplay') >= 0){
    hideIntro();
    startLevel(0);
  }

  requestAnimationFrame(loop);
}

var lastTs = 0, acc = 0;
function loop(ts){
  if(!lastTs) lastTs = ts;
  var raw = Math.min(0.05, (ts - lastTs)/1000);
  lastTs = ts;
  /* 慢放：只压缩逼近物理的时间流速，渲染照常每帧跑 */
  var scale = 1;
  if(state.slowmo > 0){
    state.slowmo = Math.max(0, state.slowmo - raw);
    scale = 0.35;
  }
  var dt = raw * scale;
  T += dt;
  state.bootT += raw;
  acc += dt;
  var guard = 0;
  while(acc >= 1/60 && guard < 4){
    update(1/60);
    acc -= 1/60;
    guard++;
  }
  draw();
  requestAnimationFrame(loop);
}

boot();

})();
