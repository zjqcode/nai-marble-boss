/* =========================================================
   10. Boss 行为
   ========================================================= */
/* 攻击类型对危险区宽度的微调系数（基准宽度来自 CHAPTERS.dodgeW） */
var ATK_WIDTH = {thunder:0.62, hop:1.18, fart:1.0, suck:1.08, eggs:1.26, laugh:1.08};

function beginTelegraph(isCombo){
  var boss = state.boss;
  if(!boss || boss.dead || state.stun > 0 || boss.brkT > 0) return;
  var ch = state.chapter;
  var type = ch.atk;
  /* 锁定玩家此刻的位置：想躲就得在蓄力结束前走出危险区。
     狂暴时会「预判走位」——按你当前移动方向往前带一段，
     原地不动/直线跑都会被打中，必须变向才躲得掉。 */
  var aimX = state.cannonX;
  if(boss.enraged && (ch.aimLead || 0) > 0){
    var _lead = (ch.aimLead || 0) * view.w * (state.stickX || 0);
    aimX = clamp(state.cannonX + _lead, view.left + 20, view.right - 20);
  }
  var w = view.w * (ch.dodgeW || 0.22) * (ATK_WIDTH[type] || 1);
  if(boss.enraged && ch.rageZone) w *= ch.rageZone;
  var tele = ch.tele || 1.25;
  if(isCombo) tele *= 0.8;      /* 连段后续更急 */
  /* 狂暴状态：蓄力更短，留给玩家躲的时间更少 */
  if(boss.enraged) tele *= (ch.teleRageMul || 0.78);
  var tg = {
    type:type, atkName:ch.atkName, t:tele, total:tele,
    x:aimX, aimX:aimX, dodgeW:Math.max(34, w), combo:!!isCombo
  };
  state.telegraph = tg;
  state.interrupt = 0;
  state.interruptNeed = Math.max(14, Math.round(boss.maxHp * 0.055));
  boss.charge = 1;
  setWarn(true);
  Sound.warn();
  Sound.bgmIntensity(2);
  var el = $id('bossAtk');
  el.classList.add('hot');
  var stage = state.comboQ > 0 ? ' [' + (((ch.combo||1) - state.comboQ)) + '/' + (ch.combo||1) + ']' : '';
  el.textContent = '⚠ ' + ch.atkName + stage + ' · 伤害 ' + state.atkDmg + ' · 走出红区闪避';
  if(typeof tutOnTelegraph === 'function') tutOnTelegraph();
}

function interruptAttack(){
  var boss = state.boss;
  if(!boss || !state.telegraph) return;
  state.telegraph = null;
  state.atkAnim = null;
  state.gasT = 0;
  state.comboQ = 0;
  boss.charge = 0;
  setWarn(false);
  Sound.bgmIntensity(boss.enraged ? 1 : 0);
  state.stun = 2.5;
  state.flash = Math.max(state.flash, .35);
  state.shake = Math.max(state.shake, 15);
  cssShake('m');
  ring(boss.x, boss.y, boss.w*.2, boss.w*1.3, '255,230,160', .6, 5);
  burst(boss.x, boss.y - boss.h*.1, boss.w*.5, 26, 8, '#fff1c8');
  popText(boss.x, boss.y - boss.h*.55, '打断成功！', 22, '#fff3c6');
  Sound.interrupt();
  addMilk(3);
  state.atkTimer = state.atkEvery * 1.15;
  var el = $id('bossAtk');
  el.classList.remove('hot');
  el.textContent = '打断成功 · 虚弱 2.5s';
}

function executeTelegraph(){
  var tg = state.telegraph;
  if(!tg) return;
  var boss = state.boss;
  var ch = state.chapter;
  if(tg.type === 'laugh'){
    state.atkAnim = {type:'laugh', t:1.1, total:1.1};
    Sound.haha();   /* 哈哈哈声波攻击 */
    for(var i=0;i<3;i++) ring(boss.x, boss.y - boss.h*.1, boss.w*.3, boss.w*(1.1+i*.35), '255,215,140', .8, 4);
    burst(boss.x, boss.y - boss.h*.05, boss.w*.4, 16, 6, '#ffe6a8');
    attackHit(tg, '笑声');
  } else if(tg.type === 'hop'){
    boss.hopT = 0.7;
    var n = ch.rocks || 3;
    for(var k=0;k<n;k++){
      var ang = rand(-1, 1);
      spawnRock(boss.x + rand(-boss.w*.3, boss.w*.3), boss.y + boss.h*.4,
        Math.sin(ang)*rand(160,360), rand(120,260));
    }
    Sound.rock(); Sound.hop();
    state.shake = Math.max(state.shake, 16);
    cssShake('m');
    for(var q=0;q<2;q++) ring(boss.x, view.bottom-16, 20, view.w*.6, '200,180,150', .6, 4);
    attackHit(tg, '跳砸');
  } else if(tg.type === 'fart'){
    state.atkAnim = {type:'fart', t:1.5, total:1.5};
    state.gasT = 1.6;
    Sound.fart();
    for(var m=0;m<12;m++){
      state.parts.push({
        x:boss.x + rand(-boss.w*.4,boss.w*.4), y:boss.y + boss.h*.28,
        vx:rand(-30,30), vy:rand(10,60), r:rand(4,9),
        life:rand(.8,1.5), color:'#8fd44a', grav:-40
      });
    }
    attackHit(tg, '臭屁');
  } else if(tg.type === 'suck'){
    state.suck = {t:2.4, total:2.4};
    Sound.suck();
    state.flash = Math.max(state.flash, .12);
    attackHit(tg, '吸力');
  } else if(tg.type === 'eggs'){
    var nEgg = ch.rocks || 5;
    for(var e=0;e<nEgg;e++){
      spawnRock(tg.aimX + rand(-tg.dodgeW*.65, tg.dodgeW*.65), view.ceil + rand(8,26), rand(-50,50), rand(70,170));
    }
    Sound.rock();
    state.shake = Math.max(state.shake, 12);
    burst(boss.x, boss.y + boss.h*.3, boss.w*.4, 14, 6, '#ffe1a0');
    attackHit(tg, '蛋蛋');
  } else if(tg.type === 'thunder'){
    state.beam = {x:tg.x, t:0.45, total:0.45, w:Math.max(30, view.w*0.09)};
    Sound.beam();
    state.flash = Math.max(state.flash, .5);
    state.shake = Math.max(state.shake, 16);
    cssShake('m');
    addBolt(tg.x, view.top, tg.x + rand(-20,20), view.bottom);
    addBolt(boss.x, boss.y, tg.x, view.top + 40);
    for(var b1=state.balls.length-1;b1>=0;b1--){
      var bb = state.balls[b1];
      if(Math.abs(bb.x - tg.x) < (state.beam.w/2 + bb.r*0.4)){
        burst(bb.x, bb.y, bb.r, 10, bb.lv, '#ffb0a0');
        state.balls.splice(b1,1);
      }
    }
    for(var r1=state.rocks.length-1;r1>=0;r1--){
      if(Math.abs(state.rocks[r1].x - tg.x) < state.beam.w/2 + state.rocks[r1].r){
        burst(state.rocks[r1].x, state.rocks[r1].y, state.rocks[r1].r, 8, 2, '#b9c2cc');
        state.rocks.splice(r1,1);
      }
    }
    attackHit(tg, '雷柱');
  }
  state.telegraph = null;
  boss.charge = 0;
  setWarn(false);
  $id('bossAtk').classList.remove('hot');
  /* 本轮还有后续段数就排队，否则回到正常反击计时 */
  if(state.comboQ <= 0 && (ch.combo || 1) > 1){
    var _cnt = (ch.combo || 1);
    if(boss.enraged) _cnt += (ch.rageCombo || 1);   /* 狂暴时多一段 */
    state.comboQ = _cnt - 1;
  }
  if(state.comboQ > 0){
    state.comboT2 = 0.42 * (state.boss && state.boss.enraged ? (state.chapter.teleRageMul || 0.78) : 1);
    $id('bossAtk').textContent = '连段来袭…';
  } else {
    state.atkTimer = state.atkEvery * rand(0.9, 1.08);
    $id('bossAtk').textContent = '反击 ' + state.atkTimer.toFixed(1) + 's';
    Sound.bgmIntensity(boss.enraged ? 1 : 0);
  }
}

/* 眩晕时长按章节递增：前面轻、后面重，但不至于"一晕就死"。
   配合 heroHit 里的无敌帧（眩晕时长 + 0.45s），保证晕完有一段喘息。 */
function chapterStun(){
  var id = (state.chapter && state.chapter.id) || 1;
  if(id <= 2) return 0.5;
  if(id <= 5) return 0.7;
  return 0.9;
}

function startStun(sec){
  state.stunT = sec;
  state.stunCd = 2.5;          /* 冷却内再被命中只掉血，不重复眩晕，避免锁死 */
  state.stickX = 0;
  state.moveDir = 0;
  state.aim.active = false;
  state.aim.power = 0;
  state.pendingShot = null;
  document.body.classList.add('stunned');
  popText(state.cannonX, view.pouchY - 112*view.s, '眩晕！', 20, '#ffd166');
  ring(state.cannonX, view.pouchY - 46*view.s, 10, 70, '255,209,102', .5, 3);
  try{ if(navigator.vibrate) navigator.vibrate([30, 40, 30]); }catch(e){}
}

function heroHit(n, reason, noStun){
  if(state.mode !== 'play' || state.cineT > 0) return;
  /* 无敌帧：眩晕期间及刚结束的一小段不会再被命中 */
  if(state.invulnT > 0) return;
  if(state.shield > 0){
    state.shield--;
    state.invulnT = 0.8;
    updateBuffs();
    popText(state.cannonX, view.pouchY - 66, '护盾抵挡！', 16, '#bfe8ff');
    ring(state.cannonX, view.pouchY, 24, 100, '140,210,255', .5, 4);
    state.shake = Math.max(state.shake, 6);
    Sound.shield();
    return;                    /* 护盾抵挡不眩晕 */
  }
  setHeroHP(state.heroHP - n, true);
  state.flashHue = 'red';
  state.flash = Math.max(state.flash, .5);
  state.shake = Math.max(state.shake, 14);
  cssShake('m');
  Sound.hurt();
  try{ if(navigator.vibrate) navigator.vibrate(35); }catch(e){}
  popText(state.cannonX, view.pouchY - 58, '勇者 -' + n + ' · ' + reason, 15, '#ff9a8a');
  state.dodgeStreak = 0;

  /* 眩晕：连段后续段不触发（否则一轮连段直接锁死），冷却内也不触发 */
  var stun = (!noStun && state.stunCd <= 0) ? chapterStun() : 0;
  if(stun > 0 && state.heroHP > 0) startStun(stun);
  state.invulnT = stun > 0 ? stun + 0.45 : 0.6;

  updateBuffs();
  if(state.heroHP <= 0) heroDown(reason);
}

function attackHit(tg, reason){
  var tutHit = Math.abs(state.cannonX - tg.aimX) <= tg.dodgeW;
  if(typeof tutOnAttackResolved === 'function') tutOnAttackResolved(tutHit);
  if(Math.abs(state.cannonX - tg.aimX) <= tg.dodgeW){
    /* 连段的后续段伤害 -1，避免站桩一轮直接秒杀；同时不触发眩晕 */
    heroHit(tg.combo ? Math.max(1, state.atkDmg - 1) : state.atkDmg, reason, !!tg.combo);
  } else {
    dodgeSuccess();
  }
}

function dodgeSuccess(){
  state.dodgeStreak++;
  /* 极限闪避：在红区里站到最后一刻才走开（<0.22s）——奖励精准走位，不惩罚新手 */
  var perfect = state.dangerT <= 0.22;
  var add = 60 + Math.min(240, state.dodgeStreak*40);
  if(perfect) add *= 3;
  state.score += add;
  updateScore();
  updateBuffs();
  if(perfect){
    popText(state.cannonX, view.pouchY - 92, '极限闪避！', 19, '#ffe38a');
    ring(state.cannonX, view.pouchY, 26, 130, '255,225,140', .6, 5);
    addMilk(Math.max(1, Math.round(3 * state.eff.milk)));
    state.slowmo = Math.max(state.slowmo, 0.35);   /* 0.35 秒子弹时间 */
    state.flashHue = 'gold';
    state.flash = Math.max(state.flash, .3);
    try{ if(navigator.vibrate) navigator.vibrate(20); }catch(e){}
  }
  popText(state.cannonX, view.pouchY - 74, '闪避成功 ×' + state.dodgeStreak, 16, '#bfe8ff');
  popText(state.cannonX, view.pouchY - 52, '+' + add, 13, perfect ? '#ffe9a8' : '#d6f0ff');
  ring(state.cannonX, view.pouchY, 18, 96, '140,210,255', .45, 3);
  ring(state.cannonX, view.pouchY, 10, 52, '255,255,255', .3, 2);
  /* 连续闪避给奶瓶奖励，鼓励玩家主动走位 */
  if(state.dodgeStreak % 3 === 0){
    addMilk(Math.max(1, Math.round(2 * state.eff.milk)));
    popText(state.cannonX, view.pouchY - 116, '闪避连击奖励 奶瓶+', 13, '#ffe1a0');
  }
  Sound.dodge();
}

/* 失败：血量归零（另一种是 13-settle.js 的 failLevel：超时）。
   清场与结算音效由 settleLevel 统一负责，这里只管本路径特有的表现。 */
function heroDown(reason){
  /* 无尽模式：记录到状态上，失败面板会显示波次与最高纪录 */
  if(state.endless) state.endlessDeadWave = state.wave;
  if(!settleLevel('lose')) return;
  state.deadReason = reason || '反击';
  Sound.lose();
  state.flash = Math.max(state.flash, .6);
  state.shake = Math.max(state.shake, 18);
  state.result = loseResult({ reason: 'hero', attack: reason || 'Boss 反击' });
  saveMeta();
  setTimeout(function(){ if(state.mode === 'lose') showLose(); }, 700);
}

function updateSuck(dt){
  if(!state.suck) return;
  var s = state.suck;
  s.t -= dt;
  var boss = state.boss;
  if(s.t <= 0){ state.suck = null; return; }
  for(var i=state.balls.length-1;i>=0;i--){
    var b = state.balls[i];
    var dx = boss.x - b.x, dy = (boss.y - boss.h*.15) - b.y;
    var d = Math.hypot(dx,dy) || 1;
    b.vx += dx/d * 1500 * dt;
    b.vy += dy/d * 1500 * dt;
    var sp = Math.hypot(b.vx,b.vy);
    if(sp > 1900){ b.vx *= 1900/sp; b.vy *= 1900/sp; }
    if(d < boss.w*0.34 + b.r*0.4){
      damageBossRaw(b.x, b.y, Math.max(1, DMG[b.lv]*CHARS[b.lv].dmg*0.5), false, b.lv);
      burst(b.x, b.y, b.r, 8, b.lv, '#ffb0a0');
      state.balls.splice(i,1);
      Sound.squish(b.lv);
    }
  }
}

function updateBoss(dt){
  var boss = state.boss;
  if(!boss) return;
  if(boss.entrance < 1) boss.entrance = Math.min(1, boss.entrance + dt*2.2);
  if(boss.flash > 0) boss.flash = Math.max(0, boss.flash - dt*4.5);
  if(boss.invuln > 0) boss.invuln = Math.max(0, boss.invuln - dt);
  boss.hitScale += (1 - boss.hitScale) * Math.min(1, dt*14);
  if(boss.hopT > 0) boss.hopT = Math.max(0, boss.hopT - dt);
  var hop = boss.hopT > 0 ? Math.sin((1 - boss.hopT/0.7)*Math.PI) : 0;
  boss.y = boss.baseY - hop*boss.h*0.6 + Math.sin(T*1.4)*4;

  if(boss.brkT > 0){
    boss.brkT = Math.max(0, boss.brkT - dt);
    if(boss.brkT === 0){
      popText(boss.x, boss.y - boss.h*.5, '恢复', 15, '#ffb0a0');
      updateBreakHUD();
    }
  }

  /* 狂暴阶梯：每掉 25% 血加一层，攻击间隔 -8%，最多 3 层。
     有下限（不低于 3.0s），避免后期变成"刚躲完又来"。 */
  if(!boss.dead){
    var pct = boss.hp / boss.maxHp;
    var lv = pct > 0.75 ? 0 : (pct > 0.5 ? 1 : (pct > 0.25 ? 2 : 3));
    if(lv !== state.rageLv){
      state.rageLv = lv;
      state.atkEvery = Math.max(state.chapter.minAtk || 2.2, state.atkBase * Math.pow(0.95, lv));
      state.atkTimer = Math.min(state.atkTimer, state.atkEvery);
      if(lv > 0){
        popText(boss.x, boss.y - boss.h*0.62, '狂暴 ×' + lv, 17, '#ff9a6a');
        ring(boss.x, boss.y, boss.w*0.3, boss.w*1.4, '255,140,80', .5, 4);
        state.shake = Math.max(state.shake, 8);
        Sound.warn();
      }
      updateBuffs();
    }
  }
  var _enrPct = state.chapter.enragePct || 0;
  if(_enrPct > 0 && !boss.enraged && boss.hp < boss.maxHp*_enrPct && !boss.dead){
    boss.enraged = true;
    /* 狂躁：攻击间隔大幅缩短（每章不同，4~8 关 0.5~0.6 倍） */
    var _mul = state.chapter.rageMul || 0.8;
    state.atkEvery *= _mul;
    state.atkBase *= _mul;      /* 基准一起降，否则下一层狂暴会把 enrage 的加速覆盖掉 */
    state.atkTimer = Math.min(state.atkTimer, state.atkEvery);
    state.flash = Math.max(state.flash, .4);
    state.shake = Math.max(state.shake, 10);
    cssShake('m');
    popText(boss.x, boss.y - boss.h*.55, 'BOSS 狂暴！', 20, '#ff9a8a');
    Sound.warn();
    if(!state.telegraph) Sound.bgmIntensity(1);
  }

  /* 破防硬直：不移动、不闪避，站着给你打 */
  if(!boss.dead && boss.brkT <= 0){
    var enr = boss.enraged ? 1.35 : 1;
    var range = view.w * (state.chapter.range || 0.05);
    var targetX = view.cx + Math.sin(T*(0.55*enr) + boss.movePhase)*range;
    if(boss.dashT > 0){
      targetX = boss.dashX;
      boss.dashT -= dt;
      if(Math.random() < 0.35){
        state.parts.push({x:boss.x + rand(-boss.w*.2,boss.w*.2), y:boss.y + rand(-boss.h*.2,boss.h*.2),
          vx:rand(-40,40), vy:rand(-20,40), r:rand(1,2.6), life:rand(.25,.5), color:'#ff9a8a', grav:60});
      }
    }
    boss.x += (targetX - boss.x) * Math.min(1, dt*(boss.dashT > 0 ? 16 : 3.2*enr));
    boss.x = clamp(boss.x, view.left + boss.w*0.5 + 4, view.right - boss.w*0.5 - 4);

    if(boss.dodgeCd > 0) boss.dodgeCd -= dt;
    if(state.chapter.dodge > 0 && boss.dodgeCd <= 0 && !state.telegraph && state.mode === 'play' && state.cineT <= 0 && boss.dashT <= 0){
      var threat = null, threatD = 1e9;
      for(var i=0;i<state.balls.length;i++){
        var b = state.balls[i];
        if(b.dead) continue;
        var dx = boss.x - b.x, dy = (boss.y - boss.h*.08) - b.y;
        var dist = Math.hypot(dx, dy) || 1;
        if(dist > view.w*0.72) continue;
        if(dist < boss.h*0.95){ threat = b; threatD = dist; break; }
        var closing = (b.vx*dx + b.vy*dy)/dist;
        if(closing < 80) continue;
        var vv = (b.vx*b.vx + b.vy*b.vy) || 1;
        var t2 = clamp((b.vx*dx + b.vy*dy)/vv, 0, 0.42);
        var cx = b.x + b.vx*t2;
        var cy = b.y + b.vy*t2;
        var miss = Math.hypot(cx - boss.x, cy - (boss.y - boss.h*.08));
        if(miss < boss.w*0.95 + boss.h*0.75 && dist < threatD){
          threatD = dist;
          threat = b;
        }
      }
      if(threat){
        var chance = state.chapter.dodgeRate !== undefined ? state.chapter.dodgeRate : 0.7;
        if(Math.random() < chance){
          var away = boss.x >= threat.x ? 1 : -1;
          var reach = view.w*(0.20 + 0.03*Math.min(1, state.chapter.dodge));
          var dash = clamp(boss.x + away*reach, view.left + boss.w*0.5 + 6, view.right - boss.w*0.5 - 6);
          if(Math.abs(dash - boss.x) < 24){
            dash = clamp(boss.x - away*reach, view.left + boss.w*0.5 + 6, view.right - boss.w*0.5 - 6);
          }
          if(Math.abs(dash - boss.x) > 14){
            var blink = state.chapter.dodge > 0.9 && Math.random() < 0.55;
            boss.invuln = 0.34;
            ring(boss.x, boss.y - boss.h*.1, 14, 104, '255,150,120', .38, 3);
            if(blink){
              boss.x = dash;
              boss.dashT = 0.14;
              boss.dashX = dash;
            } else {
              boss.dashX = dash;
              boss.dashT = 0.28;
            }
            boss.dodgeCd = Math.max(0.38, 1.05 - state.chapter.dodge*0.5);
            if(blink || Math.random() < 0.45) popText(boss.x, boss.y - boss.h*.52, blink ? '闪现' : '闪避', 13, '#ffd0a0');
          }
        } else {
          boss.dodgeCd = 0.28;
        }
      }
    }
  }

  if(boss.dead) return;
  if(boss.brkT > 0) return;      /* 破防中不蓄力、不反击 */
  if(state.stun > 0){
    state.stun -= dt;
    boss.charge = 0;
    return;
  }
  if(state.telegraph){
    state.telegraph.t -= dt;
    boss.charge = clamp(state.telegraph.t / state.telegraph.total, 0, 1);
    if(state.interrupt >= state.interruptNeed && !boss.enraged){ interruptAttack(); return; }
    if(state.telegraph.t <= 0) executeTelegraph();
    return;
  }
  /* 多段攻击：上一段打完后短暂间隔再起第二/第三段 */
  if(state.comboQ > 0){
    state.comboT2 -= dt;
    if(state.comboT2 <= 0){
      state.comboQ--;
      beginTelegraph(true);
    }
    return;
  }
  if(state.tutHold){ state.atkTimer = Math.max(state.atkTimer, 0.6); return; }
  state.atkTimer -= dt;
  if(state.atkTimer <= 0 && state.mode === 'play'){
    beginTelegraph();
  }
}

