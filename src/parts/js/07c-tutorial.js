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

var tutEl = null, tutOn = false, tutStep = 0, tutStartX = 0, tutMoved = 0;

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
  var x = W * 0.5, y = H * 0.5, below = true;
  if(target === 'stickL' || target === 'stickR'){
    var s = document.getElementById(target);
    if(s){
      var r = s.getBoundingClientRect();
      x = r.left + r.width / 2;
      y = r.top;
      below = false;
    }
  } else if(target === 'boss' && state.boss){
    x = state.boss.x;
    y = view.arenaTop + 10;
    below = true;
  }
  var halfW = Math.min(210, W * 0.46);
  var left = Math.max(10, Math.min(W - halfW - 10, x - halfW));
  el.style.width = (halfW * 2) + 'px';
  el.style.left = left + 'px';
  /* 摇杆在上方 → 气泡放摇杆上面；否则放下方 */
  var cardH = 86;
  el.style.top = (below ? y + 14 : y - cardH - 16) + 'px';
  el.classList.toggle('up', !below);
}

function tutSetStep(n){
  tutStep = n;
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
  if(n === 0){ tutStartX = state.cannonX; tutMoved = 0; }
}

function tutStart(chapterIndex){
  if(chapterIndex !== 0 || tutSeen()) return;
  tutOn = true;
  tutSetStep(0);
}

function tutStop(done){
  tutOn = false;
  state.tutHold = false;
  if(tutEl) tutEl.classList.remove('show');
  if(done) tutDone();
}

/* 每帧调用：第 1 步靠位移判定 */
function tutMoveTick(){
  if(!tutOn || tutStep !== 0 || !state.boss) return;
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
