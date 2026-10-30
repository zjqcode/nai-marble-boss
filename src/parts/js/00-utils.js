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
/* 立绘地址：单文件版返回内联 data URI；外置资源版（部署网站）返回相对路径。
   扩展名必须统一在这里决定——之前调用方各自传 'png'，而素材是 .webp，
   单文件版看不出问题（data URI 不看扩展名），外置资源版就整片 404。

   ASSET_BASE 是素材目录前缀，构建时可用 --asset-base 改写成 CDN / 仓库的绝对地址，
   这样 HTML 可以放在任意托管商，素材继续从国内仓库加载。 */
var SPRITE_EXT = 'webp';
var ASSET_BASE = 'assets/';
function assetURL(name){
  if(ASSET_DATA) return ASSET_DATA.sprites[name] || '';
  return ASSET_BASE + name + '.' + SPRITE_EXT;
}

