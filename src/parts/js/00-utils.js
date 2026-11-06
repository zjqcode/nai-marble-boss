/* =========================================================
   0. 工具
   ========================================================= */
var TAU = Math.PI * 2;
var FONT = '"PingFang SC","HarmonyOS Sans SC","Microsoft YaHei",system-ui,sans-serif';
var ASSET_DATA = /*__ASSETS__*/null;

/* 轻量触感：iPhone 不支持 vibrate，会静默跳过；
   只有用户真的在玩（过场结束、未暂停）才触发，避免加载阶段乱震。 */
function buzz(pattern){
  try{
    if(!navigator.vibrate) return;
    if(typeof state === 'undefined' || !state) return;
    if(state.paused || state.cineT > 0) return;
    navigator.vibrate(pattern);
  }catch(e){}
}

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
/* 素材指纹：由 build.js 按素材内容算出的短哈希，拼在 URL 后做缓存击穿。
   文件名不变但内容变了也能立刻拿到新图，不用等 Netlify 那 1 天的 assets 缓存。
   单文件版素材已内联，该值为空串，不影响。 */
var ASSET_VER = /*__ASSET_VER__*/'';
function assetURL(name){
  var slug = charImg(name);          /* 中文角色名 -> ASCII 文件名 */
  if(ASSET_DATA) return ASSET_DATA.sprites[slug] || '';
  var q = ASSET_VER ? '?v=' + ASSET_VER : '';
  return ASSET_BASE + slug + '.' + SPRITE_EXT + q;
}

