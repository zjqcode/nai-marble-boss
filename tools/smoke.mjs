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

/* 支持 file:// 路径也支持 http(s) 地址（网页版必须走 HTTP 才不会被 canvas 跨域限制） */
const fileUrl = /^https?:\/\//.test(target) ? target : pathToFileURL(target).href;
const results = [];
let session;
/* 真实等待（媒体播放要靠真实时间推进，不能只靠 __tick 的虚拟时钟） */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

/* 音频源：单文件版是内联 data URI，网页部署版是 assets/*.mp3 相对路径，两种都算合法 */
const isMp3Src = (s) => s.startsWith('data:audio/mpeg') || /\.mp3(?:$|[?#])/.test(s);

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

const isUrl = /^https?:\/\//.test(target);
const targetLabel = isUrl ? target : path.relative(root, target);
const sizeLabel = isUrl ? 'HTTP 部署版' : `${(fs.statSync(target).size / 1024 / 1024).toFixed(2)} MB`;
console.log(`\n冒烟测试目标: ${targetLabel}  (${sizeLabel})\n`);

session = await launch({ width: 390, height: 844, dsf: 2 });
console.log(`浏览器: ${session.browser}\n`);

// ---------- 1. 资源解码 ----------
await check('产物可加载，14 张图片（13 立绘 + 图鉴）全部解码', async () => {
  await session.goto(fileUrl);
  const n = await waitImages();
  assertNoErrors('加载阶段');
  /* 背景已改为程序化生成，不再有背景图 */
  assert(n === 14, `期望 14 张图片（13 立绘 + 图鉴），实际 ${n}`);
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
             return { src: a.src || '', head: (a.src || '').slice(0, 40), duration: a.duration,
                      readyState: a.readyState, preload: a.getAttribute('preload') }; })()`);
  assert(isMp3Src(meta.src), '音频不是 mp3（内联 data URI 或 assets/*.mp3）: ' + meta.head);
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
                      err: a.error ? a.error.code : null, vol: a.volume, muted: a.muted, loop: a.loop }; })()`);
  assert(st.err === null, '音频解码/播放错误码 ' + st.err);
  assert(st.muted === false, '音频处于静音状态');
  assert(st.loop === true, '胜利音效应循环播放，但 loop=' + st.loop);

  /* 真的绕过结尾一次：把播放头推到尾端，等它自动回到开头 */
  await session.evaluate(`
    (() => { const a = document.getElementById('bgm'); a.currentTime = Math.max(0, a.duration - 0.25); })()`);
  await sleep(1400);
  const wrapped = await session.evaluate(`
    (() => { const a = document.getElementById('bgm'); return { t: +a.currentTime.toFixed(2), paused: a.paused }; })()`);
  assert(!wrapped.paused, '循环后应继续播放');
  assert(wrapped.t < 3, `循环未生效：播到尾端后 currentTime 仍为 ${wrapped.t}s`);

  /* 进下一关时必须停掉，否则笑声会盖在新关卡上 */
  await session.evaluate(`window.__NAI__.startLevel(0)`);
  const after = await session.evaluate(`document.getElementById('bgm').paused`);
  assert(after === true, '换关后笑声没有停止');

  return `${st.dur}s / 已播到 ${st.t}s / 音量 ${st.vol} / 循环，换关即停`;
});

// ---------- 5b. 失败音效：独立音轨、循环、音量更低 ----------
await check('失败时播放失败音效（独立音轨、循环、音量低于胜利音）', async () => {
  await session.goto(`${fileUrl}?debug&level=1`);
  await waitImages();
  await session.waitFor(
    `(() => { const a = document.getElementById('loseSnd'); return !!a && a.readyState >= 1; })()`,
    15000, '失败音效元数据加载'
  );
  const meta = await session.evaluate(`
    (() => { const a = document.getElementById('loseSnd');
             return { src: a.src || '', head: (a.src || '').slice(0, 40), dur: +a.duration.toFixed(2),
                      preload: a.getAttribute('preload') }; })()`);
  assert(isMp3Src(meta.src), '失败音效不是 mp3: ' + meta.head);
  assert(meta.dur > 15 && meta.dur < 18, `失败音效时长异常: ${meta.dur}`);
  assert(meta.preload === 'auto', '失败音效未预加载');

  await session.evaluate(`window.__NAI__.step(170)`);
  await session.evaluate(`window.__NAI__.lose()`);
  assert(await session.evaluate(`window.__NAI__.state.mode`) === 'lose', '没进入失败态');

  await session.waitFor(
    `(() => { const a = document.getElementById('loseSnd'); return !a.paused && a.currentTime > 0.05; })()`,
    10000, '失败音效开始播放'
  );
  const st = await session.evaluate(`
    (() => {
      const a = document.getElementById('loseSnd'), w = document.getElementById('bgm');
      return { paused: a.paused, t: +a.currentTime.toFixed(2), dur: +a.duration.toFixed(2),
               loop: a.loop, vol: +a.volume.toFixed(2), muted: a.muted,
               err: a.error ? a.error.code : null,
               winVol: +w.volume.toFixed(2), winPlaying: !w.paused };
    })()`);
  assert(st.err === null, '失败音效错误码 ' + st.err);
  assert(st.loop === true, '失败音效应循环播放');
  assert(st.muted === false, '失败音效处于静音状态');
  assert(st.vol < st.winVol, `失败音效音量(${st.vol})应低于胜利音(${st.winVol})，避免刺耳`);
  assert(!st.winPlaying, '失败时不应同时播放胜利音效');

  await session.evaluate(`window.__NAI__.startLevel(0)`);
  const after = await session.evaluate(`document.getElementById('loseSnd').paused`);
  assert(after === true, '重开/换关后失败音效没有停止');

  return `${st.dur}s / 已播到 ${st.t}s / 音量 ${st.vol} < 胜利${st.winVol} / 循环，换关即停`;
});

// ---------- 5c. 失败有两条路径：血量归零 / 超时，都要出声 ----------
await check('两条失败路径（血量归零 / 超时）都会播放失败音效', async () => {
  const out = {};
  for (const path of ['hp', 'timeout']) {
    await session.goto(`${fileUrl}?debug&level=1`);
    await waitImages();
    await session.waitFor(
      `(() => { const a = document.getElementById('loseSnd'); return !!a && a.readyState >= 1; })()`,
      15000, '音频元数据加载'
    );
    await session.evaluate(`window.__NAI__.step(170)`);

    if (path === 'hp') {
      /* 最常见的死法：被 Boss 反击打到 0 心 */
      await session.evaluate(`(() => { const N = window.__NAI__; N.state.heroHP = 1; N.hurtHero(5, '测试'); })()`);
    } else {
      /* 另一条：时间耗尽 */
      await session.evaluate(`(() => { const N = window.__NAI__; N.state.timer = 0.01; N.step(3); })()`);
    }

    const mode = await session.evaluate(`window.__NAI__.state.mode`);
    assert(mode === 'lose', `[${path}] 未进入失败态，mode=${mode}`);
    const label = path === 'hp' ? '血量归零' : '超时';
    await session.waitFor(
      `(() => { const a = document.getElementById('loseSnd'); return !a.paused && a.currentTime > 0.05; })()`,
      10000, `${label} 后失败音效未播放`
    );
    out[path] = await session.evaluate(`
      (() => { const a = document.getElementById('loseSnd');
               return { t: +a.currentTime.toFixed(2), loop: a.loop }; })()`);
  }
  return `血量归零 @${out.hp.t}s / 超时 @${out.timeout.t}s，均循环`;
});

// ---------- 6. 血瓶：受伤才可用、回 1 心、0.5s 冷却、满血/暂停/阵亡禁用 ----------
await check('血瓶：受伤可用 +1 心，冷却/满血/暂停/阵亡都不可用', async () => {
  await session.goto(`${fileUrl}?debug&level=1`);
  await waitImages();
  const r = await session.evaluate(`
    (() => {
      const N = window.__NAI__, st = N.state;
      N.tick(170);                              // 跳过过场
      N.META.items = { potion: 3 };
      N.updateItemBar();
      st.heroHP = 2; st.maxHP = 5; st.potionCd = 0;
      const out = {};

      N.useItem('potion');
      out.heal = { hp: st.heroHP, cd: +st.potionCd.toFixed(2), left: N.META.items.potion };

      const h1 = st.heroHP, n1 = N.META.items.potion;
      N.useItem('potion'); N.useItem('potion');   // 冷却中连按
      out.rapid = { hp: st.heroHP, changed: st.heroHP !== h1, used: n1 - N.META.items.potion };

      st.heroHP = st.maxHP; st.potionCd = 0;
      const n2 = N.META.items.potion;
      N.useItem('potion');                        // 满血
      out.full = { hp: st.heroHP, used: n2 - N.META.items.potion };

      st.heroHP = 2; st.potionCd = 0; st.paused = true;
      const n3 = N.META.items.potion;
      N.useItem('potion');                        // 暂停
      out.pausedUsed = n3 - N.META.items.potion;
      st.paused = false;

      st.mode = 'lose';
      const n4 = N.META.items.potion;
      N.useItem('potion');                        // 阵亡
      out.deadUsed = n4 - N.META.items.potion;
      st.mode = 'play';
      return out;
    })()`);
  assert(r.heal.hp === 3, `受伤时用血瓶应回到 3，实际 ${r.heal.hp}`);
  assert(r.heal.left === 2, `血瓶应被消耗 1 个，剩余 ${r.heal.left}`);
  assert(r.heal.cd > 0.4, `冷却应设为 0.5s，实际 ${r.heal.cd}`);
  assert(!r.rapid.changed && r.rapid.used === 0, '冷却期间连按不应生效也不应扣道具');
  assert(r.full.hp === 5 && r.full.used === 0, '满血时不应生效也不应扣道具');
  assert(r.pausedUsed === 0, '暂停时不应扣道具');
  assert(r.deadUsed === 0, '阵亡后不应扣道具');
  return `+1 心 / 冷却 ${r.heal.cd}s / 连按与满血暂停阵亡均无效`;
});

// ---------- 7. 反弹板：按钮进入放置模式、可拖拽、8 秒后消失 ----------
await check('反弹板：按钮拖拽放置、长度受控、8 秒后消失', async () => {
  await session.goto(`${fileUrl}?debug&level=1`);
  await waitImages();
  const r = await session.evaluate(`
    (() => {
      const N = window.__NAI__, st = N.state;
      N.tick(170);
      N.META.items = { plate: 2 };
      N.updateItemBar(); N.refreshPlateBtn();
      const c = document.getElementById('game');
      const send = (t, x, y) => c.dispatchEvent(new PointerEvent(t, {
        clientX: x, clientY: y, pointerId: 1, bubbles: true, cancelable: true }));

      const out = {};
      /* 用 pointer-events 判断可交互，而不是 opacity：后者有 0.25s CSS 过渡，
         读到的可能是过渡初始值，测试会偶发失败。 */
      out.btnVisibleInPlay = document.body.classList.contains('playing') &&
        getComputedStyle(document.getElementById('bPlate')).pointerEvents !== 'none';

      document.getElementById('bPlate').click();
      out.armed = !!st.placingPlate;
      out.aimCancelled = !st.aim.active;

      send('pointerdown', 300, 300);
      send('pointermove', 120, 470);
      out.dragTo = st.placingPlate ? { x: Math.round(st.placingPlate.x), y: Math.round(st.placingPlate.y) } : null;
      send('pointerup', 120, 470);

      out.afterPlace = {
        plates: st.plates.length,
        life: st.plates[0] ? +st.plates[0].life.toFixed(2) : null,
        len: st.plates[0] ? Math.round(st.plates[0].len) : null,
        x: st.plates[0] ? Math.round(st.plates[0].x) : null,
        y: st.plates[0] ? Math.round(st.plates[0].y) : null,
        left: N.META.items.plate,
        placing: !!st.placingPlate,
        maxLen: Math.round(N.plateLen()),
        fieldW: Math.round(N.view.w),
      };

      // 拖到场地外应被夹回场内
      document.getElementById('bPlate').click();
      send('pointerdown', -500, -500);
      send('pointerup', -500, -500);
      const p2 = st.plates[1];
      out.clamped = p2 ? { x: Math.round(p2.x), y: Math.round(p2.y),
                           inside: p2.x > N.view.left && p2.x < N.view.right && p2.y > N.view.top && p2.y < N.view.bottom } : null;

      N.step(60 * 9);   // 推进 9 秒
      out.after9s = st.plates.length;
      return out;
    })()`);
  assert(r.btnVisibleInPlay, '战斗中反弹板按钮应可见');
  assert(r.armed, '点按钮后应进入放置模式');
  assert(r.aimCancelled, '放置时应取消正在蓄力的瞄准');
  assert(r.dragTo && r.dragTo.x === 120 && r.dragTo.y === 470, '拖拽位置未跟随指针: ' + JSON.stringify(r.dragTo));
  assert(r.afterPlace.plates === 1, `应放下 1 块板，实际 ${r.afterPlace.plates}`);
  assert(r.afterPlace.life === 8, `寿命应为 8 秒，实际 ${r.afterPlace.life}`);
  assert(r.afterPlace.left === 1, `道具应减 1，剩余 ${r.afterPlace.left}`);
  assert(!r.afterPlace.placing, '放下后应退出放置模式');
  assert(r.afterPlace.len <= r.afterPlace.fieldW * 0.15,
    `板子过长（${r.afterPlace.len}px / 场宽 ${r.afterPlace.fieldW}px），会挡住进攻`);
  assert(r.clamped && r.clamped.inside, '拖到场地外应被夹回场内: ' + JSON.stringify(r.clamped));
  assert(r.after9s === 0, `8 秒后应全部消失，9 秒后还剩 ${r.after9s}`);
  return `拖到 (${r.afterPlace.x},${r.afterPlace.y})，长 ${r.afterPlace.len}px（场宽 ${r.afterPlace.fieldW}），寿命 ${r.afterPlace.life}s`;
});

// ---------- 8b. 双摇杆：左只横移、右方向+蓄力+发射 ----------
await check('双摇杆：左摇杆只横移（纵向无效）、右摇杆控方向与蓄力并发射', async () => {
  await session.goto(`${fileUrl}?debug&level=1`);
  await waitImages();
  const r = await session.evaluate(`
    (() => {
      const N = window.__NAI__, st = N.state;
      N.tick(170);
      const out = {};
      const center = (id) => {
        const b = document.getElementById(id).getBoundingClientRect();
        return { x: b.left + b.width/2, y: b.top + b.height/2 };
      };
      /* 摇杆的交互模型是"按下定点 + 拖动产生位移"，
         所以按下固定从圆心开始，位移一律由 pointermove 产生。 */
      const c0 = {};
      const down = (id) => {
        const c = center(id);
        c0[id] = c;
        document.getElementById(id).dispatchEvent(new PointerEvent('pointerdown', {
          clientX: c.x, clientY: c.y, pointerId: 11, bubbles: true, cancelable: true }));
      };
      const drag = (id, dx, dy) => {
        const c = c0[id] || center(id);
        document.getElementById(id).dispatchEvent(new PointerEvent('pointermove', {
          clientX: c.x + dx, clientY: c.y + dy, pointerId: 11, bubbles: true, cancelable: true }));
      };
      const up = (id) => document.getElementById(id).dispatchEvent(new PointerEvent('pointerup', {
        pointerId: 11, bubbles: true, cancelable: true }));

      out.oldButtonsGone = !document.getElementById('bMoveL') && !document.getElementById('bMoveR');

      /* 左摇杆：横推 -> 移动；纵推 -> 完全不动 */
      const x0 = st.cannonX;
      down('stickL'); drag('stickL', 40, 0);
      out.stickXRight = +st.stickX.toFixed(2);
      N.step(20);
      out.movedRight = Math.round(st.cannonX - x0);
      up('stickL');
      out.stickXReleased = st.stickX;

      const x1 = st.cannonX;
      down('stickL'); drag('stickL', 0, -45);
      out.stickXVertical = +st.stickX.toFixed(2);
      N.step(20);
      out.movedWhenVertical = Math.round(st.cannonX - x1);
      up('stickL');

      /* 右摇杆：方向与拉动方向相反——下拉 -> 向上发射 */
      st.balls.length = 0; st.reloadT = 0;
      down('stickR'); drag('stickR', 0, 45);   /* 正下拉 */
      out.aim = { dx: +st.aim.dx.toFixed(2), dy: +st.aim.dy.toFixed(2),
                  power: +st.aim.power.toFixed(2), active: st.aim.active };
      up('stickR');
      N.step(2);
      const b1 = st.balls[st.balls.length - 1];
      out.pullDown = b1 ? { vx: Math.round(b1.vx), vy: Math.round(b1.vy) } : null;

      /* 左下位拉 -> 朝右上发射 */
      st.balls.length = 0; st.reloadT = 0;
      down('stickR'); drag('stickR', -35, 35);
      up('stickR');
      N.step(2);
      const b2 = st.balls[st.balls.length - 1];
      out.pullDownLeft = b2 ? { vx: Math.round(b2.vx), vy: Math.round(b2.vy) } : null;

      /* 死区内的小推不应发射 */
      st.balls.length = 0; st.reloadT = 0;
      down('stickR'); drag('stickR', 1, 1);   /* 死区 0.07，1px 位移约 0.04，仍在死区内 */
      out.deadzonePower = +st.aim.power.toFixed(2);
      out.deadzoneActive = st.aim.active;
      up('stickR');
      N.step(2);
      out.deadzoneBalls = st.balls.length;
      return out;
    })()`);

  assert(r.oldButtonsGone, '原来的左右移动按钮应已移除');
  assert(r.stickXRight > 0.9, `右推时 stickX 应接近 1，实际 ${r.stickXRight}`);
  assert(r.movedRight > 40, `右推后炮台应右移，实际位移 ${r.movedRight}px`);
  assert(r.stickXReleased === 0, '松手后 stickX 应归零');
  assert(r.stickXVertical === 0, `只上下推时不应产生横向输入，实际 stickX=${r.stickXVertical}`);
  assert(r.movedWhenVertical === 0, `只上下推时炮台不应移动，实际位移 ${r.movedWhenVertical}px`);
  assert(r.aim.active && r.aim.dy < -0.5, '下拉的发射方向应朝上（取反）: ' + JSON.stringify(r.aim));
  assert(r.aim.power > 0.9, `推到底蓄力应接近 1，实际 ${r.aim.power}`);
  assert(r.pullDown && Math.abs(r.pullDown.vx) < 40 && r.pullDown.vy < 0,
    '正下拉应近似垂直向上发射: ' + JSON.stringify(r.pullDown));
  assert(r.pullDownLeft && r.pullDownLeft.vx > 0 && r.pullDownLeft.vy < 0,
    '左下位拉应朝右上发射: ' + JSON.stringify(r.pullDownLeft));
  assert(!r.deadzoneActive && r.deadzonePower === 0, '死区内不应进入瞄准态');
  assert(r.deadzoneBalls === 0, '死区内松手不应发射');

  return `左推位移 ${r.movedRight}px / 纵推 ${r.movedWhenVertical}px / ` +
    `正下拉发射 v(${r.pullDown.vx},${r.pullDown.vy}) / 左下位拉 v(${r.pullDownLeft.vx},${r.pullDownLeft.vy})`;
});

// ---------- 8c. 横屏布局 + 竖屏引导 ----------
await check('横屏布局：HUD 压扁、场地变高；竖屏有「进入横屏」按钮且点了不报错', async () => {
  const orig = { width: 390, height: 844, deviceScaleFactor: 2, mobile: true };

  /* 先确认竖屏：提示在、两个按钮在、点「进入横屏」不抛异常 */
  await session.goto(`${fileUrl}?debug&level=1`);
  await waitImages();
  const portrait = await session.evaluate(`
    (() => {
      const vis = (id) => {
        const e = document.getElementById(id);
        if (!e) return null;
        const b = e.getBoundingClientRect();
        return getComputedStyle(e).display !== 'none' && b.width > 0 && b.height > 0;
      };
      const out = {
        portrait: innerHeight > innerWidth,
        rotate: getComputedStyle(document.getElementById('rotate')).display,
        goBtn: vis('bRotateGo'),
        skipBtn: vis('bRotateOk'),
        throwErr: null,
      };
      try { document.getElementById('bRotateGo').click(); } catch (e) { out.throwErr = String(e); }
      return out;
    })()`);
  assert(portrait.portrait, '冒烟会话应是竖屏');
  assert(portrait.rotate !== 'none', '竖屏应显示「请横屏游玩」');
  assert(portrait.goBtn, '竖屏提示里应有「进入横屏」按钮');
  assert(portrait.skipBtn, '竖屏提示里应保留「仍要竖屏游玩」');
  assert(portrait.throwErr === null, '点「进入横屏」不应抛异常: ' + portrait.throwErr);

  /* 再切横屏测量布局 */
  await session.send('Emulation.setDeviceMetricsOverride', {
    width: 844, height: 390, deviceScaleFactor: 2, mobile: true,
  });
  await sleep(400);
  try {
    await session.goto(`${fileUrl}?debug&level=1`);
    await waitImages();
    const r = await session.evaluate(`
      (() => {
        const N = window.__NAI__, v = N.view;
        N.tick(60);
        const box = (id) => { const e = document.getElementById(id); const b = e.getBoundingClientRect();
                              return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width),
                                       h: Math.round(b.height), bottom: Math.round(b.bottom),
                                       right: Math.round(b.right) }; };
        const st = (id) => getComputedStyle(document.getElementById(id));
        const ov = (a, b) => a && b && a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom;
        const hudCard = getComputedStyle(document.querySelector('.hud-card'));
        const bossBar = getComputedStyle(document.querySelector('.boss-bar'));
        const dock = box('dock'), plate = box('bPlate');
        return {
          viewport: [innerWidth, innerHeight],
          hudH: box('hud').h,
          arenaH: Math.round(v.arenaH),
          viewW: Math.round(v.w),
          rotate: st('rotate').display,
          fieldLeft: Math.round(v.left), fieldRight: Math.round(v.right),
          stickRightEdge: Math.round(box('stickL').w + 14),
          /* HUD 去框：背景必须是 none，且要有阴影兜底 */
          hudCardBg: hudCard.backgroundImage,
          hudCardFilter: hudCard.filter,
          bossBarBg: bossBar.backgroundImage,
          bossBarFilter: bossBar.filter,
          /* 血条必须保持缩短（曾经为了填满而拉长到 76%，被反复投诉） */
          bossBarPct: Math.round(document.querySelector('.boss-bar').getBoundingClientRect().width / innerWidth * 100),
          /* dock 在左侧竖栏，不能压场地，也不能被左摇杆盖住 */
          dock,
          dockOverlapsStickL: ov(dock, box('stickL')),
          field: { x: Math.round(v.left), y: Math.round(v.top), right: Math.round(v.right), bottom: Math.round(v.bottom) },
          dockOverlapsField: ov(dock, { x: v.left, y: v.top, right: v.right, bottom: v.bottom }),
          fieldBottomGap: innerHeight - Math.round(v.bottom),
          ready: (() => {
            N.META.items.plate = 1;
            N.refreshPlateBtn();
            return true;
          })(),
          plate: (() => { const b = document.getElementById('bPlate').getBoundingClientRect();
                          return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width),
                                   h: Math.round(b.height), bottom: Math.round(b.bottom), right: Math.round(b.right) }; })(),
          plateOverlapsField: ov(document.getElementById('bPlate').getBoundingClientRect(),
                                 { x: v.left, y: v.top, right: v.right, bottom: v.bottom }),
          plateRightOfField: document.getElementById('bPlate').getBoundingClientRect().x >= v.right,
          plateOverlapsStickR: ov(document.getElementById('bPlate').getBoundingClientRect(), box('stickR')),
        };
      })()`);
    assert(r.viewport[0] > r.viewport[1], '应处于横屏视口');
    assert(r.hudH <= 64, `横屏 HUD 应压到 64px 以内，实际 ${r.hudH}px`);
    assert(r.arenaH >= 200, `横屏可玩带应 ≥200px，实际 ${r.arenaH}px`);
    assert(r.rotate === 'none', '横屏不应再弹"请横屏"提示');
    assert(r.stickRightEdge <= r.fieldLeft, `左摇杆(${r.stickRightEdge}px)不应压住场地(${r.fieldLeft}px 起)`);
    /* 1) HUD 不能有黑框 */
    assert(r.hudCardBg === 'none', `HUD 卡片背景应去掉，实际 ${r.hudCardBg}`);
    assert(r.bossBarBg === 'none', `Boss 血条背景应去掉，实际 ${r.bossBarBg}`);
    assert(/drop-shadow|blur/.test(r.hudCardFilter), 'HUD 应保留阴影以保证可读性，实际 ' + r.hudCardFilter);
    assert(/drop-shadow|blur/.test(r.bossBarFilter), 'Boss 血条应保留阴影');
    /* 2) 功能键在顶部一排：不得越过可玩区顶线，也不得碰到摇杆 */
    assert(r.dock.bottom <= r.field.y + 40,
      `dock 不应侵入可玩区（场地顶 ${r.field.y} / dock 底 ${r.dock.bottom}）`);
    assert(!r.dockOverlapsStickL, `dock 不应碰到左摇杆（dock 底 ${r.dock.bottom}px）`);
    /* 3) 血条必须保持缩短 */
    assert(r.bossBarPct <= 55, `Boss 血条应保持缩短（≤55%），实际 ${r.bossBarPct}%`);
    /* 3) 场地框必须贴到屏幕最底部（下面不该留空带） */
    assert(r.fieldBottomGap <= 8, `场地底边应贴到屏幕底部，实际留空 ${r.fieldBottomGap}px`);
    assert(r.arenaH >= 260, `场地贴底后可玩带应 ≥260px，实际 ${r.arenaH}px`);
    /* 4) 反弹板按钮在右侧栏、不压场地、不压摇杆 */
    assert(r.plateRightOfField, `反弹板应在场地右侧栏，实际 x=${r.plate.x} / 场地右边界 ${r.field.right}`);
    assert(!r.plateOverlapsField, '反弹板不应压场地');
    assert(!r.plateOverlapsStickR, '反弹板不应压右摇杆');
    assertNoErrors('横屏引导');
    return `HUD ${r.hudH}px / 场地 ${r.viewW}×${r.arenaH} 贴底(留${r.fieldBottomGap}) / ` +
      `dock 左栏 x=${r.dock.x} / 反弹板右侧 x=${r.plate.x}`;
  } finally {
    await session.send('Emulation.setDeviceMetricsOverride', orig);
    await sleep(300);
  }
});

// ---------- 8d. 暂停 ----------
await check('暂停：按钮/P/Esc 都能切换，计时与 Boss 冻结，继续后恢复', async () => {
  await session.goto(`${fileUrl}?debug&level=1`);
  await waitImages();
  const r = await session.evaluate(`
    (() => {
      const N = window.__NAI__, st = N.state, out = {};
      N.tick(170);                                  /* 跳过开场 */
      out.hasPauseBtn = !!document.getElementById('bPause');
      out.dockButtons = document.querySelectorAll('#dock .dock-btn').length;

      /* 点暂停 */
      document.getElementById('bPause').click();
      out.paused = st.paused;
      out.screenShown = document.getElementById('pause').classList.contains('show');

      /* 暂停中推进：计时、Boss 血量、球都不能动 */
      const t0 = st.timer, hp0 = st.boss.hp, b0 = st.balls.length;
      const bx0 = st.boss.x;
      N.tick(60);
      out.frozen = Math.abs(st.timer - t0) < 1e-6 && Math.abs(st.boss.hp - hp0) < 1e-6 &&
        st.balls.length === b0 && Math.abs(st.boss.x - bx0) < 1e-6;

      /* 暂停中摇杆不应响应 */
      const stick = document.getElementById('stickR');
      const bb = stick.getBoundingClientRect();
      stick.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: bb.left + bb.width/2, clientY: bb.top + bb.height/2,
        pointerId: 31, bubbles: true, cancelable: true }));
      out.aimOnPause = st.aim.active;
      stick.dispatchEvent(new PointerEvent('pointerup', { pointerId: 31, bubbles: true, cancelable: true }));

      /* 继续 */
      document.getElementById('bResume').click();
      out.pausedAfterResume = st.paused;
      out.hiddenAfterResume = !document.getElementById('pause').classList.contains('show');
      const t1 = st.timer;
      N.tick(30);
      out.resumed = st.timer < t1;

      /* 快捷键：P 与 Esc 都是切换 */
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', bubbles: true }));
      out.pausedByKeyP = st.paused;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      out.unpausedByEsc = !st.paused;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      out.pausedByEsc = st.paused;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      out.escTogglesBack = !st.paused;
      return out;
    })()`);
  assert(r.hasPauseBtn, '应有暂停按钮');
  assert(r.dockButtons === 7, `dock 应有 7 个按钮（含暂停），实际 ${r.dockButtons}`);
  assert(r.paused && r.screenShown, '点暂停后应暂停并显示面板');
  assert(r.frozen, '暂停期间计时/Boss/球都应冻结');
  assert(!r.aimOnPause, '暂停时摇杆不应产生瞄准');
  assert(!r.pausedAfterResume && r.hiddenAfterResume, '继续后应解除暂停并收起面板');
  assert(r.resumed, '继续后计时应恢复');
  assert(r.pausedByKeyP, 'P 键应能暂停');
  assert(r.unpausedByEsc, 'Esc 应能继续');
  assert(r.pausedByEsc, 'Esc 在游戏中应能暂停');
  assert(r.escTogglesBack, 'Esc 再按应恢复');
  return `7 键 / 暂停冻结 ✓ / 继续恢复 ✓ / P 与 Esc 均可切换`;
});

// ---------- 8e. 反弹板 360° 旋转 ----------
await check('反弹板：第二根手指可 360° 旋转，抬旋转指不误放，Q/E 微调', async () => {
  await session.goto(`${fileUrl}?debug&level=1`);
  await waitImages();
  const r = await session.evaluate(`
    (() => {
      const N = window.__NAI__, st = N.state;
      N.tick(170);
      N.META.items.plate = 3; N.updateItemBar(); N.refreshPlateBtn();
      N.startPlatePlacement();
      const out = { hasPlacement: !!st.placingPlate, before: +st.placingPlate.ang.toFixed(2) };
      const cv = document.getElementById('game');
      const cx = st.placingPlate.x, cy = st.placingPlate.y;
      const ev = (type, x, y, id) => cv.dispatchEvent(new PointerEvent(type, {
        clientX: x, clientY: y, pointerId: id, bubbles: true, cancelable: true }));

      ev('pointerdown', cx, cy, 41);                    /* 第一指：定位 */
      ev('pointerdown', cx + 90, cy, 42);               /* 第二指：正右 */
      out.angRight = +st.placingPlate.ang.toFixed(2);
      ev('pointermove', cx, cy + 90, 42);               /* 第二指：正下 */
      out.angDown = +st.placingPlate.ang.toFixed(2);
      ev('pointermove', cx - 90, cy, 42);               /* 第二指：正左 */
      out.angLeft = +st.placingPlate.ang.toFixed(2);
      ev('pointerup', cx, cy, 42);                      /* 抬旋转指 */
      out.stillPlacing = !!st.placingPlate;
      const a0 = st.placingPlate.ang;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));
      out.qeDelta = +(st.placingPlate.ang - a0).toFixed(3);
      N.cancelPlatePlacement(true);
      return out;
    })()`);
  const deg = (rad) => Math.round((((rad * 180 / Math.PI) % 360) + 360) % 360);
  assert(r.hasPlacement, '应进入放置模式');
  assert(deg(r.angRight) === 90 || deg(r.angRight) === 270, `手指在右侧应得到 ~90°，实际 ${deg(r.angRight)}°`);
  assert(deg(r.angDown) === 180 || deg(r.angDown) === 0, `手指在下方应得到 ~180°，实际 ${deg(r.angDown)}°`);
  assert(deg(r.angLeft) === 270 || deg(r.angLeft) === 90, `手指在左侧应得到 ~270°，实际 ${deg(r.angLeft)}°`);
  assert(r.stillPlacing, '抬起旋转指不应确认放置');
  assert(Math.abs(Math.abs(r.qeDelta) - Math.PI / 12) < 0.01, `Q/E 应旋转 15°，实际 ${r.qeDelta} rad`);
  return `右${deg(r.angRight)}° / 下${deg(r.angDown)}° / 左${deg(r.angLeft)}° / 抬指不误放 / Q/E 15°`;
});

// ---------- 8f. 胜利面板横屏一屏放得下 ----------
await check('胜利面板：横屏两栏，进入下一章与选择章节都在可视区，无需滚动', async () => {
  await session.send('Emulation.setDeviceMetricsOverride', {
    width: 844, height: 390, deviceScaleFactor: 2, mobile: true,
  });
  await sleep(400);
  try {
    await session.goto(`${fileUrl}?debug&level=1`);
    await waitImages();
    await session.evaluate(`(() => { const N = window.__NAI__; N.tick(170); N.win(); })()`);
    let shown = false;
    for (let i = 0; i < 40; i++) {
      shown = await session.evaluate(`document.getElementById('win').classList.contains('show')`);
      if (shown) break;
      await session.evaluate(`window.__NAI__.tick(6)`);
      await sleep(120);
    }
    assert(shown, '胜利面板应能弹出');
    const r = await session.evaluate(`
      (() => {
        /* 强制显示解锁块：这才是玩家截图里的最坏情况（解锁信息把按钮挤下去）。
           正常存档下这一块可能已解锁过而隐藏，所以不能只在自然状态下测。 */
        const ub = document.getElementById('unlockBox');
        ub.style.display = 'flex';
        document.getElementById('win').classList.remove('no-unlock');
        document.getElementById('unlockName').textContent = '【奶兔】';
        const sheet = document.querySelector('#win .sheet');
        const box = (id) => { const b = document.getElementById(id).getBoundingClientRect();
                              return { top: Math.round(b.top), bottom: Math.round(b.bottom) }; };
        return {
          vh: innerHeight,
          next: box('bNext'), levels: box('bWinLevels'),
          scrollable: sheet.scrollHeight > sheet.clientHeight + 2,
          unlockVisible: getComputedStyle(ub).display !== 'none',
          cols: getComputedStyle(sheet).gridTemplateColumns,
        };
      })()`);
    assert(r.unlockVisible, '解锁展示块应可见（已强制显示）');
    assert(r.next.top >= 0 && r.next.bottom <= r.vh,
      `「进入下一章」应在可视区内，实际 ${JSON.stringify(r.next)} / 视口高 ${r.vh}`);
    assert(r.levels.bottom <= r.vh, `「选择章节」应在可视区内，实际 ${JSON.stringify(r.levels)}`);
    assert(!r.scrollable, '胜利面板不应需要滚动才能看到按钮');
    return `两栏 ${r.cols} / 下一章 ${r.next.top}~${r.next.bottom}px / 无需滚动`;
  } finally {
    await session.send('Emulation.setDeviceMetricsOverride', {
      width: 390, height: 844, deviceScaleFactor: 2, mobile: true,
    });
    await sleep(300);
  }
});

// ---------- 8g. 切后台停止循环音效 ----------
await check('切后台立即停掉循环的结算音效（不会在别的 App 上继续响）', async () => {
  await session.goto(`${fileUrl}?debug&level=1`);
  await waitImages();
  await session.evaluate(`(() => { const N = window.__NAI__; N.tick(170); N.win(); })()`);
  await sleep(800);
  const r = await session.evaluate(`
    (async () => {
      const el = document.getElementById('bgm');
      const N = window.__NAI__;
      const playingBefore = !el.paused;
      const ctxBefore = N.audioState().ctx;
      /* 模拟切到别的 App：hidden 置真并派发 visibilitychange */
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise(r => setTimeout(r, 150));
      return { playingBefore, pausedAfter: el.paused, ctxBefore,
               ctxAfter: N.audioState().ctx, bgmAfter: N.audioState().bgm };
    })()`);
  assert(r.playingBefore, '胜利音效应正在播放（否则测不到暂停）');
  assert(r.pausedAfter, '切后台后循环音效应立即暂停');
  assert(r.ctxAfter === 'suspended', '切后台后 Web Audio 应被挂起（BGM 靠它静音），实际 ' + r.ctxAfter);
  assert(!r.bgmAfter, '切后台后 BGM 调度器应停止');
  return `播放中 → 切后台后 paused / AudioContext ${r.ctxBefore}→${r.ctxAfter} / BGM 已停`;
});

// ---------- 8h. 结算面板：没有左栏内容时不能留空 ----------
await check('结算面板：失败面板与「无新角色解锁」的胜利面板都收成单栏，不留空半边', async () => {
  await session.send('Emulation.setDeviceMetricsOverride', {
    width: 844, height: 390, deviceScaleFactor: 2, mobile: true,
  });
  await sleep(400);
  try {
    const probe = (sel) => `
      (() => {
        const sheet = document.querySelector('${sel} .sheet');
        const sb = sheet.getBoundingClientRect();
        const kids = [...sheet.children].filter(k => getComputedStyle(k).display !== 'none');
        const minX = Math.min(...kids.map(k => Math.round(k.getBoundingClientRect().x)));
        return { cols: getComputedStyle(sheet).gridTemplateColumns.split(' ').length,
                 sheetW: Math.round(sb.width),
                 centered: Math.abs((sb.x + sb.width / 2) - innerWidth / 2) < 8,
                 leftGap: minX - Math.round(sb.x) };
      })()`;

    /* 1) 失败面板：本来就没有左栏内容 */
    await session.goto(`${fileUrl}?debug&level=1`);
    await waitImages();
    await session.evaluate(`(() => { const N = window.__NAI__; N.tick(170); N.lose(); })()`);
    for (let i = 0; i < 40; i++) {
      if (await session.evaluate(`document.getElementById('lose').classList.contains('show')`)) break;
      await session.evaluate(`window.__NAI__.tick(6)`);
      await sleep(100);
    }
    const lose = await session.evaluate(probe('#lose'));
    assert(lose.cols === 1, `失败面板应为单栏，实际 ${lose.cols} 栏`);
    assert(lose.centered, '失败面板应水平居中');

    /* 2) 胜利面板：两种状态都测。冒烟跑到这里角色大多已解锁，
          所以直接构造两种状态，而不是依赖"第几次通关"。 */
    await session.goto(`${fileUrl}?debug&level=1`);
    await waitImages();
    await session.evaluate(`(() => { const N = window.__NAI__; N.tick(170); N.win(); })()`);
    for (let i = 0; i < 40; i++) {
      if (await session.evaluate(`document.getElementById('win').classList.contains('show')`)) break;
      await session.evaluate(`window.__NAI__.tick(6)`);
      await sleep(100);
    }

    /* 2a) 无解锁：隐藏解锁块 + no-unlock -> 必须单栏 */
    await session.evaluate(`
      (() => {
        document.getElementById('unlockBox').classList.add('hide');
        document.getElementById('win').classList.add('no-unlock');
      })()`);
    await sleep(80);
    const noUnlock = await session.evaluate(probe('#win'));
    assert(noUnlock.cols === 1, `无解锁时应收成单栏，实际 ${noUnlock.cols} 栏`);
    assert(noUnlock.centered, '无解锁单栏时应水平居中');

    /* 2b) 有解锁：显示解锁块 + 去掉 no-unlock -> 必须两栏 */
    await session.evaluate(`
      (() => {
        document.getElementById('unlockBox').classList.remove('hide');
        document.getElementById('win').classList.remove('no-unlock');
        document.getElementById('unlockName').textContent = '【奶兔】';
      })()`);
    await sleep(80);
    const withUnlock = await session.evaluate(probe('#win'));
    assert(withUnlock.cols === 2, `有解锁展示时应为两栏，实际 ${withUnlock.cols} 栏`);
    return `失败单栏 ${lose.sheetW}px / 胜利无解锁 ${noUnlock.cols} 栏 ${noUnlock.sheetW}px / 有解锁 ${withUnlock.cols} 栏`;
  } finally {
    await session.send('Emulation.setDeviceMetricsOverride', {
      width: 390, height: 844, deviceScaleFactor: 2, mobile: true,
    });
    await sleep(300);
  }
});

// ---------- 8i. 加时奶糖 ----------
await check('加时奶糖：+10 秒、50 奶瓶、最多堆 6 个', async () => {
  await session.goto(`${fileUrl}?debug&level=1`);
  await waitImages();
  const r = await session.evaluate(`
    (() => {
      const N = window.__NAI__, st = N.state;
      N.tick(170);
      const out = {};

      N.META.milk = 100000;
      N.META.items.time = 0;
      document.getElementById('bShop').click();
      const card = [...document.querySelectorAll('.shop-card')].find(c => c.textContent.includes('加时奶糖'));
      out.hasCard = !!card;
      out.cardText = card ? card.textContent.replace(/\\s+/g, ' ').trim() : '';

      /* 连点 10 次，上限 6 */
      for (let i = 0; i < 10; i++) {
        const btn = document.querySelector('[data-buy="time"]');
        if (!btn) break;
        btn.click();
      }
      out.stacked = N.META.items.time;
      out.buyLabel = (document.querySelector('[data-buy="time"]') || {}).textContent || '';
      out.spent = 100000 - N.META.milk;

      /* 关掉商店：openScreen 会把游戏置为暂停，useItem 会拒绝 */
      const closeBtn = document.querySelector('#shop [data-close]');
      if (closeBtn) closeBtn.click();

      st.timer = 30;
      const t0 = st.timer;
      N.useItem('time');
      out.delta = Math.round((st.timer - t0) * 100) / 100;
      out.left = N.META.items.time;

      const t1 = st.timer;
      N.useItem('time'); N.useItem('time'); N.useItem('time');
      out.delta3 = Math.round((st.timer - t1) * 100) / 100;
      out.leftAfter = N.META.items.time;

      N.updateItemBar();
      out.inBar = !!document.querySelector('#itemBar [data-item="time"]');
      return out;
    })()`);
  assert(r.hasCard, '商店里应有「加时奶糖」');
  assert(/50 奶瓶/.test(r.cardText), '售价应为 50 奶瓶，实际卡片: ' + r.cardText.slice(0, 60));
  assert(r.stacked === 6, `最多只能堆 6 个，实际 ${r.stacked}`);
  assert(r.spent === 300, `买 6 个应花 300 奶瓶，实际 ${r.spent}`);
  assert(/已满/.test(r.buyLabel), '买满后按钮应显示「已满」，实际 ' + r.buyLabel);
  assert(r.delta === 10, `用 1 个应 +10 秒，实际 ${r.delta}`);
  assert(r.left === 5, `用掉后应剩 5 个，实际 ${r.left}`);
  assert(r.delta3 === 30, `连用 3 个应 +30 秒，实际 ${r.delta3}`);
  assert(r.inBar, '道具栏里应出现加时奶糖');
  return `堆到 ${r.stacked} 个 / 花 ${r.spent} 奶瓶 / +${r.delta} 秒 → +${r.delta3} 秒`;
});

// ---------- 8. 动态背景：确实在动，且不再依赖静态图 ----------
await check('动态背景：画面随时间变化（不再是一张静态图）', async () => {
  await session.goto(`${fileUrl}?debug&level=1`);
  await waitImages();
  const r = await session.evaluate(`
    (() => {
      const N = window.__NAI__, c = document.getElementById('game');
      const g = c.getContext('2d');
      N.tick(170);
      const grab = () => new Uint8ClampedArray(g.getImageData(0, 0, c.width, c.height).data);
      const a = grab();
      N.tick(45);                       // 0.75 秒后
      const b = grab();
      let changed = 0, n = 0;
      for (let i = 0; i < a.length; i += 4 * 11) {
        const d = Math.abs(a[i]-b[i]) + Math.abs(a[i+1]-b[i+1]) + Math.abs(a[i+2]-b[i+2]);
        if (d > 6) changed++;
        n++;
      }
      return { sampled: n, changed, pct: +(100*changed/n).toFixed(1),
               hasBgImage: !!document.querySelector('img') };
    })()`);
  assert(r.pct > 3, `画面几乎没变化（${r.pct}% 采样点），背景可能没在动`);
  return `${r.pct}% 采样点随时间变化（0.75 秒）`;
});

// ---------- 9. 损坏存档不能把人卡死 ----------
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
