/* =========================================================
   7. 发射
   ========================================================= */
function updateAimVectors(){
  var a = state.aim;
  var dx = a.sx - a.px;
  var dy = a.sy - a.py;
  var len = Math.hypot(dx, dy);
  var maxPull = Math.min(168, view.w*0.44);
  a.pull = Math.min(len, maxPull);
  a.power = clamp(len/maxPull, 0, 1);
  if(len > 6){ a.dx = dx/len; a.dy = dy/len; }
}

function fireBall(){
  if(state.mode !== 'play' || state.paused || state.cineT > 0) return;
  if(state.reloadT > 0.02) return;
  var a = state.aim;
  if(!a.active || a.power < 0.1){
    a.active = false;
    a.power = 0;
    return;
  }
  a.active = false;
  var lv = state.loadLv;
  var r = RADII[lv];
  var speed = (640 + 860*a.power) * state.eff.power * state.eff.ballSpeed;
  var ox = state.cannonX - a.dx*a.pull*0.22;
  var oy = view.pouchY - a.dy*a.pull*0.22;
  var px = ox + a.dx*(r+8);
  var py = oy + a.dy*(r+8);
  var b = makeBall(px, py, lv, a.dx*speed, a.dy*speed);
  /* 刚出膛的球短暂穿过其他球，不会在发射口被场上的球直接挡死 */
  b.ghost = 0.16;
  state.balls.push(b);
  refreshLoadLevel();
  state.reloadT = state.reloadMax;
  state.aim.power = 0;
  Sound.launch(a.power);
  try{ if(navigator.vibrate) navigator.vibrate(8); }catch(e){}
  burst(px, py, r*0.7, 8, lv, '#ffd98f');
  state.springFx.push({x:px, y:py, r:r*1.4, t:0, span:0.3, color:'255,220,150'});
  state.shake = Math.max(state.shake, 2.5 + a.power*4);
  if(state.balls.length > 20){
    var idx = -1, best = 1e9;
    for(var i=0;i<state.balls.length;i++){
      var bb = state.balls[i];
      if(bb === b) continue;
      if(bb.lv < best){ best = bb.lv; idx = i; }
    }
    if(idx >= 0){
      var old = state.balls[idx];
      burst(old.x, old.y, old.r, 6, old.lv);
      state.balls.splice(idx,1);
    }
  }
}

