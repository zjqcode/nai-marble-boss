/* Build a single self-contained HTML game from a source template + assets.
 *
 * 用法:
 *   node build.js                              构建默认产物（src/boss.html -> 奶系弹珠_弹射讨伐.html + index.html）
 *   node build.js <src.html> <out.html>        指定源与产物
 *   node build.js --check                      只校验「现有产物 == 重新构建结果」，不一致则退出码 1
 *   node build.js --png                        优先使用 png/jpg 素材（默认优先 webp）
 *   node build.js --no-alias                   不额外生成 index.html
 */
const fs = require('fs');
const path = require('path');

const root = __dirname;
const assetsDir = path.join(root, 'assets');

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const positional = argv.filter((a) => !a.startsWith('--'));

const srcArg = positional[0] || path.join(root, 'src', 'boss.html');
const outArg = positional[1] || '奶系弹珠_弹射讨伐.html';
const outFile = path.resolve(root, outArg);
const checkOnly = flags.has('--check');
const noAlias = flags.has('--no-alias');
const preferPng = flags.has('--png');

const MIME = {
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};
const SPRITE_EXTS = preferPng ? ['.png', '.webp'] : ['.webp', '.png'];
const PHOTO_EXTS = preferPng ? ['.jpg', '.jpeg', '.webp'] : ['.webp', '.jpg', '.jpeg'];

const TOKEN = '/*__ASSETS__*/null';

function pick(stem, exts) {
  for (const ext of exts) {
    const p = path.join(assetsDir, stem + ext);
    if (fs.existsSync(p)) return { file: p, mime: MIME[ext] };
  }
  return null;
}

function b64(asset) {
  return 'data:' + asset.mime + ';base64,' + fs.readFileSync(asset.file).toString('base64');
}

/* ---------- 1. 收集素材（排序，保证跨机器构建产物字节一致） ---------- */
/* 这几个是专用槽位，不进精灵图集合，否则会被重复内联浪费体积 */
const RESERVED = new Set(['bg-thunder', 'chart', 'bgm']);

const stems = new Set();
for (const name of fs.readdirSync(assetsDir)) {
  const ext = path.extname(name).toLowerCase();
  if (ext !== '.png' && ext !== '.webp') continue;
  const stem = path.basename(name, path.extname(name));
  if (RESERVED.has(stem)) continue;
  stems.add(stem);
}

const sprites = {};
const spriteSource = {};
for (const stem of [...stems].sort()) {
  const hit = pick(stem, SPRITE_EXTS);
  if (!hit) {
    console.warn(`[warn] 素材夹里有 ${stem} 但没有可用的 png/webp 文件，已跳过`);
    continue;
  }
  sprites[stem] = b64(hit);
  spriteSource[stem] = path.basename(hit.file);
}

/* ---------- 2. 读取源码 ---------- */
if (!fs.existsSync(srcArg)) throw new Error('源码不存在: ' + srcArg);
let html = fs.readFileSync(srcArg, 'utf8');

/* ---------- 3. 组装素材表 ---------- */
const bg = pick('bg-thunder', PHOTO_EXTS);
const chart = pick('chart', PHOTO_EXTS);
if (!bg) throw new Error('缺少背景素材 assets/bg-thunder.(webp|jpg)');
if (!chart) throw new Error('缺少图鉴素材 assets/chart.(webp|jpg)');

const data = { bg: b64(bg), chart: b64(chart), sprites };
const bgm = pick('bgm', ['.mp4']);
if (bgm) data.audio = b64(bgm);

if (!html.includes(TOKEN)) throw new Error('源码里找不到素材占位符 ' + TOKEN);
/* 用函数式替换：避免素材数据中出现 $& / $' 时被当成替换模式 */
html = html.replace(TOKEN, () => JSON.stringify(data));

/* ---------- 4. 构建后校验 ---------- */
const problems = [];

if (html.includes(TOKEN)) problems.push('产物里仍残留素材占位符');

/* CHARS 表里每个角色都必须有对应立绘，否则会静默回退到 assets/ 外部路径，单文件就废了 */
const charsBlock = /var CHARS\s*=\s*\[[\s\S]*?\n\];/.exec(html);
if (charsBlock) {
  const names = [...charsBlock[0].matchAll(/\bn\s*:\s*'([^']+)'/g)].map((m) => m[1]);
  const missing = names.filter((n) => !sprites[n]);
  if (missing.length) problems.push('这些角色没有立绘: ' + missing.join(', '));
  const unused = Object.keys(sprites).filter((n) => !names.includes(n));
  if (unused.length) console.warn('[warn] 有素材未被 CHARS 使用: ' + unused.join(', '));
} else {
  problems.push('产物里找不到 CHARS 数据表，无法校验立绘完整性');
}

/* 外部相对路径只应作为「直接打开源码调试」时的回退，不能真的被用到 */
const externalRefs = (html.match(/assets\/[A-Za-z0-9_\u4e00-\u9fa5-]+\.(?:png|webp|jpg|jpeg|mp4)/g) || []);
if (externalRefs.length) console.warn(`[warn] 产物含 ${externalRefs.length} 处 assets/ 回退路径（正常，仅调试用）`);

if (problems.length) {
  console.error('\n构建校验失败:');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}

/* ---------- 5. 输出 ---------- */
const bytes = Buffer.from(html, 'utf8');

function report(label) {
  console.log(`${label}: ${outFile}`);
  console.log(`size  : ${(bytes.length / 1024 / 1024).toFixed(2)} MB`);
  console.log(`sprites: ${Object.keys(sprites).length}  bg: ${path.basename(bg.file)}  chart: ${path.basename(chart.file)}` +
    (bgm ? `  audio: ${path.basename(bgm.file)}` : '  audio: (无)'));
}

if (checkOnly) {
  if (!fs.existsSync(outFile)) {
    console.error('--check 失败: 产物不存在 ' + outFile);
    process.exit(1);
  }
  const existing = fs.readFileSync(outFile);
  if (existing.equals(bytes)) {
    console.log('--check OK: 现有产物与重新构建结果完全一致 (' + bytes.length + ' bytes)');
    process.exit(0);
  }
  console.error('--check 失败: 现有产物与重新构建结果不一致');
  console.error('  现有: ' + existing.length + ' bytes');
  console.error('  重建: ' + bytes.length + ' bytes');
  process.exit(1);
}

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, bytes);
report('built');

/* index.html 别名：部署到静态站/分享时避免中文文件名的 URL 编码问题 */
if (!noAlias && path.basename(outFile) !== 'index.html') {
  const alias = path.join(path.dirname(outFile), 'index.html');
  fs.writeFileSync(alias, bytes);
  console.log('alias: ' + alias);
}
