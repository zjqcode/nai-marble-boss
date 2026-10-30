/* =========================================================
   17. 图鉴 / 章节 UI
   ========================================================= */
var selectedChar = '奶蛋';

function chapterOfChar(name){
  for(var i=0;i<CHAPTERS.length;i++) if(CHAPTERS[i].char === name) return CHAPTERS[i];
  return null;
}

function openScreen(id){
  closeAllScreens();
  var el = $id(id);
  if(!el) return;
  el.classList.add('show');
  el.setAttribute('aria-hidden','false');
  state.paused = true;
  state.aim.active = false;
  state.aim.power = 0;
}
function closeScreen(id){
  var el = $id(id);
  if(!el) return;
  el.classList.remove('show');
  el.setAttribute('aria-hidden','true');
  state.paused = false;
}
function closeAllScreens(){
  var els = document.querySelectorAll('.screen.show');
  for(var i=0;i<els.length;i++){
    els[i].classList.remove('show');
    els[i].setAttribute('aria-hidden','true');
  }
  state.paused = false;
}

function buildLevelList(){
  var html = '';
  for(var i=0;i<CHAPTERS.length;i++){
    var ch = CHAPTERS[i];
    var cleared = ch.id <= META.progress;
    var avail = ch.id <= META.progress + 1;
    var cls = 'level-item' + (cleared ? ' cleared' : '') + (avail ? '' : ' locked');
    html += '<div class="' + cls + '">';
    html += '<div class="orb md' + (avail ? '' : ' locked') + '"><img src="' + assetURL(ch.char,'png') + '" alt=""></div>';
    html += '<div class="li-body"><div class="li-top"><b>' + ch.chap + ' · ' + ch.title + '</b><span>' + (cleared ? '已通关' : (avail ? '可挑战' : '未解锁')) + '</span></div>';
    html += '<p class="li-desc">' + ch.desc + '</p>';
    html += '<div class="li-meta"><span>HP ' + ch.hp + '</span><span>掉落：' + ch.char + '</span></div></div>';
    if(avail){
      html += '<button class="li-go' + (cleared ? ' ghost' : '') + '" data-lv="' + i + '">' + (cleared ? '再战' : '挑战') + '</button>';
    } else {
      html += '<span class="li-lock">🔒</span>';
    }
    html += '</div>';
  }
  $id('levelList').innerHTML = html;
}

function openLevels(){
  Sound.ui();
  buildLevelList();
  openScreen('levels');
}

function buildGallery(){
  var c = charByName(selectedChar) || CHARS[0];
  var unlocked = isUnlocked(c.n);
  var lv = charLv(c.n);
  var cost = upgradeCost(lv);
  var ch = chapterOfChar(c.n);
  var detail = $id('charDetail');

  var dh = '<div class="orb lg ' + (unlocked ? '' : 'locked') + '"><img src="' + assetURL(c.n,'png') + '" alt=""></div>';
  dh += '<div class="cd-body"><div class="cd-name"><b>' + c.n + '</b><span>' + (unlocked ? 'Lv.' + lv : '未解锁') + '</span></div>';
  if(unlocked){
    dh += '<p class="cd-skill">' + c.sname + '：' + skillText(c, lv) + '</p>';
    dh += '<p class="cd-next">对 BOSS 基础伤害 ×' + (+c.dmg.toFixed(2)) + '</p>';
    dh += '<p class="cd-next">' + (lv < 5 ? '下一级：' + skillText(c, lv+1) : '已达到最高等级') + '</p>';
    if(lv < 5){
      dh += '<div class="cd-next">升级消耗 ' + cost + ' 奶瓶</div>';
    }
  } else {
    dh += '<p class="cd-skill">击败「' + (ch ? ch.chap + ' · ' + ch.title : '对应 BOSS') + '」解锁</p>';
    dh += '<p class="cd-next">解锁后技能立即在所有关卡生效</p>';
  }
  dh += '</div>';
  if(unlocked){
    if(lv >= 5){
      dh += '<div class="up-btn max">已满级</div>';
    } else {
      var poor = META.milk < cost ? ' poor' : '';
      dh += '<button class="up-btn' + poor + '" id="bUpgrade">升级<small>' + cost + ' 奶瓶</small></button>';
    }
  } else {
    dh += '<div class="li-lock">🔒</div>';
  }
  detail.innerHTML = dh;
  var hbNow = heroBonus();
  var hbEl = $id('heroBonus');
  if(hbEl) hbEl.textContent = '勇者强化 +' + hbNow.n + ' 级 · 生命 ' + (5 + hbNow.hp) + ' 心 · 全体伤害 +' + Math.round((hbNow.dmg - 1)*100) + '%';

  var grid = '';
  for(var i=0;i<CHARS.length;i++){
    var cc = CHARS[i];
    var un = isUnlocked(cc.n);
    var lvl = charLv(cc.n);
    var sel = cc.n === selectedChar ? ' sel' : '';
    grid += '<button class="char-card' + (un ? '' : ' locked') + sel + '" data-char="' + cc.n + '">';
    grid += '<div class="orb sm' + (un ? '' : ' locked') + '"><img src="' + assetURL(cc.n,'png') + '" alt=""></div>';
    grid += '<div class="cc-meta"><b>' + cc.n + '</b>';
    if(un){
      grid += '<p class="cc-skill">' + cc.sname + ' ' + skillText(cc, lvl) + '</p>';
    } else {
      grid += '<p class="cc-skill">BOSS 掉落 · ' + (chapterOfChar(cc.n) ? '第' + chapterOfChar(cc.n).id + '章' : '') + '</p>';
    }
    grid += '</div><span class="cc-lv">' + (un ? 'Lv.' + lvl : '???') + '</span></button>';
  }
  $id('charGrid').innerHTML = grid;
  updateMilkHUD();
}

function showGallery(){
  Sound.init(); Sound.resume(); Sound.ui();
  buildGallery();
  openScreen('gallery');
}

function upgradeSelected(){
  var c = charByName(selectedChar);
  if(!c || !isUnlocked(c.n)) return;
  var lv = charLv(c.n);
  if(lv >= 5) return;
  var cost = upgradeCost(lv);
  if(META.milk < cost){
    toast('奶瓶不足，还差 ' + (cost - META.milk));
    return;
  }
  META.milk -= cost;
  META.lv[c.n] = lv + 1;
  state.eff = buildEff();
  var hbU = heroBonus();
  var oldMax = state.maxHP;
  state.maxHP = 5 + hbU.hp;
  state.heroDmg = hbU.dmg;
  /* 升级同时强化勇者：新增的心直接补满（setHeroHP 会同步刷新心形 HUD） */
  setHeroHP(state.heroHP + Math.max(0, state.maxHP - oldMax));
  saveMeta();
  updateMilkHUD();
  Sound.upgrade();
  buildGallery();
  toast(c.n + ' 升到 Lv.' + (lv+1) + ' · ' + c.sname + ' ' + skillText(c, lv+1));
}

