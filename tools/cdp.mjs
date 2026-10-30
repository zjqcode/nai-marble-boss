/* 极简 CDP 客户端：用本机 Edge 无头模式驱动页面，零 npm 依赖。
 *
 * 关键能力：把 requestAnimationFrame 换成手动队列 + 把 performance.now 虚拟化成
 * 逐帧推进的时钟 + 固定 Math.random 种子 —— 于是同一版代码每次运行得到完全相同的
 * 画面与状态，测试结果可复现，两个版本之间也能做像素级对比。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const EDGE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

/* 页面加载前注入：确定性环境 */
const INIT_SCRIPT = `
(() => {
  let seed = 0xC0FFEE;
  const origRandom = Math.random;
  Math.random = () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  window.__origRandom = origRandom;

  const FIXED_WALL = 1700000000000;
  Date.now = () => FIXED_WALL;

  window.__clock = 0;
  try { performance.now = () => window.__clock; } catch (e) {}

  window.__imgs = [];
  const Img0 = window.Image;
  window.Image = function (w, h) {
    const im = new Img0(w, h);
    window.__imgs.push(im);
    return im;
  };
  window.Image.prototype = Img0.prototype;

  window.__rafq = [];
  window.requestAnimationFrame = (cb) => { window.__rafq.push(cb); return window.__rafq.length; };
  window.cancelAnimationFrame = () => {};

  /* 推进 n 帧，每帧间隔 1000/60 ms，与游戏内固定步长一致 */
  window.__tick = (n, stepMs) => {
    const step = stepMs || (1000 / 60);
    for (let i = 0; i < (n | 0); i++) {
      window.__clock += step;
      const q = window.__rafq;
      window.__rafq = [];
      for (const cb of q) { try { cb(window.__clock); } catch (e) { window.__tickError = String(e && e.stack || e); throw e; } }
    }
    return window.__clock;
  };
})();
`;

async function waitForHttp(url, timeoutMs = 20000) {
  const t0 = Date.now();
  let lastErr;
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
    } catch (e) { lastErr = e; }
    await new Promise((r) => setTimeout(r, 120));
  }
  throw new Error('等待 DevTools 端口超时: ' + (lastErr && lastErr.message));
}

export class Session {
  constructor(ws, proc, tmpDir) {
    this.ws = ws;
    this.proc = proc;
    this.tmpDir = tmpDir;
    this._id = 0;
    this._pending = new Map();
    this._loadWaiters = [];
    this._nav = 0;
    this.consoleErrors = [];
    this.exceptions = [];
    this.logErrors = [];
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this._pending.has(msg.id)) {
        const { resolve, reject } = this._pending.get(msg.id);
        this._pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
        return;
      }
      if (msg.method === 'Page.loadEventFired') {
        const w = this._loadWaiters;
        this._loadWaiters = [];
        for (const fn of w) fn();
        return;
      }
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        this.consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description ?? a.type).join(' '));
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails;
        this.exceptions.push(d.exception?.description || d.text);
      }
      if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
        this.logErrors.push(msg.params.entry.text);
      }
    });
  }

  send(method, params = {}) {
    const id = ++this._id;
    return new Promise((resolve, reject) => {
      this._pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this._pending.has(id)) {
          this._pending.delete(id);
          reject(new Error('CDP 超时: ' + method));
        }
      }, 30000);
    });
  }

  async evaluate(expr) {
    const r = await this.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
      userGesture: true,
    });
    if (r.exceptionDetails) {
      throw new Error('页面内异常: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    }
    return r.result.value;
  }

  /* 加 cache-buster 并等待 loadEventFired，确保是真正的整页重载。
     否则「只在 query 上有区别」的跳转可能被当成同文档导航，测试会假通过。 */
  async goto(url) {
    this.consoleErrors.length = 0;
    this.exceptions.length = 0;
    this.logErrors.length = 0;
    const sep = url.includes('?') ? '&' : '?';
    const busted = url + sep + '_t=' + (++this._nav);
    const loaded = new Promise((resolve) => this._loadWaiters.push(resolve));
    await this.send('Page.navigate', { url: busted });
    await Promise.race([
      loaded,
      new Promise((_, rej) => setTimeout(() => rej(new Error('页面加载超时: ' + url)), 25000)),
    ]);
    await this.waitFor('document.readyState === "complete"');
  }

  async waitFor(expr, timeoutMs = 15000, label) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      if (await this.evaluate(expr)) return true;
      await new Promise((r) => setTimeout(r, 60));
    }
    throw new Error('等待条件超时: ' + (label || expr));
  }

  async screenshot(file) {
    const r = await this.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
    return file;
  }

  async close() {
    try { this.ws.close(); } catch {}
    try { this.proc.kill(); } catch {}
    await new Promise((r) => setTimeout(r, 250));
    try { fs.rmSync(this.tmpDir, { recursive: true, force: true }); } catch {}
  }
}

export async function launch({ width = 390, height = 844, dsf = 2, port } = {}) {
  const exe = EDGE_CANDIDATES.find((p) => fs.existsSync(p));
  if (!exe) throw new Error('找不到 Edge/Chrome 可执行文件');
  if (!port) port = 9300 + Math.floor(Math.random() * 500);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nai-cdp-'));

  const proc = spawn(exe, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-networking',
    '--mute-audio',
    '--hide-scrollbars',
    '--autoplay-policy=no-user-gesture-required',
    'about:blank',
  ], { stdio: 'ignore' });

  const version = await waitForHttp(`http://127.0.0.1:${port}/json/version`);
  const created = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(created.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', () => rej(new Error('WebSocket 连接失败')), { once: true });
  });

  const s = new Session(ws, proc, tmpDir);
  s.browser = version.Browser;
  await s.send('Page.enable');
  await s.send('Runtime.enable');
  await s.send('Log.enable');
  await s.send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: dsf, mobile: true,
  });
  await s.send('Page.addScriptToEvaluateOnNewDocument', { source: INIT_SCRIPT });
  return s;
}
