/* 冒烟测试：用无头 Edge 加载产物，验证「不崩、资源能解码、8 章逻辑稳定、存档健壮」。
 *
 * 用法: node tools/smoke.mjs [产物路径]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch } from './cdp.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const target = process.argv[2] || path.join(root, '奶系弹珠_弹射讨伐.html');

const fileUrl = pathToFileURL(target).href;
const results = [];
let session;

function check(name, fn) {
  return (async () => {
    try {
      const detail = await fn();
      results.push({ name, ok: true, detail });
      console.log(`  \x1b[32mPASS\x1b[0m ${name}${detail ? ' — ' + detail : ''}`);
    } catch (e) {
      results.push({ name, ok: false, detail: e.message });
      console.log(`  \x1b[31mFAIL\x1b[0m ${name} — ${e.message}`);
    }
  })();
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function waitImages() {
  await session.waitFor(
    `(window.__imgs || []).length > 0 && window.__imgs.every(i => i.complete && i.naturalWidth > 0)`,
    20000,
    '所有图片解码完成'
  );
  return session.evaluate(`window.__imgs.length`);
}

function assertNoErrors(where) {
  const { exceptions, consoleErrors, logErrors } = session;
  const all = [...exceptions, ...consoleErrors, ...logErrors];
  assert(all.length === 0, `${where} 出现 ${all.length} 条错误: ${all.slice(0, 3).join(' | ')}`);
}

console.log(`\n冒烟测试目标: ${path.relative(root, target)}  (${(fs.statSync(target).size / 1024 / 1024).toFixed(2)} MB)\n`);

session = await launch({ width: 390, height: 844, dsf: 2 });
console.log(`浏览器: ${session.browser}\n`);

// ---------- 1. 资源解码 ----------
await check('产物可加载，15 张图片（13 立绘 + 背景 + 图鉴）全部解码', async () => {
  await session.goto(fileUrl);
  const n = await waitImages();
  assertNoErrors('加载阶段');
  assert(n === 15, `期望 15 张图片，实际 ${n}`);
  const decoded = await session.evaluate(`
    window.__imgs.map(i => i.naturalWidth + 'x' + i.naturalHeight).join(',')`);
  return `${n} 张: ${decoded}`;
});

// ---------- 2. 画布真的画出了东西 ----------
await check('画布渲染出内容（WebP 纹理解码后确实被 draw 出来）', async () => {
  await session.goto(fileUrl + '?debug&level=1');
  await waitImages();
  await session.evaluate(`window.__NAI__ && 1`);
  await session.evaluate(`window.__tick(180)`);
  const stats = await session.evaluate(`
    (() => {
      const c = document.getElementById('game');
      const g = c.getContext('2d');
      const d = g.getImageData(0, 0, c.width, c.height).data;
      const set = new Set();
      let sum = 0, sum2 = 0, npx = 0;
      for (let i = 0; i < d.length; i += 4 * 97) {
        const v = (d[i] + d[i+1] + d[i+2]) / 3;
        set.add((d[i] >> 4) + ',' + (d[i+1] >> 4) + ',' + (d[i+2] >> 4));
        sum += v; sum2 += v * v; npx++;
      }
      const mean = sum / npx;
      return { colors: set.size, mean: +mean.toFixed(1), std: +Math.sqrt(sum2/npx - mean*mean).toFixed(1) };
    })()`);
  assert(stats.colors > 40, `色彩种类过少 (${stats.colors})，画面可能是空白`);
  assert(stats.std > 8, `亮度标准差过小 (${stats.std})，画面缺乏层次`);
  return `${stats.colors} 种色彩, 亮度 std=${stats.std}`;
});

// ---------- 3. 八个章节：发球 + 各跑 1800 帧（30 秒逻辑） ----------
let totalHits = 0;
for (let lv = 1; lv <= 8; lv++) {
  await check(`第 ${lv} 章发射 6 球跑 30 秒：不崩、无 NaN、碰撞生效`, async () => {
    await session.goto(`${fileUrl}?debug&level=${lv}`);
    await waitImages();
    // 先跳过开局过场动画（cineT 期间 updateBalls 直接 return，球不会动）
    await session.evaluate(`window.__NAI__.step(160)`);
    // 手动发 6 颗球；速度取游戏真实量级（源码里发射速度约 400~880 px/s，单位是 px/秒）
    await session.evaluate(`
      (() => {
        const N = window.__NAI__, v = N.view, b = N.state.boss;
        [1,2,3,4,5,6].forEach((l, i) =>
          N.spawn(l, b.x + (i - 2.5) * 46, v.h * 0.78, (i - 2.5) * 40, -(420 + i * 60)));
      })()`);
    const sig = () => session.evaluate(
      `window.__NAI__.state.balls.map(b => Math.round(b.x) + ',' + Math.round(b.y)).join('|')`);
    const p0 = await sig();
    await session.evaluate(`window.__NAI__.step(300)`);
    const p1 = await sig();
    await session.evaluate(`window.__NAI__.step(1500)`);
    const st = await session.evaluate(`
      (() => {
        const N = window.__NAI__, s = N.state;
        const bad = [];
        for (const b of s.balls) if (![b.x, b.y, b.vx, b.vy].every(Number.isFinite)) bad.push('ball');
        for (const e of (s.parts || [])) if (![e.x, e.y].every(Number.isFinite)) bad.push('part');
        return {
          balls: s.balls.length,
          bossHp: s.boss ? Math.round(s.boss.hp) : null,
          bossMax: s.boss ? Math.round(s.boss.maxHp ?? s.boss.max ?? 0) : null,
          bossFinite: s.boss ? [s.boss.x, s.boss.y, s.boss.hp].every(Number.isFinite) : null,
          heroHP: s.heroHP, maxHP: s.maxHP,
          hits: s.hits, score: s.score,
          bad: bad.slice(0, 3),
          tickError: window.__tickError || null,
        };
      })()`);
    assert(!st.tickError, '帧回调抛异常: ' + st.tickError);
    assertNoErrors(`第 ${lv} 章`);
    assert(p0 !== p1, '球完全没有移动，物理没跑起来');
    assert(st.bossFinite !== false, 'Boss 状态出现 NaN');
    assert(st.bad.length === 0, '出现非法坐标: ' + st.bad.join(','));
    assert(st.bossHp === null || st.bossHp >= 0, `Boss 血量非法: ${st.bossHp}`);
    assert(st.heroHP >= 0 && st.heroHP <= st.maxHP, `生命值越界: ${st.heroHP}/${st.maxHP}`);
    totalHits += st.hits || 0;
    return `命中 ${st.hits} 次, Boss ${st.bossHp}/${st.bossMax}, 生命 ${st.heroHP}/${st.maxHP}, 球 ${st.balls}`;
  });
}

await check('八章合计有命中（碰撞管线整体可用）', async () => {
  assert(totalHits > 0, '八章合计 0 次命中');
  return `八章合计命中 ${totalHits} 次`;
});

// ---------- 3b. README 核心机制：命中 Boss 只扣血、球不消失 ----------
await check('球命中 Boss：Boss 掉血，球不被消耗（README 核心机制）', async () => {
  await session.goto(`${fileUrl}?debug&level=1`);
  await waitImages();
  await session.evaluate(`window.__NAI__.step(160)`); // 跳过过场，否则球不动
  /* Boss 血量拉高，避免这一发直接把 Boss 打死；然后逐帧推进到「命中发生的那一刻」，
     立刻检查球数 —— 飞太久球会越界消失，那样测的就不是「命中是否消耗」了。 */
  const r = await session.evaluate(`
    (() => {
      const N = window.__NAI__, s = N.state, b = s.boss;
      N.setBossHp(999999);
      const hp0 = b.hp;
      const y0 = b.y + b.h * 0.5 + 120;
      for (let i = 0; i < 8; i++) N.spawn(i + 1, b.x + (i - 3.5) * 46, y0, 0, -600);
      const n0 = s.balls.length;
      let frames = 0;
      while (frames < 180 && s.boss.hp === hp0) { N.step(1); frames++; }
      return { frames, hp0, hp1: s.boss.hp, n0, n1: s.balls.length, hits: s.hits };
    })()`);
  assertNoErrors('碰撞测试');
  assert(r.hp1 < r.hp0, `跑了 ${r.frames} 帧 Boss 仍未掉血 (${r.hp0})`);
  assert(r.n1 >= r.n0, `命中后球被消耗了 (${r.n0} -> ${r.n1})`);
  return `${r.frames} 帧命中，Boss HP ${Math.round(r.hp0)} -> ${Math.round(r.hp1)}，球 ${r.n0} 个未减少`;
});

// ---------- 4. 胜利流程 + 存档推进 ----------
await check('击败 Boss 后章节进度前进并写入存档', async () => {
  await session.goto(`${fileUrl}?debug&level=1`);
  await waitImages();
  /* 把进度显式归零并落盘，避免前面测试的战果影响这条断言 */
  const before = await session.evaluate(`
    (() => { const N = window.__NAI__;
             N.META.progress = 0; N.save();
             localStorage.removeItem('nai_boss_meta');
             N.META.progress = 0;
             return N.META.progress; })()`);
  await session.evaluate(`
    (() => { const N = window.__NAI__; N.setBossHp(1); N.damage(999999); N.step(120); })()`);
  const after = await session.evaluate(`window.__NAI__.META.progress`);
  const saved = await session.evaluate(`
    (() => { const r = localStorage.getItem('nai_boss_meta');
             return r ? JSON.parse(r).progress : null; })()`);
  assertNoErrors('胜利流程');
  assert(after > before, `进度未前进 (${before} -> ${after})`);
  assert(saved !== null && saved >= 1, `存档未更新, progress=${saved}`);
  return `progress ${before} -> ${after}, 存档 progress=${saved}`;
});

// ---------- 5. 胜利音效：笑声 mp3 必须真的能解码并播放 ----------
await check('胜利时播放笑声 mp3（能解码、真的开始播放、换关会停）', async () => {
  await session.goto(`${fileUrl}?debug&level=1`);
  await waitImages();
  await session.waitFor(
    `(() => { const a = document.getElementById('bgm'); return !!a && a.readyState >= 1; })()`,
    15000, '音频元数据加载'
  );
  const meta = await session.evaluate(`
    (() => { const a = document.getElementById('bgm');
             return { src: (a.src || '').slice(0, 26), duration: a.duration, readyState: a.readyState,
                      preload: a.getAttribute('preload') }; })()`);
  assert(meta.src.startsWith('data:audio/mpeg'), '音频不是 mp3 data URI: ' + meta.src);
  assert(meta.duration > 8.5 && meta.duration < 10, `音频时长异常: ${meta.duration}`);
  assert(meta.preload === 'auto', '音频未预加载: ' + meta.preload);

  await session.evaluate(`window.__NAI__.step(170)`);
  await session.evaluate(`
    (() => { const N = window.__NAI__; N.setBossHp(1); N.damage(999999); N.step(40); })()`);
  assert(await session.evaluate(`window.__NAI__.state.mode`) === 'victory', '没进入胜利态');

  await session.waitFor(
    `(() => { const a = document.getElementById('bgm'); return !a.paused && a.currentTime > 0.05; })()`,
    10000, '胜利音效开始播放'
  );
  const st = await session.evaluate(`
    (() => { const a = document.getElementById('bgm');
             return { paused: a.paused, t: +a.currentTime.toFixed(2), dur: +a.duration.toFixed(2),
                      err: a.error ? a.error.code : null, vol: a.volume, muted: a.muted }; })()`);
  assert(st.err === null, '音频解码/播放错误码 ' + st.err);
  assert(st.muted === false, '音频处于静音状态');

  /* 进下一关时必须停掉，否则笑声会盖在新关卡上 */
  await session.evaluate(`window.__NAI__.startLevel(0)`);
  const after = await session.evaluate(`document.getElementById('bgm').paused`);
  assert(after === true, '换关后笑声没有停止');

  return `${st.dur}s / 已播到 ${st.t}s / 音量 ${st.vol}，换关即停`;
});

// ---------- 6. 损坏存档不能把人卡死 ----------
await check('存档被写坏时仍能正常加载并回落到默认值', async () => {
  await session.goto(fileUrl);
  await waitImages();
  /* 游戏在 beforeunload / visibilitychange 时会把内存里的 META 存回去，
     会把刚写进去的坏存档覆盖掉。所以这里同时屏蔽 setItem，才能真的测到
     「读到坏存档」这条路径。 */
  await session.evaluate(`
    (() => {
      localStorage.setItem('nai_boss_meta', '{不是JSON!@#$');
      const real = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (k === 'nai_boss_meta') return;
        return real.call(this, k, v);
      };
    })()`);
  await session.goto(fileUrl + '?debug');
  await waitImages();
  const st = await session.evaluate(`
    (() => { const M = window.__NAI__.META;
             return { milk: M.milk, progress: M.progress,
                      unlockedCount: Object.keys(M.unlocked || {}).length,
                      lvCount: Object.keys(M.lv || {}).length }; })()`);
  assertNoErrors('损坏存档');
  assert(st.milk === 0, `奶瓶应为 0, 实际 ${st.milk}`);
  assert(st.progress === 0, `进度应为 0, 实际 ${st.progress}`);
  assert(st.unlockedCount >= 5, `默认解锁角色应为 5 个, 实际 ${st.unlockedCount}`);
  assert(st.lvCount === 13, `13 个角色等级应存在, 实际 ${st.lvCount}`);
  await session.evaluate(`localStorage.removeItem('nai_boss_meta')`);
  return `解锁 ${st.unlockedCount} 个, 等级 ${st.lvCount} 条`;
});

// ---------- 6. 存档跨刷新保留 ----------
await check('正常存档在刷新后保留（升级 / 奶瓶）', async () => {
  await session.goto(fileUrl + '?debug');
  await waitImages();
  await session.evaluate(`
    (() => { const N = window.__NAI__;
             N.META.milk = 777; N.META.lv['奶狗'] = 3; N.save(); })()`);
  await session.goto(fileUrl + '?debug');
  await waitImages();
  const st = await session.evaluate(`
    (() => { const M = window.__NAI__.META; return { milk: M.milk, lv: M.lv['奶狗'] }; })()`);
  assert(st.milk === 777, `奶瓶应为 777, 实际 ${st.milk}`);
  assert(st.lv === 3, `奶狗等级应为 3, 实际 ${st.lv}`);
  await session.evaluate(`localStorage.removeItem('nai_boss_meta')`);
  return `奶瓶 ${st.milk}, 奶狗 Lv.${st.lv}`;
});

await session.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${'='.repeat(60)}`);
console.log(`结果: ${results.length - failed.length} 通过 / ${failed.length} 失败`);
if (failed.length) {
  console.log('\n失败项:');
  for (const f of failed) console.log('  - ' + f.name + ': ' + f.detail);
  process.exit(1);
}
console.log('全部通过 ✅');
