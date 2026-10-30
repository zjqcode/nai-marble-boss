/* Build a single self-contained HTML game from a source template + assets. */
const fs = require('fs');
const path = require('path');

const root = __dirname;
const assetsDir = path.join(root, 'assets');
const srcArg = process.argv[2] || path.join(root, 'src', 'boss.html');
const outName = process.argv[3] || '奶系弹珠_弹射讨伐.html';
const outFile = path.join(root, outName);

const b64 = (file, mime) =>
  'data:' + mime + ';base64,' + fs.readFileSync(file).toString('base64');

const sprites = {};
for (const name of fs.readdirSync(assetsDir)) {
  if (!name.toLowerCase().endsWith('.png')) continue;
  sprites[name.slice(0, -4)] = b64(path.join(assetsDir, name), 'image/png');
}

const data = {
  bg: b64(path.join(assetsDir, 'bg-thunder.jpg'), 'image/jpeg'),
  chart: b64(path.join(assetsDir, 'chart.jpg'), 'image/jpeg'),
  sprites
};
if (fs.existsSync(path.join(assetsDir, 'bgm.mp4'))) {
  data.audio = b64(path.join(assetsDir, 'bgm.mp4'), 'video/mp4');
}

let html = fs.readFileSync(srcArg, 'utf8');
const token = '/*__ASSETS__*/null';
if (!html.includes(token)) throw new Error('asset placeholder missing');
html = html.replace(token, JSON.stringify(data));

fs.writeFileSync(outFile, html, 'utf8');
console.log('built:', outFile);
console.log('size :', (fs.statSync(outFile).size / 1024 / 1024).toFixed(2), 'MB');
console.log('sprites:', Object.keys(sprites).length);
