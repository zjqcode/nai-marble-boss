/* 通关率测试：机器人按真人节奏玩（躲红区 + 瞄弱点 + 自然合体），每关跑 N 次
   用法：node tools/clear-rate.mjs [每关次数] [章节...] */
import { pathToFileURL } from 'node:url';
const root = 'C:\\Users\\逸愉\\Documents\\my_game';
const { launch } = await import(pathToFileURL(root + '\\tools\\cdp.mjs').href);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const RUNS = Number(process.argv[2] || 12);
const ONLY = process.argv.slice(3).map(Number).filter(Boolean);

const BOT = `
(function(){
  var N = window.__NAI__, st = N.state, v = N.view;
  var ch = __CH__, noise = 0.05;

  N.startLevel(ch - 1);
  st.cineT = 0;
  N.META.items.potion = 3;   /* 假设玩家备了 3 瓶血 */
  N.updateItemBar();
  st.dodgeStreak = 0;

  var frames = 0, limit = Math.ceil((st.timer + 8) * 60);
  /* 人类特征：看到红区后要 0.25s 才反应；5% 概率手滑往错方向 */
  var REACT = 15, sawAt = -1, slipDir = 0, slipAt = -1;
  var canonX = function(){ return st.cannonX; };

  while (frames < limit) {
    /* 1) 躲红区：向"能躲出去且更近"的那一侧移动（贴墙时不能往墙里钻） */
    if (st.telegraph) {
      var tg = st.telegraph;
      if (sawAt < 0) { sawAt = frames; slipDir = Math.random() < 0.05 ? -1 : 0; }
      if (frames - sawAt < REACT) { st.stickX = 0; N.step(1); frames++; continue; }
      var need = tg.dodgeW + 14;
      var minX = v.left + 34, maxX = v.right - 34;
      var target = null;
      var cands = [tg.aimX - need, tg.aimX + need];
      for (var ci = 0; ci < 2; ci++) {
        var c = cands[ci];
        if (c < minX || c > maxX) continue;                 /* 越界躲不到 */
        if (target === null || Math.abs(c - st.cannonX) < Math.abs(target - st.cannonX)) target = c;
      }
      if (target === null) {
        /* 两侧都越界：只能尽量远离红区中心 */
        target = (tg.aimX - st.cannonX) >= 0 ? minX : maxX;
      }
      st.moveDir = 0;
      var gap = target - st.cannonX;
      st.stickX = Math.abs(gap) < 6 ? 0 : (gap > 0 ? 1 : -1);
      if (slipDir) st.stickX = -st.stickX * 0.6;   /* 手滑：往错方向推 */
    } else {
      sawAt = -1; slipDir = 0;
      st.stickX = 0;
      /* 空闲时往中间靠，避免贴边死角 */
      if (st.cannonX < v.cx - 40) st.stickX = 0.5;
      else if (st.cannonX > v.cx + 40) st.stickX = -0.5;
    }

    /* 2) 发射：装填好了就打弱点，带一点手抖 */
    if (st.reloadT <= 0.02 && st.mode === 'play') {
      var b = st.boss;
      if (b && !b.dead) {
        var tx = b.x - b.w * 0.22;
        var ty = b.y;
        var ox = st.cannonX, oy = v.pouchY - 14;
        var ang = Math.atan2(ty - oy, tx - ox) + (Math.random() - 0.5) * noise;
        var sp = 880;
        N.spawn(st.loadLv, ox, oy, Math.cos(ang) * sp, Math.sin(ang) * sp);
        st.reloadT = st.reloadMax;        /* 模拟一次真实发射的装填 */
      }
    }

    /* 3) 像真人一样：受伤了就嗑血瓶（有存货且冷却好了） */
    if (st.heroHP < st.maxHP && st.potionCd <= 0 && (N.META.items.potion | 0) > 0) {
      N.useItem('potion');
    }

    N.step(1);
    frames++;

    if (st.mode === 'victory') return { ch: ch, win: true, t: frames / 60, hp: st.heroHP };
    if (st.mode === 'lose') {
      return { ch: ch, win: false, t: frames / 60, hp: 0,
               why: st.result && st.result.reason === 'timer' ? 'timeout' : 'dead' };
    }
  }
  return { ch: ch, win: false, t: frames / 60, hp: st.heroHP, why: 'timeout' };
})()
`;

const s = await launch({ width: 844, height: 390, dsf: 2 });
await s.goto(pathToFileURL(root + '\\奶系弹珠_弹射讨伐.html').href + '?debug&level=1');
await s.waitFor('(window.__imgs||[]).length>0', 20000);
await sleep(1200);

const chapters = ONLY.length ? ONLY : [1, 2, 3, 4, 5, 6, 7, 8];
const rows = [];

for (const ch of chapters) {
  const runs = [];
  for (let i = 0; i < RUNS; i++) runs.push(await s.evaluate(BOT.replace('__CH__', ch)));
  const wins = runs.filter((r) => r.win);
  const rate = Math.round((wins.length / runs.length) * 100);
  const avgT = (runs.reduce((a, r) => a + r.t, 0) / runs.length).toFixed(1);
  const avgHp = (runs.reduce((a, r) => a + (r.hp || 0), 0) / runs.length).toFixed(1);
  const deaths = runs.filter((r) => !r.win && r.why === 'dead').length;
  const timeout = runs.filter((r) => !r.win && r.why === 'timeout').length;
  rows.push({ ch, rate, avgT, avgHp, deaths, timeout, n: runs.length });
  console.log(`第${ch}章  通关率 ${String(rate).padStart(3)}%   平均用时 ${avgT}s   平均剩血 ${avgHp}   ` +
              `死亡 ${deaths} / 超时 ${timeout}  (${runs.length} 次)`);
}

const tot = rows.reduce((a, r) => a + r.rate, 0) / rows.length;
console.log(`\n总体平均通关率: ${tot.toFixed(0)}%`);
await s.close();
