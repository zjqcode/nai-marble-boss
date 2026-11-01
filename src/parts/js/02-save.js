/* =========================================================
   2. 存档 / 养成
   ========================================================= */
var META = {milk:0, progress:0, unlocked:{}, lv:{}, best:0};

function loadMeta(){
  var raw = store('nai_boss_meta');
  var hadSave = !!raw;
  if(raw){
    try{
      var o = JSON.parse(raw);
      if(o && typeof o === 'object'){
        META.milk = Math.max(0, o.milk|0) || 0;
        META.progress = clamp(o.progress|0, 0, CHAPTERS.length);
        META.best = Math.max(0, o.best|0) || 0;
        META.lv = (o.lv && typeof o.lv === 'object') ? o.lv : {};
        META.unlocked = (o.unlocked && typeof o.unlocked === 'object') ? o.unlocked : {};
        META.shop = (o.shop && typeof o.shop === 'object') ? o.shop : {};
        META.items = (o.items && typeof o.items === 'object') ? o.items : {};
      }
    }catch(e){}
  }
  DEFAULT_UNLOCKED.forEach(function(n){ META.unlocked[n] = 1; });
  CHARS.forEach(function(c){ if(!META.lv[c.n]) META.lv[c.n] = 1; });
  /* 首次运行或旧存档没有这两个字段时兜底，useItem 直接写 META.items 不会再抛 */
  if(!META.shop || typeof META.shop !== 'object') META.shop = {};
  if(!META.items || typeof META.items !== 'object') META.items = {};

  /* 新玩家礼包：真·新存档（没有任何存档，或存档里一点进度都没有）才送 500 奶瓶。
     老玩家（有进度/奶瓶/最高分/已解锁角色）不发。 */
  /* 只有「完全没有存档」才算新玩家：存档损坏/老版本空存档都不白送 */
  var isFresh = !hadSave && !META.starterGift && META.milk === 0;
  if(isFresh){
    META.milk += 500;
    META.starterGift = 1;
    saveMeta();
    setTimeout(function(){ toast('新玩家礼包 +500 奶瓶 🍼'); }, 900);
  }
}
function saveMeta(){
  try{
    store('nai_boss_meta', JSON.stringify({
      milk: META.milk, progress: META.progress, best: META.best,
    starterGift: META.starterGift || 0, bestEndless: META.bestEndless || 0,
      unlocked: META.unlocked, lv: META.lv,
      shop: META.shop, items: META.items
    }));
  }catch(e){}
}
var saveTimer = null;
function saveMetaSoon(){
  if(saveTimer) return;
  saveTimer = setTimeout(function(){ saveTimer = null; saveMeta(); }, 1200);
}

function isUnlocked(name){ return !!META.unlocked[name]; }
function charLv(name){ return META.lv[name] || 1; }

/* 奶瓶商店：消耗品，买一次用一次，局内点击左下道具栏使用 */
var SHOP_ITEMS = [
  {key:'potion',    n:'血瓶',       ico:'❤', cost:30, d:'回复 1 颗心。受伤时才可用，满血 / 暂停 / 已阵亡时不可用'},
  {key:'multi',     n:'多球发射',   ico:'✹', cost:40, d:'立刻扇形发射 5 颗当前等级奶球'},
  {key:'plate',     n:'反弹板',     ico:'▰', cost:50, ownButton:true, d:'按右侧「反弹板」按钮，拖到空处松手放下，8 秒内反复折射'},
  {key:'time',      n:'加时奶糖',   ico:'⏱', cost:50, max:6, d:'关卡时间 +10 秒。可叠加，最多持有 6 个'},
  {key:'fire',      n:'火焰灼烧',   ico:'🔥', cost:60, d:'8 秒内所有伤害 +50%，奶球附带火焰'},
  {key:'portal',    n:'传送阵',     ico:'◎', cost:70, d:'任何关卡临时开启一对传送阵，持续 20 秒'},
  {key:'thunder',   n:'雷电球',     ico:'⚡', cost:80, d:'召唤 3 道雷击，高额伤害并大幅积累破防'},
  {key:'transform', n:'变身超级奶娃', ico:'✦', cost:90, d:'立刻变身 12 秒：发射等级 +3、伤害 ×1.8'}
];
function shopItem(key){
  for(var i=0;i<SHOP_ITEMS.length;i++) if(SHOP_ITEMS[i].key === key) return SHOP_ITEMS[i];
  return null;
}
function heroBonus(){
  var total = 0;
  for(var i=0;i<CHARS.length;i++){
    var lv = META.lv[CHARS[i].n] || 1;
    total += Math.max(1, lv|0);
  }
  var n = Math.max(0, total - CHARS.length);
  return {n:n, hp:Math.min(5, n), dmg:1 + Math.min(0.5, n*0.03)};
}
function charByName(name){
  for(var i=0;i<CHARS.length;i++) if(CHARS[i].n === name) return CHARS[i];
  return null;
}
function skillRaw(c, lv){
  if(c.key === 'startLv') return Math.min(5, lv);
  if(c.key === 'extraBalls') return Math.min(5, lv);
  var v = c.base * lv;
  if(c.unit === '%') return v;
  return v;
}
function skillText(c, lv){
  var v = skillRaw(c, lv);
  if(c.key === 'startLv') return '开局 ' + (1+v) + ' 级';
  if(c.key === 'extraBalls') return '赠 ' + v + ' 颗 2 级球';
  if(c.unit === '%') return '+' + Math.round(v*100) + '%';
  return '+' + v;
}
function upgradeCost(lv){ return lv >= 5 ? 0 : UP_COST[lv-1]; }

function buildEff(){
  var e = {
    startLv:0, milk:1, power:1, reload:1, ballSpeed:1, bossDmg:1,
    crit:0, attackDelay:1, extraBalls:0, dmgAll:1
  };
  for(var i=0;i<CHARS.length;i++){
    var c = CHARS[i];
    if(!isUnlocked(c.n)) continue;
    var lv = charLv(c.n);
    var v = skillRaw(c, lv);
    if(c.key === 'startLv') e.startLv = Math.max(e.startLv, v);
    else if(c.key === 'milk') e.milk += v;
    else if(c.key === 'power') e.power += v;
    else if(c.key === 'reload') e.reload += v;
    else if(c.key === 'ballSpeed') e.ballSpeed += v;
    else if(c.key === 'bossDmg') e.bossDmg += v;
    else if(c.key === 'attackDelay') e.attackDelay += v;
    else if(c.key === 'dmgAll') e.dmgAll += v;
    else if(c.key === 'crit') e.crit += v;
    else if(c.key === 'extraBalls') e.extraBalls += v;
  }
  e.extraBalls = Math.min(3, e.extraBalls);
  e.crit = Math.min(0.45, e.crit);
  return e;
}

