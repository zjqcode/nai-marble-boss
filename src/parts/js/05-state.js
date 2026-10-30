/* =========================================================
   5. 运行状态
   ========================================================= */
var state = {
  mode: 'intro',
  paused: false,
  chapter: null,
  chapterIndex: 0,
  boss: null,
  balls: [],
  rocks: [],
  coins: [],
  parts: [],
  pops: [],
  rings: [],
  bolts: [],
  beams: [],
  springFx: [],
  mergeQ: [],
  score: 0,
  combo: 0,
  comboT: 0,
  timer: 0,
  timeMax: 1,
  atkTimer: 0,
  atkEvery: 9,
  telegraph: null,
  suck: null,
  beam: null,
  atkIndex: 0,
  aim: {active:false, sx:0, sy:0, px:0, py:0, dx:0, dy:-1, power:0, pull:0},
  loadLv: 0,
  reloadT: 0,
  reloadMax: 0.42,
  eff: null,
  shake: 0,
  flash: 0,
  bootT: 0,
  uiT: 0,
  runMilk: 0,
  hits: 0,
  maxLv: 0,
  springs: [],
  portals: [],
  warn: false,
  victoryT: 0,
  result: null,
  startAt: 0,
  usedTime: 0,
  lowTimeWarned: false,
  heroHP: 5,
  maxHP: 5,
  heroDmg: 1,
  potionCd: 0,        /* 血瓶冷却，防止连点 */
  shield: 0,
  superT: 0,
  frenzyT: 0,
  items: [],
  itemTimer: 9,
  interrupt: 0,
  interruptNeed: 0,
  stun: 0,
  atkAnim: null,
  gasT: 0,
  fireT: 0,
  cineT: 0,
  bumpers: [],
  dust: [],
  trails: [],
  plates: [],
  placingPlate: null,   /* 反弹板拖拽放置中的预览 {x,y,ang,dragging} */
  ceilFx: [],
  cannonX: 0, moveDir: 0, atkDmg: 1, dodgeStreak: 0,
  slowmo: 0,
  flashHue: 'blue',
  comboQ: 0, comboT2: 0,
  deadReason: ''
};

function formatTime(sec){
  sec = Math.max(0, Math.ceil(sec));
  var m = Math.floor(sec/60), s = sec%60;
  return (m<10?'0':'') + m + ':' + (s<10?'0':'') + s;
}
function addMilk(n){
  n = Math.round(n);
  if(n <= 0) return;
  META.milk += n;
  state.runMilk += n;
  updateMilkHUD();
  saveMetaSoon();
}
function updateMilkHUD(){
  var el = $id('milk');
  if(el) el.textContent = fmt(META.milk);
  var gm = $id('galMilk');
  if(gm) gm.textContent = fmt(META.milk);
}
function updateScore(){
  var el = $id('score');
  var txt = fmt(state.score);
  if(el.textContent !== txt){
    el.textContent = txt;
    el.style.fontSize = txt.length > 9 ? '18px' : (txt.length > 6 ? '21px' : '');
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
    clearTimeout(el._t);
    el._t = setTimeout(function(){ el.classList.remove('pop'); }, 140);
  }
}

