/* =========================================================
   7b. 双摇杆
   =========================================================
   左：只认横向位移，控制炮台左右移动；上下拖动完全忽略。
   右：往下拉 = 往上打（方向与拉动方向相反），拉的距离 = 蓄力，松手发射。
   两个摇杆各自 setPointerCapture，可以同时操作（边移动边瞄准）。

   手感要点（都是实测调出来的）：
   1) 以「按下那一点」为原点，而不是摇杆圆心。
      用圆心当原点时，手指按在摇杆边缘会瞬间产生大偏移——一按就满蓄力、方向乱跳，
      这就是之前"迟钝/不跟手"的根源。
   2) 死区小（0.07）：一开始推就给反馈，不用先推掉一大段空行程。
   3) 蓄力曲线略微前移（×1.1）：拉满更容易，不用把手指顶到边。
   4) 装填中松手不再白费：记下来，装填一结束立刻补发。
   ========================================================= */
var STICK_DEAD = 0.06;    /* 死区：手指微抖不算输入（0.07 → 0.06，轻微放宽） */
var STICK_TRAVEL = 0.26;  /* 推到底需要的位移 = 摇杆直径 × 该比例（越小越省力） */

function bindStick(el, opts){
  if(!el) return;
  var pid = null, ax = 0, ay = 0, maxR = 1;
  var knob = el.querySelector('.knob');

  function paint(dx, dy, mag){
    /* 右摇杆的蓄力用一圈环形进度表示，手指不用离开也能看见蓄了多少 */
    if(!opts.horizontal) el.style.setProperty('--p', Math.max(0, Math.min(1, mag)).toFixed(3));
    if(knob){
      /* 左摇杆纵向钉死，视觉上也只走横向，避免误导 */
      var ky = opts.horizontal ? 0 : dy;
      knob.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + ky.toFixed(1) + 'px)';
    }
    el.classList.toggle('hot', mag >= 0.92);
  }

  function handle(e){
    var dx = e.clientX - ax;
    var dy = e.clientY - ay;
    if(opts.horizontal) dy = 0;
    var len = Math.hypot(dx, dy);
    if(len > maxR){
      dx = dx / len * maxR;
      dy = dy / len * maxR;
      len = maxR;
    }
    var mag = maxR > 0 ? len / maxR : 0;
    paint(dx, dy, mag);
    opts.onMove(maxR > 0 ? dx / maxR : 0, maxR > 0 ? dy / maxR : 0, mag);
  }

  function begin(e){
    Sound.init(); Sound.resume();
    if(state.mode !== 'play' || state.paused) return;
    var r = el.getBoundingClientRect();
    if(!r.width) return;
    /* 关键：锚点 = 按下位置，不是圆心 */
    ax = e.clientX;
    ay = e.clientY;
    maxR = r.width * (opts.travel || STICK_TRAVEL);
    pid = e.pointerId;
    el.classList.add('active');
    try{ el.setPointerCapture(pid); }catch(err){}
    handle(e);
    e.preventDefault();
  }

  function move(e){
    if(pid === null || e.pointerId !== pid) return;
    handle(e);
    e.preventDefault();
  }

  function end(e){
    if(pid === null) return;
    if(e && e.pointerId !== undefined && e.pointerId !== pid) return;
    pid = null;
    el.classList.remove('active');
    el.classList.remove('hot');
    if(knob) knob.style.transform = '';
    if(opts.onEnd) opts.onEnd();
    if(e) e.preventDefault();
  }

  el.addEventListener('pointerdown', begin);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

function bindSticks(){
  /* ---- 左摇杆：只取横向 ---- */
  bindStick($id('stickL'), {
    horizontal: true,
    travel: 0.18,                 /* 左摇杆要更跟手：到满速只要推 18% 直径 */
    onMove: function(nx){
      if(state.stunT > 0){ state.stickX = 0; return; }
      /* 手机自带浏览器上原来要推很大一段才动，手感发闷。
         这里把死区外的输入重新映射到 0~1，并用 0.78 次方轻微加速：
         轻轻一推就能走，推到底也还是满速，不会变得乱窜。 */
      var t = Math.abs(nx);
      if(t <= STICK_DEAD){ state.stickX = 0; return; }
      var k = Math.min(1, (t - STICK_DEAD) / (1 - STICK_DEAD));
      var v = Math.pow(k, 0.72);   /* 0.78 → 0.72：中段更跟手，推到底仍是满速 */
      state.stickX = nx < 0 ? -v : v;
    },
    onEnd: function(){ state.stickX = 0; }
  });

  /* ---- 右摇杆：下拉蓄力，松手发射 ---- */
  bindStick($id('stickR'), {
    horizontal: false,
    onMove: function(nx, ny, mag){
      if(state.mode !== 'play' || state.paused || state.stunT > 0) return;
      var a = state.aim;
      /* 玩家重新开始拉杆：之前排队的那一发作废，避免补发出手方向对不上 */
      if(mag > STICK_DEAD) state.pendingShot = null;
      a.active = mag > STICK_DEAD;
      /* 蓄力略微前移，拉满更省力 */
      a.power = mag <= STICK_DEAD ? 0 : clamp(mag * 1.1, 0, 1);
      a.pull = Math.min(168, view.w*0.44) * a.power;
      if(mag > STICK_DEAD){
        var l = Math.hypot(nx, ny);
        if(l > 0.001){ a.dx = -nx/l; a.dy = -ny/l; }   /* 取反：往哪边拉，奶球就往反方向飞 */
        a.moved = true;
      }
    },
    onEnd: function(){
      var a = state.aim;
      if(!a.active || state.stunT > 0) { a.active = false; a.power = 0; return; }
      if(a.power >= 0.12){
        if(state.reloadT <= 0.02){
          fireBall();
        } else {
          /* 装填中松手：记下来，装填结束立刻补发，不让这一次输入白费 */
          state.pendingShot = { dx: a.dx, dy: a.dy, power: a.power };
          a.active = false;
          a.power = 0;
        }
      } else {
        a.active = false;
        a.power = 0;
      }
    }
  });
}
