/* 视觉回归对比：把「旧 PNG/JPG 构建」和「新 WebP 构建」在同一确定性环境下渲染，
 * 分别截图后交给 tools/pixdiff.py 做像素比对。
 *
 *   node tools/visual-diff.mjs <a.html> <b.html> [输出目录]
 *
 * 两种场景：
 *   1. texture —— 直接把内联素材 1:1 画到 canvas，隔离编解码器差异，纯确定性
 *   2. scene   —— 真实游戏画面（同一随机种子 + 同一虚拟时钟 + 同一帧数）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch } from './cdp.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const a = process.argv[2];
const b = process.argv[3];
const outDir = path.resolve(root, process.argv[4] || 'dist/visual');
if (!a || !b) {
  console.error('用法: node tools/visual-diff.mjs <a.html> <b.html> [输出目录]');
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });

const s = await launch({ width: 390, height: 844, dsf: 2 });
console.log('浏览器:', s.browser);

async function textureShot(file, tag) {
  await s.goto(pathToFileURL(file).href);
  await s.waitFor(`(window.__imgs||[]).length>0 && window.__imgs.every(i=>i.complete&&i.naturalWidth>0)`, 20000);
  // ASSET_DATA 在 IIFE 作用域里拿不到，改用页面已创建的 Image 实例（背景+图鉴+13 立绘）
  await s.evaluate(`
    (() => {
      const list = window.__imgs.slice();
      window.__texReady = Promise.resolve().then(() => {
        const pad = 8;
        let x = pad, y = pad, rowH = 0, w = pad;
        const cells = [];
        for (const im of list) {
          if (!im || !im.naturalWidth) continue;
          if (x + im.naturalWidth + pad > 1560) { x = pad; y += rowH + pad; rowH = 0; }
          cells.push({ im, x, y });
          x += im.naturalWidth + pad;
          w = Math.max(w, x);
          rowH = Math.max(rowH, im.naturalHeight);
        }
        const h = y + rowH + pad;
        const cv = document.createElement('canvas');
        cv.id = '__tex__';
        cv.width = w; cv.height = h;
        const g = cv.getContext('2d');
        g.fillStyle = '#101014'; g.fillRect(0, 0, w, h);
        for (const c of cells) g.drawImage(c.im, c.x, c.y);
        document.body.innerHTML = '';
        document.body.style.margin = '0';
        document.body.appendChild(cv);
        return { w, h, count: cells.length };
      });
      return 1;
    })()`);
  const info = await s.evaluate(`window.__texReady`);
  // 直接导出 canvas 自身像素：绕开视口/滚动，纯确定性
  const data = await s.evaluate(`document.getElementById('__tex__').toDataURL('image/png')`);
  fs.writeFileSync(path.join(outDir, `texture_${tag}.png`), Buffer.from(data.split(',')[1], 'base64'));
  return info;
}

async function sceneShot(file, tag) {
  await s.goto(pathToFileURL(file).href + '?debug&level=1');
  await s.waitFor(`(window.__imgs||[]).length>0 && window.__imgs.every(i=>i.complete&&i.naturalWidth>0)`, 20000);
  const st = await s.evaluate(`
    (() => {
      const N = window.__NAI__, s = N.state, b = s.boss;
      /* 用真实速度摆一个包含多等级球的战场 */
      const y0 = b.y + b.h * 0.5 + 150;
      for (let i = 0; i < 6; i++) N.spawn(i + 2, b.x + (i - 2.5) * 52, y0, (i - 2.5) * 30, -(520 + i * 40));
      window.__tick(200);   // 同一虚拟时钟、同一帧数
      return { mode: s.mode, hp: Math.round(s.boss.hp), hits: s.hits, balls: s.balls.length };
    })()`);
  /* 关键：导出 canvas 自身像素，而不是整页截图。
     DOM 覆盖层（#boot 黑罩、VS 过场）由真实时间的 CSS 动画驱动，不受虚拟时钟控制，
     整页截图会把「真实时间差」混进来，掩盖真正要比较的渲染差异。 */
  const data = await s.evaluate(`document.getElementById('game').toDataURL('image/png')`);
  fs.writeFileSync(path.join(outDir, `scene_${tag}.png`), Buffer.from(data.split(',')[1], 'base64'));
  return st;
}

console.log('\n[A] 纹理表（隔离编解码差异）');
const tiA = await textureShot(a, 'a');
const tiB = await textureShot(b, 'b');
console.log('   A:', JSON.stringify(tiA));
console.log('   B:', JSON.stringify(tiB));

console.log('\n[B] 真实游戏画面（同种子 / 同时钟 / 同帧数）');
const scA = await sceneShot(a, 'a');
const scB = await sceneShot(b, 'b');
console.log('   A:', JSON.stringify(scA));
console.log('   B:', JSON.stringify(scB));

await s.close();
console.log('\n截图已写入', path.relative(root, outDir));
