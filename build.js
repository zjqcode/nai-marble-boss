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
 *   node build.js --web --audio-base <url>     音频前缀单独指定（Gitee raw 无法给 <audio> 提供流式响应）
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

/* --split：把 样式/脚本/素材 全部拆成独立文件（B站 Toy 要求 index.html ≤ 1MB） */
const splitMode = flags.has('--split');
const splitDirArg = (() => {
  const i = argv.indexOf('--split');
  if (i < 0) return null;
  const next = argv[i + 1];
  return next && !next.startsWith('--') ? next : null;
})();
/* --web 的可选输出目录：node build.js --web public */
const webMode = flags.has('--web');
const webDirArg = (() => {
  const i = argv.indexOf('--web');
  if (i < 0) return null;
  const next = argv[i + 1];
  return next && !next.startsWith('--') ? next : null;
})();
/* positional：排除 --flag，以及这几个 flag 后面那个「取值」 */
const VALUED_FLAGS = new Set(['--web', '--split', '--asset-base', '--audio-base']);
const positional = argv.filter((a, i) => {
  if (a.startsWith('--')) return false;
  if (i > 0 && VALUED_FLAGS.has(argv[i - 1])) return false;
  return true;
});
const flagValue = (name) => {
  const i = argv.indexOf(name);
  if (i < 0) return null;
  const next = argv[i + 1];
  return next && !next.startsWith('--') ? next : null;
};
/* --asset-base：图片（立绘/图鉴）前缀；--audio-base：音频前缀 */
const assetBaseArg = flagValue('--asset-base');
const audioBaseArg = flagValue('--audio-base');

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

/* 素材指纹：把所有图片按文件名+内容算一个短哈希。
   任意一张立绘改了，哈希就变，URL 跟着变，CDN 缓存自然被击穿。 */
const assetsVer = (() => {
  const crypto = require('crypto');
  const h = crypto.createHash('sha1');
  const files = fs.readdirSync(assetsDir).filter((n) => /\.(png|webp)$/i.test(n)).sort();
  for (const f of files) {
    h.update(f);
    h.update(fs.readFileSync(path.join(assetsDir, f)));
  }
  return files.length ? h.digest('hex').slice(0, 10) : '';
})();

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

/* ---------- 3s. 拆分版（样式/脚本/素材各自独立） ----------
   B站 Toy 限制：index.html 解压后 ≤ 1MB，超过会报
   「请将内联的脚本、样式或图片拆成独立文件后重新打包」。 */
if (splitMode) {
  const outDir = path.resolve(root, splitDirArg || 'dist/split');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const manifest = JSON.parse(fs.readFileSync(partsManifest, 'utf8'));
  const skeleton = fs.readFileSync(path.join(partsDir, manifest.skeleton), 'utf8');
  const style = fs.readFileSync(path.join(partsDir, manifest.style), 'utf8');
  const js = manifest.js.map((f) => fs.readFileSync(path.join(partsDir, f), 'utf8')).join('');

  let outHtml = skeleton
    .replace('<style>' + STYLE_MARK + '</style>', '<link rel="stylesheet" href="styles.css">')
    .replace('<script>' + JS_MARK + '</script>', '<script src="game.js"></script>');
  /* 纯静态托管：去掉外部资源提示（preconnect / dns-prefetch） */
  outHtml = outHtml.replace(/\s*<link rel="preconnect"[^>]*>\r?\n?/g, '\n')
                   .replace(/\s*<link rel="dns-prefetch"[^>]*>\r?\n?/g, '\n');
  if (outHtml.includes(STYLE_MARK) || outHtml.includes(JS_MARK)) {
    throw new Error('拆分失败：骨架里的占位符没被替换');
  }

  fs.writeFileSync(path.join(outDir, 'index.html'), outHtml, 'utf8');
  fs.writeFileSync(path.join(outDir, 'styles.css'), style, 'utf8');
  fs.writeFileSync(path.join(outDir, 'game.js'), js, 'utf8');

  const assetsOut = path.join(outDir, 'assets');
  fs.mkdirSync(assetsOut, { recursive: true });
  let n = 0, bytes = 0;
  for (const f of fs.readdirSync(assetsDir)) {
    if (!/\.(webp|png|jpg|jpeg|mp3|m4a|mp4)$/i.test(f)) continue;
    fs.copyFileSync(path.join(assetsDir, f), path.join(assetsOut, f));
    n++; bytes += fs.statSync(path.join(assetsDir, f)).size;
  }

  const kb = (f) => (fs.statSync(path.join(outDir, f)).size / 1024).toFixed(1) + ' KB';
  console.log('split: ' + outDir);
  console.log('  index.html : ' + kb('index.html') + '（平台上限 1MB）');
  console.log('  styles.css : ' + kb('styles.css'));
  console.log('  game.js    : ' + kb('game.js'));
  console.log('  assets/    : ' + n + ' 个文件，' + (bytes / 1024).toFixed(0) + ' KB');
  const total = ['index.html', 'styles.css', 'game.js']
    .reduce((acc, f) => acc + fs.statSync(path.join(outDir, f)).size, 0) + bytes;
  console.log('  合计       : ' + (total / 1024).toFixed(0) + ' KB（平台上限 50MB）');
  process.exit(0);
}

/* ---------- 3a. 网页部署版（外置资源，便于 CDN / 浏览器缓存 / 国内加速） ----------
   与单文件版的区别：不把素材内联成 data URI，而是输出 index.html + assets/ 目录，
   HTML 里保留 assets/xxx 的相对路径。浏览器可以分别缓存，首屏 HTML 只有 ~200KB。 */
if (webMode) {
  const webDir = path.resolve(root, webDirArg || 'dist/web');
  fs.rmSync(webDir, { recursive: true, force: true });
  fs.mkdirSync(webDir, { recursive: true });

  /* 可选：把图片/音频前缀改成绝对地址。
     图片与音频分开可配——Gitee raw 给 <audio> 的响应没有 Content-Length / Accept-Ranges，
     浏览器无法流式解码，所以常见组合是「图片走仓库、音频留在同源」。 */
  let webHtml = html;
  const rewrite = (constant, value) => {
    const def = `var ${constant} = 'assets/';`;
    if (!webHtml.includes(def)) throw new Error(`源码里找不到 ${constant} 定义，无法改写`);
    const base = value.endsWith('/') ? value : value + '/';
    webHtml = webHtml.replace(def, () => `var ${constant} = ${JSON.stringify(base)};`);
    console.log(`${constant} = ${base}`);
  };
  if (assetBaseArg) rewrite('ASSET_BASE', assetBaseArg);
if (assetBaseArg) {
  /* __preloadInjected：HTML 一解析就并行下载立绘，不用等内联脚本跑到 loadImages() */
  const names = fs.readdirSync(assetsDir)
    .filter((n) => /\.webp$/i.test(n) && n !== 'chart.webp')
    .sort();
  const links = names
    .map((n) => '<link rel="preload" as="image" href="' + assetBaseArg + n + (assetsVer ? '?v=' + assetsVer : '') + '">')
    .join('');
  if (webHtml.includes('</head>')) {
    webHtml = webHtml.replace('</head>', links + '</head>');
    console.log('preload: 已注入 ' + names.length + ' 张立绘');
  }
}
  if (audioBaseArg) rewrite('AUDIO_BASE', audioBaseArg);

  /* 素材指纹：按内容算一个短哈希拼到图片 URL 后面。
     Netlify 上 assets/* 缓存 1 天，不加这个改了立绘要等缓存过期才生效。 */
  if (assetsVer) {
    const def = `var ASSET_VER = /*__ASSET_VER__*/'';`;
    if (!webHtml.includes(def)) throw new Error('源码里找不到 ASSET_VER 占位，无法注入');
    webHtml = webHtml.replace(def, () => `var ASSET_VER = ${JSON.stringify(assetsVer)};`);
    console.log(`ASSET_VER = ${assetsVer}`);
  }

  fs.writeFileSync(path.join(webDir, 'index.html'), webHtml, 'utf8');

  /* 外置的素材就不随包发布了，只拷贝真正需要同源提供的文件 */
  const needLocalImages = !assetBaseArg;
  const needLocalAudio = !audioBaseArg;
  const assetsOut = path.join(webDir, 'assets');
  const copied = [];
  if (needLocalImages || needLocalAudio) {
    fs.mkdirSync(assetsOut, { recursive: true });
    for (const f of fs.readdirSync(assetsDir)) {
      const isAudio = /\.(mp3|m4a|mp4)$/i.test(f);
      if (isAudio ? !needLocalAudio : !needLocalImages) continue;
      fs.copyFileSync(path.join(assetsDir, f), path.join(assetsOut, f));
      copied.push({ f, size: fs.statSync(path.join(assetsDir, f)).size });
    }
  }

  const htmlBytes = Buffer.byteLength(webHtml, 'utf8');
  const assetBytes = copied.reduce((s, a) => s + a.size, 0);

  console.log(`web: ${path.join(webDir, 'index.html')}`);
  console.log(`  index.html : ${(htmlBytes / 1024).toFixed(0)} KB（未内联素材，gzip 后通常 < 60 KB）`);
  if (copied.length) {
    console.log(`  assets/    : 同源提供 ${copied.length} 个文件，${(assetBytes / 1024).toFixed(0)} KB`);
    for (const a of copied) console.log(`     ${a.f.padEnd(20)} ${(a.size / 1024).toFixed(0)} KB`);
  } else {
    console.log('  assets/    : 全部外置，不随包输出');
  }
  console.log(`  需你托管   : ${((htmlBytes + assetBytes) / 1024).toFixed(0)} KB` +
    (assetBaseArg ? `；图片走 ${assetBaseArg}` : '') +
    (audioBaseArg ? `；音频走 ${audioBaseArg}` : ''));
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
const hahaAudio = pick('haha', AUDIO_EXTS);   /* 第一章笑声攻击 */
if (winAudio) data.audioWin = b64(winAudio);
else console.warn('[warn] 没有胜利音效素材（assets/laugh.mp3）');
if (loseAudio) data.audioLose = b64(loseAudio);
if (hahaAudio) data.audioHaha = b64(hahaAudio);
else console.warn('[warn] 没有笑声素材（assets/haha.mp3）');
if (!loseAudio) console.warn('[warn] 没有失败音效素材（assets/lose.mp3）');

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
