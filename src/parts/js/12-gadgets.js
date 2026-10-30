/* =========================================================
   12. 场地机关
   ========================================================= */
function springCheck(b){
  if(!state.springs.length || b.springCd > 0) return;
  for(var i=0;i<state.springs.length;i++){
    var sp = state.springs[i];
    if(b.y > sp.y - sp.h/2 && b.y < sp.y + sp.h/2){
      var near = sp.side > 0
        ? (b.x - b.r < view.left + 24)
        : (b.x + b.r > view.right - 24);
      if(near){
        b.vx = sp.side * Math.max(Math.abs(b.vx)*1.7, 1000);
        b.vy *= 0.92;
        b.springCd = 0.35;
        b.bounce = Math.min(8, b.bounce + 1);
        state.springFx.push({x:sp.x, y:b.y, r:18*view.s, t:0, span:.35, color:'255,220,150'});
        burst(sp.x, b.y, 10, 6, b.lv, '#ffe1a0');
        state.score += 10;
        updateScore();
        break;
      }
    }
  }
}

/* 按 pair 找出口，支持场上同时存在多对传送门（关卡自带 + 道具生成） */
function portalExit(p){
  for(var i=0;i<state.portals.length;i++){
    var o = state.portals[i];
    if(o !== p && o.pair === p.pair) return o;
  }
  return null;
}

function portalCheck(b){
  if(!state.portals.length || b.portalCd > 0) return;
  for(var i=0;i<state.portals.length;i++){
    var p = state.portals[i];
    var dx = b.x - p.x, dy = b.y - p.y;
    if(dx*dx + dy*dy < (p.r + b.r*0.35)*(p.r + b.r*0.35)){
      var o = portalExit(p);
      if(!o) continue;
      var sp = Math.hypot(b.vx, b.vy) || 200;
      var ang = Math.atan2(b.vy, b.vx) + rand(-0.5, 0.5);
      b.x = o.x + Math.cos(ang)*(o.r + b.r + 6);
      b.y = o.y + Math.sin(ang)*(o.r + b.r + 6);
      b.vx = Math.cos(ang) * sp * 1.12;
      b.vy = Math.sin(ang) * sp * 1.12;
      b.portalCd = 1.0;
      b.bounce = Math.min(8, b.bounce + 1);
      ring(o.x, o.y, o.r*0.3, o.r*2.2, '190,150,255', .5, 3);
      ring(p.x, p.y, p.r*0.3, p.r*2.0, '190,150,255', .5, 3);
      burst(p.x, p.y, p.r, 8, b.lv, '#c9b6ff');
      burst(o.x, o.y, o.r, 8, b.lv, '#d8c8ff');
      Sound.portal(false);
      Sound.portal(true);
      break;
    }
  }
}

function bumperCheck(b){
  for(var i=0;i<state.bumpers.length;i++){
    var bp = state.bumpers[i];
    var dx = b.x - bp.x, dy = b.y - bp.y;
    var rr = bp.r + b.r;
    var d2 = dx*dx + dy*dy;
    if(d2 >= rr*rr || d2 < 0.0001) continue;
    var d = Math.sqrt(d2);
    var nx = dx/d, ny = dy/d;
    b.x = bp.x + nx*(rr+2);
    b.y = bp.y + ny*(rr+2);
    var vn = b.vx*nx + b.vy*ny;
    if(vn < 0){
      b.vx -= 2*vn*nx; b.vy -= 2*vn*ny;
      b.vx *= 1.12; b.vy *= 1.12;
      b.bounce = Math.min(8, b.bounce + 1);
      state.shake = Math.max(state.shake, 2);
      ring(bp.x, bp.y, bp.r*0.6, bp.r*1.9, '255,210,140', .35, 2);
      burst(bp.x, bp.y, bp.r, 6, b.lv, '#ffe1a0');
      break;
    }
  }
}

/* 反弹板：线段碰撞 + 法向反射。道具 plate 生成，带寿命 */
function plateCheck(b){
  for(var i=0;i<state.plates.length;i++){
    var pl = state.plates[i];
    if(pl.life <= 0 || b.plateCd > 0) continue;
    var ca = Math.cos(pl.ang), sa = Math.sin(pl.ang);
    var half = pl.len/2;
    /* 球心投影到线段上，求最近点 */
    var rx = b.x - pl.x, ry = b.y - pl.y;
    var t = clamp(rx*ca + ry*sa, -half, half);
    var qx = pl.x + ca*t, qy = pl.y + sa*t;
    var dx = b.x - qx, dy = b.y - qy;
    var thick = pl.thick + b.r;
    var d2 = dx*dx + dy*dy;
    if(d2 >= thick*thick || d2 < 0.0001) continue;
    var d = Math.sqrt(d2);
    var nx = dx/d, ny = dy/d;
    b.x = qx + nx*(thick + 1);
    b.y = qy + ny*(thick + 1);
    var vn = b.vx*nx + b.vy*ny;
    if(vn < 0){
      b.vx -= 2*vn*nx; b.vy -= 2*vn*ny;
      b.vx *= 1.16; b.vy *= 1.16;      /* 比弹珠台更弹，是付费道具 */
      b.bounce = Math.min(8, b.bounce + 1);
      b.plateCd = 0.1;
      pl.hit = 0.25;
      state.shake = Math.max(state.shake, 3);
      state.springFx.push({x:qx, y:qy, r:16*view.s, t:0, span:.3, color:'180,255,220'});
      burst(qx, qy, 10, 6, b.lv, '#aef3d4');
      state.score += 15;
      updateScore();
      Sound.plate(Math.min(1, Math.hypot(b.vx,b.vy)/1400));
      break;
    }
  }
}

