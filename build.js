/* Build a single self-contained HTML game from a source template + assets.
 *
 * 源码结构：默认从 src/parts/manifest.json 组装（骨架 index.html + style.css + js/*.js），
 * 所有 JS 片段按 manifest 顺序拼进同一个 <script>，因此仍共享同一个 IIFE 作用域。
 *
 * 用法:
 *   node build.js                              构建默认产物（src/parts -> 奶系弹珠_弹射讨伐.html + index.html）
 *   node build.js <src.html> <out.html>        直接用一个单文件源码构建（兼容旧用法）
 *   node build.js --check                      只校验「现有产物 == 重新构建结果」，不一致则退出码 1
 *   node build.js --emit-source                把组装好的源码写到 dist/source.html（便于单文件调试）
 *   node build.js --web [目录]                 生成「外置资源」的网页部署版（默认 dist/web）
 *   node build.js --web --asset-base <url>     把素材前缀改写成绝对地址（素材放国内仓库/CDN，HTML 放任何地方）
 *   node build.js --png                        优先使用 png/jpg 素材（默认优先 webp）
 *   node build.js --no-alias                   不额外生成 index.html
 */
const fs = require('fs');
const path = require('path');

const root = __dirname;
const assetsDir = path.join(root, 'assets');
const partsDir = path.join(root, 'src', 'parts');
const partsManifest = path.join(partsDir, 'manifest.json');

const STYLE_MARK = '/*__STYLE__*/';
const JS_MARK = '/*__JS__*/';

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
/* --web 的可选输出目录：node build.js --web public */
const webMode = flags.has('--web');
const webDirArg = (() => {
  const i = argv.indexOf('--web');
  if (i < 0) return null;
  const next = argv[i + 1];
  return next && !next.startsWith('--') ? next : null;
})();
/* positional：排除 --flag，以及 --web / --asset-base 后面那个「取值」 */
const positional = argv.filter((a, i) => {
  if (a.startsWith('--')) return false;
  if (i > 0 && (argv[i - 1] === '--web' || argv[i - 1] === '--asset-base')) return false;
  return true;
});
/* --asset-base：素材前缀改写目标，例如 https://gitee.com/<user>/<repo>/raw/master/assets/ */
const assetBaseArg = (() => {
  const i = argv.indexOf('--asset-base');
  if (i < 0) return null;
  const next = argv[i + 1];
  return next && !next.startsWith('--') ? next : null;
})();

const srcArg = positional[0] || null;
const outArg = positional[1] || '奶系弹珠_弹射讨伐.html';
const outFile = path.resolve(root, outArg);
const checkOnly = flags.has('--check');
const noAlias = flags.has('--no-alias');
const preferPng = flags.has('--png');
const emitSource = flags.has('--emit-source');

const MIME = {
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.mp4': 'audio/mp4',
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
/* 优先从 src/parts 组装；显式给了单文件路径则直接读那个文件 */
function assembleFromParts() {
  if (!fs.existsSync(partsManifest)) {
    throw new Error('找不到 ' + partsManifest + '，请显式传入源码文件');
  }
  const manifest = JSON.parse(fs.readFileSync(partsManifest, 'utf8'));
  const skeleton = fs.readFileSync(path.join(partsDir, manifest.skeleton), 'utf8');
  const style = fs.readFileSync(path.join(partsDir, manifest.style), 'utf8');
  const js = manifest.js.map((f) => fs.readFileSync(path.join(partsDir, f), 'utf8')).join('');
  if (!skeleton.includes(STYLE_MARK)) throw new Error('骨架缺少样式占位符 ' + STYLE_MARK);
  if (!skeleton.includes(JS_MARK)) throw new Error('骨架缺少脚本占位符 ' + JS_MARK);
  return skeleton.replace(STYLE_MARK, () => style).replace(JS_MARK, () => js);
}

let html;
if (srcArg) {
  if (!fs.existsSync(srcArg)) throw new Error('源码不存在: ' + srcArg);
  html = fs.readFileSync(srcArg, 'utf8');
} else {
  html = assembleFromParts();
}

/* ---------- 3a. 网页部署版（外置资源，便于 CDN / 浏览器缓存 / 国内加速） ----------
   与单文件版的区别：不把素材内联成 data URI，而是输出 index.html + assets/ 目录，
   HTML 里保留 assets/xxx 的相对路径。浏览器可以分别缓存，首屏 HTML 只有 ~200KB。 */
if (webMode) {
  const webDir = path.resolve(root, webDirArg || 'dist/web');
  fs.rmSync(webDir, { recursive: true, force: true });
  fs.mkdirSync(webDir, { recursive: true });

  /* 可选：把素材前缀改成绝对地址（素材放国内仓库，HTML 放任意托管商）。
     只改这一行常量，立绘/图鉴/音效全部走同一个前缀。 */
  let webHtml = html;
  if (assetBaseArg) {
    const base = assetBaseArg.endsWith('/') ? assetBaseArg : assetBaseArg + '/';
    const def = "var ASSET_BASE = 'assets/';";
    if (!webHtml.includes(def)) throw new Error('源码里找不到 ASSET_BASE 定义，无法改写素材前缀');
    webHtml = webHtml.replace(def, () => `var ASSET_BASE = ${JSON.stringify(base)};`);
    console.log(`asset-base: ${base}`);
  }

  fs.writeFileSync(path.join(webDir, 'index.html'), webHtml, 'utf8');
  /* 绝对地址模式下素材不随包发布 */
  if (!assetBaseArg) fs.cpSync(assetsDir, path.join(webDir, 'assets'), { recursive: true });

  const listDir = (d) => fs.readdirSync(d).map((f) => ({ f, size: fs.statSync(path.join(d, f)).size }));
  const htmlBytes = Buffer.byteLength(webHtml, 'utf8');
  const assets = assetBaseArg ? [] : listDir(path.join(webDir, 'assets'));
  const assetBytes = assets.reduce((s, a) => s + a.size, 0);

  console.log(`web: ${path.join(webDir, 'index.html')}`);
  console.log(`  index.html : ${(htmlBytes / 1024).toFixed(0)} KB（未内联素材，gzip 后通常 < 60 KB）`);
  if (assetBaseArg) {
    console.log('  assets/    : 不随包输出（已指向 ' + assetBaseArg + '）');
  } else {
    console.log(`  assets/    : ${assets.length} 个文件，${(assetBytes / 1024).toFixed(0)} KB`);
    for (const a of assets) console.log(`     ${a.f.padEnd(20)} ${(a.size / 1024).toFixed(0)} KB`);
    console.log(`  合计       : ${((htmlBytes + assetBytes) / 1024 / 1024).toFixed(2)} MB（首次访问；之后素材走缓存）`);
  }
  process.exit(0);
}

/* ---------- 3. 组装素材表 ---------- */
/* 背景现在是程序化生成的动态场景（见 04-images.js），不再需要背景图；
   若 assets/ 里仍放了图，也只是内联进去备用，不会自动启用。 */
const bg = pick('bg-thunder', PHOTO_EXTS);
const chart = pick('chart', PHOTO_EXTS);
if (!chart) throw new Error('缺少图鉴素材 assets/chart.(webp|jpg)');

const data = { chart: b64(chart), sprites };
if (bg) data.bg = b64(bg);

/* 结算音效：纯音频 mp3（浏览器兼容性最好），退回到 mp4 容器 */
const AUDIO_EXTS = ['.mp3', '.m4a', '.mp4'];
const winAudio = pick('laugh', AUDIO_EXTS) || pick('bgm', AUDIO_EXTS);
const loseAudio = pick('lose', AUDIO_EXTS);
if (winAudio) data.audioWin = b64(winAudio);
else console.warn('[warn] 没有胜利音效素材（assets/laugh.mp3）');
if (loseAudio) data.audioLose = b64(loseAudio);
else console.warn('[warn] 没有失败音效素材（assets/lose.mp3）');

if (!html.includes(TOKEN)) throw new Error('源码里找不到素材占位符 ' + TOKEN);
/* 用函数式替换：避免素材数据中出现 $& / $' 时被当成替换模式 */
html = html.replace(TOKEN, () => JSON.stringify(data));

/* ---------- 4. 构建后校验 ---------- */
const problems = [];

if (html.includes(TOKEN)) problems.push('产物里仍残留素材占位符');

/* CHARS 表里每个角色都必须有对应立绘，否则会静默回退到 assets/ 外部路径，单文件就废了。
   立绘文件名用 CHARS 里的 ASCII 短名（img 字段），不是中文角色名。 */
const charsBlock = /var CHARS\s*=\s*\[[\s\S]*?\n\];/.exec(html);
if (charsBlock) {
  const imgs = [...charsBlock[0].matchAll(/\bimg\s*:\s*'([^']+)'/g)].map((m) => m[1]);
  if (!imgs.length) problems.push('CHARS 里没有 img 字段，无法校验立绘');
  const missing = imgs.filter((n) => !sprites[n]);
  if (missing.length) problems.push('这些角色没有立绘: ' + missing.join(', '));
  const unused = Object.keys(sprites).filter((n) => !imgs.includes(n));
  if (unused.length) console.warn('[warn] 有素材未被 CHARS 使用: ' + unused.join(', '));
} else {
  problems.push('产物里找不到 CHARS 数据表，无法校验立绘完整性');
}

/* 外部相对路径只应作为「直接打开组装源码调试」时的回退，正常产物里不会走到。
   这里仅在 --verbose 时提示，避免每次构建都刷屏。 */
if (flags.has('--verbose')) {
  const externalRefs = (html.match(/assets\/[A-Za-z0-9_\u4e00-\u9fa5-]+\.(?:png|webp|jpg|jpeg|mp4)/g) || []);
  if (externalRefs.length) console.log(`[verbose] 产物含 ${externalRefs.length} 处 assets/ 回退路径（仅调试用，正常）`);
}

if (problems.length) {
  console.error('\n构建校验失败:');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}

/* ---------- 5. 输出 ---------- */
const bytes = Buffer.from(html, 'utf8');

/* 可选：导出一份「未内联素材」的组装源码。
   放在项目根目录，这样它里面的 assets/ 回退路径能正常解析，可直接双击调试。 */
if (emitSource) {
  const srcOut = path.join(root, '_source.html');
  const unbuilt = srcArg ? fs.readFileSync(srcArg, 'utf8') : assembleFromParts();
  fs.writeFileSync(srcOut, unbuilt, 'utf8');
  console.log('source: ' + srcOut + '  (未内联素材，可直接在主目录打开调试)');
}

function report(label) {
  console.log(`${label}: ${outFile}`);
  console.log(`size  : ${(bytes.length / 1024 / 1024).toFixed(2)} MB`);
  console.log(`sprites: ${Object.keys(sprites).length}  bg: ${bg ? path.basename(bg.file) : '(程序化动态背景)'}  chart: ${path.basename(chart.file)}`);
  console.log(`audio  : win=${winAudio ? path.basename(winAudio.file) : '无'}  lose=${loseAudio ? path.basename(loseAudio.file) : '无'}`);
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
