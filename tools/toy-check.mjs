#!/usr/bin/env node
/**
 * B站 Toy 上传包一键体检
 * 用法：node tools/toy-check.mjs [目录]
 * 规则来源：Toy 发布页字段要求 + 静态 HTML 上传限制
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import os from 'node:os';

const dir = process.argv[2] || path.resolve('dist', 'toy');
const LIMIT_MB = 50;

const pass = [];
const fail = [];
const warn = [];
const ok = (m) => pass.push(m);
const no = (m) => fail.push(m);
const hm = (m) => warn.push(m);

/* ---------- 图片尺寸解析（不依赖库） ---------- */
function imgSize(file) {
  const b = fs.readFileSync(file);
  if (b[0] === 0x89 && b[1] === 0x50) {                       // PNG
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), type: 'png' };
  }
  if (b[0] === 0xff && b[1] === 0xd8) {                       // JPEG
    let i = 2;
    while (i < b.length - 1) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      const len = b.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5), type: 'jpg' };
      }
      i += 2 + len;
    }
  }
  return null;
}

/* ---------- 1. 目录与文件 ---------- */
if (!fs.existsSync(dir)) { console.log('目录不存在:', dir); process.exit(2); }
const files = fs.readdirSync(dir).filter((f) => !fs.statSync(path.join(dir, f)).isDirectory());
const totalMB = files.reduce((s, f) => s + fs.statSync(path.join(dir, f)).size, 0) / 1048576;
console.log(`目录：${dir}\n文件数：${files.length}　总大小：${totalMB.toFixed(2)} MB\n`);

totalMB < LIMIT_MB ? ok(`总体积 ${totalMB.toFixed(2)} MB < ${LIMIT_MB} MB`) : no(`总体积 ${totalMB.toFixed(2)} MB 超过 ${LIMIT_MB} MB`);

/* ---------- 2. 找包、封面、图标 ---------- */
const zips = files.filter((f) => f.toLowerCase().endsWith('.zip'));
if (!zips.length) no('没有找到上传用的 zip');
const imgs = files.filter((f) => /\.(png|jpe?g)$/i.test(f));

let cover = null, icon = null;
for (const f of imgs) {
  const s = imgSize(path.join(dir, f));
  if (!s) continue;
  const ratio = s.w / s.h;
  if (Math.abs(ratio - 4 / 3) < 0.02 && (!cover || s.w > imgSize(path.join(dir, cover)).w)) cover = f;
  if (Math.abs(ratio - 1) < 0.02 && (!icon || s.w > imgSize(path.join(dir, icon)).w)) icon = f;
}
if (cover) {
  const s = imgSize(path.join(dir, cover));
  ok(`封面 ${cover}  ${s.w}×${s.h}（4:3）`);
  if (s.w < 1200) hm(`封面建议 ≥1200px 宽，当前 ${s.w}px`);
} else no('没有 4:3 比例的封面图（平台要求 1200×900）');

if (icon) {
  const s = imgSize(path.join(dir, icon));
  ok(`图标 ${icon}  ${s.w}×${s.h}（1:1）`);
  if (s.w < 500) hm(`图标建议 ≥500px，当前 ${s.w}px`);
} else no('没有 1:1 比例的图标（平台要求 500×500）');

/* ---------- 3. zip 内容 ---------- */
for (const z of zips) {
  const zp = path.join(dir, z);
  const mb = fs.statSync(zp).size / 1048576;
  if (mb >= LIMIT_MB) no(`${z} 体积 ${mb.toFixed(2)} MB 超限`);
  let list = [];
  try {
    list = execSync(`tar -tf "${zp}"`, { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
  } catch (e) {
    hm(`${z} 无法读取内容（无 tar？）`);
  }
  const rootIndex = list.some((n) => n.replace(/^\.\//, '') === 'index.html');
  rootIndex ? ok(`${z} 入口在根目录 index.html`) : no(`${z} 根目录没有 index.html`);
  const imgsInZip = list.filter((n) => /\.(png|jpe?g)$/i.test(n));
  if (imgsInZip.length) hm(`${z} 里含 ${imgsInZip.length} 张图片（平台是分开上传的，确认不是误放）`);
  console.log(`  ${z}: ${list.length} 个文件, ${mb.toFixed(2)} MB`);
}

/* ---------- 4. HTML 静态检查 ---------- */
const htmlFiles = [];
for (const z of zips) {
  try {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'toychk-'));
    execSync(`tar -xf "${path.join(dir, z)}" -C "${tmp}"`);
    const idx = path.join(tmp, 'index.html');
    if (fs.existsSync(idx)) htmlFiles.push({ name: z, html: fs.readFileSync(idx, 'utf8') });
  } catch {}
}
if (fs.existsSync(path.join(dir, 'index.html'))) {
  htmlFiles.push({ name: 'index.html', html: fs.readFileSync(path.join(dir, 'index.html'), 'utf8') });
}

for (const { name, html } of htmlFiles) {
  const urls = [...new Set((html.match(/https?:\/\/[a-zA-Z0-9./_?=&%:-]+/g) || []))]
    .filter((u) => !/^https?:\/\/(www\.)?w3\.org/.test(u));
  urls.length === 0
    ? ok(`${name}：零外部请求`)
    : no(`${name}：仍有 ${urls.length} 个外部地址 → ${urls.slice(0, 5).join(', ')}`);

  /<meta[^>]+name=["']viewport["']/i.test(html) ? ok(`${name}：有 viewport 移动端适配`) : no(`${name}：缺 viewport meta`);
  /<title>[^<]+<\/title>/i.test(html) ? ok(`${name}：有标题`) : hm(`${name}：缺 <title>`);
  /(src|href)=["']\//.test(html) ? no(`${name}：存在绝对路径引用（/ 开头），子目录部署会 404`) : ok(`${name}：无绝对路径引用`);
  /document\.write\(/i.test(html) ? hm(`${name}：用了 document.write，可能影响加载`) : null;
  /top\.location|parent\.location|window\.top\s*=/.test(html) ? no(`${name}：有跳转父窗口的代码，内嵌会被拦`) : ok(`${name}：无顶层跳转`);
  /(navigator\.clipboard|localStorage\.setItem)/.test(html) ? hm(`${name}：涉及存储/剪贴板，内嵌环境可能受限（代码里应已 try/catch）`) : null;
}

/* ---------- 5. 报告 ---------- */
console.log('\n通过：');
pass.forEach((m) => console.log('  ✅ ' + m));
if (warn.length) { console.log('\n提醒：'); warn.forEach((m) => console.log('  ⚠️  ' + m)); }
if (fail.length) { console.log('\n不通过：'); fail.forEach((m) => console.log('  ❌ ' + m)); }
console.log(`\n结果：${pass.length} 通过 / ${warn.length} 提醒 / ${fail.length} 失败`);
process.exit(fail.length ? 1 : 0);
