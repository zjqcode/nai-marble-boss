/* =========================================================
   1. 角色 / 技能 / 章节数据
   =========================================================
   img 是立绘文件名（ASCII 短名）。素材要能作为 URL 加载，
   用中文文件名会变成 %E5%A5%B6%E7%8B%97.webp 这种编码，
   既难读、也容易被 CDN/网关处理错，所以文件与 URL 一律用 img 里的短名。
   ========================================================= */
var CHARS = [
  {n:'奶蛋',  img:'egg',     d:'圆滚滚的起点，安静的蛋',       key:'startLv',     sname:'初始弹珠',   base:1,   per:1,   unit:'级', max:3},
  {n:'奶豆',  img:'bean',    d:'体型很小，最近热度飙升',       key:'milk',        sname:'奶瓶收益',   base:.08, per:0,   unit:'%'},
  {n:'小奶蛙',img:'frog-s',  d:'可爱到被做成表情包',           key:'power',       sname:'弹射力度',   base:.04, per:0,   unit:'%'},
  {n:'奶鼠',  img:'mouse',   d:'贪吃，和奶粉是欢喜冤家',       key:'reload',      sname:'装填速度',   base:.08, per:0,   unit:'%'},
  {n:'奶鸡',  img:'hen',     d:'可以生出奶蛋的合体主力',       key:'extraBalls',  sname:'开局赠球',   base:1,   per:1,   unit:'颗', max:3},
  {n:'奶猫',  img:'cat',     d:'比较冷门，但真的很可爱',       key:'crit',        sname:'暴击率',     base:.03, per:0,   unit:'%'},
  {n:'奶鱼',  img:'fish',    d:'滑溜溜，抓不住的奶鱼',         key:'ballSpeed',   sname:'弹珠速度',   base:.03, per:0,   unit:'%'},
  {n:'奶粉',  img:'powder',  d:'粉粉的大家伙，体型惊人',       key:'bossDmg',     sname:'对 BOSS 伤害', base:.06, per:0, unit:'%'},
  {n:'奶狗',  img:'dog',     d:'爱找奶屎，一直在笑',           key:'attackDelay', sname:'反击间隔',   base:.08, per:0,   unit:'%'},
  {n:'奶兔',  img:'rabbit',  d:'竖着耳朵，蹦得最高',           key:'power',       sname:'弹射力度',   base:.06, per:0,   unit:'%'},
  {n:'豆奶',  img:'soymilk', d:'奶与豆的混血品种',             key:'milk',        sname:'奶瓶收益',   base:.12, per:0,   unit:'%'},
  {n:'奶屎',  img:'poop',    d:'喜欢的人会非常喜欢',           key:'attackDelay', sname:'反击间隔',   base:.06, per:0,   unit:'%'},
  {n:'奶蛙',  img:'frog',    d:'奶家开创者，雷霆降世',         key:'dmgAll',      sname:'全伤害',     base:.06, per:0,   unit:'%'}
];

/* 按角色名取立绘短名（找不到时退回原名，保证不会静默变成空串） */
var CHAR_IMG = {};
for(var ci=0; ci<CHARS.length; ci++) CHAR_IMG[CHARS[ci].n] = CHARS[ci].img || CHARS[ci].n;
function charImg(name){ return CHAR_IMG[name] || name; }

var DEFAULT_UNLOCKED = ['奶蛋','奶豆','小奶蛙','奶鼠','奶鱼'];

/* 难度字段说明：
   breakPct  破防需求 = maxHp * breakPct（越后越难破防）
   dodgeW    危险区半宽占场宽比例（越后越窄，越难躲）
   tele      蓄力时间（秒，越后越短，反应窗口越小）
   dodgeRate Boss 预判闪避成功率
   combo     单次反击的攻击段数
   enragePct 狂暴触发血量阈值                                  */
var CHAPTERS = [
  {id:1, chap:'第一章', title:'暴食奶狗', char:'奶狗', hp:900, time:90, every:7.6, atk:'laugh', atkName:'笑声攻击', rocks:2,
   springs:false, portal:false, move:false, dodge:0.22, range:0.06,
   breakPct:0.07, dodgeW:0.16, tele:1.45, dodgeRate:0.55, combo:1, enragePct:0.50,
   desc:'黑化的奶狗，肚子像个无底洞，笑声能震碎奶瓶。',
   intro:'新手关：把球弹起来合体，反弹越多伤害越高。'},
  {id:2, chap:'第二章', title:'弹簧奶兔', char:'奶兔', hp:1300, time:85, every:6.6, atk:'hop', atkName:'弹簧跳砸', rocks:3,
   springs:true, portal:false, move:true, dodge:0.35, range:0.10,
   breakPct:0.08, dodgeW:0.17, tele:1.42, dodgeRate:0.62, combo:1, enragePct:0.50,
   desc:'长耳弹簧腿，喜欢跳起来砸场子，落地会震出石球。',
   intro:'利用两侧弹簧板加速反弹，它会开始闪避高级球。'},
  {id:3, chap:'第三章', title:'吸球豆奶', char:'豆奶', hp:2600, time:80, every:7.4, atk:'suck', atkName:'吸星漩涡',
   springs:false, portal:true, move:false, dodge:0.5, range:0.12,
   breakPct:0.09, dodgeW:0.22, tele:0.92, dodgeRate:0.68, combo:2, enragePct:0.52,
   desc:'胸口的漩涡会吸走奶球，混血的双色身体。',
   intro:'传送门可以绕过正面，但小心 BOSS 的吸球。'},
  {id:4, chap:'第四章', title:'毒雾奶屎', char:'奶屎', hp:2500, time:75, every:5.8, atk:'fart', atkName:'臭屁攻击',
   springs:true, portal:true, move:false, dodge:0.65, range:0.14,
   breakPct:0.10, dodgeW:0.27, tele:0.95, dodgeRate:0.73, combo:2, enragePct:0.54,
   desc:'冒着绿烟的塔状 BOSS，臭屁会熏掉勇者的生命。',
   intro:'臭屁预警时集中火力打断，否则勇者会被熏晕。'},
  {id:5, chap:'第五章', title:'暴食奶粉', char:'奶粉', hp:2500, time:70, every:6.0, atk:'hop', atkName:'泰山压顶', rocks:5,
   springs:true, portal:true, move:true, dodge:0.46, range:0.16,
   breakPct:0.11, dodgeW:0.17, tele:1.42, dodgeRate:0.78, combo:2, enragePct:0.56,
   desc:'粉粉的巨型奶粉，整座山一样压下来。',
   intro:'体型越大砸得越狠，注意它落地前的预警。'},
  {id:6, chap:'第六章', title:'幻影奶猫', char:'奶猫', hp:2700, time:65, every:5.45, atk:'thunder', atkName:'幻影光束',
   springs:true, portal:true, move:true, dodge:1.0, range:0.20,
   breakPct:0.12, dodgeW:0.28, tele:1.12, dodgeRate:0.82, combo:2, enragePct:0.58,
   desc:'会瞬移的奶猫，光束锁定时很难躲。',
   intro:'它会频繁闪避和游走，用反弹球封它的走位。'},
  {id:7, chap:'第七章', title:'尖叫奶鸡', char:'奶鸡', hp:2850, time:60, every:5.2, atk:'eggs', atkName:'蛋蛋轰炸', rocks:6,
   springs:true, portal:true, move:true, dodge:1.1, range:0.16,
   breakPct:0.125, dodgeW:0.21, tele:1.22, dodgeRate:0.85, combo:2, enragePct:0.60,
   desc:'会下炸弹蛋的奶鸡，满场都是爆炸。',
   intro:'蛋蛋会铺满场地，优先打断它的轰炸。'},
  {id:8, chap:'第八章', title:'终焉奶蛙', char:'奶蛙', hp:2500, time:64, every:5.0, atk:'thunder', atkName:'雷霆万钧',
   springs:true, portal:true, move:true, dodge:1.3, range:0.22,
   breakPct:0.13, dodgeW:0.17, tele:1.40, dodgeRate:0.88, combo:2, enragePct:0.62,
   desc:'雷霆缠身的最终 BOSS，会闪避、游走、降下雷柱。',
   intro:'最终决战：它会在雷光中闪避你的每一发高级球。'}
];

var MAXLV = CHARS.length - 1;
var DMG = [4,7,12,20,32,50,75,110,155,215,300,410,560];
var DMG_MUL = [0.9,1.0,1.05,1.1,1.15,1.2,1.1,1.3,1.25,1.35,1.4,1.5,1.6];
CHARS.forEach(function(c,i){ c.dmg = DMG_MUL[i]; });
var UP_COST = [100, 100, 100, 100];   /* 升一级 100 奶瓶 */

