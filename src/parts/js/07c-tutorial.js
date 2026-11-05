/* =========================================================
   7c. 第一关 · 新手指引
   =========================================================
   只在「还没通关过教程」时，第一关开头给出 4 步引导：
     1 左摇杆 → 左右移动
     2 右摇杆 → 下拉蓄力、松手发射
     3 打 Boss 身上的发光弱点
     4 红区出现 → 用左摇杆躲开
   前两步期间 Boss 不攻击（state.tutHold），先把操作学会。
   完成或跳过都会写 localStorage，之后不再出现。
   ========================================================= */
var TUT_KEY = 'nai_tut_done';
var TUT_STEPS = [
  { target: 'stickL', text: '拖动左边摇杆，让奶娃左右跑', sub: '只能左右走，上下不动' },
  { target: 'stickR', text: '右边摇杆往下拉，松手发射', sub: '拉得越深，力气越大' },
  { target: 'boss',   text: '瞄准 Boss 身上两个发光圆点', sub: '打身体只有三成伤害' },
  { target: 'stickL', text: '红区亮起来时，用左摇杆躲开', sub: '站着不动会被砸中' }
];

var tutEl = null, tutOn = false, tutStep = 0, tutStartX = null, tutMoved = 0, tutElapsed = 0, tutHits = 0;
var TUT_STEP_TIMEOUT = 20;   /* 单步最多等 20 秒（游戏时间），卡住就自动往下走 */

function tutDone(){
  try{ localStorage.setItem(TUT_KEY, '1'); }catch(e){}
}
function tutSeen(){
  try{ return localStorage.getItem(TUT_KEY) === '1'; }catch(e){ return false; }
}

function tutBuild(){
  if(tutEl) return tutEl;
  var el = $id('coach');
  if(!el) return null;
  var skip = el.querySelector('.coach-skip');
  if(skip) skip.addEventListener('click', function(e){
    e.stopPropagation();
    tutStop(true);
    toast('已跳过教程，随时可以重玩第一关');
  });
  tutEl = el;
  return el;
}

function tutPlace(target){
  var el = tutBuild();
  if(!el) return;
  var W = window.innerWidth, H = window.innerHeight;
  var card = el.querySelector('.coach-card');
  el.style.width = '';
  var cw = card.offsetWidth || 220;
  var ch = card.offsetHeight || 70;
  var cx = W * 0.5, cy = H * 0.5;
  var arrowUp = true;                    /* true = 气泡在目标下方，箭头朝上 */
  var top, left;

  if(target === 'stickL' || target === 'stickR'){
    var s = document.getElementById(target);
    if(s){
      var r = s.getBoundingClientRect();
      cx = r.left + r.width / 2;
      /* 摇杆贴底：气泡放上方，箭头朝下 */
      top = Math.max(8, r.top - ch - 14);
      arrowUp = false;
    }
  } else if(target === 'boss' && state.boss){
    var b = state.boss;
    cx = b.x;
    /* 关键：放到 Boss 下沿再往下一点，别压住立绘 */
    top = Math.min(H - ch - 10, b.y + b.h * 0.5 + 12);
    arrowUp = true;
  }
  if(top === undefined){
    top = Math.max(8, Math.min(H - ch - 10, cy - ch / 2));
  }
  left = Math.max(8, Math.min(W - cw - 8, cx - cw / 2));

  el.style.left = left + 'px';
  el.style.top = top + 'px';
  el.classList.toggle('up', arrowUp);
  el.style.setProperty('--arrow-x', Math.round(cx - left) + 'px');
}

function tutSetStep(n){
  tutStep = n;
  tutElapsed = 0;
  if(n >= TUT_STEPS.length){ tutStop(true); return; }
  var st = TUT_STEPS[n];
  var el = tutBuild();
  if(!el) return;
  el.classList.add('show');
  el.querySelector('.coach-step').textContent = (n + 1) + '/' + TUT_STEPS.length;
  el.querySelector('.coach-text').textContent = st.text;
  el.querySelector('.coach-sub').textContent = st.sub || '';
  tutPlace(st.target);
  state.tutHold = (n <= 1);   /* 前两步 Boss 先别打人 */
  if(n === 0){ tutStartX = null; tutMoved = 0; }   /* 待第一帧再取基准（见 tutMoveTick） */
}

function tutStart(chapterIndex, force){
  if(chapterIndex !== 0) return;
  if(!force && tutSeen()) return;
  tutOn = true;
  tutSetStep(0);
}

function tutStop(done){
  var wasOn = tutOn;
  tutOn = false;
  state.tutHold = false;
  if(tutEl) tutEl.classList.remove('show');
  if(done) tutDone();
  if(done && wasOn) toast('演习完成！照着这个打法继续打 Boss 吧');
}

/* 每帧调用：第 1 步靠位移判定 */
function tutMoveTick(dt){
  if(!tutOn) return;
  if(state.paused || state.mode !== 'play') return;   /* 暂停/切后台不计时 */
  /* 兜底：某一步 20 秒还没完成就自动推进，避免新手卡死在某一步 */
  tutElapsed += (dt || 0);
  if(tutElapsed > TUT_STEP_TIMEOUT){
    if(tutStep < TUT_STEPS.length - 1) tutSetStep(tutStep + 1);
    else tutStop(true);
    return;
  }
  if(tutStep !== 0 || !state.boss) return;
  /* 基准位置在第一帧才取：避开 startLevel 里「先 tutStart、后摆炮台」的顺序问题 */
  if(tutStartX === null){ tutStartX = state.cannonX; return; }
  var d = Math.abs(state.cannonX - tutStartX);
  if(d > 50){
    if(tutMoved === 0) tutMoved = 1;
    tutSetStep(1);
  }
}

function tutOnFire(){
  if(!tutOn || tutStep !== 1) return;
  tutSetStep(2);
}

function tutOnWeak(){
  if(!tutOn || tutStep !== 2) return;
  tutSetStep(3);
}

/* 命中 Boss 任意位置：打不中弱点的话，累计 4 下也算过关，避免卡死 */
function tutOnBossHit(weak){
  if(!tutOn || tutStep !== 2) return;
  tutHits++;
  if(weak || tutHits >= 4) tutSetStep(3);
}

function tutOnTelegraph(){
  if(!tutOn || tutStep !== 3) return;
  var el = tutBuild();
  if(!el) return;
  el.querySelector('.coach-text').textContent = '红区亮了！快用左摇杆走出去';
  el.querySelector('.coach-sub').textContent = '走出去就安全，不用跳';
  tutPlace('stickL');
}

function tutOnAttackResolved(hit){
  if(!tutOn || tutStep !== 3) return;
  if(hit) return;                      /* 被砸到就再教一次 */
  tutSetStep(4);
}
