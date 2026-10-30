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
function assetURL(name, ext){
  if(ASSET_DATA) return ASSET_DATA.sprites[name] || '';
  return 'assets/' + name + '.' + ext;
}

