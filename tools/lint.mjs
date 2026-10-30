/* 源码自检：把 src/parts 组装起来后做语法/结构检查。
 *
 *   node tools/lint.mjs
 *
 * 拆分源码最大的风险是「某个片段里少个大括号，拼起来才炸」，而产物是单文件、
 * 报错定位很难。这里在构建前先把关。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const partsDir = path.join(root, 'src', 'parts');
const manifest = JSON.parse(fs.readFileSync(path.join(partsDir, 'manifest.json'), 'utf8'));

let failed = 0;
const ok = (msg) => console.log('  \x1b[32mOK\x1b[0m   ' + msg);
const bad = (msg) => { failed++; console.log('  \x1b[31mFAIL\x1b[0m ' + msg); };

/* 1. JS 片段逐个 + 合并后做语法检查 */
console.log('\n[JS] 片段语法');
const jsTexts = manifest.js.map((f) => fs.readFileSync(path.join(partsDir, f), 'utf8'));
const tmp = path.join(os.tmpdir(), 'nai-lint-' + process.pid + '.js');
try {
  fs.writeFileSync(tmp, jsTexts.join(''));
  execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
  ok(`${manifest.js.length} 个片段合并后语法通过（${jsTexts.join('').length} 字符）`);
} catch (e) {
  bad('合并后语法错误:\n' + (e.stderr ? e.stderr.toString() : e.message));
} finally {
  try { fs.unlinkSync(tmp); } catch {}
}

/* 2. 骨架占位符齐全（素材占位符在 JS 片段里，不在骨架里） */
console.log('\n[HTML] 骨架');
const skeleton = fs.readFileSync(path.join(partsDir, manifest.skeleton), 'utf8');
const jsAll = jsTexts.join('');
for (const mark of ['/*__STYLE__*/', '/*__JS__*/']) {
  if (skeleton.includes(mark)) ok(`骨架占位符存在 ${mark}`);
  else bad(`骨架缺少占位符 ${mark}`);
}
if (jsAll.includes('/*__ASSETS__*/null')) ok('素材占位符 /*__ASSETS__*/null 存在（在 JS 片段中）');
else bad('缺少素材占位符 /*__ASSETS__*/null');
const pairs = [['<style>', '</style>'], ['<script>', '</script>'], ['<body>', '</body>'], ['<html', '</html>']];
for (const [open, close] of pairs) {
  const a = (skeleton.split(open).length - 1), b = (skeleton.split(close).length - 1);
  if (a === b) ok(`标签配对 ${open} … ${close} (${a})`);
  else bad(`标签不配对 ${open}=${a} ${close}=${b}`);
}

/* 3. CSS 大括号平衡 + 常见拼写问题 */
console.log('\n[CSS] 括号平衡');
const css = fs.readFileSync(path.join(partsDir, manifest.style), 'utf8');
let depth = 0, minDepth = 0;
for (const ch of css) {
  if (ch === '{') depth++;
  else if (ch === '}') { depth--; if (depth < minDepth) minDepth = depth; }
}
if (depth === 0 && minDepth === 0) ok(`大括号平衡（${css.length} 字符）`);
else bad(`大括号不平衡：结尾深度 ${depth}，最小深度 ${minDepth}`);

/* 4. 选择器引用的元素 id 是否真的在骨架里（先排除 #rrggbb 这类色值） */
console.log('\n[CSS] id 选择器是否存在于 DOM');
const HEX = /^[0-9a-fA-F]{3,8}$/;
const idSelectors = [...new Set([...css.matchAll(/#([a-zA-Z][\w-]*)/g)].map((m) => m[1]))]
  .filter((id) => !HEX.test(id));
const missing = idSelectors.filter((id) => !skeleton.includes(`id="${id}"`));
if (!missing.length) ok(`${idSelectors.length} 个 id 选择器全部能对上`);
else bad('CSS 里有、DOM 里没有的 id: ' + missing.join(', '));

/* 5. 脚本里引用的 $id('x') 是否存在 */
console.log('\n[JS] $id() 引用的元素是否存在');
const js = jsTexts.join('');
const refs = [...new Set([...js.matchAll(/\$id\('([^']+)'\)/g)].map((m) => m[1]))];
const missingIds = refs.filter((id) => !skeleton.includes(`id="${id}"`));
if (!missingIds.length) ok(`${refs.length} 个 $id 引用全部存在`);
else bad('$id 引用了不存在的元素: ' + missingIds.join(', '));

/* 6. manifest 不重复、文件都存在 */
console.log('\n[MANIFEST] 完整性');
const dupes = manifest.js.filter((f, i) => manifest.js.indexOf(f) !== i);
if (dupes.length) bad('manifest 有重复项: ' + [...new Set(dupes)].join(', '));
else ok('manifest 无重复项');
const notFound = manifest.js.filter((f) => !fs.existsSync(path.join(partsDir, f)));
if (notFound.length) bad('manifest 指向的文件不存在: ' + notFound.join(', '));
else ok('manifest 指向的文件都存在');

console.log('\n' + '='.repeat(56));
if (failed) { console.log(`${failed} 项失败`); process.exit(1); }
console.log('源码自检全部通过 ✅');
