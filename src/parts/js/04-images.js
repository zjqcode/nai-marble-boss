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
var bgSmall = null;
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

function loadImages(){
  var bg = new Image();
  bg.onload = function(){ buildBgSmall(); };
  bg.src = ASSET_DATA ? ASSET_DATA.bg : 'assets/bg-thunder.webp';
  IMG.bg = bg;
  var chart = new Image();
  chart.src = ASSET_DATA ? ASSET_DATA.chart : 'assets/chart.webp';
  IMG.chart = chart;
  var loaded = 0;
  CHARS.forEach(function(c){
    var im = new Image();
    im.onload = function(){
      loaded++;
      if(loaded >= CHARS.length){ buildOrbTextures(); buildBossTexture(true); }
    };
    im.src = assetURL(c.n, 'webp');
    IMG[c.n] = im;
  });
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
  view.bottom = Math.round(dockTop - 2);
  view.h = view.bottom - view.top;
  /* 宽屏不再死卡 760：宽度跟随高度放开，横屏/桌面场地更宽 */
  var maxW = Math.min(W, clamp(view.h * 1.15, 520, 860));
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
  buildBgSmall();
  buildGradients();

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
  grad.addColorStop(0,'#fffbe9');
  grad.addColorStop(.38,'#f9dd9b');
  grad.addColorStop(.72,'#e5b055');
  grad.addColorStop(.92,'#bd7d28');
  grad.addColorStop(1,'#8f5612');
  g.beginPath(); g.arc(0,0,r,0,TAU); g.fillStyle = grad; g.fill();

  if(img && img.complete && img.naturalWidth){
    var ih = r*1.76, iw = ih * (img.naturalWidth/img.naturalHeight);
    if(iw > r*1.92){ iw = r*1.92; ih = iw * (img.naturalHeight/img.naturalWidth); }
    g.save();
    g.beginPath(); g.arc(0,0,r,0,TAU); g.clip();
    g.drawImage(img, -iw/2, -ih/2 + r*.055, iw, ih);
    var sh = g.createLinearGradient(0,r*.18,0,r);
    sh.addColorStop(0,'rgba(70,35,0,0)');
    sh.addColorStop(1,'rgba(58,27,0,.38)');
    g.fillStyle = sh; g.fillRect(-r,-r,2*r,2*r);
    g.restore();
  }
  g.beginPath(); g.arc(0,0,r-.6,0,TAU);
  g.lineWidth = Math.max(1, r*.045); g.strokeStyle = 'rgba(255,242,206,.52)'; g.stroke();

  g.save();
  g.beginPath(); g.arc(0,0,r,0,TAU); g.clip();
  var hl = g.createRadialGradient(-r*.38,-r*.46,0, -r*.38,-r*.46,r*.72);
  hl.addColorStop(0,'rgba(255,255,255,.50)');
  hl.addColorStop(.42,'rgba(255,255,255,.10)');
  hl.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle = hl; g.fillRect(-r,-r,2*r,2*r);
  var rb = g.createRadialGradient(r*.16,r*.56,r*.04, r*.16,r*.56,r*.72);
  rb.addColorStop(0,'rgba(255,226,160,.24)');
  rb.addColorStop(1,'rgba(255,226,160,0)');
  g.fillStyle = rb; g.fillRect(-r,-r,2*r,2*r);
  g.restore();

  g.beginPath(); g.ellipse(-r*.36,-r*.44,r*.17,r*.095,-.65,0,TAU);
  g.fillStyle = 'rgba(255,255,255,.82)'; g.fill();
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
  tint.addColorStop(0,'rgba(120,0,30,.04)');
  tint.addColorStop(.65,'rgba(90,0,26,.16)');
  tint.addColorStop(1,'rgba(35,0,12,.5)');
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

function buildBgSmall(){
  if(!W || !H) return;
  var img = IMG.bg;
  if(!img || !img.complete || !img.naturalWidth) return;
  var sw = Math.max(32, Math.round(W/9));
  var sh = Math.max(48, Math.round(H/9));
  if(!bgSmall) bgSmall = document.createElement('canvas');
  bgSmall.width = sw;
  bgSmall.height = sh;
  var g = bgSmall.getContext('2d');
  var iw = img.naturalWidth, ih = img.naturalHeight;
  var sc = Math.max(W/iw, H/ih) * 1.09;
  var dw = iw*sc, dh = ih*sc;
  g.setTransform(sw/W,0,0,sh/H,0,0);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, (W-dw)/2, (H-dh)*0.34, dw, dh);
}

function buildGradients(){
  var x = view.left, y = view.top, w = view.w, h = view.h;  G.bgTint = ctx.createLinearGradient(0,0,0,H);
  G.bgTint.addColorStop(0,'rgba(4,10,18,.50)');
  G.bgTint.addColorStop(.30,'rgba(4,10,18,.27)');
  G.bgTint.addColorStop(.62,'rgba(4,10,18,.38)');
  G.bgTint.addColorStop(1,'rgba(2,6,12,.88)');

  G.bgRad = ctx.createRadialGradient(W*.5,H*.42,Math.min(W,H)*.16, W*.5,H*.46,Math.max(W,H)*.72);
  G.bgRad.addColorStop(0,'rgba(70,110,160,.10)');
  G.bgRad.addColorStop(.55,'rgba(0,0,0,0)');
  G.bgRad.addColorStop(1,'rgba(0,0,0,.55)');

  G.fallback = ctx.createLinearGradient(0,0,0,H);
  G.fallback.addColorStop(0,'#101a28'); G.fallback.addColorStop(.5,'#1d2a3c'); G.fallback.addColorStop(1,'#050a12');

  G.field = ctx.createLinearGradient(0,y,0,y+h);
  G.field.addColorStop(0,'rgba(8,13,22,1)');
  G.field.addColorStop(.5,'rgba(6,10,17,1)');
  G.field.addColorStop(1,'rgba(3,6,11,1)');

  G.fieldTop = ctx.createLinearGradient(0,y,0,y+h*.35);
  G.fieldTop.addColorStop(0,'rgba(150,195,255,.07)');
  G.fieldTop.addColorStop(1,'rgba(150,195,255,0)');

  G.fieldBottom = ctx.createLinearGradient(0,y+h*.6,0,y+h);
  G.fieldBottom.addColorStop(0,'rgba(0,0,0,0)');
  G.fieldBottom.addColorStop(1,'rgba(0,0,0,.44)');

  G.vig = ctx.createRadialGradient(W/2,H*.45,Math.min(W,H)*.30, W/2,H*.48,Math.max(W,H)*.78);
  G.vig.addColorStop(0,'rgba(0,0,0,0)');
  G.vig.addColorStop(1,'rgba(0,0,0,.5)');
}

