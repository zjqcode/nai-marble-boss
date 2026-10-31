/* =========================================================
   3. 音效（Web Audio 合成）
   ========================================================= */
var Sound = (function(){
  var ac = null, master = null, rev = null, wet = null, noiseBuf = null;
  var on = true, lastSquish = 0, lastCoin = 0, lastClack = 0, lastWall = 0;
  var lastPlate = 0, lastPortal = 0, lastMove = 0;
  /* BGM 调度器状态 */
  var bgmTimer = null, bgmGain = null, bgmSend = null, bgmStep = 0, bgmNext = 0, bgmLevel = 0;
var wasBgmOn = false;   /* 切后台前 BGM 是否在放，用于回来时恢复 */
  var BGM_VOL = [0.17, 0.24, 0.30];
  var BGM_SPB = [0.30, 0.255, 0.225];   /* 每步秒数：越紧张越快 */
  var BASS = [0, 0, 7, 0, 5, 0, 3, 7];  /* 半音偏移，根音 A1 */
  var PAD  = [0, 3, 7, 10];             /* 小七和弦 */

  function makeNoise(sec){
    var n = Math.floor(ac.sampleRate * sec);
    var buf = ac.createBuffer(1, n, ac.sampleRate);
    var d = buf.getChannelData(0);
    for(var i=0;i<n;i++) d[i] = Math.random()*2-1;
    return buf;
  }
  function makeIR(sec, decay){
    var n = Math.floor(ac.sampleRate * sec);
    var buf = ac.createBuffer(2, n, ac.sampleRate);
    for(var c=0;c<2;c++){
      var d = buf.getChannelData(c);
      for(var i=0;i<n;i++){
        var t = i/n;
        d[i] = (Math.random()*2-1) * Math.pow(1-t, decay);
      }
    }
    return buf;
  }
  function init(){
    if(ac) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return;
    try{ ac = new AC(); }catch(e){ return; }
    var comp = ac.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 20; comp.ratio.value = 6;
    comp.attack.value = 0.003; comp.release.value = 0.24;
    master = ac.createGain();
    master.gain.value = on ? 0.85 : 0;
    master.connect(comp); comp.connect(ac.destination);
    rev = ac.createConvolver(); rev.buffer = makeIR(1.7, 2.5);
    wet = ac.createGain(); wet.gain.value = 0.24;
    rev.connect(wet); wet.connect(master);
    noiseBuf = makeNoise(3);
  }
  function resume(){ if(ac && ac.state === 'suspended') ac.resume(); }
  function dest(gain, send){
    var g = ac.createGain(); g.gain.value = gain; g.connect(master);
    if(send){ var s = ac.createGain(); s.gain.value = send; g.connect(s); s.connect(rev); }
    return g;
  }
  function tone(o){
    if(!ac || !on) return;
    var t = ac.currentTime + (o.delay || 0);
    var osc = ac.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if(o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + o.dur);
    var g = dest(o.gain, o.send || 0);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.gain, t + (o.atk || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(g); osc.start(t); osc.stop(t + o.dur + 0.03);
  }
  function noise(o){
    if(!ac || !on) return;
    var t = ac.currentTime + (o.delay || 0);
    var src = ac.createBufferSource(); src.buffer = noiseBuf;
    var f = ac.createBiquadFilter(); f.type = o.type || 'bandpass';
    f.frequency.setValueAtTime(o.f, t);
    if(o.to) f.frequency.exponentialRampToValueAtTime(Math.max(40, o.to), t + o.dur);
    f.Q.value = o.q || 1;
    var g = dest(o.gain, o.send || 0);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.gain, t + (o.atk || 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f); f.connect(g);
    src.start(t, Math.random()*0.4); src.stop(t + o.dur + 0.03);
  }
  var NOTES = [523.25,587.33,659.25,783.99,880,1046.5,1174.66,1318.51,1567.98,1760,2093,2349.32,2637.02];

  /* 半音 → 频率，基准 A1 = 55Hz */
  function semi(n){ return 55 * Math.pow(2, n/12); }

  /* BGM 一个音符：直接挂到 bgmGain，不走 dest() 以便整体淡入淡出 */
  function bgmVoice(o){
    if(!ac || !bgmGain) return;
    var osc = ac.createOscillator();
    osc.type = o.type || 'sawtooth';
    osc.frequency.setValueAtTime(o.f, o.t);
    if(o.detune) osc.detune.value = o.detune;
    var g = ac.createGain();
    g.gain.setValueAtTime(0.0001, o.t);
    g.gain.linearRampToValueAtTime(o.gain, o.t + (o.atk || 0.015));
    g.gain.exponentialRampToValueAtTime(0.0001, o.t + o.dur);
    if(o.cut){
      var f = ac.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.cut;
      f.Q.value = o.q || 6;
      osc.connect(f); f.connect(g);
    } else {
      osc.connect(g);
    }
    g.connect(bgmGain);
    osc.start(o.t);
    osc.stop(o.t + o.dur + 0.04);
  }
  function bgmHat(t, gain){
    if(!ac || !bgmGain || !noiseBuf) return;
    var src = ac.createBufferSource(); src.buffer = noiseBuf;
    var f = ac.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 7000;
    var g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(f); f.connect(g); g.connect(bgmGain);
    src.start(t, Math.random()*0.5); src.stop(t + 0.08);
  }
  function bgmTick(){
    if(!ac || !bgmGain) return;
    var spb = BGM_SPB[bgmLevel];
    var horizon = ac.currentTime + 0.3;
    var guard = 0;
    while(bgmNext < horizon && guard < 16){
      guard++;
      var t = bgmNext;
      var s = bgmStep & 7;
      /* 低音线 */
      bgmVoice({
        t:t, f:semi(BASS[s]), dur:spb*0.92, gain:0.26, type:'sawtooth',
        cut: bgmLevel === 2 ? 760 : (bgmLevel === 1 ? 560 : 400), q:7
      });
      /* 每 8 步铺一次 pad 和声 */
      if(s === 0){
        for(var i=0;i<PAD.length;i++){
          bgmVoice({t:t, f:semi(PAD[i]+24), dur:spb*7.4, gain:0.052, type:'triangle', atk:0.3, detune:-6});
          bgmVoice({t:t, f:semi(PAD[i]+24), dur:spb*7.4, gain:0.052, type:'triangle', atk:0.3, detune:7});
        }
      }
      /* hat：平静只打反拍，紧张铺满 */
      if(bgmLevel === 0){ if(s % 4 === 2) bgmHat(t, 0.05); }
      else if(bgmLevel === 1){ if(s % 2 === 0) bgmHat(t, 0.06); }
      else { bgmHat(t, 0.065); }
      /* 蓄力告警：高音滴答 */
      if(bgmLevel === 2 && s % 2 === 0){
        bgmVoice({t:t, f:semi(36), dur:0.09, gain:0.05, type:'square'});
      }
      bgmStep++;
      bgmNext += spb;
    }
    /* 页面长时间后台导致 currentTime 远超 bgmNext 时重新对齐，避免一次性补排大量音符 */
    if(bgmNext < ac.currentTime - 0.5) bgmNext = ac.currentTime + 0.05;
  }

  return {
    init: init, resume: resume,
    setOn: function(v){
      on = !!v;
      if(ac && master){
        master.gain.cancelScheduledValues(ac.currentTime);
        master.gain.setTargetAtTime(on ? 0.85 : 0, ac.currentTime, 0.06);
      }
      /* BGM 挂在 master 下，静音时顺带停掉调度器省 CPU */
      if(!on && bgmTimer){ clearInterval(bgmTimer); bgmTimer = null; }
    },
    isOn: function(){ return on; },
    wall: function(power){
      if(!ac || !on) return;
      var now = ac.currentTime;
      if(now - lastWall < 0.05) return;
      lastWall = now;
      power = clamp(power, 0.05, 1);
      tone({f:210+power*100, to:95, dur:0.055, gain:0.028*power, type:'sine'});
      noise({dur:0.022, f:850, q:0.8, gain:0.014*power, type:'lowpass'});
    },
    clack: function(power){
      if(!ac || !on) return;
      var now = ac.currentTime;
      if(now - lastClack < 0.028) return;
      lastClack = now;
      power = clamp(power, 0.08, 1);
      var det = 0.92 + Math.random()*0.18;
      tone({f:1450*det, to:1150*det, dur:0.045, gain:0.075*power, type:'sine'});
      tone({f:2250*det, to:1800*det, dur:0.03, gain:0.038*power, type:'sine'});
      noise({dur:0.018, f:3800, q:0.7, gain:0.03*power, type:'highpass'});
      if(power > 0.55) tone({f:190, to:95, dur:0.07, gain:0.035*power, type:'sine'});
    },
    squish: function(lv){
      if(!ac || !on) return;
      var now = ac.currentTime;
      if(now - lastSquish < 0.03) return;
      lastSquish = now;
      tone({f:480, to:120, dur:0.14, gain:0.12, type:'sine', send:0.12});
      noise({dur:0.11, f:720, to:180, q:1.6, gain:0.075, type:'bandpass'});
      tone({f:150, to:55, dur:0.1, gain:0.05, type:'sine'});
      noise({dur:0.04, f:2000, q:0.8, gain:0.025, type:'highpass', delay:0.02});
    },
    launch: function(power){
      if(!ac || !on) return;
      tone({f:210+power*120, to:80, dur:0.18, gain:0.14, type:'triangle'});
      noise({dur:0.14, f:1800, to:400, q:0.8, gain:0.05});
    },
    bossHit: function(lv, crit){
      if(!ac || !on) return;
      tone({f:110, to:42, dur:0.28, gain:0.30, type:'sine'});
      noise({dur:0.2, f:420, to:90, q:0.7, gain:0.16, type:'lowpass'});
      tone({f:NOTES[Math.min(12,lv)]*1.5, dur:0.14, gain:0.06, type:'square', send:0.2, delay:0.01});
      if(crit) tone({f:1568, dur:0.16, gain:0.05, type:'triangle', send:0.3, delay:0.02});
    },
    coin: function(){
      if(!ac || !on) return;
      var now = ac.currentTime;
      if(now - lastCoin < 0.05) return;
      lastCoin = now;
      tone({f:1480, dur:0.05, gain:0.035, type:'triangle'});
      tone({f:1976, dur:0.07, gain:0.025, type:'triangle', delay:0.03});
    },
    rock: function(){
      if(!ac || !on) return;
      noise({dur:0.28, f:300, to:70, q:0.7, gain:0.18, type:'lowpass'});
      tone({f:70, to:40, dur:0.25, gain:0.16, type:'sine'});
    },
    warn: function(){
      if(!ac || !on) return;
      tone({f:520, dur:0.14, gain:0.07, type:'square', send:0.1});
      tone({f:390, dur:0.18, gain:0.06, type:'square', send:0.1, delay:0.17});
    },
    suck: function(){
      if(!ac || !on) return;
      noise({dur:1.2, f:220, to:900, q:1.4, gain:0.12, type:'bandpass', send:0.2});
      tone({f:80, to:300, dur:1.2, gain:0.10, type:'sawtooth'});
    },
    beam: function(){
      if(!ac || !on) return;
      noise({dur:0.4, f:3000, to:600, q:0.6, gain:0.16, type:'highpass'});
      tone({f:1200, to:120, dur:0.45, gain:0.14, type:'sawtooth'});
    },
    ui: function(){ if(ac && on) tone({f:980, dur:0.045, gain:0.035, type:'sine'}); },
    upgrade: function(){
      if(!ac || !on) return;
      var n = [523.25, 659.25, 783.99, 1046.5];
      for(var i=0;i<n.length;i++) tone({f:n[i], dur:0.28, gain:0.05, type:'triangle', send:0.3, delay:i*0.055});
    },
    win: function(){
      if(!ac || !on) return;
      var n = [523.25, 659.25, 783.99, 1046.5, 1318.51];
      for(var i=0;i<n.length;i++) tone({f:n[i], dur:0.7, gain:0.08, type:'triangle', send:0.4, delay:i*0.09});
      noise({dur:0.6, f:3000, q:0.8, gain:0.06, type:'highpass', send:0.4, delay:0.1});
    },
    lose: function(){
      if(!ac || !on) return;
      var n = [392, 329.63, 261.63];
      for(var i=0;i<n.length;i++) tone({f:n[i], dur:0.55, gain:0.08, type:'triangle', send:0.3, delay:i*0.16});
    },
    laugh: function(){
      if(!ac || !on) return;
      for(var i=0;i<4;i++){
        tone({f:540-i*45, to:390-i*35, dur:0.12, gain:0.055, type:'square', send:0.2, delay:i*0.14});
      }
    },
    wave: function(){
      if(!ac || !on) return;
      noise({dur:0.5, f:260, to:1200, q:0.8, gain:0.12, type:'bandpass', send:0.25});
      tone({f:110, to:65, dur:0.45, gain:0.10, type:'sine'});
    },
    fart: function(){
      if(!ac || !on) return;
      noise({dur:0.85, f:190, to:65, q:1.3, gain:0.17, type:'lowpass', send:0.15});
      tone({f:95, to:42, dur:0.8, gain:0.12, type:'sawtooth'});
    },
    hop: function(){
      if(!ac || !on) return;
      tone({f:200, to:640, dur:0.26, gain:0.11, type:'sine'});
      noise({dur:0.2, f:500, to:1500, q:1, gain:0.05});
    },
    hurt: function(){
      if(!ac || !on) return;
      tone({f:170, to:55, dur:0.32, gain:0.22, type:'sine'});
      noise({dur:0.26, f:520, to:120, q:0.7, gain:0.12, type:'lowpass'});
    },
    dodge: function(){
      if(!ac || !on) return;
      noise({dur:0.2, f:2200, to:700, q:0.6, gain:0.07, type:'highpass', send:0.2});
      tone({f:900, to:1300, dur:0.16, gain:0.05, type:'sine'});
    },
    shield: function(){
      if(!ac || !on) return;
      tone({f:880, dur:0.2, gain:0.07, type:'triangle', send:0.3});
      tone({f:1320, dur:0.25, gain:0.045, type:'sine', send:0.3, delay:0.05});
    },
    interrupt: function(){
      if(!ac || !on) return;
      var n = [784, 988, 1175, 1568];
      for(var i=0;i<n.length;i++) tone({f:n[i], dur:0.3, gain:0.06, type:'triangle', send:0.35, delay:i*0.05});
      noise({dur:0.3, f:3000, q:0.8, gain:0.07, type:'highpass', send:0.3});
    },
    thunder: function(vol){
      if(!ac || !on) return;
      vol = clamp(vol, 0, 1);
      noise({dur:1.6, f:420, to:110, q:0.6, gain:0.3*vol, type:'lowpass', send:0.25});
      tone({f:54, to:32, dur:1.3, gain:0.18*vol, type:'sine'});
    },
    /* 破防：金属崩裂 + 上行琶音 */
    breakDown: function(){
      if(!ac || !on) return;
      noise({dur:0.42, f:2600, to:300, q:0.5, gain:0.20, type:'highpass', send:0.3});
      tone({f:150, to:48, dur:0.5, gain:0.24, type:'sine'});
      var n = [659.25, 880, 1174.66, 1567.98];
      for(var i=0;i<n.length;i++){
        tone({f:n[i], dur:0.34, gain:0.07, type:'triangle', send:0.4, delay:0.04+i*0.045});
      }
    },
    /* 反弹板：木质弹拨 */
    plate: function(power){
      if(!ac || !on) return;
      var now = ac.currentTime;
      if(now - lastPlate < 0.04) return;
      lastPlate = now;
      power = clamp(power, 0.15, 1);
      var det = 0.9 + Math.random()*0.2;
      tone({f:620*det, to:300*det, dur:0.1, gain:0.085*power, type:'triangle', send:0.14});
      noise({dur:0.05, f:1700, q:1.4, gain:0.035*power, type:'bandpass'});
      tone({f:170, to:92, dur:0.1, gain:0.045*power, type:'sine'});
    },
    /* 传送：进=上行扫频，出=下行 */
    portal: function(out){
      if(!ac || !on) return;
      var now = ac.currentTime;
      if(now - lastPortal < 0.05) return;
      lastPortal = now;
      if(out) noise({dur:0.3, f:2400, to:500, q:1.1, gain:0.075, type:'bandpass', send:0.3});
      else noise({dur:0.3, f:500, to:2400, q:1.1, gain:0.075, type:'bandpass', send:0.3});
      tone({f:out ? 1100 : 420, to:out ? 420 : 1100, dur:0.26, gain:0.055, type:'sine', send:0.25});
    },
    /* 变身：上行琶音 + 白噪爆闪 */
    transform: function(){
      if(!ac || !on) return;
      var n = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98];
      for(var i=0;i<n.length;i++){
        tone({f:n[i], dur:0.45, gain:0.075, type:'triangle', send:0.45, delay:i*0.05});
      }
      noise({dur:0.55, f:1200, to:4800, q:0.7, gain:0.09, type:'bandpass', send:0.4});
      tone({f:80, to:220, dur:0.5, gain:0.1, type:'sine'});
    },
    /* 炮台移动：轻气流，节流避免长按刷声 */
    move: function(){
      if(!ac || !on) return;
      var now = ac.currentTime;
      if(now - lastMove < 0.12) return;
      lastMove = now;
      noise({dur:0.07, f:1500, to:600, q:0.8, gain:0.016, type:'bandpass'});
    },

    /* ----- 程序化 BGM -----
       lookahead 调度器：每 120ms 预排未来 0.3s 的音符。
       三层：低音 8 步循环 / pad 和声 / hat。
       intensity 0 平静 · 1 狂暴 · 2 蓄力告警 —— 改变音量、滤波与鼓点密度。 */
    bgmStart: function(){
      if(!ac || !on || bgmTimer) return;      /* 静音期间 setOn 只清了 timer，bgmGain 还活着，直接复用避免泄漏节点 */
      if(!bgmGain){
        bgmGain = ac.createGain();
        bgmGain.gain.value = 0;
        bgmGain.connect(master);
        bgmSend = ac.createGain();
        bgmSend.gain.value = 0.18;
        bgmGain.connect(bgmSend); bgmSend.connect(rev);
        bgmStep = 0;
      }
      bgmGain.gain.cancelScheduledValues(ac.currentTime);
      bgmGain.gain.setTargetAtTime(BGM_VOL[bgmLevel], ac.currentTime, 1.2);
      bgmNext = ac.currentTime + 0.1;
      bgmTimer = setInterval(bgmTick, 120);
    },
    bgmStop: function(){
      if(bgmTimer){ clearInterval(bgmTimer); bgmTimer = null; }
      if(bgmGain && ac){
        bgmGain.gain.cancelScheduledValues(ac.currentTime);
        bgmGain.gain.setTargetAtTime(0, ac.currentTime, 0.25);
        var g = bgmGain;
        setTimeout(function(){ try{ g.disconnect(); }catch(e){} }, 1400);
      }
      bgmGain = null;
      bgmSend = null;
    },
    bgmIntensity: function(n){
      n = clamp(n|0, 0, 2);
      if(n === bgmLevel) return;
      bgmLevel = n;
      if(bgmGain && ac) bgmGain.gain.setTargetAtTime(BGM_VOL[n], ac.currentTime, 0.5);
    },
    bgmPlaying: function(){ return !!bgmTimer; },

    /* ---------- 切后台静音 ----------
       只暂停 <audio> 是不够的：BGM 是 Web Audio 实时合成的，
       页面被隐藏后 AudioContext 未必自动挂起，声音会跟着到别的 App 上。
       这里把调度器停掉并直接 suspend AudioContext（已排队的音也会立刻静音）。 */
    suspendAll: function(){
      wasBgmOn = !!bgmTimer;
      if(bgmTimer){ clearInterval(bgmTimer); bgmTimer = null; }
      if(ac && ac.state === 'running'){
        try{ ac.suspend(); }catch(e){}
      }
    },
    /* 测试用：查看 AudioContext 是否真的被挂起 */
    ctxState: function(){ return ac ? ac.state : 'none'; },
    resumeAll: function(){
      if(ac && ac.state === 'suspended'){
        try{ ac.resume(); }catch(e){}
      }
      if(wasBgmOn && on){
        wasBgmOn = false;
        this.bgmStart();
      }
      wasBgmOn = false;
    }
  };
})();

