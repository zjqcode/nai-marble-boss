/* =========================================================
   12.5 道具 / BUFF
   ========================================================= */
function spawnItem(){
  if(state.mode !== 'play' || state.items.length >= 2) return;
  var r = Math.random();
  var kind = r < 0.55 ? 'super' : (r < 0.8 ? 'shield' : 'frenzy');
  state.items.push({
    kind: kind,
    x: rand(view.left + view.w*0.16, view.right - view.w*0.16),
    y: rand(arenaY(0.38), arenaY(0.85)),
    r: 15*view.s, ph: rand(0,TAU), got: 0
  });
}

function updateItems(dt){
  if(state.mode !== 'play' || state.cineT > 0) return;

  /* 道具生成的反弹板 / 传送阵倒计时 */
  for(var pi=state.plates.length-1;pi>=0;pi--){
    var pl = state.plates[pi];
    pl.life -= dt;
    if(pl.hit > 0) pl.hit = Math.max(0, pl.hit - dt);
    if(pl.life <= 0){
      burst(pl.x, pl.y, 14, 10, 4, '#aef3d4');
      state.plates.splice(pi,1);
    }
  }
  for(var qi=state.portals.length-1;qi>=0;qi--){
    var po = state.portals[qi];
    if(po.life === undefined) continue;   /* 关卡自带的传送门不过期 */
    po.life -= dt;
    if(po.life <= 0){
      ring(po.x, po.y, po.r, po.r*0.2, '190,150,255', .4, 3);
      state.portals.splice(qi,1);
    }
  }
  /* 落单的传送门（同 pair 另一半已过期）直接移除 */
  for(var oi=state.portals.length-1;oi>=0;oi--){
    if(!portalExit(state.portals[oi])) state.portals.splice(oi,1);
  }

  state.itemTimer -= dt;
  if(state.itemTimer <= 0){
    state.itemTimer = rand(9, 14);
    spawnItem();
  }
  for(var i=state.items.length-1;i>=0;i--){
    var it = state.items[i];
    for(var j=0;j<state.balls.length;j++){
      var b = state.balls[j];
      if(b.dead) continue;
      if(Math.hypot(b.x-it.x, b.y-it.y) < it.r + b.r*0.85){
        collectItem(it);
        state.items.splice(i,1);
        break;
      }
    }
  }
}

function collectItem(it){
  if(it.kind === 'super'){
    state.superT = 10;
    refreshLoadLevel();
    popText(view.cx, view.pouchY-58, '变身超级奶娃！', 20, '#fff2b0');
    ring(view.cx, view.pouchY, 30, 150, '255,220,120', .7, 5);
    state.flash = Math.max(state.flash, .3);
    Sound.upgrade();
  } else if(it.kind === 'shield'){
    state.shield = 1;
    popText(view.cx, view.pouchY-58, '奶瓶护盾 +1', 17, '#cfe9ff');
    Sound.shield();
  } else {
    state.frenzyT = 8;
    popText(view.cx, view.pouchY-58, '狂暴！伤害翻倍', 18, '#ffb0a0');
    state.flash = Math.max(state.flash, .25);
    Sound.upgrade();
  }
  burst(it.x, it.y, 18, 18, 6, '#ffe9b0');
  ring(it.x, it.y, 12, 80, '255,230,170', .5, 4);
  state.score += 50;
  updateScore();
  updateBuffs();
}

function updateBuffs(){
  var el = $id('buffs');
  if(!el) return;
  var html = '';
  if(state.superT > 0) html += '<span class="buff-chip">超级奶娃 ' + Math.ceil(state.superT) + 's</span>';
  if(state.frenzyT > 0) html += '<span class="buff-chip frenzy">狂暴 ' + Math.ceil(state.frenzyT) + 's</span>';
  if(state.shield > 0) html += '<span class="buff-chip shield">奶瓶护盾 ×' + state.shield + '</span>';
  if(state.fireT > 0) html += '<span class="buff-chip fire">火焰 ' + Math.ceil(state.fireT) + 's</span>';
  if(state.plates.length){
    var pleft = 0;
    for(var qi=0;qi<state.plates.length;qi++) pleft = Math.max(pleft, state.plates[qi].life);
    html += '<span class="buff-chip plate">反弹板 ' + Math.ceil(pleft) + 's</span>';
  }
  if(state.boss && state.boss.brkT > 0) html += '<span class="buff-chip brk">破防 ' + state.boss.brkT.toFixed(1) + 's</span>';
  if(state.dodgeStreak > 0) html += '<span class="buff-chip dodge">闪避 ×' + state.dodgeStreak + '</span>';
  if(el.innerHTML !== html) el.innerHTML = html;
}

/* ---------- 奶瓶商店 / 消耗品 ---------- */
function itemCount(k){ return (META.items && META.items[k]) | 0; }

function buildShop(){
  var el = $id('shopList');
  if(!el) return;
  var sm = $id('shopMilk');
  if(sm) sm.textContent = fmt(META.milk);
  var html = '';
  for(var i=0;i<SHOP_ITEMS.length;i++){
    var it = SHOP_ITEMS[i];
    var n = itemCount(it.key);
    html += '<div class="shop-card"><div class="shop-ico">' + it.ico + '</div>';
    html += '<div class="shop-body"><b>' + it.n + ' <i>已拥有 ×' + n + '</i></b><p>' + it.d + '</p></div>';
    html += '<button class="shop-buy' + (META.milk < it.cost ? ' poor' : '') + '" data-buy="' + it.key + '">' + it.cost + ' 奶瓶</button></div>';
  }
  el.innerHTML = html;
}

function openShop(){
  openScreen('shop');
  buildShop();
}

function updateItemBar(){
  var bar = $id('itemBar');
  if(!bar) return;
  var html = '';
  for(var i=0;i<SHOP_ITEMS.length;i++){
    var it = SHOP_ITEMS[i];
    /* 有自己专用按钮的道具不进通用道具栏，避免两个入口（由数据标记，不硬编码 key） */
    if(it.ownButton) continue;
    var n = itemCount(it.key);
    if(n > 0){
      html += '<button class="item-btn" data-item="' + it.key + '" aria-label="' + it.n + ' ×' + n + '" title="' + it.n + ' ×' + n + '">' +
        it.ico + '<b>' + n + '</b></button>';
    }
  }
  if(bar.innerHTML !== html) bar.innerHTML = html;
  refreshItemBtnStates();
  refreshPlateBtn();
}

/* 血瓶在「满血 / 冷却中 / 非战斗中」显示为不可用，避免玩家白点 */
function potionUsable(){
  return state.mode === 'play' && !state.paused && state.cineT <= 0 &&
         state.heroHP < state.maxHP && state.potionCd <= 0;
}
function refreshItemBtnStates(){
  var bar = $id('itemBar');
  if(!bar) return;
  var pb = bar.querySelector('[data-item="potion"]');
  if(!pb) return;
  var off = !potionUsable();
  if(pb._off !== off){
    pb._off = off;
    pb.classList.toggle('off', off);
    pb.setAttribute('aria-disabled', off ? 'true' : 'false');
  }
}

/* 反弹板专用按钮：数量 / 可用状态 / 放置中高亮。
   只负责把状态画到按钮上；「离开战斗时取消放置」是状态机的职责，
   放在 15-loop.js 的 update 里做——别让一个 refresh 函数偷偷改状态。 */
function refreshPlateBtn(){
  var btn = $id('bPlate');
  if(!btn) return;
  var n = itemCount('plate');
  var cnt = $id('plateCount');
  if(cnt) cnt.textContent = n;
  var placing = !!state.placingPlate;
  /* 没有存货就整个按钮都不出现——一个「0」的空按钮既占地方又难看 */
  var empty = n <= 0 && !placing;
  if(btn._empty !== empty){ btn._empty = empty; btn.classList.toggle('empty', empty); }
  var off = !placing && (n <= 0 || state.mode !== 'play' || state.paused || state.cineT > 0);
  if(btn._off !== off){ btn._off = off; btn.classList.toggle('off', off); }
  if(btn._arm !== placing){ btn._arm = placing; btn.classList.toggle('arm', placing); }
}

/* 道具通用演出：全屏环 + 名字 + 闪光，解决「买了没特效」 */
function itemFanfare(name, color, rgb){
  popText(view.cx, view.pouchY - 96, name, 21, color);
  ring(view.cx, view.pouchY, 30, view.w*1.1, rgb, .7, 5);
  ring(view.cx, view.pouchY, 16, view.w*0.6, '255,255,255', .4, 3);
  state.flash = Math.max(state.flash, .3);
  state.shake = Math.max(state.shake, 8);
  cssShake('s');
  try{ if(navigator.vibrate) navigator.vibrate(20); }catch(e){}
}

/* =========================================================
   道具效果注册表
   =========================================================
   加新道具只需要两步：
     1) 在 02-save.js 的 SHOP_ITEMS 里加一条（名称/图标/价格/说明）
     2) 在下面 ITEM_USE 里注册同名的效果函数
   handler 返回 false 表示「这次没生效，不该扣道具」（冷却中 / 满血 / 只是进入放置模式）。
   扣道具、存档、刷新界面统一由 useItem 收尾，不在每个分支里重复写。
   ========================================================= */
var ITEM_USE = {

  /* 血瓶：只在受伤时可用，一次回 1 心，0.5 秒冷却防连点 */
  potion: function(){
    if(state.potionCd > 0) return false;
    if(state.heroHP >= state.maxHP) return false;
    healHero(1);
    state.potionCd = 0.5;
    popText(state.cannonX, view.pouchY - 92*view.s, '+1 心', 20, '#ffb3bb');
    ring(state.cannonX, view.pouchY - 34*view.s, 12, view.w*0.55, '255,150,160', .6, 4);
    burst(state.cannonX, view.pouchY - 34*view.s, 24, 20, 6, '#ffc4c9');
    state.flashHue = 'gold';
    state.flash = Math.max(state.flash, .22);
    Sound.shield();
  },

  multi: function(){
    var lv = state.loadLv;
    for(var k=0;k<5;k++){
      var ang = -Math.PI/2 + (k-2)*0.17;
      var bx = state.cannonX + Math.cos(ang)*8;
      var by = view.pouchY - 12 + Math.sin(ang)*4;
      var mb = makeBall(bx, by, lv, Math.cos(ang)*880, Math.sin(ang)*880);
      mb.ghost = 0.22;   /* 5 颗同级球挤在一起，不穿透会当场互相合体 */
      state.balls.push(mb);
      burst(bx, by, 12, 6, lv, '#ffd98f');
    }
    Sound.launch(1);
    state.flashHue = 'gold';
    itemFanfare('多球发射！', '#ffe6a8', '255,220,150');
  },

  /* 反弹板：这里只进入放置模式，真正放下时才扣道具 */
  plate: function(){
    startPlatePlacement();
    return false;
  },

  portal: function(){
    /* 临时传送阵：带 life，用新 pair 编号避免和关卡自带的串门 */
    var pair = 1;
    for(var qi=0;qi<state.portals.length;qi++) pair = Math.max(pair, (state.portals[qi].pair|0) + 1);
    var r = 26*view.s;
    /* 与关卡自带传送门镜像，互不重叠 */
    var a = {x:view.right - view.w*0.13, y:arenaY(0.30), r:r, pair:pair, life:20};
    var b2 = {x:view.left + view.w*0.13, y:arenaY(0.78), r:r, pair:pair, life:20};
    state.portals.push(a, b2);
    ring(a.x, a.y, 4, r*2.4, '190,150,255', .6, 4);
    ring(b2.x, b2.y, 4, r*2.4, '190,150,255', .6, 4);
    burst(a.x, a.y, r, 16, 7, '#c9b6ff');
    burst(b2.x, b2.y, r, 16, 7, '#c9b6ff');
    Sound.portal(false);
    itemFanfare('传送阵开启！', '#d2c2ff', '190,150,255');
  },

  fire: function(){
    var boss = state.boss;
    state.fireT = 8;
    if(boss && !boss.dead){
      popText(boss.x, boss.y - boss.h*.5, '火焰灼烧！', 18, '#ffb070');
      burst(boss.x, boss.y, boss.w*.5, 26, 8, '#ff8a3a');
      ring(boss.x, boss.y, boss.w*.2, boss.w*1.5, '255,140,60', .6, 5);
    }
    Sound.upgrade();
    state.flashHue = 'gold';
    itemFanfare('火焰灼烧 · 伤害 +50%', '#ffc090', '255,150,70');
  },

  thunder: function(){
    var boss = state.boss;
    if(boss && !boss.dead){
      for(var s=-1;s<=1;s++){
        var tx = clamp(boss.x + s*view.w*0.10, view.left+20, view.right-20);
        addBolt(tx, view.top, tx + rand(-14,14), view.bottom);
        damageBossRaw(tx, boss.y, 60, true, 8);
        if(!boss.dead) addBreak(90, tx, boss.y);
      }
    } else {
      for(var s2=-1;s2<=1;s2++){
        var tx2 = clamp(view.cx + s2*view.w*0.10, view.left+20, view.right-20);
        addBolt(tx2, view.top, tx2 + rand(-14,14), view.bottom);
      }
    }
    state.slowmo = Math.max(state.slowmo, 0.25);
    state.shake = Math.max(state.shake, 16);
    cssShake('m');
    Sound.thunder(1);
    state.flashHue = 'blue';
    itemFanfare('雷电球！', '#cfe6ff', '170,214,255');
  },

  transform: function(){
    state.superT = 12;
    refreshLoadLevel();
    for(var ti=0;ti<3;ti++){
      ring(state.cannonX, view.pouchY, 20 + ti*14, view.w*(0.7 + ti*0.25), '255,220,120', .75 + ti*0.12, 6 - ti);
    }
    burst(state.cannonX, view.pouchY, 40, 40, 10, '#fff2b0');
    addBolt(state.cannonX, view.top, state.cannonX, view.pouchY);
    state.slowmo = Math.max(state.slowmo, 0.4);
    state.shake = Math.max(state.shake, 18);
    cssShake('m');
    Sound.transform();
    state.flashHue = 'gold';
    state.flash = Math.max(state.flash, .7);
    itemFanfare('变身超级奶娃！', '#fff2b0', '255,220,120');
  }
};

function useItem(key){
  /* 暂停 / 阵亡 / 过场中一律不可用 */
  if(state.mode !== 'play' || state.paused || state.cineT > 0) return;
  if(itemCount(key) <= 0) return;
  var handler = ITEM_USE[key];
  if(!handler) return;
  if(handler() === false) return;      /* 没生效就不扣道具 */
  META.items[key] = itemCount(key) - 1;
  saveMeta();
  updateItemBar();
  updateBuffs();
}

/* =========================================================
   反弹板：手动拖拽放置
   ========================================================= */
/* 轻微倾斜 + 短一些：横长板会直接把上行的球弹回去，反而挡住进攻 */
var PLATE_TILT = -0.30;
function plateLen(){ return Math.min(view.w*0.13, view.arenaH*0.18); }

function clampPlatePos(x, y){
  var half = plateLen()/2;
  var minX = view.left + half + 8;
  var maxX = view.right - half - 8;
  var minY = view.ceil + 30*view.s;
  var maxY = Math.max(minY + 20, view.pouchY - 96*view.s);
  return { x: clamp(x, Math.min(minX, maxX), Math.max(minX, maxX)),
           y: clamp(y, minY, maxY) };
}

function startPlatePlacement(){
  if(state.mode !== 'play' || state.paused || state.cineT > 0) return;
  if(state.placingPlate) return;
  if(itemCount('plate') <= 0){
    toast('没有反弹板，先去商店买一个（50 奶瓶）');
    return;
  }
  /* 放置优先于瞄准：取消正在拉的弹弓 */
  state.aim.active = false;
  state.aim.power = 0;
  var p = clampPlatePos(view.cx, arenaY(0.66));
  /* dragId / rotId：第一根手指定位，第二根手指调角度（360° 任意） */
  state.placingPlate = { x:p.x, y:p.y, ang:PLATE_TILT, dragging:false, dragId:null, rotId:null };
  document.body.classList.add('placing');
  refreshPlateBtn();
  toast('拖动定位 · 第二根手指旋转角度 · 松手放下');
  Sound.ui();
  try{ if(navigator.vibrate) navigator.vibrate(6); }catch(e){}
}

function movePlateTo(clientX, clientY){
  var pl = state.placingPlate;
  if(!pl) return;
  var p = clampPlatePos(clientX, clientY);
  pl.x = p.x;
  pl.y = p.y;
}

/* 第二根手指相对板心的方向 => 板的朝向。
   长轴与「板心->手指」垂直，也就是手指指向哪边，球就被往那边弹。吸附到 5° 便于微调。 */
var PLATE_ANG_STEP = Math.PI / 36;
function rotatePlateTo(clientX, clientY){
  var pl = state.placingPlate;
  if(!pl) return;
  var dx = clientX - pl.x, dy = clientY - pl.y;
  if(Math.hypot(dx, dy) < 14) return;          /* 离板心太近不判角度，防抖 */
  var a = Math.atan2(dy, dx) + Math.PI / 2;
  pl.ang = Math.round(a / PLATE_ANG_STEP) * PLATE_ANG_STEP;
}

/* 键盘 Q / E 微调角度（桌面端） */
function nudgePlateAngle(dir){
  var pl = state.placingPlate;
  if(!pl) return false;
  pl.ang += dir * (Math.PI / 12);
  return true;
}

function cancelPlatePlacement(silent){
  if(!state.placingPlate) return;
  state.placingPlate = null;
  document.body.classList.remove('placing');
  refreshPlateBtn();
  if(!silent) Sound.ui();
}

function confirmPlatePlacement(){
  var pl = state.placingPlate;
  if(!pl) return;
  var n = itemCount('plate');
  if(n <= 0){ cancelPlatePlacement(true); return; }
  state.plates.push({ x:pl.x, y:pl.y, ang:pl.ang, len:plateLen(), thick:5.5*view.s, life:8, hit:0 });
  META.items['plate'] = n - 1;
  saveMeta();
  ring(pl.x, pl.y, 6, plateLen()*1.3, '160,255,215', .55, 4);
  burst(pl.x, pl.y, 16, 14, 5, '#aef3d4');
  Sound.plate(1);
  popText(pl.x, pl.y - 24*view.s, '反弹板 · 8 秒', 15, '#b4f5da');
  cancelPlatePlacement(true);
  updateItemBar();
  updateBuffs();
}

