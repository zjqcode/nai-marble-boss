/* =========================================================
   0. 工具
   ========================================================= */
var TAU = Math.PI * 2;
var FONT = '"PingFang SC","HarmonyOS Sans SC","Microsoft YaHei",system-ui,sans-serif';
var ASSET_DATA = /*__ASSETS__*/null;

function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
function rand(a,b){ return a+Math.random()*(b-a); }
function lerp(a,b,t){ return a+(b-a)*t; }
function easeOutCubic(t){ return 1-Math.pow(1-t,3); }
function fmt(n){ return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,','); }
function $id(id){ return document.getElementById(id); }
function store(k,v){
  try{
    if(v===undefined) return localStorage.getItem(k);
    localStorage.setItem(k,v);
  }catch(e){ return null; }
}
/* 立绘地址：单文件版返回内联 data URI；外置资源版（部署网站）返回相对/绝对 URL。
   文件名一律用 CHARS 里的 ASCII 短名（img 字段），不用中文名——
   中文名会变成 %E5%A5%B6%E7%8B%97.webp 这类编码，难读且易被 CDN/网关处理错。

   ASSET_BASE 是素材目录前缀，构建时可用 --asset-base 改写成国内仓库/CDN 的绝对地址。 */
var SPRITE_EXT = 'webp';
var ASSET_BASE = 'assets/';
/* 音频基址单独可配：Gitee raw 的响应缺少 Content-Length / Accept-Ranges
   （它 302 到带签名的临时地址），浏览器 <audio> 无法流式解码，
   所以音频通常仍与 HTML 同源，图片则可以放心外置到仓库/CDN。 */
var AUDIO_BASE = 'assets/';
function assetURL(name){
  var slug = charImg(name);          /* 中文角色名 -> ASCII 文件名 */
  if(ASSET_DATA) return ASSET_DATA.sprites[slug] || '';
  return ASSET_BASE + slug + '.' + SPRITE_EXT;
}

