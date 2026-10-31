/* =========================================================
   16. 渲染
   ========================================================= */
function roundRect(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.lineTo(x+w-r,y);
  ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);
  ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);
  ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}

function drawBackground(){
  var bootEase = state.bootT < 1.8 ? (1 - easeOutCubic(clamp(state.bootT/1.8,0,1))) : 0;

  /* 1. 底色 */
  ctx.fillStyle = G.bgDeep || G.fallback;
  ctx.fillRect(-90,-90,W+180,H+180);

  /* 2. 动态层：两层柔光云相对漂移 + 上浮奶滴 */
  ctx.save();
  if(bootEase > 0.001){
    var z = 1 + bootEase*0.16;
    ctx.translate(W/2, H*0.45);
    ctx.scale(z, z);
    ctx.translate(-W/2, -H*0.45);
  }
  ctx.globalCompositeOperation = 'lighter';
  drawNebulaLayer(bgTexA,  0.055, 0.037, 1.00, 0.62);
  drawNebulaLayer(bgTexB, -0.085, 0.061, 1.16, 0.46);
  drawBgDots();
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';

  /* 3. 压暗与边角渐隐，保证 HUD 与场地的可读性 */
  ctx.fillStyle = G.bgTint;
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle = G.bgRad;
  ctx.fillRect(0,0,W,H);
}

function drawPlayfield(){
  var x = view.left, y = view.top, w = view.w, h = view.h, r = 24;
  ctx.save();
  roundRect(x,y,w,h,r);
  ctx.fillStyle = G.field;
  ctx.fill();
  ctx.clip();
  var fog = ctx.createRadialGradient(x+w*.34, y+h*.58, 0, x+w*.34, y+h*.58, w*.62);
  fog.addColorStop(0,'rgba(90,130,180,.075)');
  fog.addColorStop(1,'rgba(90,130,180,0)');
  ctx.fillStyle = fog;
  ctx.fillRect(x,y,w,h);
  var fog2 = ctx.createRadialGradient(x+w*.72, y+h*.3, 0, x+w*.72, y+h*.3, w*.5);
  fog2.addColorStop(0,'rgba(255,150,110,.05)');
  fog2.addColorStop(1,'rgba(255,150,110,0)');
  ctx.fillStyle = fog2;
  ctx.fillRect(x,y,w,h);
  ctx.fillStyle = G.fieldTop;
  ctx.fillRect(x,y,w,h*.35);
  ctx.fillStyle = G.fieldBottom;
  ctx.fillRect(x,y+h*.6,w,h*.4);
  ctx.restore();

  ctx.save();
  roundRect(x,y,w,h,r);
  ctx.lineWidth = 4.5;
  ctx.strokeStyle = 'rgba(255,190,110,.09)';
  ctx.stroke();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = 'rgba(255,220,160,.32)';
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(255,224,168,.62)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  var c = 26;
  var corners = [
    [x+6,y+6,1,1],[x+w-6,y+6,-1,1],
    [x+6,y+h-6,1,-1],[x+w-6,y+h-6,-1,-1]
  ];
  for(var i=0;i<corners.length;i++){
    var q = corners[i];
    ctx.beginPath();
    ctx.moveTo(q[0] + q[2]*c, q[1]);
    ctx.lineTo(q[0], q[1]);
    ctx.lineTo(q[0], q[1] + q[3]*c);
    ctx.stroke();
  }
  ctx.restore();

  /* launch floor glow */
  var fg = ctx.createRadialGradient(state.cannonX, view.pouchY+16, 2, state.cannonX, view.pouchY+16, view.w*0.36);
  fg.addColorStop(0,'rgba(255,190,110,.10)');
  fg.addColorStop(1,'rgba(255,190,110,0)');
  ctx.fillStyle = fg;
  ctx.fillRect(x, view.pouchY-80, w, 160);
}

/* 弹力顶棚：HUD 下沿的发光弦，球撞上会弹回并产生涟漪 */
function drawCeiling(){
  var y = view.ceil, x0 = view.left + 10, x1 = view.right - 10;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  var g = ctx.createLinearGradient(0, y-10, 0, y+14);
  g.addColorStop(0,'rgba(150,200,255,0)');
  g.addColorStop(.45,'rgba(150,200,255,.10)');
  g.addColorStop(1,'rgba(150,200,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x0, y-10, x1-x0, 24);
  /* 弦：按涟漪位置做局部下凹 */
  ctx.beginPath();
  for(var x=x0; x<=x1; x+=6){
    var dy = 0;
    for(var i=0;i<state.ceilFx.length;i++){
      var c = state.ceilFx[i], k = 1 - c.t/0.45;
      if(k <= 0) continue;
      var d = (x - c.x)/(46*view.s);
      dy += Math.exp(-d*d) * 7*view.s * k * Math.cos(c.t*30);
    }
    if(x === x0) ctx.moveTo(x, y+dy); else ctx.lineTo(x, y+dy);
  }
  ctx.strokeStyle = 'rgba(190,220,255,.42)';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  for(var j=0;j<state.ceilFx.length;j++){
    var cf = state.ceilFx[j], p = cf.t/0.45;
    if(p >= 1) continue;
    var rg = ctx.createRadialGradient(cf.x, y, 0, cf.x, y, 40*view.s);
    rg.addColorStop(0,'rgba(200,230,255,' + (0.35*(1-p)) + ')');
    rg.addColorStop(1,'rgba(200,230,255,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(cf.x - 40*view.s, y - 40*view.s, 80*view.s, 80*view.s);
  }
  ctx.restore();
}

function drawGimmicks(){
  var i;
  for(i=0;i<state.springs.length;i++){
    var sp = state.springs[i];
    var x = sp.side > 0 ? view.left + 6 : view.right - 6;
    ctx.save();
    ctx.translate(x, sp.y);
    var g = ctx.createLinearGradient(0,-sp.h/2,0,sp.h/2);
    g.addColorStop(0,'rgba(255,210,130,0)');
    g.addColorStop(.5,'rgba(255,210,130,.55)');
    g.addColorStop(1,'rgba(255,210,130,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-2, -sp.h/2, 4, sp.h);
    ctx.strokeStyle = 'rgba(255,224,168,.8)';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    for(var k=-1;k<=1;k++){
      var yy = k*sp.h*0.24;
      ctx.beginPath();
      ctx.moveTo(sp.side*8, yy-7);
      ctx.lineTo(sp.side*2, yy);
      ctx.lineTo(sp.side*8, yy+7);
      ctx.stroke();
    }
    ctx.restore();
  }
  for(i=0;i<state.portals.length;i++){
    var p = state.portals[i];
    ctx.save();
    var pg = ctx.createRadialGradient(p.x,p.y,p.r*.2,p.x,p.y,p.r*1.6);
    pg.addColorStop(0,'rgba(170,130,255,.24)');
    pg.addColorStop(1,'rgba(120,90,255,0)');
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r*1.6,0,TAU); ctx.fill();
    var inner = ctx.createRadialGradient(p.x-p.r*.3,p.y-p.r*.35,0,p.x,p.y,p.r);
    inner.addColorStop(0,'rgba(150,110,235,.55)');
    inner.addColorStop(.65,'rgba(55,28,100,.75)');
    inner.addColorStop(1,'rgba(14,7,28,.9)');
    ctx.fillStyle = inner;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r*.96,0,TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(220,200,255,.55)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r*.55, T*2.2, T*2.2+2.1); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.22)';
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r*.75, -T*1.6, -T*1.6+1.4); ctx.stroke();
    ctx.strokeStyle = 'rgba(205,180,255,.75)';
    ctx.lineWidth = 2;
    ctx.setLineDash([7,9]);
    ctx.lineDashOffset = -T*30;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
}

/* Boss 贴图还没就绪时的占位轮廓：避免出现「看不见的敌人」 */
function drawBossPlaceholder(b){
  var w = Math.max(60, view.w * 0.26), h = w * 1.1;
  var pulse = 0.5 + 0.5 * Math.sin(T * 4);
  ctx.save();
  ctx.globalAlpha = 0.55;
  var g = ctx.createRadialGradient(b.x, b.y, 4, b.x, b.y, w * 0.75);
  g.addColorStop(0, 'rgba(255,120,110,.55)');
  g.addColorStop(1, 'rgba(255,60,60,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(b.x, b.y, w * 0.75, 0, TAU); ctx.fill();
  ctx.globalAlpha = 0.7 + 0.3 * pulse;
  ctx.strokeStyle = 'rgba(255,190,150,.85)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(b.x, b.y, w * 0.36, h * 0.36, 0, 0, TAU); ctx.stroke();
  ctx.restore();
}

/* 贴图构建失败（老浏览器/个别内核）时的最后兜底：直接画原始立绘，不走离屏画布 */
function drawBossFromImage(b){
  var img = IMG[b.char];
  if(!img || !img.naturalWidth){ drawBossPlaceholder(b); return; }
  var h = view.bossH || Math.round(view.h * 0.28);
  var w = Math.round(h * img.naturalWidth / img.naturalHeight);
  var entrance = easeOutCubic(clamp(b.entrance, 0, 1));
  var sc = (0.58 + 0.42 * entrance) * (b.hitScale || 1);
  ctx.save();
  ctx.translate(b.x, b.y + (1 - entrance) * -46);
  ctx.scale(sc, sc);
  if(b.invuln > 0) ctx.globalAlpha = 0.45 + 0.25 * Math.sin(T * 38);
  try { ctx.drawImage(img, -w/2, -h/2, w, h); } catch(e) {}
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawBoss(){
  var b = state.boss;
  if(!b || b.dead) return;
  /* 慢网络兜底：buildBossTexture 只在图片全就绪时构建，开局没赶上就永远没人重试。
     这里每帧惰性重建一次；构建抛错就退回「直接画原图」，保证 Boss 一定可见。 */
  if(!bossArt){
    try { buildBossTexture(true); } catch(e) { if(window.console) console.warn('Boss 贴图构建失败，改用原图: ' + e); }
    if(!bossArt){ drawBossFromImage(b); return; }
  }
  var w = bossArtW, h = bossArtH;
  var entrance = easeOutCubic(clamp(b.entrance,0,1));
  var sc = (0.58 + 0.42*entrance) * b.hitScale;
  var x = b.x, y = b.y;
  var tilt = Math.sin(T*0.9 + b.movePhase)*0.025;

  /* 装饰层（光环/光晕）单独兜底：老内核若在这里抛错，至少别把主体立绘一起吞掉 */
  try {
  ctx.save();
  var aura = ctx.createRadialGradient(x, y-h*.05, h*.12, x, y, h*.82);
  aura.addColorStop(0,'rgba(255,60,60,.22)');
  aura.addColorStop(.55,'rgba(255,40,40,.08)');
  aura.addColorStop(1,'rgba(255,40,40,0)');
  ctx.fillStyle = aura;
  ctx.beginPath(); ctx.arc(x, y, h*.82, 0, TAU); ctx.fill();

  /* corrupted halo */
  ctx.save();
  ctx.translate(x, y - h*.02);
  ctx.rotate(T*0.12);
  for(var s=0;s<12;s++){
    var a = s/12*TAU;
    var inner = Math.max(w,h)*0.40;
    var outer = inner + (s%2 ? 13 : 22);
    ctx.beginPath();
    ctx.moveTo(Math.cos(a-0.055)*inner, Math.sin(a-0.055)*inner);
    ctx.lineTo(Math.cos(a)*outer, Math.sin(a)*outer);
    ctx.lineTo(Math.cos(a+0.055)*inner, Math.sin(a+0.055)*inner);
    ctx.closePath();
    ctx.fillStyle = 'rgba(90,0,26,.55)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,80,80,.18)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
  } catch(e) { try { ctx.restore(); } catch(_) {} }

  ctx.save();
  ctx.translate(x, y + (1-entrance)*-46);
  ctx.rotate(tilt);
  ctx.scale(sc, sc);
  if(b.invuln > 0) ctx.globalAlpha = 0.45 + 0.25*Math.sin(T*38);
  ctx.drawImage(bossArt, -w/2, -h/2, w, h);
  ctx.globalAlpha = 1;
  if(b.flash > 0){
    ctx.globalAlpha = Math.min(1, b.flash*.9);
    ctx.drawImage(bossWhite, -w/2, -h/2, w, h);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  /* 破防中：全身裂纹漏青光，告诉玩家「现在打哪都算弱点」 */
  if(b.brkT > 0){
    var bp = 0.5 + 0.5*Math.sin(T*9);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var bg2 = ctx.createRadialGradient(x, y, h*.08, x, y, h*.7);
    bg2.addColorStop(0,'rgba(170,240,255,' + (0.22 + bp*0.14) + ')');
    bg2.addColorStop(1,'rgba(90,200,255,0)');
    ctx.fillStyle = bg2;
    ctx.beginPath(); ctx.arc(x, y, h*.7, 0, TAU); ctx.fill();
    /* 裂纹：以 brkCount 为种子的固定折线，不每帧乱跳 */
    ctx.strokeStyle = 'rgba(210,250,255,' + (0.55 + bp*0.35) + ')';
    ctx.lineWidth = 1.8;
    ctx.shadowColor = 'rgba(140,230,255,.9)';
    ctx.shadowBlur = 10;
    for(var cr=0;cr<5;cr++){
      var ca2 = (cr*1.7 + b.brkCount*0.6);
      ctx.beginPath();
      ctx.moveTo(x, y - h*0.06);
      var cl = 0;
      for(var seg=1;seg<=3;seg++){
        cl += h*0.13;
        var jit = Math.sin(ca2*3 + seg*2.3)*h*0.07;
        ctx.lineTo(x + Math.cos(ca2)*cl + jit, y - h*0.06 + Math.sin(ca2)*cl);
      }
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  /* two side weak plates（破防时整体高亮为青色） */
  var pr = h*0.12;
  var pulse = 0.5 + 0.5*Math.sin(T*4.2);
  var brkOn = b.brkT > 0;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for(var sgn=-1; sgn<=1; sgn+=2){
    var px = x + sgn*w*0.30;
    var py = y + h*0.03;
    var wg = ctx.createRadialGradient(px, py, 0, px, py, pr*1.5);
    if(brkOn){
      wg.addColorStop(0,'rgba(150,235,255,' + (0.26 + pulse*0.20) + ')');
      wg.addColorStop(1,'rgba(90,200,255,0)');
    } else {
      wg.addColorStop(0,'rgba(255,150,90,' + (0.20 + pulse*0.18) + ')');
      wg.addColorStop(1,'rgba(255,90,60,0)');
    }
    ctx.fillStyle = wg;
    ctx.beginPath(); ctx.arc(px, py, pr*1.5, 0, TAU); ctx.fill();
    ctx.strokeStyle = brkOn
      ? 'rgba(170,240,255,' + (0.6 + pulse*0.3) + ')'
      : 'rgba(255,175,125,' + (0.55 + pulse*0.3) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.stroke();
    ctx.fillStyle = brkOn ? 'rgba(225,250,255,.95)' : 'rgba(255,238,205,.9)';
    ctx.beginPath(); ctx.arc(px, py, 3 + pulse*1.5, 0, TAU); ctx.fill();
  }
  ctx.restore();

  /* charge ring */
  var prog;
  if(state.telegraph) prog = 1 - state.telegraph.t/state.telegraph.total;
  else prog = clamp(1 - state.atkTimer/state.atkEvery, 0, 1);
  if(prog > 0 && state.stun <= 0 && b.brkT <= 0){
    var rr = Math.max(w,h)*0.56;
    ctx.beginPath();
    ctx.arc(x, y-h*.06, rr, -Math.PI/2, -Math.PI/2 + prog*TAU);
    ctx.lineWidth = state.telegraph ? 5 : 3.2;
    ctx.strokeStyle = state.telegraph
      ? 'rgba(255,80,66,' + (0.55 + 0.4*Math.sin(T*14)) + ')'
      : 'rgba(255,178,120,.5)';
    ctx.shadowColor = 'rgba(255,90,70,.7)';
    ctx.shadowBlur = state.telegraph ? 18 : 8;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  /* stunned stars */
  if(state.stun > 0){
    for(var s=0;s<3;s++){
      var a = T*3 + s*TAU/3;
      ctx.fillStyle = 'rgba(255,230,150,.9)';
      ctx.beginPath();
      ctx.arc(x + Math.cos(a)*w*.42, y - h*.52 + Math.sin(a)*8, 3.2, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

/* Presentation only: never write game state or consume random numbers. */
function characterInk(){
  var name = state.boss ? state.boss.char : '';
  return ({'奶狗':'255,204,97','奶兔':'167,236,177','豆奶':'255,214,155',
    '奶屎':'153,229,104','奶粉':'255,154,188','奶猫':'194,159,255',
    '奶鸡':'255,200,100','奶蛙':'112,219,255'})[name] || '255,215,150';
}
function vfxSpark(x,y,r,color,alpha){
  ctx.globalAlpha = alpha; ctx.fillStyle = color;
  ctx.beginPath();ctx.moveTo(x,y-r);ctx.lineTo(x+r*.3,y-r*.3);
  ctx.lineTo(x+r,y);ctx.lineTo(x+r*.3,y+r*.3);ctx.lineTo(x,y+r);
  ctx.lineTo(x-r*.3,y+r*.3);ctx.lineTo(x-r,y);ctx.lineTo(x-r*.3,y-r*.3);
  ctx.closePath();ctx.fill();
}
function drawCharacterSignature(){
  var b=state.boss; if(!b || b.dead) return;
  var tg=state.telegraph, hop=b.hopT>0;
  if(!tg && !hop) return;
  var ink=characterInk(), p=tg ? clamp(1-tg.t/tg.total,0,1) : 1-b.hopT/.7;
  var radius=b.h*.62;
  ctx.save();ctx.beginPath();ctx.rect(view.left,view.ceil,view.w,view.bottom-view.ceil);ctx.clip();
  ctx.strokeStyle='rgba('+ink+',.65)';ctx.lineWidth=1.6;
  if(tg){
    /* Close orbital arcs are decoration; existing red bounds indicate danger. */
    for(var i=0;i<2;i++){
      var a=T*(i ? -1.4 : 1.1)+i*Math.PI;
      ctx.beginPath();ctx.ellipse(b.x,b.y,radius*(1+i*.14),radius*.66,a*.3,a,a+Math.PI*1.4);ctx.stroke();
    }
    for(var j=0;j<7;j++){
      var a2=j*TAU/7+T*.9, rr=radius*(1.08+.08*Math.sin(T*3+j));
      vfxSpark(b.x+Math.cos(a2)*rr,b.y+Math.sin(a2)*rr*.75,2.2+p*2,'rgb('+ink+')',.3+p*.5);
    }
    ctx.globalAlpha=1;
    if(b.char==='奶猫'){
      for(var claw=-1;claw<=1;claw++){
        ctx.beginPath();ctx.moveTo(b.x+claw*10-b.w*.55,b.y-b.h*.36);
        ctx.quadraticCurveTo(b.x+claw*10,b.y-b.h*.56,b.x+claw*10+b.w*.5,b.y-b.h*.12);ctx.stroke();
      }
    }else if(b.char==='奶蛙'){
      for(var ray=0;ray<6;ray++){
        var a3=ray*TAU/6+T*.4, rx=b.x+Math.cos(a3)*radius, ry=b.y+Math.sin(a3)*radius*.7;
        ctx.beginPath();ctx.moveTo(rx,ry-8);ctx.lineTo(rx-4,ry);ctx.lineTo(rx+3,ry);ctx.lineTo(rx-2,ry+8);ctx.stroke();
      }
    }else if(b.char==='奶鸡'){
      for(var e=0;e<3;e++){
        var ex=b.x+(e-1)*b.w*.65,ey=b.y-b.h*.37+Math.sin(T*3+e)*5;
        ctx.beginPath();ctx.ellipse(ex,ey,5,7,(e-1)*.25,0,TAU);
        ctx.fillStyle='rgba(255,239,189,.8)';ctx.fill();ctx.stroke();
      }
    }
  }
  if(hop){
    var floor=b.baseY+b.h*.44, spread=b.w*(.5+p*1.2);
    ctx.globalAlpha=Math.sin(Math.PI*p)*.85;
    for(var ring=0;ring<3;ring++){
      ctx.beginPath();ctx.ellipse(b.x,floor,spread*(1-ring*.17),8+ring*5,0,0,TAU);
      ctx.lineWidth=3-ring*.7;ctx.stroke();
    }
    for(var k=-2;k<=2;k++){
      var xx=b.x+k*b.w*.26,yy=b.y+b.h*.2;
      ctx.beginPath();ctx.moveTo(xx,yy);
      if(b.char==='奶兔'){
        for(var n=1;n<=7;n++)ctx.lineTo(xx+(n%2 ? 5 : -5),yy+n*4);
      }else{
        ctx.lineTo(xx+k*5,yy+24);ctx.lineTo(xx+k*8,yy+35);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}
function drawSuck(){
  if(!state.suck || !state.boss) return;
  var b=state.boss, p=state.suck.t/state.suck.total;
  var outer=Math.min(view.w*.28,view.h*.35);
  ctx.save();ctx.beginPath();ctx.rect(view.left,view.ceil,view.w,view.bottom-view.ceil);ctx.clip();
  for(var arm=0;arm<4;arm++){
    ctx.beginPath();
    for(var k=0;k<=32;k++){
      var f=k/32, r=8+outer*f, a=arm*TAU/4+f*5.8+T*2.8;
      var x=b.x+Math.cos(a)*r,y=b.y+Math.sin(a)*r*.65;
      if(k===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    ctx.strokeStyle=arm%2 ? 'rgba(179,237,228,.48)' : 'rgba(255,218,169,.58)';
    ctx.lineWidth=1.6+p;ctx.stroke();
    for(var n=0;n<3;n++){
      var f2=1-((T*.8+n/3+arm*.11)%1),a2=arm*TAU/4+f2*5.8+T*2.8;
      vfxSpark(b.x+Math.cos(a2)*(8+outer*f2),b.y+Math.sin(a2)*(8+outer*f2)*.65,2+f2*2,arm%2 ? '#b4f8ee' : '#ffe0a8',.3+.5*f2);
    }
    ctx.globalAlpha=1;
  }
  ctx.restore();
}

/* 蓄力期危险区：红带 = 会被打中，带外 = 闪避成功。
   这是「炮台能移动」这件事唯一的可视化出口，必须画得明确。 */
function drawDangerZone(){
  var tg = state.telegraph;
  if(!tg) return;
  var p = 1 - tg.t/tg.total;
  var pulse = 0.5 + 0.5*Math.sin(T*18);
  var x0 = clamp(tg.aimX - tg.dodgeW, view.left, view.right);
  var x1 = clamp(tg.aimX + tg.dodgeW, view.left, view.right);
  var yTop = view.pouchY - 86*view.s;
  var yBot = view.bottom;
  var inZone = Math.abs(state.cannonX - tg.aimX) <= tg.dodgeW;

  ctx.save();
  /* 红色危险带 */
  var g = ctx.createLinearGradient(0, yTop, 0, yBot);
  g.addColorStop(0, 'rgba(255,60,50,0)');
  g.addColorStop(1, 'rgba(255,55,45,' + (0.16 + pulse*0.14 + p*0.12) + ')');
  ctx.fillStyle = g;
  ctx.fillRect(x0, yTop, x1-x0, yBot-yTop);

  /* 斜向警示条纹 */
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, yTop, x1-x0, yBot-yTop);
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,110,90,' + (0.12 + pulse*0.08) + ')';
  ctx.lineWidth = 7;
  var off = (T*34) % 26;
  for(var sx = x0 - (yBot-yTop) - 26; sx < x1 + 26; sx += 26){
    ctx.beginPath();
    ctx.moveTo(sx + off, yBot);
    ctx.lineTo(sx + off + (yBot-yTop), yTop);
    ctx.stroke();
  }
  ctx.restore();

  /* 边界线 */
  ctx.strokeStyle = 'rgba(255,120,95,' + (0.6 + pulse*0.35) + ')';
  ctx.lineWidth = 2;
  ctx.setLineDash([8,6]);
  ctx.lineDashOffset = -T*26;
  ctx.beginPath(); ctx.moveTo(x0, yTop); ctx.lineTo(x0, yBot); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x1, yTop); ctx.lineTo(x1, yBot); ctx.stroke();
  ctx.setLineDash([]);

  /* 安全方向箭头：只在还站在红区里时提示往哪跑 */
  if(inZone){
    var leftRoom = x0 - view.left, rightRoom = view.right - x1;
    var dir = rightRoom >= leftRoom ? 1 : -1;
    var ax = dir > 0 ? Math.min(view.right - 22, x1 + 26) : Math.max(view.left + 22, x0 - 26);
    var ay = view.pouchY - 14*view.s;
    var sw = 0.5 + 0.5*Math.sin(T*7);
    ctx.globalAlpha = 0.55 + sw*0.45;
    ctx.fillStyle = 'rgba(150,235,255,.95)';
    for(var k=0;k<3;k++){
      var bx = ax + dir*k*13 + dir*sw*5;
      ctx.beginPath();
      ctx.moveTo(bx, ay - 9);
      ctx.lineTo(bx + dir*10, ay);
      ctx.lineTo(bx, ay + 9);
      ctx.closePath();
      ctx.globalAlpha = (0.75 - k*0.2) * (0.6 + sw*0.4);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* 倒计时与招式名 */
  ctx.textAlign = 'center';
  ctx.fillStyle = inZone ? 'rgba(255,150,130,.95)' : 'rgba(170,240,255,.95)';
  ctx.font = '900 ' + (12*view.s) + 'px ' + FONT;
  ctx.fillText(
    (inZone ? '⚠ ' : '✓ ') + tg.atkName + '  ' + Math.max(0, tg.t).toFixed(1) + 's',
    clamp(tg.aimX, view.left + 70, view.right - 70), yTop - 8);
  ctx.restore();
}

function drawTelegraph(){
  var tg = state.telegraph;
  if(!tg) return;
  drawDangerZone();

  if(tg.type === 'thunder'){
    var w = Math.max(34, view.w*0.10);
    var pulse = 0.5 + 0.5*Math.sin(T*22);
    ctx.save();
    var g = ctx.createLinearGradient(tg.x-w/2, 0, tg.x+w/2, 0);
    g.addColorStop(0,'rgba(255,50,40,0)');
    g.addColorStop(.5,'rgba(255,60,50,' + (0.10 + pulse*0.16) + ')');
    g.addColorStop(1,'rgba(255,50,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(tg.x-w/2, view.top, w, view.bottom-view.top);
    ctx.strokeStyle = 'rgba(255,110,90,' + (0.4 + pulse*0.4) + ')';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([6,8]);
    ctx.beginPath(); ctx.moveTo(tg.x, view.top); ctx.lineTo(tg.x, view.bottom); ctx.stroke();
    ctx.restore();
  }
  if(tg.type === 'hop'){
    var b = state.boss;
    ctx.save();
    for(var i=0;i<3;i++){
      var a = T*3 + i*TAU/3;
      ctx.beginPath();
      ctx.arc(b.x + Math.cos(a)*b.r*1.05, b.y + Math.sin(a)*b.r*1.05, 4+Math.sin(T*12+i)*2, 0, TAU);
      ctx.fillStyle = 'rgba(255,90,70,.5)';
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawOrbAt(x,y,r,lv,alpha,tilt){
  if(r < 0.5) return;
  var tex = orbTex[lv];
  ctx.save();
  if(alpha !== undefined && alpha < 1) ctx.globalAlpha = alpha;
  ctx.translate(x,y);
  if(tilt) ctx.rotate(tilt);
  if(tex){
    var d = r*2*tex.pad;
    ctx.drawImage(tex.c, -r*tex.pad, -r*tex.pad, d, d);
  } else {
    paintOrb(ctx, r, IMG[CHARS[lv].n]);
  }
  ctx.restore();
}

function drawBalls(){
  var balls = state.balls;
  for(var i=0;i<balls.length;i++){
    var b = balls[i];
    if(b.dead) continue;
    var alpha = 1;
    if(b.life < 2.6) alpha = 0.35 + 0.65*Math.abs(Math.sin(T*9 + i));
    var sq = 1 + b.sq*0.18;
    ctx.save();
    /* 速度拖尾：等级与反弹数越高越长越亮 */
    if(b.trail.length > 1){
      var tc = b.bounce >= 4 ? '255,150,80' : (b.bounce >= 2 ? '255,195,110' : '255,225,165');
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for(var ti=0;ti<b.trail.length;ti++){
        var tp = b.trail[ti];
        var tf = (ti+1)/b.trail.length;
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, b.r*0.30*tf + b.r*0.18, 0, TAU);
        ctx.fillStyle = 'rgba(' + tc + ',' + (0.07 + tf*0.17) + ')';
        ctx.fill();
      }
      ctx.restore();
    }
    if(b.bounce >= 2){
      var sp = Math.hypot(b.vx,b.vy) || 1;
      ctx.globalAlpha = 0.18;
      drawOrbAt(b.x - b.vx/sp*b.r*1.2, b.y - b.vy/sp*b.r*1.2, b.r*0.85, b.lv, 1, b.tilt);
      ctx.globalAlpha = 1;
    }
    if(b.lv >= 2 || b.bounce > 0){
      var gl = ctx.createRadialGradient(b.x,b.y,b.r*.7,b.x,b.y,b.r*1.7);
      gl.addColorStop(0, b.bounce >= 3 ? 'rgba(255,150,80,.28)' : 'rgba(255,200,110,.18)');
      gl.addColorStop(1,'rgba(255,200,110,0)');
      ctx.fillStyle = gl;
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r*1.7,0,TAU); ctx.fill();
    }
    ctx.translate(b.x,b.y);
    ctx.scale(sq, 2-sq);
    ctx.translate(-b.x,-b.y);
    drawOrbAt(b.x, b.y, b.r, b.lv, alpha, b.tilt);
    if(b.lv >= 2 || b.bounce > 0){
      var hotBall = b.bounce >= 4;
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r+3.5,0,TAU);
      ctx.strokeStyle = hotBall
        ? 'rgba(255,120,70,' + (0.5 + 0.25*Math.sin(T*12)) + ')'
        : 'rgba(255,210,130,' + (0.16 + Math.min(.3, b.lv*0.03)) + ')';
      ctx.lineWidth = hotBall ? 2 : 1.2;
      ctx.stroke();
    }
    if(b.bounce >= 3){
      ctx.fillStyle = 'rgba(255,190,120,.9)';
      ctx.font = '900 ' + Math.max(8, b.r*0.42) + 'px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('×' + (b.bounce+1), b.x, b.y - b.r - 6);
    }
    ctx.restore();
  }
}

function drawRocks(){
  for(var i=0;i<state.rocks.length;i++){
    var rk = state.rocks[i];
    ctx.save();
    if(rk.life < 1.6) ctx.globalAlpha = 0.3 + 0.7*Math.abs(Math.sin(T*8));
    ctx.translate(rk.x, rk.y);
    ctx.rotate(rk.rot);
    var g = ctx.createRadialGradient(-rk.r*.35,-rk.r*.4,rk.r*.1, 0,0,rk.r*1.1);
    var eggSkin=state.boss && state.boss.char==='奶鸡';
    g.addColorStop(0,eggSkin ? '#fff8d8' : '#9aa2ad');
    g.addColorStop(.55,eggSkin ? '#e8ca86' : '#5b626c');
    g.addColorStop(1,eggSkin ? '#ae763c' : '#2b3038');
    ctx.beginPath(); ctx.arc(0,0,rk.r,0,TAU);
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(20,24,30,.8)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if(eggSkin){
      ctx.fillStyle='rgba(151,89,34,.55)';
      for(var spot=0;spot<4;spot++){
        var sa=spot*2.4;ctx.beginPath();ctx.ellipse(Math.cos(sa)*rk.r*.53,Math.sin(sa)*rk.r*.53,rk.r*.13,rk.r*.09,sa,0,TAU);ctx.fill();
      }
    }
    ctx.strokeStyle = eggSkin ? 'rgba(174,115,51,.3)' : 'rgba(20,26,34,.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-rk.r*.5, -rk.r*.1); ctx.lineTo(-rk.r*.05, -rk.r*.35); ctx.lineTo(rk.r*.4, -rk.r*.05);
    ctx.moveTo(-rk.r*.2, rk.r*.35); ctx.lineTo(rk.r*.15, rk.r*.1);
    ctx.stroke();
    ctx.restore();
  }
}

function drawDust(){
  if(!state.dust.length) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for(var i=0;i<state.dust.length;i++){
    var du = state.dust[i];
    var a = du.a*(0.55 + 0.45*Math.sin(T*1.3 + du.ph));
    ctx.fillStyle = 'rgba(255,222,160,' + a + ')';
    ctx.beginPath(); ctx.arc(du.x, du.y, du.r, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function drawBumpers(){
  for(var i=0;i<state.bumpers.length;i++){
    var bp = state.bumpers[i];
    ctx.save();
    ctx.translate(bp.x, bp.y);
    var g = ctx.createRadialGradient(0,0,bp.r*.2,0,0,bp.r*2);
    g.addColorStop(0,'rgba(255,200,110,.26)');
    g.addColorStop(1,'rgba(255,170,70,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0,0,bp.r*2,0,TAU); ctx.fill();
    var bgr = ctx.createRadialGradient(-bp.r*.3,-bp.r*.3,bp.r*.1, 0,0,bp.r);
    bgr.addColorStop(0,'rgba(64,46,28,.96)');
    bgr.addColorStop(1,'rgba(20,12,6,.96)');
    ctx.beginPath(); ctx.arc(0,0,bp.r,0,TAU);
    ctx.fillStyle = bgr; ctx.fill();
    ctx.strokeStyle = 'rgba(255,214,140,.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.rotate(T*1.2 + i);
    ctx.beginPath();
    for(var k=0;k<3;k++){
      var a = -Math.PI/2 + k*TAU/3;
      if(k===0) ctx.moveTo(Math.cos(a)*bp.r*.62, Math.sin(a)*bp.r*.62);
      else ctx.lineTo(Math.cos(a)*bp.r*.62, Math.sin(a)*bp.r*.62);
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255,230,170,.55)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.beginPath(); ctx.arc(0,0,3.2,0,TAU);
    ctx.fillStyle = '#ffe9b0'; ctx.fill();
    ctx.restore();
  }
}

function drawPlates(){
  for(var i=0;i<state.plates.length;i++){
    var pl = state.plates[i];
    /* 最后 3 秒闪烁提示即将消失 */
    var fade = pl.life < 3 ? (0.35 + 0.65*Math.abs(Math.sin(T*7))) : 1;
    var hit = pl.hit > 0 ? pl.hit/0.25 : 0;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(pl.x, pl.y);
    ctx.rotate(pl.ang);
    var half = pl.len/2, th = pl.thick;

    /* 外发光 */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var gl = ctx.createLinearGradient(0, -th*3.4, 0, th*3.4);
    gl.addColorStop(0,'rgba(120,255,205,0)');
    gl.addColorStop(.5,'rgba(120,255,205,' + (0.14 + hit*0.4) + ')');
    gl.addColorStop(1,'rgba(120,255,205,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(-half-6, -th*3.4, pl.len+12, th*6.8);
    ctx.restore();

    /* 板体 */
    var bg = ctx.createLinearGradient(0,-th,0,th);
    bg.addColorStop(0,'rgba(190,255,230,' + (0.92 + hit*0.08) + ')');
    bg.addColorStop(.45,'rgba(80,205,165,.95)');
    bg.addColorStop(1,'rgba(18,70,58,.95)');
    roundRect(-half, -th, pl.len, th*2, th);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(210,255,240,' + (0.7 + hit*0.3) + ')';
    ctx.lineWidth = 1.4 + hit*1.6;
    ctx.stroke();

    /* 表面纹路 */
    ctx.strokeStyle = 'rgba(255,255,255,.28)';
    ctx.lineWidth = 1;
    for(var k=-2;k<=2;k++){
      var kx = k*pl.len*0.17;
      ctx.beginPath();
      ctx.moveTo(kx, -th*0.55);
      ctx.lineTo(kx, th*0.55);
      ctx.stroke();
    }
    /* 命中瞬间白闪 */
    if(hit > 0){
      roundRect(-half, -th, pl.len, th*2, th);
      ctx.fillStyle = 'rgba(255,255,255,' + (hit*0.55) + ')';
      ctx.fill();
    }
    ctx.restore();
  }
}

/* 放置预览：跟随手指的半透明反弹板 + 虚线框 */
function drawPlateGhost(){
  var g = state.placingPlate;
  if(!g) return;
  var len = plateLen(), th = 5.5*view.s, half = len/2;
  var pulse = 0.5 + 0.22*Math.sin(T*6.5);
  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.rotate(g.ang);
  ctx.globalAlpha = pulse;
  var bg = ctx.createLinearGradient(0,-th,0,th);
  bg.addColorStop(0,'rgba(190,255,230,.95)');
  bg.addColorStop(.5,'rgba(80,205,165,.9)');
  bg.addColorStop(1,'rgba(18,70,58,.92)');
  roundRect(-half, -th, len, th*2, th);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.setLineDash([6,5]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(220,255,245,.95)';
  ctx.stroke();
  ctx.setLineDash([]);
  /* 四角定位点 */
  ctx.fillStyle = 'rgba(235,255,248,.9)';
  ctx.beginPath(); ctx.arc(-half-7, 0, 2.6, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(half+7, 0, 2.6, 0, TAU); ctx.fill();
  ctx.restore();

  /* 落位辅助线：从板心到地面，帮玩家判断位置 */
  ctx.save();
  ctx.globalAlpha = 0.16 + 0.06*Math.sin(T*5);
  ctx.strokeStyle = 'rgba(160,255,215,1)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3,7]);
  ctx.beginPath();
  ctx.moveTo(g.x, g.y + th + 6);
  ctx.lineTo(g.x, view.pouchY + 10*view.s);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  /* 角度环 + 度数：第二根手指旋转时能直接看到变化 */
  var ringR = Math.max(30, len*0.72);
  var deg = Math.round(g.ang * 180 / Math.PI);
  deg = ((deg % 360) + 360) % 360;
  ctx.save();
  ctx.globalAlpha = 0.75;
  ctx.strokeStyle = 'rgba(170,255,228,.35)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(g.x, g.y, ringR, 0, TAU);
  ctx.stroke();
  /* 法线指示：球会被往这个方向弹回去 */
  var nx = -Math.sin(g.ang), ny = Math.cos(g.ang);
  ctx.strokeStyle = 'rgba(255,240,180,.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(g.x + nx*ringR*0.35, g.y + ny*ringR*0.35);
  ctx.lineTo(g.x + nx*ringR*0.95, g.y + ny*ringR*0.95);
  ctx.stroke();
  ctx.globalAlpha = 0.95;
  ctx.font = '700 ' + Math.round(12*view.s + 2) + 'px ' + FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(210,255,240,.92)';
  ctx.fillText(deg + '°', g.x, g.y - ringR - 11);
  ctx.restore();
}

function drawItems(){
  for(var i=0;i<state.items.length;i++){
    var it = state.items[i];
    var y = it.y + Math.sin(T*2.2 + it.ph)*5;
    var col = it.kind === 'super' ? ['#fff3b0','#ffbe4a',255,220,120]
      : it.kind === 'shield' ? ['#d6f4ff','#5ab8ff',130,210,255]
      : ['#ffd0c0','#ff5a4a',255,120,90];
    ctx.save();
    var g = ctx.createRadialGradient(it.x,y,it.r*.2,it.x,y,it.r*2.2);
    g.addColorStop(0,'rgba('+col[2]+','+col[3]+','+col[4]+',.35)');
    g.addColorStop(1,'rgba('+col[2]+','+col[3]+','+col[4]+',0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(it.x,y,it.r*2.2,0,TAU); ctx.fill();
    ctx.strokeStyle = 'rgba('+col[2]+','+col[3]+','+col[4]+',.6)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4,6]);
    ctx.lineDashOffset = -T*24;
    ctx.beginPath(); ctx.arc(it.x,y,it.r*1.5,0,TAU); ctx.stroke();
    ctx.setLineDash([]);
    var bg = ctx.createRadialGradient(it.x-it.r*.3,y-it.r*.35,0,it.x,y,it.r);
    bg.addColorStop(0,col[0]);
    bg.addColorStop(1,col[1]);
    ctx.beginPath(); ctx.arc(it.x,y,it.r,0,TAU);
    ctx.fillStyle = bg; ctx.fill();
    ctx.fillStyle = 'rgba(50,25,5,.85)';
    ctx.font = '900 ' + (it.r*1.05) + 'px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(it.kind === 'super' ? '超' : (it.kind === 'shield' ? '盾' : '暴'), it.x, y+1);
    ctx.restore();
  }
}

function drawAtkAnim(){
  var a = state.atkAnim;
  if(!a || !state.boss) return;
  var boss = state.boss;
  var p = 1 - a.t/a.total;
  ctx.save();
  if(a.type === 'laugh'){
    ctx.globalCompositeOperation = 'lighter';
    for(var i=0;i<4;i++){
      var rr = boss.w*0.28 + (p*1.7 + i*0.16)*boss.w;
      var al = Math.max(0, (1-p)*0.75 - i*0.12);
      ctx.beginPath();
      ctx.arc(boss.x, boss.y - boss.h*.12, rr, 0, TAU);
      ctx.strokeStyle = 'rgba(255,210,120,' + al + ')';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      for(var note=0;note<5;note++){
        var na=note*TAU/5+p*1.8+i*.7;
        vfxSpark(boss.x+Math.cos(na)*rr,boss.y-boss.h*.12+Math.sin(na)*rr,3.4,'#ffe9a9',al);
      }
      ctx.globalAlpha=1;
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(255,235,185,' + (0.95*(1-p)) + ')';
    ctx.font = '900 ' + (boss.h*0.14) + 'px ' + FONT;
    ctx.textAlign = 'center';
    for(var k=0;k<6;k++){
      var ang = -Math.PI/2 + (k-2.5)*0.42;
      var rad = boss.w*(0.42 + p*0.85);
      var hx = boss.x + Math.cos(ang)*rad;
      var hy = boss.y - boss.h*.12 + Math.sin(ang)*rad;
      hx = clamp(hx, view.left + 18, view.right - 18);
      hy = Math.max(view.top + 22, hy);
      ctx.fillText('哈', hx, hy);
    }
  } else if(a.type === 'fart'){
    var gy = boss.y + boss.h*.26;
    for(var g=0;g<3;g++){
      var gx = boss.x + Math.sin(g*2.1 + p*3)*boss.w*.35;
      var gr = boss.w*(0.28 + p*(0.5+g*0.12));
      var gg = ctx.createRadialGradient(gx, gy + g*boss.h*.08, 4, gx, gy + g*boss.h*.08, gr);
      gg.addColorStop(0,'rgba(150,215,85,' + (0.5*(1-p*0.5)) + ')');
      gg.addColorStop(1,'rgba(80,140,40,0)');
      ctx.fillStyle = gg;
      ctx.beginPath(); ctx.arc(gx, gy + g*boss.h*.08, gr, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = 'rgba(190,235,130,' + (0.85*(1-p*0.6)) + ')';
    ctx.font = '900 ' + (boss.h*0.2) + 'px ' + FONT;
    ctx.textAlign = 'center';
    for(var bubble=0;bubble<12;bubble++){
      var phase=(bubble*.137+p*.65)%1;
      var bx=boss.x+Math.sin(bubble*2.4+p*2)*boss.w*(.3+p*.55);
      var by=gy+24+phase*boss.h*.65;
      var br=3+(bubble%4)*2;
      ctx.beginPath();ctx.arc(bx,by,br,0,TAU);
      ctx.strokeStyle='rgba(191,247,123,'+((1-p)*.7)+')';ctx.lineWidth=1.2;ctx.stroke();
      ctx.beginPath();ctx.arc(bx-br*.25,by-br*.25,br*.2,0,TAU);
      ctx.fillStyle='rgba(231,255,177,'+((1-p)*.7)+')';ctx.fill();
    }
  }
  ctx.restore();
}

function drawLauncher(){
  var home = {x: state.cannonX, y: view.pouchY};
  var a = state.aim;
  var pull = a.active ? a.pull : 0;
  var pouch = {
    x: home.x - a.dx*pull*0.22,
    y: home.y - a.dy*pull*0.22
  };
  var prong = 27*view.s;
  var topY = home.y - 44*view.s;
  var hot = a.active && a.power >= 0.9;

  ctx.save();
  /* cannon rail */
  var rx0 = view.left + 16*view.s, rx1 = view.right - 16*view.s;
  ctx.strokeStyle = 'rgba(255,220,160,.10)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(rx0, home.y + 40*view.s); ctx.lineTo(rx1, home.y + 40*view.s); ctx.stroke();
  for(var ri=0; ri<=8; ri++){
    var rrx = rx0 + (rx1-rx0)*ri/8;
    ctx.beginPath(); ctx.moveTo(rrx, home.y + 37*view.s); ctx.lineTo(rrx, home.y + 43*view.s); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,220,160,.7)';
  ctx.beginPath(); ctx.arc(home.x, home.y + 40*view.s, 2.4*view.s, 0, TAU); ctx.fill();

  /* pedestal */
  var baseG = ctx.createLinearGradient(0, home.y+10, 0, home.y+40);
  baseG.addColorStop(0,'rgba(60,44,26,.9)');
  baseG.addColorStop(1,'rgba(24,16,10,.9)');
  ctx.fillStyle = baseG;
  roundRect(home.x-30*view.s, home.y+14, 60*view.s, 22*view.s, 8*view.s);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,210,130,.35)';
  ctx.lineWidth = 1;
  ctx.stroke();

  /* prongs */
  for(var s=-1;s<=1;s+=2){
    var px = home.x + s*prong;
    ctx.beginPath();
    ctx.moveTo(px, home.y+18*view.s);
    ctx.quadraticCurveTo(px + s*6*view.s, home.y-6, px + s*3*view.s, topY);
    ctx.lineCap = 'round';
    ctx.lineWidth = 7*view.s;
    ctx.strokeStyle = '#3a2616';
    ctx.stroke();
    ctx.lineWidth = 3*view.s;
    ctx.strokeStyle = 'rgba(255,200,120,.5)';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(px + s*3*view.s, topY, 4*view.s, 0, TAU);
    ctx.fillStyle = '#ffd98f';
    ctx.fill();
  }

  /* bands */
  var bandColor = hot ? '#ff5a4c' : '#a8382f';
  ctx.strokeStyle = bandColor;
  ctx.lineWidth = 4*view.s;
  ctx.lineCap = 'round';
  for(s=-1;s<=1;s+=2){
    var tipX = home.x + s*prong + s*3*view.s;
    ctx.beginPath();
    ctx.moveTo(tipX, topY);
    ctx.lineTo(pouch.x, pouch.y);
    ctx.stroke();
  }
  if(hot){
    ctx.shadowColor = 'rgba(255,70,50,.8)';
    ctx.shadowBlur = 14;
    for(s=-1;s<=1;s+=2){
      var tx = home.x + s*prong + s*3*view.s;
      ctx.beginPath(); ctx.moveTo(tx, topY); ctx.lineTo(pouch.x, pouch.y); ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }

  /* pouch ball */
  if(state.mode === 'play' || state.mode === 'victory'){
    if(state.reloadT <= 0.02){
      var lv = state.loadLv;
      var r = RADII[lv];
      var bob = a.active ? 0 : Math.sin(T*2.2)*1.6;
      if(state.superT > 0){
        var sg = ctx.createRadialGradient(pouch.x, pouch.y+bob, r*.4, pouch.x, pouch.y+bob, r*2.2);
        sg.addColorStop(0,'rgba(255,220,120,.5)');
        sg.addColorStop(.6,'rgba(255,180,60,.16)');
        sg.addColorStop(1,'rgba(255,180,60,0)');
        ctx.fillStyle = sg;
        ctx.beginPath(); ctx.arc(pouch.x, pouch.y+bob, r*2.2, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,230,150,.9)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5,7]);
        ctx.lineDashOffset = -T*30;
        ctx.beginPath(); ctx.arc(pouch.x, pouch.y+bob, r*1.35, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
      }
      drawOrbAt(pouch.x, pouch.y + bob, r, lv, 1, 0);
      if(state.superT > 0){
        ctx.fillStyle = 'rgba(255,240,180,.95)';
        ctx.font = '900 ' + (9*view.s) + 'px ' + FONT;
        ctx.textAlign = 'center';
        ctx.fillText('超级奶娃', pouch.x, pouch.y + r + 16*view.s);
      }
    } else {
      ctx.beginPath();
      ctx.arc(pouch.x, pouch.y, RADII[state.loadLv]*0.8, 0, TAU);
      ctx.setLineDash([3,6]);
      ctx.strokeStyle = 'rgba(255,220,160,.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  /* power gauge */
  if(a.active){
    var gr = 52*view.s;
    ctx.beginPath();
    ctx.arc(home.x, home.y - 8, gr, -Math.PI*0.82, -Math.PI*0.18);
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255,255,255,.10)';
    ctx.stroke();
    var start = -Math.PI*0.82, span = Math.PI*0.64*a.power;
    ctx.beginPath();
    ctx.arc(home.x, home.y - 8, gr, start, start+span);
    ctx.lineWidth = 4;
    ctx.strokeStyle = hot ? '#ff4f45' : '#ffce7a';
    ctx.shadowColor = hot ? 'rgba(255,70,50,.8)' : 'rgba(255,200,110,.6)';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = hot ? 'rgba(255,90,70,.95)' : 'rgba(255,236,200,.8)';
    ctx.font = '900 ' + (10*view.s) + 'px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText(hot ? 'MAX' : Math.round(a.power*100) + '%', home.x, home.y - gr - 10);
  }

  /* first-shot hint */
  if(state.mode === 'play' && (state.timeMax - state.timer) < 5 && !state.aim.active && !state.telegraph){
    ctx.save();
    ctx.globalAlpha = 0.55 + 0.25*Math.sin(T*2.4);
    ctx.fillStyle = 'rgba(255,238,205,.9)';
    ctx.font = '600 ' + (10.5*view.s) + 'px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('右摇杆下拉蓄力 · 松手发射', view.cx, home.y - 92*view.s);
    ctx.restore();
  }
  ctx.restore();
}

function predictPath(){
  var a = state.aim;
  var lv = state.loadLv;
  var r = RADII[lv];
  var speed = (640 + 860*a.power) * state.eff.power * state.eff.ballSpeed;
  var ox = state.cannonX - a.dx*a.pull*0.22;
  var oy = view.pouchY - a.dy*a.pull*0.22;
  var x = ox + a.dx*(r+8);
  var y = oy + a.dy*(r+8);
  var vx = a.dx*speed, vy = a.dy*speed;
  var pts = [];
  var bounces = 0;
  var hitBoss = false;
  var dt = 1/60;
  var boss = state.boss;
  for(var i=0;i<130;i++){
    x += vx*dt; y += vy*dt;
    if(x-r < view.left){ x = view.left+r; vx = Math.abs(vx)*0.94; bounces++; }
    else if(x+r > view.right){ x = view.right-r; vx = -Math.abs(vx)*0.94; bounces++; }
    /* 顶棚反弹、底部出界（与 ballWall 一致） */
    if(y-r < view.ceil){ y = view.ceil+r; vy = Math.abs(vy)*0.8; bounces++; }
    if(y+r > view.bottom) break;
    /* 与 bossHitCheck 使用同一椭圆判定，预测线才不会骗人 */
    if(boss && !boss.dead){
      var ex = (x - boss.x)/(boss.w*0.34), ey = (y - boss.y)/(boss.h*0.30);
      if(ex*ex + ey*ey <= 1){ pts.push({x:x,y:y,hit:true}); hitBoss = true; break; }
    }
    if(i%2 === 0) pts.push({x:x,y:y});
    if(bounces > 2) break;
  }
  return {pts:pts, hit: hitBoss};
}

/* 眩晕表现：炮台上方三颗绕圈的金色小星 + 一圈脉动光晕 */
function drawStun(){
  if(!(state.stunT > 0)) return;
  var fade = Math.min(1, state.stunT / 0.25);
  var cy = view.pouchY - 66*view.s;
  var R = 30*view.s;

  ctx.save();
  ctx.globalAlpha = 0.85 * fade;
  /* 脉动光晕，提示"现在动不了" */
  var g = ctx.createRadialGradient(state.cannonX, cy, 0, state.cannonX, cy, R*1.8);
  g.addColorStop(0, 'rgba(255,209,102,.28)');
  g.addColorStop(1, 'rgba(255,209,102,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(state.cannonX, cy, R*1.8, 0, TAU); ctx.fill();

  ctx.globalCompositeOperation = 'lighter';
  for(var i=0;i<3;i++){
    var a = T*7 + i*TAU/3;
    var x = state.cannonX + Math.cos(a)*R;
    var y = cy + Math.sin(a)*R*0.42;
    var rr = (4.2 + 1.2*Math.sin(T*9 + i)) * view.s;
    var sg = ctx.createRadialGradient(x, y, 0, x, y, rr*3);
    sg.addColorStop(0, 'rgba(255,236,170,.95)');
    sg.addColorStop(.45,'rgba(255,200,90,.55)');
    sg.addColorStop(1, 'rgba(255,190,70,0)');
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.arc(x, y, rr*3, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,248,222,.95)';
    ctx.beginPath(); ctx.arc(x, y, rr*0.8, 0, TAU); ctx.fill();
  }
  ctx.restore();

}

function drawAim(){
  if(!state.aim.active || state.mode !== 'play') return;
  var a = state.aim;
  if(a.power < 0.05) return;
  var hot = a.power >= 0.9;
  var pred = predictPath();
  ctx.save();
  for(var i=0;i<pred.pts.length;i++){
    var p = pred.pts[i];
    var t = i/pred.pts.length;
    var sz = (hot ? 3.0 : 2.6) * (1-t*0.4);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.hit ? 7 : sz, 0, TAU);
    if(p.hit){
      ctx.strokeStyle = 'rgba(255,80,60,.95)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath(); ctx.arc(p.x,p.y,2.5,0,TAU);
      ctx.fillStyle = 'rgba(255,90,70,.95)';
      ctx.fill();
    } else {
      ctx.fillStyle = hot
        ? 'rgba(255,92,70,' + (0.75 - t*0.45) + ')'
        : 'rgba(255,226,170,' + (0.72 - t*0.45) + ')';
      ctx.fill();
    }
  }
  /* direction arrow */
  var r = RADII[state.loadLv];
  var sx = state.cannonX + a.dx*(r+16);
  var sy = view.pouchY + a.dy*(r+16);
  var ex = sx + a.dx*30, ey = sy + a.dy*30;
  ctx.strokeStyle = hot ? 'rgba(255,90,70,.9)' : 'rgba(255,230,180,.65)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(ex,ey); ctx.stroke();
  var ang = Math.atan2(a.dy,a.dx);
  ctx.beginPath();
  ctx.moveTo(ex,ey);
  ctx.lineTo(ex - Math.cos(ang-0.4)*8, ey - Math.sin(ang-0.4)*8);
  ctx.lineTo(ex - Math.cos(ang+0.4)*8, ey - Math.sin(ang+0.4)*8);
  ctx.closePath();
  ctx.fillStyle = hot ? 'rgba(255,90,70,.9)' : 'rgba(255,230,180,.65)';
  ctx.fill();
  ctx.restore();
}

function drawEffects(){
  var i;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for(i=0;i<state.rings.length;i++){
    var r = state.rings[i];
    var p = r.t/r.span;
    var rr = lerp(r.r0, r.r1, easeOutCubic(p));
    ctx.beginPath();
    ctx.arc(r.x, r.y, rr, 0, TAU);
    ctx.lineWidth = Math.max(.6, r.width*(1-p));
    ctx.strokeStyle = 'rgba(' + r.color + ',' + ((1-p)*.7) + ')';
    ctx.stroke();
  }
  for(i=0;i<state.bolts.length;i++){
    var bo = state.bolts[i];
    var al = 1 - bo.t/bo.span;
    ctx.beginPath();
    for(var k=0;k<bo.pts.length;k++){
      if(k===0) ctx.moveTo(bo.pts[k].x, bo.pts[k].y);
      else ctx.lineTo(bo.pts[k].x, bo.pts[k].y);
    }
    ctx.strokeStyle = 'rgba(170,214,255,' + (al*.8) + ')';
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(120,190,255,.9)';
    ctx.shadowBlur = 20;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,' + (al*.95) + ')';
    ctx.lineWidth = 1;
    ctx.shadowBlur = 5;
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  if(state.beam){
    var bm = state.beam;
    var a2 = bm.t/bm.total;
    var bg = ctx.createLinearGradient(bm.x-bm.w/2, 0, bm.x+bm.w/2, 0);
    var beamInk=characterInk();
    bg.addColorStop(0,'rgba('+beamInk+',0)');
    bg.addColorStop(.5,'rgba('+beamInk+','+(a2*.85)+')');
    bg.addColorStop(1,'rgba('+beamInk+',0)');
    ctx.fillStyle = bg;
    ctx.fillRect(bm.x-bm.w/2, view.top, bm.w, view.bottom-view.top);
    ctx.fillStyle = 'rgba(255,255,255,' + (a2*.6) + ')';
    ctx.fillRect(bm.x-3, view.top, 6, view.bottom-view.top);
    ctx.save();ctx.beginPath();ctx.rect(bm.x-bm.w/2,view.top,bm.w,view.h);ctx.clip();
    ctx.strokeStyle='rgba('+beamInk+','+(a2*.9)+')';ctx.lineWidth=1.6;
    for(var strand=0;strand<3;strand++){
      ctx.beginPath();
      for(var seg=0;seg<=20;seg++){
        var yy=view.top+view.h*seg/20;
        var xx=bm.x+Math.sin(seg*(state.boss.char==='奶猫' ? .55 : 2.3)+T*15+strand*2.1)*bm.w*.36;
        if(seg===0)ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  for(i=0;i<state.springFx.length;i++){
    var sf = state.springFx[i];
    var sp = sf.t/sf.span;
    ctx.beginPath();
    ctx.arc(sf.x, sf.y, sf.r*(.4+sp*1.4), 0, TAU);
    ctx.strokeStyle = 'rgba(' + sf.color + ',' + ((1-sp)*.6) + ')';
    ctx.lineWidth = 3*(1-sp)+1;
    ctx.stroke();
  }

  for(i=0;i<state.parts.length;i++){
    var p2 = state.parts[i];
    var al2 = clamp(p2.life, 0, 1);
    ctx.fillStyle = p2.color;
    ctx.globalAlpha = al2*0.85;
    ctx.beginPath();
    ctx.arc(p2.x, p2.y, Math.max(.4, p2.r*al2), 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  /* coins */
  for(i=0;i<state.coins.length;i++){
    var c = state.coins[i];
    if(c.delay > 0) continue;
    var sc = 1 + 0.2*Math.sin(T*10 + c.spin);
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(sc, Math.abs(Math.cos(c.spin))*0.7 + 0.3);
    var cg = ctx.createRadialGradient(-1,-1,0,0,0,c.r*1.6);
    cg.addColorStop(0,'#fff6ca');
    cg.addColorStop(.5,'#ffd46e');
    cg.addColorStop(1,'#c98a1e');
    ctx.beginPath(); ctx.arc(0,0,c.r,0,TAU);
    ctx.fillStyle = cg; ctx.fill();
    ctx.restore();
  }

  /* text pops */
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for(i=0;i<state.pops.length;i++){
    var q = state.pops[i];
    var prog = q.t/q.span;
    var alpha = prog < 0.15 ? prog/0.15 : 1 - Math.pow((prog-0.15)/0.85, 2);
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.font = '900 ' + q.size + 'px ' + FONT;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(40,22,4,.6)';
    ctx.strokeText(q.text, q.x, q.y);
    ctx.fillStyle = q.color;
    ctx.shadowColor = 'rgba(255,190,90,.7)';
    ctx.shadowBlur = 12;
    ctx.fillText(q.text, q.x, q.y);
  }
  ctx.restore();
}

/* 闪光配色：按事件类型区分，破防青 / 暴击金 / 受伤红 / 雷电蓝 */
var FLASH_HUE = {
  blue: ['214,234,255','150,190,255','120,170,255'],
  gold: ['255,244,210','255,205,120','255,180,80'],
  cyan: ['214,250,255','130,225,255','90,190,255'],
  red:  ['255,220,210','255,120,100','255,70,50']
};

function drawFlash(){
  if(state.flash <= 0.002) return;
  var f = clamp(state.flash, 0, 1);
  var hue = FLASH_HUE[state.flashHue] || FLASH_HUE.blue;
  /* 红色是受伤反馈，从屏幕中下方涌上来；其余从顶部打下来 */
  var cy = state.flashHue === 'red' ? H*.72 : H*.06;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  var g = ctx.createRadialGradient(W*.5,cy,0, W*.5,cy,Math.max(W,H)*.95);
  g.addColorStop(0,'rgba(' + hue[0] + ',' + (0.44*f) + ')');
  g.addColorStop(.35,'rgba(' + hue[1] + ',' + (0.18*f) + ')');
  g.addColorStop(1,'rgba(' + hue[2] + ',0)');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,W,H);
  ctx.restore();
}

function draw(){
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  var sh = state.shake;
  var sx = sh > .1 ? rand(-sh, sh) : 0;
  var sy = sh > .1 ? rand(-sh, sh) : 0;

  ctx.save();
  ctx.translate(sx, sy);
  drawBackground();
  drawPlayfield();
  drawCeiling();
  drawDust();
  drawGimmicks();
  drawBumpers();
  drawPlates();
  drawPlateGhost();
  drawCharacterSignature();
  drawBoss();
  if(state.fireT > 0 && state.boss){
    var fb = state.boss;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var fg = ctx.createRadialGradient(fb.x, fb.y, 0, fb.x, fb.y, fb.h*.75);
    fg.addColorStop(0,'rgba(255,130,50,' + (0.10 + 0.06*Math.sin(T*14)) + ')');
    fg.addColorStop(1,'rgba(255,70,20,0)');
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.arc(fb.x, fb.y, fb.h*.75, 0, TAU); ctx.fill();
    ctx.restore();
  }
  drawTelegraph();
  drawSuck();
  drawBalls();
  drawRocks();
  drawItems();
  if(state.mode !== 'intro'){
    drawLauncher();
    drawAim();
    drawStun();
  }
  drawAtkAnim();
  drawEffects();
  if(state.gasT > 0){
    ctx.fillStyle = 'rgba(110,190,70,' + (0.10*Math.min(1,state.gasT)) + ')';
    ctx.fillRect(view.left, view.top, view.w, view.h);
  }
  ctx.restore();

  drawFlash();

  ctx.fillStyle = G.vig;
  ctx.fillRect(0,0,W,H);
}

