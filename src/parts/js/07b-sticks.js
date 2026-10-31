/* =========================================================
   7b. 双摇杆
   =========================================================
   左：只认横向位移，控制炮台左右移动；上下拖动完全忽略（不是"移动变慢"，是无效）。
   右：推杆方向 = 发射方向，推杆距离 = 蓄力，松手发射。
       和原来的"按住下拉"相反——摇杆的直觉是往哪推就往哪打。
   两个摇杆互不干扰：各自 setPointerCapture，可以同时操作（边移动边瞄准）。
   ========================================================= */
var STICK_DEAD = 0.14;   /* 死区：手指微抖不算输入 */

function bindStick(el, opts){
  if(!el) return;
  var pid = null, cx = 0, cy = 0, maxR = 1;
  var knob = el.querySelector('.knob');

  function paint(nx, ny, mag){
    if(knob){
      /* 左摇杆的纵向位移被钉死，视觉上也只走横向，避免误导 */
      var ky = opts.horizontal ? 0 : ny;
      knob.style.transform = 'translate(' + (nx*maxR).toFixed(1) + 'px,' + (ky*maxR).toFixed(1) + 'px)';
    }
    el.classList.toggle('hot', mag >= 0.92);
  }

  function handle(e){
    var dx = e.clientX - cx;
    var dy = opts.horizontal ? 0 : e.clientY - cy;
    var len = Math.hypot(dx, dy);
    if(len > maxR){
      dx = dx / len * maxR;
      dy = dy / len * maxR;
      len = maxR;
    }
    var mag = maxR > 0 ? len / maxR : 0;
    paint(maxR > 0 ? dx / maxR : 0, maxR > 0 ? dy / maxR : 0, mag);
    opts.onMove(maxR > 0 ? dx / maxR : 0, maxR > 0 ? dy / maxR : 0, mag);
  }

  function begin(e){
    Sound.init(); Sound.resume();
    if(state.mode !== 'play' || state.paused) return;
    var r = el.getBoundingClientRect();
    if(!r.width) return;
    cx = r.left + r.width / 2;
    cy = r.top + r.height / 2;
    maxR = r.width * 0.30;          /* 推到底时摇杆头刚好贴住外圈内沿 */
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
    onMove: function(nx){
      state.stickX = Math.abs(nx) < STICK_DEAD ? 0 : clamp(nx, -1, 1);
    },
    onEnd: function(){ state.stickX = 0; }
  });

  /* ---- 右摇杆：下拉蓄力，松手发射 ----
     方向与拉动方向**相反**：下拉 -> 往上打，左拉 -> 往右打。
     和场地里的弹弓拖动一致（都是往反方向拉），手感也顺：拇指自然停在底部，
     往下拉最省力，想往上打不用把手够到屏幕顶上。 */
  bindStick($id('stickR'), {
    horizontal: false,
    onMove: function(nx, ny, mag){
      if(state.mode !== 'play' || state.paused) return;
      var a = state.aim;
      var maxPull = Math.min(168, view.w*0.44);
      a.active = mag > STICK_DEAD;
      a.power = mag <= STICK_DEAD ? 0 : clamp(mag, 0, 1);
      a.pull = mag * maxPull;
      if(mag > STICK_DEAD){
        var l = Math.hypot(nx, ny);
        if(l > 0.001){ a.dx = -nx/l; a.dy = -ny/l; }   /* 取反：往哪边拉，奶球就往反方向飞 */
        a.moved = true;
      }
    },
    onEnd: function(){
      var a = state.aim;
      if(!a.active) return;
      /* 装填中松手不算发射，但要清掉瞄准态，否则预测线会一直挂着 */
      if(a.power >= 0.12 && state.reloadT <= 0.02){
        fireBall();
      } else {
        a.active = false;
        a.power = 0;
      }
    }
  });
}
