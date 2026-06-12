// SVG 矢量精灵:内联定义 → 栅格化成 Image → canvas 绘制。
// 预生成变体:white(闪白用)、dark(尸体用)。

const KNIGHT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 96">
<defs>
  <linearGradient id="armor" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#2c4d80"/><stop offset="0.45" stop-color="#4d7fc4"/>
    <stop offset="0.7" stop-color="#6fa3e8"/><stop offset="1" stop-color="#3a619e"/>
  </linearGradient>
  <linearGradient id="cape" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#27406b"/><stop offset="1" stop-color="#16243d"/>
  </linearGradient>
  <linearGradient id="helm" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#7eb0ef"/><stop offset="1" stop-color="#3a619e"/>
  </linearGradient>
</defs>
<!-- 披风 -->
<path d="M22 26 Q8 50 13 84 L26 80 Q20 52 27 30 Z" fill="url(#cape)"/>
<!-- 腿 -->
<rect x="24" y="70" width="8" height="20" rx="2.5" fill="#1f2940"/>
<rect x="35" y="70" width="8" height="20" rx="2.5" fill="#283452"/>
<!-- 靴 -->
<path d="M23 88 h10 v6 h-12 q-1 -4 2 -6 Z" fill="#141b2e"/>
<path d="M34 88 h10 v6 h-12 q-1 -4 2 -6 Z" fill="#1a2238"/>
<!-- 躯干铠甲 -->
<path d="M22 32 Q32 28 45 32 L46 62 Q33 68 21 62 Z" fill="url(#armor)"/>
<path d="M22 32 Q32 28 45 32 L45.6 40 Q32 35 21.6 40 Z" fill="#7eb0ef" opacity="0.8"/>
<!-- 腰带 -->
<rect x="21" y="58" width="25" height="6" rx="2" fill="#1c2742"/>
<circle cx="33" cy="61" r="2.2" fill="#caa84e"/>
<!-- 裙甲 -->
<path d="M22 63 L45 63 L43 72 Q33 76 24 72 Z" fill="#33507f"/>
<!-- 左臂(后) -->
<rect x="19" y="34" width="7" height="16" rx="3.5" fill="#2c4d80"/>
<!-- 肩甲 -->
<ellipse cx="24" cy="33" rx="7.5" ry="6" fill="url(#helm)"/>
<ellipse cx="43" cy="33" rx="7.5" ry="6" fill="url(#helm)"/>
<!-- 右臂(持剑手,举于肩侧) -->
<rect x="41" y="28" width="7" height="14" rx="3.5" fill="#3a619e" transform="rotate(18 44 30)"/>
<circle cx="48" cy="26" r="4" fill="#e8c9a0"/>
<!-- 头 -->
<rect x="25" y="12" width="16" height="13" rx="3" fill="#e8c9a0"/>
<!-- 头盔 -->
<path d="M23 18 Q23 6 33 6 Q43 6 43 18 L43 15 Q43 12 40 12 L26 12 Q23 12 23 15 Z" fill="url(#helm)"/>
<path d="M23 15 h20 v4 q-10 3 -20 0 Z" fill="#2c4d80"/>
<!-- 目缝 -->
<rect x="35" y="16" width="5" height="2.6" rx="1.3" fill="#10131f"/>
<!-- 盔缨 -->
<path d="M30 7 Q28 -2 36 -1 Q33 2 34 7 Z" fill="#ff5d5d"/>
</svg>`;

// GRUNT 杂兵: lanky purple ghoul/imp, facing LEFT
const GRUNT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 96">
<defs>
  <linearGradient id="gBody" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#4a2e6e"/><stop offset="0.5" stop-color="#6b4a8f"/>
    <stop offset="1" stop-color="#4a2e6e"/>
  </linearGradient>
  <linearGradient id="gLimb" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#3d2260"/><stop offset="1" stop-color="#5a3880"/>
  </linearGradient>
  <linearGradient id="gCloth" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#2a2238"/><stop offset="1" stop-color="#1a1528"/>
  </linearGradient>
</defs>
<!-- 尾巴(身后) -->
<path d="M38 72 Q48 80 46 90 Q42 86 38 88 Q36 80 38 72 Z" fill="#3d2260"/>
<!-- 右腿(后) -->
<rect x="36" y="68" width="7" height="22" rx="3" fill="#3d2260"/>
<!-- 爪足右 -->
<path d="M35 88 h10 l2 6 h-3 l-2 -3 l-2 3 l-2 -3 l-2 3 h-3 Z" fill="#2a1850"/>
<!-- 躯干(驼背,前倾) -->
<path d="M18 30 Q26 20 44 26 Q46 46 44 64 Q32 70 18 64 Q14 46 18 30 Z" fill="url(#gBody)"/>
<!-- 驼背隆起 -->
<path d="M18 30 Q14 20 22 16 Q30 14 36 22 Q28 22 24 28 Z" fill="#5a3880"/>
<!-- 腰布(破烂) -->
<path d="M17 60 L44 60 L42 68 Q36 72 28 72 Q22 70 18 68 Z" fill="url(#gCloth)"/>
<path d="M22 68 L20 78 M28 70 L28 80 M34 70 L36 78" stroke="#1a1528" stroke-width="2" fill="none"/>
<!-- 左臂(后,伸向右) -->
<rect x="40" y="30" width="6" height="18" rx="3" fill="#3d2260" transform="rotate(-20 43 38)"/>
<!-- 右臂(持弯刀,向右伸出) -->
<path d="M18 32 Q8 38 4 46" stroke="#4a2e6e" stroke-width="7" stroke-linecap="round" fill="none"/>
<!-- 弯刀刀身 -->
<path d="M4 46 Q-2 54 2 60 Q6 56 8 52 Q10 60 6 66" stroke="#8f6ab8" stroke-width="2.5" fill="none" stroke-linecap="round"/>
<path d="M2 60 Q4 62 6 66 L8 64 Z" fill="#7a5a9e"/>
<!-- 左腿 -->
<rect x="21" y="68" width="7" height="22" rx="3" fill="#4a2e6e"/>
<!-- 爪足左 -->
<path d="M20 88 h10 l2 6 h-3 l-2 -3 l-2 3 l-2 -3 l-2 3 h-3 Z" fill="#3d2260"/>
<!-- 颈+头(驼背,头前倾) -->
<ellipse cx="40" cy="22" rx="9" ry="10" fill="#5a3880"/>
<!-- 耳朵(尖) -->
<path d="M33 16 L30 6 L37 14 Z" fill="#4a2e6e"/>
<path d="M47 16 L50 6 L44 14 Z" fill="#4a2e6e"/>
<!-- 发光眼睛 -->
<ellipse cx="36" cy="22" rx="3" ry="2.5" fill="#d4f0c0" opacity="0.9"/>
<ellipse cx="44" cy="22" rx="3" ry="2.5" fill="#d4f0c0" opacity="0.9"/>
<ellipse cx="36" cy="22" rx="1.5" ry="1.2" fill="#aae880"/>
<ellipse cx="44" cy="22" rx="1.5" ry="1.2" fill="#aae880"/>
<!-- 牙齿 -->
<path d="M36 28 l2 4 l2 -4 l2 4 l2 -4" stroke="#e8e0f0" stroke-width="1.2" fill="none"/>
</svg>`;

// RANGER 远程: hooded crossbow figure, facing LEFT
const RANGER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 96">
<defs>
  <linearGradient id="rHood" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#2c3548"/><stop offset="1" stop-color="#1c2232"/>
  </linearGradient>
  <linearGradient id="rBody" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#3a4a60"/><stop offset="0.5" stop-color="#4a5a72"/>
    <stop offset="1" stop-color="#3a4a60"/>
  </linearGradient>
  <linearGradient id="rCloak" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#2c3548"/><stop offset="1" stop-color="#181e2e"/>
  </linearGradient>
</defs>
<!-- 斗篷后摆 -->
<path d="M22 36 Q10 54 12 84 L26 82 Q20 56 28 38 Z" fill="url(#rCloak)"/>
<!-- 箭囊(背部右侧) -->
<rect x="40" y="28" width="8" height="28" rx="3" fill="#2c3548"/>
<rect x="41" y="26" width="2" height="8" rx="1" fill="#6a7e9c"/>
<rect x="44" y="24" width="2" height="10" rx="1" fill="#6a7e9c"/>
<rect x="47" y="26" width="2" height="8" rx="1" fill="#6a7e9c"/>
<!-- 腿 -->
<rect x="23" y="70" width="8" height="22" rx="3" fill="#252e40"/>
<rect x="34" y="70" width="8" height="22" rx="3" fill="#2c3548"/>
<!-- 靴 -->
<path d="M22 90 h10 v5 h-12 q-1 -3 2 -5 Z" fill="#161d2c"/>
<path d="M33 90 h10 v5 h-12 q-1 -3 2 -5 Z" fill="#1e2638"/>
<!-- 躯干 -->
<path d="M20 34 Q32 28 46 34 L46 62 Q32 68 20 62 Z" fill="url(#rBody)"/>
<!-- 腰带 -->
<rect x="20" y="58" width="26" height="5" rx="2" fill="#1c2232"/>
<circle cx="33" cy="60.5" r="1.8" fill="#8a9ab8"/>
<!-- 左臂(后) -->
<rect x="18" y="36" width="7" height="15" rx="3.5" fill="#3a4a60"/>
<!-- 右臂(持弩,向右伸出) -->
<path d="M18 42 Q8 42 2 40" stroke="#4a5a72" stroke-width="7" stroke-linecap="round" fill="none"/>
<!-- 弩身 -->
<rect x="0" y="37" width="18" height="7" rx="2.5" fill="#2c3548"/>
<rect x="6" y="33" width="6" height="5" rx="1.5" fill="#3a4a60"/>
<!-- 弩弓臂 -->
<path d="M1 38 Q-2 42 1 46" stroke="#6a7e9c" stroke-width="2.5" fill="none" stroke-linecap="round"/>
<!-- 弩弦 -->
<path d="M1 38 L6 41 L1 46" stroke="#8a9ab8" stroke-width="1" fill="none"/>
<!-- 瞄准中的箭 -->
<line x1="14" y1="41" x2="26" y2="41" stroke="#c0a870" stroke-width="1.5"/>
<!-- 肩 -->
<ellipse cx="22" cy="34" rx="6.5" ry="5" fill="#6a7e9c"/>
<ellipse cx="44" cy="34" rx="6.5" ry="5" fill="#6a7e9c"/>
<!-- 头(被兜帽笼罩) -->
<path d="M20 22 Q20 8 33 8 Q46 8 46 22 Q46 26 44 28 L22 28 Q20 26 20 22 Z" fill="url(#rHood)"/>
<!-- 兜帽阴影区(只露眼) -->
<path d="M22 20 Q22 10 33 10 Q44 10 44 20 Q44 24 42 26 L24 26 Q22 24 22 20 Z" fill="#111826"/>
<!-- 发光眼睛 -->
<ellipse cx="29" cy="21" rx="2.8" ry="2" fill="#60c8e0" opacity="0.9"/>
<ellipse cx="37" cy="21" rx="2.8" ry="2" fill="#60c8e0" opacity="0.9"/>
<ellipse cx="29" cy="21" rx="1.4" ry="1" fill="#a0e8f8"/>
<ellipse cx="37" cy="21" rx="1.4" ry="1" fill="#a0e8f8"/>
</svg>`;

// HEAVY 重甲: squat iron juggernaut, facing LEFT, viewBox 0 0 96 96
const HEAVY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
<defs>
  <linearGradient id="hArmor" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#5c2424"/><stop offset="0.4" stop-color="#7a2e2e"/>
    <stop offset="0.7" stop-color="#a04848"/><stop offset="1" stop-color="#6a2c2c"/>
  </linearGradient>
  <linearGradient id="hHelm" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#8c3a3a"/><stop offset="1" stop-color="#5c2424"/>
  </linearGradient>
  <linearGradient id="hIron" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#404050"/><stop offset="0.5" stop-color="#606078"/>
    <stop offset="1" stop-color="#404050"/>
  </linearGradient>
  <linearGradient id="hMaul" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#555568"/><stop offset="1" stop-color="#383845"/>
  </linearGradient>
</defs>
<!-- 大锤柄(扛肩) -->
<rect x="6" y="14" width="6" height="60" rx="3" fill="#4a4a5a" transform="rotate(-10 9 44)"/>
<!-- 大锤头 -->
<rect x="-2" y="8" width="24" height="22" rx="4" fill="url(#hMaul)"/>
<rect x="-2" y="8" width="24" height="7" rx="2" fill="#707088" opacity="0.7"/>
<!-- 铆钉装饰 -->
<circle cx="4" cy="13" r="2" fill="#888898"/>
<circle cx="16" cy="13" r="2" fill="#888898"/>
<circle cx="4" cy="26" r="2" fill="#888898"/>
<circle cx="16" cy="26" r="2" fill="#888898"/>
<!-- 左臂持锤 -->
<path d="M26 36 Q16 28 10 20" stroke="#6a2c2c" stroke-width="12" stroke-linecap="round" fill="none"/>
<path d="M26 36 Q16 28 10 20" stroke="#7a3838" stroke-width="8" stroke-linecap="round" fill="none"/>
<!-- 腿(粗壮) -->
<rect x="22" y="66" width="18" height="26" rx="4" fill="#5c2424"/>
<rect x="44" y="66" width="18" height="26" rx="4" fill="#6a2c2c"/>
<!-- 护膝 -->
<ellipse cx="31" cy="68" rx="10" ry="6" fill="url(#hIron)"/>
<ellipse cx="53" cy="68" rx="10" ry="6" fill="url(#hIron)"/>
<!-- 铁靴 -->
<path d="M20 90 h22 v6 h-24 q-2 -4 2 -6 Z" fill="#383845"/>
<path d="M42 90 h22 v6 h-24 q-2 -4 2 -6 Z" fill="#404050"/>
<!-- 躯干主体(宽厚) -->
<path d="M16 28 Q48 20 82 28 L84 66 Q48 76 14 66 Z" fill="url(#hArmor)"/>
<!-- 胸甲高光 -->
<path d="M16 28 Q48 20 82 28 L82 38 Q48 28 16 38 Z" fill="#b05858" opacity="0.6"/>
<!-- 铆钉装饰行 -->
<g fill="#c07070" opacity="0.8">
  <circle cx="26" cy="34" r="2.2"/><circle cx="38" cy="31" r="2.2"/>
  <circle cx="50" cy="30" r="2.2"/><circle cx="62" cy="31" r="2.2"/>
  <circle cx="74" cy="34" r="2.2"/>
</g>
<g fill="#c07070" opacity="0.6">
  <circle cx="26" cy="54" r="2"/><circle cx="38" cy="56" r="2"/>
  <circle cx="50" cy="57" r="2"/><circle cx="62" cy="56" r="2"/>
  <circle cx="74" cy="54" r="2"/>
</g>
<!-- 腰甲 -->
<path d="M16 63 L84 63 L80 72 Q48 78 18 72 Z" fill="#5c2424"/>
<!-- 右臂(伸向左,后方) -->
<rect x="76" y="32" width="12" height="22" rx="6" fill="#6a2c2c"/>
<!-- 肩甲 -->
<ellipse cx="20" cy="28" rx="12" ry="9" fill="url(#hHelm)"/>
<ellipse cx="78" cy="28" rx="12" ry="9" fill="url(#hHelm)"/>
<!-- 颈 -->
<rect x="42" y="16" width="14" height="14" rx="3" fill="#6a2c2c"/>
<!-- 头盔(矮宽) -->
<path d="M32 18 Q48 10 66 18 L66 14 Q66 6 56 4 L42 4 Q32 6 32 14 Z" fill="url(#hHelm)"/>
<path d="M32 14 h34 v6 Q48 24 32 20 Z" fill="#5c2424"/>
<!-- 观察缝(极窄) -->
<rect x="38" y="16" width="22" height="3" rx="1.5" fill="#1a0808"/>
<rect x="44" y="16.5" width="10" height="2" rx="1" fill="#ff4444" opacity="0.4"/>
</svg>`;

function svgToImage(svg) {
  const img = new Image();
  img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
  return img;
}

// 生成色彩变体:white = 全白剪影(闪白),dark = 压暗(尸体)
// w/h: canvas size matched to sprite aspect ratio
function makeVariant(img, mode, w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0, c.width, c.height);
  x.globalCompositeOperation = mode === 'white' ? 'source-in' : 'source-atop';
  x.fillStyle = mode === 'white' ? '#ffffff' : 'rgba(20,16,28,0.55)';
  x.fillRect(0, 0, c.width, c.height);
  return c;
}

export const sprites = {
  knight: svgToImage(KNIGHT_SVG),
  knightWhite: null,
  grunt: svgToImage(GRUNT_SVG),
  gruntWhite: null, gruntDark: null,
  ranger: svgToImage(RANGER_SVG),
  rangerWhite: null, rangerDark: null,
  heavy: svgToImage(HEAVY_SVG),
  heavyWhite: null, heavyDark: null,
  ready: false,
};

const baseImgs = [sprites.knight, sprites.grunt, sprites.ranger, sprites.heavy];
let loaded = 0;
for (const img of baseImgs) {
  img.onload = () => {
    if (++loaded === baseImgs.length) {
      // 64×96 sprites → 144×216 canvas; heavy 96×96 → 216×216
      sprites.knightWhite = makeVariant(sprites.knight, 'white', 144, 216);
      sprites.gruntWhite  = makeVariant(sprites.grunt,  'white', 144, 216);
      sprites.gruntDark   = makeVariant(sprites.grunt,  'dark',  144, 216);
      sprites.rangerWhite = makeVariant(sprites.ranger, 'white', 144, 216);
      sprites.rangerDark  = makeVariant(sprites.ranger, 'dark',  144, 216);
      sprites.heavyWhite  = makeVariant(sprites.heavy,  'white', 216, 216);
      sprites.heavyDark   = makeVariant(sprites.heavy,  'dark',  216, 216);
      sprites.ready = true;
    }
  };
}
