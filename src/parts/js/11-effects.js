/* =========================================================
   11. 特效
   ========================================================= */
function burst(x,y,r,count,lv,color){
  var n = count || 10;
  for(var i=0;i<n;i++){
    var a = Math.random()*TAU;
    var sp = rand(40, 240) * (r/40);
    state.parts.push({
      x:x + Math.cos(a)*r*0.3,
      y:y + Math.sin(a)*r*0.3,
      vx:Math.cos(a)*sp,
      vy:Math.sin(a)*sp - rand(20,120),
      r:rand(1.2,3.2)*(r/50+0.55),
      life:rand(.4,.9),
      color: color || levelColor(lv || 0),
      grav: rand(160,420)
    });
  }
  if(state.parts.length > 420) state.parts.splice(0, state.parts.length-420);
}

function ring(x,y,r0,r1,color,span,width){
  state.rings.push({x:x,y:y,r0:r0,r1:r1,color:color,span:span||.55,t:0,width:width||3});
  if(state.rings.length > 40) state.rings.shift();
}

function popText(x,y,text,size,color){
  if(state.pops.length > 14) return;
  state.pops.push({x:x,y:y,text:text,size:size,color:color,t:0,span:.95});
}

function addBolt(x1,y1,x2,y2){
  var pts = [];
  var segs = 9;
  var dx = x2-x1, dy = y2-y1;
  for(var i=0;i<=segs;i++){
    var t = i/segs;
    var wob = (i===0 || i===segs) ? 0 : rand(-1,1) * 46 * (1-t*0.4);
    pts.push({x:x1 + dx*t + wob, y:y1 + dy*t});
  }
  state.bolts.push({pts:pts, t:0, span:.34});
}

function setWarn(on){
  state.warn = !!on;
  var el = $id('warnEdge');
  if(el) el.classList.toggle('on', !!on);
}

function cssShake(kind){
  if(!cvs) return;
  var cls = kind === 'm' ? 'css-shake-m' : 'css-shake';
  cvs.classList.remove('css-shake','css-shake-m');
  void cvs.offsetWidth;
  cvs.classList.add(cls);
  clearTimeout(cvs._shakeT);
  cvs._shakeT = setTimeout(function(){ cvs.classList.remove(cls); }, 320);
}

function showCombo(){
  var el = $id('combo');
  if(!el) return;
  el.querySelector('b').textContent = '×' + Math.min(99, state.combo);
  el.classList.add('show');
}

function updateFx(dt){
  var i;
  for(i=0;i<state.dust.length;i++){
    var du=state.dust[i];
    du.y += du.vy*dt;
    du.x += Math.sin(T*0.7+du.ph)*6*dt + du.vx*dt;
    if(du.y < view.top-8){ du.y = view.bottom+8; du.x = rand(view.left,view.right); }
    if(du.x < view.left) du.x = view.right;
    if(du.x > view.right) du.x = view.left;
  }
  for(i=state.parts.length-1;i>=0;i--){
    var p = state.parts[i];
    p.vy += (p.grav || 300)*dt;
    p.x += p.vx*dt;
    p.y += p.vy*dt;
    p.life -= dt;
    if(p.life <= 0) state.parts.splice(i,1);
  }
  for(i=state.rings.length-1;i>=0;i--){
    var r = state.rings[i];
    r.t += dt;
    if(r.t >= r.span) state.rings.splice(i,1);
  }
  for(i=state.pops.length-1;i>=0;i--){
    var q = state.pops[i];
    q.t += dt;
    q.y -= 32*dt;
    if(q.t >= q.span) state.pops.splice(i,1);
  }
  for(i=state.bolts.length-1;i>=0;i--){
    var b = state.bolts[i];
    b.t += dt;
    if(b.t >= b.span) state.bolts.splice(i,1);
  }
  for(i=state.ceilFx.length-1;i>=0;i--){
    state.ceilFx[i].t += dt;
    if(state.ceilFx[i].t >= 0.45) state.ceilFx.splice(i,1);
  }
  for(i=state.springFx.length-1;i>=0;i--){
    var s = state.springFx[i];
    s.t += dt;
    if(s.t >= s.span) state.springFx.splice(i,1);
  }
  if(state.comboT > 0){
    state.comboT -= dt;
    if(state.comboT <= 0){
      state.combo = 0;
      $id('combo').classList.remove('show');
    }
  }
  if(state.shake > 0) state.shake = Math.max(0, state.shake - dt*46);
  if(state.flash > 0.001) state.flash *= Math.pow(0.02, dt);
  else { state.flash = 0; state.flashHue = 'blue'; }
  if(state.beam){
    state.beam.t -= dt;
    if(state.beam.t <= 0) state.beam = null;
  }
}

