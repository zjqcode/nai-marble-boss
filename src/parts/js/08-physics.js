/* =========================================================
   8. 物理
   ========================================================= */
function ballWall(b){
  var hit = 0, bounced = false;
  if(b.x - b.r < view.left){ b.x = view.left + b.r; if(b.vx < 0){ b.vx = Math.abs(b.vx)*0.95; hit = Math.abs(b.vx); bounced = true; } }
  else if(b.x + b.r > view.right){ b.x = view.right - b.r; if(b.vx > 0){ b.vx = -Math.abs(b.vx)*0.95; hit = Math.abs(b.vx); bounced = true; } }
  if(b.y - b.r < view.ceil){
    b.y = view.ceil + b.r;
    if(b.vy < 0){
      /* 顶棚是兜底，不算反弹暴击次数，否则伤害会被白给的反弹撑爆 */
      b.vy = Math.abs(b.vy)*0.8;
      state.ceilFx.push({x:b.x, t:0});
      if(state.ceilFx.length > 12) state.ceilFx.shift();
    }
  }
  /* 只有底部出界才消耗 */
  if(b.y + b.r > view.bottom){
    b.dead = true;
    /* 空放（整段飞行没碰到 Boss）会拖慢装填，压制无脑连发 */
    if(!b.hitBoss){
      state.missStreak = Math.min(9, (state.missStreak || 0) + 1);
      applyMissPenalty();
    }
    burst(b.x, view.bottom-2, 8, 6, b.lv, '#ffb0a0');
    return;
  }
  if(bounced){
    b.bounce = Math.min(8, b.bounce + 1);
    if(hit > 260){
      if(hit > 300) Sound.wall(hit/1500);
      if(hit > 420) burst(b.x, b.y, 4, 2, b.lv, '#cfe6ff');
    }
    if(b.bounce >= 2 && state.parts.length < 380){
      burst(b.x, b.y, 4, 1, b.lv, b.bounce >= 4 ? '#ff8a5a' : '#ffe1a0');
    }
  }
}

function bossHitCheck(b){
  var boss = state.boss;
  if(!boss || boss.dead || b.dead) return;
  var bw = boss.w*0.34, bh = boss.h*0.30;
  var ex = (b.x - boss.x)/bw, ey = (b.y - boss.y)/bh;
  if(ex*ex + ey*ey > 1) return;
  var d = Math.hypot(ex, ey) || 0.001;
  var gx = ex/d/bw, gy = ey/d/bh;
  var gl = Math.hypot(gx, gy) || 1;
  var nx = gx/gl, ny = gy/gl;
  var preX = b.x, preY = b.y;
  var push = (1 - d)*Math.min(bw, bh)*0.9 + b.r*0.35 + 2;
  b.x += nx*push;
  b.y += ny*push;
  var vn = b.vx*nx + b.vy*ny;
  if(vn < 0){
    b.vx -= 1.9*vn*nx;
    b.vy -= 1.9*vn*ny;
    b.vx *= 1.02; b.vy *= 1.02;
  }
  b.sq = Math.min(.8, b.sq + 0.35);
  var pr = boss.h*0.12;
  var p1x = boss.x - boss.w*0.30, p1y = boss.y + boss.h*0.03;
  var p2x = boss.x + boss.w*0.30, p2y = boss.y + boss.h*0.03;
  var inPlate = Math.hypot(preX-p1x, preY-p1y) < pr + b.r*0.35 || Math.hypot(preX-p2x, preY-p2y) < pr + b.r*0.35;
  if(boss.invuln > 0) return;
  /* 破防期间全身都算弱点 */
  var weakNow = inPlate || boss.brkT > 0;
  if(weakNow && b.age > 0.12 && b.bossCd <= 0){
    damageBoss(b, b.x, b.y, true);
    b.bossCd = boss.brkT > 0 ? 0.5 : 1.4;
  } else if(!weakNow && b.bossCd <= 0){
    /* 打身体：35% 伤害 + 积累破防值，不再是毫无反馈的弹开 */
    damageBoss(b, b.x, b.y, false);
    b.bossCd = 1.0;
  }
}

function ballPairs(dt){
  var balls = state.balls;
  var clack = 0;
  for(var i=0;i<balls.length;i++){
    var a = balls[i];
    if(a.dead) continue;
    for(var j=i+1;j<balls.length;j++){
      var b = balls[j];
      if(b.dead) continue;
      if(a.ghost > 0 || b.ghost > 0) continue;
      var dx = b.x-a.x, dy = b.y-a.y;
      var rr = a.r + b.r;
      var d2 = dx*dx + dy*dy;
      if(d2 >= rr*rr || d2 < 0.0001) continue;
      var d = Math.sqrt(d2);
      var nx = dx/d, ny = dy/d;
      var overlap = rr - d;
      var invSum = a.invM + b.invM;
      a.x -= nx*overlap*(a.invM/invSum)*0.7;
      a.y -= ny*overlap*(a.invM/invSum)*0.7;
      b.x += nx*overlap*(b.invM/invSum)*0.7;
      b.y += ny*overlap*(b.invM/invSum)*0.7;

      var rvx = b.vx-a.vx, rvy = b.vy-a.vy;
      var vn = rvx*nx + rvy*ny;
      if(vn < 0){
        var e = 0.92;
        var jimp = -(1+e)*vn/invSum;
        a.vx -= jimp*nx*a.invM; a.vy -= jimp*ny*a.invM;
        b.vx += jimp*nx*b.invM; b.vy += jimp*ny*b.invM;
        if(-vn > 80) clack = Math.max(clack, -vn/700);
      }
      if(a.lv === b.lv && !a.dead && !b.dead){
        a.dead = true;
        b.dead = true;
        state.mergeQ.push([a,b]);
      }
    }
  }
  if(clack > 0) Sound.clack(clack);
}

function processMerges(){
  var q = state.mergeQ;
  if(!q.length) return;
  for(var i=0;i<q.length;i++){
    var a = q[i][0], b = q[i][1];
    doMerge(a,b);
  }
  q.length = 0;
  var alive = [];
  for(var k=0;k<state.balls.length;k++) if(!state.balls[k].dead) alive.push(state.balls[k]);
  state.balls = alive;
}

function doMerge(a,b){
  var lv = a.lv;
  var mx = (a.x+b.x)/2, my = (a.y+b.y)/2;
  var vx = (a.vx+b.vx)*0.45, vy = (a.vy+b.vy)*0.45;
  state.combo++;
  state.comboT = 2.0;
  state.score += (lv+1)*45 + state.combo*12;
  if(state.combo >= 2) showCombo();
  else $id('combo').classList.remove('show');

  if(lv >= MAXLV){
    state.score += 1500;
    state.balls.push(makeBall(mx,my,lv,vx*.4,vy*.4));
    if(state.boss && !state.boss.dead) damageBossRaw(mx, my, 260, true);
    state.flashHue = 'gold';
    state.flash = Math.max(state.flash, .9);
    state.slowmo = Math.max(state.slowmo, 0.45);
    state.shake = Math.max(state.shake, 24);
    cssShake('m');
    ring(mx,my,20, view.w*0.9, '255,235,170', .7, 4);
    burst(mx,my,70,46,lv,'#fff4cc');
    popText(mx,my-40,'雷霆审判',22,'#fff3c6');
    Sound.squish(12);
    addBolt(mx, view.top, mx, my);
    addBolt(mx-90, view.top, mx, my);
    addBolt(mx+90, view.top, mx, my);
    for(var r=0;r<state.rocks.length;r++){ state.rocks[r].dead = true; }
    return;
  }
  var nb = makeBall(mx,my,lv+1,vx,vy);
  nb.life = 15;
  state.balls.push(nb);
  state.maxLv = Math.max(state.maxLv, lv+1);
  var col = levelColor(lv+1);
  ring(mx,my,RADII[lv]*0.5,RADII[lv+1]*2.1,'255,224,150',.5,3);
  burst(mx,my,Math.max(a.r,b.r),12+lv*2,lv+1,col);
  if(state.pops.length < 6) popText(mx,my-a.r*0.9,'+'+(lv+1)*42,12+Math.min(6,lv*.5),'#ffe8b0');
  state.shake = Math.max(state.shake, 2.5+lv*.6);
  cssShake(lv >= 5 ? 'm' : 's');
  Sound.squish(lv);
  try{ if(navigator.vibrate) navigator.vibrate(12); }catch(e){}
  if(lv >= 5){ state.flash = Math.max(state.flash, .12); }
}

function levelColor(lv){
  var cols = ['#ffe9b0','#f9d98a','#ffd68a','#ffc07a','#ffb36b','#ffa9a1','#ff9fc7','#e5a8ff','#b9a8ff','#9fc3ff','#a9ead6','#c8d68a','#ffe39a'];
  return cols[Math.min(cols.length-1, lv)] || '#ffe9b0';
}

function damageBoss(b, hx, hy, weak){
  var eff = state.eff;
  /* 记「这一发打中了」：掉出场外时用来判断是不是空放 */
  b.hitBoss = true;
  var bounces = b.bounce || 0;
  var bounceMul = 1 + Math.min(0.6, bounces*0.08);
  var crit = bounces >= 6 || Math.random() < eff.crit;
  var dmg = DMG[b.lv] * CHARS[b.lv].dmg * eff.bossDmg * eff.dmgAll * bounceMul * (crit ? 1.5 : 1);
  if(weak) dmg *= 1.5;
  else dmg *= 0.35;            /* 身体命中：三成伤害，但积累破防 */
  if(state.superT > 0) dmg *= 1.2;
  if(state.frenzyT > 0) dmg *= 2;
  if(state.boss && state.boss.brkT > 0) dmg *= 1.3;   /* 破防中增伤 */
  /* 单发伤害上限：任何叠满的暴击/变身/弹跳组合都不能一发带走过多的血，
     否则满级玩家一下就把 Boss 删了，完全没挑战。 */
  if(state.boss && state.boss.maxHp > 0){
    var _cap = state.boss.maxHp * 0.18;
    if(dmg > _cap) dmg = _cap;
  }
  state.maxLv = Math.max(state.maxLv, b.lv);
  /* 破防值只由身体命中积累，鼓励「打不中弱点也别停手」 */
  if(!weak) addBreak(dmg * 2.6, hx, hy);
  if(weak && typeof tutOnWeak === 'function') tutOnWeak();
  if(typeof tutOnBossHit === 'function') tutOnBossHit(!!weak);
  damageBossRaw(hx, hy, dmg, crit, b.lv, weak, bounces);
}

/* 破防积累；满了就进入硬直 */
function addBreak(v, hx, hy){
  var boss = state.boss;
  if(!boss || boss.dead || boss.brkT > 0) return;
  boss.brk += v;
  updateBreakHUD();
  if(boss.brk >= boss.brkMax) triggerBreak(hx, hy);
}

function triggerBreak(hx, hy){
  var boss = state.boss;
  if(!boss || boss.dead) return;
  boss.brk = 0;
  boss.brkT = 3.5;
  boss.brkCount++;
  /* 同一局内一次比一次难破，避免后期无限硬直 */
  boss.brkMax = Math.round(boss.brkMax * 1.35);
  boss.invuln = 0;
  boss.dashT = 0;
  state.telegraph = null;
  state.atkAnim = null;
  boss.charge = 0;
  setWarn(false);
  $id('bossAtk').classList.remove('hot');
  state.atkTimer = Math.max(state.atkTimer, 1.6);
  state.slowmo = Math.max(state.slowmo, 0.35);
  state.flashHue = 'cyan';
  state.flash = Math.max(state.flash, .55);
  state.shake = Math.max(state.shake, 20);
  cssShake('m');
  ring(boss.x, boss.y, boss.w*.18, boss.w*1.7, '150,240,255', .75, 6);
  ring(boss.x, boss.y, boss.w*.18, boss.w*1.1, '255,255,255', .5, 3);
  burst(boss.x, boss.y, boss.w*.5, 34, 9, '#bff2ff');
  popText(boss.x, boss.y - boss.h*.55, '破防！全身可伤', 22, '#c8f4ff');
  Sound.breakDown();
  try{ if(navigator.vibrate) navigator.vibrate([18,40,24]); }catch(e){}
  updateBreakHUD();
}

function damageBossRaw(hx, hy, dmg, crit, lv, weak, bounces){
  /* 只要对 Boss 造成伤害，就清掉空放惩罚（雷击/变身等道具伤害同样算） */
  if(state.missStreak > 0){ state.missStreak = 0; applyMissPenalty(); }
  var boss = state.boss;
  if(!boss || boss.dead) return;
  dmg = Math.max(1, Math.round(dmg * (state.heroDmg || 1)));
  if(state.fireT > 0) dmg = Math.round(dmg * 1.5);
  /* 单发最终上限：不超过 Boss 血量 18%。
     满级 + 超级奶娃 + 暴击 + 多次弹跳叠起来原本能一发带走 20%+，
     这里统一夹住，保证再强也要打几下。 */
  if(boss.maxHp > 0){
    var _hardCap = boss.maxHp * 0.18;
    if(dmg > _hardCap) dmg = Math.round(_hardCap);
  }
  boss.hp = Math.max(0, boss.hp - dmg);
  boss.flash = 1;
  boss.hitScale = 0.9;
  state.hits++;
  state.score += dmg*3 + (crit ? 80 : 0);
  if(state.telegraph) state.interrupt += dmg * (weak ? 2 : 1);
  updateScore();
  updateBossHUD();
  state.shake = Math.max(state.shake, crit ? 16 : 8);
  if(crit){
    state.flashHue = 'gold';
    state.flash = Math.max(state.flash, .35);
    state.slowmo = Math.max(state.slowmo, 0.12);
  } else {
    state.flash = Math.max(state.flash, .14);
  }
  cssShake(crit ? 'm' : 's');
  Sound.bossHit(lv !== undefined ? lv : 6, crit);
  try{ if(navigator.vibrate) navigator.vibrate(crit ? 22 : 14); }catch(e){}
  burst(hx, hy, 6, crit ? 20 : 12, lv || 4, crit ? '#fff1c8' : '#ffd08a');
  ring(hx, hy, 6, crit ? 84 : 52, crit ? '255,150,90' : '255,220,150', .4, 3);
  var label = '';
  if(boss.brkT > 0) label += '破防 ';
  else if(weak) label += '弱点 ';
  if(crit) label += '暴击 ';
  if(bounces >= 2) label += '×' + (bounces+1) + ' ';
  label += '-' + fmt(dmg);
  popText(hx + rand(-8,8), hy - 18, label, crit || weak ? 20 : 15,
    boss.brkT > 0 ? '#c8f4ff' : (weak ? '#ffd0b0' : (crit ? '#fff0b0' : '#ffd7a0')));
  if(weak) ring(boss.x, boss.y + boss.h*0.04, 10, 64, '255,110,80', .4, 3);
  var coins = 2 + Math.floor(dmg/18);
  if(crit) coins += 2;
  coins = Math.min(8, Math.round(coins * state.eff.milk));
  spawnCoins(hx, hy, coins);
  if(boss.hp <= 0){ bossDie(); return; }
  if(state.telegraph && state.interrupt >= state.interruptNeed && !(state.boss && state.boss.enraged)) interruptAttack();
}

function spawnCoins(x, y, n){
  var target = $id('milk').getBoundingClientRect();
  var tx = target.left + target.width/2;
  var ty = target.top + target.height/2;
  for(var i=0;i<n;i++){
    state.coins.push({
      x:x, y:y, sx:x, sy:y, tx:tx, ty:ty,
      t:0, dur:rand(.5,.8), delay:i*0.045,
      cx:x + rand(-90,90), cy:y - rand(50,130),
      r:rand(3,5), spin:rand(0,TAU), dead:false
    });
  }
}

function updateCoins(dt){
  var cols = state.coins;
  for(var i=cols.length-1;i>=0;i--){
    var c = cols[i];
    if(c.delay > 0){ c.delay -= dt; continue; }
    c.t += dt/c.dur;
    var t = clamp(c.t, 0, 1);
    var u = 1-t;
    c.x = u*u*c.sx + 2*u*t*c.cx + t*t*c.tx;
    c.y = u*u*c.sy + 2*u*t*c.cy + t*t*c.ty;
    c.spin += dt*12;
    if(c.t >= 1){
      addMilk(1);
      Sound.coin();
      cols.splice(i,1);
    }
  }
}

