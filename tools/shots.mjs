/* 从当前构建重新生成 preview/ 截图（README 配图）。
 *
 *   node tools/shots.mjs
 *
 * 为什么需要这个：仓库里旧的 preview/*.jpg 是**更早版本**的画面，
 * 章节血量还是 360/560/780…（现在是 900/1300/1750…），留在 README 里会误导。
 *
 * 输出 dist/shots/*.png（780x1688 @2x），再由 tools/mkpreview.py 缩到 390x844 存成 jpg。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch } from './cdp.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const target = process.argv[2] || path.join(root, '奶系弹珠_弹射讨伐.html');
const outDir = path.join(root, 'dist', 'shots');
fs.mkdirSync(outDir, { recursive: true });

const fileUrl = pathToFileURL(target).href;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const s = await launch({ width: 390, height: 844, dsf: 2 });
console.log('浏览器:', s.browser);

async function waitImages() {
  await s.waitFor(`(window.__imgs||[]).length>0 && window.__imgs.every(i=>i.complete&&i.naturalWidth>0)`, 20000);
}

async function waitVisible(id, label) {
  await s.waitFor(
    `(() => { const e = document.getElementById(${JSON.stringify(id)});
              if (!e) return false;
              const cs = getComputedStyle(e);
              return cs.display !== 'none' && parseFloat(cs.opacity) > 0.9 && e.offsetHeight > 0; })()`,
    10000, label || id
  );
}

async function fullShot(name) {
  const r = await s.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(outDir, name + '.png'), Buffer.from(r.data, 'base64'));
  console.log('  ', name);
}

/* 关掉过场覆盖层，只留游戏画面 + HUD（生成文档图时用，不影响游戏本体） */
async function hideOverlays() {
  await s.evaluate(`
    (() => {
      for (const id of ['vs', 'intro', 'win', 'lose', 'levels', 'gallery', 'shop']) {
        const e = document.getElementById(id);
        if (e) e.classList.remove('show');
      }
    })()`);
  await sleep(350);
}

/* ---- 1. 开始界面 ---- */
await s.goto(fileUrl);
await waitImages();
await sleep(1900);                       // 等 #boot 的 CSS 动画（真实时间）结束
await waitVisible('intro', '开始界面');
await fullShot('intro');

/* ---- 2~4. 三个面板 ---- */
for (const [btn, panel, name] of [
  ['bIntroLevels', 'levels', 'levels'],
  ['bIntroGallery', 'gallery', 'gallery'],
  ['bIntroShop', 'shop', 'shop'],
]) {
  await s.evaluate(`document.getElementById(${JSON.stringify(btn)}).click()`);
  await waitVisible(panel, name);
  await sleep(700);                      // 等面板展开动画
  await fullShot(name);
  // 关掉面板：点右上角关闭按钮或返回按钮
  await s.evaluate(`
    (() => {
      const p = document.getElementById(${JSON.stringify(panel)});
      const b = p.querySelector('.close, #bBack, button');
      if (b) b.click();
    })()`);
  await sleep(400);
}

/* ---- 5. VS 开场 ---- */
/* VS 面板由真实时间的 CSS 过渡控制显隐，窗口期（约 1.4~1.9s）正好和 #boot 黑罩消失重叠，
   靠时序抓拍很脆弱。这里等黑罩走完后直接把 .show 类加上，稳定复现这张图。 */
await s.goto(fileUrl + '?debug&level=1');
await waitImages();
await sleep(1900);
await s.evaluate(`document.getElementById('vs').classList.add('show')`);
await sleep(800);                        // 等 vsIn 入场动画
await waitVisible('vs', 'VS 开场');
await fullShot('vs');

/* ---- 6. 战斗画面 ---- */
await s.goto(fileUrl + '?debug&level=1');
await waitImages();
await sleep(1900);
const playInfo = await s.evaluate(`
  (() => {
    const N = window.__NAI__, s = N.state, b = s.boss;
    window.__tick(170);                  // 跳过过场
    const y0 = b.y + b.h * 0.5 + 150;
    for (let i = 0; i < 5; i++) N.spawn(i + 3, b.x + (i - 2) * 54, y0, (i - 2) * 26, -(560 + i * 40));
    window.__tick(26);                   // 让球飞起来、拖尾长出来
    return { hp: Math.round(b.hp), hits: s.hits, balls: s.balls.length, mode: s.mode };
  })()`);
console.log('   战斗状态:', JSON.stringify(playInfo));
await hideOverlays();
await fullShot('play');

/* ---- 7. 蓄力/危险区 ---- */
const dodgeInfo = await s.evaluate(`
  (() => {
    const N = window.__NAI__, s = N.state;
    let f = 0;
    while (f < 1200 && !s.telegraph) { window.__tick(1); f++; }
    return { frames: f, hasTelegraph: !!s.telegraph, mode: s.mode, heroHP: s.heroHP };
  })()`);
console.log('   危险区状态:', JSON.stringify(dodgeInfo));
if (dodgeInfo.hasTelegraph) {
  await hideOverlays();
  await fullShot('dodge');
}

/* ---- 8. 胜利结算 ---- */
await s.goto(fileUrl + '?debug&level=1');
await waitImages();
await sleep(1900);
await s.evaluate(`
  (() => { const N = window.__NAI__;
           N.step(170);
           for (let i = 0; i < 4; i++) N.spawn(i + 4, N.view.cx + (i - 1.5) * 50, N.view.h * 0.7, 0, -700);
           N.setBossHp(1); N.damage(999999); N.step(40); })()`);
await waitVisible('win', '胜利面板');
await sleep(800);
await fullShot('win');

await s.close();
console.log('\n截图已写入', path.relative(root, outDir));
