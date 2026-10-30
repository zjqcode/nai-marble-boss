/* =========================================================
   15. 主循环
   ========================================================= */
function stepPhysics(dt){
  var i,b;
  var balls = state.balls;

  for(i=0;i<balls.length;i++){
    b = balls[i];
    if(b.dead) continue;
    b.age += dt;
    b.life -= dt;
    if(b.life <= 0){
      burst(b.x, b.y, b.r, 6, b.lv, levelColor(b.lv));
      b.dead = true;
      continue;
    }
    if(b.springCd > 0) b.springCd -= dt;
    if(b.bossCd > 0) b.bossCd -= dt;
    if(b.portalCd > 0) b.portalCd -= dt;
    if(b.plateCd > 0) b.plateCd -= dt;
    if(b.ghost > 0) b.ghost -= dt;
    b.vx *= 0.9994;
    b.vy *= 0.9994;
    b.x += b.vx*dt;
    b.y += b.vy*dt;
    var sp = Math.hypot(b.vx,b.vy);
    if(sp < 26 && b.age > 1){
      b.vx += rand(-70,70);
      b.vy += rand(-70,70);
    }
    if(sp > 2100){
      b.vx *= 2100/sp; b.vy *= 2100/sp;
    }
    /* 拖尾采样：速度越快采样越密，上限 7 点 */
    b.trailT -= dt;
    if(sp > 220 && b.trailT <= 0){
      b.trailT = 0.022;
      b.trail.push({x:b.x, y:b.y});
      var cap = b.bounce >= 3 ? 7 : (b.lv >= 4 ? 6 : 4);
      while(b.trail.length > cap) b.trail.shift();
    } else if(sp <= 220 && b.trail.length){
      b.trail.shift();
    }
    b.sq *= 0.86;
    b.tilt += (clamp(b.vx*0.0016,-.5,.5)-b.tilt)*Math.min(1,dt*10);
    springCheck(b);
    portalCheck(b);
    bumperCheck(b);
    plateCheck(b);
    ballWall(b);
    bossHitCheck(b);
  }

  ballPairs(dt);
  processMerges();

  for(i=state.balls.length-1;i>=0;i--) if(state.balls[i].dead) state.balls.splice(i,1);
}

function update(dt){
  if(state.mode === 'play' && !state.paused){
    if(state.cineT > 0){
      state.cineT = Math.max(0, state.cineT - dt);
      updateBoss(dt);
      updateFx(dt);
      updateCoins(dt);
      return;
    }
    state.timer -= dt;
    if(state.timer <= 0){
      state.timer = 0;
      updateLevelHUD();
      failLevel();
      return;
    }
    updateLevelHUD();
    /* 炮台左右移动：这是闪避能成立的前提。
       左摇杆给出 -1~1 的连续值（推多远走多快），键盘给 ±1；摇杆优先。 */
    var mv = state.stickX !== 0 ? state.stickX : state.moveDir;
    if(mv){
      var before = state.cannonX;
      state.cannonX = clamp(
        /* 按场宽算速度：危险区是场宽的比例，移动也得跟着场宽走，否则宽屏躲不开 */
        state.cannonX + mv * view.w * 0.85 * dt,
        view.left + 34*view.s, view.right - 34*view.s);
      if(state.cannonX !== before){
        Sound.move();
        if(state.parts.length < 360 && Math.random() < 0.5){
          state.parts.push({
            x:state.cannonX - mv*22*view.s, y:view.pouchY + rand(12,30)*view.s,
            vx:-mv*rand(40,120), vy:rand(-20,30), r:rand(.8,2),
            life:rand(.2,.42), color:'#ffd98f', grav:40
          });
        }
      }
    }
    updateBoss(dt);
    updateItems(dt);
    updateSuck(dt);
    stepPhysics(dt);
    updateRocks(dt);
    if(state.reloadT > 0) state.reloadT = Math.max(0, state.reloadT - dt);
    if(state.superT > 0){
      state.superT = Math.max(0, state.superT - dt);
      if(state.superT === 0) refreshLoadLevel();
    }
    if(state.frenzyT > 0) state.frenzyT = Math.max(0, state.frenzyT - dt);
    if(state.gasT > 0) state.gasT = Math.max(0, state.gasT - dt);
    if(state.fireT > 0) state.fireT = Math.max(0, state.fireT - dt);
    if(state.potionCd > 0) state.potionCd = Math.max(0, state.potionCd - dt);
    if(state.atkAnim){
      state.atkAnim.t -= dt;
      if(state.atkAnim.t <= 0) state.atkAnim = null;
    }
  } else {
    if(state.boss){
      if(state.boss.entrance < 1) state.boss.entrance = Math.min(1, state.boss.entrance + dt*2.4);
      if(state.boss.flash > 0) state.boss.flash = Math.max(0, state.boss.flash - dt*4.5);
      state.boss.hitScale += (1 - state.boss.hitScale) * Math.min(1, dt*14);
    }
  }
  updateCoins(dt);
  updateFx(dt);
  state.uiT -= dt;
  if(state.uiT <= 0){
    state.uiT = 0.12;
    updateBuffs();
    updateBreakHUD();
    /* 离开战斗（胜利 / 失败 / 暂停）时把没放下的反弹板预览丢掉，避免状态残留 */
    if(state.placingPlate && (state.mode !== 'play' || state.paused)) cancelPlatePlacement(true);
    /* 血瓶可用状态 / 反弹板数量与放置高亮，跟着 0.12 秒的节流刷新 */
    refreshItemBtnStates();
    refreshPlateBtn();
    if(state.chapter && state.mode === 'play' && !state.telegraph && state.cineT <= 0){
      var el = $id('bossAtk');
      if(state.stun > 0){
        el.textContent = '虚弱 ' + state.stun.toFixed(1) + 's';
        el.classList.remove('hot');
      } else {
        el.textContent = '反击 ' + Math.max(0, state.atkTimer).toFixed(1) + 's';
        if(state.atkTimer < 2.5) el.classList.add('hot');
        else el.classList.remove('hot');
      }
    }
  }
}

