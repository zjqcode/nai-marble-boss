/* =========================================================
   20. 交互 / 启动
   ========================================================= */
function startCampaign(){
  var idx = Math.min(CHAPTERS.length-1, META.progress);
  startLevel(idx);
}

function bindEvents(){
  var c = cvs;

  /* 双摇杆生效时，画布上的「拖拽瞄准」必须彻底停用：
     它是单摇杆时代的旧交互，和右摇杆并存会导致「手指滑出摇杆就开始发射 /
     左手还按着却打出球」这类误触。手机上只允许用右摇杆发射。 */
  function sticksActive(){
    var r = $id('stickR');
    if(!r) return false;
    var rect = r.getBoundingClientRect();
    return rect.width > 0 && document.body.classList.contains('playing');
  }

  c.addEventListener('pointerdown', function(e){
    Sound.init(); Sound.resume();
    /* 反弹板放置优先：一根手指定位，第二根手指旋转 */
    if(state.placingPlate && state.mode === 'play' && !state.paused){
      var pl = state.placingPlate;
      try{ c.setPointerCapture(e.pointerId); }catch(err){}
      if(pl.dragId == null){
        pl.dragId = e.pointerId;
        pl.dragging = true;
        movePlateTo(e.clientX, e.clientY);
      } else if(pl.rotId == null){
        pl.rotId = e.pointerId;
        rotatePlateTo(e.clientX, e.clientY);
      }
      e.preventDefault();
      return;
    }
    if(state.mode !== 'play' || state.paused) return;
    if(sticksActive()) return;          /* 走摇杆：画布不再接管发射 */
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
    if(state.placingPlate){
      var pl = state.placingPlate;
      if(e.pointerId === pl.rotId) rotatePlateTo(e.clientX, e.clientY);
      else if(pl.dragging && e.pointerId === pl.dragId) movePlateTo(e.clientX, e.clientY);
      e.preventDefault();
      return;
    }
    if(sticksActive()) return;
    if(!state.aim.active) return;
    state.aim.px = e.clientX;
    state.aim.py = e.clientY;
    if(Math.hypot(e.clientX - state.aim.sx, e.clientY - state.aim.sy) > 8) state.aim.moved = true;
    updateAimVectors();
    e.preventDefault();
  });

  function endAim(e){
    /* 松手放下反弹板 */
    if(state.placingPlate){
      var pl2 = state.placingPlate;
      /* 抬起的若是旋转指，只结束旋转，不确认放置 */
      if(e && e.pointerId === pl2.rotId){
        pl2.rotId = null;
        e.preventDefault();
        return;
      }
      if(pl2.dragging && (!e || e.pointerId === pl2.dragId)){
        pl2.dragging = false;
        pl2.dragId = null;
        confirmPlatePlacement();
      }
      if(e) e.preventDefault();
      return;
    }
    var a = state.aim;
    if(sticksActive()){ a.active = false; a.power = 0; return; }
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

  /* 反弹板专用按钮：点一下进入「拖拽放置」模式，再点一下取消 */
  if($id('bPlate')){
    $id('bPlate').addEventListener('click', function(){
      Sound.init(); Sound.resume();
      if(state.placingPlate){ cancelPlatePlacement(); return; }
      /* 道具栏里的反弹板入口也走同一套流程 */
      useItem('plate');
      refreshPlateBtn();
    });
  }

  $id('bStart').addEventListener('click', function(){
    Sound.init(); Sound.resume(); Sound.ui();
    /* 开打是一次真实点击：顺手申请横屏（失败静默，不打断开局） */
    if(isPortraitNow()) enterLandscape();
    startCampaign();
  });
  $id('bIntroLevels').addEventListener('click', openLevels);
  $id('bEndless').addEventListener('click', function(){ Sound.ui(); openLevels(); startEndless(); });
  /* 从指南面板直接开演习：强制走教程流程 */
  $id('bGuideTrain').addEventListener('click', function(){
    Sound.init(); Sound.resume(); Sound.ui();
    closeAllScreens();
    hideIntro();
    state.tutForce = true;
    if(isPortraitNow()) enterLandscape();
    startLevel(0);
  });
  $id('bIntroGuide').addEventListener('click', function(){
    Sound.ui();
    /* 用游戏内面板而不是新标签：开新标签会让手机退出全屏 */
    openScreen('guide');
  });
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
  /* 左侧竖栏：章节 / 图鉴 / 商店常驻，不用先进暂停 */
  $id('bLevels').addEventListener('click', openLevels);
  $id('bGallery').addEventListener('click', showGallery);
  $id('bShop').addEventListener('click', function(){ Sound.ui(); openShop(); });
  /* 道具分左右两栏，两边都要能点 */
  function onItemClick(e){
    var btn = e.target.closest('[data-item]');
    if(!btn) return;
    useItem(btn.getAttribute('data-item'));
  }
  $id('itemBar').addEventListener('click', onItemClick);
  if($id('itemBar2')) $id('itemBar2').addEventListener('click', onItemClick);

  /* 双摇杆（左=移动，右=瞄准发射）。原来的 ◄ ► 按钮已移除 */
  bindSticks();

  function toggleFullscreen(){
    Sound.ui();
    var el = document.documentElement;
    var fs = document.fullscreenElement || document.webkitFullscreenElement;
    try{
      if(!fs){
        var fn = el.requestFullscreen || el.webkitRequestFullscreen;
        if(!fn){ toast('当前浏览器不支持全屏'); return; }
        /* 进全屏后顺手尝试锁横屏：Android Chrome 只有在全屏下才允许锁方向 */
        hideFsHint(true);
        Promise.resolve(fn.call(el)).then(function(){
          lockLandscape();
          return layout();
        }).catch(function(){});
      } else {
        var ex = document.exitFullscreen || document.webkitExitFullscreen;
        if(ex) ex.call(document);
      }
    }catch(e){ toast('全屏切换失败'); }
  }
  $id('bFull').addEventListener('click', toggleFullscreen);
  $id('bIntroFull').addEventListener('click', toggleFullscreen);
  /* 首页两个工具按钮对齐（各断点尺寸不同，测量后再摆） */
  syncIntroTools();
  maybeShowFsHint();
  /* 手机地址栏收起/展开会连续触发 resize：合并到下一帧只对齐一次，避免反复读写布局 */
  var introToolsPending = false;
  function queueSyncIntroTools(){
    if(introToolsPending) return;
    introToolsPending = true;
    requestAnimationFrame(function(){ introToolsPending = false; syncIntroTools(); });
  }
  window.addEventListener('resize', queueSyncIntroTools);
  window.addEventListener('orientationchange', function(){ setTimeout(syncIntroTools, 120); });
  document.addEventListener('fullscreenchange', function(){ setTimeout(syncIntroTools, 60); });
  document.addEventListener('webkitfullscreenchange', function(){ setTimeout(syncIntroTools, 60); });

  /* 竖屏提示条：主动请求横屏（全屏 + 锁方向），失败就提示手动旋转 */
  $id('bRotateGo').addEventListener('click', function(){
    Sound.init(); Sound.resume(); Sound.ui();
    enterLandscape().then(function(stillPortrait){
      if(stillPortrait) toast('浏览器不允许锁定方向 · 请手动把手机横过来');
      setTimeout(layout, 200);
    });
  });

  /* 暂停：按钮 + 面板里的三个选项 */
  $id('bPause').addEventListener('click', function(){ togglePause(); });
  $id('bResume').addEventListener('click', function(){
    Sound.ui();
    closeScreen('pause');
  });
  $id('bPauseRestart').addEventListener('click', function(){
    Sound.ui();
    closeAllScreens();
    startLevel(state.chapterIndex);
  });
  $id('bPauseLevels').addEventListener('click', function(){ openLevels(); });
  $id('bPauseHome').addEventListener('click', function(){ goHome(); });

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
  $id('bWinHome').addEventListener('click', function(){ goHome(); });
  $id('bLoseHome').addEventListener('click', function(){ goHome(); });
  $id('bRetry').addEventListener('click', function(){
    Sound.ui();
    var wasEndless = state.endless;
    closeAllScreens();
    /* 无尽模式失败后重开的是无尽，而不是「第 N 章」 —— 否则会莫名进入普通关卡 */
    if(wasEndless){
      state.endless = false;
      startEndless();
    } else {
      startLevel(state.chapterIndex);
    }
  });

  $id('shopList').addEventListener('click', function(e){
    var btn = e.target.closest('[data-buy]');
    if(!btn) return;
    var key = btn.getAttribute('data-buy');
    var it = shopItem(key);
    if(!it) return;
    /* 有堆叠上限的道具（加时奶糖 6 个）买满就不再卖 */
    if(it.max && itemCount(key) >= it.max){
      toast(it.n + ' 最多存 ' + it.max + ' 个，先用掉一些吧');
      return;
    }
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
    document.body.classList.add('portrait-ok');
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
    } else if((k === 'q' || k === 'e') && state.placingPlate){
      /* 桌面端微调反弹板角度 */
      e.preventDefault();
      nudgePlateAngle(k === 'q' ? -1 : 1);
    } else if(k === 'p'){
      /* P 键暂停/继续 */
      e.preventDefault();
      togglePause();
    } else if(k === 'escape'){
      /* 游戏中按 Esc = 暂停；没有面板打开时不再是无意义的 closeAllScreens */
      if(state.mode === 'play' && !document.querySelector('.screen.show')) togglePause();
      else closeAllScreens();
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
    if(document.hidden){
      saveMeta();
      /* 切后台/锁屏：立刻掐掉循环的结算音效，否则会在别的 App 上一直响 */
      audioSuspend();
      state.moveDir = 0;
      state.stickX = 0;
    } else {
      audioResume();
    }
  });
  /* 关闭页面、从微信返回时同样要停 */
  window.addEventListener('pagehide', function(){ audioSuspend(); saveMeta(); });
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

  /* 音效：单文件版走内联 data URI；外置资源版（部署网站用）回退到 assets/ 相对路径 */
  bgmEl = $id('bgm');
  if(bgmEl){
    bgmEl.src = (ASSET_DATA && ASSET_DATA.audioWin) ? ASSET_DATA.audioWin : AUDIO_BASE + 'laugh.mp3';
    bgmEl.volume = 0.72;
    bgmEl.loop = true;
    bgmEl.pause();
  }
  loseEl = $id('loseSnd');
  if(loseEl){
    loseEl.src = (ASSET_DATA && ASSET_DATA.audioLose) ? ASSET_DATA.audioLose : AUDIO_BASE + 'lose.mp3';
    loseEl.volume = 0.62;
    loseEl.loop = true;
  loseEl.pause();
  }
  var hahaEl = $id('hahaSnd');
  if(hahaEl){
    hahaEl.src = (ASSET_DATA && ASSET_DATA.audioHaha) ? ASSET_DATA.audioHaha : AUDIO_BASE + 'haha.mp3';
    hahaEl.volume = 0.55;
    hahaEl.loop = false;
    hahaEl.preload = 'auto';
    if(Sound.setHaha) Sound.setHaha(hahaEl);
  }

  if(!ASSET_DATA) document.title = '奶系弹珠 · 弹射讨伐（源码调试）';

  var q = location.search || '';
  if(q.indexOf('debug') >= 0){
    window.__NAI__ = {
      state: state,
    imgState: function(){
      var out = {};
      for(var i=0;i<CHARS.length;i++){ var im = IMG[CHARS[i].n]; out[CHARS[i].n] = !!(im && im.naturalWidth); }
      return out;
    },
    bossTex: function(){
      var b = state.boss;
      var img = b ? IMG[b.char] : null;
      return { char: b && b.char, art: !!bossArt, aw: bossArtW, ah: bossArtH,
               key: bossTexKey, hasImg: !!(img && img.naturalWidth),
               w: b && b.w, h: b && b.h, entrance: b && b.entrance,
               hitScale: b && b.hitScale, dead: b && b.dead, imagesReady: imagesReady() };
    },
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
      /* 直接对勇者造成伤害，用于测试「血量归零」这条失败路径 */
      hurtHero: heroHit,
      addMilk: addMilk,
      eff: buildEff,
      save: saveMeta,
      setBossHp: function(hp){ if(state.boss){ state.boss.hp = hp; updateBossHUD(); } },
      /* 道具 / 反弹板相关，供冒烟测试调用 */
      useItem: useItem,
      itemCount: itemCount,
      updateItemBar: updateItemBar,
      updateHearts: updateHearts,
      refreshPlateBtn: refreshPlateBtn,
      startPlatePlacement: startPlatePlacement,
      confirmPlatePlacement: confirmPlatePlacement,
      /* 音频状态：切后台是否真的静音，靠这个断言 */
      audioState: function(){ return { ctx: Sound.ctxState(), bgm: Sound.bgmPlaying(), on: Sound.isOn() }; },
      /* 难度相关，供测试直接驱动 */
      dodgeSuccess: function(){ dodgeSuccess(); },
      attackHit: attackHit,
      audioSuspend: audioSuspend,
      audioResume: audioResume,
      cancelPlatePlacement: cancelPlatePlacement,
      plateLen: plateLen,
      /* 手动推进 n 帧逻辑，供无头测试使用 */
      step: function(n){ for(var i=0;i<(n|0);i++) update(1/60); },
      /* 逐帧推进并真实渲染（会推进虚拟时钟），用于截图与画面断言 */
      tick: function(n){ for(var i=0;i<(n|0);i++){ T += 1/60; update(1/60); draw(); } },
      draw: draw
    };
  }
  var lm = q.match(/level=(\d+)/);
  if(lm){
    hideIntro();
    startLevel(clamp(parseInt(lm[1],10)-1, 0, CHAPTERS.length-1));
  }
  /* ?tutorial=1：直接从首页进入第一章的新手演习（教程强制开启） */
  if(!lm && /[?&]tutorial=1/.test(q)){
    hideIntro();
    startLevel(0);
  }
  if(q.indexOf('autoplay') >= 0){
    hideIntro();
    startLevel(0);
  }

  requestAnimationFrame(loop);
}

var lastTs = 0, acc = 0, introSkip = false;
function loop(ts){
  if(!lastTs) lastTs = ts;
  var raw = Math.min(0.05, (ts - lastTs)/1000);
  lastTs = ts;
  /* 首页只是静态展示（动画都在 DOM/CSS 里），隔帧渲染就够了：
     手机上能明显减少掉帧和发热，进入战斗后恢复满帧。 */
  if(state.mode === 'intro'){
    introSkip = !introSkip;
    if(introSkip){ requestAnimationFrame(loop); return; }
  }
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
