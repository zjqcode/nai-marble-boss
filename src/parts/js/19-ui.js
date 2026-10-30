/* =========================================================
   19. 通用 UI
   ========================================================= */
function toast(msg){
  var el = $id('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(function(){ el.classList.remove('show'); }, 1800);
}

function hideIntro(){
  var el = $id('intro');
  if(!el || el.classList.contains('hide')) return;
  el.classList.add('hide');
  document.body.classList.add('playing');
  setTimeout(function(){ el.style.display = 'none'; }, 800);
}

function updateStartLabel(){
  var b = $id('bStart');
  if(!b) return;
  var label = '开 始 讨 伐';
  if(META.progress >= CHAPTERS.length) label = '再 战 最 终 章';
  else if(META.progress > 0) label = '继 续 第 ' + (META.progress + 1) + ' 章';
  b.querySelector('span').textContent = label;
}

function toggleSound(){
  Sound.init();
  Sound.resume();
  state.soundOn = !state.soundOn;
  Sound.setOn(state.soundOn);
  store('nai_boss_sound', state.soundOn ? '1' : '0');
  updateSoundButton();
  if(state.soundOn){
    Sound.ui();
    if(state.mode === 'play') Sound.bgmStart();
  } else {
    stopBgm();
  }
}
function updateSoundButton(){
  var btns = document.querySelectorAll('.snd-btn');
  for(var i=0;i<btns.length;i++){
    var btn = btns[i];
    btn.classList.toggle('on', state.soundOn);
    btn.setAttribute('aria-pressed', String(state.soundOn));
    var onIco = btn.querySelector('.ico-on');
    var offIco = btn.querySelector('.ico-off');
    if(onIco) onIco.style.display = state.soundOn ? '' : 'none';
    if(offIco) offIco.style.display = state.soundOn ? 'none' : '';
    var tx = btn.querySelector('.tx');
    if(tx) tx.textContent = state.soundOn ? '音效' : '静音';
  }
}

function buildIntroOrbs(){
  var names = ['奶蛙','奶蛋','小奶蛙','奶猫','奶狗'];
  var html = '';
  for(var i=0;i<names.length;i++){
    html += '<div class="orb" style="animation-delay:' + (i*0.22) + 's"><img src="' + assetURL(names[i],'png') + '" alt=""></div>';
  }
  $id('orbRow').innerHTML = html;
}

