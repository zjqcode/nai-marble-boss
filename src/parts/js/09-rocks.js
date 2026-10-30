/* =========================================================
   9. 石球
   ========================================================= */
function spawnRock(x, y, vx, vy){
  var r = rand(20, 30) * view.s;
  state.rocks.push({
    x:x, y:y, vx:vx, vy:vy, r:r, life:9, dead:false, rot:rand(0,TAU),
    rotV:rand(-2,2), invM:1/(r*r), m:r*r
  });
}

function updateRocks(dt){
  var rocks = state.rocks;
  for(var i=rocks.length-1;i>=0;i--){
    var rk = rocks[i];
    if(rk.dead){ rocks.splice(i,1); continue; }
    rk.life -= dt;
    if(rk.life <= 0){
      burst(rk.x, rk.y, rk.r, 8, 2, '#9aa2ad');
      rocks.splice(i,1);
      continue;
    }
    rk.vy += 1250*dt;
    rk.x += rk.vx*dt;
    rk.y += rk.vy*dt;
    rk.rot += rk.rotV*dt;
    if(rk.x - rk.r < view.left){ rk.x = view.left+rk.r; rk.vx = Math.abs(rk.vx)*0.68; }
    else if(rk.x + rk.r > view.right){ rk.x = view.right-rk.r; rk.vx = -Math.abs(rk.vx)*0.68; }
    if(rk.y - rk.r < view.ceil){ rk.y = view.ceil+rk.r; rk.vy = Math.abs(rk.vy)*0.5; }
    else if(rk.y + rk.r > view.bottom){ rk.y = view.bottom-rk.r; rk.vy = -Math.abs(rk.vy)*0.55; rk.vx *= 0.92; }

    for(var k=0;k<state.balls.length;k++){
      var b = state.balls[k];
      if(b.dead) continue;
      var dx = b.x-rk.x, dy = b.y-rk.y;
      var rr = b.r + rk.r;
      var d2 = dx*dx + dy*dy;
      if(d2 >= rr*rr || d2 < 0.0001) continue;
      var d = Math.sqrt(d2);
      var nx = dx/d, ny = dy/d;
      if(b.lv >= 2 && Math.hypot(b.vx,b.vy) > 220){
        rk.dead = true;
        b.vx *= 0.88; b.vy *= 0.88;
        b.x = rk.x + nx*(rr+2);
        b.y = rk.y + ny*(rr+2);
        burst(rk.x, rk.y, rk.r, 12, 2, '#b9c2cc');
        addMilk(Math.max(1, Math.round(state.eff.milk)));
        state.score += 30;
        updateScore();
        Sound.rock();
        break;
      } else {
        var vn = b.vx*nx + b.vy*ny;
        b.x = rk.x + nx*(rr+1);
        b.y = rk.y + ny*(rr+1);
        if(vn < 0){ b.vx -= 1.6*vn*nx; b.vy -= 1.6*vn*ny; b.vx *= .9; b.vy *= .9; }
        rk.x -= nx*2; rk.y -= ny*2;
      }
    }

    /* portal / springs not applied to rocks */
    /* 每对只解算一次：外层倒序遍历，内层只看索引更大的 */
    for(var m=i+1;m<rocks.length;m++){
      var o = rocks[m];
      var ddx = o.x-rk.x, ddy = o.y-rk.y;
      var rrr = o.r+rk.r;
      var dd2 = ddx*ddx+ddy*ddy;
      if(dd2 < rrr*rrr && dd2 > 0.0001){
        var dd = Math.sqrt(dd2);
        var ux = ddx/dd, uy = ddy/dd;
        var push = (rrr-dd)*0.5;
        rk.x -= ux*push; rk.y -= uy*push;
        o.x += ux*push; o.y += uy*push;
        var rv = (o.vx-rk.vx)*ux + (o.vy-rk.vy)*uy;
        if(rv < 0){
          var imp = -(1+0.5)*rv/2;
          rk.vx -= imp*ux; rk.vy -= imp*uy;
          o.vx += imp*ux; o.vy += imp*uy;
        }
      }
    }
  }

  /* rocks hitting the boss are ignored; boss attack rocks spawn inside its mouth */
  for(var q=state.rocks.length-1;q>=0;q--) if(state.rocks[q].dead) state.rocks.splice(q,1);
}

