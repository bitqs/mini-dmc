// js/main.js — Task 4 测试台:玩家状态机 + 一个测试假人。
// Task 5 会用真正的敌人 AI 替换这里的 dummy。

import { startLoop, W, H, GROUND, time } from './core/loop.js';
import { fx, installFx } from './core/fx.js';
import { sprites } from './core/sprites.js';
import { createPlayer } from './game/player.js';

installFx();

const player = createPlayer();

// ---------- 测试假人(entity contract, grunt, hp 40, 死后 1s 在 x=550 复活)----------
const dummy = {
  x: 550, y: GROUND,
  vx: 0, vy: 0,
  w: 44, h: 64,
  hp: 40, maxHp: 40,
  alive: true,
  facing: -1,
  kind: 'grunt',
  flashT: 0, squashT: 0, staggerT: 0, selfFreeze: 0,
  airborne: false, dy: 0,
  armored: false,
  respawnT: 0,
};

const projectiles = [];   // Task 5 才有弩箭;先留空数组验证击落管线不崩

// ---------- 键盘 → player.input ----------
const keys = {};
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;   // 长按只算一次按下(边沿检测在 player 内部,这里挡 OS repeat)
  keys[e.code] = true;
  // 防页面滚动
  if (['Space', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'ArrowDown'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

function readKeyboard() {
  const i = player.input;
  i.left   = !!(keys['KeyA'] || keys['ArrowLeft']);
  i.right  = !!(keys['KeyD'] || keys['ArrowRight']);
  i.up     = !!(keys['KeyW'] || keys['ArrowUp']);
  // W / ArrowUp 同时是 jump(按下触发);player 内部 pressed() 做边沿
  i.jump   = !!(keys['KeyW'] || keys['ArrowUp']);
  i.attack = !!(keys['KeyJ'] || keys['Space']);
  i.dodge  = !!(keys['KeyK'] || keys['ShiftLeft'] || keys['ShiftRight']);
}

// ---------- 触摸按钮 → player.input(按住 = true)----------
function bindTouch(id, prop) {
  const el = document.getElementById(id);
  if (!el) return;
  const set = (v) => (e) => { e.preventDefault(); touch[prop] = v; };
  el.addEventListener('touchstart', set(true), { passive: false });
  el.addEventListener('touchend', set(false), { passive: false });
  el.addEventListener('touchcancel', set(false), { passive: false });
  el.addEventListener('mousedown', set(true));
  el.addEventListener('mouseup', set(false));
  el.addEventListener('mouseleave', set(false));
}
const touch = { left: false, right: false, jump: false, attack: false, dodge: false };
bindTouch('btn-left', 'left');
bindTouch('btn-right', 'right');
bindTouch('btn-jump', 'jump');
bindTouch('btn-atk', 'attack');
bindTouch('btn-dodge', 'dodge');

// ---------- 更新 ----------
function update(dt) {
  readKeyboard();
  // 触摸叠加(任一来源按下即视为按下);jump/up 共用
  player.input.left   = player.input.left   || touch.left;
  player.input.right  = player.input.right  || touch.right;
  player.input.jump   = player.input.jump   || touch.jump;
  player.input.up     = player.input.up     || touch.jump;
  player.input.attack = player.input.attack || touch.attack;
  player.input.dodge  = player.input.dodge  || touch.dodge;

  player.update(dt, { enemies: [dummy], projectiles });

  updateDummy(dt);

  fx.fire('onUpdate', { dt });
}

// 假人最小物理:vx 阻尼 / 浮空重力 / 命中字段衰减(移植 juice-lab scene.js update 衰减块)
function updateDummy(dt) {
  const d = dummy;

  // 命中字段衰减(顿帧时 dt=0 也要衰减闪白/挤压,用真实步长)
  d.flashT   = Math.max(0, d.flashT - (dt || 0.016));
  d.squashT  = Math.max(0, d.squashT - (dt || 0.016) * 6);
  d.staggerT = Math.max(0, d.staggerT - (dt || 0.016) * 2.2);
  d.selfFreeze = Math.max(0, d.selfFreeze - 0.016);

  if (dt === 0) return;             // 世界顿帧
  if (d.selfFreeze > 0) return;     // 对象级顿帧:冻自己

  // 水平击退阻尼
  d.x += d.vx * dt;
  d.vx *= Math.pow(0.002, dt);

  // 浮空 / 腾空物理(挑空 vy<0 上飞,砸地 vy>0)
  if (d.airborne || d.dy > 0 || d.vy !== 0) {
    d.vy += 1400 * dt;
    d.dy = Math.max(0, d.dy - d.vy * dt);   // dy = 离地高度
    if (d.dy <= 0 && d.vy > 0) { d.dy = 0; d.vy = 0; d.airborne = false; }
  }

  // 边界
  d.x = Math.max(60, Math.min(W - 40, d.x));

  // 死亡 → 复活
  if (!d.alive) {
    d.respawnT -= dt;
    if (d.respawnT <= 0) {
      d.alive = true; d.hp = d.maxHp;
      d.x = 550; d.vx = 0; d.vy = 0; d.dy = 0;
      d.airborne = false; d.flashT = 0; d.squashT = 0; d.staggerT = 0; d.selfFreeze = 0;
    }
  } else if (d.hp <= 0) {
    d.alive = false; d.respawnT = 1.0;
  }
}

// ---------- 绘制 ----------
function draw(ctx) {
  // 背景
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#11101f');
  sky.addColorStop(0.7, '#171527');
  sky.addColorStop(1, '#0d0c16');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // 地台
  ctx.fillStyle = '#1e1c30';
  ctx.fillRect(0, GROUND + 6, W, H - GROUND - 6);
  ctx.strokeStyle = '#ffd34d33';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, GROUND + 6); ctx.lineTo(W, GROUND + 6); ctx.stroke();

  drawDummy(ctx);
  player.draw(ctx);

  fx.fire('onDraw', { ctx });

  // debug HUD
  ctx.font = '12px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.textAlign = 'left';
  ctx.fillText(`state:${player.state}  combo:${player.combo}  air:${player.airCombo}  hp:${player.hp}`, 10, 18);
  ctx.fillText('A/D move  W/↑ jump  J/Space attack  K/Shift dodge  W+J launcher', 10, 34);
}

function drawDummy(ctx) {
  const d = dummy;
  ctx.save();

  const jx = d.selfFreeze > 0 ? (Math.random() * 2 - 1) * 1.6 : 0;
  const jy = d.selfFreeze > 0 ? (Math.random() * 2 - 1) * 1.2 : 0;

  // 锚点:脚在 y,腾空抬升 dy
  ctx.translate(d.x + jx, d.y - d.dy - d.h / 2 + jy);

  // 影子(贴地)
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(0, d.h / 2 + 6 + d.dy, 22, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (d.squashT > 0 && d.alive) {
    const q = Math.sin(d.squashT * Math.PI) * 0.18;
    ctx.scale(1 + q, 1 - q);
  }
  if (d.alive && d.staggerT > 0) ctx.rotate(d.staggerT * 0.14);
  if (!d.alive) ctx.rotate(0.55);

  // grunt 朝左,玩家在左侧 → 不镜像;直接画
  if (sprites.ready) {
    const flashing = d.flashT > 0;
    const img = flashing ? sprites.gruntWhite : (d.alive ? sprites.grunt : sprites.gruntDark);
    ctx.drawImage(img, -41, -d.h / 2 - 24, 83, 115);
  } else {
    ctx.fillStyle = d.flashT > 0 ? '#fff' : (d.alive ? '#8f6ab8' : '#6e4a32');
    ctx.fillRect(-d.w / 2, -d.h / 2, d.w, d.h);
  }

  // 血条
  if (d.alive) {
    const bw = 50, bh = 6, byy = -d.h / 2 - 18;
    ctx.fillStyle = 'rgba(13,12,22,0.85)';
    ctx.fillRect(-bw / 2 - 1, byy - 1, bw + 2, bh + 2);
    const pct = d.hp / d.maxHp;
    ctx.fillStyle = pct > 0.35 ? '#5dff8f' : '#ff5d5d';
    ctx.fillRect(-bw / 2, byy, bw * pct, bh);
  }

  ctx.restore();
}

startLoop({ update, draw });

// debug handle
window.__game = { time, fx, player, dummy };
