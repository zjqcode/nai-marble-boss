/* =========================================================
   4. 图像 / 视图
   ========================================================= */
var IMG = {};
var cvs = $id('game');
var ctx = cvs.getContext('2d', {alpha:false});
var W = 0, H = 0, dpr = 1;
var view = {left:0,right:0,top:0,bottom:0,w:0,h:0,cx:0,s:1};
var SAFE_T = 0, SAFE_B = 0;
var RADII = [];
var orbTex = [];
var orbKey = '';
var bossTex = null, bossTexKey = '';
var bgTexA = null, bgTexB = null, bgDots = [];
var T = 0;
var G = {};

/* 可玩带内的纵向比例 → 像素：0 = 顶棚，1 = 弹弓正上方 */
function arenaY(f){ return view.arenaTop + view.arenaH * f; }

function readSafeArea(){
  var cs = getComputedStyle(document.documentElement);
  SAFE_T = parseFloat(cs.getPropertyValue('--sat')) || 0;
  SAFE_B = parseFloat(cs.getPropertyValue('--sab')) || 0;
}
function recalcRadii(){
  for(var i=0;i<CHARS.length;i++) RADII[i] = 10.8 * Math.pow(1.125, i) * view.s;
}

/* ---------- 素材加载弹窗 ----------
   慢网时先给个奶娃跑动的等待画面，加载完自动淡出。
   只在超过 220ms 还没加载完时才显示，避免一闪而过。 */
var LD_EL = null, LD_NUM = null, LD_FILL = null, LD_TIP = null, LD_TOTAL = 0, LD_SHOWN = false, LD_DONE = false;
var LD_TIPS = ['马上就好，别催', '奶娃背着奶瓶狂奔中', '再等一下下，狗子在加载'];

function loadingBegin(total){
  LD_TOTAL = total;
  LD_EL = document.getElementById('loading');
  LD_NUM = document.getElementById('ldNum');
  LD_FILL = document.getElementById('ldFill');
  LD_TIP = document.getElementById('ldTip');
  var all = document.getElementById('ldAll');
  if(all) all.textContent = total;
  if(LD_TIP) LD_TIP.textContent = LD_TIPS[Math.floor(Math.random() * LD_TIPS.length)];
  loadingTick(0);
  /* 快的话不弹，避免闪一下 */
  setTimeout(function(){ if(!LD_DONE && LD_EL){ LD_SHOWN = true; LD_EL.classList.add('show'); } }, 220);
  /* 兜底：最多 12 秒，别把人锁在弹窗里 */
  setTimeout(loadingDone, 12000);
}

function loadingTick(n){
  if(LD_NUM) LD_NUM.textContent = n;
  if(LD_FILL) LD_FILL.style.width = Math.round(100 * n / Math.max(1, LD_TOTAL)) + '%';
}

function loadingDone(){
  if(LD_DONE) return;
  LD_DONE = true;
  if(!LD_EL) return;
  loadingTick(LD_TOTAL);
  LD_EL.classList.remove('show');
  LD_EL.classList.add('done');
  setTimeout(function(){ if(LD_EL) LD_EL.style.display = 'none'; }, 340);
}

var loadChartIfNeeded = function(){};

function loadImages(){
  /* chart.webp（67KB 立绘总览图）目前没有任何地方绘制它 ——
     以前每次进游戏都白下一个 67KB 的包，国内网络下很明显。改成用时才加载。 */
  var chart = new Image();
  chart.__lazy = true;
  IMG.chart = chart;
  loadChartIfNeeded = function(){
    if(!chart.__lazy) return;
    chart.__lazy = false;
    chart.src = ASSET_DATA ? ASSET_DATA.chart : ASSET_BASE + 'chart.webp';
  };
  var loaded = 0;
  loadingBegin(CHARS.length);
  function tick(){
    loaded++;
    loadingTick(loaded);
    if(loaded >= CHARS.length){ buildOrbTextures(); buildBossTexture(true); loadingDone(); setTimeout(retryFailedImages, 6000); }
  }
  CHARS.forEach(function(c){
    var im = new Image();
    im.onload = tick;
    /* 素材走 CDN 时，单个节点抖动/被墙就换镜像节点重试一次；
       两次都失败才计入完成（游戏会用占位轮廓兜底，不至于卡在加载条） */
    im.onerror = function(){
      if(!im.__alt){
        var url = assetURL(c.n);
        if(url.indexOf('cdn.jsdelivr.net') >= 0){
          im.__alt = true;
          try { im.src = url.replace('cdn.jsdelivr.net', 'gcore.jsdelivr.net'); return; } catch(e) {}
        }
      }
      try { console.warn('素材加载失败: ' + assetURL(c.n)); } catch(e) {}
      tick();
    };
    im.src = assetURL(c.n);
    IMG[c.n] = im;
  });
}
/* 立绘加载失败的自愈：每 6 秒重试一次，最多 6 轮。
   手机弱网/单个节点抖动时很常见——不重试就会一直画占位光斑，看起来像「Boss 不见了」。 */
var IMG_RETRY = 0;
function retryFailedImages(){
  if(ASSET_DATA) return;                    /* 单文件版是内联 data URI，不存在网络失败 */
  if(IMG_RETRY >= 6) return;
  var failed = [];
  for(var i=0;i<CHARS.length;i++){
    var im = IMG[CHARS[i].n];
    if(!im || !im.complete || !im.naturalWidth) failed.push(CHARS[i].n);
  }
  if(!failed.length) return;
  IMG_RETRY++;
  failed.forEach(function(name){
    var im = IMG[name] || new Image();
    IMG[name] = im;
    im.onload = function(){
      try { buildOrbTextures(); buildBossTexture(true); } catch(e) {}
    };
    var url = assetURL(name);
    /* 交替换镜像节点，并加时间戳绕开失败缓存 */
    if(IMG_RETRY % 2 === 0 && url.indexOf('cdn.jsdelivr.net') >= 0){
      url = url.replace('cdn.jsdelivr.net', 'gcore.jsdelivr.net');
    }
    url += (url.indexOf('?') >= 0 ? '&' : '?') + 'r=' + IMG_RETRY;
    im.src = url;
  });
  setTimeout(retryFailedImages, 6000);
}

function imagesReady(){
  for(var i=0;i<CHARS.length;i++){
    var im = IMG[CHARS[i].n];
    if(!im || !im.complete || !im.naturalWidth) return false;
  }
  return true;
}

function layout(){
  W = window.innerWidth;
  H = window.innerHeight;
  var cap = Math.sqrt(4200000 / Math.max(1, W*H));
  dpr = Math.min(window.devicePixelRatio || 1, 2, Math.max(1, cap));
  cvs.width = Math.round(W*dpr);
  cvs.height = Math.round(H*dpr);
  cvs.style.width = W + 'px';
  cvs.style.height = H + 'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  readSafeArea();
  var hud = $id('hud'), dock = $id('dock');
  var hudBottom = hud ? hud.getBoundingClientRect().bottom : (SAFE_T + 120);
  var dockTop = dock ? dock.getBoundingClientRect().top : (H - SAFE_B - 82);

  view.top = 4;
  if(W > H){
    /* 横屏：dock 已搬到左侧竖栏，场地不再受它约束。
       直接贴到屏幕底部（只留 4px 描边余量），把最下面那条空带还给场地。 */
    view.bottom = Math.round(H - SAFE_B - 4);
  } else {
    view.bottom = Math.round(dockTop - 2);
  }
  view.h = view.bottom - view.top;
  /* 宽屏不再死卡 760：宽度跟随高度放开，横屏/桌面场地更宽。
     横屏时两侧要留给摇杆（各约 120~140px），中间尽量放宽——场地越宽，左右闪避越有意义。 */
  var maxW;
  if(W > H){
    var sideRoom = Math.max(96, Math.min(140, W * 0.16));
    maxW = Math.max(320, Math.min(W - sideRoom * 2, Math.max(520, view.h * 1.9)));
  } else {
    maxW = Math.min(W, clamp(view.h * 1.15, 520, 860));
  }
  view.w = Math.round(maxW);
  view.left = Math.round((W - view.w)/2);
  view.right = view.left + view.w;
  view.cx = W/2;
  /* 物体缩放取宽、高中更紧的一边：原来只看宽度，桌面上球半径到 45px，
     而炮台到 HUD 只有 320px，球一多就互相卡死 */
  view.s = Math.min(view.w / 390, view.h / 540);
  view.bossH = Math.round(clamp(Math.min(view.w*0.34, view.h*0.26), 90, 170));
  view.pouchY = view.bottom - Math.round(54*view.s);
  view.bossY = Math.max(view.top + Math.round(view.bossH*0.58) + 4, Math.round(hudBottom + view.bossH*0.5 + 8));
  /* 弹力顶棚：贴着 HUD 下沿，球打到顶会弹回来再打一次 Boss，而不是直接消失 */
  view.ceil = Math.round(Math.max(view.top + 8, hudBottom + 2));
  /* 可玩带：顶棚 → 弹弓上方。机关都按这个带的比例摆放，不再被 HUD 盖住 */
  view.arenaTop = view.ceil;
  view.arenaH = Math.max(120, view.pouchY - 40*view.s - view.ceil);
  state.cannonX = clamp(state.cannonX || view.cx, view.left + 30*view.s, view.right - 30*view.s);

  recalcRadii();
  buildOrbTextures();
  buildBossTexture();
  buildGradients();
  buildBgTextures();

  if(state.boss){
    state.boss.r = Math.round(view.bossH*0.34);
    state.boss.x = clamp(state.boss.x, view.left+state.boss.w/2+4, view.right-state.boss.w/2-4);
    state.boss.baseY = view.bossY;
    state.boss.y = view.bossY;
  }
  for(var i=0;i<state.balls.length;i++){
    var b = state.balls[i];
    b.r = RADII[b.lv];
    b.m = b.r*b.r;
    b.x = clamp(b.x, view.left+b.r, view.right-b.r);
    b.y = clamp(b.y, view.ceil+b.r, view.bottom-b.r);
  }
  state.aim.x = state.cannonX || view.cx;
}

/* ---- orb textures ---- */
function paintOrb(g, r, img){
  var aura = g.createRadialGradient(0,0,r*0.55, 0,0,r*1.55);
  aura.addColorStop(0,'rgba(255,196,96,.20)');
  aura.addColorStop(.55,'rgba(255,176,70,.07)');
  aura.addColorStop(1,'rgba(255,176,70,0)');
  g.fillStyle = aura;
  g.beginPath(); g.arc(0,0,r*1.55,0,TAU); g.fill();

  var grad = g.createRadialGradient(-r*.36,-r*.42,r*.06, 0,0,r*1.05);
  grad.addColorStop(0,'#d7eee0');
  grad.addColorStop(.38,'#92ba9d');
  grad.addColorStop(.72,'#547b64');
  grad.addColorStop(.92,'#294c3e');
  grad.addColorStop(1,'#142d26');
  g.beginPath(); g.arc(0,0,r,0,TAU); g.fillStyle = grad; g.fill();

  if(img && img.complete && img.naturalWidth){
    var ih = r*1.76, iw = ih * (img.naturalWidth/img.naturalHeight);
    if(iw > r*1.92){ iw = r*1.92; ih = iw * (img.naturalHeight/img.naturalWidth); }
    g.save();
    g.beginPath(); g.arc(0,0,r,0,TAU); g.clip();
    g.drawImage(img, -iw/2, -ih/2 + r*.055, iw, ih);
    var sh = g.createLinearGradient(0,r*.18,0,r);
    sh.addColorStop(0,'rgba(70,35,0,0)');
    sh.addColorStop(1,'rgba(20,40,30,.12)');
    g.fillStyle = sh; g.fillRect(-r,-r,2*r,2*r);
    g.restore();
  }
  g.beginPath(); g.arc(0,0,r-.6,0,TAU);
  g.lineWidth = Math.max(1, r*.045); g.strokeStyle = 'rgba(255,242,206,.52)'; g.stroke();

  g.save();
  g.beginPath(); g.arc(0,0,r,0,TAU); g.clip();
  var hl = g.createRadialGradient(-r*.38,-r*.46,0, -r*.38,-r*.46,r*.72);
  hl.addColorStop(0,'rgba(255,255,255,.16)');
  hl.addColorStop(.42,'rgba(255,255,255,.03)');
  hl.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle = hl; g.fillRect(-r,-r,2*r,2*r);
  var rb = g.createRadialGradient(r*.16,r*.56,r*.04, r*.16,r*.56,r*.72);
  rb.addColorStop(0,'rgba(255,226,160,.24)');
  rb.addColorStop(1,'rgba(255,226,160,0)');
  g.fillStyle = rb; g.fillRect(-r,-r,2*r,2*r);
  g.restore();

  g.beginPath(); g.ellipse(-r*.36,-r*.44,r*.17,r*.095,-.65,0,TAU);
  g.fillStyle = 'rgba(255,255,255,.32)'; g.fill();
}

function buildOrbTextures(){
  if(!RADII.length || !imagesReady()) return;
  var key = dpr + '|' + RADII.join(',');
  if(key === orbKey && orbTex.length) return;
  var pad = 1.6;
  var arr = [];
  for(var lv=0; lv<CHARS.length; lv++){
    var r = RADII[lv];
    var px = Math.ceil(r*2*pad*dpr);
    if(px > 768) px = 768;
    if(px < 32) px = 32;
    var c = document.createElement('canvas');
    c.width = px; c.height = px;
    var g = c.getContext('2d');
    var sc = px/(r*2*pad);
    g.setTransform(sc,0,0,sc,0,0);
    g.translate(r*pad, r*pad);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    paintOrb(g, r, IMG[CHARS[lv].n]);
    arr[lv] = {c:c, pad:pad};
  }
  orbTex = arr;
  orbKey = key;
}

var bossArt = null, bossWhite = null, bossArtW = 0, bossArtH = 0;

function buildBossTexture(force){
  if(!state.boss || !imagesReady()) return;
  var key = state.boss.char + '|' + view.bossH + '|' + dpr;
  if(!force && key === bossTexKey && bossArt) return;
  var img = IMG[state.boss.char];
  if(!img || !img.naturalWidth) return;
  var h = Math.round(view.bossH * (force ? 1 : 1));
  var w = Math.max(24, Math.round(h * img.naturalWidth / img.naturalHeight));

  var c = document.createElement('canvas');
  c.width = Math.max(2, Math.round(w*dpr));
  c.height = Math.max(2, Math.round(h*dpr));
  var g = c.getContext('2d');
  g.setTransform(dpr,0,0,dpr,0,0);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, w, h);
  g.globalCompositeOperation = 'source-atop';
  var tint = g.createRadialGradient(w*.5, h*.42, h*.12, w*.5, h*.55, h*.75);
  tint.addColorStop(0,'rgba(120,0,30,0)');
  tint.addColorStop(.65,'rgba(90,0,26,.04)');
  tint.addColorStop(1,'rgba(35,0,12,.14)');
  g.fillStyle = tint;
  g.fillRect(0,0,w,h);
  g.globalCompositeOperation = 'source-over';

  var c2 = document.createElement('canvas');
  c2.width = c.width;
  c2.height = c.height;
  var g2 = c2.getContext('2d');
  g2.setTransform(dpr,0,0,dpr,0,0);
  g2.imageSmoothingEnabled = true;
  g2.imageSmoothingQuality = 'high';
  g2.drawImage(img, 0, 0, w, h);
  g2.globalCompositeOperation = 'source-in';
  g2.fillStyle = '#ffffff';
  g2.fillRect(0,0,w,h);

  bossArt = c;
  bossWhite = c2;
  bossArtW = w;
  bossArtH = h;
  state.boss.w = w;
  state.boss.h = h;
  if(!state.boss.r) state.boss.r = Math.round(h*0.34);
  bossTexKey = key;
}

/* =========================================================
   动态背景：程序化生成，不依赖图片素材
   三层：柔光云（大团暖金/奶白） + 亮斑层（小颗高光） + 上浮奶滴
   ========================================================= */
function seededRand(seed){
  var s = seed % 2147483647;
  if(s <= 0) s += 2147483646;
  return function(){ s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

/* 预渲染一团柔光云：只在 resize 时算一次，每帧只做一次 drawImage */
function makeNebulaLayer(w, h, seed, blobs){
  var c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  var g = c.getContext('2d');
  var rnd = seededRand(seed);
  for(var i=0;i<blobs.length;i++){
    var b = blobs[i];
    var x = (b.x !== undefined ? b.x : rnd()) * w;
    var y = (b.y !== undefined ? b.y : rnd()) * h;
    var r = b.r * Math.max(w, h);
    var grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, b.c[0]);
    grd.addColorStop(0.5, b.c[1]);
    grd.addColorStop(1, b.c[2]);
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI*2);
    g.fill();
  }
  return c;
}

function buildBgTextures(){
  if(!W || !H) return;
  /* 画得比屏幕大 28%，留出漂移余量，避免边缘露底 */
  var tw = Math.max(64, Math.round(W * 1.28));
  var th = Math.max(64, Math.round(H * 1.28));

  /* 层 A：低处的大团暖云，慢速漂移，构成整体呼吸感 */
  bgTexA = makeNebulaLayer(tw, th, 20261030, [
    {x:.18, y:.24, r:.46, c:['rgba(255,206,140,.46)','rgba(210,140,60,.17)','rgba(120,70,20,0)']},
    {x:.76, y:.16, r:.40, c:['rgba(255,224,176,.38)','rgba(190,130,60,.14)','rgba(90,50,10,0)']},
    {x:.52, y:.62, r:.52, c:['rgba(120,190,255,.22)','rgba(60,110,190,.10)','rgba(20,40,90,0)']},
    {x:.16, y:.84, r:.38, c:['rgba(255,190,130,.30)','rgba(160,90,40,.11)','rgba(80,40,10,0)']},
    {x:.88, y:.72, r:.34, c:['rgba(180,230,255,.20)','rgba(70,140,190,.09)','rgba(20,50,80,0)']},
    {x:.42, y:.36, r:.30, c:['rgba(255,236,200,.28)','rgba(200,150,80,.11)','rgba(100,60,10,0)']}
  ]);

  /* 层 B：更小更亮的高光点，反向漂移，制造前后层次 */
  bgTexB = makeNebulaLayer(tw, th, 777001, [
    {x:.30, y:.30, r:.13, c:['rgba(255,244,214,.42)','rgba(255,200,120,.15)','rgba(180,110,30,0)']},
    {x:.70, y:.46, r:.11, c:['rgba(255,232,180,.34)','rgba(230,160,80,.12)','rgba(150,90,20,0)']},
    {x:.46, y:.78, r:.10, c:['rgba(220,245,255,.26)','rgba(120,190,235,.09)','rgba(40,90,140,0)']},
    {x:.12, y:.56, r:.09, c:['rgba(255,238,190,.30)','rgba(200,150,70,.10)','rgba(120,70,20,0)']},
    {x:.86, y:.24, r:.12, c:['rgba(255,246,224,.28)','rgba(220,170,90,.10)','rgba(140,90,20,0)']}
  ]);

  /* 上浮奶滴：位置用归一化坐标，画的时候乘屏幕尺寸，横竖屏都合适 */
  var rnd = seededRand(424242);
  bgDots = [];
  for(var i=0;i<42;i++){
    bgDots.push({
      x: rnd(),
      y: rnd(),
      r: 0.8 + rnd() * 2.6,
      sp: 0.006 + rnd() * 0.020,      /* 每秒上浮的屏幕高度比例 */
      ph: rnd() * Math.PI * 2,
      warm: rnd() < 0.72
    });
  }
}

/* 画一层云：slowX / slowY 是每秒的漂移角速度，scale 控制层间距 */
function drawNebulaLayer(tex, ax, ay, scale, alpha){
  if(!tex) return;
  var ox = Math.sin(T * ax) * W * 0.055 + Math.cos(T * ay) * W * 0.022;
  var oy = Math.cos(T * ay) * H * 0.040 + Math.sin(T * ax) * H * 0.016;
  var dw = tex.width * scale;
  var dh = tex.height * scale;
  ctx.globalAlpha = alpha;
  ctx.drawImage(tex, (W - dw)/2 + ox, (H - dh)/2 + oy, dw, dh);
  ctx.globalAlpha = 1;
}

function drawBgDots(){
  if(!bgDots.length) return;
  for(var i=0;i<bgDots.length;i++){
    var d = bgDots[i];
    var y = (d.y - T * d.sp) % 1;
    if(y < 0) y += 1;
    var x = d.x * W + Math.sin(T * 0.6 + d.ph) * 6;
    var py = y * H;
    var tw = 0.35 + 0.65 * Math.abs(Math.sin(T * 1.5 + d.ph));
    ctx.globalAlpha = 0.45 * tw;
    ctx.fillStyle = d.warm ? 'rgba(255,232,190,1)' : 'rgba(190,225,255,1)';
    ctx.beginPath();
    ctx.arc(x, py, d.r, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function buildGradients(){
  var x = view.left, y = view.top, w = view.w, h = view.h;  G.bgTint = ctx.createLinearGradient(0,0,0,H);
  G.bgTint.addColorStop(0,'rgba(7,27,24,.42)');
  G.bgTint.addColorStop(.30,'rgba(7,27,24,.20)');
  G.bgTint.addColorStop(.62,'rgba(7,27,24,.32)');
  G.bgTint.addColorStop(1,'rgba(3,17,15,.86)');

  /* 动态背景的底色：顶部偏暖（Boss 在上），底部沉到近黑，给弹弓区留对比 */
  G.bgDeep = ctx.createLinearGradient(0,0,0,H);
  G.bgDeep.addColorStop(0,'#163b34');
  G.bgDeep.addColorStop(.34,'#112f2a');
  G.bgDeep.addColorStop(.72,'#0d2522');
  G.bgDeep.addColorStop(1,'#071a18');

  G.bgRad = ctx.createRadialGradient(W*.5,H*.42,Math.min(W,H)*.16, W*.5,H*.46,Math.max(W,H)*.72);
  G.bgRad.addColorStop(0,'rgba(133,170,119,.10)');
  G.bgRad.addColorStop(.55,'rgba(0,0,0,0)');
  G.bgRad.addColorStop(1,'rgba(0,0,0,.55)');

  G.fallback = ctx.createLinearGradient(0,0,0,H);
  G.fallback.addColorStop(0,'#1c443a'); G.fallback.addColorStop(.5,'#23483c'); G.fallback.addColorStop(1,'#0b211e');

  /* 场地：略透光，让动态背景能透进来；太透会影响奶球与文字的对比度 */
  G.field = ctx.createLinearGradient(0,y,0,y+h);
  G.field.addColorStop(0,'rgba(11,32,28,.80)');
  G.field.addColorStop(.5,'rgba(9,28,25,.77)');
  G.field.addColorStop(1,'rgba(5,21,19,.90)');

  G.fieldTop = ctx.createLinearGradient(0,y,0,y+h*.35);
  G.fieldTop.addColorStop(0,'rgba(185,216,161,.07)');
  G.fieldTop.addColorStop(1,'rgba(185,216,161,0)');

  G.fieldBottom = ctx.createLinearGradient(0,y+h*.6,0,y+h);
  G.fieldBottom.addColorStop(0,'rgba(0,0,0,0)');
  G.fieldBottom.addColorStop(1,'rgba(0,0,0,.44)');

  G.vig = ctx.createRadialGradient(W/2,H*.45,Math.min(W,H)*.30, W/2,H*.48,Math.max(W,H)*.78);
  G.vig.addColorStop(0,'rgba(0,0,0,0)');
  G.vig.addColorStop(1,'rgba(0,0,0,.5)');
}

